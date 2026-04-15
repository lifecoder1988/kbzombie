import { describe, it, expect, beforeEach } from 'vitest'
import { SaveDataService } from '../SaveDataService'
import type { Storage } from '../../engine/Storage'

// 内存 Storage 替身，不依赖 localStorage
class MemoryStorage implements Storage {
  private data = new Map<string, unknown>()
  save(key: string, data: unknown): void { this.data.set(key, JSON.parse(JSON.stringify(data))) }
  load<T>(key: string): T | null { return (this.data.get(key) as T) ?? null }
  delete(key: string): void { this.data.delete(key) }
}

describe('SaveDataService', () => {
  let storage: MemoryStorage
  let service: SaveDataService

  beforeEach(() => {
    storage = new MemoryStorage()
    service = new SaveDataService(storage)
  })

  it('首次 load 返回默认存档', () => {
    const data = service.load()
    expect(data.version).toBe(1)
    expect(data.currentStageIndex).toBe(0)
    expect(data.currentLevelIndex).toBe(0)
    expect(data.completedLevels).toEqual([])
    expect(data.difficulty).toBe('normal')
    expect(data.bestStars).toEqual({})
  })

  it('completeLevel 推进到同阶段下一关', () => {
    service.completeLevel(0, 0, 3, 2, true)
    const data = service.load()
    expect(data.currentStageIndex).toBe(0)
    expect(data.currentLevelIndex).toBe(1)
    expect(data.completedLevels).toContain('0-0')
    expect(data.bestStars['0-0']).toBe(3)
  })

  it('completeLevel 阶段最后一关推进到下一阶段', () => {
    service.completeLevel(0, 0, 2, 2, true)
    service.completeLevel(0, 1, 3, 2, true)
    const data = service.load()
    expect(data.currentStageIndex).toBe(1)
    expect(data.currentLevelIndex).toBe(0)
  })

  it('completeLevel 最后阶段最后一关不越界', () => {
    service.completeLevel(0, 0, 1, 1, false)
    const data = service.load()
    // hasNextStage=false，进度停留在当前位置
    expect(data.currentStageIndex).toBe(0)
    expect(data.currentLevelIndex).toBe(0)
    expect(data.completedLevels).toContain('0-0')
  })

  it('isLevelUnlocked 第一关始终解锁', () => {
    expect(service.isLevelUnlocked(0, 0, null)).toBe(true)
  })

  it('isLevelUnlocked 前一关未通过则锁定', () => {
    expect(service.isLevelUnlocked(0, 1, '0-0')).toBe(false)
  })

  it('isLevelUnlocked 前一关已通过则解锁', () => {
    service.completeLevel(0, 0, 2, 2, true)
    expect(service.isLevelUnlocked(0, 1, '0-0')).toBe(true)
  })

  it('setDifficulty 写入存档', () => {
    service.setDifficulty('hard')
    expect(service.load().difficulty).toBe('hard')
  })

  it('reset 恢复默认值', () => {
    service.completeLevel(0, 0, 3, 2, true)
    service.setDifficulty('hard')
    service.reset()
    const data = service.load()
    expect(data.currentStageIndex).toBe(0)
    expect(data.currentLevelIndex).toBe(0)
    expect(data.completedLevels).toEqual([])
    expect(data.difficulty).toBe('normal')
  })

  it('重复完成同一关不重复添加到 completedLevels', () => {
    service.completeLevel(0, 0, 2, 2, true)
    service.completeLevel(0, 0, 3, 2, true)
    const data = service.load()
    expect(data.completedLevels.filter(l => l === '0-0').length).toBe(1)
  })

  it('isAllCompleted 全部通关返回 true', () => {
    service.completeLevel(0, 0, 1, 1, false)
    expect(service.isAllCompleted()).toBe(true)
  })

  it('isAllCompleted 未全部通关返回 false', () => {
    expect(service.isAllCompleted()).toBe(false)
  })
})
