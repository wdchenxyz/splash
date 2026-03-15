import { KITTY_ROWCOL_DIACRITICS } from "./kitty-diacritics"

const KITTY_PLACEHOLDER = String.fromCodePoint(0x10eeee)
const MAX_24BIT_IMAGE_ID = 0xfffffe

let nextImageId = 0x1000

export type KittyOutputWriter = (data: string) => void

export interface KittySupport {
  supported: boolean
  reason: string
  transport: "direct" | "tmux"
  terminal: string
}

export interface KittyVirtualImage {
  id: number
  cols: number
  rows: number
  color: string
  placeholderText: string
}

function shellOut(args: string[]): string {
  const proc = Bun.spawnSync(args, {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  })
  if (proc.exitCode !== 0) {
    return ""
  }
  return proc.stdout.toString().trim()
}

function currentTerminalName(): string {
  if (process.env.TMUX) {
    const clientTerm = shellOut(["tmux", "display-message", "-p", "#{client_termname}"])
    if (clientTerm) {
      return clientTerm
    }
  }
  return process.env.TERM_PROGRAM || process.env.TERM || "unknown"
}

function tmuxAllowsPassthrough(): boolean {
  if (!process.env.TMUX) {
    return false
  }
  const value = shellOut(["tmux", "show-option", "-gv", "allow-passthrough"])
  return value === "all" || value === "on"
}

export function detectKittySupport(): KittySupport {
  const terminal = currentTerminalName().toLowerCase()
  const looksSupported = ["kitty", "ghostty", "wezterm", "konsole", "iterm"].some(
    (name) => terminal.includes(name),
  )

  if (!process.stdout.isTTY) {
    return {
      supported: false,
      reason: "stdout is not a tty",
      transport: process.env.TMUX ? "tmux" : "direct",
      terminal,
    }
  }

  if (!looksSupported) {
    return {
      supported: false,
      reason: `unsupported terminal '${terminal}'`,
      transport: process.env.TMUX ? "tmux" : "direct",
      terminal,
    }
  }

  if (process.env.TMUX && !tmuxAllowsPassthrough()) {
    return {
      supported: false,
      reason: "tmux allow-passthrough is disabled",
      transport: "tmux",
      terminal,
    }
  }

  return {
    supported: true,
    reason: "kitty graphics available",
    transport: process.env.TMUX ? "tmux" : "direct",
    terminal,
  }
}

function writeTerminalSequence(write: KittyOutputWriter, sequence: string): void {
  if (process.env.TMUX) {
    const escaped = sequence.replace(/\x1b/g, "\x1b\x1b")
    write(`\x1bPtmux;${escaped}\x1b\\`)
    return
  }
  write(sequence)
}

function writeGraphicsCommand(write: KittyOutputWriter, control: string, payload = ""): void {
  if (payload.length > 0) {
    writeTerminalSequence(write, `\x1b_G${control};${payload}\x1b\\`)
    return
  }
  writeTerminalSequence(write, `\x1b_G${control}\x1b\\`)
}

export function createRendererKittyWriter(renderer: {
  writeOut?: (chunk: string) => boolean
}): KittyOutputWriter {
  const writeOut = renderer.writeOut?.bind(renderer)
  if (writeOut) {
    return (data: string) => {
      writeOut(data)
    }
  }
  return (data: string) => {
    process.stdout.write(data)
  }
}

function imageIdToColor(id: number): string {
  const low24 = id & 0xffffff
  return `#${low24.toString(16).padStart(6, "0")}`
}

function allocImageId(): number {
  const id = nextImageId
  nextImageId += 1
  if (nextImageId > MAX_24BIT_IMAGE_ID) {
    nextImageId = 0x1000
  }
  return id
}

export function transmitImageFile(
  write: KittyOutputWriter,
  filePath: string,
  imageId?: number,
): number {
  const id = imageId ?? allocImageId()
  const payload = Buffer.from(filePath).toString("base64")
  writeGraphicsCommand(write, `a=t,f=100,t=f,i=${id},q=2`, payload)
  return id
}

export function createVirtualPlacement(
  write: KittyOutputWriter,
  id: number,
  cols: number,
  rows: number,
): void {
  writeGraphicsCommand(write, `a=p,U=1,i=${id},c=${cols},r=${rows},C=1,q=2`)
}

export function deleteImage(write: KittyOutputWriter, id: number): void {
  writeGraphicsCommand(write, `a=d,d=I,i=${id},q=2`)
}

export function deleteAllImages(write: KittyOutputWriter): void {
  writeGraphicsCommand(write, "a=d,d=A,q=2")
}

function diacriticFor(index: number): string {
  const value = KITTY_ROWCOL_DIACRITICS[index]
  if (!value) {
    throw new Error(`kitty placeholder index ${index} exceeds diacritic table`)
  }
  return value
}

export function buildPlaceholderText(cols: number, rows: number): string {
  if (cols < 1 || rows < 1) {
    return ""
  }

  if (cols > KITTY_ROWCOL_DIACRITICS.length || rows > KITTY_ROWCOL_DIACRITICS.length) {
    throw new Error(
      `kitty placeholders limited to ${KITTY_ROWCOL_DIACRITICS.length} cols/rows, got ${cols}x${rows}`,
    )
  }

  const lines: string[] = []
  for (let row = 0; row < rows; row += 1) {
    const rowMark = diacriticFor(row)
    let line = ""
    for (let col = 0; col < cols; col += 1) {
      const colMark = diacriticFor(col)
      line += `${KITTY_PLACEHOLDER}${rowMark}${colMark}`
    }
    lines.push(line)
  }
  return lines.join("\n")
}

export function createVirtualImage(
  write: KittyOutputWriter,
  filePath: string,
  cols: number,
  rows: number,
): KittyVirtualImage {
  const id = transmitImageFile(write, filePath)
  createVirtualPlacement(write, id, cols, rows)
  return {
    id,
    cols,
    rows,
    color: imageIdToColor(id),
    placeholderText: buildPlaceholderText(cols, rows),
  }
}
