// src/scenes/PlantSelectScene.ts
import type { Scene, InputEvent } from '../engine/types'
import type { PlantDef } from '../config/types'

type PlantSelectAction = 'start' | 'back'

export class PlantSelectScene implements Scene {
  readonly name = 'plantSelect'
  private switchTo: (name: string) => void
  private onAction: ((action: PlantSelectAction, lanePlants: readonly (readonly string[])[]) => void) | null = null

  private canvasWidth = 0
  private canvasHeight = 0
  private laneCount = 1
  private slotSize = 4
  private unlockedPlants: PlantDef[] = []
  private currentLane = 0
  private laneSelections: string[][] = []
  private stageIndex = 0
  private levelIndex = 0

  constructor(switchTo: (name: string) => void) {
    this.switchTo = switchTo
  }

  setActionHandler(fn: (action: PlantSelectAction, lanePlants: readonly (readonly string[])[]) => void): void {
    this.onAction = fn
  }

  setData(
    stageIndex: number,
    levelIndex: number,
    laneCount: number,
    slotSize: number,
    unlockedPlants: PlantDef[],
    defaultPlants: readonly string[],
  ): void {
    this.stageIndex = stageIndex
    this.levelIndex = levelIndex
    this.laneCount = laneCount
    this.slotSize = slotSize
    this.unlockedPlants = unlockedPlants
    this.currentLane = 0

    // Pre-fill lanes with defaults (filtered to unlocked only)
    const unlockedIds = new Set(unlockedPlants.map(p => p.id))
    const plantMap = Object.fromEntries(unlockedPlants.map(p => [p.id, p]))
    this.laneSelections = []
    for (let i = 0; i < laneCount; i++) {
      const lane: string[] = []
      let used = 0
      for (const id of defaultPlants) {
        if (!unlockedIds.has(id)) continue
        const seg = plantMap[id]?.comboSegment ?? 0
        if (used + seg <= slotSize) {
          lane.push(id)
          used += seg
        }
      }
      this.laneSelections.push(lane)
    }
  }

  private getLaneUsed(laneIdx: number): number {
    const plantMap = Object.fromEntries(this.unlockedPlants.map(p => [p.id, p]))
    return this.laneSelections[laneIdx].reduce((sum, id) => sum + (plantMap[id]?.comboSegment ?? 0), 0)
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

    // 1. Background
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, w, h)

    // 2. Title
    ctx.fillStyle = '#ffd700'
    ctx.font = 'bold 28px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('选择植物阵容', w / 2, 44)

    // 3. Subtitle
    ctx.fillStyle = '#aaaaaa'
    ctx.font = '16px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`阶段 ${this.stageIndex + 1} · 关卡 ${this.levelIndex + 1}  |  每路最多 ${this.slotSize} 段`, w / 2, 72)

    // 4. Lane slots
    const laneAreaTop = 96
    const laneRowHeight = 80
    const plantMap = Object.fromEntries(this.unlockedPlants.map(p => [p.id, p]))

    for (let i = 0; i < this.laneCount; i++) {
      const rowY = laneAreaTop + i * laneRowHeight
      const isCurrent = i === this.currentLane
      const used = this.getLaneUsed(i)
      const isOver = used > this.slotSize

      // Lane border highlight
      if (isCurrent) {
        ctx.strokeStyle = '#ffd700'
        ctx.lineWidth = 2
        ctx.strokeRect(20, rowY - 4, w - 40, laneRowHeight - 8)
      }

      // Lane label
      ctx.font = 'bold 16px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillStyle = isCurrent ? '#ffd700' : '#888888'
      ctx.fillText(`第${i + 1}路`, 30, rowY + 18)

      // Slot usage
      ctx.font = '13px sans-serif'
      ctx.fillStyle = isOver ? '#ff4444' : '#44cc44'
      ctx.fillText(`${used}/${this.slotSize}`, 30, rowY + 38)

      // Plant boxes
      let boxX = 110
      const boxY = rowY + 4
      const boxH = laneRowHeight - 16
      for (const id of this.laneSelections[i]) {
        const plant = plantMap[id]
        if (!plant) continue
        const boxW = Math.max(60, plant.name.length * 14 + 20)

        ctx.fillStyle = isCurrent ? '#2a3a5e' : '#1e2a42'
        ctx.fillRect(boxX, boxY, boxW, boxH)
        ctx.strokeStyle = isCurrent ? '#ffd700' : '#445577'
        ctx.lineWidth = 1
        ctx.strokeRect(boxX, boxY, boxW, boxH)

        ctx.fillStyle = '#ffffff'
        ctx.font = '13px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(plant.name, boxX + boxW / 2, boxY + 22)

        ctx.fillStyle = '#aaaaaa'
        ctx.font = '11px sans-serif'
        ctx.fillText(`${plant.comboSegment}段`, boxX + boxW / 2, boxY + 40)

        boxX += boxW + 6
      }
    }

    // 5. Divider line
    const dividerY = laneAreaTop + this.laneCount * laneRowHeight + 8
    ctx.strokeStyle = '#444444'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(20, dividerY)
    ctx.lineTo(w - 20, dividerY)
    ctx.stroke()

    // 6. Available plants grid
    const gridTop = dividerY + 20
    ctx.font = 'bold 14px sans-serif'
    ctx.fillStyle = '#aaaaaa'
    ctx.textAlign = 'left'
    ctx.fillText('可用植物：', 30, gridTop)

    const cols = Math.floor((w - 60) / 220)
    const colW = Math.floor((w - 60) / Math.max(cols, 1))

    for (let pi = 0; pi < this.unlockedPlants.length; pi++) {
      const plant = this.unlockedPlants[pi]
      const col = pi % cols
      const row = Math.floor(pi / cols)
      const px = 30 + col * colW
      const py = gridTop + 22 + row * 24

      ctx.font = '14px sans-serif'
      ctx.fillStyle = '#dddddd'
      ctx.textAlign = 'left'
      ctx.fillText(`[${pi + 1}] ${plant.name} (${plant.comboSegment}段)`, px, py)
    }

    // 7. Help text
    ctx.fillStyle = '#888888'
    ctx.font = '13px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('↑↓切换路线 | 数字键添加植物 | Backspace删除 | Enter开始战斗 | Esc返回', w / 2, h - 16)
  }

  handleInput(event: InputEvent): void {
    if (event.type !== 'keydown') return

    if (event.key === 'Escape') {
      this.onAction?.('back', this.laneSelections)
      return
    }

    if (event.key === 'Enter') {
      const hasPlants = this.laneSelections.some(lane => lane.length > 0)
      if (hasPlants) {
        this.onAction?.('start', this.laneSelections)
      }
      return
    }

    if (event.key === 'ArrowUp') {
      this.currentLane = Math.max(0, this.currentLane - 1)
      return
    }

    if (event.key === 'ArrowDown') {
      this.currentLane = Math.min(this.laneCount - 1, this.currentLane + 1)
      return
    }

    if (event.key === 'Backspace') {
      this.laneSelections[this.currentLane].pop()
      return
    }

    // Number keys 1-9
    const digit = parseInt(event.key, 10)
    if (!isNaN(digit) && digit >= 1 && digit <= 9) {
      const plantIdx = digit - 1
      const plant = this.unlockedPlants[plantIdx]
      if (!plant) return
      const used = this.getLaneUsed(this.currentLane)
      if (used + plant.comboSegment <= this.slotSize) {
        this.laneSelections[this.currentLane].push(plant.id)
      }
    }
  }
}
