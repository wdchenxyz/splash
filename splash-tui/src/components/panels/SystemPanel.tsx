import { useTerminalDimensions } from "@opentui/react"
import { useState, useEffect } from "react"

interface InfoRowProps {
  label: string
  value: string
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <box flexDirection="row" gap={1}>
      <text>
        <span fg="#565f89">{label.padEnd(16)}</span>
      </text>
      <text>
        <span fg="#c0caf5">{value}</span>
      </text>
    </box>
  )
}

export function SystemPanel() {
  const { width, height } = useTerminalDimensions()
  const [uptime, setUptime] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setUptime((u) => u + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const formatUptime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}m ${s}s`
  }

  const memUsage = process.memoryUsage()
  const heapMB = (memUsage.heapUsed / 1024 / 1024).toFixed(1)
  const rssMB = (memUsage.rss / 1024 / 1024).toFixed(1)

  return (
    <box flexDirection="column" gap={1}>
      <text>
        <span fg="#c0caf5">
          <strong>System Information</strong>
        </span>
      </text>

      <box
        border
        borderStyle="rounded"
        borderColor="#3d59a1"
        flexDirection="column"
        padding={1}
      >
        <text>
          <span fg="#bb9af7">
            <strong>Environment</strong>
          </span>
        </text>
        <InfoRow label="Platform" value={process.platform} />
        <InfoRow label="Architecture" value={process.arch} />
        <InfoRow label="Bun Version" value={Bun.version} />
        <InfoRow label="PID" value={String(process.pid)} />
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
            <strong>Terminal</strong>
          </span>
        </text>
        <InfoRow label="Width" value={`${width} cols`} />
        <InfoRow label="Height" value={`${height} rows`} />
        <InfoRow label="Color Support" value="True Color (24-bit)" />
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
            <strong>Process</strong>
          </span>
        </text>
        <InfoRow label="Heap Used" value={`${heapMB} MB`} />
        <InfoRow label="RSS" value={`${rssMB} MB`} />
        <InfoRow label="Session Uptime" value={formatUptime(uptime)} />
      </box>
    </box>
  )
}
