import { describe, it, expect } from 'vitest'
import { synthesizeEffects } from '../EffectSynthesis'

describe('synthesizeEffects', () => {
  it('空数组返回默认值 normal/direct', () => {
    const result = synthesizeEffects([])
    expect(result).toEqual({ element: 'normal', trajectory: 'direct' })
  })

  it('单棵植物返回自身标签', () => {
    const result = synthesizeEffects([{ element: 'ice', trajectory: 'pierce' }])
    expect(result).toEqual({ element: 'ice', trajectory: 'pierce' })
  })

  it('全 normal 元素返回 normal', () => {
    const result = synthesizeEffects([
      { element: 'normal', trajectory: 'direct' },
      { element: 'normal', trajectory: 'direct' },
    ])
    expect(result.element).toBe('normal')
  })

  it('含 ice 不含 fire 返回 ice', () => {
    const result = synthesizeEffects([
      { element: 'normal', trajectory: 'direct' },
      { element: 'ice', trajectory: 'direct' },
    ])
    expect(result.element).toBe('ice')
  })

  it('含 fire 不含 ice 返回 fire', () => {
    const result = synthesizeEffects([
      { element: 'normal', trajectory: 'direct' },
      { element: 'fire', trajectory: 'direct' },
    ])
    expect(result.element).toBe('fire')
  })

  it('ice + fire 互相抵消返回 normal', () => {
    const result = synthesizeEffects([
      { element: 'ice', trajectory: 'direct' },
      { element: 'fire', trajectory: 'direct' },
    ])
    expect(result.element).toBe('normal')
  })

  it('ice + fire + normal 仍然抵消为 normal', () => {
    const result = synthesizeEffects([
      { element: 'normal', trajectory: 'direct' },
      { element: 'ice', trajectory: 'direct' },
      { element: 'fire', trajectory: 'direct' },
    ])
    expect(result.element).toBe('normal')
  })

  it('弹道取最高优先级：tracking > direct', () => {
    const result = synthesizeEffects([
      { element: 'normal', trajectory: 'direct' },
      { element: 'normal', trajectory: 'tracking' },
    ])
    expect(result.trajectory).toBe('tracking')
  })

  it('弹道取最高优先级：pierce > tracking', () => {
    const result = synthesizeEffects([
      { element: 'normal', trajectory: 'tracking' },
      { element: 'normal', trajectory: 'pierce' },
    ])
    expect(result.trajectory).toBe('pierce')
  })

  it('弹道取最高优先级：area 最高', () => {
    const result = synthesizeEffects([
      { element: 'normal', trajectory: 'direct' },
      { element: 'normal', trajectory: 'pierce' },
      { element: 'normal', trajectory: 'area' },
    ])
    expect(result.trajectory).toBe('area')
  })

  it('组合测试：ice + fire 抵消 + area 弹道', () => {
    const result = synthesizeEffects([
      { element: 'ice', trajectory: 'direct' },
      { element: 'fire', trajectory: 'area' },
    ])
    expect(result).toEqual({ element: 'normal', trajectory: 'area' })
  })

  it('组合测试：fire + tracking', () => {
    const result = synthesizeEffects([
      { element: 'fire', trajectory: 'direct' },
      { element: 'normal', trajectory: 'tracking' },
    ])
    expect(result).toEqual({ element: 'fire', trajectory: 'tracking' })
  })
})
