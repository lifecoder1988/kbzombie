// src/engine/Renderer.ts
import type { RenderLayer } from './types'

export interface RenderCommand {
  layer: RenderLayer
  execute(ctx: CanvasRenderingContext2D): void
}

export class Renderer {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private width = 0
  private height = 0
  private commands: RenderCommand[] = []

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.resize()
  }

  getContext(): CanvasRenderingContext2D | null {
    return this.ctx
  }

  getWidth(): number {
    return this.width
  }

  getHeight(): number {
    return this.height
  }

  resize(width?: number, height?: number): void {
    if (this.canvas) {
      this.width = width ?? this.canvas.clientWidth
      this.height = height ?? this.canvas.clientHeight
      this.canvas.width = this.width
      this.canvas.height = this.height
    }
  }

  submit(command: RenderCommand): void {
    this.commands.push(command)
  }

  flush(): void {
    if (!this.ctx) return
    this.ctx.clearRect(0, 0, this.width, this.height)
    this.commands.sort((a, b) => a.layer - b.layer)
    for (let i = 0; i < this.commands.length; i++) {
      this.commands[i].execute(this.ctx)
    }
    this.commands.length = 0
  }

  clear(): void {
    this.commands.length = 0
  }
}
