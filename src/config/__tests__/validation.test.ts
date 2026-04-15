import { describe, it, expect } from 'vitest'
import { validateConfig } from '../validation'
import type { PlantDef, ZombieDef, StageDef, SynergyDef, BattleDef } from '../types'

const validPlants: PlantDef[] = [
  { id: 'p1', name: 'Plant1', comboSegment: 4, attackPower: 10, hp: 100, element: 'normal', spread: 'single', flight: 'straight', impact: 'vanish' },
  { id: 'p2', name: 'Plant2', comboSegment: 8, attackPower: 20, hp: 80, element: 'ice', spread: 'single', flight: 'straight', impact: 'vanish' },
]

const validZombies: Record<string, ZombieDef> = {
  normal: { id: 'normal', name: 'Normal', hp: 50, speed: 30, chewDps: 10, width: 40, height: 60, color: '#44cc44' },
}

const validStages: StageDef[] = [
  {
    id: 1,
    name: 'Stage 1',
    letters: ['f', 'j'],
    plants: ['p1', 'p2'],
    levels: [
      {
        id: 1,
        waves: [{ zombieType: 'normal', count: 5, interval: 3000 }],
      },
    ],
  },
]

const validSynergy: SynergyDef = {
  multiplier: { 1: 1.0, 2: 1.2, 3: 1.5 },
}

const validBattle: BattleDef = {
  projectileSpeed: 500,
  healAmount: 30,
  wavePauseDuration: 3000,
  effectParams: {
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
  },
}

describe('validateConfig', () => {
  it('合法配置返回空错误列表', () => {
    const errors = validateConfig(validPlants, validZombies, validStages, validSynergy, validBattle)
    expect(errors).toEqual([])
  })

  it('植物 id 重复报错', () => {
    const plants: PlantDef[] = [
      { id: 'dup', name: 'A', comboSegment: 4, attackPower: 10, hp: 100, element: 'normal', spread: 'single', flight: 'straight', impact: 'vanish' },
      { id: 'dup', name: 'B', comboSegment: 4, attackPower: 10, hp: 100, element: 'normal', spread: 'single', flight: 'straight', impact: 'vanish' },
    ]
    const errors = validateConfig(plants, validZombies, validStages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('dup'))).toBe(true)
  })

  it('植物 comboSegment <= 0 报错', () => {
    const plants: PlantDef[] = [
      { id: 'bad', name: 'Bad', comboSegment: 0, attackPower: 10, hp: 100, element: 'normal', spread: 'single', flight: 'straight', impact: 'vanish' },
    ]
    const errors = validateConfig(plants, validZombies, validStages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('comboSegment'))).toBe(true)
  })

  it('植物 hp <= 0 报错', () => {
    const plants: PlantDef[] = [
      { id: 'bad', name: 'Bad', comboSegment: 4, attackPower: 10, hp: 0, element: 'normal', spread: 'single', flight: 'straight', impact: 'vanish' },
    ]
    const errors = validateConfig(plants, validZombies, validStages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('hp'))).toBe(true)
  })

  it('波次引用不存在的 zombieType 报错', () => {
    const stages: StageDef[] = [
      {
        id: 1, name: 'S1', letters: ['f'], plants: ['p1'],
        levels: [{ id: 1, waves: [{ zombieType: 'ghost', count: 5, interval: 3000 }] }],
      },
    ]
    const errors = validateConfig(validPlants, validZombies, stages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('ghost'))).toBe(true)
  })

  it('阶段引用不存在的植物 id 报错', () => {
    const stages: StageDef[] = [
      {
        id: 1, name: 'S1', letters: ['f'], plants: ['p1', 'nonexist'],
        levels: [{ id: 1, waves: [{ zombieType: 'normal', count: 5, interval: 3000 }] }],
      },
    ]
    const errors = validateConfig(validPlants, validZombies, stages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('nonexist'))).toBe(true)
  })

  it('波次 count <= 0 报错', () => {
    const stages: StageDef[] = [
      {
        id: 1, name: 'S1', letters: ['f'], plants: ['p1'],
        levels: [{ id: 1, waves: [{ zombieType: 'normal', count: 0, interval: 3000 }] }],
      },
    ]
    const errors = validateConfig(validPlants, validZombies, stages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('count'))).toBe(true)
  })

  it('阶段字母池为空报错', () => {
    const stages: StageDef[] = [
      {
        id: 1, name: 'S1', letters: [], plants: ['p1'],
        levels: [{ id: 1, waves: [{ zombieType: 'normal', count: 5, interval: 3000 }] }],
      },
    ]
    const errors = validateConfig(validPlants, validZombies, stages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('letters'))).toBe(true)
  })

  it('植物 element 非法值报错', () => {
    const plants = [
      { id: 'bad', name: 'Bad', comboSegment: 4, attackPower: 10, hp: 100, element: 'lightning' as any, spread: 'single' as any, flight: 'straight' as any, impact: 'vanish' as any },
    ]
    const errors = validateConfig(plants, validZombies, validStages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('element'))).toBe(true)
  })

  it('植物 spread 非法值报错', () => {
    const plants = [
      { id: 'bad', name: 'Bad', comboSegment: 4, attackPower: 10, hp: 100, element: 'normal' as any, spread: 'laser' as any, flight: 'straight' as any, impact: 'vanish' as any },
    ]
    const errors = validateConfig(plants, validZombies, validStages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('spread'))).toBe(true)
  })

  it('植物 flight 非法值报错', () => {
    const plants = [
      { id: 'bad', name: 'Bad', comboSegment: 4, attackPower: 10, hp: 100, element: 'normal' as any, spread: 'single' as any, flight: 'laser' as any, impact: 'vanish' as any },
    ]
    const errors = validateConfig(plants, validZombies, validStages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('flight'))).toBe(true)
  })

  it('植物 impact 非法值报错', () => {
    const plants = [
      { id: 'bad', name: 'Bad', comboSegment: 4, attackPower: 10, hp: 100, element: 'normal' as any, spread: 'single' as any, flight: 'straight' as any, impact: 'laser' as any },
    ]
    const errors = validateConfig(plants, validZombies, validStages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('impact'))).toBe(true)
  })

  it('synergy multiplier 缺少 key=1 报错', () => {
    const synergy: SynergyDef = { multiplier: { 2: 1.2 } }
    const errors = validateConfig(validPlants, validZombies, validStages, synergy, validBattle)
    expect(errors.some(e => e.includes('multiplier'))).toBe(true)
  })

  it('synergy multiplier key=1 的值不为 1.0 报错', () => {
    const synergy: SynergyDef = { multiplier: { 1: 1.5 } }
    const errors = validateConfig(validPlants, validZombies, validStages, synergy, validBattle)
    expect(errors.some(e => e.includes('1.0'))).toBe(true)
  })

  it('effectParams.fan.fanBulletCount < 1 报错', () => {
    const battle = {
      ...validBattle,
      effectParams: { ...validBattle.effectParams, fan: { fanBulletCount: 0, fanSpreadAngle: Math.PI / 3 } },
    }
    const errors = validateConfig(validPlants, validZombies, validStages, validSynergy, battle)
    expect(errors.some(e => e.includes('fanBulletCount'))).toBe(true)
  })

  it('effectParams.fan.fanSpreadAngle <= 0 报错', () => {
    const battle = {
      ...validBattle,
      effectParams: { ...validBattle.effectParams, fan: { fanBulletCount: 5, fanSpreadAngle: 0 } },
    }
    const errors = validateConfig(validPlants, validZombies, validStages, validSynergy, battle)
    expect(errors.some(e => e.includes('fanSpreadAngle'))).toBe(true)
  })

  it('effectParams.explode.explodeDamageRatio <= 0 报错', () => {
    const battle = {
      ...validBattle,
      effectParams: { ...validBattle.effectParams, explode: { explodeRadius: 80, explodeDamageRatio: -1 } },
    }
    const errors = validateConfig(validPlants, validZombies, validStages, validSynergy, battle)
    expect(errors.some(e => e.includes('explodeDamageRatio'))).toBe(true)
  })

  it('波次 zombies 数组引用不存在的 type 报错', () => {
    const stages: StageDef[] = [
      {
        id: 1, name: 'S1', letters: ['f'], plants: ['p1'],
        levels: [{ id: 1, waves: [{ count: 5, interval: 3000, zombies: [{ type: 'ghost', weight: 1 }] }] }],
      },
    ]
    const errors = validateConfig(validPlants, validZombies, stages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('ghost'))).toBe(true)
  })

  it('波次 zombies 数组 weight <= 0 报错', () => {
    const stages: StageDef[] = [
      {
        id: 1, name: 'S1', letters: ['f'], plants: ['p1'],
        levels: [{ id: 1, waves: [{ count: 5, interval: 3000, zombies: [{ type: 'normal', weight: 0 }] }] }],
      },
    ]
    const errors = validateConfig(validPlants, validZombies, stages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('weight'))).toBe(true)
  })

  it('波次 zombieType 和 zombies 都未提供报错', () => {
    const stages: StageDef[] = [
      {
        id: 1, name: 'S1', letters: ['f'], plants: ['p1'],
        levels: [{ id: 1, waves: [{ count: 5, interval: 3000 } as any] }],
      },
    ]
    const errors = validateConfig(validPlants, validZombies, stages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('zombieType') || e.includes('zombies'))).toBe(true)
  })

  it('波次 zombies 数组合法时不报错', () => {
    const stages: StageDef[] = [
      {
        id: 1, name: 'S1', letters: ['f'], plants: ['p1'],
        levels: [{ id: 1, waves: [{ count: 5, interval: 3000, zombies: [{ type: 'normal', weight: 1 }] }] }],
      },
    ]
    const errors = validateConfig(validPlants, validZombies, stages, validSynergy, validBattle)
    expect(errors).toEqual([])
  })
})

describe('rewards validation', () => {
  it('rewards.unlockPlants 引用不存在的植物报错', () => {
    const stages: StageDef[] = [{
      id: 1, name: 'test', letters: ['f'], plants: ['p1'],
      levels: [{
        id: 1,
        waves: [{ count: 1, interval: 1000, zombieType: 'normal' }],
        rewards: { unlockPlants: ['nonexistent_plant'] },
      }],
    }]
    const errors = validateConfig(validPlants, validZombies, stages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('nonexistent_plant'))).toBe(true)
  })

  it('rewards.slotIncrease <= 0 报错', () => {
    const stages: StageDef[] = [{
      id: 1, name: 'test', letters: ['f'], plants: ['p1'],
      levels: [{
        id: 1,
        waves: [{ count: 1, interval: 1000, zombieType: 'normal' }],
        rewards: { slotIncrease: 0 },
      }],
    }]
    const errors = validateConfig(validPlants, validZombies, stages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('slotIncrease'))).toBe(true)
  })

  it('合法 rewards 不报错', () => {
    const stages: StageDef[] = [{
      id: 1, name: 'test', letters: ['f'], plants: ['p1'],
      levels: [{
        id: 1,
        waves: [{ count: 1, interval: 1000, zombieType: 'normal' }],
        rewards: { unlockPlants: ['p1'], slotIncrease: 4 },
      }],
    }]
    const errors = validateConfig(validPlants, validZombies, stages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('rewards'))).toBe(false)
    expect(errors.some(e => e.includes('slotIncrease'))).toBe(false)
  })
})

describe('laneCount 校验', () => {
  const makeStageWithLevel = (levelOverride: object): StageDef[] => [
    {
      id: 1,
      name: 'Stage 1',
      letters: ['f', 'j'],
      plants: ['p1', 'p2'],
      levels: [
        {
          id: 1,
          waves: [{ zombieType: 'normal', count: 5, interval: 3000 }],
          ...levelOverride,
        },
      ],
    },
  ]

  it('laneCount 为 0 报错', () => {
    const stages = makeStageWithLevel({ laneCount: 0 })
    const errors = validateConfig(validPlants, validZombies, stages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('laneCount'))).toBe(true)
  })

  it('laneCount 为 4 报错', () => {
    const stages = makeStageWithLevel({ laneCount: 4 })
    const errors = validateConfig(validPlants, validZombies, stages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('laneCount'))).toBe(true)
  })

  it('lanePlants 长度不等于 laneCount 报错', () => {
    const stages = makeStageWithLevel({ laneCount: 2, lanePlants: [['p1']] })
    const errors = validateConfig(validPlants, validZombies, stages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('lanePlants'))).toBe(true)
  })

  it('lanePlants 引用不存在的植物 ID 报错', () => {
    const stages = makeStageWithLevel({ laneCount: 1, lanePlants: [['nonexist']] })
    const errors = validateConfig(validPlants, validZombies, stages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('nonexist'))).toBe(true)
  })

  it('lanePlants 空数组允许（空路）', () => {
    const stages = makeStageWithLevel({ laneCount: 2, lanePlants: [[], ['p1']] })
    const errors = validateConfig(validPlants, validZombies, stages, validSynergy, validBattle)
    expect(errors).toEqual([])
  })

  it('不填 laneCount 不报错（默认 1）', () => {
    const stages = makeStageWithLevel({})
    const errors = validateConfig(validPlants, validZombies, stages, validSynergy, validBattle)
    expect(errors).toEqual([])
  })
})
