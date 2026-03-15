import type { Panel } from "../App"
import { WelcomePanel } from "./panels/WelcomePanel"
import { SystemPanel } from "./panels/SystemPanel"
import { ColorsPanel } from "./panels/ColorsPanel"
import { ImagePanel } from "./panels/ImagePanel"
import { ShowcasePanel } from "./panels/ShowcasePanel"
import { ChartPanel } from "./panels/ChartPanel"
import { AboutPanel } from "./panels/AboutPanel"

interface DashboardProps {
  activePanel: Panel
}

export function Dashboard({ activePanel }: DashboardProps) {
  return (
    <box
      flexGrow={1}
      border
      borderStyle="rounded"
      borderColor="#414868"
      backgroundColor="#1a1b26"
      padding={1}
    >
      {activePanel === "welcome" && <WelcomePanel />}
      {activePanel === "system" && <SystemPanel />}
      {activePanel === "colors" && <ColorsPanel />}
      {activePanel === "images" && <ImagePanel />}
      {activePanel === "showcase" && <ShowcasePanel />}
      {activePanel === "chart" && <ChartPanel />}
      {activePanel === "about" && <AboutPanel />}
    </box>
  )
}
