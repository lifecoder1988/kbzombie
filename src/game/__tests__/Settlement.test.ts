import { describe, it, expect } from 'vitest'
import { calculateSettlement } from '../Settlement'
import type { PlantState, PlantConfig, Element, Spread, Flight, Impact } from '../types'

function makePlant(
  index: number,
  attackPower: number,
  comboSegment = 4,
  alive = true,
  element: Element = 'normal',
  spread: Spread = 'single',
  flight: Flight = 'straight',
  impact: Impact = 'vanish',
): PlantState {
  const config: PlantConfig = {
    id: `plant-${index}`,
    name: `Plant ${index}`,
    comboSegment,
    attackPower,
    hp: 100,
    element,
    spread,
    flight,
    impact,
  }
  return { config, currentHp: alive ? 100 : 0, alive, chainIndex: index }
}

const defaultSynergy: Readonly<Record<number, number>> = { 1: 1.0, 2: 1.2, 3: 1.5 }

describe('calculateSettlement', () => {
  it('打满的植物才算激活：连击 10 只激活前两棵，第三棵未满不算', () => {
    const plants = [makePlant(0, 20), makePlant(1, 15), makePlant(2, 35, 8)]
    const result = calculateSettlement(plants, 10, false, defaultSynergy)
    expect(result.synergyMultiplier).toBe(1.2)
    expect(result.perPlantPower).toEqual([20 * 1.2, 15 * 1.2])
    expect(result.totalPower).toBeCloseTo(20 * 1.2 + 15 * 1.2)
    expect(result.activatedIndices).toEqual([0, 1])
    expect(result.aliveActivatedIndices).toEqual([0, 1])
  })

  it('连击刚好打满一棵植物时激活该植物', () => {
    const plants = [makePlant(0, 20), makePlant(1, 15), makePlant(2, 35, 8)]
    const result = calculateSettlement(plants, 4, false, defaultSynergy)
    expect(result.synergyMultiplier).toBe(1.0)
    expect(result.perPlantPower).toEqual([20])
    expect(result.totalPower).toBe(20)
    expect(result.activatedIndices).toEqual([0])
  })

  it('连击未打满第一棵植物时无激活', () => {
    const plants = [makePlant(0, 20), makePlant(1, 15), makePlant(2, 35, 8)]
    const result = calculateSettlement(plants, 3, false, defaultSynergy)
    expect(result.totalPower).toBe(0)
    expect(result.synergyMultiplier).toBe(1.0)
    expect(result.perPlantPower).toEqual([])
    expect(result.activatedIndices).toEqual([])
  })

  it('阵亡植物即使打满也不贡献攻击力', () => {
    const plants = [makePlant(0, 20), makePlant(1, 15, 4, false), makePlant(2, 35, 8)]
    const result = calculateSettlement(plants, 10, false, defaultSynergy)
    expect(result.synergyMultiplier).toBe(1.0)
    expect(result.perPlantPower).toEqual([20])
    expect(result.totalPower).toBe(20)
    expect(result.activatedIndices).toEqual([0, 1])
    expect(result.aliveActivatedIndices).toEqual([0])
  })

  it('连击为 0 时攻击力为 0', () => {
    const plants = [makePlant(0, 20)]
    const result = calculateSettlement(plants, 0, false, defaultSynergy)
    expect(result.totalPower).toBe(0)
    expect(result.synergyMultiplier).toBe(1.0)
    expect(result.perPlantPower).toEqual([])
    expect(result.activatedIndices).toEqual([])
  })

  it('打满全链条所有植物都激活', () => {
    const plants = [makePlant(0, 20), makePlant(1, 15)]
    const result = calculateSettlement(plants, 8, true, defaultSynergy)
    expect(result.isFullChain).toBe(true)
    expect(result.synergyMultiplier).toBe(1.2)
    expect(result.perPlantPower).toEqual([20 * 1.2, 15 * 1.2])
    expect(result.totalPower).toBeCloseTo(20 * 1.2 + 15 * 1.2)
    expect(result.activatedIndices).toEqual([0, 1])
  })

  it('3 棵植物全激活使用 multiplier[3]', () => {
    const plants = [makePlant(0, 20), makePlant(1, 15), makePlant(2, 10)]
    const result = calculateSettlement(plants, 12, true, defaultSynergy)
    expect(result.synergyMultiplier).toBe(1.5)
    expect(result.perPlantPower).toEqual([20 * 1.5, 15 * 1.5, 10 * 1.5])
    expect(result.totalPower).toBeCloseTo((20 + 15 + 10) * 1.5)
  })

  it('激活数量超出倍率表时取表中最大 key 的倍率', () => {
    const smallTable: Readonly<Record<number, number>> = { 1: 1.0, 2: 1.5 }
    const plants = [makePlant(0, 10), makePlant(1, 10), makePlant(2, 10)]
    const result = calculateSettlement(plants, 12, true, smallTable)
    expect(result.synergyMultiplier).toBe(1.5)
  })

  it('特效合成返回正确的 synthesizedEffect', () => {
    const plants = [
      makePlant(0, 20, 4, true, 'ice', 'single', 'straight', 'vanish'),
      makePlant(1, 15, 4, true, 'normal', 'fan', 'straight', 'pierce'),
    ]
    const result = calculateSettlement(plants, 8, true, defaultSynergy)
    expect(result.synthesizedEffect).toEqual({
      element: 'ice',
      spread: 'fan',
      flight: 'straight',
      impact: 'pierce',
    })
  })

  it('阵亡植物不参与特效合成', () => {
    const plants = [
      makePlant(0, 20, 4, true, 'normal', 'single', 'straight', 'vanish'),
      makePlant(1, 15, 4, false, 'ice', 'fan', 'tracking', 'explode'),
    ]
    const result = calculateSettlement(plants, 8, true, defaultSynergy)
    expect(result.synthesizedEffect).toEqual({
      element: 'normal',
      spread: 'single',
      flight: 'straight',
      impact: 'vanish',
    })
  })

  it('不同植物有不同的 perPlantPower', () => {
    const plants = [makePlant(0, 20), makePlant(1, 30)]
    const result = calculateSettlement(plants, 8, true, defaultSynergy)
    expect(result.perPlantPower[0]).toBeCloseTo(20 * 1.2)
    expect(result.perPlantPower[1]).toBeCloseTo(30 * 1.2)
  })
})
