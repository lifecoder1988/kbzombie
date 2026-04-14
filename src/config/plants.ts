import type { PlantDef } from './types'

export const PLANT_DEFS: readonly PlantDef[] = [
  { id: 'peashooter', name: '豌豆射手', comboSegment: 4, attackPower: 20, hp: 100, element: 'normal', trajectory: 'direct' },
  { id: 'snow_pea',   name: '寒冰射手', comboSegment: 4, attackPower: 15, hp: 80,  element: 'ice',    trajectory: 'direct' },
  { id: 'repeater',   name: '双发射手', comboSegment: 8, attackPower: 35, hp: 120, element: 'normal', trajectory: 'direct' },
]
