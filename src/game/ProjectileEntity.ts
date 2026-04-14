import type { Entity } from '../engine/types'
import { RenderLayer } from '../engine/types'
import type { Element, Trajectory } from './types'

const PROJECTILE_TAGS: ReadonlySet<string> = new Set(['projectile'])

const ELEMENT_COLORS: Record<Element, string> = {
  normal: '#ffd700',
  ice: '#87ceeb',
  fire: '#ff6347',
}

export interface ProjectileConfig {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly speed: number
  readonly power: number
  readonly rightBound: number
  readonly trajectory: Trajectory
  readonly element: Element
  readonly angle?: number
  readonly target?: { x: number; y: number; active?: boolean }
  readonly maxTurnRate?: number
}

// Vertical bounds for area projectiles (pixels from spawn)
const Y_BOUND = 800

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
  readonly element: Element
  readonly trajectory: Trajectory

  private readonly speed: number
  private readonly rightBound: number
  private readonly spawnY: number

  // Pierce: hit tracking
  private readonly hitSet: Set<string> | null

  // Area: flight angle (also used as current heading for tracking)
  private heading: number

  // Tracking: target reference
  private readonly target: { x: number; y: number; active?: boolean } | null
  private readonly maxTurnRate: number

  constructor(config: ProjectileConfig) {
    this.id = config.id
    this.x = config.x
    this.y = config.y
    this.spawnY = config.y
    this.speed = config.speed
    this.power = config.power
    this.rightBound = config.rightBound
    this.trajectory = config.trajectory
    this.element = config.element
    this.target = config.target ?? null
    this.maxTurnRate = config.maxTurnRate ?? Math.PI

    // Pierce trajectory tracks hit zombies
    this.hitSet = config.trajectory === 'pierce' ? new Set() : null

    // Set initial heading
    if (config.trajectory === 'tracking' && config.target) {
      this.heading = Math.atan2(
        config.target.y - config.y,
        config.target.x - config.x,
      )
    } else if (config.trajectory === 'area') {
      this.heading = config.angle ?? 0
    } else {
      this.heading = 0
    }
  }

  hasHit(zombieId: string): boolean {
    return this.hitSet !== null && this.hitSet.has(zombieId)
  }

  onHit(zombieId: string): void {
    if (this.trajectory === 'pierce' && this.hitSet) {
      this.hitSet.add(zombieId)
    } else {
      this.active = false
    }
  }

  update(dt: number): void {
    const dtSec = dt / 1000

    switch (this.trajectory) {
      case 'direct':
        this.x += this.speed * dtSec
        break

      case 'pierce':
        this.x += this.speed * dtSec
        break

      case 'area':
        this.x += this.speed * Math.cos(this.heading) * dtSec
        this.y += this.speed * Math.sin(this.heading) * dtSec
        break

      case 'tracking':
        this.updateTracking(dtSec)
        break
    }

    // Bounds check
    if (this.x > this.rightBound) {
      this.active = false
    }
    if (this.trajectory === 'area' && Math.abs(this.y - this.spawnY) > Y_BOUND) {
      this.active = false
    }
  }

  private updateTracking(dtSec: number): void {
    // Adjust heading toward target if target is alive
    if (this.target && this.target.active !== false) {
      const desired = Math.atan2(
        this.target.y - this.y,
        this.target.x - this.x,
      )
      let diff = desired - this.heading
      // Normalize to [-PI, PI]
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      const maxTurn = this.maxTurnRate * dtSec
      if (Math.abs(diff) <= maxTurn) {
        this.heading = desired
      } else {
        this.heading += Math.sign(diff) * maxTurn
      }
    }
    // Move along heading
    this.x += this.speed * Math.cos(this.heading) * dtSec
    this.y += this.speed * Math.sin(this.heading) * dtSec
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = ELEMENT_COLORS[this.element]
    ctx.beginPath()
    ctx.ellipse(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, this.height / 2, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}
