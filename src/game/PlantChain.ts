import type { PlantConfig, PlantState } from './types'

export class PlantChain {
  private readonly states: PlantState[]
  private readonly segmentStarts: number[]
  readonly totalSegments: number

  constructor(configs: readonly PlantConfig[]) {
    this.states = configs.map((config, i) => ({
      config,
      currentHp: config.hp,
      alive: true,
      chainIndex: i,
    }))

    this.segmentStarts = []
    let sum = 0
    for (const config of configs) {
      this.segmentStarts.push(sum + 1)
      sum += config.comboSegment
    }
    this.totalSegments = sum
  }

  getStates(): readonly PlantState[] {
    return this.states
  }

  getPlantIndexAtCombo(combo: number): number {
    for (let i = this.states.length - 1; i >= 0; i--) {
      if (combo >= this.segmentStarts[i]) return i
    }
    return 0
  }

  takeDamage(plantIndex: number, damage: number): void {
    const plant = this.states[plantIndex]
    if (!plant.alive) return
    plant.currentHp = Math.max(0, plant.currentHp - damage)
    if (plant.currentHp <= 0) {
      plant.alive = false
    }
  }

  healOnFullChain(healAmount: number): void {
    for (const plant of this.states) {
      if (plant.alive) {
        plant.currentHp = Math.min(plant.config.hp, plant.currentHp + healAmount)
      } else {
        plant.alive = true
        plant.currentHp = healAmount
      }
    }
  }

  getRightmostAlivePlantIndex(): number {
    for (let i = this.states.length - 1; i >= 0; i--) {
      if (this.states[i].alive) return i
    }
    return -1
  }

  reset(): void {
    for (const plant of this.states) {
      plant.currentHp = plant.config.hp
      plant.alive = true
    }
  }
}
