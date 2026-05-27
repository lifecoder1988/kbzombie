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
  rewards?: { unlockPlants?: readonly string[]; slotIncrease?: number }
  isFirstCompletion?: boolean
  plantNames?: Readonly<Record<string, string>>
}

type SettlementAction = 'continue' | 'replay' | 'select'

// Timeline constants
const FADE_IN_END = 0.3
const TITLE_START = 0.3
const TITLE_DUR = 0.3
const STATS_START = 0.7
const STAT_INTERVAL = 0.35
const STAT_DUR = 0.3
const STAR_INTERVAL = 0.2
const REWARD_DUR = 0.3
const BUTTON_DUR = 0.3

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t)
}

function bounceEase(t: number): number {
  if (t < 0.6) return t * t / 0.36
  if (t < 0.8) return 1 + 0.15 * Math.sin((t - 0.6) / 0.2 * Math.PI)
  return 1
}

export class SettlementScene implements Scene {
  readonly name = 'settlement'
  private onAction: ((action: SettlementAction, stageIndex: number, levelIndex: number) => void) | null = null
  private params: SettlementSceneParams | null = null
  private canvasWidth = 0
  private canvasHeight = 0
  private elapsed = 0
  private inputEnabled = false

  // Pre-computed timeline endpoints
  private starsStart = 0
  private rewardsStart = 0
  private buttonsStart = 0
  private totalRevealTime = 0

  constructor(_switchTo: (name: string) => void) {
    // switchTo stored for interface compatibility
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
    this.elapsed = 0
    this.inputEnabled = false

    // Compute timeline
    const statsEnd = STATS_START + 4 * STAT_INTERVAL + STAT_DUR
    this.starsStart = statsEnd + 0.3
    const starsEnd = this.starsStart + (this.params?.stars ?? 0) * STAR_INTERVAL
    this.rewardsStart = starsEnd + 0.3
    const hasRewards = this.params?.isFirstCompletion && this.params?.rewards &&
      ((this.params.rewards.unlockPlants?.length ?? 0) > 0 || (this.params.rewards.slotIncrease ?? 0) > 0)
    const rewardsEnd = hasRewards ? this.rewardsStart + REWARD_DUR : this.rewardsStart
    this.buttonsStart = rewardsEnd + 0.3
    this.totalRevealTime = this.buttonsStart + BUTTON_DUR
  }

  exit(): void {}

  update(dt: number): void {
    this.elapsed += Math.min(dt / 1000, 0.1)
    if (!this.inputEnabled && this.elapsed >= this.totalRevealTime) {
      this.inputEnabled = true
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.params) return
    const { result, stats, stars, title } = this.params
    const w = this.canvasWidth
    const h = this.canvasHeight
    const t = this.elapsed

    // Background
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, w, h)

    // Fade-in overlay
    if (t < FADE_IN_END) {
      ctx.fillStyle = `rgba(0, 0, 0, ${1 - t / FADE_IN_END})`
      ctx.fillRect(0, 0, w, h)
    }

    ctx.textAlign = 'center'

    // Title — scale from 2 to 1
    if (t >= TITLE_START) {
      const tp = Math.min(1, (t - TITLE_START) / TITLE_DUR)
      const scale = 2 - easeOut(tp)
      const alpha = easeOut(tp)
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(w / 2, h * 0.18)
      ctx.scale(scale, scale)
      ctx.fillStyle = result === 'victory' ? '#ffd700' : '#e94560'
      ctx.font = 'bold 40px sans-serif'
      ctx.fillText(title, 0, 0)
      ctx.restore()
    }

    // Stats — number counting up
    const dataStartY = h * 0.38
    const lineHeight = 36
    const labels = [
      { label: '击杀僵尸', value: stats.zombiesKilled },
      { label: '最长连击', value: stats.longestCombo },
      { label: '协同攻击', value: stats.synergyCount },
      { label: '放过僵尸', value: stats.missedCount },
    ]

    for (let i = 0; i < labels.length; i++) {
      const statStart = STATS_START + i * STAT_INTERVAL
      if (t < statStart) break

      const sp = Math.min(1, (t - statStart) / STAT_DUR)
      const displayValue = Math.floor(labels[i].value * easeOut(sp))
      const alpha = Math.min(1, (t - statStart) / 0.15)
      const y = dataStartY + i * lineHeight

      ctx.globalAlpha = alpha
      ctx.font = '22px sans-serif'
      ctx.fillStyle = '#aaaaaa'
      ctx.textAlign = 'right'
      ctx.fillText(labels[i].label, w / 2 - 20, y)
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'left'
      ctx.fillText(String(displayValue), w / 2 + 20, y)
    }

    ctx.globalAlpha = 1

    // Stars — drop in one by one with bounce
    if (result === 'victory' && stars > 0 && t >= this.starsStart) {
      ctx.font = '36px sans-serif'
      ctx.textAlign = 'center'

      const starWidth = 36

      for (let i = 0; i < 3; i++) {
        const starStart = this.starsStart + i * STAR_INTERVAL
        if (t < starStart) break

        const sp = Math.min(1, (t - starStart) / 0.2)
        const bEase = bounceEase(sp)
        const starY = h * 0.28 - 30 * (1 - bEase)
        const starX = w / 2 - (3 * starWidth / 2) + starWidth * i + starWidth / 2

        ctx.globalAlpha = Math.min(1, sp * 2)
        ctx.fillStyle = i < stars ? '#ffd700' : '#555555'
        ctx.fillText(i < stars ? '\u2605' : '\u2606', starX, starY)
      }
    }

    ctx.globalAlpha = 1

    // Rewards
    let rewardsEndY = dataStartY + labels.length * lineHeight
    if (result === 'victory' && this.params.isFirstCompletion && this.params.rewards && t >= this.rewardsStart) {
      const rp = Math.min(1, (t - this.rewardsStart) / REWARD_DUR)
      ctx.globalAlpha = easeOut(rp)

      const rewards = this.params.rewards
      rewardsEndY += 20

      ctx.fillStyle = '#ffd700'
      ctx.font = 'bold 20px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('— 通关奖励 —', w / 2, rewardsEndY)
      rewardsEndY += 30

      ctx.font = '20px sans-serif'
      if (rewards.unlockPlants && rewards.unlockPlants.length > 0) {
        for (const plantId of rewards.unlockPlants) {
          const name = this.params.plantNames?.[plantId] ?? plantId
          ctx.fillStyle = '#69DB7C'
          ctx.fillText(`解锁植物：${name}`, w / 2, rewardsEndY)
          rewardsEndY += 28
        }
      }
      if (rewards.slotIncrease) {
        ctx.fillStyle = '#4DABF7'
        ctx.fillText(`阵地扩展 +${rewards.slotIncrease}`, w / 2, rewardsEndY)
        rewardsEndY += 28
      }
    }

    ctx.globalAlpha = 1

    // Button hints — fade in
    if (t >= this.buttonsStart) {
      const bp = Math.min(1, (t - this.buttonsStart) / BUTTON_DUR)
      ctx.globalAlpha = easeOut(bp)

      const btnY = Math.max(rewardsEndY + 30, h * 0.72)
      ctx.font = '20px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = '#ffffff'

      if (result === 'victory') {
        ctx.fillText('[Enter] 继续    [R] 重玩', w / 2, btnY)
      } else {
        ctx.fillText('[Enter] 重试    [Esc] 选关', w / 2, btnY)
      }
    }

    ctx.globalAlpha = 1
  }

  handleInput(event: InputEvent): void {
    if (event.type !== 'keydown' || !this.params) return

    // Any key during reveal skips to fully revealed state
    if (!this.inputEnabled) {
      this.elapsed = this.totalRevealTime
      this.inputEnabled = true
      return
    }

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
