import { useCallback, useEffect, useMemo, useRef } from "react"
import { useRenderer } from "@opentui/react"
import { FrameBufferRenderable, RGBA, TextRenderable } from "@opentui/core"
import {
  loadImage,
  renderImageToBuffer,
  renderGrayscaleToBuffer,
  type ImageData,
  type ScaleMode,
} from "../lib/image-renderer"
import {
  createRendererKittyWriter,
  createVirtualImage,
  deleteImage,
  detectKittySupport,
  type KittySupport,
  type KittyVirtualImage,
} from "../lib/kitty-graphics"

export type TerminalImageBackend = "auto" | "kitty" | "cell"
export type TerminalImageMode = "color" | "grayscale"

export interface TerminalImageArea {
  left: number
  top: number
  cols: number
  rows: number
}

export interface TerminalImageState {
  requestedBackend: TerminalImageBackend
  backend: "kitty" | "cell" | null
  loading: boolean
  error: string | null
  note: string | null
  support: KittySupport
  image: {
    src: string
    name: string
    width: number
    height: number
  } | null
  placement: {
    left: number
    top: number
    cols: number
    rows: number
  } | null
  cell?: {
    renderW: number
    renderH: number
    mode: TerminalImageMode
    scaleMode: ScaleMode
  } | null
}

export interface TerminalImageProps {
  src: string | null
  area: TerminalImageArea
  backend?: TerminalImageBackend
  mode?: TerminalImageMode
  scaleMode?: ScaleMode
  onStateChange?: (state: TerminalImageState) => void
  id?: string
  cellBackgroundColor?: string
  grayscaleFg?: string
  grayscaleBg?: string
}

function clampArea(area: TerminalImageArea): TerminalImageArea {
  return {
    left: Math.max(0, area.left),
    top: Math.max(0, area.top),
    cols: Math.max(1, area.cols),
    rows: Math.max(1, area.rows),
  }
}

function computeKittyPlacement(
  image: ImageData,
  area: TerminalImageArea,
  terminal: { width: number; height: number },
  resolution: { width: number; height: number } | null,
) {
  const frame = clampArea(area)
  const cellWidth = resolution?.width ? resolution.width / terminal.width : 8
  const cellHeight = resolution?.height ? resolution.height / terminal.height : 16

  const scale = Math.min(
    (frame.cols * cellWidth) / image.width,
    (frame.rows * cellHeight) / image.height,
  )

  const cols = Math.max(
    1,
    Math.min(frame.cols, Math.round((image.width * scale) / cellWidth)),
  )
  const rows = Math.max(
    1,
    Math.min(frame.rows, Math.round((image.height * scale) / cellHeight)),
  )

  return {
    left: frame.left + Math.max(0, Math.floor((frame.cols - cols) / 2)),
    top: frame.top,
    cols,
    rows,
  }
}

export function TerminalImage({
  src,
  area,
  backend = "auto",
  mode = "color",
  scaleMode = "fill",
  onStateChange,
  id,
  cellBackgroundColor = "#1a1b26",
  grayscaleFg = "#c0caf5",
  grayscaleBg = "#1a1b26",
}: TerminalImageProps) {
  const renderer = useRenderer()
  const supportRef = useRef(detectKittySupport())
  const imageCache = useRef<Map<string, ImageData>>(new Map())
  const fbRef = useRef<FrameBufferRenderable | null>(null)
  const kittyTextRef = useRef<TextRenderable | null>(null)
  const kittyImageRef = useRef<KittyVirtualImage | null>(null)
  const onStateChangeRef = useRef(onStateChange)
  const instanceIdRef = useRef(id ?? `terminal-image-${Math.random().toString(36).slice(2, 8)}`)
  const frameBufferId = `${instanceIdRef.current}-fb`
  const kittyTextId = `${instanceIdRef.current}-kitty-text`
  const kittyWriter = useMemo(
    () => createRendererKittyWriter(renderer as unknown as { writeOut?: (chunk: string) => boolean }),
    [renderer],
  )

  useEffect(() => {
    onStateChangeRef.current = onStateChange
  }, [onStateChange])

  const emitState = useCallback((state: TerminalImageState) => {
    onStateChangeRef.current?.(state)
  }, [])

  const removeKittyImage = useCallback(() => {
    if (kittyTextRef.current) {
      try {
        renderer.root.remove(kittyTextId)
      } catch {
        // ignore
      }
      kittyTextRef.current = null
    }
    if (kittyImageRef.current) {
      deleteImage(kittyWriter, kittyImageRef.current.id)
      kittyImageRef.current = null
    }
  }, [kittyTextId, kittyWriter, renderer])

  const removeFramebuffer = useCallback(() => {
    try {
      renderer.root.remove(frameBufferId)
    } catch {
      // ignore
    }
    fbRef.current = null
  }, [frameBufferId, renderer])

  useEffect(() => {
    return () => {
      removeKittyImage()
      removeFramebuffer()
    }
  }, [removeFramebuffer, removeKittyImage])

  const ensureFramebuffer = useCallback(
    (frame: TerminalImageArea) => {
      if (fbRef.current) {
        const old = fbRef.current.frameBuffer
        if (old.width !== frame.cols || old.height !== frame.rows) {
          try {
            renderer.root.remove(frameBufferId)
          } catch {
            // ignore
          }
          fbRef.current = null
        }
      }

      if (!fbRef.current) {
        const fb = new FrameBufferRenderable(renderer, {
          id: frameBufferId,
          width: frame.cols,
          height: frame.rows,
          position: "absolute",
          left: frame.left,
          top: frame.top,
          zIndex: 50,
          respectAlpha: true,
        })
        renderer.root.add(fb)
        fbRef.current = fb
      }

      return fbRef.current
    },
    [frameBufferId, renderer],
  )

  useEffect(() => {
    const frame = clampArea(area)

    if (!src) {
      removeKittyImage()
      removeFramebuffer()
      emitState({
        requestedBackend: backend,
        backend: null,
        loading: false,
        error: null,
        note: null,
        support: supportRef.current,
        image: null,
        placement: null,
        cell: null,
      })
      return
    }

    const imageSrc = src
    let cancelled = false

    const renderCell = (
      image: ImageData,
      note: string | null,
      requestedBackend: TerminalImageBackend,
    ) => {
      removeKittyImage()
      const fb = ensureFramebuffer(frame)
      const buf = fb.frameBuffer
      buf.clear(RGBA.fromHex(cellBackgroundColor))

      if (mode === "color") {
        const { renderW, renderH } = renderImageToBuffer(
          buf,
          image,
          0,
          0,
          buf.width,
          buf.height,
          scaleMode,
        )
        renderer.requestRender()
        emitState({
          requestedBackend,
          backend: "cell",
          loading: false,
          error: null,
          note,
          support: supportRef.current,
          image: {
            src: imageSrc,
            name: image.name,
            width: image.width,
            height: image.height,
          },
          placement: {
            left: frame.left,
            top: frame.top,
            cols: frame.cols,
            rows: frame.rows,
          },
          cell: {
            renderW,
            renderH: renderH * 2,
            mode,
            scaleMode,
          },
        })
        return
      }

      renderGrayscaleToBuffer(
        buf,
        image,
        0,
        0,
        buf.width,
        buf.height,
        RGBA.fromHex(grayscaleFg),
        RGBA.fromHex(grayscaleBg),
      )
      renderer.requestRender()
      emitState({
        requestedBackend,
        backend: "cell",
        loading: false,
        error: null,
        note,
        support: supportRef.current,
        image: {
          src: imageSrc,
          name: image.name,
          width: image.width,
          height: image.height,
        },
        placement: {
          left: frame.left,
          top: frame.top,
          cols: frame.cols,
          rows: frame.rows,
        },
        cell: {
          renderW: frame.cols,
          renderH: frame.rows * 2,
          mode,
          scaleMode,
        },
      })
    }

    async function loadAndRender() {
      emitState({
        requestedBackend: backend,
        backend: null,
        loading: true,
        error: null,
        note: null,
        support: supportRef.current,
        image: null,
        placement: null,
        cell: null,
      })

      try {
        let image = imageCache.current.get(imageSrc)
        if (!image) {
          image = await loadImage(imageSrc)
          imageCache.current.set(imageSrc, image)
        }
        if (cancelled) {
          return
        }

        let requestedBackend = backend
        let initialNote: string | null = null
        if (requestedBackend === "auto") {
          requestedBackend = supportRef.current.supported ? "kitty" : "cell"
        }
        if (requestedBackend === "kitty" && !supportRef.current.supported) {
          requestedBackend = "cell"
          initialNote = `kitty unavailable: ${supportRef.current.reason}`
        }

        if (requestedBackend === "kitty") {
          removeFramebuffer()
          const placement = computeKittyPlacement(
            image,
            frame,
            { width: renderer.width, height: renderer.height },
            renderer.resolution,
          )

          removeKittyImage()
          const virtualImage = createVirtualImage(kittyWriter, imageSrc, placement.cols, placement.rows)
          kittyImageRef.current = virtualImage

          if (!kittyTextRef.current) {
            const renderable = new TextRenderable(renderer, {
              id: kittyTextId,
              content: virtualImage.placeholderText,
              position: "absolute",
              left: placement.left,
              top: placement.top,
              width: placement.cols,
              height: placement.rows,
              fg: virtualImage.color,
              zIndex: 49,
            })
            renderer.root.add(renderable)
            kittyTextRef.current = renderable
          } else {
            kittyTextRef.current.content = virtualImage.placeholderText
            kittyTextRef.current.fg = virtualImage.color
            kittyTextRef.current.x = placement.left
            kittyTextRef.current.y = placement.top
            kittyTextRef.current.width = placement.cols
            kittyTextRef.current.height = placement.rows
          }

          renderer.requestRender()
          emitState({
            requestedBackend: backend,
            backend: "kitty",
            loading: false,
            error: null,
            note: initialNote,
            support: supportRef.current,
            image: {
              src: imageSrc,
              name: image.name,
              width: image.width,
              height: image.height,
            },
            placement,
            cell: null,
          })
          return
        }

        renderCell(image, initialNote, backend)
      } catch (error) {
        if (cancelled) {
          return
        }

        const message = error instanceof Error ? error.message : String(error)
        try {
          const image = imageCache.current.get(imageSrc) ?? await loadImage(imageSrc)
          imageCache.current.set(imageSrc, image)

          if (backend !== "cell") {
            renderCell(image, `kitty failed: ${message}`, backend)
            return
          }
        } catch {
          // fall through to error state
        }

        emitState({
          requestedBackend: backend,
          backend: null,
          loading: false,
          error: message,
          note: null,
          support: supportRef.current,
          image: null,
          placement: null,
          cell: null,
        })
      }
    }

    loadAndRender()

    return () => {
      cancelled = true
    }
  }, [
    area.cols,
    area.left,
    area.rows,
    area.top,
    backend,
    cellBackgroundColor,
    emitState,
    ensureFramebuffer,
    grayscaleBg,
    grayscaleFg,
    kittyTextId,
    kittyWriter,
    mode,
    removeFramebuffer,
    removeKittyImage,
    renderer,
    scaleMode,
    src,
  ])

  return null
}
