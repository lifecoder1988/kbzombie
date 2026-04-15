import type { Entity } from '../engine/types'
import { RenderLayer } from '../engine/types'
import type { PlantState } from './types'
import { drawPlant } from '../scenes/renderers/PlantRenderer'

const PLANT_TAGS: ReadonlySet<string> = new Set(['plant'])

const PLANT_COLORS = ['#22cc22', '#44aaff', '#ff8844', '#cc44cc', '#ffcc00']

export class PlantEntity implements Entity {
  readonly id: string
  x: number
  y: number
  width: number
  height = 60
  active = true
  layer = RenderLayer.Entity
  tags = PLANT_TAGS

  private readonly plantIndex: number
  private plantState: PlantState | null = null
  /** 本植物所有段的字母 */
  letters: string[] = []
  /** 已打过的段数（0 = 还没开始打这棵） */
  typedCount = 0
  /** 是否是当前连击目标植物 */
  isCurrentTarget = false
  bounceTimer = 0

  constructor(id: string, x: number, y: number, width: number, plantIndex: number) {
    this.id = id
    this.x = x
    this.y = y
    this.width = width
    this.plantIndex = plantIndex
  }

  syncState(state: PlantState): void {
    this.plantState = state
  }

  update(dt: number): void {
    if (this.bounceTimer > 0) {
      this.bounceTimer -= dt
      if (this.bounceTimer < 0) this.bounceTimer = 0
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const alive = this.plantState?.alive ?? true
    const hpRatio = this.plantState
      ? this.plantState.currentHp / this.plantState.config.hp
      : 1

    const bounceOffsetY = this.bounceTimer > 0
      ? -6 * Math.sin(this.bounceTimer / 0.15 * Math.PI)
      : 0

    // 植物简笔画 — 宽度由 Lane 按段数计算，直接使用
    const baseColor = PLANT_COLORS[this.plantIndex % PLANT_COLORS.length]
    drawPlant(ctx, this.x, this.y, this.width, this.height, baseColor, alive, bounceOffsetY)

    // 当前目标高亮边框
    if (this.isCurrentTarget && alive) {
      ctx.globalAlpha = 1.0
      ctx.strokeStyle = '#ffd700'
      ctx.lineWidth = 3
      ctx.strokeRect(this.x - 2, this.y + bounceOffsetY - 2, this.width + 4, this.height + 4)
    }

    // 血条（残血时显示）
    if (alive && hpRatio < 1) {
      ctx.globalAlpha = 1.0
      const barHeight = 4
      const barY = this.y + bounceOffsetY + this.height + 4
      ctx.fillStyle = '#333'
      ctx.fillRect(this.x, barY, this.width, barHeight)
      ctx.fillStyle = '#22cc22'
      ctx.fillRect(this.x, barY, this.width * hpRatio, barHeight)
    }

    ctx.globalAlpha = 1.0

    // 植物名称
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 12px sans-serif'
    ctx.textAlign = 'center'
    const name = this.plantState?.config.name ?? ''
    ctx.fillText(name, this.x + this.width / 2, this.y + bounceOffsetY + this.height / 2 + 5)

    // 字母序列显示在植物上方
    if (this.letters.length > 0) {
      const fontSize = Math.min(20, Math.max(14, Math.floor(this.width / this.letters.length * 0.8)))
      ctx.font = `bold ${fontSize}px monospace`
      ctx.textAlign = 'center'

      const totalLetterWidth = this.letters.length * (fontSize * 0.7)
      const startX = this.x + (this.width - totalLetterWidth) / 2 + fontSize * 0.35

      for (let i = 0; i < this.letters.length; i++) {
        const lx = startX + i * (fontSize * 0.7)
        const ly = this.y + bounceOffsetY - 10

        if (i < this.typedCount) {
          // 已打过：灰色小字
          ctx.fillStyle = alive ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'
        } else if (i === this.typedCount && this.isCurrentTarget) {
          // 当前要打的：金色高亮
          ctx.fillStyle = '#ffd700'
        } else {
          // 还没到的：白色
          ctx.fillStyle = alive ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)'
        }

        ctx.fillText(this.letters[i].toUpperCase(), lx, ly)
      }
    }
  }
}
