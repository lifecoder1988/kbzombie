import type { VfxObject } from '../VfxManager'

const DURATION = 1.5
const FLOAT_DISTANCE = 60

export class DamageNumber implements VfxObject {
  alive = true
  _poolType?: string

  private x = 0
  private startY = 0
  private value = 0
  private elapsed = 0

  init(x: number, y: number, value: number): void {
    // Random horizontal offset ±15px to avoid stacking
    this.x = x + (Math.random() - 0.5) * 30
    this.startY = y + (Math.random() - 0.5) * 10
    this.value = value
    this.elapsed = 0
    this.alive = true
  }

  reset(): void {
    this.elapsed = 0
    this.alive = true
  }

  update(dt: number): void {
    this.elapsed += dt
    if (this.elapsed >= DURATION) {
      this.alive = false
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const t = this.elapsed / DURATION
    const y = this.startY - FLOAT_DISTANCE * t
    const alpha = 1 - t * t

    ctx.save()
    ctx.globalAlpha = Math.max(0, alpha)
    ctx.font = 'bold 10px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.lineWidth = 2
    const text = String(Math.round(this.value))
    ctx.strokeText(text, this.x, y)
    ctx.fillStyle = '#ffd700'
    ctx.fillText(text, this.x, y)
    ctx.restore()
  }
}
