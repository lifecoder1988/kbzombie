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
        waves: [
          { zombieType: 'normal', count: 5, interval: 3000 },
          { zombieType: 'normal', count: 7, interval: 2500 },
          { zombieType: 'normal', count: 10, interval: 2000 },
        ],
      },
      {
        id: 2,
        waves: [
          { zombieType: 'normal', count: 8, interval: 2000 },
          { zombieType: 'normal', count: 12, interval: 1500 },
          { zombieType: 'normal', count: 15, interval: 1200 },
        ],
      },
    ],
  },
]
