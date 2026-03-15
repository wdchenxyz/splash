import { useState, useEffect, useRef, useCallback } from "react"
import { useRenderer, useKeyboard, useTerminalDimensions } from "@opentui/react"
import { FrameBufferRenderable, RGBA, TextRenderable } from "@opentui/core"
import {
  loadImage,
  renderImageToBuffer,
  renderGrayscaleToBuffer,
  type ImageData,
  type ScaleMode,
} from "../../lib/image-renderer"
import {
  createVirtualImage,
  deleteImage,
  detectKittySupport,
  setKittyOutput,
  type KittyVirtualImage,
} from "../../lib/kitty-graphics"
import { existsSync, readdirSync } from "fs"
import path from "path"

const IMAGE_DIR = path.resolve(import.meta.dir, "../../../../img_dir")
const IMAGE_FILES = existsSync(IMAGE_DIR)
  ? readdirSync(IMAGE_DIR)
      .filter((name) => /\.(png|jpg|jpeg|webp)$/i.test(name))
      .sort((a, b) => a.localeCompare(b))
  : []

type RenderMode = "color" | "grayscale"

const FB_ID = "image-viewer-fb"
const KITTY_TEXT_ID = "image-viewer-kitty-text"
const IMAGE_LEFT = 31
const IMAGE_TOP = 10

function computeKittyPlacement(
  image: ImageData,
  termW: number,
  termH: number,
  resolution: { width: number; height: number } | null,
) {
  const maxCols = Math.max(10, termW - IMAGE_LEFT - 2)
  const maxRows = Math.max(6, termH - IMAGE_TOP - 2)
  const cellWidth = resolution?.width ? resolution.width / termW : 8
  const cellHeight = resolution?.height ? resolution.height / termH : 16

  const scale = Math.min(
    (maxCols * cellWidth) / image.width,
    (maxRows * cellHeight) / image.height,
  )

  const cols = Math.max(
    1,
    Math.min(maxCols, Math.round((image.width * scale) / cellWidth)),
  )
  const rows = Math.max(
    1,
    Math.min(maxRows, Math.round((image.height * scale) / cellHeight)),
  )

  return {
    left: IMAGE_LEFT + Math.max(0, Math.floor((maxCols - cols) / 2)),
    top: IMAGE_TOP,
    cols,
    rows,
  }
}

export function ImagePanel() {
  const renderer = useRenderer()
  const { width: termW, height: termH } = useTerminalDimensions()
  const kittySupport = useRef(detectKittySupport())
  const [imageIndex, setImageIndex] = useState(0)
  const [mode, setMode] = useState<RenderMode>("color")
  const [scaleMode, setScaleMode] = useState<ScaleMode>("fill")
  const [backend, setBackend] = useState<"kitty" | "cell">(
    kittySupport.current.supported ? "kitty" : "cell",
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imageInfo, setImageInfo] = useState<string>("")
  const [backendNote, setBackendNote] = useState<string | null>(null)
  const imageCache = useRef<Map<string, ImageData>>(new Map())
  const fbRef = useRef<FrameBufferRenderable | null>(null)
  const kittyTextRef = useRef<TextRenderable | null>(null)
  const kittyImageRef = useRef<KittyVirtualImage | null>(null)

  useKeyboard((key) => {
    if (IMAGE_FILES.length === 0) {
      return
    }
    if (key.name === "right" || key.name === "l") {
      setImageIndex((i) => (i + 1) % IMAGE_FILES.length)
    }
    if (key.name === "left" || key.name === "h") {
      setImageIndex((i) => (i - 1 + IMAGE_FILES.length) % IMAGE_FILES.length)
    }
    if (key.name === "m") {
      setMode((m) => (m === "color" ? "grayscale" : "color"))
    }
    if (key.name === "f") {
      setScaleMode((s) => (s === "fill" ? "fit" : "fill"))
    }
    if (key.name === "b" && kittySupport.current.supported) {
      setBackendNote(null)
      setBackend((value) => (value === "kitty" ? "cell" : "kitty"))
    }
  })

  const removeKittyImage = useCallback(() => {
    if (kittyTextRef.current) {
      try {
        renderer.root.remove(KITTY_TEXT_ID)
      } catch {
        // ignore
      }
      kittyTextRef.current = null
    }
    if (kittyImageRef.current) {
      deleteImage(kittyImageRef.current.id)
      kittyImageRef.current = null
    }
  }, [renderer])

  const removeFramebuffer = useCallback(() => {
    try {
      renderer.root.remove(FB_ID)
    } catch {
      // ignore
    }
    fbRef.current = null
  }, [renderer])

  // Cleanup framebuffer on unmount
  useEffect(() => {
    setKittyOutput((data) => {
      const writeOut = (renderer as unknown as {
        writeOut?: (chunk: string) => boolean
      }).writeOut?.bind(renderer)
      if (writeOut) {
        writeOut(data)
        return
      }
      process.stdout.write(data)
    })

    return () => {
      setKittyOutput(null)
      removeKittyImage()
      removeFramebuffer()
    }
  }, [removeFramebuffer, removeKittyImage, renderer])

  const ensureFramebuffer = useCallback(
    (fbW: number, fbH: number, fbX: number, fbY: number) => {
      if (fbRef.current) {
        const old = fbRef.current.frameBuffer
        if (old.width !== fbW || old.height !== fbH) {
          try { renderer.root.remove(FB_ID) } catch { /* ignore */ }
          fbRef.current = null
        }
      }
      if (!fbRef.current) {
        const fb = new FrameBufferRenderable(renderer, {
          id: FB_ID, width: fbW, height: fbH,
          position: "absolute", left: fbX, top: fbY,
          zIndex: 50, respectAlpha: true,
        })
        renderer.root.add(fb)
        fbRef.current = fb
      }
      return fbRef.current
    },
    [renderer],
  )

  // Load and render current image
  useEffect(() => {
    const fileName = IMAGE_FILES[imageIndex]
    if (!fileName) {
      removeKittyImage()
      removeFramebuffer()
      setLoading(false)
      setError(null)
      setImageInfo(`No images found in ${path.basename(IMAGE_DIR)}/`)
      return
    }
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const filePath = path.join(IMAGE_DIR, fileName!)
        let image = imageCache.current.get(filePath)
        if (!image) {
          image = await loadImage(filePath)
          imageCache.current.set(filePath, image)
        }
        if (cancelled) return

        if (backend === "kitty") {
          removeFramebuffer()

          const layout = computeKittyPlacement(image, termW, termH, renderer.resolution)

          removeKittyImage()
          const virtualImage = createVirtualImage(filePath, layout.cols, layout.rows)
          kittyImageRef.current = virtualImage

          if (!kittyTextRef.current) {
            const renderable = new TextRenderable(renderer, {
              id: KITTY_TEXT_ID,
              content: virtualImage.placeholderText,
              position: "absolute",
              left: layout.left,
              top: layout.top,
              width: layout.cols,
              height: layout.rows,
              fg: virtualImage.color,
              zIndex: 49,
            })
            renderer.root.add(renderable)
            kittyTextRef.current = renderable
          } else {
            kittyTextRef.current.content = virtualImage.placeholderText
            kittyTextRef.current.fg = virtualImage.color
            kittyTextRef.current.x = layout.left
            kittyTextRef.current.y = layout.top
            kittyTextRef.current.width = layout.cols
            kittyTextRef.current.height = layout.rows
          }

          setBackendNote(null)
          setImageInfo(
            `${image.name} (${image.width}x${image.height}) [kitty ${layout.cols}x${layout.rows}]  h/l cycle  b cell`,
          )
          renderer.requestRender()
        } else {
          removeKittyImage()

          const fbX = IMAGE_LEFT
          const fbY = IMAGE_TOP
          const fbW = Math.max(10, termW - fbX - 2)
          const fbH = Math.max(5, termH - fbY - 2)

          const fb = ensureFramebuffer(fbW, fbH, fbX, fbY)
          const buf = fb.frameBuffer
          buf.clear(RGBA.fromInts(26, 27, 38, 255))

          if (mode === "color") {
            const { renderW, renderH } = renderImageToBuffer(
              buf, image, 0, 0, buf.width, buf.height, scaleMode,
            )
            setImageInfo(
              `${image.name} (${image.width}x${image.height}) [cell ${renderW}x${renderH * 2}] [${scaleMode}] [color]  h/l cycle  m gray  f mode${kittySupport.current.supported ? "  b kitty" : ""}`,
            )
          } else {
            renderGrayscaleToBuffer(
              buf, image, 0, 0, buf.width, buf.height,
              RGBA.fromHex("#c0caf5"), RGBA.fromHex("#1a1b26"),
            )
            setImageInfo(
              `${image.name} (${image.width}x${image.height}) [cell] [${scaleMode}] [grayscale]  h/l cycle  m color  f mode${kittySupport.current.supported ? "  b kitty" : ""}`,
            )
          }
          renderer.requestRender()
        }

        setLoading(false)
      } catch (e) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : String(e)
          if (backend === "kitty") {
            removeKittyImage()
            setBackendNote(`kitty failed: ${message}`)
            setBackend("cell")
            return
          }
          setError(message)
          setLoading(false)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [
    backend,
    imageIndex,
    mode,
    scaleMode,
    termW,
    termH,
    ensureFramebuffer,
    removeFramebuffer,
    removeKittyImage,
    renderer,
  ])

  return (
    <box flexDirection="column" gap={1}>
      <text>
        <span fg="#c0caf5"><strong>Image Viewer</strong></span>
        <span fg="#565f89">
          {backend === "kitty" ? " (kitty placeholder rendering)" : " (half-block rendering)"}
        </span>
      </text>

      {loading && (
        <text><span fg="#e0af68">Loading image...</span></text>
      )}
      {error && (
        <text><span fg="#f7768e">Error: {error}</span></text>
      )}
      {!loading && !error && (
        <text><span fg="#9ece6a">{imageInfo}</span></text>
      )}

      {backendNote && (
        <text>
          <span fg="#e0af68">{backendNote}</span>
        </text>
      )}

      {!loading && !error && (
        <text>
          <span fg="#565f89">[{imageIndex + 1}/{IMAGE_FILES.length}]</span>
        </text>
      )}
    </box>
  )
}
