import type { Panel } from "../App"

const menuOptions = [
  { name: "Welcome", description: "Home screen", value: "welcome" },
  { name: "System", description: "System information", value: "system" },
  { name: "Colors", description: "Color palette demo", value: "colors" },
  { name: "Images", description: "Image viewer demo", value: "images" },
  { name: "Showcase", description: "Reusable image demo", value: "showcase" },
  { name: "Chart", description: "Native sine plot demo", value: "chart" },
  { name: "About", description: "About this app", value: "about" },
]

interface SidebarProps {
  activePanel: Panel
  onSelect: (panel: Panel) => void
  focused: boolean
}

export function Sidebar({ activePanel, onSelect, focused }: SidebarProps) {
  const selectedIndex = menuOptions.findIndex(
    (opt) => opt.value === activePanel
  )

  return (
    <box
      width={28}
      flexDirection="column"
      border
      borderStyle="rounded"
      borderColor={focused ? "#7aa2f7" : "#414868"}
      backgroundColor="#1a1b26"
    >
      <box paddingX={1} paddingY={1}>
        <text>
          <span fg={focused ? "#7aa2f7" : "#565f89"}>
            <strong>Navigation</strong>
          </span>
        </text>
      </box>
      <select
        options={menuOptions}
        selectedIndex={selectedIndex}
        onSelect={(_index, option) => {
          if (option?.value) {
            onSelect(option.value as Panel)
          }
        }}
        onChange={(_index, option) => {
          if (option?.value) {
            onSelect(option.value as Panel)
          }
        }}
        focused={focused}
        height={10}
        selectedBackgroundColor="#292e42"
        selectedTextColor="#c0caf5"
      />
    </box>
  )
}
