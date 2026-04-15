import type { DifficultyDef } from './types'

export const DIFFICULTIES: Readonly<Record<string, DifficultyDef>> = {
  easy:   { missedLimit: 5, zombieSpeedMultiplier: 0.8, segmentMultiplier: 0.75, displayName: '简单' },
  normal: { missedLimit: 3, zombieSpeedMultiplier: 1.0, segmentMultiplier: 1.0,  displayName: '普通' },
  hard:   { missedLimit: 1, zombieSpeedMultiplier: 1.2, segmentMultiplier: 1.5,  displayName: '困难' },
}

export const DEFAULT_DIFFICULTY = 'normal'

export const DIFFICULTY_ORDER: readonly string[] = ['easy', 'normal', 'hard']
