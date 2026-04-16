import type { Entity } from '../engine/types'
import { RenderLayer } from '../engine/types'
import { ZombieState } from './types'
import type { ZombieStatus } from './types'
import { drawZombie } from '../scenes/renderers/ZombieRenderer'

const ZOMBIE_TAGS: ReadonlySet<string> = new Set(['zombie'])
const MAX_STATUSES = 8

export interface ZombieSpawnParams {
  id: string
  x: number
  y: number
  hp: number
  speed: number
  chewDps: number
  width?: number
  height?: number
  color?: string
  type?: string
}

export class ZombieEntity implements Entity {
  readonly id: string
  x: number
  y: number
  width: number
  height: number
  active = true
  layer = RenderLayer.Entity
  tags = ZOMBIE_TAGS

  flashTimer = 0
  walkPhase = 0
  private readonly _type: string
  private _state = ZombieState.Walking
  private readonly speed: number
  private readonly chewDps: number
  private readonly _maxHp: number
  private _currentHp: number
  private chewTargetX = -Infinity
  private readonly color: string

  // Pre-allocated status array to avoid GC pressure
  private readonly _statuses: ZombieStatus[] = new Array(MAX_STATUSES).fill(null).map(() => ({
    type: 'slow' as const,
    remaining: 0,
    value: 0,
  }))
  private _statusCount = 0

  constructor(params: ZombieSpawnParams) {
    this.id = params.id
    this.x = params.x
    this.y = params.y
    this._maxHp = params.hp
    this._currentHp = params.hp
    this.speed = params.speed
    this.chewDps = params.chewDps
    this.width = params.width ?? 40
    this.height = params.height ?? 60
    this.color = params.color ?? '#44cc44'
    this._type = params.type ?? 'normal'
  }

  get state(): ZombieState { return this._state }
  get currentHp(): number { return this._currentHp }
  get maxHp(): number { return this._maxHp }
  get zombieColor(): string { return this.color }
  get zombieType(): string { return this._type }
  get statuses(): readonly ZombieStatus[] { return this._statuses }
  get statusCount(): number { return this._statusCount }

  applyStatus(status: ZombieStatus): void {
    // Same type → refresh remaining and value
    for (let i = 0; i < this._statusCount; i++) {
      if (this._statuses[i].type === status.type) {
        this._statuses[i].remaining = status.remaining
        this._statuses[i].value = status.value
        return
      }
    }
    // Different type → add to list (if space available)
    if (this._statusCount < MAX_STATUSES) {
      this._statuses[this._statusCount].type = status.type
      this._statuses[this._statusCount].remaining = status.remaining
      this._statuses[this._statusCount].value = status.value
      this._statusCount++
    }
  }

  applyKnockback(distance: number, rightBound: number): void {
    this.x = Math.min(this.x + distance, rightBound)
  }

  hasStatus(type: string): boolean {
    for (let i = 0; i < this._statusCount; i++) {
      if (this._statuses[i].type === type) return true
    }
    return false
  }

  setChewTarget(targetX: number): void {
    this.chewTargetX = targetX
    // 如果新目标在当前位置左边，需要继续走过去
    if (this._state === ZombieState.Chewing && targetX < this.x) {
      this._state = ZombieState.Walking
    }
  }

  clearChewTarget(): void {
    this.chewTargetX = -Infinity
    if (this._state === ZombieState.Chewing) {
      this._state = ZombieState.Walking
    }
  }

  takeDamage(damage: number): void {
    this._currentHp = Math.max(0, this._currentHp - damage)
    if (this._currentHp <= 0) {
      this._state = ZombieState.Dead
      this.active = false
    }
  }

  getChewDamage(dt: number): number {
    if (this._state !== ZombieState.Chewing) return 0
    // Stun stops chewing
    for (let i = 0; i < this._statusCount; i++) {
      if (this._statuses[i].type === 'stun') return 0
    }
    let dps = this.chewDps
    // Slow reduces chew DPS
    for (let i = 0; i < this._statusCount; i++) {
      if (this._statuses[i].type === 'slow') {
        dps *= (1 - this._statuses[i].value)
        break
      }
    }
    return dps * (dt / 1000)
  }

  update(dt: number): void {
    if (this._state === ZombieState.Dead) return

    const dtSeconds = dt / 1000

    if (this.flashTimer > 0) {
      this.flashTimer -= dtSeconds
      if (this.flashTimer < 0) this.flashTimer = 0
    }

    this.walkPhase += dtSeconds * 6

    // 1. Process status timers and apply burn damage (burn damages even stunned zombies)
    let i = 0
    while (i < this._statusCount) {
      const s = this._statuses[i]
      if (s.type === 'burn') {
        this.takeDamage(s.value * dtSeconds)
        if (!this.active) return // zombie died from burn
      }
      s.remaining -= dtSeconds
      if (s.remaining <= 0) {
        // Remove by swapping with last
        this._statusCount--
        if (i < this._statusCount) {
          this._statuses[i].type = this._statuses[this._statusCount].type
          this._statuses[i].remaining = this._statuses[this._statusCount].remaining
          this._statuses[i].value = this._statuses[this._statusCount].value
        }
        // Don't increment i — recheck the swapped element
      } else {
        i++
      }
    }

    // 2. Check stun: skip movement and chewing
    for (let j = 0; j < this._statusCount; j++) {
      if (this._statuses[j].type === 'stun') return
    }

    // 3. Determine effective speed (slow reduces it)
    let effectiveSpeed = this.speed
    for (let j = 0; j < this._statusCount; j++) {
      if (this._statuses[j].type === 'slow') {
        effectiveSpeed *= (1 - this._statuses[j].value)
        break
      }
    }

    if (this._state === ZombieState.Walking) {
      this.x -= effectiveSpeed * dtSeconds
      if (this.x <= this.chewTargetX) {
        this.x = this.chewTargetX
        this._state = ZombieState.Chewing
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    drawZombie(ctx, this.x, this.y, this.width, this.height,
      this._type, this.color, {
        flashTimer: this.flashTimer,
        walkPhase: this.walkPhase,
        state: this._state,
        statuses: this._statuses,
        statusCount: this._statusCount,
      })
    // HP bar
    const barWidth = this.width
    const barHeight = 4
    const barY = this.y - 8
    const hpRatio = this._currentHp / this._maxHp
    ctx.fillStyle = '#333'
    ctx.fillRect(this.x, barY, barWidth, barHeight)
    ctx.fillStyle = '#ff3333'
    ctx.fillRect(this.x, barY, barWidth * hpRatio, barHeight)
  }
}
