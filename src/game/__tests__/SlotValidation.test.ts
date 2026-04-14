import { describe, it, expect } from 'vitest'
import { validateSlot } from '../SlotValidation'

describe('validateSlot', () => {
  const plants: Record<string, { comboSegment: number }> = {
    peashooter: { comboSegment: 4 },
    snow_pea: { comboSegment: 4 },
    torchwood: { comboSegment: 8 },
    fume_shroom: { comboSegment: 16 },
  }

  it('总段数 <= slotSize 通过', () => {
    expect(validateSlot(['peashooter', 'snow_pea'], 8, plants)).toEqual({ valid: true, used: 8 })
  })

  it('总段数 > slotSize 不通过', () => {
    const result = validateSlot(['torchwood', 'snow_pea'], 8, plants)
    expect(result.valid).toBe(false)
    expect(result.used).toBe(12)
  })

  it('不填满通过', () => {
    expect(validateSlot(['peashooter'], 8, plants)).toEqual({ valid: true, used: 4 })
  })

  it('空植物列表通过（空路）', () => {
    expect(validateSlot([], 8, plants)).toEqual({ valid: true, used: 0 })
  })

  it('重复植物计入总段数', () => {
    expect(validateSlot(['peashooter', 'peashooter'], 8, plants)).toEqual({ valid: true, used: 8 })
    const result = validateSlot(['peashooter', 'peashooter', 'peashooter'], 8, plants)
    expect(result.valid).toBe(false)
    expect(result.used).toBe(12)
  })

  it('未知植物 ID 返回错误', () => {
    const result = validateSlot(['unknown'], 8, plants)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('unknown')
  })
})
