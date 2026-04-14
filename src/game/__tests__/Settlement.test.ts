import { describe, it, expect } from 'vitest'
import { calculateSettlement } from '../Settlement'
import type { PlantState, PlantConfig } from '../types'

function makePlant(index: number, attackPower: number, comboSegment = 4, alive = true): PlantState {
  const config: PlantConfig = {
    id: `plant-${index}`,
    name: `Plant ${index}`,
    comboSegment,
    attackPower,
    hp: 100,
  }
  return { config, currentHp: alive ? 100 : 0, alive, chainIndex: index }
}

describe('calculateSettlement', () => {
  // 链条: [P0:4段] → [P1:4段] → [P2:8段]，总 16 段

  it('打满的植物才算激活：连击 10 只激活前两棵（4+4 满），第三棵 2/8 未满不算', () => {
    const plants = [makePlant(0, 20), makePlant(1, 15), makePlant(2, 35, 8)]
    const result = calculateSettlement(plants, 10, false)
    expect(result.totalPower).toBe(20 + 15) // P2 未打满不贡献
    expect(result.activatedIndices).toEqual([0, 1])
    expect(result.aliveActivatedIndices).toEqual([0, 1])
  })

  it('连击刚好打满一棵植物时激活该植物', () => {
    const plants = [makePlant(0, 20), makePlant(1, 15), makePlant(2, 35, 8)]
    const result = calculateSettlement(plants, 4, false)
    expect(result.totalPower).toBe(20) // 只有 P0 打满
    expect(result.activatedIndices).toEqual([0])
  })

  it('连击未打满第一棵植物时无激活', () => {
    const plants = [makePlant(0, 20), makePlant(1, 15), makePlant(2, 35, 8)]
    const result = calculateSettlement(plants, 3, false)
    expect(result.totalPower).toBe(0) // P0 只 3/4，未满
    expect(result.activatedIndices).toEqual([])
  })

  it('阵亡植物即使打满也不贡献攻击力', () => {
    const plants = [makePlant(0, 20), makePlant(1, 15, 4, false), makePlant(2, 35, 8)]
    const result = calculateSettlement(plants, 10, false)
    expect(result.totalPower).toBe(20) // P1 阵亡不算，P2 未满不算
    expect(result.activatedIndices).toEqual([0, 1]) // P1 段数满了算激活
    expect(result.aliveActivatedIndices).toEqual([0]) // 但不贡献攻击
  })

  it('连击为 0 时攻击力为 0', () => {
    const plants = [makePlant(0, 20)]
    const result = calculateSettlement(plants, 0, false)
    expect(result.totalPower).toBe(0)
    expect(result.activatedIndices).toEqual([])
  })

  it('打满全链条所有植物都激活', () => {
    const plants = [makePlant(0, 20), makePlant(1, 15)]
    const result = calculateSettlement(plants, 8, true)
    expect(result.isFullChain).toBe(true)
    expect(result.totalPower).toBe(20 + 15)
    expect(result.activatedIndices).toEqual([0, 1])
  })
})
