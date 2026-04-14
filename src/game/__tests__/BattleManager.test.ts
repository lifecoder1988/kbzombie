import { describe, it, expect } from 'vitest'
import { BattleManager, type BattleConfig } from '../BattleManager'
import { BattleStatus, ZombieState } from '../types'
import type { WaveConfig, PlantConfig } from '../types'

const DEFAULT_EFFECT_PARAMS = {
  burst: { burstCount: 3, burstInterval: 80 },
  fan: { fanBulletCount: 5, fanSpreadAngle: Math.PI / 3 },
  tracking: { trackingTurnRate: Math.PI },
  chain: { chainBounces: 3, chainRange: 200 },
  explode: { explodeRadius: 80, explodeDamageRatio: 0.6 },
  ice: { slowRatio: 0.5, slowDuration: 3 },
  fire: { burnDps: 5, burnDuration: 3 },
  electric: { conductRadius: 100, conductDamageDecay: 0.7, conductMaxJumps: 3 },
  stun: { stunDuration: 1.5 },
  knockback: { knockbackDistance: 60 },
}

const TEST_PLANTS: PlantConfig[] = [
  { id: 'peashooter', name: '豌豆射手', comboSegment: 4, attackPower: 20, hp: 100, element: 'normal', spread: 'single', flight: 'straight', impact: 'vanish' },
  { id: 'snow_pea', name: '寒冰射手', comboSegment: 4, attackPower: 15, hp: 80, element: 'ice', spread: 'single', flight: 'straight', impact: 'vanish' },
]

const TEST_WAVES: WaveConfig[] = [
  { zombieType: 'normal', count: 3, interval: 1000 },
]

const TEST_ZOMBIE = { hp: 50, speed: 30, chewDps: 10, width: 40, height: 60, color: '#44cc44' }
const TEST_LETTERS = ['f', 'j', 'd', 'k']

function createManager(overrides?: Partial<BattleConfig>) {
  return new BattleManager({
    laneCount: 1,
    lanePlants: [TEST_PLANTS],
    waves: TEST_WAVES,
    zombieConfigs: { normal: TEST_ZOMBIE },
    letterPool: TEST_LETTERS,
    missedLimit: 2,
    projectileSpeed: 500,
    healAmount: 30,
    wavePauseDuration: 3000,
    canvasWidth: 1000,
    canvasHeight: 600,
    letterSeed: 42,
    synergyMultiplier: { 1: 1.0, 2: 1.2, 3: 1.5 },
    effectParams: DEFAULT_EFFECT_PARAMS,
    ...overrides,
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
    // In free match mode, press the first lane's letter to lock on
    const letter = mgr.getLane(0).currentLetter
    mgr.onKeyDown(letter)
    expect(mgr.comboCount).toBe(1)
  })

  it('按错字母触发结算，打满第一棵植物后才发射弹道', () => {
    const mgr = createManager()
    mgr.update(1100)
    // Lock on and hit 4 letters (first plant full)
    for (let i = 0; i < 4; i++) {
      const letter = mgr.currentLane !== null ? mgr.currentLetter : mgr.getLane(0).currentLetter
      mgr.onKeyDown(letter)
    }
    // Hit one more (into second plant), then miss
    const nextLetter = mgr.currentLetter
    mgr.onKeyDown(nextLetter) // combo 5
    mgr.onKeyDown('z') // miss -> settle, P0 fires
    expect(mgr.comboCount).toBe(0)
    expect(mgr.projectileCount).toBeGreaterThan(0)
  })

  it('空格触发结算', () => {
    const mgr = createManager()
    mgr.update(1100)
    const letter = mgr.getLane(0).currentLetter
    mgr.onKeyDown(letter)
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
    for (let i = 0; i < 4; i++) {
      const letter = mgr.currentLane !== null ? mgr.currentLetter : mgr.getLane(0).currentLetter
      mgr.onKeyDown(letter)
    }
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
      laneCount: 1,
      lanePlants: [TEST_PLANTS],
      waves: [{ zombieType: 'normal', count: 1, interval: 500 }, { zombieType: 'normal', count: 1, interval: 500 }],
      zombieConfigs: { normal: TEST_ZOMBIE },
      letterPool: TEST_LETTERS,
      missedLimit: 5,
      projectileSpeed: 500,
      healAmount: 30,
      wavePauseDuration: 3000,
      canvasWidth: 1000,
      canvasHeight: 600,
      letterSeed: 42,
      synergyMultiplier: { 1: 1.0, 2: 1.2, 3: 1.5 },
      effectParams: DEFAULT_EFFECT_PARAMS,
    })

    for (let i = 0; i < 100; i++) {
      mgr.update(100)
      const lane = mgr.getLane(0)
      if (lane.currentLetter) {
        const letter = mgr.currentLane !== null ? mgr.currentLetter : lane.currentLetter
        mgr.onKeyDown(letter)
        if (mgr.comboCount >= 4) mgr.onKeyDown(' ')
      }
    }

    const statesAfterWave1 = mgr.getPlantStates(0).map(p => p.currentHp)

    for (let i = 0; i < 100; i++) mgr.update(100)

    const statesWave2 = mgr.getPlantStates(0).map(p => p.currentHp)
    for (let i = 0; i < statesAfterWave1.length; i++) {
      expect(statesWave2[i]).toBeLessThanOrEqual(statesAfterWave1[i])
    }
  })

  it('协同倍率从 config 注入生效', () => {
    const mgr = createManager()
    mgr.update(1100)
    // 打满两棵植物（4+4=8段）自动触发结算
    for (let i = 0; i < 8; i++) {
      const letter = mgr.currentLane !== null ? mgr.currentLetter : mgr.getLane(0).currentLetter
      mgr.onKeyDown(letter)
    }
    // 2棵植物 -> 2 颗弹道
    expect(mgr.projectileCount).toBe(2)
  })

  it('fan 弹道创建 fanBulletCount 颗子弹（奇数）', () => {
    const fanPlants: PlantConfig[] = [
      { id: 'fan_plant', name: '大喷菇', comboSegment: 4, attackPower: 20, hp: 100, element: 'normal', spread: 'fan', flight: 'straight', impact: 'vanish' },
    ]
    const mgr = createManager({
      lanePlants: [fanPlants],
      effectParams: { ...DEFAULT_EFFECT_PARAMS, fan: { fanBulletCount: 3, fanSpreadAngle: Math.PI / 3 } },
    })
    mgr.update(1100)
    for (let i = 0; i < 4; i++) {
      const letter = mgr.currentLane !== null ? mgr.currentLetter : mgr.getLane(0).currentLetter
      mgr.onKeyDown(letter)
    }
    expect(mgr.projectileCount).toBe(3)
  })

  it('fan 弹道偶数颗子弹也能正确创建', () => {
    const fanPlants: PlantConfig[] = [
      { id: 'fan_plant', name: '大喷菇', comboSegment: 4, attackPower: 20, hp: 100, element: 'normal', spread: 'fan', flight: 'straight', impact: 'vanish' },
    ]
    const mgr = createManager({
      lanePlants: [fanPlants],
      effectParams: { ...DEFAULT_EFFECT_PARAMS, fan: { fanBulletCount: 4, fanSpreadAngle: Math.PI / 3 } },
    })
    mgr.update(1100)
    for (let i = 0; i < 4; i++) {
      const letter = mgr.currentLane !== null ? mgr.currentLetter : mgr.getLane(0).currentLetter
      mgr.onKeyDown(letter)
    }
    expect(mgr.projectileCount).toBe(4)
  })

  it('pierce 弹道命中后继续飞行可命中下一只僵尸', () => {
    const highHpZombie = { hp: 200, speed: 30, chewDps: 10, width: 40, height: 60, color: '#44cc44' }
    const piercePlants: PlantConfig[] = [
      { id: 'pierce_plant', name: '穿透', comboSegment: 4, attackPower: 50, hp: 100, element: 'normal', spread: 'single', flight: 'straight', impact: 'pierce' },
    ]
    const waves: WaveConfig[] = [{ zombieType: 'tank', count: 3, interval: 200 }]
    const mgr = createManager({ lanePlants: [piercePlants], waves, zombieConfigs: { tank: highHpZombie } })
    mgr.update(800)
    expect(mgr.zombieCount).toBe(3)
    for (let i = 0; i < 4; i++) {
      const letter = mgr.currentLane !== null ? mgr.currentLetter : mgr.getLane(0).currentLetter
      mgr.onKeyDown(letter)
    }
    expect(mgr.projectileCount).toBeGreaterThan(0)
    for (let i = 0; i < 200; i++) mgr.update(16)
    const zombies = mgr.getZombies()
    const damagedCount = zombies.filter(z => z.currentHp < 200).length
    expect(damagedCount).toBeGreaterThanOrEqual(2)
  })
})

// === Multi-lane tests ===

const LANE0_PLANTS: PlantConfig[] = [
  { id: 'a', name: 'A', comboSegment: 4, attackPower: 10, hp: 100, element: 'normal', spread: 'single', flight: 'straight', impact: 'vanish' },
]
const LANE1_PLANTS: PlantConfig[] = [
  { id: 'b', name: 'B', comboSegment: 4, attackPower: 15, hp: 80, element: 'ice', spread: 'single', flight: 'straight', impact: 'vanish' },
]

function create2LaneManager(overrides?: Partial<BattleConfig>) {
  return createManager({
    laneCount: 2,
    lanePlants: [LANE0_PLANTS, LANE1_PLANTS],
    ...overrides,
  })
}

describe('多路输入路由', () => {
  it('初始无当前路', () => {
    const mgr = create2LaneManager()
    expect(mgr.currentLane).toBeNull()
  })

  it('自由匹配：按字母锁定到匹配路', () => {
    const mgr = create2LaneManager()
    mgr.update(1100)
    const lane0Letter = mgr.getLane(0).currentLetter
    mgr.onKeyDown(lane0Letter)
    expect(mgr.currentLane).toBe(0)
  })

  it('锁定状态：按当前路字母推进', () => {
    const mgr = create2LaneManager()
    mgr.update(1100)
    const lane0Letter = mgr.getLane(0).currentLetter
    mgr.onKeyDown(lane0Letter)
    expect(mgr.currentLane).toBe(0)
    expect(mgr.comboCount).toBe(1)
    // Press next letter of lane 0
    const nextLetter = mgr.currentLetter
    mgr.onKeyDown(nextLetter)
    expect(mgr.currentLane).toBe(0)
    expect(mgr.comboCount).toBe(2)
  })

  it('锁定状态：按错触发当前路结算并解锁', () => {
    const mgr = create2LaneManager()
    mgr.update(1100)
    const lane0Letter = mgr.getLane(0).currentLetter
    mgr.onKeyDown(lane0Letter)
    expect(mgr.currentLane).toBe(0)
    mgr.onKeyDown('z')
    expect(mgr.currentLane).toBeNull()
    expect(mgr.comboCount).toBe(0)
  })

  it('空格结算当前路并解锁', () => {
    const mgr = create2LaneManager()
    mgr.update(1100)
    const lane0Letter = mgr.getLane(0).currentLetter
    mgr.onKeyDown(lane0Letter)
    expect(mgr.currentLane).toBe(0)
    mgr.onKeyDown(' ')
    expect(mgr.currentLane).toBeNull()
    expect(mgr.comboCount).toBe(0)
  })

  it('无当前路时按不匹配字母忽略', () => {
    const mgr = create2LaneManager()
    mgr.update(1100)
    // Press a letter that doesn't match either lane's current letter
    const lane0Letter = mgr.getLane(0).currentLetter
    const lane1Letter = mgr.getLane(1).currentLetter
    const allLetters = 'abcdefghijklmnopqrstuvwxyz'
    let unmatchedLetter = 'z'
    for (const ch of allLetters) {
      if (ch !== lane0Letter && ch !== lane1Letter) {
        unmatchedLetter = ch
        break
      }
    }
    mgr.onKeyDown(unmatchedLetter)
    expect(mgr.currentLane).toBeNull()
    expect(mgr.comboCount).toBe(0)
  })

  it('各路首字母不重复', () => {
    const mgr = create2LaneManager()
    const lane0Letter = mgr.getLane(0).currentLetter
    const lane1Letter = mgr.getLane(1).currentLetter
    expect(lane0Letter).not.toBe(lane1Letter)
  })

  it('结算后重新生成字母不冲突', () => {
    const mgr = create2LaneManager()
    mgr.update(1100)
    // Lock on lane 0 and hit, then settle
    const lane0Letter = mgr.getLane(0).currentLetter
    mgr.onKeyDown(lane0Letter)
    mgr.onKeyDown(' ')
    // After settlement, lane 0 letters regenerated, first letters should differ
    const newLane0Letter = mgr.getLane(0).currentLetter
    const lane1Letter = mgr.getLane(1).currentLetter
    expect(newLane0Letter).not.toBe(lane1Letter)
  })

  it('打满当前路自动结算并解锁', () => {
    const mgr = create2LaneManager()
    mgr.update(1100)
    // Lane 0 has 4 segments, hit all 4
    for (let i = 0; i < 4; i++) {
      const letter = mgr.currentLane !== null ? mgr.currentLetter : mgr.getLane(0).currentLetter
      mgr.onKeyDown(letter)
    }
    // Full chain auto-settles and unlocks
    expect(mgr.currentLane).toBeNull()
    expect(mgr.comboCount).toBe(0)
    expect(mgr.projectileCount).toBeGreaterThan(0)
  })
})

describe('多路僵尸', () => {
  it('僵尸在其所属路的 Y 坐标', () => {
    const mgr = create2LaneManager()
    // Spawn several zombies and verify they are at lane Y positions
    for (let i = 0; i < 20; i++) mgr.update(200)
    const zombies = mgr.getZombies()
    expect(zombies.length).toBeGreaterThan(0)
    const lane0Y = mgr.getLane(0).laneY
    const lane1Y = mgr.getLane(1).laneY
    for (const z of zombies) {
      expect(z.y === lane0Y || z.y === lane1Y).toBe(true)
    }
  })

  it('僵尸只啃自己路的植物', () => {
    // Use 1 zombie in wave so we can track precisely
    const mgr = create2LaneManager({
      waves: [{ zombieType: 'normal', count: 1, interval: 500 }],
    })
    // Let zombie spawn and reach plant
    for (let i = 0; i < 500; i++) mgr.update(100)
    // Check which lane the zombie is in
    const zombies = mgr.getZombies()
    if (zombies.length > 0) {
      const z = zombies[0]
      const zombieLane = mgr.getZombieLane(z.id)
      const otherLane = zombieLane === 0 ? 1 : 0
      // The other lane's plants should be undamaged
      const otherPlants = mgr.getPlantStates(otherLane)
      for (const p of otherPlants) {
        expect(p.currentHp).toBe(p.config.hp)
      }
    }
  })
})

describe('多路波次完成', () => {
  it('波次完成时所有路连击归零并解锁', () => {
    // Use a single very weak zombie that dies quickly
    const weakZombie = { hp: 1, speed: 30, chewDps: 0, width: 40, height: 60, color: '#44cc44' }
    const mgr = create2LaneManager({
      waves: [{ zombieType: 'weak', count: 1, interval: 100 }],
      zombieConfigs: { normal: TEST_ZOMBIE, weak: weakZombie },
    })
    mgr.update(200) // spawn zombie
    mgr.update(16) // flush
    // Lock on lane 0 and hit once
    const letter = mgr.getLane(0).currentLetter
    mgr.onKeyDown(letter)
    expect(mgr.currentLane).toBe(0)
    expect(mgr.comboCount).toBe(1)
    // Settle
    mgr.onKeyDown(' ')

    // Kill zombie by projectile
    for (let i = 0; i < 200; i++) mgr.update(16)

    // If wave completed, should be in WavePause or Victory
    // With 1 wave and zombie killed, should be Victory
    if (mgr.status === BattleStatus.Victory || mgr.status === BattleStatus.WavePause) {
      expect(mgr.currentLane).toBeNull()
      expect(mgr.getLane(0).comboCount).toBe(0)
      expect(mgr.getLane(1).comboCount).toBe(0)
    }
  })
})
