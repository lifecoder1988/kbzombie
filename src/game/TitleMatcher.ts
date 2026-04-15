import type { TitleRule } from '../config/types'
import type { BattleStatsData } from './BattleStats'

export function matchTitle(
  stats: BattleStatsData,
  rules: readonly TitleRule[],
  defaultTitle: string,
): string {
  for (const rule of rules) {
    const r = rule.requires
    if (r.zeroMissed && stats.missedCount !== 0) continue
    if (r.minLongestCombo !== undefined && stats.longestCombo < r.minLongestCombo) continue
    if (r.minSynergyCount !== undefined && stats.synergyCount < r.minSynergyCount) continue
    if (r.minFullChainCount !== undefined && stats.fullChainCount < r.minFullChainCount) continue
    return rule.name
  }
  return defaultTitle
}
