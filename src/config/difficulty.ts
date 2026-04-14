import type { DifficultyDef } from './types'

export const DIFFICULTIES: Readonly<Record<string, DifficultyDef>> = {
  easy:   { missedLimit: 5, zombieSpeedMultiplier: 0.8 },
  normal: { missedLimit: 3, zombieSpeedMultiplier: 1.0 },
  hard:   { missedLimit: 1, zombieSpeedMultiplier: 1.2 },
}

export const DEFAULT_DIFFICULTY = 'normal'
