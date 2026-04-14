import { describe, it, expect } from 'vitest'
import { calculateSettlement } from '../Settlement'
import type { PlantState, PlantConfig } from '../types'

function makePlant(index: number, attackPower: number, alive = true): PlantState {
  const config: PlantConfig = {
    id: `plant-${index}`,
    name: `Plant ${index}`,
    segments: 4,
    attackPower,
    hp: 100,
  }
  return { config, currentHp: alive ? 100 : 0, alive, chainIndex: index }
}

describe('calculateSettlement', () => {
  it('对所有已激活的存活植物攻击力求和', () => {
    const plants = [makePlant(0, 20), makePlant(1, 15), makePlant(2, 35)]
    const result = calculateSettlement(plants, 10, false)
    expect(result.totalPower).toBe(20 + 15 + 35)
    expect(result.activatedIndices).toEqual([0, 1, 2])
    expect(result.aliveActivatedIndices).toEqual([0, 1, 2])
    expect(result.isFullChain).toBe(false)
  })

  it('阵亡植物不贡献攻击力', () => {
    const plants = [makePlant(0, 20), makePlant(1, 15, false), makePlant(2, 35)]
    const result = calculateSettlement(plants, 10, false)
    expect(result.totalPower).toBe(20 + 35)
    expect(result.activatedIndices).toEqual([0, 1, 2])
    expect(result.aliveActivatedIndices).toEqual([0, 2])
  })

  it('连击只到第一棵植物时只计算第一棵', () => {
    const plants = [makePlant(0, 20), makePlant(1, 15), makePlant(2, 35)]
    const result = calculateSettlement(plants, 3, false)
    expect(result.totalPower).toBe(20)
    expect(result.activatedIndices).toEqual([0])
  })

  it('连击为 0 时攻击力为 0', () => {
    const plants = [makePlant(0, 20)]
    const result = calculateSettlement(plants, 0, false)
    expect(result.totalPower).toBe(0)
    expect(result.activatedIndices).toEqual([])
  })

  it('打满链条标记 isFullChain', () => {
    const plants = [makePlant(0, 20), makePlant(1, 15)]
    const result = calculateSettlement(plants, 8, true)
    expect(result.isFullChain).toBe(true)
    expect(result.totalPower).toBe(20 + 15)
  })
})
