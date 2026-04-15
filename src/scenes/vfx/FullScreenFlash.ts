import type { VfxObject } from '../VfxManager'

export class FullScreenFlash implements VfxObject {
  alive = true
  _poolType?: string

  private color = '#ffd700'
  private startAlpha = 0.3
  private duration = 0.15
  private elapsed = 0

  init(color: string, startAlpha: number, duration: number): void {
    this.color = color
    this.startAlpha = startAlpha
    this.duration = duration
    this.elapsed = 0
    this.alive = true
  }

  reset(): void {
    this.elapsed = 0
    this.alive = true
  }

  update(dt: number): void {
    this.elapsed += dt
    if (this.elapsed >= this.duration) {
      this.alive = false
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const alpha = this.startAlpha * (1 - this.elapsed / this.duration)
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = this.color
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.restore()
  }
}
