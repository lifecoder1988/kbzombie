import type { PlantDef, ZombieDef, StageDef, SynergyDef, BattleDef } from './types'

const VALID_ELEMENTS = new Set(['normal', 'ice', 'fire', 'electric', 'stun', 'knockback'])
const VALID_SPREADS = new Set(['single', 'burst', 'fan'])
const VALID_FLIGHTS = new Set(['straight', 'tracking'])
const VALID_IMPACTS = new Set(['vanish', 'chain', 'pierce', 'explode'])

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
    if (!VALID_SPREADS.has(p.spread)) {
      errors.push(`植物 "${p.id}" spread 不合法: "${p.spread}"，允许: ${[...VALID_SPREADS].join(', ')}`)
    }
    if (!VALID_FLIGHTS.has(p.flight)) {
      errors.push(`植物 "${p.id}" flight 不合法: "${p.flight}"，允许: ${[...VALID_FLIGHTS].join(', ')}`)
    }
    if (!VALID_IMPACTS.has(p.impact)) {
      errors.push(`植物 "${p.id}" impact 不合法: "${p.impact}"，允许: ${[...VALID_IMPACTS].join(', ')}`)
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
      const effectiveLaneCount = level.laneCount ?? 1
      if (level.laneCount !== undefined && (level.laneCount < 1 || level.laneCount > 3)) {
        errors.push(`阶段 ${stage.id} 关卡 ${level.id} laneCount 必须为 1、2 或 3，当前: ${level.laneCount}`)
      }
      if (level.lanePlants !== undefined) {
        if (level.lanePlants.length !== effectiveLaneCount) {
          errors.push(`阶段 ${stage.id} 关卡 ${level.id} lanePlants 长度必须等于 laneCount (${effectiveLaneCount})，当前: ${level.lanePlants.length}`)
        }
        for (let laneIdx = 0; laneIdx < level.lanePlants.length; laneIdx++) {
          for (const plantId of level.lanePlants[laneIdx]) {
            if (!plantIds.has(plantId)) {
              errors.push(`阶段 ${stage.id} 关卡 ${level.id} 第 ${laneIdx + 1} 路引用不存在的植物: "${plantId}"`)
            }
          }
        }
      }
      for (const wave of level.waves) {
        if (wave.count <= 0) {
          errors.push(`阶段 ${stage.id} 关卡 ${level.id} 波次 count 必须 > 0，当前: ${wave.count}`)
        }
        if (wave.zombies && wave.zombies.length > 0) {
          for (const entry of wave.zombies) {
            if (!(entry.type in zombies)) {
              errors.push(`阶段 ${stage.id} 关卡 ${level.id} 波次引用不存在的僵尸类型: "${entry.type}"`)
            }
            if (entry.weight <= 0) {
              errors.push(`阶段 ${stage.id} 关卡 ${level.id} 波次僵尸 "${entry.type}" weight 必须 > 0，当前: ${entry.weight}`)
            }
          }
        } else if (wave.zombieType) {
          if (!(wave.zombieType in zombies)) {
            errors.push(`阶段 ${stage.id} 关卡 ${level.id} 引用不存在的僵尸类型: "${wave.zombieType}"`)
          }
        } else {
          errors.push(`阶段 ${stage.id} 关卡 ${level.id} 波次必须提供 zombieType 或 zombies`)
        }
      }
    }
  }

  if (!(1 in synergy.multiplier)) {
    errors.push('synergy multiplier 必须包含 key=1')
  } else if (synergy.multiplier[1] !== 1.0) {
    errors.push(`synergy multiplier[1] 必须为 1.0，当前: ${synergy.multiplier[1]}`)
  }

  // Validate effectParams
  const ep = battle.effectParams
  if (ep.fan.fanBulletCount < 1) {
    errors.push(`effectParams.fan.fanBulletCount 必须 >= 1，当前: ${ep.fan.fanBulletCount}`)
  }
  if (ep.fan.fanSpreadAngle <= 0) {
    errors.push(`effectParams.fan.fanSpreadAngle 必须 > 0，当前: ${ep.fan.fanSpreadAngle}`)
  }
  if (ep.burst.burstCount < 1) {
    errors.push(`effectParams.burst.burstCount 必须 >= 1，当前: ${ep.burst.burstCount}`)
  }
  if (ep.explode.explodeDamageRatio <= 0) {
    errors.push(`effectParams.explode.explodeDamageRatio 必须 > 0，当前: ${ep.explode.explodeDamageRatio}`)
  }

  return errors
}
