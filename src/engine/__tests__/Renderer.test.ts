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
})
