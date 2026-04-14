import { describe, it, expect } from 'vitest'
import { ComboSystem } from '../ComboSystem'

const SEGMENTS = [4, 4, 8]

describe('ComboSystem', () => {
  it('初始连击为 0', () => {
    const combo = new ComboSystem(SEGMENTS)
    expect(combo.current).toBe(0)
  })

  it('hit() 增加连击数', () => {
    const combo = new ComboSystem(SEGMENTS)
    combo.hit()
    expect(combo.current).toBe(1)
    combo.hit()
    expect(combo.current).toBe(2)
  })

  it('hit() 打满链条时自动结算', () => {
    const combo = new ComboSystem(SEGMENTS)
    for (let i = 0; i < 15; i++) combo.hit()
    expect(combo.current).toBe(15)
    const result = combo.hit()
    expect(result).not.toBeNull()
    expect(result!.comboCount).toBe(16)
    expect(result!.isFullChain).toBe(true)
    expect(combo.current).toBe(0)
  })

  it('miss() 连击 > 0 时触发结算并归零', () => {
    const combo = new ComboSystem(SEGMENTS)
    combo.hit()
    combo.hit()
    combo.hit()
    const result = combo.miss()
    expect(result).not.toBeNull()
    expect(result!.comboCount).toBe(3)
    expect(result!.isFullChain).toBe(false)
    expect(combo.current).toBe(0)
  })

  it('miss() 连击 = 0 时返回 null', () => {
    const combo = new ComboSystem(SEGMENTS)
    const result = combo.miss()
    expect(result).toBeNull()
  })

  it('settle() 连击 > 0 时触发结算并归零', () => {
    const combo = new ComboSystem(SEGMENTS)
    combo.hit()
    combo.hit()
    const result = combo.settle()
    expect(result).not.toBeNull()
    expect(result!.comboCount).toBe(2)
    expect(combo.current).toBe(0)
  })

  it('settle() 连击 = 0 时返回 null', () => {
    const combo = new ComboSystem(SEGMENTS)
    const result = combo.settle()
    expect(result).toBeNull()
  })

  it('结算后可以重新开始连击', () => {
    const combo = new ComboSystem(SEGMENTS)
    combo.hit()
    combo.hit()
    combo.miss()
    expect(combo.current).toBe(0)
    combo.hit()
    expect(combo.current).toBe(1)
  })
})
