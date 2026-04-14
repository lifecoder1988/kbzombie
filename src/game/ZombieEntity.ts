import type { Entity } from '../engine/types'
import { RenderLayer } from '../engine/types'
import { ZombieState } from './types'

const ZOMBIE_TAGS: ReadonlySet<string> = new Set(['zombie'])

export class ZombieEntity implements Entity {
  readonly id: string
  x: number
  y: number
  width = 40
  height = 60
  active = true
  layer = RenderLayer.Entity
  tags = ZOMBIE_TAGS

  private _state = ZombieState.Walking
  private readonly speed: number
  private readonly chewDps: number
  private readonly maxHp: number
  private _currentHp: number
  private chewTargetX = -Infinity

  constructor(id: string, x: number, y: number, hp: number, speed: number, chewDps: number) {
    this.id = id
    this.x = x
    this.y = y
    this.maxHp = hp
    this._currentHp = hp
    this.speed = speed
    this.chewDps = chewDps
  }

  get state(): ZombieState { return this._state }
  get currentHp(): number { return this._currentHp }

  setChewTarget(targetX: number): void {
    this.chewTargetX = targetX
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
    return this.chewDps * (dt / 1000)
  }

  update(dt: number): void {
    if (this._state === ZombieState.Dead) return
    if (this._state === ZombieState.Walking) {
      this.x -= this.speed * (dt / 1000)
      if (this.x <= this.chewTargetX) {
        this.x = this.chewTargetX
        this._state = ZombieState.Chewing
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this._state === ZombieState.Chewing ? '#ff6600' : '#44cc44'
    ctx.fillRect(this.x, this.y, this.width, this.height)
    const barWidth = this.width
    const barHeight = 4
    const barY = this.y - 8
    const hpRatio = this._currentHp / this.maxHp
    ctx.fillStyle = '#333'
    ctx.fillRect(this.x, barY, barWidth, barHeight)
    ctx.fillStyle = '#ff3333'
    ctx.fillRect(this.x, barY, barWidth * hpRatio, barHeight)
  }
}
