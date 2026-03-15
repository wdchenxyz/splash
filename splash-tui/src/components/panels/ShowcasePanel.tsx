import { useCallback, useMemo, useState } from "react"
import { useKeyboard, useTerminalDimensions } from "@opentui/react"
import {
  TerminalImage,
  type TerminalImageArea,
  type TerminalImageBackend,
  type TerminalImageState,
} from "../TerminalImage"
import {
  DEMO_IMAGE_DIR_NAME,
  DEMO_IMAGE_FILES,
  getDemoImagePath,
} from "../../lib/demo-images"

const CONTENT_LEFT = 31
const CONTENT_TOP = 12

function computeShowcaseAreas(width: number, height: number): {
  heroArea: TerminalImageArea
  previewArea: TerminalImageArea
  layout: "split" | "stack"
} {
  const availableCols = Math.max(20, width - CONTENT_LEFT - 2)
  const availableRows = Math.max(10, height - CONTENT_TOP - 2)

  if (availableCols >= 84) {
    const heroCols = Math.max(32, Math.floor(availableCols * 0.62))
    const previewCols = Math.max(18, availableCols - heroCols - 2)
    const previewRows = Math.max(10, Math.min(availableRows, Math.floor(availableRows * 0.58)))
    return {
      heroArea: {
        left: CONTENT_LEFT,
        top: CONTENT_TOP,
        cols: heroCols,
        rows: availableRows,
      },
      previewArea: {
        left: CONTENT_LEFT + heroCols + 2,
        top: CONTENT_TOP + Math.max(0, Math.floor((availableRows - previewRows) / 2)),
        cols: previewCols,
        rows: previewRows,
      },
      layout: "split",
    }
  }

  const heroRows = Math.max(12, Math.floor(availableRows * 0.62))
  const previewRows = Math.max(8, availableRows - heroRows - 1)
  const previewCols = Math.max(18, Math.min(availableCols, Math.floor(availableCols * 0.62)))

  return {
    heroArea: {
      left: CONTENT_LEFT,
      top: CONTENT_TOP,
      cols: availableCols,
      rows: heroRows,
    },
    previewArea: {
      left: CONTENT_LEFT + Math.max(0, Math.floor((availableCols - previewCols) / 2)),
      top: CONTENT_TOP + heroRows + 1,
      cols: previewCols,
      rows: previewRows,
    },
    layout: "stack",
  }
}

function formatShowcaseInfo(
  heroState: TerminalImageState | null,
  previewState: TerminalImageState | null,
) {
  if (!heroState?.image) {
    return ""
  }

  const heroBackend = heroState.backend ?? "loading"
  const previewName = previewState?.image?.name ?? "preview"
  const previewBackend = previewState?.backend ?? "loading"

  return `${heroState.image.name} [${heroBackend}]  ${previewName} [${previewBackend}]  h/l cycle${heroState.support.supported ? "  b featured backend" : ""}`
}

export function ShowcasePanel() {
  const { width, height } = useTerminalDimensions()
  const [imageIndex, setImageIndex] = useState(0)
  const [featuredBackend, setFeaturedBackend] = useState<TerminalImageBackend>("auto")
  const [heroState, setHeroState] = useState<TerminalImageState | null>(null)
  const [previewState, setPreviewState] = useState<TerminalImageState | null>(null)

  const currentFile = DEMO_IMAGE_FILES[imageIndex] ?? null
  const previewFile = DEMO_IMAGE_FILES.length > 1
    ? DEMO_IMAGE_FILES[(imageIndex + 1) % DEMO_IMAGE_FILES.length] ?? null
    : currentFile

  const heroPath = currentFile ? getDemoImagePath(currentFile) : null
  const previewPath = previewFile ? getDemoImagePath(previewFile) : null

  const layout = useMemo(() => computeShowcaseAreas(width, height), [height, width])

  const handleHeroStateChange = useCallback((state: TerminalImageState) => {
    setHeroState(state)
  }, [])

  const handlePreviewStateChange = useCallback((state: TerminalImageState) => {
    setPreviewState(state)
  }, [])

  useKeyboard((key) => {
    if (DEMO_IMAGE_FILES.length === 0) {
      return
    }

    if (key.name === "right" || key.name === "l") {
      setImageIndex((i) => (i + 1) % DEMO_IMAGE_FILES.length)
      return
    }

    if (key.name === "left" || key.name === "h") {
      setImageIndex((i) => (i - 1 + DEMO_IMAGE_FILES.length) % DEMO_IMAGE_FILES.length)
      return
    }

    if (key.name === "b" && heroState?.support.supported) {
      const activeBackend = heroState.backend ?? (featuredBackend === "cell" ? "cell" : "kitty")
      setFeaturedBackend(activeBackend === "kitty" ? "cell" : "kitty")
    }
  })

  return (
    <box flexDirection="column" gap={1}>
      <TerminalImage
        id="showcase-hero"
        src={heroPath}
        area={layout.heroArea}
        backend={featuredBackend}
        mode="color"
        scaleMode="fit"
        onStateChange={handleHeroStateChange}
      />

      <TerminalImage
        id="showcase-preview"
        src={previewPath}
        area={layout.previewArea}
        backend="cell"
        mode="grayscale"
        scaleMode="fit"
        onStateChange={handlePreviewStateChange}
      />

      <text>
        <span fg="#c0caf5"><strong>Showcase</strong></span>
        <span fg="#565f89"> (reusable TerminalImage demo)</span>
      </text>

      {DEMO_IMAGE_FILES.length === 0 ? (
        <text>
          <span fg="#e0af68">No images found in `{DEMO_IMAGE_DIR_NAME}/`.</span>
        </text>
      ) : (
        <>
          <text>
            <span fg="#565f89">
              Same renderer, two placements: featured uses auto backend, preview uses cell grayscale.
            </span>
          </text>
          <text>
            <span fg="#9ece6a">{formatShowcaseInfo(heroState, previewState)}</span>
          </text>
          {(heroState?.note || previewState?.note) && (
            <text>
              <span fg="#e0af68">{heroState?.note ?? previewState?.note}</span>
            </text>
          )}
          <text>
            <span fg="#565f89">layout: {layout.layout}  [{imageIndex + 1}/{DEMO_IMAGE_FILES.length}]</span>
          </text>
        </>
      )}
    </box>
  )
}
