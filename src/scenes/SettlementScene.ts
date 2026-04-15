// src/scenes/SettlementScene.ts
import type { Scene, InputEvent } from '../engine/types'
import type { BattleStatsData } from '../game/BattleStats'

export interface SettlementSceneParams {
  result: 'victory' | 'defeat'
  stats: BattleStatsData
  stars: number               // 0 (defeat) or 1-3
  title: string               // title (victory) or encouragement (defeat)
  stageIndex: number
  levelIndex: number
}

type SettlementAction = 'continue' | 'replay' | 'select'

export class SettlementScene implements Scene {
  readonly name = 'settlement'
  private switchTo: (name: string) => void
  private onAction: ((action: SettlementAction, stageIndex: number, levelIndex: number) => void) | null = null
  private params: SettlementSceneParams | null = null
  private canvasWidth = 0
  private canvasHeight = 0

  constructor(switchTo: (name: string) => void) {
    this.switchTo = switchTo
  }

  setActionHandler(fn: (action: SettlementAction, stageIndex: number, levelIndex: number) => void): void {
    this.onAction = fn
  }

  setParams(params: SettlementSceneParams): void {
    this.params = params
  }

  getParams(): SettlementSceneParams | null {
    return this.params
  }

  enter(): void {
    this.canvasWidth = typeof window !== 'undefined' ? window.innerWidth : 800
    this.canvasHeight = typeof window !== 'undefined' ? window.innerHeight : 600
  }

  exit(): void {}
  update(_dt: number): void {}

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.params) return
    const { result, stats, stars, title } = this.params
    const w = this.canvasWidth
    const h = this.canvasHeight

    // Background
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, w, h)
    ctx.textAlign = 'center'

    // Title or encouragement
    ctx.fillStyle = result === 'victory' ? '#ffd700' : '#e94560'
    ctx.font = 'bold 40px sans-serif'
    ctx.fillText(title, w / 2, h * 0.18)

    // Stars (victory only)
    if (result === 'victory' && stars > 0) {
      ctx.font = '36px sans-serif'
      const starStr = '\u2605'.repeat(stars) + '\u2606'.repeat(3 - stars)
      ctx.fillStyle = '#ffd700'
      ctx.fillText(starStr, w / 2, h * 0.28)
    }

    // Stats list
    const dataStartY = h * 0.38
    const lineHeight = 36
    const labels = [
      { label: '击杀僵尸', value: stats.zombiesKilled },
      { label: '最长连击', value: stats.longestCombo },
      { label: '协同攻击', value: stats.synergyCount },
      { label: '放过僵尸', value: stats.missedCount },
    ]

    ctx.font = '22px sans-serif'
    for (let i = 0; i < labels.length; i++) {
      const y = dataStartY + i * lineHeight
      ctx.fillStyle = '#aaaaaa'
      ctx.textAlign = 'right'
      ctx.fillText(labels[i].label, w / 2 - 20, y)
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'left'
      ctx.fillText(String(labels[i].value), w / 2 + 20, y)
    }

    // Button hints
    const btnY = h * 0.72
    ctx.font = '20px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffffff'

    if (result === 'victory') {
      ctx.fillText('[Enter] 继续    [R] 重玩', w / 2, btnY)
    } else {
      ctx.fillText('[Enter] 重试    [Esc] 选关', w / 2, btnY)
    }
  }

  handleInput(event: InputEvent): void {
    if (event.type !== 'keydown' || !this.params) return

    const { result, stageIndex, levelIndex } = this.params

    if (result === 'victory') {
      if (event.key === 'Enter') {
        this.onAction?.('continue', stageIndex, levelIndex)
      } else if (event.key === 'r' || event.key === 'R') {
        this.onAction?.('replay', stageIndex, levelIndex)
      }
    } else {
      if (event.key === 'Enter') {
        this.onAction?.('replay', stageIndex, levelIndex)
      } else if (event.key === 'Escape') {
        this.onAction?.('select', stageIndex, levelIndex)
      }
    }
  }
}
