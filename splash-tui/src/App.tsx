import { useState } from "react"
import { useKeyboard, useRenderer } from "@opentui/react"
import { Header } from "./components/Header"
import { Sidebar } from "./components/Sidebar"
import { Dashboard } from "./components/Dashboard"
import { StatusBar } from "./components/StatusBar"

export type Panel = "welcome" | "system" | "colors" | "images" | "showcase" | "chart" | "about"

export function App() {
  const renderer = useRenderer()
  const [activePanel, setActivePanel] = useState<Panel>("welcome")
  const [sidebarFocused, setSidebarFocused] = useState(true)

  useKeyboard((key) => {
    if (key.name === "q" || key.name === "escape") {
      renderer.destroy()
      return
    }
    if (key.name === "tab") {
      setSidebarFocused((f) => !f)
    }
  })

  return (
    <box flexDirection="column" width="100%" height="100%">
      <Header />

      <box flexDirection="row" flexGrow={1}>
        <Sidebar
          activePanel={activePanel}
          onSelect={setActivePanel}
          focused={sidebarFocused}
        />
        <Dashboard activePanel={activePanel} />
      </box>

      <StatusBar sidebarFocused={sidebarFocused} />
    </box>
  )
}
