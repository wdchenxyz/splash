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
import path from "path"

const IMAGE_DIR = path.resolve(import.meta.dir, "../../../../img_dir")

const IMAGE_FILES = [
  "image.png",
  "image2.png",
  "image-3.png",
  "image-4.png",
  "image-5.png",
  "image-6.png",
]

type RenderMode = "color" | "grayscale"

const FB_ID = "image-viewer-fb"
const KITTY_TEXT_ID = "image-viewer-kitty-text"

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
  const imageCache = useRef<Map<string, ImageData>>(new Map())
  const fbRef = useRef<FrameBufferRenderable | null>(null)
  const kittyTextRef = useRef<TextRenderable | null>(null)
  const kittyImageRef = useRef<KittyVirtualImage | null>(null)

  useKeyboard((key) => {
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
    if (!fileName) return
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

          const left = 31
          const top = 10
          const cols = Math.max(10, termW - left - 2)
          const rows = Math.max(6, termH - top - 2)

          removeKittyImage()
          const virtualImage = createVirtualImage(filePath, cols, rows)
          kittyImageRef.current = virtualImage

          if (!kittyTextRef.current) {
            const renderable = new TextRenderable(renderer, {
              id: KITTY_TEXT_ID,
              content: virtualImage.placeholderText,
              position: "absolute",
              left,
              top,
              width: cols,
              height: rows,
              fg: virtualImage.color,
              zIndex: 49,
            })
            renderer.root.add(renderable)
            kittyTextRef.current = renderable
          } else {
            kittyTextRef.current.content = virtualImage.placeholderText
            kittyTextRef.current.fg = virtualImage.color
            kittyTextRef.current.x = left
            kittyTextRef.current.y = top
            kittyTextRef.current.width = cols
            kittyTextRef.current.height = rows
          }

          setImageInfo(
            `${image.name} (${image.width}x${image.height}) [kitty placeholders ${cols}x${rows}]`,
          )
          renderer.requestRender()
        } else {
          removeKittyImage()

          const fbX = 31
          const fbY = 10
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
              `${image.name} (${image.width}x${image.height}) -> ${renderW}x${renderH * 2}px [${scaleMode}] [color] [cell]`,
            )
          } else {
            renderGrayscaleToBuffer(
              buf, image, 0, 0, buf.width, buf.height,
              RGBA.fromHex("#c0caf5"), RGBA.fromHex("#1a1b26"),
            )
            setImageInfo(
              `${image.name} (${image.width}x${image.height}) [${scaleMode}] [grayscale] [cell]`,
            )
          }
          renderer.requestRender()
        }

        setLoading(false)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
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

      <text>
        <span fg="#565f89"><strong>h/l</strong></span>
        <span fg="#414868"> prev/next </span>
        {backend === "cell" && (
          <>
            <span fg="#565f89"><strong>m</strong></span>
            <span fg="#414868"> color/gray </span>
            <span fg="#565f89"><strong>f</strong></span>
            <span fg="#414868"> {scaleMode === "fill" ? "fill->fit" : "fit->fill"} </span>
          </>
        )}
        {kittySupport.current.supported && (
          <>
            <span fg="#565f89"><strong>b</strong></span>
            <span fg="#414868"> {backend === "kitty" ? "kitty->cell" : "cell->kitty"} </span>
          </>
        )}
        <span fg="#7aa2f7">[{imageIndex + 1}/{IMAGE_FILES.length}]</span>
      </text>

      {backend === "kitty" && (
        <text>
          <span fg="#565f89">
            {kittySupport.current.terminal} via {kittySupport.current.transport} - {kittySupport.current.reason}
          </span>
        </text>
      )}
    </box>
  )
}
