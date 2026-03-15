const palette = [
  { name: "Red", hex: "#f7768e" },
  { name: "Orange", hex: "#ff9e64" },
  { name: "Yellow", hex: "#e0af68" },
  { name: "Green", hex: "#9ece6a" },
  { name: "Teal", hex: "#73daca" },
  { name: "Cyan", hex: "#7dcfff" },
  { name: "Blue", hex: "#7aa2f7" },
  { name: "Purple", hex: "#bb9af7" },
]

const gradientChars = "  "

function ColorSwatch({ name, hex }: { name: string; hex: string }) {
  return (
    <box flexDirection="row" gap={1} alignItems="center">
      <box width={4} height={1} backgroundColor={hex}>
        <text>{gradientChars}</text>
      </box>
      <text>
        <span fg={hex}>
          <strong>{name.padEnd(8)}</strong>
        </span>
      </text>
      <text>
        <span fg="#565f89">{hex}</span>
      </text>
    </box>
  )
}

export function ColorsPanel() {
  return (
    <box flexDirection="column" gap={1}>
      <text>
        <span fg="#c0caf5">
          <strong>Color Palette</strong>
        </span>
      </text>

      <text>
        <span fg="#565f89">Tokyo Night inspired theme colors</span>
      </text>

      <box
        border
        borderStyle="rounded"
        borderColor="#3d59a1"
        flexDirection="column"
        padding={1}
        gap={1}
      >
        {palette.map((color) => (
          <ColorSwatch key={color.name} name={color.name} hex={color.hex} />
        ))}
      </box>

      <box
        border
        borderStyle="rounded"
        borderColor="#3d59a1"
        padding={1}
        marginTop={1}
      >
        <text>
          <span fg="#c0caf5">
            <strong>Text Styles: </strong>
          </span>
          <strong>Bold</strong>
          <span fg="#565f89"> | </span>
          <em>Italic</em>
          <span fg="#565f89"> | </span>
          <u>Underline</u>
          <span fg="#565f89"> | </span>
          <span fg="#f7768e">
            <strong>
              <em>Bold + Italic</em>
            </strong>
          </span>
        </text>
      </box>
    </box>
  )
}
