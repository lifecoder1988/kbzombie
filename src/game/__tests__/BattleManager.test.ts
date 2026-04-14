import { describe, it, expect } from 'vitest'
import { BattleManager } from '../BattleManager'
import { BattleStatus, ZombieState } from '../types'
import type { WaveConfig, PlantConfig } from '../types'

const TEST_PLANTS: PlantConfig[] = [
  { id: 'peashooter', name: '豌豆射手', comboSegment: 4, attackPower: 20, hp: 100 },
  { id: 'snow_pea', name: '寒冰射手', comboSegment: 4, attackPower: 15, hp: 80 },
]

const TEST_WAVES: WaveConfig[] = [
  { count: 3, interval: 1000 },
]

const TEST_ZOMBIE = { hp: 50, speed: 30, chewDps: 10 }
const TEST_LETTERS = ['f', 'j', 'd', 'k']

function createManager() {
  return new BattleManager({
    plants: TEST_PLANTS,
    waves: TEST_WAVES,
    zombieConfig: TEST_ZOMBIE,
    letterPool: TEST_LETTERS,
    missedLimit: 2,
    projectileSpeed: 500,
    healAmount: 30,
    canvasWidth: 1000,
    canvasHeight: 600,
    letterSeed: 42,
  })
}

describe('BattleManager', () => {
  it('初始状态', () => {
    const mgr = createManager()
    expect(mgr.status).toBe(BattleStatus.Fighting)
    expect(mgr.currentWave).toBe(0)
    expect(mgr.comboCount).toBe(0)
    expect(mgr.missedCount).toBe(0)
  })

  it('update 后生成僵尸', () => {
    const mgr = createManager()
    mgr.update(1100)
    expect(mgr.zombieCount).toBeGreaterThan(0)
  })

  it('命中正确字母推进连击', () => {
    const mgr = createManager()
    mgr.update(1100)
    const letter = mgr.currentLetter
    mgr.onKeyDown(letter)
    expect(mgr.comboCount).toBe(1)
  })

  it('按错字母触发结算，打满第一棵植物后才发射弹道', () => {
    const mgr = createManager()
    mgr.update(1100)
    // 打满第一棵植物（4 段）
    for (let i = 0; i < 4; i++) mgr.onKeyDown(mgr.currentLetter)
    // 再多打一下进入第二棵，然后按错
    mgr.onKeyDown(mgr.currentLetter) // combo 5
    mgr.onKeyDown('z') // miss → 结算，P0 满了发射
    expect(mgr.comboCount).toBe(0)
    expect(mgr.projectileCount).toBeGreaterThan(0)
  })

  it('空格触发结算', () => {
    const mgr = createManager()
    mgr.update(1100)
    mgr.onKeyDown(mgr.currentLetter)
    mgr.onKeyDown(' ')
    expect(mgr.comboCount).toBe(0)
  })

  it('连击 0 时按错不触发结算', () => {
    const mgr = createManager()
    mgr.update(1100)
    mgr.onKeyDown('z')
    expect(mgr.comboCount).toBe(0)
    expect(mgr.projectileCount).toBe(0)
  })

  it('弹道命中僵尸扣血', () => {
    const mgr = createManager()
    mgr.update(1100)
    for (let i = 0; i < 4; i++) mgr.onKeyDown(mgr.currentLetter)
    mgr.onKeyDown(' ')
    for (let i = 0; i < 20; i++) mgr.update(100)
    const zombies = mgr.getZombies()
    const anyDamaged = zombies.some(z => z.currentHp < TEST_ZOMBIE.hp || z.state === ZombieState.Dead)
    expect(anyDamaged).toBe(true)
  })

  it('僵尸走出左边界增加放过计数', () => {
    const mgr = createManager()
    mgr.update(1100)
    for (let i = 0; i < 500; i++) mgr.update(100)
    expect(mgr.missedCount).toBeGreaterThan(0)
  })

  it('放过数达到上限触发失败', () => {
    const mgr = createManager()
    for (let i = 0; i < 2000; i++) mgr.update(100)
    expect(mgr.status).toBe(BattleStatus.Defeat)
  })

  it('波次间植物状态保持', () => {
    const mgr = new BattleManager({
      plants: TEST_PLANTS,
      waves: [{ count: 1, interval: 500 }, { count: 1, interval: 500 }],
      zombieConfig: TEST_ZOMBIE,
      letterPool: TEST_LETTERS,
      missedLimit: 5,
      projectileSpeed: 500,
      healAmount: 30,
      canvasWidth: 1000,
      canvasHeight: 600,
      letterSeed: 42,
    })

    for (let i = 0; i < 100; i++) {
      mgr.update(100)
      if (mgr.currentLetter) {
        mgr.onKeyDown(mgr.currentLetter)
        if (mgr.comboCount >= 4) mgr.onKeyDown(' ')
      }
    }

    const statesAfterWave1 = mgr.getPlantStates().map(p => p.currentHp)

    for (let i = 0; i < 100; i++) mgr.update(100)

    const statesWave2 = mgr.getPlantStates().map(p => p.currentHp)
    for (let i = 0; i < statesAfterWave1.length; i++) {
      expect(statesWave2[i]).toBeLessThanOrEqual(statesAfterWave1[i])
    }
  })
})
