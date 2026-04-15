// src/game/__tests__/BattleStats.test.ts
import { describe, it, expect } from 'vitest'
import { BattleStats } from '../BattleStats'

describe('BattleStats', () => {
  it('初始值全部为 0', () => {
    const stats = new BattleStats()
    expect(stats.getStats()).toEqual({
      zombiesKilled: 0,
      longestCombo: 0,
      totalCombo: 0,
      synergyCount: 0,
      missedCount: 0,
      fullChainCount: 0,
    })
  })

  it('recordKill 增加击杀数', () => {
    const stats = new BattleStats()
    stats.recordKill()
    stats.recordKill()
    expect(stats.getStats().zombiesKilled).toBe(2)
  })

  it('recordCombo 更新最长连击和总连击数', () => {
    const stats = new BattleStats()
    stats.recordCombo(5)
    stats.recordCombo(3)
    stats.recordCombo(8)
    const s = stats.getStats()
    expect(s.longestCombo).toBe(8)
    expect(s.totalCombo).toBe(3)
  })

  it('recordSynergy 增加协同次数', () => {
    const stats = new BattleStats()
    stats.recordSynergy()
    expect(stats.getStats().synergyCount).toBe(1)
  })

  it('recordMiss 增加放过数', () => {
    const stats = new BattleStats()
    stats.recordMiss()
    stats.recordMiss()
    expect(stats.getStats().missedCount).toBe(2)
  })

  it('recordFullChain 增加打满次数', () => {
    const stats = new BattleStats()
    stats.recordFullChain()
    stats.recordFullChain()
    stats.recordFullChain()
    expect(stats.getStats().fullChainCount).toBe(3)
  })
})
