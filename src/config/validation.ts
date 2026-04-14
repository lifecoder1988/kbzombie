import type { PlantDef, ZombieDef, StageDef, SynergyDef, BattleDef } from './types'

const VALID_ELEMENTS = new Set(['normal', 'ice', 'fire'])
const VALID_TRAJECTORIES = new Set(['direct', 'tracking', 'pierce', 'area'])

export function validateConfig(
  plants: readonly PlantDef[],
  zombies: Readonly<Record<string, ZombieDef>>,
  stages: readonly StageDef[],
  synergy: SynergyDef,
  battle: BattleDef,
): string[] {
  const errors: string[] = []
  const plantIds = new Set<string>()

  for (const p of plants) {
    if (plantIds.has(p.id)) {
      errors.push(`植物 id 重复: "${p.id}"`)
    }
    plantIds.add(p.id)
    if (p.comboSegment <= 0) {
      errors.push(`植物 "${p.id}" comboSegment 必须 > 0，当前: ${p.comboSegment}`)
    }
    if (p.hp <= 0) {
      errors.push(`植物 "${p.id}" hp 必须 > 0，当前: ${p.hp}`)
    }
    if (!VALID_ELEMENTS.has(p.element)) {
      errors.push(`植物 "${p.id}" element 不合法: "${p.element}"，允许: ${[...VALID_ELEMENTS].join(', ')}`)
    }
    if (!VALID_TRAJECTORIES.has(p.trajectory)) {
      errors.push(`植物 "${p.id}" trajectory 不合法: "${p.trajectory}"，允许: ${[...VALID_TRAJECTORIES].join(', ')}`)
    }
  }

  for (const stage of stages) {
    if (stage.letters.length === 0) {
      errors.push(`阶段 ${stage.id} "${stage.name}" letters 字母池不能为空`)
    }
    for (const plantId of stage.plants) {
      if (!plantIds.has(plantId)) {
        errors.push(`阶段 ${stage.id} 引用不存在的植物: "${plantId}"`)
      }
    }
    for (const level of stage.levels) {
      for (const wave of level.waves) {
        if (!(wave.zombieType in zombies)) {
          errors.push(`阶段 ${stage.id} 关卡 ${level.id} 引用不存在的僵尸类型: "${wave.zombieType}"`)
        }
        if (wave.count <= 0) {
          errors.push(`阶段 ${stage.id} 关卡 ${level.id} 波次 count 必须 > 0，当前: ${wave.count}`)
        }
      }
    }
  }

  if (!(1 in synergy.multiplier)) {
    errors.push('synergy multiplier 必须包含 key=1')
  } else if (synergy.multiplier[1] !== 1.0) {
    errors.push(`synergy multiplier[1] 必须为 1.0，当前: ${synergy.multiplier[1]}`)
  }

  if (battle.areaBulletCount < 1) {
    errors.push(`areaBulletCount 必须 >= 1，当前: ${battle.areaBulletCount}`)
  }
  if (battle.areaSpreadAngle <= 0) {
    errors.push(`areaSpreadAngle 必须 > 0，当前: ${battle.areaSpreadAngle}`)
  }
  if (battle.areaDamageDecay <= 0) {
    errors.push(`areaDamageDecay 必须 > 0，当前: ${battle.areaDamageDecay}`)
  }

  return errors
}
