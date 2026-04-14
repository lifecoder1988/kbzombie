import type { Scene, InputEvent } from '../engine/types'
import { STAGES } from '../config'

export class MenuScene implements Scene {
  readonly name = 'menu'
  private switchTo: (name: string) => void
  private onSelectStage: ((stageIndex: number) => void) | null = null

  constructor(switchTo: (name: string) => void) {
    this.switchTo = switchTo
  }

  setStageSelector(fn: (stageIndex: number) => void): void {
    this.onSelectStage = fn
  }

  enter(): void {}
  exit(): void {}
  update(_dt: number): void {}

  render(ctx: CanvasRenderingContext2D): void {
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1
    const w = ctx.canvas.width / dpr
    const h = ctx.canvas.height / dpr

    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, w, h)

    ctx.fillStyle = '#e94560'
    ctx.font = 'bold 48px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('键盘侠大战僵尸', w / 2, h / 2 - 80)

    ctx.fillStyle = '#ffffff'
    ctx.font = '20px sans-serif'
    for (let i = 0; i < STAGES.length; i++) {
      ctx.fillText(`[${i + 1}] ${STAGES[i].name}`, w / 2, h / 2 - 20 + i * 35)
    }
  }

  handleInput(event: InputEvent): void {
    if (event.type !== 'keydown') return
    const num = parseInt(event.key, 10)
    if (num >= 1 && num <= STAGES.length) {
      if (this.onSelectStage) this.onSelectStage(num - 1)
      this.switchTo('battle')
    }
  }
}
