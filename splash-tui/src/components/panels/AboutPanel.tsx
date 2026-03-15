export function AboutPanel() {
  return (
    <box flexDirection="column" gap={1}>
      <text>
        <span fg="#c0caf5">
          <strong>About Splash TUI</strong>
        </span>
      </text>

      <text>
        <span fg="#a9b1d6">
          A demonstration of OpenTUI's React reconciler for building
        </span>
        <br />
        <span fg="#a9b1d6">rich terminal user interfaces with familiar patterns.</span>
      </text>

      <box
        border
        borderStyle="rounded"
        borderColor="#3d59a1"
        flexDirection="column"
        padding={1}
        gap={1}
      >
        <text>
          <span fg="#bb9af7">
            <strong>Features Demonstrated</strong>
          </span>
        </text>
        <text>
          <span fg="#9ece6a"> * </span>
          <span fg="#c0caf5">ASCII art header with live clock</span>
        </text>
        <text>
          <span fg="#9ece6a"> * </span>
          <span fg="#c0caf5">Select-based sidebar navigation</span>
        </text>
        <text>
          <span fg="#9ece6a"> * </span>
          <span fg="#c0caf5">Flexbox layout (row, column, grow)</span>
        </text>
        <text>
          <span fg="#9ece6a"> * </span>
          <span fg="#c0caf5">Keyboard shortcuts (Tab, q, Escape)</span>
        </text>
        <text>
          <span fg="#9ece6a"> * </span>
          <span fg="#c0caf5">Styled text with colors and modifiers</span>
        </text>
        <text>
          <span fg="#9ece6a"> * </span>
          <span fg="#c0caf5">Reactive terminal dimensions</span>
        </text>
        <text>
          <span fg="#9ece6a"> * </span>
          <span fg="#c0caf5">Interval-based state updates</span>
        </text>
        <text>
          <span fg="#9ece6a"> * </span>
          <span fg="#c0caf5">Component composition patterns</span>
        </text>
        <text>
          <span fg="#9ece6a"> * </span>
          <span fg="#c0caf5">Reusable TerminalImage with Kitty + cell backends</span>
        </text>
        <text>
          <span fg="#9ece6a"> * </span>
          <span fg="#c0caf5">Multiple image layouts via the Showcase panel</span>
        </text>
      </box>

      <box
        border
        borderStyle="rounded"
        borderColor="#3d59a1"
        flexDirection="column"
        padding={1}
      >
        <text>
          <span fg="#bb9af7">
            <strong>Tech Stack</strong>
          </span>
        </text>
        <text>
          <span fg="#565f89">Framework  </span>
          <span fg="#7aa2f7">@opentui/react</span>
        </text>
        <text>
          <span fg="#565f89">Runtime    </span>
          <span fg="#7aa2f7">Bun</span>
        </text>
        <text>
          <span fg="#565f89">Language   </span>
          <span fg="#7aa2f7">TypeScript + JSX</span>
        </text>
        <text>
          <span fg="#565f89">Layout     </span>
          <span fg="#7aa2f7">Yoga (Flexbox)</span>
        </text>
      </box>

      <text>
        <span fg="#565f89">
          <a href="https://github.com/anomalyco/opentui">
            github.com/anomalyco/opentui
          </a>
        </span>
      </text>
    </box>
  )
}
