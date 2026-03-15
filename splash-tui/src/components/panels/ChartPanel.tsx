import { useEffect, useState } from "react"
import { SinePlot } from "../SinePlot"

const PHASE_STEP = 0.18
const TICK_MS = 90

export function ChartPanel() {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase((value) => (value + PHASE_STEP) % (Math.PI * 2))
    }, TICK_MS)

    return () => clearInterval(interval)
  }, [])

  return (
    <box flexDirection="column" gap={1} height="100%">
      <text>
        <span fg="#c0caf5">
          <strong>Native Chart</strong>
        </span>
        <span fg="#565f89"> (custom OpenTUI renderable)</span>
      </text>

      <text>
        <span fg="#a9b1d6">
          This panel overlays an animated sine wave with a static
        </span>
        <br />
        <span fg="#a9b1d6">
          <span fg="#bb9af7">cosine reference</span>
          <span fg="#a9b1d6"> using native buffer drawing.</span>
        </span>
      </text>

      <box flexDirection="row" gap={4} marginTop={1}>
        <box flexDirection="column">
          <text>
            <span fg="#565f89">Range X</span>
          </text>
          <text>
            <span fg="#7aa2f7">0 .. 4pi</span>
          </text>
        </box>
        <box flexDirection="column">
          <text>
            <span fg="#565f89">Range Y</span>
          </text>
          <text>
            <span fg="#7aa2f7">-1 .. 1</span>
          </text>
        </box>
        <box flexDirection="column">
          <text>
            <span fg="#565f89">Phase</span>
          </text>
          <text>
            <span fg="#9ece6a">{phase.toFixed(2)} rad</span>
          </text>
        </box>
        <box flexDirection="column">
          <text>
            <span fg="#565f89">Series</span>
          </text>
          <text>
            <span fg="#7dcfff">sine</span>
            <span fg="#565f89"> + </span>
            <span fg="#bb9af7">cosine</span>
          </text>
        </box>
      </box>

      <box
        flexGrow={1}
        minHeight={12}
        border
        borderStyle="rounded"
        borderColor="#3d59a1"
        backgroundColor="#16161e"
        padding={1}
      >
        <SinePlot phase={phase} />
      </box>

      <text>
        <span fg="#565f89">
          The cyan line animates while the purple reference stays fixed in the same chart.
        </span>
      </text>
    </box>
  )
}
