import type { Entity } from '../engine/types'
import { RenderLayer } from '../engine/types'
import type { PlantState } from './types'

const PLANT_TAGS: ReadonlySet<string> = new Set(['plant'])

const PLANT_COLORS = ['#22cc22', '#44aaff', '#ff8844', '#cc44cc', '#ffcc00']

export class PlantEntity implements Entity {
  readonly id: string
  x: number
  y: number
  width = 50
  height = 60
  active = true
  layer = RenderLayer.Entity
  tags = PLANT_TAGS

  private readonly plantIndex: number
  private plantState: PlantState | null = null
  currentLetter = ''
  highlighted = false

  constructor(id: string, x: number, y: number, plantIndex: number) {
    this.id = id
    this.x = x
    this.y = y
    this.plantIndex = plantIndex
  }

  syncState(state: PlantState): void {
    this.plantState = state
  }

  update(_dt: number): void {}

  render(ctx: CanvasRenderingContext2D): void {
    const alive = this.plantState?.alive ?? true
    const hpRatio = this.plantState
      ? this.plantState.currentHp / this.plantState.config.hp
      : 1

    const baseColor = PLANT_COLORS[this.plantIndex % PLANT_COLORS.length]
    ctx.globalAlpha = alive ? 1.0 : 0.3
    ctx.fillStyle = baseColor
    ctx.fillRect(this.x, this.y, this.width, this.height)

    if (this.highlighted && alive) {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 3
      ctx.strokeRect(this.x - 2, this.y - 2, this.width + 4, this.height + 4)
    }

    if (alive && hpRatio < 1) {
      const barWidth = this.width
      const barHeight = 4
      const barY = this.y + this.height + 4
      ctx.fillStyle = '#333'
      ctx.fillRect(this.x, barY, barWidth, barHeight)
      ctx.fillStyle = '#22cc22'
      ctx.fillRect(this.x, barY, barWidth * hpRatio, barHeight)
    }

    ctx.globalAlpha = 1.0

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 14px sans-serif'
    ctx.textAlign = 'center'
    const name = this.plantState?.config.name ?? ''
    ctx.fillText(name.charAt(0), this.x + this.width / 2, this.y + this.height / 2 + 5)

    if (this.currentLetter) {
      ctx.fillStyle = alive ? '#ffffff' : '#888888'
      ctx.font = 'bold 28px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(this.currentLetter.toUpperCase(), this.x + this.width / 2, this.y - 15)
    }
  }
}
