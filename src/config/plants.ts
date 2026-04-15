import type { PlantDef } from './types'

export const PLANT_DEFS: readonly PlantDef[] = [
  { id: 'peashooter',      name: '豌豆射手',  comboSegment: 4,  attackPower: 10, hp: 100, element: 'normal',    spread: 'single', flight: 'straight', impact: 'vanish' },
  { id: 'snow_pea',        name: '寒冰射手',  comboSegment: 4,  attackPower: 8,  hp: 100, element: 'ice',       spread: 'single', flight: 'straight', impact: 'vanish' },
  { id: 'repeater',        name: '双发射手',  comboSegment: 4,  attackPower: 18, hp: 100, element: 'normal',    spread: 'burst',  flight: 'straight', impact: 'vanish' },
  { id: 'torchwood',       name: '火炬树桩',  comboSegment: 8,  attackPower: 25, hp: 120, element: 'fire',      spread: 'single', flight: 'straight', impact: 'vanish' },
  { id: 'cactus',          name: '仙人掌',    comboSegment: 4,  attackPower: 12, hp: 100, element: 'normal',    spread: 'single', flight: 'straight', impact: 'pierce' },
  { id: 'lightning_reed',  name: '闪电芦苇',  comboSegment: 4,  attackPower: 10, hp: 80,  element: 'electric',  spread: 'single', flight: 'straight', impact: 'vanish' },
  { id: 'kernel_pult',     name: '玉米投手',  comboSegment: 8,  attackPower: 20, hp: 120, element: 'stun',      spread: 'single', flight: 'straight', impact: 'explode' },
  { id: 'fume_shroom',     name: '大喷菇',    comboSegment: 16, attackPower: 30, hp: 150, element: 'normal',    spread: 'fan',    flight: 'straight', impact: 'vanish' },
  { id: 'cattail',         name: '猫尾草',    comboSegment: 8,  attackPower: 15, hp: 100, element: 'normal',    spread: 'single', flight: 'tracking', impact: 'chain' },
  { id: 'hurricane_flower',name: '飓风花',    comboSegment: 8,  attackPower: 15, hp: 120, element: 'knockback', spread: 'single', flight: 'straight', impact: 'vanish' },
  { id: 'melon_pult',      name: '西瓜投手',  comboSegment: 12, attackPower: 35, hp: 150, element: 'normal',    spread: 'single', flight: 'straight', impact: 'explode' },
  { id: 'starfruit',       name: '星星果',    comboSegment: 12, attackPower: 20, hp: 100, element: 'electric',  spread: 'fan',    flight: 'tracking', impact: 'vanish' },
]

/** 按 ID 索引的植物定义 Map */
export const PLANT_MAP: Readonly<Record<string, PlantDef>> = Object.fromEntries(
  PLANT_DEFS.map(p => [p.id, p])
) as Record<string, PlantDef>
