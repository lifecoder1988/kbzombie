import type { VfxObject } from '../VfxManager'

export class LetterPop implements VfxObject {
  alive = true
  _poolType?: string

  private x = 0
  private y = 0
  private letter = ''
  private color = '#ffd700'
  private baseSize = 20
  private duration = 0.3
  private maxScale = 2.0
  private elapsed = 0

  init(x: number, y: number, letter: string, color: string, baseSize: number, duration: number, maxScale: number): void {
    this.x = x
    this.y = y
    this.letter = letter
    this.color = color
    this.baseSize = baseSize
    this.duration = duration
    this.maxScale = maxScale
    this.elapsed = 0
    this.alive = true
  }

  reset(): void {
    this.elapsed = 0
    this.alive = true
  }

  update(dt: number): void {
    this.elapsed += dt
    if (this.elapsed >= this.duration) {
      this.alive = false
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const t = this.elapsed / this.duration
    const scale = 1 + (this.maxScale - 1) * t
    const alpha = 1 - t
    const fontSize = Math.round(this.baseSize * scale)

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = this.color
    ctx.font = `bold ${fontSize}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.letter, this.x, this.y)
    ctx.restore()
  }
}
