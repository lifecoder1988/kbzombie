import type { VfxObject } from '../VfxManager'

const FLY_IN = 0.3
const HOLD = 0.6
const SCALE_OUT = 0.3
const TOTAL = FLY_IN + HOLD + SCALE_OUT

export class WaveAnnounce implements VfxObject {
  alive = true
  _poolType?: string

  private text = ''
  private centerX = 0
  private centerY = 0
  private elapsed = 0

  init(waveIndex: number, totalWaves: number, centerX: number, centerY: number): void {
    this.text = `Wave ${waveIndex + 1} / ${totalWaves}`
    this.centerX = centerX
    this.centerY = centerY
    this.elapsed = 0
    this.alive = true
  }

  reset(): void {
    this.elapsed = 0
    this.alive = true
  }

  update(dt: number): void {
    this.elapsed += dt
    if (this.elapsed >= TOTAL) {
      this.alive = false
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const t = this.elapsed
    let x: number
    let scale: number
    let alpha: number

    if (t < FLY_IN) {
      const p = t / FLY_IN
      const ease = 1 - (1 - p) * (1 - p)
      x = this.centerX + 600 * (1 - ease)
      scale = 1
      alpha = ease
    } else if (t < FLY_IN + HOLD) {
      x = this.centerX
      scale = 1
      alpha = 1
    } else {
      const p = (t - FLY_IN - HOLD) / SCALE_OUT
      x = this.centerX
      scale = 1 + p * 0.5
      alpha = 1 - p
    }

    ctx.save()
    ctx.globalAlpha = Math.max(0, alpha)
    ctx.translate(x, this.centerY)
    ctx.scale(scale, scale)
    ctx.font = 'bold 48px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)'
    ctx.lineWidth = 4
    ctx.strokeText(this.text, 0, 0)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(this.text, 0, 0)
    ctx.restore()
  }
}
