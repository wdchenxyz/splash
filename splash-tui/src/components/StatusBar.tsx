interface StatusBarProps {
  sidebarFocused: boolean
}

export function StatusBar({ sidebarFocused }: StatusBarProps) {
  return (
    <box
      flexDirection="row"
      justifyContent="space-between"
      paddingX={1}
      backgroundColor="#16161e"
      height={1}
    >
      <text>
        <span fg="#565f89">
          <strong>Tab</strong>
        </span>
        <span fg="#414868"> switch focus </span>
        <span fg="#565f89">
          <strong>j/k</strong>
        </span>
        <span fg="#414868"> navigate </span>
        <span fg="#565f89">
          <strong>Enter</strong>
        </span>
        <span fg="#414868"> select </span>
        <span fg="#565f89">
          <strong>q</strong>
        </span>
        <span fg="#414868"> quit</span>
      </text>
      <text>
        <span fg="#414868">focus: </span>
        <span fg={sidebarFocused ? "#7aa2f7" : "#565f89"}>
          {sidebarFocused ? "sidebar" : "content"}
        </span>
      </text>
    </box>
  )
}
