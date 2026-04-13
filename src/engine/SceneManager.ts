// src/engine/SceneManager.ts
import type { Scene, InputEvent } from './types'
import type { GameLoopTarget } from './GameLoop'

export type { GameLoopTarget }

export class SceneManager implements GameLoopTarget {
  private currentScene: Scene | null = null
  private scenes: Map<string, Scene> = new Map()

  register(scene: Scene): void {
    this.scenes.set(scene.name, scene)
  }

  switchTo(name: string): void {
    const next = this.scenes.get(name)
    if (!next) {
      throw new Error(`Scene "${name}" not registered`)
    }
    if (this.currentScene) {
      this.currentScene.exit()
    }
    this.currentScene = next
    this.currentScene.enter()
  }

  getCurrent(): Scene | null {
    return this.currentScene
  }

  handleInput(event: InputEvent): void {
    if (this.currentScene?.handleInput) {
      this.currentScene.handleInput(event)
    }
  }

  update(dt: number): void {
    if (this.currentScene) {
      this.currentScene.update(dt)
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.currentScene) {
      this.currentScene.render(ctx)
    }
  }
}
