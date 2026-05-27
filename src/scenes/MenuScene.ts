// src/scenes/MenuScene.ts
import type { Scene, InputEvent } from '../engine/types'
import type { StageDef, DifficultyDef } from '../config/types'
import type { SaveData } from '../game/SaveDataService'
import type { ZombieStatus } from '../game/types'
import { ZombieState } from '../game/types'
import { drawBattlefield } from './renderers/BattlefieldRenderer'
import { drawZombie } from './renderers/ZombieRenderer'
import { drawPlant } from './renderers/PlantRenderer'

type MenuAction = 'continue' | 'select' | 'difficulty' | 'keyboard' | 'reset'

export class MenuScene implements Scene {
  readonly name = 'menu'
  private onAction: ((action: MenuAction) => void) | null = null
  private stages: readonly StageDef[] = []
  private saveData: SaveData | null = null
  private difficulties: Readonly<Record<string, DifficultyDef>> = {}
  private canvasWidth = 0
  private canvasHeight = 0
  private resetConfirm = false
  private fadeAlpha = 1
  private elapsed = 0
  private scrollX = 0
  private silhouettes = [
    { x: 900, y: 280, speed: 15, type: 'normal', walkPhase: 0 },
    { x: 1100, y: 180, speed: 12, type: 'roadblock', walkPhase: 1.5 },
    { x: 1300, y: 350, speed: 18, type: 'imp', walkPhase: 3.0 },
  ]
  private plantIdlePhase = 0
  private readonly emptyStatuses: readonly ZombieStatus[] = []

  constructor(_switchTo: (name: string) => void) {
    // switchTo stored for interface compatibility
  }

  setActionHandler(fn: (action: MenuAction) => void): void {
    this.onAction = fn
  }

  setData(
    stages: readonly StageDef[],
    saveData: SaveData,
    difficulties: Readonly<Record<string, DifficultyDef>>,
    _difficultyOrder: readonly string[],
  ): void {
    this.stages = stages
    this.saveData = saveData
    this.difficulties = difficulties
  }

  enter(): void {
    this.canvasWidth = typeof window !== 'undefined' ? window.innerWidth : 800
    this.canvasHeight = typeof window !== 'undefined' ? window.innerHeight : 600
    this.fadeAlpha = 1
    this.elapsed = 0
  }

  exit(): void {}
  update(dt: number): void {
    const safeDt = Math.min(dt / 1000, 0.1)
    this.elapsed += safeDt
    if (this.fadeAlpha > 0) {
      this.fadeAlpha = Math.max(0, this.fadeAlpha - safeDt / 0.3)
    }

    // Scroll grass
    this.scrollX += safeDt * 10

    // Move silhouettes
    for (let i = 0; i < this.silhouettes.length; i++) {
      const s = this.silhouettes[i]
      s.x -= s.speed * safeDt
      s.walkPhase += safeDt * 3
      if (s.x < -80) {
        s.x = this.canvasWidth + 60 + Math.random() * 200
      }
    }

    // Plant sway
    this.plantIdlePhase += safeDt * 1.5
  }

  render(ctx: CanvasRenderingContext2D): void {
    const w = this.canvasWidth
    const h = this.canvasHeight

    // Animated background
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, w, h)

    // Scrolling grass (looping tiles)
    ctx.save()
    ctx.globalAlpha = 0.3
    const tileW = 800
    const offsetX = -(this.scrollX % tileW)
    for (let tx = offsetX; tx < w + tileW; tx += tileW) {
      ctx.save()
      ctx.translate(tx, 0)
      drawBattlefield(ctx, tileW, h, tileW * 0.35)
      ctx.restore()
    }
    ctx.restore()

    // Zombie silhouettes
    ctx.save()
    ctx.globalAlpha = 0.15
    for (let i = 0; i < this.silhouettes.length; i++) {
      const s = this.silhouettes[i]
      drawZombie(ctx, s.x, s.y, 40, 60, s.type, '#666666', {
        flashTimer: 0,
        walkPhase: s.walkPhase,
        state: ZombieState.Walking,
        statuses: this.emptyStatuses,
        statusCount: 0,
      })
    }
    ctx.restore()

    // Decorative plants — bottom left, swaying
    ctx.save()
    ctx.globalAlpha = 0.4
    const sway1 = Math.sin(this.plantIdlePhase) * 3
    const sway2 = Math.sin(this.plantIdlePhase + 1.5) * 3
    drawPlant(ctx, 40, h - 100, 50, 60, '#22cc22', true, sway1, 'peashooter')
    drawPlant(ctx, 120, h - 90, 45, 55, '#44aaff', true, sway2, 'snowpea')
    ctx.restore()

    ctx.textAlign = 'center'

    // Title
    ctx.fillStyle = '#e94560'
    ctx.font = 'bold 48px sans-serif'
    ctx.fillText('键盘侠大战僵尸', w / 2, h * 0.22)

    // Progress info
    if (this.saveData && this.stages.length > 0) {
      const si = this.saveData.currentStageIndex
      const li = this.saveData.currentLevelIndex
      const allCompleted = this.isAllCompleted()

      if (allCompleted) {
        ctx.fillStyle = '#ffd700'
        ctx.font = '20px sans-serif'
        ctx.fillText('全部通关！', w / 2, h * 0.34)
      } else if (si < this.stages.length) {
        const stage = this.stages[si]
        ctx.fillStyle = '#aaaaaa'
        ctx.font = '20px sans-serif'
        ctx.fillText(`当前进度：${stage.name}`, w / 2, h * 0.34)
        ctx.fillText(`关卡 ${li + 1} / ${stage.levels.length}`, w / 2, h * 0.40)
      }

      // Continue button
      ctx.fillStyle = '#e94560'
      ctx.font = 'bold 28px sans-serif'
      const continueText = allCompleted ? '[Enter] 自由练习' : '[Enter] 继续'
      ctx.fillText(continueText, w / 2, h * 0.54)

      // Select level button
      ctx.fillStyle = '#ffffff'
      ctx.font = '22px sans-serif'
      ctx.fillText('[S] 选关', w / 2, h * 0.64)

      // Difficulty button
      const diffKey = this.saveData.difficulty
      const diffDef = this.difficulties[diffKey]
      const diffName = diffDef?.displayName ?? diffKey
      ctx.fillText(`[D] 难度：${diffName}`, w / 2, h * 0.72)

      // Keyboard toggle
      ctx.fillText(`[K] 键盘提示：${this.saveData.keyboardVisible ? '开启' : '关闭'}`, w / 2, h * 0.80)

      // Reset
      if (this.resetConfirm) {
        ctx.fillStyle = '#e94560'
        ctx.fillText('[R] 确认重置？再按一次 R 清除所有存档', w / 2, h * 0.88)
      } else {
        ctx.fillStyle = '#555555'
        ctx.fillText('[R] 重置存档', w / 2, h * 0.88)
      }
    }

    // Fade-in
    if (this.fadeAlpha > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${this.fadeAlpha})`
      ctx.fillRect(0, 0, w, h)
    }
  }

  handleInput(event: InputEvent): void {
    if (event.type !== 'keydown') return

    if (event.key === 'Enter') {
      this.onAction?.('continue')
      return
    }

    if (event.key === 's' || event.key === 'S') {
      this.onAction?.('select')
      return
    }

    if (event.key === 'd' || event.key === 'D') {
      this.onAction?.('difficulty')
      return
    }

    if (event.key === 'k' || event.key === 'K') {
      this.onAction?.('keyboard')
      return
    }

    if (event.key === 'r' || event.key === 'R') {
      if (this.resetConfirm) {
        this.resetConfirm = false
        this.onAction?.('reset')
      } else {
        this.resetConfirm = true
      }
      return
    }

    // Any other key cancels reset confirmation
    this.resetConfirm = false
  }

  private isAllCompleted(): boolean {
    if (!this.saveData) return false
    const si = this.saveData.currentStageIndex
    const li = this.saveData.currentLevelIndex
    const currentId = `${si}-${li}`
    return this.saveData.completedLevels.includes(currentId)
  }
}
