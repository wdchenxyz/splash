import { useCallback, useMemo, useState } from "react"
import { useKeyboard, useTerminalDimensions } from "@opentui/react"
import {
  TerminalImage,
  type TerminalImageBackend,
  type TerminalImageState,
} from "../TerminalImage"
import type { ScaleMode } from "../../lib/image-renderer"
import {
  DEMO_IMAGE_DIR_NAME,
  DEMO_IMAGE_FILES,
  getDemoImagePath,
} from "../../lib/demo-images"

const IMAGE_FILES = DEMO_IMAGE_FILES

const IMAGE_LEFT = 31
const IMAGE_TOP = 10

type RenderMode = "color" | "grayscale"

function formatImageInfo(
  state: TerminalImageState | null,
  mode: RenderMode,
  scaleMode: ScaleMode,
) {
  if (!state?.image) {
    return ""
  }

  if (state.backend === "kitty" && state.placement) {
    return `${state.image.name} (${state.image.width}x${state.image.height}) [kitty ${state.placement.cols}x${state.placement.rows}]  h/l cycle${state.support.supported ? "  b cell" : ""}`
  }

  if (state.backend === "cell" && state.cell) {
    const modeLabel = mode === "color" ? "color" : "grayscale"
    const toggleLabel = mode === "color" ? "gray" : "color"
    return `${state.image.name} (${state.image.width}x${state.image.height}) [cell ${state.cell.renderW}x${state.cell.renderH}] [${scaleMode}] [${modeLabel}]  h/l cycle  m ${toggleLabel}  f mode${state.support.supported ? "  b kitty" : ""}`
  }

  return `${state.image.name} (${state.image.width}x${state.image.height})`
}

export function ImagePanel() {
  const { width, height } = useTerminalDimensions()
  const [imageIndex, setImageIndex] = useState(0)
  const [mode, setMode] = useState<RenderMode>("color")
  const [scaleMode, setScaleMode] = useState<ScaleMode>("fill")
  const [backend, setBackend] = useState<TerminalImageBackend>("auto")
  const [imageState, setImageState] = useState<TerminalImageState | null>(null)

  const currentPath = useMemo(() => {
    const fileName = IMAGE_FILES[imageIndex]
    return fileName ? getDemoImagePath(fileName) : null
  }, [imageIndex])

  const imageArea = useMemo(
    () => ({
      left: IMAGE_LEFT,
      top: IMAGE_TOP,
      cols: Math.max(10, width - IMAGE_LEFT - 2),
      rows: Math.max(6, height - IMAGE_TOP - 2),
    }),
    [height, width],
  )

  const handleImageStateChange = useCallback((state: TerminalImageState) => {
    setImageState(state)
  }, [])

  useKeyboard((key) => {
    if (IMAGE_FILES.length === 0) {
      return
    }

    if (key.name === "right" || key.name === "l") {
      setImageIndex((i) => (i + 1) % IMAGE_FILES.length)
      return
    }

    if (key.name === "left" || key.name === "h") {
      setImageIndex((i) => (i - 1 + IMAGE_FILES.length) % IMAGE_FILES.length)
      return
    }

    if (key.name === "m") {
      setMode((value) => (value === "color" ? "grayscale" : "color"))
      return
    }

    if (key.name === "f") {
      setScaleMode((value) => (value === "fill" ? "fit" : "fill"))
      return
    }

    if (key.name === "b" && imageState?.support.supported) {
      const activeBackend = imageState.backend ?? (backend === "cell" ? "cell" : "kitty")
      setBackend(activeBackend === "kitty" ? "cell" : "kitty")
    }
  })

  const infoText = formatImageInfo(imageState, mode, scaleMode)

  return (
    <box flexDirection="column" gap={1}>
      <TerminalImage
        src={currentPath}
        area={imageArea}
        backend={backend}
        mode={mode}
        scaleMode={scaleMode}
        onStateChange={handleImageStateChange}
        id="image-viewer"
      />

      <text>
        <span fg="#c0caf5"><strong>Image Viewer</strong></span>
        <span fg="#565f89">
          {imageState?.backend === "kitty"
            ? " (kitty placeholder rendering)"
            : " (half-block rendering)"}
        </span>
      </text>

      {IMAGE_FILES.length === 0 ? (
        <text>
          <span fg="#e0af68">No images found in `{DEMO_IMAGE_DIR_NAME}/`.</span>
        </text>
      ) : imageState?.loading ? (
        <text>
          <span fg="#e0af68">Loading image...</span>
        </text>
      ) : imageState?.error ? (
        <text>
          <span fg="#f7768e">Error: {imageState.error}</span>
        </text>
      ) : (
        <text>
          <span fg="#9ece6a">{infoText}</span>
        </text>
      )}

      {imageState?.note && (
        <text>
          <span fg="#e0af68">{imageState.note}</span>
        </text>
      )}

      {IMAGE_FILES.length > 0 && !imageState?.loading && !imageState?.error && (
        <text>
          <span fg="#565f89">[{imageIndex + 1}/{IMAGE_FILES.length}]</span>
        </text>
      )}
    </box>
  )
}
