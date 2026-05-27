// src/engine/__tests__/GameLoop.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { GameLoop } from '../GameLoop'
import type { GameLoopTarget } from '../GameLoop'

// Node.js doesn't have requestAnimationFrame; mock it so start()/stop() don't throw
beforeAll(() => {
  if (typeof globalThis.requestAnimationFrame === 'undefined') {
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
      return setTimeout(() => cb(performance.now()), 0) as unknown as number
    }
  }
  if (typeof globalThis.cancelAnimationFrame === 'undefined') {
    globalThis.cancelAnimationFrame = (id: number): void => {
      clearTimeout(id)
    }
  }
})

function createMockTarget(): GameLoopTarget & { updates: number[]; renderCount: number } {
  return {
    updates: [],
    renderCount: 0,
    update(dt: number) {
      this.updates.push(dt)
    },
    render(_ctx: CanvasRenderingContext2D) {
      this.renderCount++
    },
  }
}

describe('GameLoop', () => {
  it('tick 调用 target.update 并传入 dt', () => {
    const loop = new GameLoop()
    const target = createMockTarget()
    loop.start(target)
    loop.stop() // 立刻停掉 rAF，只用 tick 手动驱动

    loop.tick(16)
    loop.tick(32)

    expect(target.updates).toEqual([16, 32])
  })

  it('暂停时 tick 不调用 update', () => {
    const loop = new GameLoop()
    const target = createMockTarget()
    loop.start(target)
    loop.stop()

    loop.tick(16)
    loop.pause()
    loop.tick(16)
    loop.tick(16)

    expect(target.updates).toEqual([16])
    expect(loop.isPaused).toBe(true)
  })

  it('恢复后 tick 继续调用 update', () => {
    const loop = new GameLoop()
    const target = createMockTarget()
    loop.start(target)
    loop.stop()

    loop.tick(16)
    loop.pause()
    loop.tick(16)
    loop.resume()
    loop.tick(16)

    expect(target.updates).toEqual([16, 16])
    expect(loop.isPaused).toBe(false)
  })

  it('没有 ctx 时不调用 render', () => {
    const loop = new GameLoop()
    const target = createMockTarget()
    loop.start(target) // 不传 ctx
    loop.stop()

    loop.tick(16)

    expect(target.renderCount).toBe(0)
  })

  it('没有 target 时 tick 不报错', () => {
    const loop = new GameLoop()
    expect(() => loop.tick(16)).not.toThrow()
  })
})
