export interface BattleStatsData {
  zombiesKilled: number
  longestCombo: number
  totalCombo: number
  synergyCount: number
  missedCount: number
  fullChainCount: number
}

export class BattleStats {
  private zombiesKilled = 0
  private longestCombo = 0
  private totalCombo = 0
  private synergyCount = 0
  private missedCount = 0
  private fullChainCount = 0

  recordKill(): void {
    this.zombiesKilled++
  }

  recordCombo(comboCount: number): void {
    this.totalCombo++
    if (comboCount > this.longestCombo) {
      this.longestCombo = comboCount
    }
  }

  recordSynergy(): void {
    this.synergyCount++
  }

  recordMiss(): void {
    this.missedCount++
  }

  recordFullChain(): void {
    this.fullChainCount++
  }

  getStats(): BattleStatsData {
    return {
      zombiesKilled: this.zombiesKilled,
      longestCombo: this.longestCombo,
      totalCombo: this.totalCombo,
      synergyCount: this.synergyCount,
      missedCount: this.missedCount,
      fullChainCount: this.fullChainCount,
    }
  }
}
