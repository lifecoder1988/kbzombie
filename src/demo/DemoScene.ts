// src/demo/DemoScene.ts
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
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    ctx.fillStyle = '#e94560'
    ctx.font = 'bold 48px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('键盘侠大战僵尸', ctx.canvas.width / 2, ctx.canvas.height / 2 - 40)

    ctx.fillStyle = '#ffffff'
    ctx.font = '24px sans-serif'
    ctx.fillText('按空格开始', ctx.canvas.width / 2, ctx.canvas.height / 2 + 30)
  }

  handleInput(event: InputEvent): void {
    if (event.type === 'keydown' && event.key === ' ') {
      this.switchTo('battle')
    }
  }
}

interface Block {
  x: number
  y: number
  speed: number
  active: boolean
  letter: string
}

export class BattleScene implements Scene {
  readonly name = 'battle'
  private switchTo: (name: string) => void
  private blocks: Block[] = []
  private spawnTimer = 0
  private spawnInterval = 2000
  private paused = false
  private canvasWidth = 0
  private canvasHeight = 0
  private readonly letters = 'fjdksla'

  constructor(switchTo: (name: string) => void) {
    this.switchTo = switchTo
  }

  enter(): void {
    this.blocks = []
    this.spawnTimer = 0
    this.paused = false
  }

  exit(): void {
    this.blocks = []
  }

  update(dt: number): void {
    if (this.paused) return

    this.spawnTimer += dt
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer -= this.spawnInterval
      this.spawnBlock()
    }

    for (let i = 0; i < this.blocks.length; i++) {
      const block = this.blocks[i]
      if (block.active) {
        block.x -= block.speed * (dt / 1000)
        if (block.x + 50 < 0) {
          block.active = false
          console.log('missed')
        }
      }
    }

    this.blocks = this.blocks.filter(b => b.active)
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.canvasWidth = ctx.canvas.width
    this.canvasHeight = ctx.canvas.height

    // Background
    ctx.fillStyle = '#0f3460'
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight)

    // Blocks
    for (const block of this.blocks) {
      if (!block.active) continue

      ctx.fillStyle = '#e94560'
      ctx.fillRect(block.x, block.y, 50, 60)

      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 28px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(block.letter, block.x + 25, block.y - 10)
    }

    // Pause overlay
    if (this.paused) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
      ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 36px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('已暂停 - 按 P 继续', this.canvasWidth / 2, this.canvasHeight / 2)
    }

    // HUD
    ctx.fillStyle = '#ffffff'
    ctx.font = '16px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('按字母击杀 | P 暂停 | ESC 返回菜单', 10, 25)
  }

  handleInput(event: InputEvent): void {
    if (event.type !== 'keydown') return

    if (event.key === 'Escape') {
      this.switchTo('menu')
      return
    }

    if (event.key === 'p' || event.key === 'P') {
      this.paused = !this.paused
      return
    }

    if (this.paused) return

    // Find the leftmost (closest to boundary) matching block
    const key = event.key.toLowerCase()
    let target: Block | null = null
    for (const block of this.blocks) {
      if (block.active && block.letter === key) {
        if (!target || block.x < target.x) {
          target = block
        }
      }
    }
    if (target) {
      target.active = false
    }
  }

  private spawnBlock(): void {
    const letter = this.letters[Math.floor(Math.random() * this.letters.length)]
    this.blocks.push({
      x: this.canvasWidth > 0 ? this.canvasWidth : 800,
      y: 100 + Math.random() * 300,
      speed: 80 + Math.random() * 40,
      active: true,
      letter,
    })
  }
}
