import { useState, useEffect } from "react"

export function Header() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <box
      flexDirection="row"
      justifyContent="space-between"
      alignItems="center"
      paddingX={1}
      backgroundColor="#16161e"
      height={5}
    >
      <ascii-font text="Splash" font="tiny" color="#7aa2f7" />
      <box flexDirection="column" alignItems="flex-end">
        <text>
          <span fg="#bb9af7">{time.toLocaleTimeString()}</span>
        </text>
        <text>
          <span fg="#565f89">{time.toLocaleDateString()}</span>
        </text>
      </box>
    </box>
  )
}
