import type { PlantState, SettlementResult } from './types'

export function calculateSettlement(
  plants: readonly PlantState[],
  comboCount: number,
  isFullChain: boolean,
): SettlementResult {
  if (comboCount <= 0) {
    return { totalPower: 0, activatedIndices: [], aliveActivatedIndices: [], isFullChain: false }
  }

  const activatedIndices: number[] = []
  const aliveActivatedIndices: number[] = []
  let totalPower = 0
  let segmentSum = 0

  for (let i = 0; i < plants.length; i++) {
    const plant = plants[i]
    segmentSum += plant.config.segments
    if (comboCount > segmentSum - plant.config.segments) {
      activatedIndices.push(i)
      if (plant.alive) {
        aliveActivatedIndices.push(i)
        totalPower += plant.config.attackPower
      }
    }
  }

  return { totalPower, activatedIndices, aliveActivatedIndices, isFullChain }
}
