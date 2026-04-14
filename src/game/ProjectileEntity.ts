import type { Entity } from '../engine/types'
import { RenderLayer } from '../engine/types'
import type { Element, Spread, Flight, Impact } from './types'

const PROJECTILE_TAGS: ReadonlySet<string> = new Set(['projectile'])

const ELEMENT_COLORS: Record<Element, string> = {
  normal: '#ffd700',
  ice: '#87ceeb',
  fire: '#ff6347',
  electric: '#9b59b6',
  stun: '#f1c40f',
  knockback: '#e67e22',
}

export interface ProjectileConfig {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly speed: number
  readonly power: number
  readonly rightBound: number
  readonly element: Element
  readonly spread: Spread
  readonly flight: Flight
  readonly impact: Impact
  readonly angle?: number
  readonly target?: { x: number; y: number; active?: boolean }
  readonly maxTurnRate?: number
  readonly chainBounces?: number
  readonly chainRange?: number
}

// Vertical bounds for non-horizontal projectiles (pixels from spawn)
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
  readonly spread: Spread
  readonly flight: Flight
  readonly impact: Impact
  readonly chainRange: number

  private readonly speed: number
  private readonly rightBound: number
  private readonly spawnY: number

  // Hit tracking (used by pierce and chain)
  private readonly hitSet: Set<string>

  // Current heading for movement
  private heading: number

  // Tracking: target reference
  private readonly target: { x: number; y: number; active?: boolean } | null
  private readonly maxTurnRate: number

  // Chain: bounce state
  private _bounceCount = 0
  private readonly maxBounces: number
  private _needsRedirect = false

  constructor(config: ProjectileConfig) {
    this.id = config.id
    this.x = config.x
    this.y = config.y
    this.spawnY = config.y
    this.speed = config.speed
    this.power = config.power
    this.rightBound = config.rightBound
    this.element = config.element
    this.spread = config.spread
    this.flight = config.flight
    this.impact = config.impact
    this.chainRange = config.chainRange ?? 0
    this.maxBounces = config.chainBounces ?? 0
    this.hitSet = new Set()
    this.target = config.target ?? null
    this.maxTurnRate = config.maxTurnRate ?? Math.PI

    // Set initial heading
    if (config.flight === 'tracking' && config.target) {
      this.heading = Math.atan2(
        config.target.y - config.y,
        config.target.x - config.x,
      )
    } else {
      this.heading = config.angle ?? 0
    }
  }

  get bounceCount(): number {
    return this._bounceCount
  }

  get needsRedirect(): boolean {
    return this._needsRedirect
  }

  hasHit(zombieId: string): boolean {
    return this.hitSet.has(zombieId)
  }

  onHit(zombieId: string): void {
    switch (this.impact) {
      case 'vanish':
        this.active = false
        break

      case 'pierce':
        this.hitSet.add(zombieId)
        break

      case 'chain':
        this.hitSet.add(zombieId)
        this._bounceCount++
        if (this._bounceCount >= this.maxBounces) {
          this.active = false
        } else {
          this._needsRedirect = true
        }
        break

      case 'explode':
        this.active = false
        break
    }
  }

  redirectTo(targetX: number, targetY: number): void {
    this.heading = Math.atan2(targetY - this.y, targetX - this.x)
    this._needsRedirect = false
  }

  clearRedirect(): void {
    this._needsRedirect = false
  }

  update(dt: number): void {
    const dtSec = dt / 1000

    switch (this.flight) {
      case 'straight':
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
    if (Math.abs(this.y - this.spawnY) > Y_BOUND) {
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
