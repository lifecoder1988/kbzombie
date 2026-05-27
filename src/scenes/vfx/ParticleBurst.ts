import type { VfxObject } from '../VfxManager'

const MAX_PARTICLES = 30
const TWO_PI = Math.PI * 2

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  size: number
}

export class ParticleBurst implements VfxObject {
  alive = true
  _poolType?: string

  private count = 0
  private color = '#ffd700'
  private duration = 0.5
  private elapsed = 0

  // Pre-allocated particle array (avoid per-spawn allocation)
  private readonly particles: Particle[] = Array.from({ length: MAX_PARTICLES }, () => ({
    x: 0, y: 0, vx: 0, vy: 0, alpha: 1, size: 3,
  }))

  init(x: number, y: number, count: number, color: string, duration: number): void {
    this.count = Math.min(count, MAX_PARTICLES)
    this.color = color
    this.duration = duration
    this.elapsed = 0

    if (this.count === 0) {
      this.alive = false
      return
    }

    this.alive = true

    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i]
      const angle = Math.random() * TWO_PI
      const speed = 100 + Math.random() * 200
      p.x = x
      p.y = y
      p.vx = Math.cos(angle) * speed
      p.vy = Math.sin(angle) * speed
      p.alpha = 1
      p.size = 3 + Math.random() * 3
    }
  }

  reset(): void {
    this.elapsed = 0
    this.alive = true
  }

  update(dt: number): void {
    this.elapsed += dt
    if (this.elapsed >= this.duration) {
      this.alive = false
      return
    }

    const alpha = 1 - this.elapsed / this.duration
    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i]
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.alpha = alpha
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.color
    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i]
      ctx.globalAlpha = p.alpha
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, TWO_PI)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
}
