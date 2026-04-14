import type { PlantState, SettlementResult } from './types'

/**
 * 计算结算攻击力。
 * 激活条件：连击打满该植物的全部段数（未打满不算激活）。
 */
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
  let segmentEnd = 0

  for (let i = 0; i < plants.length; i++) {
    const plant = plants[i]
    segmentEnd += plant.config.comboSegment
    // 只有连击达到该植物段末尾才算激活
    if (comboCount >= segmentEnd) {
      activatedIndices.push(i)
      if (plant.alive) {
        aliveActivatedIndices.push(i)
        totalPower += plant.config.attackPower
      }
    }
  }

  return { totalPower, activatedIndices, aliveActivatedIndices, isFullChain }
}
