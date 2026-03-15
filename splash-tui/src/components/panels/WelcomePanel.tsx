import { useState, useEffect } from "react"
import { useTerminalDimensions } from "@opentui/react"

const tips = [
  "Use Tab to switch focus between sidebar and content",
  "Navigate the sidebar with j/k or arrow keys",
  "Press Enter to select a menu item",
  "Press q or Escape to quit the application",
  "OpenTUI uses Yoga for flexbox-based terminal layouts",
  "Try resizing your terminal window!",
]

export function WelcomePanel() {
  const { width, height } = useTerminalDimensions()
  const [tipIndex, setTipIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % tips.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  return (
    <box flexDirection="column" gap={1}>
      <box paddingBottom={1}>
        <text>
          <span fg="#c0caf5">
            <strong>Welcome to Splash TUI</strong>
          </span>
        </text>
      </box>

      <text>
        <span fg="#a9b1d6">
          A demo application built with OpenTUI React showcasing
        </span>
        <br />
        <span fg="#a9b1d6">terminal user interface components and patterns.</span>
      </text>

      <box
        border
        borderStyle="rounded"
        borderColor="#3d59a1"
        padding={1}
        marginTop={1}
      >
        <text>
          <span fg="#e0af68">Tip: </span>
          <span fg="#9ece6a">{tips[tipIndex]}</span>
        </text>
      </box>

      <box flexDirection="row" gap={4} marginTop={1}>
        <box flexDirection="column">
          <text>
            <span fg="#565f89">Terminal Size</span>
          </text>
          <text>
            <span fg="#7aa2f7">
              {width} x {height}
            </span>
          </text>
        </box>
        <box flexDirection="column">
          <text>
            <span fg="#565f89">Runtime</span>
          </text>
          <text>
            <span fg="#7aa2f7">Bun</span>
          </text>
        </box>
        <box flexDirection="column">
          <text>
            <span fg="#565f89">Framework</span>
          </text>
          <text>
            <span fg="#7aa2f7">React 19</span>
          </text>
        </box>
      </box>

      <box marginTop={1}>
        <text>
          <span fg="#565f89">
            Use the sidebar to explore different panels.
          </span>
        </text>
      </box>
    </box>
  )
}
