// src/engine/GameLoop.ts
import type { Updatable, Renderable } from './types'

export interface GameLoopTarget extends Updatable, Renderable {}

export class GameLoop {
  private running = false
  private paused = false
  private lastTime = 0
  private rafId = 0
  private target: GameLoopTarget | null = null
  private ctx: CanvasRenderingContext2D | null = null

  start(target: GameLoopTarget, ctx?: CanvasRenderingContext2D): void {
    if (this.running) return
    this.target = target
    this.ctx = ctx ?? null
    this.running = true
    this.paused = false
    this.lastTime = performance.now()
    this.rafId = requestAnimationFrame((t) => this.loop(t))
  }

  stop(): void {
    this.running = false
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = 0
    }
  }

  pause(): void {
    this.paused = true
  }

  resume(): void {
    if (this.paused) {
      this.paused = false
      this.lastTime = performance.now()
    }
  }

  get isPaused(): boolean {
    return this.paused
  }

  get isRunning(): boolean {
    return this.running
  }

  /** 手动推进一帧，用于测试（不走 rAF） */
  tick(dt: number): void {
    if (!this.target) return
    if (!this.paused) {
      this.target.update(dt)
    }
    if (this.ctx) {
      this.target.render(this.ctx)
    }
  }

  private loop(now: number): void {
    if (!this.running) return
    const dt = now - this.lastTime
    this.lastTime = now
    if (this.target) {
      if (!this.paused) {
        this.target.update(dt)
      }
      if (this.ctx) {
        this.target.render(this.ctx)
      }
    }
    this.rafId = requestAnimationFrame((t) => this.loop(t))
  }
}
