import { describe, it, expect } from 'vitest'
import { synthesizeEffects } from '../EffectSynthesis'
import type { Element, Spread, Flight, Impact } from '../types'

const plant = (
  element: Element = 'normal',
  spread: Spread = 'single',
  flight: Flight = 'straight',
  impact: Impact = 'vanish',
) => ({ element, spread, flight, impact })

describe('synthesizeEffects — Element 合成', () => {
  it('空输入返回 normal', () => {
    expect(synthesizeEffects([])).toEqual({
      element: 'normal',
      spread: 'single',
      flight: 'straight',
      impact: 'vanish',
    })
  })

  it('单棵植物 normal 返回自身', () => {
    expect(synthesizeEffects([plant('normal')])).toMatchObject({ element: 'normal' })
  })

  it('单棵植物 ice 返回自身', () => {
    expect(synthesizeEffects([plant('ice')])).toMatchObject({ element: 'ice' })
  })

  it('单棵植物 fire 返回自身', () => {
    expect(synthesizeEffects([plant('fire')])).toMatchObject({ element: 'fire' })
  })

  it('单棵植物 electric 返回自身', () => {
    expect(synthesizeEffects([plant('electric')])).toMatchObject({ element: 'electric' })
  })

  it('单棵植物 stun 返回自身', () => {
    expect(synthesizeEffects([plant('stun')])).toMatchObject({ element: 'stun' })
  })

  it('单棵植物 knockback 返回自身', () => {
    expect(synthesizeEffects([plant('knockback')])).toMatchObject({ element: 'knockback' })
  })

  it('ice + fire 互相抵消返回 normal', () => {
    expect(synthesizeEffects([plant('ice'), plant('fire')])).toMatchObject({ element: 'normal' })
  })

  it('ice + fire 抵消后更高优先级 electric 保留', () => {
    expect(
      synthesizeEffects([plant('ice'), plant('fire'), plant('electric')]),
    ).toMatchObject({ element: 'electric' })
  })

  it('优先级：electric > ice', () => {
    expect(synthesizeEffects([plant('ice'), plant('electric')])).toMatchObject({ element: 'electric' })
  })

  it('优先级：stun > electric', () => {
    expect(synthesizeEffects([plant('electric'), plant('stun')])).toMatchObject({ element: 'stun' })
  })

  it('优先级：knockback 最高', () => {
    expect(
      synthesizeEffects([plant('stun'), plant('knockback'), plant('electric')]),
    ).toMatchObject({ element: 'knockback' })
  })
})

describe('synthesizeEffects — Spread 合成', () => {
  it('空输入返回 single', () => {
    expect(synthesizeEffects([])).toMatchObject({ spread: 'single' })
  })

  it('优先级：fan > burst > single', () => {
    expect(
      synthesizeEffects([plant('normal', 'single'), plant('normal', 'burst'), plant('normal', 'fan')]),
    ).toMatchObject({ spread: 'fan' })
  })

  it('优先级：burst > single', () => {
    expect(
      synthesizeEffects([plant('normal', 'single'), plant('normal', 'burst')]),
    ).toMatchObject({ spread: 'burst' })
  })
})

describe('synthesizeEffects — Flight 合成', () => {
  it('空输入返回 straight', () => {
    expect(synthesizeEffects([])).toMatchObject({ flight: 'straight' })
  })

  it('tracking 优先于 straight', () => {
    expect(
      synthesizeEffects([plant('normal', 'single', 'straight'), plant('normal', 'single', 'tracking')]),
    ).toMatchObject({ flight: 'tracking' })
  })
})

describe('synthesizeEffects — Impact 合成', () => {
  it('空输入返回 vanish', () => {
    expect(synthesizeEffects([])).toMatchObject({ impact: 'vanish' })
  })

  it('优先级：explode > pierce > chain > vanish', () => {
    expect(
      synthesizeEffects([
        plant('normal', 'single', 'straight', 'vanish'),
        plant('normal', 'single', 'straight', 'chain'),
        plant('normal', 'single', 'straight', 'pierce'),
        plant('normal', 'single', 'straight', 'explode'),
      ]),
    ).toMatchObject({ impact: 'explode' })
  })

  it('优先级：pierce > chain', () => {
    expect(
      synthesizeEffects([
        plant('normal', 'single', 'straight', 'chain'),
        plant('normal', 'single', 'straight', 'pierce'),
      ]),
    ).toMatchObject({ impact: 'pierce' })
  })
})

describe('synthesizeEffects — 全维度集成测试', () => {
  it('寒冰+大喷菇 = ice/fan/straight/vanish', () => {
    // 寒冰: ice/single/straight/vanish，大喷菇: normal/fan/straight/vanish
    expect(
      synthesizeEffects([
        plant('ice', 'single', 'straight', 'vanish'),
        plant('normal', 'fan', 'straight', 'vanish'),
      ]),
    ).toEqual({ element: 'ice', spread: 'fan', flight: 'straight', impact: 'vanish' })
  })

  it('火炬+猫尾草 = fire/single/tracking/chain', () => {
    // 火炬: fire/single/straight/vanish，猫尾草: normal/single/tracking/chain
    expect(
      synthesizeEffects([
        plant('fire', 'single', 'straight', 'vanish'),
        plant('normal', 'single', 'tracking', 'chain'),
      ]),
    ).toEqual({ element: 'fire', spread: 'single', flight: 'tracking', impact: 'chain' })
  })

  it('寒冰+火炬+闪电芦苇 = electric (ice+fire 抵消，electric 保留)', () => {
    // 寒冰: ice，火炬: fire，闪电芦苇: electric
    expect(
      synthesizeEffects([
        plant('ice', 'single', 'straight', 'vanish'),
        plant('fire', 'single', 'straight', 'vanish'),
        plant('electric', 'single', 'straight', 'vanish'),
      ]),
    ).toMatchObject({ element: 'electric' })
  })
})
