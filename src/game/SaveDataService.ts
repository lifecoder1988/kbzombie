import type { Storage } from '../engine/Storage'

export interface SaveData {
  version: number
  currentStageIndex: number
  currentLevelIndex: number
  completedLevels: string[]
  difficulty: string
  bestStars: Record<string, number>
}

const SAVE_KEY = 'kbzombie_save'

const DEFAULT_SAVE: SaveData = {
  version: 1,
  currentStageIndex: 0,
  currentLevelIndex: 0,
  completedLevels: [],
  difficulty: 'normal',
  bestStars: {},
}

export class SaveDataService {
  private readonly storage: Storage

  constructor(storage: Storage) {
    this.storage = storage
  }

  load(): SaveData {
    const data = this.storage.load<SaveData>(SAVE_KEY)
    if (!data) return { ...DEFAULT_SAVE, completedLevels: [], bestStars: {} }
    return data
  }

  private save(data: SaveData): void {
    this.storage.save(SAVE_KEY, data)
  }

  completeLevel(
    stageIndex: number,
    levelIndex: number,
    stars: number,
    stageLevelCount: number,
    hasNextStage: boolean,
  ): void {
    const data = this.load()
    const levelId = `${stageIndex}-${levelIndex}`

    if (!data.completedLevels.includes(levelId)) {
      data.completedLevels.push(levelId)
    }

    if (data.bestStars[levelId] === undefined) {
      data.bestStars[levelId] = stars
    }

    if (levelIndex + 1 < stageLevelCount) {
      data.currentStageIndex = stageIndex
      data.currentLevelIndex = levelIndex + 1
    } else if (hasNextStage) {
      data.currentStageIndex = stageIndex + 1
      data.currentLevelIndex = 0
    }

    this.save(data)
  }

  isLevelUnlocked(_stageIndex: number, _levelIndex: number, prevLevelId: string | null): boolean {
    if (prevLevelId === null) return true
    const data = this.load()
    return data.completedLevels.includes(prevLevelId)
  }

  isAllCompleted(): boolean {
    const data = this.load()
    if (data.completedLevels.length === 0) return false
    const currentId = `${data.currentStageIndex}-${data.currentLevelIndex}`
    return data.completedLevels.includes(currentId)
  }

  getDifficulty(): string {
    return this.load().difficulty
  }

  setDifficulty(difficulty: string): void {
    const data = this.load()
    data.difficulty = difficulty
    this.save(data)
  }

  reset(): void {
    this.save({ ...DEFAULT_SAVE, completedLevels: [], bestStars: {} })
  }
}
