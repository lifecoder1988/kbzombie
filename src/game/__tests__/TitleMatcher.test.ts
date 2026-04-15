import { describe, it, expect } from 'vitest'
import { matchTitle } from '../TitleMatcher'
import type { TitleRule } from '../../config/types'
import type { BattleStatsData } from '../BattleStats'

const RULES: TitleRule[] = [
  { id: 'perfect', name: '完美指挥官', requires: { zeroMissed: true, minFullChainCount: 3 } },
  { id: 'no_miss', name: '滴水不漏', requires: { zeroMissed: true } },
  { id: 'combo', name: '连击大师', requires: { minLongestCombo: 20 } },
  { id: 'synergy', name: '协同达人', requires: { minSynergyCount: 5 } },
  { id: 'chain', name: '全链专家', requires: { minFullChainCount: 3 } },
]
const DEFAULT_TITLE = '勇敢的键盘侠'

function makeStats(overrides: Partial<BattleStatsData> = {}): BattleStatsData {
  return {
    zombiesKilled: 0, longestCombo: 0, totalCombo: 0,
    synergyCount: 0, missedCount: 0, fullChainCount: 0,
    ...overrides,
  }
}

describe('matchTitle', () => {
  it('零放过 + 满链 ≥3 匹配完美指挥官', () => {
    expect(matchTitle(makeStats({ missedCount: 0, fullChainCount: 5 }), RULES, DEFAULT_TITLE)).toBe('完美指挥官')
  })
  it('零放过但满链 <3 匹配滴水不漏', () => {
    expect(matchTitle(makeStats({ missedCount: 0, fullChainCount: 1 }), RULES, DEFAULT_TITLE)).toBe('滴水不漏')
  })
  it('连击 ≥20 匹配连击大师', () => {
    expect(matchTitle(makeStats({ missedCount: 2, longestCombo: 25 }), RULES, DEFAULT_TITLE)).toBe('连击大师')
  })
  it('协同 ≥5 匹配协同达人', () => {
    expect(matchTitle(makeStats({ missedCount: 1, synergyCount: 7 }), RULES, DEFAULT_TITLE)).toBe('协同达人')
  })
  it('满链 ≥3 匹配全链专家', () => {
    expect(matchTitle(makeStats({ missedCount: 1, fullChainCount: 4 }), RULES, DEFAULT_TITLE)).toBe('全链专家')
  })
  it('都不满足返回默认称号', () => {
    expect(matchTitle(makeStats({ missedCount: 2, longestCombo: 5 }), RULES, DEFAULT_TITLE)).toBe('勇敢的键盘侠')
  })
  it('空规则列表返回默认称号', () => {
    expect(matchTitle(makeStats({ missedCount: 0 }), [], DEFAULT_TITLE)).toBe('勇敢的键盘侠')
  })
})
