import type { Entity } from '../engine/types'
import { RenderLayer } from '../engine/types'

const PROJECTILE_TAGS: ReadonlySet<string> = new Set(['projectile'])

export class ProjectileEntity implements Entity {
  readonly id: string
  x: number
  y: number
  width = 12
  height = 8
  active = true
  layer = RenderLayer.Effect
  tags = PROJECTILE_TAGS
  readonly power: number
  private readonly speed: number
  private readonly rightBound: number

  constructor(id: string, x: number, y: number, speed: number, power: number, rightBound: number) {
    this.id = id
    this.x = x
    this.y = y
    this.speed = speed
    this.power = power
    this.rightBound = rightBound
  }

  onHit(): void {
    this.active = false
  }

  update(dt: number): void {
    this.x += this.speed * (dt / 1000)
    if (this.x > this.rightBound) {
      this.active = false
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#ffd700'
    ctx.beginPath()
    ctx.ellipse(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, this.height / 2, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}
