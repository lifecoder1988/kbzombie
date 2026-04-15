import type { VfxObject } from '../VfxManager'

const DURATION = 0.6
const VX = 250        // px/s rightward
const VY = -180       // px/s upward
const ROTATION_SPEED = 8  // rad/s

export class DeathFlyout implements VfxObject {
  alive = true
  _poolType?: string

  private x = 0
  private y = 0
  private w = 0
  private h = 0
  private color = '#44cc44'
  private elapsed = 0
  private rotation = 0

  init(x: number, y: number, w: number, h: number, color: string): void {
    this.x = x
    this.y = y
    this.w = w
    this.h = h
    this.color = color
    this.elapsed = 0
    this.rotation = 0
    this.alive = true
  }

  reset(): void {
    this.elapsed = 0
    this.rotation = 0
    this.alive = true
  }

  update(dt: number): void {
    this.elapsed += dt
    if (this.elapsed >= DURATION) {
      this.alive = false
      return
    }
    this.x += VX * dt
    this.y += VY * dt
    this.rotation += ROTATION_SPEED * dt
  }

  render(ctx: CanvasRenderingContext2D): void {
    const alpha = 1 - this.elapsed / DURATION
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(this.x + this.w / 2, this.y + this.h / 2)
    ctx.rotate(this.rotation)
    ctx.fillStyle = this.color
    ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h)
    ctx.restore()
  }
}
