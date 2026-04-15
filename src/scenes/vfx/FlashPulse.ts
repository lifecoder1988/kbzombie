import type { VfxObject } from '../VfxManager'

export class FlashPulse implements VfxObject {
  alive = true
  _poolType?: string

  private x = 0
  private y = 0
  private startRadius = 20
  private endRadius = 80
  private startAlpha = 0.4
  private color = '#ffffff'
  private duration = 0.3
  private elapsed = 0

  init(
    x: number,
    y: number,
    startRadius: number,
    endRadius: number,
    startAlpha: number,
    color: string,
    duration: number,
  ): void {
    this.x = x
    this.y = y
    this.startRadius = startRadius
    this.endRadius = endRadius
    this.startAlpha = startAlpha
    this.color = color
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
    const t = this.duration > 0 ? Math.min(this.elapsed / this.duration, 1) : 1
    const radius = this.startRadius + (this.endRadius - this.startRadius) * t
    const alpha = this.startAlpha * (1 - t)

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = this.color
    ctx.beginPath()
    ctx.arc(this.x, this.y, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}
