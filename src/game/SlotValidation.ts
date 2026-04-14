export interface SlotValidationResult {
  readonly valid: boolean
  readonly used: number
  readonly error?: string
}

export function validateSlot(
  plantIds: readonly string[],
  slotSize: number,
  plantDefs: Readonly<Record<string, { comboSegment: number }>>,
): SlotValidationResult {
  let used = 0
  for (const id of plantIds) {
    const def = plantDefs[id]
    if (!def) return { valid: false, used, error: `未知植物 ID: ${id}` }
    used += def.comboSegment
  }
  if (used > slotSize) return { valid: false, used, error: `总段数 ${used} 超过 slot 上限 ${slotSize}` }
  return { valid: true, used }
}
