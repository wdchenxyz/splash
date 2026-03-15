import {
  RGBA,
  Renderable,
  type OptimizedBuffer,
  type RenderContext,
  type RenderableOptions,
} from "@opentui/core"
import { extend } from "@opentui/react"

declare module "@opentui/react" {
  interface OpenTUIComponents {
    plotCanvas: typeof SinePlotRenderable
  }
}

const BACKGROUND = RGBA.fromHex("#16161e")
const CURVE = RGBA.fromHex("#7dcfff")
const STATIC_CURVE = RGBA.fromHex("#bb9af7")
const GUIDE = RGBA.fromHex("#414868")
const MARKER = RGBA.fromHex("#9ece6a")
const TWO_PI = Math.PI * 2
const CYCLES = 2

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function addIntensity(
  intensities: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  value: number,
) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)

  if (ix < 0 || ix >= width || iy < 0 || iy >= height) {
    return
  }

  const index = iy * width + ix
  intensities[index] = Math.min(1, (intensities[index] ?? 0) + value)
}

function stamp(intensities: Float32Array, width: number, height: number, x: number, y: number, value: number) {
  const left = Math.floor(x)
  const top = Math.floor(y)
  const fx = x - left
  const fy = y - top

  addIntensity(intensities, width, height, left, top, value * (1 - fx) * (1 - fy))
  addIntensity(intensities, width, height, left + 1, top, value * fx * (1 - fy))
  addIntensity(intensities, width, height, left, top + 1, value * (1 - fx) * fy)
  addIntensity(intensities, width, height, left + 1, top + 1, value * fx * fy)
}

function drawSegment(
  intensities: Float32Array,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  value: number,
) {
  const dx = x1 - x0
  const dy = y1 - y0
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))))

  for (let step = 0; step <= steps; step++) {
    const t = step / steps
    const x = x0 + dx * t
    const y = y0 + dy * t

    stamp(intensities, width, height, x, y, value)
    stamp(intensities, width, height, x, y - 0.35, value * 0.35)
    stamp(intensities, width, height, x, y + 0.35, value * 0.35)
  }
}

function drawCellSegment(
  buffer: OptimizedBuffer,
  originX: number,
  originY: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: RGBA,
) {
  const dx = x1 - x0
  const dy = y1 - y0
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))))

  for (let step = 0; step <= steps; step++) {
    const t = step / steps
    const x = Math.round(x0 + dx * t)
    const y = Math.round(y0 + dy * t)

    buffer.setCell(originX + x, originY + y, "x", color, BACKGROUND)
  }
}

interface SinePlotOptions extends RenderableOptions<SinePlotRenderable> {
  phase?: number
}

class SinePlotRenderable extends Renderable {
  private _phase: number

  constructor(ctx: RenderContext, options: SinePlotOptions) {
    super(ctx, options)
    this._phase = options.phase ?? 0
  }

  set phase(value: number) {
    this._phase = value
    this.requestRender()
  }

  protected renderSelf(buffer: OptimizedBuffer): void {
    const width = this.width
    const height = this.height

    if (width < 2 || height < 2) {
      return
    }

    buffer.fillRect(this.x, this.y, width, height, BACKGROUND)

    const ssWidth = width * 2
    const ssHeight = height * 2
    const intensities = new Float32Array(ssWidth * ssHeight)
    const centerY = (ssHeight - 1) / 2
    const cellCenterY = (height - 1) / 2
    const amplitude = Math.max(1, (ssHeight - 1) * 0.42)
    const cellAmplitude = Math.max(1, (height - 1) * 0.42)

    let prevX = 0
    let prevY = centerY - Math.sin(this._phase) * amplitude

    for (let x = 1; x < ssWidth; x++) {
      const theta = (x / Math.max(1, ssWidth - 1)) * TWO_PI * CYCLES + this._phase
      const y = centerY - Math.sin(theta) * amplitude

      drawSegment(intensities, ssWidth, ssHeight, prevX, prevY, x, y, 0.95)
      prevX = x
      prevY = y
    }

    buffer.drawGrayscaleBufferSupersampled(
      this.x,
      this.y,
      intensities,
      ssWidth,
      ssHeight,
      CURVE,
      BACKGROUND,
    )

    const midY = this.y + Math.floor(height / 2)
    for (let x = 0; x < width; x += 3) {
      buffer.setCell(this.x + x, midY, ".", GUIDE, BACKGROUND)
    }

    let prevStaticX = 0
    let prevStaticY = clamp(Math.round(cellCenterY - Math.cos(0) * cellAmplitude), 0, height - 1)

    for (let x = 1; x < width; x++) {
      const theta = (x / Math.max(1, width - 1)) * TWO_PI * CYCLES
      const y = clamp(Math.round(cellCenterY - Math.cos(theta) * cellAmplitude), 0, height - 1)

      drawCellSegment(buffer, this.x, this.y, prevStaticX, prevStaticY, x, y, STATIC_CURVE)
      prevStaticX = x
      prevStaticY = y
    }

    const markerY = clamp(Math.round(prevY / 2), 0, height - 1)
    buffer.setCell(this.x + width - 1, this.y + markerY, "o", MARKER, BACKGROUND)
  }
}

extend({ plotCanvas: SinePlotRenderable })

interface SinePlotProps {
  phase: number
}

export function SinePlot({ phase }: SinePlotProps) {
  return <plotCanvas width="100%" height="100%" phase={phase} />
}
