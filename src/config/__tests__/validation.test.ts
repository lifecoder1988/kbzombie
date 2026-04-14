import { describe, it, expect } from 'vitest'
import { validateConfig } from '../validation'
import type { PlantDef, ZombieDef, StageDef, SynergyDef, BattleDef } from '../types'

const validPlants: PlantDef[] = [
  { id: 'p1', name: 'Plant1', comboSegment: 4, attackPower: 10, hp: 100, element: 'normal', trajectory: 'direct' },
  { id: 'p2', name: 'Plant2', comboSegment: 8, attackPower: 20, hp: 80, element: 'ice', trajectory: 'direct' },
]

const validZombies: Record<string, ZombieDef> = {
  normal: { id: 'normal', name: 'Normal', hp: 50, speed: 30, chewDps: 10 },
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
  areaBulletCount: 5,
  areaSpreadAngle: Math.PI / 3,
  areaDamageDecay: 1.0,
  trackingTurnRate: Math.PI,
}

describe('validateConfig', () => {
  it('合法配置返回空错误列表', () => {
    const errors = validateConfig(validPlants, validZombies, validStages, validSynergy, validBattle)
    expect(errors).toEqual([])
  })

  it('植物 id 重复报错', () => {
    const plants: PlantDef[] = [
      { id: 'dup', name: 'A', comboSegment: 4, attackPower: 10, hp: 100, element: 'normal', trajectory: 'direct' },
      { id: 'dup', name: 'B', comboSegment: 4, attackPower: 10, hp: 100, element: 'normal', trajectory: 'direct' },
    ]
    const errors = validateConfig(plants, validZombies, validStages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('dup'))).toBe(true)
  })

  it('植物 comboSegment <= 0 报错', () => {
    const plants: PlantDef[] = [
      { id: 'bad', name: 'Bad', comboSegment: 0, attackPower: 10, hp: 100, element: 'normal', trajectory: 'direct' },
    ]
    const errors = validateConfig(plants, validZombies, validStages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('comboSegment'))).toBe(true)
  })

  it('植物 hp <= 0 报错', () => {
    const plants: PlantDef[] = [
      { id: 'bad', name: 'Bad', comboSegment: 4, attackPower: 10, hp: 0, element: 'normal', trajectory: 'direct' },
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
      { id: 'bad', name: 'Bad', comboSegment: 4, attackPower: 10, hp: 100, element: 'lightning' as any, trajectory: 'direct' as any },
    ]
    const errors = validateConfig(plants, validZombies, validStages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('element'))).toBe(true)
  })

  it('植物 trajectory 非法值报错', () => {
    const plants = [
      { id: 'bad', name: 'Bad', comboSegment: 4, attackPower: 10, hp: 100, element: 'normal' as any, trajectory: 'laser' as any },
    ]
    const errors = validateConfig(plants, validZombies, validStages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('trajectory'))).toBe(true)
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

  it('areaBulletCount < 1 报错', () => {
    const battle = { ...validBattle, areaBulletCount: 0 }
    const errors = validateConfig(validPlants, validZombies, validStages, validSynergy, battle)
    expect(errors.some(e => e.includes('areaBulletCount'))).toBe(true)
  })

  it('areaSpreadAngle <= 0 报错', () => {
    const battle = { ...validBattle, areaSpreadAngle: 0 }
    const errors = validateConfig(validPlants, validZombies, validStages, validSynergy, battle)
    expect(errors.some(e => e.includes('areaSpreadAngle'))).toBe(true)
  })

  it('areaDamageDecay <= 0 报错', () => {
    const battle = { ...validBattle, areaDamageDecay: -1 }
    const errors = validateConfig(validPlants, validZombies, validStages, validSynergy, battle)
    expect(errors.some(e => e.includes('areaDamageDecay'))).toBe(true)
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
