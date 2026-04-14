import { describe, it, expect } from 'vitest'
import { PlantChain } from '../PlantChain'
import type { PlantConfig } from '../types'

const TEST_PLANTS: PlantConfig[] = [
  { id: 'peashooter', name: '豌豆射手', comboSegment: 4, attackPower: 20, hp: 100 },
  { id: 'snow_pea', name: '寒冰射手', comboSegment: 4, attackPower: 15, hp: 80 },
  { id: 'repeater', name: '双发射手', comboSegment: 8, attackPower: 35, hp: 120 },
]

describe('PlantChain', () => {
  it('总段数等于各植物段数之和', () => {
    const chain = new PlantChain(TEST_PLANTS)
    expect(chain.totalSegments).toBe(16)
  })

  it('初始状态所有植物存活且满血', () => {
    const chain = new PlantChain(TEST_PLANTS)
    const states = chain.getStates()
    expect(states).toHaveLength(3)
    for (const s of states) {
      expect(s.alive).toBe(true)
      expect(s.currentHp).toBe(s.config.hp)
    }
  })

  it('根据连击数返回当前所在植物索引', () => {
    const chain = new PlantChain(TEST_PLANTS)
    expect(chain.getPlantIndexAtCombo(1)).toBe(0)
    expect(chain.getPlantIndexAtCombo(4)).toBe(0)
    expect(chain.getPlantIndexAtCombo(5)).toBe(1)
    expect(chain.getPlantIndexAtCombo(9)).toBe(2)
    expect(chain.getPlantIndexAtCombo(16)).toBe(2)
  })

  it('扣血直到植物阵亡', () => {
    const chain = new PlantChain(TEST_PLANTS)
    chain.takeDamage(0, 60)
    expect(chain.getStates()[0].currentHp).toBe(40)
    expect(chain.getStates()[0].alive).toBe(true)
    chain.takeDamage(0, 50)
    expect(chain.getStates()[0].currentHp).toBe(0)
    expect(chain.getStates()[0].alive).toBe(false)
  })

  it('血量不会降到 0 以下', () => {
    const chain = new PlantChain(TEST_PLANTS)
    chain.takeDamage(0, 9999)
    expect(chain.getStates()[0].currentHp).toBe(0)
  })

  it('打满链条回血存活植物', () => {
    const chain = new PlantChain(TEST_PLANTS)
    chain.takeDamage(0, 50)
    chain.healOnFullChain(30)
    expect(chain.getStates()[0].currentHp).toBe(80)
  })

  it('回血不超过上限', () => {
    const chain = new PlantChain(TEST_PLANTS)
    chain.takeDamage(0, 10)
    chain.healOnFullChain(50)
    expect(chain.getStates()[0].currentHp).toBe(100)
  })

  it('打满链条复活阵亡植物', () => {
    const chain = new PlantChain(TEST_PLANTS)
    chain.takeDamage(0, 200)
    expect(chain.getStates()[0].alive).toBe(false)
    chain.healOnFullChain(30)
    expect(chain.getStates()[0].alive).toBe(true)
    expect(chain.getStates()[0].currentHp).toBe(30)
  })

  it('重置所有植物到满血', () => {
    const chain = new PlantChain(TEST_PLANTS)
    chain.takeDamage(0, 200)
    chain.takeDamage(1, 50)
    chain.reset()
    for (const s of chain.getStates()) {
      expect(s.alive).toBe(true)
      expect(s.currentHp).toBe(s.config.hp)
    }
  })

  it('获取最右侧存活植物索引', () => {
    const chain = new PlantChain(TEST_PLANTS)
    expect(chain.getRightmostAlivePlantIndex()).toBe(2)
    chain.takeDamage(2, 9999)
    expect(chain.getRightmostAlivePlantIndex()).toBe(1)
    chain.takeDamage(1, 9999)
    expect(chain.getRightmostAlivePlantIndex()).toBe(0)
    chain.takeDamage(0, 9999)
    expect(chain.getRightmostAlivePlantIndex()).toBe(-1)
  })
})
