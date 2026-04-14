import type { PlantDef, ZombieDef, StageDef } from './types'

export function validateConfig(
  plants: readonly PlantDef[],
  zombies: Readonly<Record<string, ZombieDef>>,
  stages: readonly StageDef[],
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

  return errors
}
