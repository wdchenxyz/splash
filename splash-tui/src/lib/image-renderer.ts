/**
 * Image-to-terminal renderer using half-block characters (▀).
 *
 * Technique: each terminal cell displays TWO vertical pixels.
 * The upper-half-block character "▀" uses:
 *   - foreground color → top pixel
 *   - background color → bottom pixel
 *
 * This gives 2x vertical resolution compared to plain colored spaces.
 * Same technique used by opentui-doom for full-color framebuffer rendering.
 *
 * Supports two scale modes:
 *   - "fit"  (object-fit: contain) - show entire image, may leave empty space
 *   - "fill" (object-fit: cover)   - fill entire area, may crop edges
 *
 * Quality: Images are pre-downscaled with Jimp's resampling before
 * rendering, so all source pixels contribute to the final color.
 */

import { Jimp } from "jimp"
import { RGBA, type OptimizedBuffer } from "@opentui/core"

export type ScaleMode = "fit" | "fill"

export interface ImageData {
  /** Original Jimp image (kept for resampling at different sizes) */
  jimp: ReturnType<typeof Jimp.prototype.clone>
  /** Original dimensions */
  width: number
  height: number
  /** Original filename */
  name: string
}

/**
 * Load an image from disk.
 */
export async function loadImage(path: string): Promise<ImageData> {
  const image = await Jimp.read(path)
  const name = path.split("/").pop() ?? path
  return {
    jimp: image,
    width: image.bitmap.width,
    height: image.bitmap.height,
    name,
  }
}

/**
 * Render an image into an OptimizedBuffer using half-block characters.
 *
 * @param fb        - The target OptimizedBuffer
 * @param image     - Loaded image data
 * @param offsetX   - X offset in the framebuffer (terminal columns)
 * @param offsetY   - Y offset in the framebuffer (terminal rows)
 * @param maxW      - Max width in terminal columns
 * @param maxH      - Max height in terminal rows (each row = 2 image pixels)
 * @param scaleMode - "fit" to show entire image, "fill" to fill entire area
 */
export function renderImageToBuffer(
  fb: OptimizedBuffer,
  image: ImageData,
  offsetX: number,
  offsetY: number,
  maxW: number,
  maxH: number,
  scaleMode: ScaleMode = "fill",
): { renderW: number; renderH: number } {
  // Each terminal row = 2 vertical pixels via half-block chars
  const maxPixelH = maxH * 2

  if (scaleMode === "fill") {
    return renderFill(fb, image, offsetX, offsetY, maxW, maxH, maxPixelH)
  } else {
    return renderFit(fb, image, offsetX, offsetY, maxW, maxH, maxPixelH)
  }
}

/**
 * Fill mode (object-fit: cover): scale to fill the entire area, crop overflow.
 * Uses 100% of the available terminal space.
 */
function renderFill(
  fb: OptimizedBuffer,
  image: ImageData,
  offsetX: number,
  offsetY: number,
  maxW: number,
  maxH: number,
  maxPixelH: number,
): { renderW: number; renderH: number } {
  // Scale to COVER: use the larger scale so image fills the entire area
  const scaleX = maxW / image.width
  const scaleY = maxPixelH / image.height
  const scale = Math.max(scaleX, scaleY)

  // Resize image to cover dimensions (one axis matches, other is larger)
  const resizedW = Math.max(maxW, Math.ceil(image.width * scale))
  const resizedH = Math.max(maxPixelH, Math.ceil(image.height * scale))

  const resized = image.jimp.clone().resize({ w: resizedW, h: resizedH })
  const pixels = resized.bitmap.data
  const rw = resized.bitmap.width
  const rh = resized.bitmap.height

  // Center-crop: compute offsets to center the image in the available area
  const cropX = Math.floor((rw - maxW) / 2)
  const cropY = Math.floor((rh - maxPixelH) / 2)

  const cellW = maxW
  const cellH = maxH

  for (let y = 0; y < cellH; y++) {
    const srcY1 = Math.min(cropY + y * 2, rh - 1)
    const srcY2 = Math.min(cropY + y * 2 + 1, rh - 1)

    for (let x = 0; x < cellW; x++) {
      const srcX = Math.min(cropX + x, rw - 1)

      // Top pixel → foreground
      const idx1 = (srcY1 * rw + srcX) * 4
      const r1 = pixels[idx1] ?? 0
      const g1 = pixels[idx1 + 1] ?? 0
      const b1 = pixels[idx1 + 2] ?? 0

      // Bottom pixel → background
      const idx2 = (srcY2 * rw + srcX) * 4
      const r2 = pixels[idx2] ?? 0
      const g2 = pixels[idx2 + 1] ?? 0
      const b2 = pixels[idx2 + 2] ?? 0

      fb.setCell(
        offsetX + x,
        offsetY + y,
        "▀",
        RGBA.fromInts(r1, g1, b1),
        RGBA.fromInts(r2, g2, b2),
      )
    }
  }

  return { renderW: cellW, renderH: cellH }
}

/**
 * Fit mode (object-fit: contain): scale to fit entirely within the area.
 * Image is centered; may leave empty space on sides.
 */
function renderFit(
  fb: OptimizedBuffer,
  image: ImageData,
  offsetX: number,
  offsetY: number,
  maxW: number,
  maxH: number,
  maxPixelH: number,
): { renderW: number; renderH: number } {
  // Scale to FIT: use the smaller scale so image fits entirely
  const scaleX = maxW / image.width
  const scaleY = maxPixelH / image.height
  const scale = Math.min(scaleX, scaleY)

  const targetW = Math.max(1, Math.floor(image.width * scale))
  const targetH = Math.max(2, Math.floor(image.height * scale))

  const resized = image.jimp.clone().resize({ w: targetW, h: targetH })
  const pixels = resized.bitmap.data
  const rw = resized.bitmap.width
  const rh = resized.bitmap.height

  const cellW = rw
  const cellH = Math.ceil(rh / 2)

  // Center the image in the available area
  const padX = Math.floor((maxW - cellW) / 2)
  const padY = Math.floor((maxH - cellH) / 2)

  for (let y = 0; y < cellH; y++) {
    const srcY1 = Math.min(y * 2, rh - 1)
    const srcY2 = Math.min(y * 2 + 1, rh - 1)

    for (let x = 0; x < cellW; x++) {
      const idx1 = (srcY1 * rw + x) * 4
      const r1 = pixels[idx1] ?? 0
      const g1 = pixels[idx1 + 1] ?? 0
      const b1 = pixels[idx1 + 2] ?? 0

      const idx2 = (srcY2 * rw + x) * 4
      const r2 = pixels[idx2] ?? 0
      const g2 = pixels[idx2 + 1] ?? 0
      const b2 = pixels[idx2 + 2] ?? 0

      fb.setCell(
        offsetX + padX + x,
        offsetY + padY + y,
        "▀",
        RGBA.fromInts(r1, g1, b1),
        RGBA.fromInts(r2, g2, b2),
      )
    }
  }

  return { renderW: cellW, renderH: cellH }
}

/**
 * Render image as grayscale using drawGrayscaleBufferSupersampled.
 * Uses Jimp resampling + OpenTUI's native Zig-backed grayscale renderer.
 */
export function renderGrayscaleToBuffer(
  fb: OptimizedBuffer,
  image: ImageData,
  offsetX: number,
  offsetY: number,
  maxW: number,
  maxH: number,
  fg?: RGBA | null,
  bg?: RGBA | null,
): void {
  const maxPixelH = maxH * 2

  // Scale to cover the area for best detail
  const scaleX = maxW / image.width
  const scaleY = maxPixelH / image.height
  const scale = Math.max(scaleX, scaleY)

  const resizedW = Math.max(maxW, Math.ceil(image.width * scale))
  const resizedH = Math.max(maxPixelH, Math.ceil(image.height * scale))

  const resized = image.jimp.clone().resize({ w: resizedW, h: resizedH })
  const pixels = resized.bitmap.data
  const rw = resized.bitmap.width
  const rh = resized.bitmap.height

  // Center crop
  const cropX = Math.floor((rw - maxW) / 2)
  const cropY = Math.floor((rh - maxPixelH) / 2)

  // Supersampled expects 2x resolution input
  const ssWidth = maxW * 2
  const ssHeight = maxH * 2
  const intensities = new Float32Array(ssWidth * ssHeight)

  for (let y = 0; y < ssHeight; y++) {
    const srcY = Math.min(cropY + Math.floor(y / 2) * 2 + (y % 2), rh - 1)
    for (let x = 0; x < ssWidth; x++) {
      const srcX = Math.min(cropX + Math.floor(x / 2), rw - 1)
      const idx = (srcY * rw + srcX) * 4
      const r = pixels[idx] ?? 0
      const g = pixels[idx + 1] ?? 0
      const b = pixels[idx + 2] ?? 0
      intensities[y * ssWidth + x] = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    }
  }

  fb.drawGrayscaleBufferSupersampled(offsetX, offsetY, intensities, ssWidth, ssHeight, fg, bg)
}
