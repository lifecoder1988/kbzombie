// src/scenes/MenuScene.ts
import type { Scene, InputEvent } from '../engine/types'
import type { StageDef, DifficultyDef } from '../config/types'
import type { SaveData } from '../game/SaveDataService'

type MenuAction = 'continue' | 'select' | 'difficulty' | 'keyboard'

export class MenuScene implements Scene {
  readonly name = 'menu'
  private switchTo: (name: string) => void
  private onAction: ((action: MenuAction) => void) | null = null
  private stages: readonly StageDef[] = []
  private saveData: SaveData | null = null
  private difficulties: Readonly<Record<string, DifficultyDef>> = {}
  private difficultyOrder: readonly string[] = []
  private canvasWidth = 0
  private canvasHeight = 0

  constructor(switchTo: (name: string) => void) {
    this.switchTo = switchTo
  }

  setActionHandler(fn: (action: MenuAction) => void): void {
    this.onAction = fn
  }

  setData(
    stages: readonly StageDef[],
    saveData: SaveData,
    difficulties: Readonly<Record<string, DifficultyDef>>,
    difficultyOrder: readonly string[],
  ): void {
    this.stages = stages
    this.saveData = saveData
    this.difficulties = difficulties
    this.difficultyOrder = difficultyOrder
  }

  enter(): void {
    this.canvasWidth = typeof window !== 'undefined' ? window.innerWidth : 800
    this.canvasHeight = typeof window !== 'undefined' ? window.innerHeight : 600
  }

  exit(): void {}
  update(_dt: number): void {}

  render(ctx: CanvasRenderingContext2D): void {
    const w = this.canvasWidth
    const h = this.canvasHeight

    // Background
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, w, h)
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
  }

  private isAllCompleted(): boolean {
    if (!this.saveData) return false
    const si = this.saveData.currentStageIndex
    const li = this.saveData.currentLevelIndex
    const currentId = `${si}-${li}`
    return this.saveData.completedLevels.includes(currentId)
  }
}
