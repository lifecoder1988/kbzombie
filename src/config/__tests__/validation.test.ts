import { describe, it, expect } from 'vitest'
import { validateConfig } from '../validation'
import type { PlantDef, ZombieDef, StageDef } from '../types'

const validPlants: PlantDef[] = [
  { id: 'p1', name: 'Plant1', comboSegment: 4, attackPower: 10, hp: 100 },
  { id: 'p2', name: 'Plant2', comboSegment: 8, attackPower: 20, hp: 80 },
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

describe('validateConfig', () => {
  it('合法配置返回空错误列表', () => {
    const errors = validateConfig(validPlants, validZombies, validStages)
    expect(errors).toEqual([])
  })

  it('植物 id 重复报错', () => {
    const plants: PlantDef[] = [
      { id: 'dup', name: 'A', comboSegment: 4, attackPower: 10, hp: 100 },
      { id: 'dup', name: 'B', comboSegment: 4, attackPower: 10, hp: 100 },
    ]
    const errors = validateConfig(plants, validZombies, validStages)
    expect(errors.some(e => e.includes('dup'))).toBe(true)
  })

  it('植物 comboSegment <= 0 报错', () => {
    const plants: PlantDef[] = [
      { id: 'bad', name: 'Bad', comboSegment: 0, attackPower: 10, hp: 100 },
    ]
    const errors = validateConfig(plants, validZombies, validStages)
    expect(errors.some(e => e.includes('comboSegment'))).toBe(true)
  })

  it('植物 hp <= 0 报错', () => {
    const plants: PlantDef[] = [
      { id: 'bad', name: 'Bad', comboSegment: 4, attackPower: 10, hp: 0 },
    ]
    const errors = validateConfig(plants, validZombies, validStages)
    expect(errors.some(e => e.includes('hp'))).toBe(true)
  })

  it('波次引用不存在的 zombieType 报错', () => {
    const stages: StageDef[] = [
      {
        id: 1, name: 'S1', letters: ['f'], plants: ['p1'],
        levels: [{ id: 1, waves: [{ zombieType: 'ghost', count: 5, interval: 3000 }] }],
      },
    ]
    const errors = validateConfig(validPlants, validZombies, stages)
    expect(errors.some(e => e.includes('ghost'))).toBe(true)
  })

  it('阶段引用不存在的植物 id 报错', () => {
    const stages: StageDef[] = [
      {
        id: 1, name: 'S1', letters: ['f'], plants: ['p1', 'nonexist'],
        levels: [{ id: 1, waves: [{ zombieType: 'normal', count: 5, interval: 3000 }] }],
      },
    ]
    const errors = validateConfig(validPlants, validZombies, stages)
    expect(errors.some(e => e.includes('nonexist'))).toBe(true)
  })

  it('波次 count <= 0 报错', () => {
    const stages: StageDef[] = [
      {
        id: 1, name: 'S1', letters: ['f'], plants: ['p1'],
        levels: [{ id: 1, waves: [{ zombieType: 'normal', count: 0, interval: 3000 }] }],
      },
    ]
    const errors = validateConfig(validPlants, validZombies, stages)
    expect(errors.some(e => e.includes('count'))).toBe(true)
  })

  it('阶段字母池为空报错', () => {
    const stages: StageDef[] = [
      {
        id: 1, name: 'S1', letters: [], plants: ['p1'],
        levels: [{ id: 1, waves: [{ zombieType: 'normal', count: 5, interval: 3000 }] }],
      },
    ]
    const errors = validateConfig(validPlants, validZombies, stages)
    expect(errors.some(e => e.includes('letters'))).toBe(true)
  })
})
