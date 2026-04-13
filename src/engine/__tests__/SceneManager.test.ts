// src/engine/__tests__/SceneManager.test.ts
import { describe, it, expect, vi } from 'vitest'
import { SceneManager } from '../SceneManager'
import type { Scene } from '../types'

function createMockScene(name: string): Scene & {
  enterCalled: boolean
  exitCalled: boolean
  updates: number[]
} {
  return {
    name,
    enterCalled: false,
    exitCalled: false,
    updates: [],
    enter() { this.enterCalled = true },
    exit() { this.exitCalled = true },
    update(dt: number) { this.updates.push(dt) },
    render(_ctx: CanvasRenderingContext2D) {},
    handleInput: vi.fn(),
  }
}

describe('SceneManager', () => {
  it('switchTo 调用新场景的 enter', () => {
    const mgr = new SceneManager()
    const scene = createMockScene('menu')
    mgr.register(scene)

    mgr.switchTo('menu')

    expect(scene.enterCalled).toBe(true)
  })

  it('切换场景时调用旧场景 exit 和新场景 enter', () => {
    const mgr = new SceneManager()
    const scene1 = createMockScene('menu')
    const scene2 = createMockScene('battle')
    mgr.register(scene1)
    mgr.register(scene2)

    mgr.switchTo('menu')
    mgr.switchTo('battle')

    expect(scene1.exitCalled).toBe(true)
    expect(scene2.enterCalled).toBe(true)
  })

  it('switchTo 不存在的场景抛错', () => {
    const mgr = new SceneManager()
    expect(() => mgr.switchTo('nonexistent')).toThrow('Scene "nonexistent" not registered')
  })

  it('update 转发给当前场景', () => {
    const mgr = new SceneManager()
    const scene = createMockScene('menu')
    mgr.register(scene)
    mgr.switchTo('menu')

    mgr.update(16)
    mgr.update(32)

    expect(scene.updates).toEqual([16, 32])
  })

  it('handleInput 转发给当前场景', () => {
    const mgr = new SceneManager()
    const scene = createMockScene('menu')
    mgr.register(scene)
    mgr.switchTo('menu')

    const event = { key: 'f', type: 'keydown' as const, timestamp: 0 }
    mgr.handleInput(event)

    expect(scene.handleInput).toHaveBeenCalledWith(event)
  })

  it('没有当前场景时 update 和 handleInput 不报错', () => {
    const mgr = new SceneManager()
    expect(() => mgr.update(16)).not.toThrow()
    expect(() => mgr.handleInput({ key: 'f', type: 'keydown', timestamp: 0 })).not.toThrow()
  })
})
