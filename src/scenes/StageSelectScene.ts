// src/scenes/StageSelectScene.ts
import type { Scene, InputEvent } from '../engine/types'
import type { StageDef } from '../config/types'
import type { SaveData } from '../game/SaveDataService'

type SelectAction = 'play' | 'back'

export class StageSelectScene implements Scene {
  readonly name = 'stageSelect'
  private switchTo: (name: string) => void
  private onAction: ((action: SelectAction, stageIndex: number, levelIndex: number) => void) | null = null
  private stages: readonly StageDef[] = []
  private saveData: SaveData | null = null
  private canvasWidth = 0
  private canvasHeight = 0
  private cursorStage = 0
  private cursorLevel = 0

  constructor(switchTo: (name: string) => void) {
    this.switchTo = switchTo
  }

  setActionHandler(fn: (action: SelectAction, stageIndex: number, levelIndex: number) => void): void {
    this.onAction = fn
  }

  setData(stages: readonly StageDef[], saveData: SaveData): void {
    this.stages = stages
    this.saveData = saveData
    this.cursorStage = saveData.currentStageIndex
    this.cursorLevel = saveData.currentLevelIndex
  }

  enter(): void {
    this.canvasWidth = typeof window !== 'undefined' ? window.innerWidth : 800
    this.canvasHeight = typeof window !== 'undefined' ? window.innerHeight : 600
  }

  exit(): void {}
  update(_dt: number): void {}

  private isStageUnlocked(stageIndex: number): boolean {
    if (!this.saveData) return false
    if (stageIndex === 0) return true
    const prevStage = this.stages[stageIndex - 1]
    const prevLastLevelId = `${stageIndex - 1}-${prevStage.levels.length - 1}`
    return this.saveData.completedLevels.includes(prevLastLevelId)
  }

  private isLevelUnlocked(stageIndex: number, levelIndex: number): boolean {
    if (!this.saveData) return false
    if (stageIndex === 0 && levelIndex === 0) return true
    let prevId: string
    if (levelIndex > 0) {
      prevId = `${stageIndex}-${levelIndex - 1}`
    } else {
      const prevStage = this.stages[stageIndex - 1]
      prevId = `${stageIndex - 1}-${prevStage.levels.length - 1}`
    }
    return this.saveData.completedLevels.includes(prevId)
  }

  private isLevelCompleted(stageIndex: number, levelIndex: number): boolean {
    if (!this.saveData) return false
    return this.saveData.completedLevels.includes(`${stageIndex}-${levelIndex}`)
  }

  private getStars(stageIndex: number, levelIndex: number): number {
    if (!this.saveData) return 0
    return this.saveData.bestStars[`${stageIndex}-${levelIndex}`] ?? 0
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.saveData) return
    const w = this.canvasWidth
    const h = this.canvasHeight

    // Background
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, w, h)

    // Top bar
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 28px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('选择关卡', w / 2, 40)
    ctx.font = '16px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('[Esc] 返回', 20, 40)

    // Stage list
    let y = 80
    const stageHeight = 40
    const levelHeight = 30

    for (let si = 0; si < this.stages.length; si++) {
      const stage = this.stages[si]
      const unlocked = this.isStageUnlocked(si)

      // Stage title
      ctx.font = 'bold 22px sans-serif'
      ctx.textAlign = 'left'
      if (unlocked) {
        ctx.fillStyle = '#e94560'
        ctx.fillText(`\u25BC \u9636\u6BB5${si + 1}\uFF1A${stage.name}`, 40, y)
      } else {
        ctx.fillStyle = '#555555'
        ctx.fillText(`\uD83D\uDD12 \u9636\u6BB5${si + 1}\uFF1A${stage.name}`, 40, y)
      }
      y += stageHeight

      if (!unlocked) continue

      // Level list
      for (let li = 0; li < stage.levels.length; li++) {
        const levelUnlocked = this.isLevelUnlocked(si, li)
        if (!levelUnlocked) break

        const completed = this.isLevelCompleted(si, li)
        const isCursor = si === this.cursorStage && li === this.cursorLevel
        const stars = this.getStars(si, li)

        ctx.font = '18px sans-serif'
        ctx.textAlign = 'left'

        // Highlight cursor
        if (isCursor) {
          ctx.fillStyle = 'rgba(233, 69, 96, 0.2)'
          ctx.fillRect(60, y - 18, w - 120, levelHeight)
        }

        if (completed) {
          const starStr = '\u2605'.repeat(stars) + '\u2606'.repeat(3 - stars)
          ctx.fillStyle = '#ffd700'
          ctx.fillText(starStr, 80, y)
          ctx.fillStyle = '#ffffff'
          ctx.fillText(`\u5173\u5361 ${li + 1}`, 160, y)
        } else {
          ctx.fillStyle = '#aaaaaa'
          ctx.fillText('\u25CB', 80, y)
          ctx.fillStyle = '#ffffff'
          ctx.fillText(`\u5173\u5361 ${li + 1}`, 160, y)
        }

        y += levelHeight
      }

      y += 10
    }
  }

  handleInput(event: InputEvent): void {
    if (event.type !== 'keydown') return

    if (event.key === 'Escape') {
      this.onAction?.('back', 0, 0)
      return
    }

    if (event.key === 'Enter') {
      if (this.isLevelUnlocked(this.cursorStage, this.cursorLevel)) {
        this.onAction?.('play', this.cursorStage, this.cursorLevel)
      }
      return
    }

    if (event.key === 'ArrowUp') {
      this.moveCursor(-1)
    } else if (event.key === 'ArrowDown') {
      this.moveCursor(1)
    }
  }

  private moveCursor(direction: number): void {
    const entries: { stage: number; level: number }[] = []
    for (let si = 0; si < this.stages.length; si++) {
      if (!this.isStageUnlocked(si)) break
      for (let li = 0; li < this.stages[si].levels.length; li++) {
        if (!this.isLevelUnlocked(si, li)) break
        entries.push({ stage: si, level: li })
      }
    }

    const currentIdx = entries.findIndex(
      e => e.stage === this.cursorStage && e.level === this.cursorLevel
    )
    if (currentIdx < 0) return

    const newIdx = Math.max(0, Math.min(entries.length - 1, currentIdx + direction))
    this.cursorStage = entries[newIdx].stage
    this.cursorLevel = entries[newIdx].level
  }
}
