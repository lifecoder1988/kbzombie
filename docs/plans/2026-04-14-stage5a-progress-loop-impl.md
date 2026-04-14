# 阶段五 A 组：进度闭环 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现持久化存储、战斗统计采集、结算场景、关卡选择场景和主菜单改造，形成完整的进度闭环。

**Architecture:** 引擎层新增 Storage 接口（localStorage 包装），游戏层新增 SaveDataService（存档读写）和 BattleStats（统计采集），场景层新增 SettlementScene 和 StageSelectScene，改造 MenuScene 和 BattleScene。所有新场景均为 Canvas 场景，通过 SceneManager 切换。

**Tech Stack:** TypeScript, Vitest, Canvas API, localStorage

---

## 文件结构

### 新建文件

| 文件 | 职责 |
|------|------|
| `src/engine/Storage.ts` | 引擎层 Storage 接口 + LocalStorage 实现 |
| `src/engine/__tests__/Storage.test.ts` | Storage 单元测试 |
| `src/game/SaveDataService.ts` | 游戏层存档服务（读/写/进度推进/解锁判定） |
| `src/game/__tests__/SaveDataService.test.ts` | SaveDataService 单元测试 |
| `src/game/BattleStats.ts` | 战斗统计采集器 |
| `src/game/__tests__/BattleStats.test.ts` | BattleStats 单元测试 |
| `src/config/settlement.ts` | 称号规则 + 鼓励语 + 星级阈值配置 |
| `src/game/TitleMatcher.ts` | 称号匹配逻辑（游戏层，读取声明式规则） |
| `src/game/__tests__/TitleMatcher.test.ts` | TitleMatcher 单元测试 |
| `src/scenes/SettlementScene.ts` | 结算场景（Canvas 绘制） |
| `src/scenes/StageSelectScene.ts` | 关卡选择场景（Canvas 绘制） |

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/engine/index.ts` | 导出 Storage 相关 |
| `src/config/types.ts` | 新增 SettlementConfig 等类型 |
| `src/config/difficulty.ts` | DifficultyDef 新增 displayName |
| `src/config/index.ts` | 导出 settlement 配置 |
| `src/game/BattleManager.ts` | 集成 BattleStats 统计埋点 |
| `src/scenes/BattleScene.ts` | 通关/失败时切到 SettlementScene，移除内联覆盖层 |
| `src/scenes/MenuScene.ts` | 改造为进度展示 + 继续/选关/难度按钮 |
| `src/App.tsx` | 注册新场景，初始化 SaveDataService |

---

## Task 1: 引擎层 Storage 接口

**Files:**
- Create: `src/engine/Storage.ts`
- Create: `src/engine/__tests__/Storage.test.ts`
- Modify: `src/engine/index.ts`

- [ ] **Step 1: 写 Storage 接口和 LocalStorage 实现的测试**

```typescript
// src/engine/__tests__/Storage.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { LocalStorage } from '../Storage'

// 使用 vitest 内置的 jsdom 环境提供 localStorage
describe('LocalStorage', () => {
  let storage: LocalStorage

  beforeEach(() => {
    localStorage.clear()
    storage = new LocalStorage()
  })

  it('load 不存在的 key 返回 null', () => {
    expect(storage.load('nonexistent')).toBeNull()
  })

  it('save 后 load 返回相同数据', () => {
    const data = { version: 1, name: 'test' }
    storage.save('game', data)
    expect(storage.load('game')).toEqual(data)
  })

  it('save 覆盖已有数据', () => {
    storage.save('key', { a: 1 })
    storage.save('key', { a: 2 })
    expect(storage.load('key')).toEqual({ a: 2 })
  })

  it('delete 后 load 返回 null', () => {
    storage.save('key', { a: 1 })
    storage.delete('key')
    expect(storage.load('key')).toBeNull()
  })

  it('load 解析失败返回 null', () => {
    localStorage.setItem('bad', 'not-json{{{')
    expect(storage.load('bad')).toBeNull()
  })
})
```

- [ ] **Step 2: 跑测试确认红色**

Run: `npx vitest run src/engine/__tests__/Storage.test.ts`
Expected: FAIL — `../Storage` 模块不存在

- [ ] **Step 3: 实现 Storage 接口和 LocalStorage**

```typescript
// src/engine/Storage.ts
export interface Storage {
  save(key: string, data: unknown): void
  load<T>(key: string): T | null
  delete(key: string): void
}

export class LocalStorage implements Storage {
  save(key: string, data: unknown): void {
    try {
      window.localStorage.setItem(key, JSON.stringify(data))
    } catch {
      // localStorage 不可用（隐私模式等）时静默降级
    }
  }

  load<T>(key: string): T | null {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw === null) return null
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }

  delete(key: string): void {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // 静默降级
    }
  }
}
```

- [ ] **Step 4: 跑测试确认绿色**

Run: `npx vitest run src/engine/__tests__/Storage.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5: 更新引擎层导出**

在 `src/engine/index.ts` 末尾添加：
```typescript
export type { Storage } from './Storage'
export { LocalStorage } from './Storage'
```

- [ ] **Step 6: 跑全量测试确认无回归**

Run: `npx vitest run`
Expected: 所有测试通过（240+ 原有 + 5 新增）

- [ ] **Step 7: 提交**

```bash
git add src/engine/Storage.ts src/engine/__tests__/Storage.test.ts src/engine/index.ts
git commit -m "feat(engine): add Storage interface + LocalStorage implementation"
```

---

## Task 2: SaveDataService 存档服务

**Files:**
- Create: `src/game/SaveDataService.ts`
- Create: `src/game/__tests__/SaveDataService.test.ts`

- [ ] **Step 1: 写 SaveDataService 测试**

```typescript
// src/game/__tests__/SaveDataService.test.ts
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
```

- [ ] **Step 2: 跑测试确认红色**

Run: `npx vitest run src/game/__tests__/SaveDataService.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 SaveDataService**

```typescript
// src/game/SaveDataService.ts
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

  /**
   * 通关一关，推进进度。
   * @param stageIndex - 阶段索引
   * @param levelIndex - 关卡索引
   * @param stars - 获得星级 1-3
   * @param stageLevelCount - 当前阶段总关卡数（由场景层从 config 传入）
   * @param hasNextStage - 是否有下一阶段
   */
  completeLevel(
    stageIndex: number,
    levelIndex: number,
    stars: number,
    stageLevelCount: number,
    hasNextStage: boolean,
  ): void {
    const data = this.load()
    const levelId = `${stageIndex}-${levelIndex}`

    // 标记通关（去重）
    if (!data.completedLevels.includes(levelId)) {
      data.completedLevels.push(levelId)
    }

    // 记录星级（仅首次写入）
    if (data.bestStars[levelId] === undefined) {
      data.bestStars[levelId] = stars
    }

    // 推进进度
    if (levelIndex + 1 < stageLevelCount) {
      // 同阶段下一关
      data.currentStageIndex = stageIndex
      data.currentLevelIndex = levelIndex + 1
    } else if (hasNextStage) {
      // 下一阶段第一关
      data.currentStageIndex = stageIndex + 1
      data.currentLevelIndex = 0
    }
    // else: 最后阶段最后一关，进度不推进

    this.save(data)
  }

  /**
   * 判断某关是否已解锁。
   * @param _stageIndex - 阶段索引（保留用于未来扩展）
   * @param _levelIndex - 关卡索引（保留用于未来扩展）
   * @param prevLevelId - 前一关 ID（"stageIndex-levelIndex" 格式），null 表示游戏第一关
   */
  isLevelUnlocked(_stageIndex: number, _levelIndex: number, prevLevelId: string | null): boolean {
    if (prevLevelId === null) return true
    const data = this.load()
    return data.completedLevels.includes(prevLevelId)
  }

  isAllCompleted(): boolean {
    const data = this.load()
    // 如果最后一次 completeLevel 没推进进度（hasNextStage=false），
    // 说明完成了最后阶段最后一关
    // 简单判断：completedLevels 非空且 currentStageIndex/currentLevelIndex 未推进
    return data.completedLevels.length > 0 &&
      !data.completedLevels.includes(`${data.currentStageIndex}-${data.currentLevelIndex}`) === false
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
```

注意：`isAllCompleted` 的实现在 step 4 跑测试时可能需要调整。通过测试来验证正确性。

- [ ] **Step 4: 跑测试，调试直到绿色**

Run: `npx vitest run src/game/__tests__/SaveDataService.test.ts`
Expected: PASS — 11 tests

`isAllCompleted` 的逻辑可能需要修正。正确实现：当 `hasNextStage=false` 的 `completeLevel` 被调用后，`completedLevels` 包含最后一关的 ID，但进度没有推进。判断方法是检查 `currentStageIndex-currentLevelIndex` 对应的关卡 ID 是否在 `completedLevels` 中：

```typescript
isAllCompleted(): boolean {
  const data = this.load()
  if (data.completedLevels.length === 0) return false
  const currentId = `${data.currentStageIndex}-${data.currentLevelIndex}`
  return data.completedLevels.includes(currentId)
}
```

- [ ] **Step 5: 跑全量测试**

Run: `npx vitest run`
Expected: 所有通过

- [ ] **Step 6: 提交**

```bash
git add src/game/SaveDataService.ts src/game/__tests__/SaveDataService.test.ts
git commit -m "feat(game): add SaveDataService for progress persistence"
```

---

## Task 3: BattleStats 战斗统计

**Files:**
- Create: `src/game/BattleStats.ts`
- Create: `src/game/__tests__/BattleStats.test.ts`

- [ ] **Step 1: 写 BattleStats 测试**

```typescript
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
```

- [ ] **Step 2: 跑测试确认红色**

Run: `npx vitest run src/game/__tests__/BattleStats.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 BattleStats**

```typescript
// src/game/BattleStats.ts
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
```

- [ ] **Step 4: 跑测试确认绿色**

Run: `npx vitest run src/game/__tests__/BattleStats.test.ts`
Expected: PASS — 6 tests

- [ ] **Step 5: 提交**

```bash
git add src/game/BattleStats.ts src/game/__tests__/BattleStats.test.ts
git commit -m "feat(game): add BattleStats for combat statistics collection"
```

---

## Task 4: BattleManager 集成 BattleStats

**Files:**
- Modify: `src/game/BattleManager.ts`
- Modify: `src/game/__tests__/BattleManager.test.ts`

- [ ] **Step 1: 在 BattleManager.test.ts 中添加统计测试**

在 `src/game/__tests__/BattleManager.test.ts` 文件尾部 `describe` 块内添加：

```typescript
it('统计：僵尸被杀记录 zombiesKilled', () => {
  const mgr = createManager({
    waves: [{ zombieType: 'normal', count: 1, interval: 100 }],
  })
  // 生成僵尸
  mgr.update(200)
  const zombies = mgr.getZombies()
  expect(zombies.length).toBe(1)
  // 直接杀死僵尸
  zombies[0].takeDamage(9999)
  mgr.update(16)
  expect(mgr.getStats().zombiesKilled).toBeGreaterThanOrEqual(1)
})

it('统计：结算时记录 longestCombo 和 totalCombo', () => {
  const mgr = createManager()
  // 模拟连续输入触发结算
  const lane = mgr.getLane(0)
  const firstLetter = lane.currentLetter
  mgr.onKeyDown(firstLetter)
  mgr.onKeyDown(' ') // 空格结算
  const stats = mgr.getStats()
  expect(stats.totalCombo).toBe(1)
  expect(stats.longestCombo).toBe(1)
})
```

- [ ] **Step 2: 跑测试确认红色**

Run: `npx vitest run src/game/__tests__/BattleManager.test.ts`
Expected: FAIL — `mgr.getStats` is not a function

- [ ] **Step 3: 在 BattleManager 中集成 BattleStats**

修改 `src/game/BattleManager.ts`：

1. 顶部添加导入：
```typescript
import { BattleStats } from './BattleStats'
import type { BattleStatsData } from './BattleStats'
```

2. 构造函数中创建 stats 实例，在 `private projectileIdCounter = 0` 后添加：
```typescript
private readonly stats = new BattleStats()
```

3. 添加 getter：
```typescript
getStats(): BattleStatsData {
  return this.stats.getStats()
}
```

4. 在 `updateCollisions` 方法中，僵尸死亡时（`if (!z.active)` 后）添加：
```typescript
this.stats.recordKill()
```

5. 在 `updateMissed` 方法中，`this._missedCount++` 后添加：
```typescript
this.stats.recordMiss()
```

6. 在 `executeSettlement` 方法中，`const result = calculateSettlement(...)` 之后添加：
```typescript
this.stats.recordCombo(comboCount)
if (result.aliveActivatedIndices.length >= 2) {
  this.stats.recordSynergy()
}
if (isFullChain) {
  this.stats.recordFullChain()
}
```

- [ ] **Step 4: 跑测试确认绿色**

Run: `npx vitest run src/game/__tests__/BattleManager.test.ts`
Expected: PASS — 包括新增的统计测试

- [ ] **Step 5: 跑全量测试**

Run: `npx vitest run`
Expected: 全部通过

- [ ] **Step 6: 提交**

```bash
git add src/game/BattleManager.ts src/game/__tests__/BattleManager.test.ts
git commit -m "feat(game): integrate BattleStats into BattleManager"
```

---

## Task 5: 结算配置 + 称号匹配

**Files:**
- Create: `src/config/settlement.ts`
- Modify: `src/config/types.ts`
- Modify: `src/config/index.ts`
- Create: `src/game/TitleMatcher.ts`
- Create: `src/game/__tests__/TitleMatcher.test.ts`

- [ ] **Step 1: 在 config/types.ts 中添加类型**

在 `src/config/types.ts` 文件尾部添加：

```typescript
/** 称号规则（纯数据，判定逻辑在游戏层） */
export interface TitleRule {
  readonly id: string
  readonly name: string
  readonly requires: {
    readonly zeroMissed?: boolean
    readonly minLongestCombo?: number
    readonly minSynergyCount?: number
    readonly minFullChainCount?: number
  }
}

/** 结算配置 */
export interface SettlementConfig {
  readonly titleRules: readonly TitleRule[]
  readonly defaultVictoryTitle: string
  readonly encouragements: readonly string[]
}
```

- [ ] **Step 2: 创建结算配置文件**

```typescript
// src/config/settlement.ts
import type { SettlementConfig } from './types'

export const SETTLEMENT_CONFIG: SettlementConfig = {
  titleRules: [
    {
      id: 'perfect_commander',
      name: '完美指挥官',
      requires: { zeroMissed: true, minFullChainCount: 3 },
    },
    {
      id: 'no_miss',
      name: '滴水不漏',
      requires: { zeroMissed: true },
    },
    {
      id: 'combo_master',
      name: '连击大师',
      requires: { minLongestCombo: 20 },
    },
    {
      id: 'synergy_pro',
      name: '协同达人',
      requires: { minSynergyCount: 5 },
    },
    {
      id: 'full_chain_expert',
      name: '全链专家',
      requires: { minFullChainCount: 3 },
    },
  ],
  defaultVictoryTitle: '勇敢的键盘侠',
  encouragements: [
    '僵尸们也被你的勇气吓到了！再来一次？',
    '差一点点就成功了，加油！',
    '每个键盘侠都是从失败中成长的！',
    '僵尸只是运气好，再试试看？',
    '你已经很棒了，再挑战一次吧！',
  ],
}
```

- [ ] **Step 3: 更新 config/index.ts 导出**

在 `src/config/index.ts` 中添加：
```typescript
export { SETTLEMENT_CONFIG } from './settlement'
export type { TitleRule, SettlementConfig } from './types'
```

- [ ] **Step 4: 写 TitleMatcher 测试**

```typescript
// src/game/__tests__/TitleMatcher.test.ts
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
    zombiesKilled: 0,
    longestCombo: 0,
    totalCombo: 0,
    synergyCount: 0,
    missedCount: 0,
    fullChainCount: 0,
    ...overrides,
  }
}

describe('matchTitle', () => {
  it('零放过 + 满链 ≥3 匹配完美指挥官', () => {
    const stats = makeStats({ missedCount: 0, fullChainCount: 5 })
    expect(matchTitle(stats, RULES, DEFAULT_TITLE)).toBe('完美指挥官')
  })

  it('零放过但满链 <3 匹配滴水不漏', () => {
    const stats = makeStats({ missedCount: 0, fullChainCount: 1 })
    expect(matchTitle(stats, RULES, DEFAULT_TITLE)).toBe('滴水不漏')
  })

  it('连击 ≥20 匹配连击大师', () => {
    const stats = makeStats({ missedCount: 2, longestCombo: 25 })
    expect(matchTitle(stats, RULES, DEFAULT_TITLE)).toBe('连击大师')
  })

  it('协同 ≥5 匹配协同达人', () => {
    const stats = makeStats({ missedCount: 1, synergyCount: 7 })
    expect(matchTitle(stats, RULES, DEFAULT_TITLE)).toBe('协同达人')
  })

  it('满链 ≥3 匹配全链专家', () => {
    const stats = makeStats({ missedCount: 1, fullChainCount: 4 })
    expect(matchTitle(stats, RULES, DEFAULT_TITLE)).toBe('全链专家')
  })

  it('都不满足返回默认称号', () => {
    const stats = makeStats({ missedCount: 2, longestCombo: 5, synergyCount: 1, fullChainCount: 1 })
    expect(matchTitle(stats, RULES, DEFAULT_TITLE)).toBe('勇敢的键盘侠')
  })

  it('空规则列表返回默认称号', () => {
    const stats = makeStats({ missedCount: 0 })
    expect(matchTitle(stats, [], DEFAULT_TITLE)).toBe('勇敢的键盘侠')
  })
})
```

- [ ] **Step 5: 跑测试确认红色**

Run: `npx vitest run src/game/__tests__/TitleMatcher.test.ts`
Expected: FAIL

- [ ] **Step 6: 实现 TitleMatcher**

```typescript
// src/game/TitleMatcher.ts
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
```

注意：`TitleMatcher` 放在 `game/` 层（游戏逻辑），但它导入了 `config/types` 的类型定义。这只是类型导入（`import type`），不是值导入，不违反架构原则（游戏层不直接导入配置层的运行时值）。规则数据本身由场景层传入。

- [ ] **Step 7: 跑测试确认绿色**

Run: `npx vitest run src/game/__tests__/TitleMatcher.test.ts`
Expected: PASS — 7 tests

- [ ] **Step 8: 跑全量测试**

Run: `npx vitest run`
Expected: 全部通过

- [ ] **Step 9: 提交**

```bash
git add src/config/types.ts src/config/settlement.ts src/config/index.ts src/game/TitleMatcher.ts src/game/__tests__/TitleMatcher.test.ts
git commit -m "feat(config+game): add settlement config (title rules, encouragements) + TitleMatcher"
```

---

## Task 6: 难度配置 displayName

**Files:**
- Modify: `src/config/types.ts`
- Modify: `src/config/difficulty.ts`

- [ ] **Step 1: 在 DifficultyDef 中添加 displayName**

在 `src/config/types.ts` 中修改 `DifficultyDef`：

```typescript
export interface DifficultyDef {
  readonly missedLimit: number
  readonly zombieSpeedMultiplier: number
  readonly displayName: string
}
```

- [ ] **Step 2: 更新 difficulty.ts**

```typescript
// src/config/difficulty.ts
import type { DifficultyDef } from './types'

export const DIFFICULTIES: Readonly<Record<string, DifficultyDef>> = {
  easy:   { missedLimit: 5, zombieSpeedMultiplier: 0.8, displayName: '简单' },
  normal: { missedLimit: 3, zombieSpeedMultiplier: 1.0, displayName: '普通' },
  hard:   { missedLimit: 1, zombieSpeedMultiplier: 1.2, displayName: '困难' },
}

export const DEFAULT_DIFFICULTY = 'normal'

export const DIFFICULTY_ORDER: readonly string[] = ['easy', 'normal', 'hard']
```

同时在 `src/config/index.ts` 中导出 `DIFFICULTY_ORDER`：
```typescript
export { DIFFICULTIES, DEFAULT_DIFFICULTY, DIFFICULTY_ORDER } from './difficulty'
```

- [ ] **Step 3: 跑全量测试确认无回归**

Run: `npx vitest run`
Expected: 全部通过（DifficultyDef 新增只读字段，不影响现有代码）

- [ ] **Step 4: 提交**

```bash
git add src/config/types.ts src/config/difficulty.ts src/config/index.ts
git commit -m "feat(config): add displayName to DifficultyDef + DIFFICULTY_ORDER"
```

---

## Task 7: SettlementScene 结算场景

**Files:**
- Create: `src/scenes/SettlementScene.ts`

- [ ] **Step 1: 实现 SettlementScene**

```typescript
// src/scenes/SettlementScene.ts
import type { Scene, InputEvent } from '../engine/types'
import type { BattleStatsData } from '../game/BattleStats'

export interface SettlementSceneParams {
  result: 'victory' | 'defeat'
  stats: BattleStatsData
  stars: number               // 0（失败）或 1-3
  title: string               // 称号或鼓励语
  stageIndex: number
  levelIndex: number
}

type SettlementAction = 'continue' | 'replay' | 'select'

export class SettlementScene implements Scene {
  readonly name = 'settlement'
  private switchTo: (name: string) => void
  private onAction: ((action: SettlementAction, stageIndex: number, levelIndex: number) => void) | null = null
  private params: SettlementSceneParams | null = null
  private canvasWidth = 0
  private canvasHeight = 0

  constructor(switchTo: (name: string) => void) {
    this.switchTo = switchTo
  }

  setActionHandler(fn: (action: SettlementAction, stageIndex: number, levelIndex: number) => void): void {
    this.onAction = fn
  }

  setParams(params: SettlementSceneParams): void {
    this.params = params
  }

  getParams(): SettlementSceneParams | null {
    return this.params
  }

  enter(): void {
    this.canvasWidth = typeof window !== 'undefined' ? window.innerWidth : 800
    this.canvasHeight = typeof window !== 'undefined' ? window.innerHeight : 600
  }

  exit(): void {}
  update(_dt: number): void {}

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.params) return
    const { result, stats, stars, title } = this.params
    const w = this.canvasWidth
    const h = this.canvasHeight

    // 背景
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, w, h)
    ctx.textAlign = 'center'

    // 称号/鼓励语
    ctx.fillStyle = result === 'victory' ? '#ffd700' : '#e94560'
    ctx.font = 'bold 40px sans-serif'
    ctx.fillText(title, w / 2, h * 0.18)

    // 星级（仅通关）
    if (result === 'victory' && stars > 0) {
      ctx.font = '36px sans-serif'
      const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars)
      ctx.fillStyle = '#ffd700'
      ctx.fillText(starStr, w / 2, h * 0.28)
    }

    // 数据列表
    const dataStartY = h * 0.38
    const lineHeight = 36
    const labels = [
      { label: '击杀僵尸', value: stats.zombiesKilled },
      { label: '最长连击', value: stats.longestCombo },
      { label: '协同攻击', value: stats.synergyCount },
      { label: '放过僵尸', value: stats.missedCount },
    ]

    ctx.font = '22px sans-serif'
    for (let i = 0; i < labels.length; i++) {
      const y = dataStartY + i * lineHeight
      ctx.fillStyle = '#aaaaaa'
      ctx.textAlign = 'right'
      ctx.fillText(labels[i].label, w / 2 - 20, y)
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'left'
      ctx.fillText(String(labels[i].value), w / 2 + 20, y)
    }

    // 按钮提示
    const btnY = h * 0.72
    ctx.font = '20px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffffff'

    if (result === 'victory') {
      ctx.fillText('[Enter] 继续    [R] 重玩', w / 2, btnY)
    } else {
      ctx.fillText('[Enter] 重试    [Esc] 选关', w / 2, btnY)
    }
  }

  handleInput(event: InputEvent): void {
    if (event.type !== 'keydown' || !this.params) return

    const { result, stageIndex, levelIndex } = this.params

    if (result === 'victory') {
      if (event.key === 'Enter') {
        this.onAction?.('continue', stageIndex, levelIndex)
      } else if (event.key === 'r' || event.key === 'R') {
        this.onAction?.('replay', stageIndex, levelIndex)
      }
    } else {
      if (event.key === 'Enter') {
        this.onAction?.('replay', stageIndex, levelIndex)
      } else if (event.key === 'Escape') {
        this.onAction?.('select', stageIndex, levelIndex)
      }
    }
  }
}
```

- [ ] **Step 2: 跑全量测试确认无回归**

Run: `npx vitest run`
Expected: 全部通过

- [ ] **Step 3: 提交**

```bash
git add src/scenes/SettlementScene.ts
git commit -m "feat(scenes): add SettlementScene with stats display, stars, and titles"
```

---

## Task 8: StageSelectScene 关卡选择场景

**Files:**
- Create: `src/scenes/StageSelectScene.ts`

- [ ] **Step 1: 实现 StageSelectScene**

```typescript
// src/scenes/StageSelectScene.ts
import type { Scene, InputEvent } from '../engine/types'
import type { StageDef } from '../config/types'
import type { SaveData } from '../game/SaveDataService'

type SelectAction = 'play' | 'back'

export class StageSelectScene implements Scene {
  readonly name = 'stageSelect'
  private switchTo: (name: string) => void
  private onAction: ((action: SelectAction, stageIndex: number, levelIndex: number) => void) | null = null
  private stages: readonly StageDef[] = []
  private saveData: SaveData | null = null
  private canvasWidth = 0
  private canvasHeight = 0
  private cursorStage = 0
  private cursorLevel = 0
  private scrollY = 0

  constructor(switchTo: (name: string) => void) {
    this.switchTo = switchTo
  }

  setActionHandler(fn: (action: SelectAction, stageIndex: number, levelIndex: number) => void): void {
    this.onAction = fn
  }

  setData(stages: readonly StageDef[], saveData: SaveData): void {
    this.stages = stages
    this.saveData = saveData
    // 光标初始化到当前进度位置
    this.cursorStage = saveData.currentStageIndex
    this.cursorLevel = saveData.currentLevelIndex
    this.scrollY = 0
  }

  enter(): void {
    this.canvasWidth = typeof window !== 'undefined' ? window.innerWidth : 800
    this.canvasHeight = typeof window !== 'undefined' ? window.innerHeight : 600
  }

  exit(): void {}
  update(_dt: number): void {}

  private isStageUnlocked(stageIndex: number): boolean {
    if (!this.saveData) return false
    if (stageIndex === 0) return true
    // 上一阶段最后一关是否通关
    const prevStage = this.stages[stageIndex - 1]
    const prevLastLevelId = `${stageIndex - 1}-${prevStage.levels.length - 1}`
    return this.saveData.completedLevels.includes(prevLastLevelId)
  }

  private isLevelUnlocked(stageIndex: number, levelIndex: number): boolean {
    if (!this.saveData) return false
    if (stageIndex === 0 && levelIndex === 0) return true
    // 前一关 ID
    let prevId: string
    if (levelIndex > 0) {
      prevId = `${stageIndex}-${levelIndex - 1}`
    } else {
      // 跨阶段：上一阶段最后一关
      const prevStage = this.stages[stageIndex - 1]
      prevId = `${stageIndex - 1}-${prevStage.levels.length - 1}`
    }
    return this.saveData.completedLevels.includes(prevId)
  }

  private isLevelCompleted(stageIndex: number, levelIndex: number): boolean {
    if (!this.saveData) return false
    return this.saveData.completedLevels.includes(`${stageIndex}-${levelIndex}`)
  }

  private getStars(stageIndex: number, levelIndex: number): number {
    if (!this.saveData) return 0
    return this.saveData.bestStars[`${stageIndex}-${levelIndex}`] ?? 0
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.saveData) return
    const w = this.canvasWidth
    const h = this.canvasHeight

    // 背景
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, w, h)

    // 顶栏
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 28px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('选择关卡', w / 2, 40)
    ctx.font = '16px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('[Esc] 返回', 20, 40)

    // 阶段列表
    let y = 80 - this.scrollY
    const stageHeight = 40
    const levelHeight = 30

    for (let si = 0; si < this.stages.length; si++) {
      const stage = this.stages[si]
      const unlocked = this.isStageUnlocked(si)

      // 阶段标题
      ctx.font = 'bold 22px sans-serif'
      ctx.textAlign = 'left'
      if (unlocked) {
        ctx.fillStyle = '#e94560'
        ctx.fillText(`▼ 阶段${si + 1}：${stage.name}`, 40, y)
      } else {
        ctx.fillStyle = '#555555'
        ctx.fillText(`🔒 阶段${si + 1}：${stage.name}`, 40, y)
      }
      y += stageHeight

      if (!unlocked) continue

      // 展开关卡列表
      for (let li = 0; li < stage.levels.length; li++) {
        const levelUnlocked = this.isLevelUnlocked(si, li)
        if (!levelUnlocked) break  // 严格线性，未解锁后面都不显示

        const completed = this.isLevelCompleted(si, li)
        const isCursor = si === this.cursorStage && li === this.cursorLevel
        const stars = this.getStars(si, li)

        ctx.font = '18px sans-serif'
        ctx.textAlign = 'left'

        // 高亮当前光标
        if (isCursor) {
          ctx.fillStyle = 'rgba(233, 69, 96, 0.2)'
          ctx.fillRect(60, y - 18, w - 120, levelHeight)
        }

        if (completed) {
          const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars)
          ctx.fillStyle = '#ffd700'
          ctx.fillText(starStr, 80, y)
          ctx.fillStyle = '#ffffff'
          ctx.fillText(`关卡 ${li + 1}`, 160, y)
        } else {
          ctx.fillStyle = '#aaaaaa'
          ctx.fillText('○', 80, y)
          ctx.fillStyle = '#ffffff'
          ctx.fillText(`关卡 ${li + 1}`, 160, y)
        }

        y += levelHeight
      }

      y += 10 // 阶段间距
    }
  }

  handleInput(event: InputEvent): void {
    if (event.type !== 'keydown') return

    if (event.key === 'Escape') {
      this.onAction?.('back', 0, 0)
      return
    }

    if (event.key === 'Enter') {
      // 确认选择当前光标位置
      if (this.isLevelUnlocked(this.cursorStage, this.cursorLevel)) {
        this.onAction?.('play', this.cursorStage, this.cursorLevel)
      }
      return
    }

    // 上下键移动光标
    if (event.key === 'ArrowUp') {
      this.moveCursor(-1)
    } else if (event.key === 'ArrowDown') {
      this.moveCursor(1)
    }
  }

  private moveCursor(direction: number): void {
    // 收集所有可访问的关卡列表
    const entries: { stage: number; level: number }[] = []
    for (let si = 0; si < this.stages.length; si++) {
      if (!this.isStageUnlocked(si)) break
      for (let li = 0; li < this.stages[si].levels.length; li++) {
        if (!this.isLevelUnlocked(si, li)) break
        entries.push({ stage: si, level: li })
      }
    }

    // 找当前位置
    const currentIdx = entries.findIndex(
      e => e.stage === this.cursorStage && e.level === this.cursorLevel
    )
    if (currentIdx < 0) return

    const newIdx = Math.max(0, Math.min(entries.length - 1, currentIdx + direction))
    this.cursorStage = entries[newIdx].stage
    this.cursorLevel = entries[newIdx].level
  }
}
```

- [ ] **Step 2: 跑全量测试确认无回归**

Run: `npx vitest run`
Expected: 全部通过

- [ ] **Step 3: 提交**

```bash
git add src/scenes/StageSelectScene.ts
git commit -m "feat(scenes): add StageSelectScene with stage/level navigation"
```

---

## Task 9: 改造 MenuScene

**Files:**
- Modify: `src/scenes/MenuScene.ts`

- [ ] **Step 1: 重写 MenuScene**

完全替换 `src/scenes/MenuScene.ts` 内容：

```typescript
// src/scenes/MenuScene.ts
import type { Scene, InputEvent } from '../engine/types'
import type { StageDef, DifficultyDef } from '../config/types'
import type { SaveData } from '../game/SaveDataService'

type MenuAction = 'continue' | 'select' | 'difficulty'

export class MenuScene implements Scene {
  readonly name = 'menu'
  private switchTo: (name: string) => void
  private onAction: ((action: MenuAction) => void) | null = null
  private stages: readonly StageDef[] = []
  private saveData: SaveData | null = null
  private difficulties: Readonly<Record<string, DifficultyDef>> = {}
  private difficultyOrder: readonly string[] = []
  private canvasWidth = 0
  private canvasHeight = 0

  constructor(switchTo: (name: string) => void) {
    this.switchTo = switchTo
  }

  setActionHandler(fn: (action: MenuAction) => void): void {
    this.onAction = fn
  }

  setData(
    stages: readonly StageDef[],
    saveData: SaveData,
    difficulties: Readonly<Record<string, DifficultyDef>>,
    difficultyOrder: readonly string[],
  ): void {
    this.stages = stages
    this.saveData = saveData
    this.difficulties = difficulties
    this.difficultyOrder = difficultyOrder
  }

  enter(): void {
    this.canvasWidth = typeof window !== 'undefined' ? window.innerWidth : 800
    this.canvasHeight = typeof window !== 'undefined' ? window.innerHeight : 600
  }

  exit(): void {}
  update(_dt: number): void {}

  render(ctx: CanvasRenderingContext2D): void {
    const w = this.canvasWidth
    const h = this.canvasHeight

    // 背景
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, w, h)
    ctx.textAlign = 'center'

    // 标题
    ctx.fillStyle = '#e94560'
    ctx.font = 'bold 48px sans-serif'
    ctx.fillText('键盘侠大战僵尸', w / 2, h * 0.22)

    // 进度信息
    if (this.saveData && this.stages.length > 0) {
      const si = this.saveData.currentStageIndex
      const li = this.saveData.currentLevelIndex
      const allCompleted = this.isAllCompleted()

      if (allCompleted) {
        ctx.fillStyle = '#ffd700'
        ctx.font = '20px sans-serif'
        ctx.fillText('全部通关！', w / 2, h * 0.34)
      } else if (si < this.stages.length) {
        const stage = this.stages[si]
        ctx.fillStyle = '#aaaaaa'
        ctx.font = '20px sans-serif'
        ctx.fillText(`当前进度：${stage.name}`, w / 2, h * 0.34)
        ctx.fillText(`关卡 ${li + 1} / ${stage.levels.length}`, w / 2, h * 0.40)
      }

      // 继续 按钮
      ctx.fillStyle = '#e94560'
      ctx.font = 'bold 28px sans-serif'
      const continueText = allCompleted ? '[Enter] 自由练习' : '[Enter] 继续'
      ctx.fillText(continueText, w / 2, h * 0.54)

      // 选关 按钮
      ctx.fillStyle = '#ffffff'
      ctx.font = '22px sans-serif'
      ctx.fillText('[S] 选关', w / 2, h * 0.64)

      // 难度 按钮
      const diffKey = this.saveData.difficulty
      const diffDef = this.difficulties[diffKey]
      const diffName = diffDef?.displayName ?? diffKey
      ctx.fillText(`[D] 难度：${diffName}`, w / 2, h * 0.72)
    }
  }

  handleInput(event: InputEvent): void {
    if (event.type !== 'keydown') return

    if (event.key === 'Enter') {
      this.onAction?.('continue')
      return
    }

    if (event.key === 's' || event.key === 'S') {
      this.onAction?.('select')
      return
    }

    if (event.key === 'd' || event.key === 'D') {
      this.onAction?.('difficulty')
      return
    }
  }

  private isAllCompleted(): boolean {
    if (!this.saveData) return false
    const si = this.saveData.currentStageIndex
    const li = this.saveData.currentLevelIndex
    const currentId = `${si}-${li}`
    return this.saveData.completedLevels.includes(currentId)
  }
}
```

- [ ] **Step 2: 跑全量测试确认无回归**

Run: `npx vitest run`
Expected: 全部通过（MenuScene 没有自己的测试，但其他测试不应引用它）

- [ ] **Step 3: 提交**

```bash
git add src/scenes/MenuScene.ts
git commit -m "refactor(scenes): rewrite MenuScene with progress display and navigation"
```

---

## Task 10: 改造 BattleScene + 星级计算

**Files:**
- Modify: `src/scenes/BattleScene.ts`

- [ ] **Step 1: 改造 BattleScene**

修改 `src/scenes/BattleScene.ts`，需要做以下变更：

1. 添加导入：
```typescript
import type { BattleStatsData } from '../game/BattleStats'
import { matchTitle } from '../game/TitleMatcher'
import { SETTLEMENT_CONFIG } from '../config'
```

2. 添加回调属性和方法（在 `private levelIndex = 0` 后）：
```typescript
private onBattleEnd: ((params: {
  result: 'victory' | 'defeat'
  stats: BattleStatsData
  stars: number
  title: string
  stageIndex: number
  levelIndex: number
}) => void) | null = null

setBattleEndHandler(fn: typeof this.onBattleEnd): void {
  this.onBattleEnd = fn
}
```

3. 修改 `handleInput` 中的 Victory/Defeat 处理 — 不再在 BattleScene 内处理 SPACE 键跳转，改为触发回调。替换 Victory 和 Defeat 的 SPACE 处理：

替换这段代码（约行 292-306）：
```typescript
    if (status === BattleStatus.Victory && event.key === ' ') {
      const stage = STAGES[this.stageIndex]
      if (this.levelIndex + 1 < stage.levels.length) {
        this.levelIndex++
        this.enter()
      } else {
        this.switchTo('menu')
      }
      return
    }

    if (status === BattleStatus.Defeat && event.key === ' ') {
      this.enter()
      return
    }
```

改为：
```typescript
    if ((status === BattleStatus.Victory || status === BattleStatus.Defeat) && this.onBattleEnd) {
      // 不在 BattleScene 内处理结局跳转，等待外部回调处理
      // 但需要在首次检测到结局时触发一次回调
      return
    }
```

4. 在 `update` 方法中检测状态变化并触发回调。在 `this.manager.update(dt)` 之后（同步 PlantEntity 之前），添加状态变化检测：

在类中添加属性（`private levelIndex = 0` 后）：
```typescript
private battleEnded = false
```

在 `enter()` 中重置：
```typescript
this.battleEnded = false
```

在 `update()` 中 `this.manager.update(dt)` 之后添加：
```typescript
    // 检测战斗结束
    if (!this.battleEnded && (this.manager.status === BattleStatus.Victory || this.manager.status === BattleStatus.Defeat)) {
      this.battleEnded = true
      if (this.onBattleEnd) {
        const stats = this.manager.getStats()
        const result = this.manager.status === BattleStatus.Victory ? 'victory' as const : 'defeat' as const
        const stars = result === 'victory' ? this.calculateStars(stats) : 0
        const title = result === 'victory'
          ? matchTitle(stats, SETTLEMENT_CONFIG.titleRules, SETTLEMENT_CONFIG.defaultVictoryTitle)
          : SETTLEMENT_CONFIG.encouragements[Math.floor(Math.random() * SETTLEMENT_CONFIG.encouragements.length)]
        this.onBattleEnd({ result, stats, stars, title, stageIndex: this.stageIndex, levelIndex: this.levelIndex })
      }
    }
```

5. 添加星级计算方法：
```typescript
  private calculateStars(stats: BattleStatsData): number {
    if (stats.missedCount === 0) return 3
    if (stats.missedCount <= Math.floor(this.manager!.missedLimit / 2)) return 2
    return 1
  }
```

6. 移除 render 中的 Victory/Defeat 覆盖层绘制代码（约行 244-271），因为结算场景会取代它。但保留一个简单的"战斗结束"提示，以防回调处理期间画面空白：

替换 Victory/Defeat overlays 代码为：
```typescript
      if (status === BattleStatus.Victory || status === BattleStatus.Defeat) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
        ctx.fillRect(0, 0, w, h)
      }
```

- [ ] **Step 2: 跑全量测试**

Run: `npx vitest run`
Expected: 全部通过

- [ ] **Step 3: 提交**

```bash
git add src/scenes/BattleScene.ts
git commit -m "refactor(scenes): BattleScene delegates victory/defeat to settlement callback"
```

---

## Task 11: App.tsx 组装全部场景

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 重写 App.tsx 组装逻辑**

完全替换 `src/App.tsx` 内容：

```typescript
// src/App.tsx
import { useEffect, useRef } from 'react'
import { GameLoop } from './engine/GameLoop'
import { SceneManager } from './engine/SceneManager'
import { InputManager } from './engine/InputManager'
import { Renderer } from './engine/Renderer'
import { LocalStorage } from './engine/Storage'
import { SaveDataService } from './game/SaveDataService'
import { MenuScene } from './scenes/MenuScene'
import { BattleScene } from './scenes/BattleScene'
import { SettlementScene } from './scenes/SettlementScene'
import { StageSelectScene } from './scenes/StageSelectScene'
import { STAGES, DIFFICULTIES, DIFFICULTY_ORDER } from './config'

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new Renderer()
    renderer.attach(canvas)

    const sceneManager = new SceneManager()
    const inputManager = new InputManager()
    const gameLoop = new GameLoop()
    const storage = new LocalStorage()
    const saveService = new SaveDataService(storage)

    const switchTo = (name: string) => sceneManager.switchTo(name)

    // --- Scenes ---
    const menuScene = new MenuScene(switchTo)
    const battleScene = new BattleScene(switchTo)
    const settlementScene = new SettlementScene(switchTo)
    const stageSelectScene = new StageSelectScene(switchTo)

    sceneManager.register(menuScene)
    sceneManager.register(battleScene)
    sceneManager.register(settlementScene)
    sceneManager.register(stageSelectScene)

    // --- 刷新菜单数据 ---
    const refreshMenu = () => {
      menuScene.setData(STAGES, saveService.load(), DIFFICULTIES, DIFFICULTY_ORDER)
    }

    // --- MenuScene actions ---
    menuScene.setActionHandler((action) => {
      if (action === 'continue') {
        const save = saveService.load()
        battleScene.setLevel(save.currentStageIndex, save.currentLevelIndex)
        switchTo('battle')
      } else if (action === 'select') {
        stageSelectScene.setData(STAGES, saveService.load())
        switchTo('stageSelect')
      } else if (action === 'difficulty') {
        const save = saveService.load()
        const currentIdx = DIFFICULTY_ORDER.indexOf(save.difficulty)
        const nextIdx = (currentIdx + 1) % DIFFICULTY_ORDER.length
        saveService.setDifficulty(DIFFICULTY_ORDER[nextIdx])
        refreshMenu()
      }
    })

    // --- BattleScene end handler ---
    battleScene.setBattleEndHandler((params) => {
      settlementScene.setParams(params)
      switchTo('settlement')
    })

    // --- SettlementScene actions ---
    settlementScene.setActionHandler((action, stageIndex, levelIndex) => {
      if (action === 'continue') {
        // 写入存档，推进到下一关
        const stage = STAGES[stageIndex]
        const stars = settlementScene.getParams()?.stars ?? 1
        const hasNextStage = stageIndex + 1 < STAGES.length
        saveService.completeLevel(stageIndex, levelIndex, stars, stage.levels.length, hasNextStage)

        const save = saveService.load()
        if (saveService.isAllCompleted()) {
          refreshMenu()
          switchTo('menu')
        } else {
          battleScene.setLevel(save.currentStageIndex, save.currentLevelIndex)
          switchTo('battle')
        }
      } else if (action === 'replay') {
        battleScene.setLevel(stageIndex, levelIndex)
        switchTo('battle')
      } else if (action === 'select') {
        stageSelectScene.setData(STAGES, saveService.load())
        switchTo('stageSelect')
      }
    })

    // --- StageSelectScene actions ---
    stageSelectScene.setActionHandler((action, stageIndex, levelIndex) => {
      if (action === 'play') {
        battleScene.setLevel(stageIndex, levelIndex)
        switchTo('battle')
      } else if (action === 'back') {
        refreshMenu()
        switchTo('menu')
      }
    })

    // --- Input ---
    inputManager.addListener((event) => sceneManager.handleInput(event))
    inputManager.attach(window)

    // --- Resize ---
    const handleResize = () => {
      renderer.resize(window.innerWidth, window.innerHeight)
    }
    handleResize()
    window.addEventListener('resize', handleResize)

    // --- Start ---
    refreshMenu()
    sceneManager.switchTo('menu')
    const ctx = renderer.getContext()!
    gameLoop.start(sceneManager, ctx)

    return () => {
      gameLoop.stop()
      inputManager.detach(window)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <div id="game-root">
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  )
}
```

注意：App.tsx 中通过 `settlementScene.getParams()` 获取参数，需要在 SettlementScene 中添加对应 getter（已在 Task 7 的 SettlementScene 实现中包含 `setParams`，在此处补充 `getParams`）。

- [ ] **Step 2: 跑全量测试**

Run: `npx vitest run`
Expected: 全部通过

- [ ] **Step 3: 启动 dev server 验证**

Run: `npm run dev`

验证项：
1. 主菜单显示进度信息（首次为"阶段1 关卡1/2"）
2. 按 Enter 进入战斗
3. 通关后进入结算场景（显示称号 + 星级 + 数据）
4. 按 Enter 继续下一关
5. 失败后进入结算场景（显示鼓励语 + 数据）
6. 按 Enter 重试，按 Esc 选关
7. 按 S 进入关卡选择，上下键移动，Enter 选中
8. 按 D 切换难度，文案实时更新
9. 刷新页面后进度保留
10. ESC 从战斗回菜单

- [ ] **Step 4: 提交**

```bash
git add src/App.tsx src/scenes/SettlementScene.ts
git commit -m "feat: wire up all scenes in App.tsx with SaveDataService integration"
```

---

## Task 12: 端到端验收 + 修复

- [ ] **Step 1: 跑全量测试**

Run: `npx vitest run`
Expected: 全部通过

- [ ] **Step 2: 启动 dev server 完整流程验收**

Run: `npm run dev`

完整验收清单：
1. **首次启动**：主菜单显示"阶段1 关卡1/2"，难度"普通"
2. **继续按钮**：Enter 进入第一关战斗
3. **战斗正常**：打字、连击、弹道、僵尸行为一切正常
4. **通关结算**：显示称号 + 星级 + 4 项数据 + 按钮提示
5. **继续下一关**：Enter 进入下一关
6. **失败结算**：显示鼓励语 + 数据 + 按钮提示
7. **重试**：Enter 重新开始当前关
8. **选关**：Esc 进入关卡选择界面
9. **关卡选择**：上下键导航，已通关显示星级，未解锁灰显
10. **难度切换**：D 键循环切换，显示中文名称
11. **进度持久化**：刷新页面后进度、星级、难度都保留
12. **ESC 退出**：战斗中 ESC 回菜单
13. **暂停**：战斗中 P 键暂停/恢复

- [ ] **Step 3: 修复验收中发现的问题**

根据实际测试结果修复 bug。常见可能的问题：
- Canvas 文字定位在不同分辨率下可能偏移 → 使用百分比定位
- 关卡选择光标越界 → `moveCursor` 边界检查
- 结算场景按键需要防止在过渡帧触发 → 在 enter() 中加延迟标记

- [ ] **Step 4: 跑全量测试确认无回归**

Run: `npx vitest run`
Expected: 全部通过

- [ ] **Step 5: 提交修复**

```bash
git add -A
git commit -m "fix: address issues found during Stage 5A acceptance testing"
```

---

## Task 13: 更新文档

**Files:**
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: 更新 ROADMAP.md 阶段五完成标准**

在 `docs/ROADMAP.md` 的阶段五部分，标记 A 组完成的项目：
- [x] 关闭浏览器重开后进度不丢失（5.4 持久化）
- [x] 从第 1 阶段打到最后一个阶段的完整流程可走通（5.1 阶段解锁）
- [x] 每关结束有数据总结（5.5 结算界面）

添加实现记录（参照之前阶段的格式），记录文件数、测试数等。

- [ ] **Step 2: 提交**

```bash
git add docs/ROADMAP.md
git commit -m "docs: update ROADMAP with Stage 5A completion status"
```
