// src/engine/__tests__/Renderer.test.ts
import { describe, it, expect, vi } from 'vitest'
import { Renderer } from '../Renderer'
import { RenderLayer } from '../types'

describe('Renderer', () => {
  it('submit 收集渲染指令', () => {
    const renderer = new Renderer()
    const cmd = { layer: RenderLayer.Entity, execute: vi.fn() }

    renderer.submit(cmd)
    renderer.submit(cmd)

    // 没有 ctx，flush 不执行
    renderer.flush()
    expect(cmd.execute).not.toHaveBeenCalled()
  })

  it('clear 清空指令队列', () => {
    const renderer = new Renderer()
    const cmd = { layer: RenderLayer.Entity, execute: vi.fn() }

    renderer.submit(cmd)
    renderer.clear()

    const cmd2 = { layer: RenderLayer.UI, execute: vi.fn() }
    renderer.submit(cmd2)

    expect(() => renderer.flush()).not.toThrow()
  })

  it('getContext 未 attach 时返回 null', () => {
    const renderer = new Renderer()
    expect(renderer.getContext()).toBeNull()
  })

  it('flush 按 layer 顺序执行指令', () => {
    const renderer = new Renderer()
    // 用一个简易 mock ctx，只需要 clearRect 不报错
    const mockCtx = { clearRect: vi.fn() } as unknown as CanvasRenderingContext2D

    // 通过反射注入 ctx 和尺寸（不走 attach，避免依赖 DOM）
    Object.assign(renderer, { ctx: mockCtx, width: 800, height: 600 })

    const order: number[] = []
    renderer.submit({ layer: RenderLayer.UI, execute: () => order.push(RenderLayer.UI) })
    renderer.submit({ layer: RenderLayer.Background, execute: () => order.push(RenderLayer.Background) })
    renderer.submit({ layer: RenderLayer.Effect, execute: () => order.push(RenderLayer.Effect) })
    renderer.submit({ layer: RenderLayer.Entity, execute: () => order.push(RenderLayer.Entity) })

    renderer.flush()

    expect(order).toEqual([
      RenderLayer.Background,
      RenderLayer.Entity,
      RenderLayer.Effect,
      RenderLayer.UI,
    ])
  })

  it('flush 后指令队列清空', () => {
    const renderer = new Renderer()
    const mockCtx = { clearRect: vi.fn() } as unknown as CanvasRenderingContext2D
    Object.assign(renderer, { ctx: mockCtx, width: 800, height: 600 })

    const execute = vi.fn()
    renderer.submit({ layer: RenderLayer.Entity, execute })

    renderer.flush()
    expect(execute).toHaveBeenCalledTimes(1)

    renderer.flush()
    expect(execute).toHaveBeenCalledTimes(1) // 不会再执行
  })
})
