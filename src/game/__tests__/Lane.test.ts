import { describe, it, expect } from 'vitest'
import { Lane } from '../Lane'
import type { PlantConfig } from '../types'

const PLANTS: PlantConfig[] = [
  { id: 'a', name: 'A', comboSegment: 4, attackPower: 10, hp: 100, element: 'normal', spread: 'single', flight: 'straight', impact: 'vanish' },
  { id: 'b', name: 'B', comboSegment: 4, attackPower: 15, hp: 80, element: 'ice', spread: 'single', flight: 'straight', impact: 'vanish' },
]

describe('Lane', () => {
  it('构造后初始状态正确', () => {
    const lane = new Lane(0, PLANTS, ['f', 'j', 'd', 'k'], 200, 1000, 8, 42)
    expect(lane.index).toBe(0)
    expect(lane.comboCount).toBe(0)
    expect(lane.currentLetter).toBeDefined()
    expect(lane.chainLetters.length).toBe(8) // 4+4
    expect(lane.getPlantStates().length).toBe(2)
    expect(lane.isEmpty).toBe(false)
  })

  it('空路（无植物）', () => {
    const lane = new Lane(0, [], ['f', 'j'], 200, 1000, 8)
    expect(lane.isEmpty).toBe(true)
    expect(lane.chainLetters.length).toBe(0)
    expect(lane.comboCount).toBe(0)
    expect(lane.currentLetter).toBe('')
  })

  it('laneY 正确存储', () => {
    const lane = new Lane(0, PLANTS, ['f'], 300, 1000, 8, 42)
    expect(lane.laneY).toBe(300)
  })

  it('plantPositions 和 plantWidths 计算', () => {
    const lane = new Lane(0, PLANTS, ['f', 'j'], 200, 1000, 8, 42)
    expect(lane.plantPositions.length).toBe(2)
    expect(lane.plantWidths.length).toBe(2)
    // 两棵植物段数相同，宽度应相同
    expect(lane.plantWidths[0]).toBe(lane.plantWidths[1])
    // 第二棵 x > 第一棵 x
    expect(lane.plantPositions[1]).toBeGreaterThan(lane.plantPositions[0])
  })
})

describe('Lane 连击', () => {
  it('hit 推进连击', () => {
    const lane = new Lane(0, PLANTS, ['f', 'j', 'd', 'k'], 200, 1000, 8, 42)
    const result = lane.hit()
    expect(result).toBeNull()
    expect(lane.comboCount).toBe(1)
  })

  it('miss 触发结算', () => {
    const lane = new Lane(0, PLANTS, ['f', 'j', 'd', 'k'], 200, 1000, 8, 42)
    lane.hit()
    lane.hit()
    const result = lane.miss()
    expect(result).not.toBeNull()
    expect(result!.comboCount).toBe(2)
    expect(lane.comboCount).toBe(0)
  })

  it('settle 触发结算', () => {
    const lane = new Lane(0, PLANTS, ['f', 'j', 'd', 'k'], 200, 1000, 8, 42)
    lane.hit()
    const result = lane.settle()
    expect(result).not.toBeNull()
    expect(result!.comboCount).toBe(1)
    expect(lane.comboCount).toBe(0)
  })

  it('miss 在连击为 0 时返回 null', () => {
    const lane = new Lane(0, PLANTS, ['f', 'j', 'd', 'k'], 200, 1000, 8, 42)
    expect(lane.miss()).toBeNull()
  })

  it('settle 在连击为 0 时返回 null', () => {
    const lane = new Lane(0, PLANTS, ['f', 'j', 'd', 'k'], 200, 1000, 8, 42)
    expect(lane.settle()).toBeNull()
  })

  it('打满自动结算', () => {
    const lane = new Lane(0, PLANTS, ['f', 'j', 'd', 'k'], 200, 1000, 8, 42)
    let result = null
    for (let i = 0; i < 8; i++) {
      result = lane.hit()
    }
    expect(result).not.toBeNull()
    expect(result!.isFullChain).toBe(true)
    expect(lane.comboCount).toBe(0)
  })

  it('resetCombo 归零', () => {
    const lane = new Lane(0, PLANTS, ['f', 'j', 'd', 'k'], 200, 1000, 8, 42)
    lane.hit()
    lane.hit()
    lane.resetCombo()
    expect(lane.comboCount).toBe(0)
  })
})

describe('Lane 字母再生', () => {
  it('regenerateLetters 避免首字母冲突', () => {
    const lane = new Lane(0, PLANTS, ['a', 'b', 'c'], 200, 1000, 8, 42)
    lane.regenerateLetters(['a', 'b'])
    expect(lane.currentLetter).toBe('c')
  })

  it('regenerateLetters 重置所有字母', () => {
    const lane = new Lane(0, PLANTS, ['a', 'b', 'c'], 200, 1000, 8, 42)
    const before = [...lane.chainLetters]
    lane.regenerateLetters([])
    expect(lane.chainLetters.length).toBe(before.length)
  })

  it('空路 regenerateLetters 不报错', () => {
    const lane = new Lane(0, [], ['a', 'b'], 200, 1000, 8)
    expect(() => lane.regenerateLetters(['a'])).not.toThrow()
  })
})

describe('Lane 植物链委托', () => {
  it('takeDamage 扣血', () => {
    const lane = new Lane(0, PLANTS, ['f'], 200, 1000, 8, 42)
    lane.takeDamage(0, 30)
    expect(lane.getPlantStates()[0].currentHp).toBe(70)
  })

  it('healOnFullChain 回血', () => {
    const lane = new Lane(0, PLANTS, ['f'], 200, 1000, 8, 42)
    lane.takeDamage(0, 50)
    lane.healOnFullChain(20)
    expect(lane.getPlantStates()[0].currentHp).toBe(70)
  })

  it('getRightmostAlivePlantIndex', () => {
    const lane = new Lane(0, PLANTS, ['f'], 200, 1000, 8, 42)
    expect(lane.getRightmostAlivePlantIndex()).toBe(1) // last plant
  })
})
