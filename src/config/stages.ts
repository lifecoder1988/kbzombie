import type { StageDef } from './types'

export const STAGES: readonly StageDef[] = [
  {
    id: 1,
    name: '基准键练习',
    letters: ['f', 'j', 'd', 'k', 's', 'l', 'a'],
    plants: ['peashooter', 'snow_pea', 'repeater'],
    levels: [
      {
        id: 1,
        laneCount: 1,
        waves: [
          { zombieType: 'normal', count: 5, interval: 3000 },
          { zombieType: 'normal', count: 7, interval: 2500 },
          { zombieType: 'normal', count: 10, interval: 2000 },
        ],
      },
      {
        id: 2,
        laneCount: 1,
        waves: [
          { zombieType: 'normal', count: 8, interval: 2000 },
          { zombieType: 'normal', count: 12, interval: 1500 },
          { zombieType: 'normal', count: 15, interval: 1200 },
        ],
      },
    ],
  },
  {
    id: 2,
    name: '弹道演示',
    letters: ['f', 'j', 'd', 'k', 's', 'l', 'a'],
    plants: ['cactus'],
    levels: [
      {
        id: 1,
        laneCount: 1,
        waves: [
          { zombieType: 'fat', count: 8, interval: 800 },
        ],
      },
    ],
  },
  {
    id: 3,
    name: '弹道演示-辐射',
    letters: ['f', 'j', 'd', 'k', 's', 'l', 'a'],
    plants: ['fume_shroom'],
    levels: [
      {
        id: 1,
        laneCount: 1,
        waves: [
          { zombieType: 'fat', count: 10, interval: 600 },
        ],
      },
    ],
  },
  {
    id: 4,
    name: '弹道演示-追踪',
    letters: ['f', 'j', 'd', 'k', 's', 'l', 'a'],
    plants: ['cattail'],
    levels: [
      {
        id: 1,
        laneCount: 1,
        waves: [
          { zombieType: 'normal', count: 8, interval: 1000 },
        ],
      },
    ],
  },
  {
    id: 5,
    name: '2路演示',
    letters: ['f', 'j', 'd', 'k', 's', 'l', 'a'],
    plants: ['peashooter', 'snow_pea'],
    levels: [
      {
        id: 1,
        laneCount: 2,
        waves: [
          { zombieType: 'normal', count: 8, interval: 2000 },
          { zombieType: 'normal', count: 10, interval: 1500 },
        ],
      },
    ],
  },
  {
    id: 6,
    name: '3路演示-跨路攻击',
    letters: ['f', 'j', 'd', 'k', 's', 'l', 'a'],
    plants: ['fume_shroom', 'cattail'],
    levels: [
      {
        id: 1,
        laneCount: 3,
        lanePlants: [
          ['peashooter', 'fume_shroom'],
          ['peashooter', 'cattail', 'fume_shroom'],
          [],
        ],
        waves: [
          { zombieType: 'fat', count: 12, interval: 1200 },
        ],
      },
    ],
  },
  {
    id: 7,
    name: '僵尸类型演示-肉盾',
    letters: ['f', 'j', 'd', 'k', 's', 'l', 'a'],
    plants: ['peashooter', 'snow_pea', 'repeater'],
    levels: [
      {
        id: 1,
        laneCount: 1,
        waves: [
          { count: 5, interval: 2000, zombies: [
            { type: 'normal', weight: 2 },
            { type: 'conehead', weight: 1 },
          ]},
          { count: 5, interval: 1500, zombies: [
            { type: 'conehead', weight: 2 },
            { type: 'fat', weight: 1 },
          ]},
        ],
      },
    ],
  },
  {
    id: 8,
    name: '僵尸类型演示-混合冲锋',
    letters: ['f', 'j', 'd', 'k', 's', 'l', 'a'],
    plants: ['peashooter', 'snow_pea', 'cactus'],
    levels: [
      {
        id: 1,
        laneCount: 2,
        waves: [
          { count: 8, interval: 1500, zombies: [
            { type: 'normal', weight: 3 },
            { type: 'flag', weight: 1 },
            { type: 'imp', weight: 1 },
          ]},
          { count: 10, interval: 1000, zombies: [
            { type: 'normal', weight: 2 },
            { type: 'conehead', weight: 2 },
            { type: 'flag', weight: 2 },
            { type: 'imp', weight: 1 },
            { type: 'fat', weight: 1 },
          ]},
        ],
      },
    ],
  },
]
