import type { Scene, InputEvent } from '../engine/types'

export class MenuScene implements Scene {
  readonly name = 'menu'
  private switchTo: (name: string) => void

  constructor(switchTo: (name: string) => void) {
    this.switchTo = switchTo
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
    ctx.fillText('键盘侠大战僵尸', w / 2, h / 2 - 40)

    ctx.fillStyle = '#ffffff'
    ctx.font = '24px sans-serif'
    ctx.fillText('按空格开始', w / 2, h / 2 + 30)
  }

  handleInput(event: InputEvent): void {
    if (event.type === 'keydown' && event.key === ' ') {
      this.switchTo('battle')
    }
  }
}
