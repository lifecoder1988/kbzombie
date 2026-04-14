import { PlantChain } from './PlantChain'
import { ComboSystem, type ComboSettlement } from './ComboSystem'
import { LetterProvider } from './LetterProvider'
import type { PlantConfig, PlantState } from './types'

export class Lane {
  readonly index: number
  readonly plants: readonly PlantConfig[]
  readonly laneY: number
  readonly plantPositions: number[]
  readonly plantWidths: number[]

  private readonly plantChain: PlantChain
  private readonly combo: ComboSystem
  private readonly letterProvider: LetterProvider
  private readonly _chainLetters: string[]

  constructor(
    index: number,
    plants: readonly PlantConfig[],
    letterPool: readonly string[],
    laneY: number,
    canvasWidth: number,
    letterSeed?: number,
  ) {
    this.index = index
    this.plants = plants
    this.laneY = laneY
    this.plantChain = new PlantChain(plants)
    this.combo = new ComboSystem(plants.map(p => p.comboSegment))
    this.letterProvider = new LetterProvider(letterPool, letterSeed)

    const totalSeg = plants.reduce((s, p) => s + p.comboSegment, 0)
    this._chainLetters = Array.from({ length: totalSeg }, () => this.letterProvider.next())

    // Plant layout: same logic as current BattleManager
    const plantAreaWidth = canvasWidth * 0.35
    const gap = 8
    const totalGap = gap * Math.max(0, plants.length - 1)
    const usableWidth = plantAreaWidth - totalGap
    const startX = 20
    this.plantPositions = []
    this.plantWidths = []
    let curX = startX
    for (let i = 0; i < plants.length; i++) {
      const w = totalSeg > 0 ? Math.round((plants[i].comboSegment / totalSeg) * usableWidth) : 0
      this.plantPositions.push(curX)
      this.plantWidths.push(w)
      curX += w + gap
    }
  }

  get isEmpty(): boolean { return this.plants.length === 0 }
  get comboCount(): number { return this.combo.current }
  get totalSegments(): number { return this._chainLetters.length }

  get currentLetter(): string {
    if (this.isEmpty) return ''
    return this._chainLetters[this.combo.current] ?? ''
  }

  get chainLetters(): readonly string[] { return this._chainLetters }

  // combo delegates
  hit(): ComboSettlement | null { return this.combo.hit() }
  miss(): ComboSettlement | null { return this.combo.miss() }
  settle(): ComboSettlement | null { return this.combo.settle() }
  resetCombo(): void { this.combo.reset() }

  // plant chain delegates
  getPlantStates(): readonly PlantState[] { return this.plantChain.getStates() }
  takeDamage(plantIndex: number, damage: number): void { this.plantChain.takeDamage(plantIndex, damage) }
  healOnFullChain(healAmount: number): void { this.plantChain.healOnFullChain(healAmount) }
  getRightmostAlivePlantIndex(): number { return this.plantChain.getRightmostAlivePlantIndex() }

  // letter management
  regenerateLetters(excludeFirstLetters: readonly string[]): void {
    if (this.isEmpty) return
    this._chainLetters[0] = this.letterProvider.nextExcluding(excludeFirstLetters)
    for (let i = 1; i < this._chainLetters.length; i++) {
      this._chainLetters[i] = this.letterProvider.next()
    }
  }
}
