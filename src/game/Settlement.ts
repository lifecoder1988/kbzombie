import type { PlantState, SettlementResult, SynthesizedEffect } from './types'
import { synthesizeEffects } from './EffectSynthesis'

export function calculateSettlement(
  plants: readonly PlantState[],
  comboCount: number,
  isFullChain: boolean,
  synergyMultiplier: Readonly<Record<number, number>>,
): SettlementResult {
  const empty: SettlementResult = {
    totalPower: 0,
    activatedIndices: [],
    aliveActivatedIndices: [],
    isFullChain: false,
    synergyMultiplier: 1.0,
    perPlantPower: [],
    synthesizedEffect: { element: 'normal', trajectory: 'direct' },
  }

  if (comboCount <= 0) {
    return empty
  }

  const activatedIndices: number[] = []
  const aliveActivatedIndices: number[] = []
  let segmentEnd = 0

  for (let i = 0; i < plants.length; i++) {
    const plant = plants[i]
    segmentEnd += plant.config.comboSegment
    if (comboCount >= segmentEnd) {
      activatedIndices.push(i)
      if (plant.alive) {
        aliveActivatedIndices.push(i)
      }
    }
  }

  const aliveCount = aliveActivatedIndices.length
  if (aliveCount === 0) {
    return { ...empty, activatedIndices, isFullChain }
  }

  // Lookup multiplier: use exact count or fallback to max configured key <= aliveCount
  let multiplier = synergyMultiplier[aliveCount]
  if (multiplier === undefined) {
    let maxKey = 0
    for (const key in synergyMultiplier) {
      const k = Number(key)
      if (k <= aliveCount && k > maxKey) maxKey = k
    }
    multiplier = maxKey > 0 ? synergyMultiplier[maxKey] : 1.0
  }

  const perPlantPower: number[] = []
  let totalPower = 0
  for (const idx of aliveActivatedIndices) {
    const power = plants[idx].config.attackPower * multiplier
    perPlantPower.push(power)
    totalPower += power
  }

  // Synthesize effects from alive activated plants only
  const effectInputs = aliveActivatedIndices.map(idx => ({
    element: plants[idx].config.element,
    trajectory: plants[idx].config.trajectory,
  }))
  const synthesizedEffect: SynthesizedEffect = synthesizeEffects(effectInputs)

  return {
    totalPower,
    activatedIndices,
    aliveActivatedIndices,
    isFullChain,
    synergyMultiplier: multiplier,
    perPlantPower,
    synthesizedEffect,
  }
}
