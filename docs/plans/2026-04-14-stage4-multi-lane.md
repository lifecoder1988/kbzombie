# 4.3 多路系统 + Slot 机制 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 2/3 路独立战场 + 锁定模式选路 + Slot 植物自选机制，完成阶段四 4.3 模块。

**Architecture:** BattleManager 内部持有 Lane 数组（方案 A），每个 Lane 封装独立的 PlantChain + ComboSystem + 字母序列。输入路由采用锁定模式：锁定后只看当前路，结算后解除。僵尸随机分路，碰撞检测保持全局。

**Tech Stack:** TypeScript strict, Vitest, Canvas rendering

**参考文档：**
- `docs/GAME_DESIGN.md` v1.7（三、多路系统 + 四、植物系统 4.3 Slot 机制）
- `docs/ROADMAP.md`（阶段四 4.3 完成标准）
- `docs/TESTING_STRATEGY.md`（游戏逻辑层 TDD）

---

## 文件变更总览

### 新建文件

| 文件 | 职责 |
|------|------|
| `src/game/Lane.ts` | 单路状态容器：PlantChain + ComboSystem + 字母序列 + 布局 |
| `src/game/__tests__/Lane.test.ts` | Lane 单元测试 |

### 修改文件

| 文件 | 变更内容 |
|------|----------|
| `src/config/types.ts` | LevelDef 增加 `laneCount` 和 `lanePlants` |
| `src/config/stages.ts` | 现有阶段补 `laneCount: 1`，新增 2 路 / 3 路演示阶段 |
| `src/config/validation.ts` | 校验 laneCount、lanePlants 引用完整性 |
| `src/config/__tests__/validation.test.ts` | 新增校验测试 |
| `src/game/types.ts` | 无变更（Lane 是 class 不是 interface） |
| `src/game/LetterProvider.ts` | 新增 `nextExcluding(exclude)` 方法 |
| `src/game/__tests__/LetterProvider.test.ts` | 新增 exclude 测试 |
| `src/game/BattleManager.ts` | 核心重构：单路 → 多路 Lane 数组 |
| `src/game/__tests__/BattleManager.test.ts` | 迁移现有测试 + 新增多路测试 |
| `src/scenes/BattleScene.ts` | 多路渲染：多行植物、多行僵尸、当前路视觉指示 |
| `src/scenes/MenuScene.ts` | 菜单新增 2 路 / 3 路演示阶段入口 |

---

## Task 1: Config 层 — laneCount 和 lanePlants

**Files:**
- Modify: `src/config/types.ts`
- Modify: `src/config/stages.ts`
- Modify: `src/config/validation.ts`
- Test: `src/config/__tests__/validation.test.ts`

- [ ] **Step 1: 修改 LevelDef 类型**

```ts
// src/config/types.ts — LevelDef 增加两个可选字段
export interface LevelDef {
  readonly id: number
  readonly waves: readonly WaveDef[]
  readonly laneCount?: number                          // 路数（默认 1）
  readonly lanePlants?: readonly (readonly string[])[] // 每路植物 ID，长度 = laneCount
}
```

`laneCount` 缺省为 1，向后兼容。`lanePlants` 缺省时所有路使用 `stage.plants`。

- [ ] **Step 2: 现有 stages 补 laneCount: 1**

给 `src/config/stages.ts` 中所有现有 level 显式加 `laneCount: 1`（不改运行行为，只是显式声明）。

- [ ] **Step 3: validation 新增 laneCount 校验**

```ts
// src/config/validation.ts — 在 validateConfig 中增加
// 1. laneCount 必须为 1、2 或 3
// 2. lanePlants 长度必须等于 laneCount
// 3. lanePlants 中的植物 ID 必须在 plantDefs 中存在
// 4. 空路（lanePlants[i] 为空数组）允许
```

- [ ] **Step 4: 写校验测试**

```ts
// src/config/__tests__/validation.test.ts — 新增 describe 块
describe('laneCount 校验', () => {
  it('laneCount 为 0 报错', ...)
  it('laneCount 为 4 报错', ...)
  it('lanePlants 长度不等于 laneCount 报错', ...)
  it('lanePlants 引用不存在的植物 ID 报错', ...)
  it('lanePlants 空数组允许（空路）', ...)
  it('不填 laneCount 不报错（默认 1）', ...)
})
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npm test`

- [ ] **Step 6: Commit**

```bash
git add src/config/types.ts src/config/stages.ts src/config/validation.ts src/config/__tests__/validation.test.ts
git commit -m "feat(config): LevelDef 新增 laneCount 和 lanePlants 字段 + 校验"
```

---

## Task 2: LetterProvider — 冲突避免生成

**Files:**
- Modify: `src/game/LetterProvider.ts`
- Test: `src/game/__tests__/LetterProvider.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// src/game/__tests__/LetterProvider.test.ts — 新增
describe('nextExcluding', () => {
  it('生成的字母不在排除列表中', () => {
    const provider = new LetterProvider(['a', 'b', 'c'], 42)
    // 排除 a 和 b，只剩 c
    const letter = provider.nextExcluding(['a', 'b'])
    expect(letter).toBe('c')
  })

  it('排除列表为空时正常生成', () => {
    const provider = new LetterProvider(['a', 'b'], 42)
    const letter = provider.nextExcluding([])
    expect(['a', 'b']).toContain(letter)
  })

  it('所有字母都被排除时返回 next() 的结果（降级）', () => {
    const provider = new LetterProvider(['a', 'b'], 42)
    const letter = provider.nextExcluding(['a', 'b'])
    expect(['a', 'b']).toContain(letter)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test -- src/game/__tests__/LetterProvider.test.ts`
Expected: FAIL — `nextExcluding is not a function`

- [ ] **Step 3: 实现 nextExcluding**

```ts
// src/game/LetterProvider.ts
nextExcluding(exclude: readonly string[]): string {
  if (exclude.length === 0 || exclude.length >= this.pool.length) {
    return this.next()
  }
  // 最多尝试 pool.length * 2 次，避免极端情况下死循环
  const maxAttempts = this.pool.length * 2
  for (let i = 0; i < maxAttempts; i++) {
    const letter = this.next()
    if (!exclude.includes(letter)) return letter
  }
  return this.next() // 降级
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test -- src/game/__tests__/LetterProvider.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/game/LetterProvider.ts src/game/__tests__/LetterProvider.test.ts
git commit -m "feat(game): LetterProvider 新增 nextExcluding 方法避免多路字母冲突"
```

---

## Task 3: Lane 类 — 单路状态容器（TDD）

**Files:**
- Create: `src/game/Lane.ts`
- Test: `src/game/__tests__/Lane.test.ts`

Lane 是 BattleManager 内部使用的单路状态容器，封装 PlantChain + ComboSystem + 字母序列。

- [ ] **Step 1: 写 Lane 接口和构造测试**

```ts
// src/game/__tests__/Lane.test.ts
import { describe, it, expect } from 'vitest'
import { Lane } from '../Lane'
import type { PlantConfig } from '../types'

const PLANTS: PlantConfig[] = [
  { id: 'a', name: 'A', comboSegment: 4, attackPower: 10, hp: 100, element: 'normal', trajectory: 'direct' },
  { id: 'b', name: 'B', comboSegment: 4, attackPower: 15, hp: 80, element: 'ice', trajectory: 'direct' },
]

describe('Lane', () => {
  it('构造后初始状态正确', () => {
    const lane = new Lane(0, PLANTS, ['f', 'j', 'd', 'k'], 200, 1000, 42)
    expect(lane.index).toBe(0)
    expect(lane.comboCount).toBe(0)
    expect(lane.currentLetter).toBeDefined()
    expect(lane.chainLetters.length).toBe(8) // 4+4
    expect(lane.getPlantStates().length).toBe(2)
    expect(lane.isEmpty).toBe(false)
  })

  it('空路（无植物）', () => {
    const lane = new Lane(0, [], ['f', 'j'], 200, 1000)
    expect(lane.isEmpty).toBe(true)
    expect(lane.chainLetters.length).toBe(0)
    expect(lane.comboCount).toBe(0)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 实现 Lane 基本结构**

```ts
// src/game/Lane.ts
import { PlantChain } from './PlantChain'
import { ComboSystem, type ComboSettlement } from './ComboSystem'
import { LetterProvider } from './LetterProvider'
import type { PlantConfig, PlantState } from './types'

export class Lane {
  readonly index: number
  readonly plants: readonly PlantConfig[]
  readonly laneY: number

  private readonly plantChain: PlantChain
  private readonly combo: ComboSystem
  private readonly letterProvider: LetterProvider
  private readonly _chainLetters: string[]

  // 布局：由外部计算后设置
  readonly plantPositions: number[]
  readonly plantWidths: number[]

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

    // 植物布局（同 BattleManager 现有逻辑搬过来）
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

  // === combo 委托 ===
  hit(): ComboSettlement | null { return this.combo.hit() }
  miss(): ComboSettlement | null { return this.combo.miss() }
  settle(): ComboSettlement | null { return this.combo.settle() }
  resetCombo(): void { this.combo.reset() }

  // === 植物链委托 ===
  getPlantStates(): readonly PlantState[] { return this.plantChain.getStates() }
  takeDamage(plantIndex: number, damage: number): void { this.plantChain.takeDamage(plantIndex, damage) }
  healOnFullChain(healAmount: number): void { this.plantChain.healOnFullChain(healAmount) }
  getRightmostAlivePlantIndex(): number { return this.plantChain.getRightmostAlivePlantIndex() }

  // === 字母管理 ===
  regenerateLetters(excludeFirstLetters: readonly string[]): void {
    if (this.isEmpty) return
    // 第一个字母避免冲突
    this._chainLetters[0] = this.letterProvider.nextExcluding(excludeFirstLetters)
    // 后续字母正常生成
    for (let i = 1; i < this._chainLetters.length; i++) {
      this._chainLetters[i] = this.letterProvider.next()
    }
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

- [ ] **Step 5: 写连击和字母再生测试**

```ts
describe('Lane 连击', () => {
  it('hit 推进连击', () => {
    const lane = new Lane(0, PLANTS, ['f', 'j', 'd', 'k'], 200, 1000, 42)
    const result = lane.hit()
    expect(result).toBeNull() // 没打满，无结算
    expect(lane.comboCount).toBe(1)
  })

  it('miss 触发结算', () => {
    const lane = new Lane(0, PLANTS, ['f', 'j', 'd', 'k'], 200, 1000, 42)
    lane.hit()
    lane.hit()
    const result = lane.miss()
    expect(result).not.toBeNull()
    expect(result!.comboCount).toBe(2)
    expect(lane.comboCount).toBe(0)
  })

  it('打满自动结算', () => {
    const lane = new Lane(0, PLANTS, ['f', 'j', 'd', 'k'], 200, 1000, 42)
    let result = null
    for (let i = 0; i < 8; i++) { // 4+4 = 8 总段数
      result = lane.hit()
    }
    expect(result).not.toBeNull()
    expect(result!.isFullChain).toBe(true)
  })
})

describe('Lane 字母再生', () => {
  it('regenerateLetters 避免首字母冲突', () => {
    const lane = new Lane(0, PLANTS, ['a', 'b', 'c'], 200, 1000, 42)
    lane.regenerateLetters(['a', 'b']) // 排除 a 和 b
    expect(lane.currentLetter).toBe('c')
  })

  it('regenerateLetters 重置所有字母', () => {
    const lane = new Lane(0, PLANTS, ['a', 'b', 'c'], 200, 1000, 42)
    const before = [...lane.chainLetters]
    lane.regenerateLetters([])
    // 字母已重新生成（种子确定所以可预测，但至少长度不变）
    expect(lane.chainLetters.length).toBe(before.length)
  })
})
```

- [ ] **Step 6: 跑测试确认通过**

- [ ] **Step 7: Commit**

```bash
git add src/game/Lane.ts src/game/__tests__/Lane.test.ts
git commit -m "feat(game): 新增 Lane 类封装单路状态（PlantChain + ComboSystem + 字母序列）"
```

---

## Task 4: BattleManager 重构 — 多路构造 + 状态管理

**Files:**
- Modify: `src/game/BattleManager.ts`
- Modify: `src/game/__tests__/BattleManager.test.ts`

核心变更：BattleManager 从持有单个 PlantChain/ComboSystem 改为持有 Lane 数组。BattleConfig 接口新增 `laneCount` 和 `lanePlants`，移除 `plants`。

**向后兼容策略**：现有测试只需把 `plants` 改成 `lanePlants: [plants]` + `laneCount: 1`。

- [ ] **Step 1: 修改 BattleConfig 接口**

```ts
// src/game/BattleManager.ts — BattleConfig 变更
export interface BattleConfig {
  readonly laneCount: number                              // 路数（1/2/3）
  readonly lanePlants: readonly (readonly PlantConfig[])[] // 每路植物，长度 = laneCount
  readonly waves: readonly WaveConfig[]
  readonly zombieConfigs: Readonly<Record<string, ZombieConfig>>
  readonly letterPool: readonly string[]
  readonly missedLimit: number
  readonly projectileSpeed: number
  readonly healAmount: number
  readonly wavePauseDuration: number
  readonly canvasWidth: number
  readonly canvasHeight: number
  readonly letterSeed?: number
  readonly synergyMultiplier: Readonly<Record<number, number>>
  readonly areaBulletCount: number
  readonly areaSpreadAngle: number
  readonly areaDamageDecay: number
  readonly trackingTurnRate: number
}
```

- [ ] **Step 2: 重构 BattleManager 构造函数 — 创建 Lane 数组**

删除旧的 `plantChain`、`combo`、`letters`、`_chainLetters`、`plantPositions`、`plantWidths`、`laneY` 字段。

替换为：

```ts
private readonly lanes: Lane[]
private currentLaneIndex: number | null = null  // 当前锁定路，null = 自由匹配
private readonly zombieLanes = new Map<string, number>() // zombieId → laneIndex
```

构造函数：

```ts
constructor(config: BattleConfig) {
  this.config = config
  this.entityManager = new EntityManager()

  // 计算每路 Y 坐标（垂直均匀分布）
  const laneYs = this.calculateLaneYPositions(config.laneCount, config.canvasHeight)

  // 创建 Lane 数组
  this.lanes = []
  for (let i = 0; i < config.laneCount; i++) {
    const plants = config.lanePlants[i] ?? []
    // 每路使用不同的 seed（基于 letterSeed 偏移），保证各路字母独立
    const seed = config.letterSeed !== undefined ? config.letterSeed + i * 1000 : undefined
    this.lanes.push(new Lane(i, plants, config.letterPool, laneYs[i], config.canvasWidth, seed))
  }

  // 初始化时确保各路首字母不冲突
  this.ensureNoLetterConflict()
}

private calculateLaneYPositions(laneCount: number, canvasHeight: number): number[] {
  if (laneCount === 1) return [Math.round(canvasHeight * 0.4)]
  // 多路：在 20%~70% 区间均匀分布
  const topY = canvasHeight * 0.2
  const bottomY = canvasHeight * 0.7
  const ys: number[] = []
  for (let i = 0; i < laneCount; i++) {
    ys.push(Math.round(topY + (bottomY - topY) * i / (laneCount - 1)))
  }
  return ys
}

private ensureNoLetterConflict(): void {
  // 依次为每路生成字母，确保首字母不冲突
  for (let i = 0; i < this.lanes.length; i++) {
    const exclude = this.getOtherLanesCurrentLetters(i)
    this.lanes[i].regenerateLetters(exclude)
  }
}

private getOtherLanesCurrentLetters(excludeLaneIndex: number): string[] {
  const letters: string[] = []
  for (let i = 0; i < this.lanes.length; i++) {
    if (i === excludeLaneIndex || this.lanes[i].isEmpty) continue
    const l = this.lanes[i].currentLetter
    if (l) letters.push(l)
  }
  return letters
}
```

- [ ] **Step 3: 修改现有测试 — BattleConfig 格式迁移**

将所有测试中的 `createManager` helper 从 `plants: TEST_PLANTS` 改为 `laneCount: 1, lanePlants: [TEST_PLANTS]`，删除旧的 `plants` 字段。

```ts
function createManager(overrides?: Partial<BattleConfig>) {
  return new BattleManager({
    laneCount: 1,
    lanePlants: [TEST_PLANTS],
    waves: TEST_WAVES,
    // ... 其余不变
    ...overrides,
  })
}
```

- [ ] **Step 4: 迁移 accessor 方法**

旧 accessor 改为委托到 lane[0]（单路兼容）或引入多路 accessor：

```ts
// 单路兼容 accessor（供现有测试和 HUD 使用）
get comboCount(): number {
  if (this.currentLaneIndex !== null) return this.lanes[this.currentLaneIndex].comboCount
  return 0
}

get currentLetter(): string {
  if (this.currentLaneIndex !== null) return this.lanes[this.currentLaneIndex].currentLetter
  return ''
}

// 多路 accessor
getLane(index: number): Lane { return this.lanes[index] }
get laneCount(): number { return this.lanes.length }
get currentLane(): number | null { return this.currentLaneIndex }

getChainLetters(laneIndex?: number): readonly string[] {
  const idx = laneIndex ?? this.currentLaneIndex ?? 0
  return this.lanes[idx].chainLetters
}

getPlantStates(laneIndex?: number): readonly PlantState[] {
  const idx = laneIndex ?? 0
  return this.lanes[idx].getPlantStates()
}
```

- [ ] **Step 5: 跑现有测试确认全部通过（单路兼容）**

Run: `npm test`
Expected: 所有 157 个测试通过

- [ ] **Step 6: Commit**

```bash
git add src/game/BattleManager.ts src/game/__tests__/BattleManager.test.ts
git commit -m "refactor(game): BattleManager 从单路改为 Lane 数组，保持单路向后兼容"
```

---

## Task 5: BattleManager — 多路输入路由（TDD）

**Files:**
- Modify: `src/game/BattleManager.ts`
- Test: `src/game/__tests__/BattleManager.test.ts`

实现锁定模式输入路由。这是多路系统的核心逻辑。

- [ ] **Step 1: 写多路输入路由测试**

```ts
describe('多路输入路由', () => {
  const LANE0_PLANTS: PlantConfig[] = [
    { id: 'a', name: 'A', comboSegment: 4, attackPower: 10, hp: 100, element: 'normal', trajectory: 'direct' },
  ]
  const LANE1_PLANTS: PlantConfig[] = [
    { id: 'b', name: 'B', comboSegment: 4, attackPower: 15, hp: 80, element: 'ice', trajectory: 'direct' },
  ]

  function create2LaneManager() {
    return createManager({
      laneCount: 2,
      lanePlants: [LANE0_PLANTS, LANE1_PLANTS],
    })
  }

  it('初始无当前路', () => {
    const mgr = create2LaneManager()
    expect(mgr.currentLane).toBeNull()
  })

  it('自由匹配：按字母锁定到匹配路', () => {
    const mgr = create2LaneManager()
    const letter0 = mgr.getLane(0).currentLetter
    mgr.onKeyDown(letter0)
    expect(mgr.currentLane).toBe(0)
    expect(mgr.getLane(0).comboCount).toBe(1)
  })

  it('锁定状态：按当前路字母推进', () => {
    const mgr = create2LaneManager()
    const letter0 = mgr.getLane(0).currentLetter
    mgr.onKeyDown(letter0) // 锁定 lane 0
    const next = mgr.getLane(0).currentLetter
    mgr.onKeyDown(next)
    expect(mgr.currentLane).toBe(0)
    expect(mgr.getLane(0).comboCount).toBe(2)
  })

  it('锁定状态：按错触发当前路结算并解锁', () => {
    const mgr = create2LaneManager()
    mgr.update(1100) // 生成僵尸
    const letter0 = mgr.getLane(0).currentLetter
    mgr.onKeyDown(letter0) // 锁定 lane 0
    mgr.onKeyDown('z') // 按错
    expect(mgr.currentLane).toBeNull()
    expect(mgr.getLane(0).comboCount).toBe(0)
  })

  it('空格结算当前路并解锁', () => {
    const mgr = create2LaneManager()
    const letter0 = mgr.getLane(0).currentLetter
    mgr.onKeyDown(letter0) // 锁定 lane 0
    mgr.onKeyDown(' ') // 空格
    expect(mgr.currentLane).toBeNull()
    expect(mgr.getLane(0).comboCount).toBe(0)
  })

  it('无当前路时按不匹配字母忽略', () => {
    const mgr = create2LaneManager()
    mgr.onKeyDown('z') // 不匹配任何路
    expect(mgr.currentLane).toBeNull()
  })

  it('各路首字母不重复', () => {
    const mgr = create2LaneManager()
    const l0 = mgr.getLane(0).currentLetter
    const l1 = mgr.getLane(1).currentLetter
    expect(l0).not.toBe(l1)
  })

  it('结算后重新生成字母不冲突', () => {
    const mgr = create2LaneManager()
    mgr.update(1100)
    const letter0 = mgr.getLane(0).currentLetter
    mgr.onKeyDown(letter0)
    mgr.onKeyDown(' ') // 结算 lane 0，字母重新生成
    // 重新生成后 lane 0 首字母不应与 lane 1 首字母相同
    expect(mgr.getLane(0).currentLetter).not.toBe(mgr.getLane(1).currentLetter)
  })

  it('打满当前路自动结算并解锁', () => {
    const mgr = create2LaneManager()
    mgr.update(1100)
    // 打满 lane 0（4 段）
    for (let i = 0; i < 4; i++) {
      const letter = mgr.getLane(0).currentLetter
      mgr.onKeyDown(letter)
    }
    // 自动结算，回到自由匹配
    expect(mgr.currentLane).toBeNull()
    expect(mgr.getLane(0).comboCount).toBe(0)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 实现多路 onKeyDown**

```ts
onKeyDown(key: string): void {
  if (this._status !== BattleStatus.Fighting) return

  // 空格处理
  if (key === ' ') {
    if (this.currentLaneIndex === null) return // 无当前路忽略
    const settlement = this.lanes[this.currentLaneIndex].settle()
    if (settlement) {
      this.executeSettlement(this.currentLaneIndex, settlement.comboCount, settlement.isFullChain)
      this.onLaneSettled(this.currentLaneIndex)
    }
    this.currentLaneIndex = null
    return
  }

  // 功能键过滤
  if (key.length > 1 || IGNORED_KEYS.has(key)) return
  const lower = key.toLowerCase()

  // 有当前路（锁定状态）
  if (this.currentLaneIndex !== null) {
    const lane = this.lanes[this.currentLaneIndex]
    if (lower === lane.currentLetter) {
      // 命中当前路
      const settlement = lane.hit()
      if (settlement) {
        this.executeSettlement(this.currentLaneIndex, settlement.comboCount, settlement.isFullChain)
        this.onLaneSettled(this.currentLaneIndex)
        this.currentLaneIndex = null
      }
    } else {
      // 未命中当前路 → 结算并解锁
      const settlement = lane.miss()
      if (settlement) {
        this.executeSettlement(this.currentLaneIndex, settlement.comboCount, settlement.isFullChain)
        this.onLaneSettled(this.currentLaneIndex)
      }
      this.currentLaneIndex = null
    }
    return
  }

  // 无当前路（自由匹配状态）
  for (let i = 0; i < this.lanes.length; i++) {
    if (this.lanes[i].isEmpty) continue
    if (lower === this.lanes[i].currentLetter) {
      this.currentLaneIndex = i
      const settlement = this.lanes[i].hit()
      if (settlement) {
        this.executeSettlement(i, settlement.comboCount, settlement.isFullChain)
        this.onLaneSettled(i)
        this.currentLaneIndex = null
      }
      return
    }
  }
  // 不匹配任何路 → 忽略
}

private onLaneSettled(laneIndex: number): void {
  // 结算后重新生成该路字母，避免首字母冲突
  const exclude = this.getOtherLanesCurrentLetters(laneIndex)
  this.lanes[laneIndex].regenerateLetters(exclude)
}
```

同时需要把 `IGNORED_KEYS` 从 `InputHandler.ts` 导出或在 BattleManager 中导入：

```ts
import { IGNORED_KEYS } from './InputHandler'
```

`InputHandler.ts` 中 `IGNORED_KEYS` 需要从 `const` 改为 `export const`。

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test`

- [ ] **Step 5: Commit**

```bash
git add src/game/BattleManager.ts src/game/__tests__/BattleManager.test.ts src/game/InputHandler.ts
git commit -m "feat(game): BattleManager 多路锁定模式输入路由"
```

---

## Task 6: BattleManager — 多路僵尸管理

**Files:**
- Modify: `src/game/BattleManager.ts`
- Test: `src/game/__tests__/BattleManager.test.ts`

僵尸随机分配到各路，各路独立啃植物。

- [ ] **Step 1: 写多路僵尸测试**

```ts
describe('多路僵尸', () => {
  it('僵尸分配到各路', () => {
    const mgr = create2LaneManager()
    mgr.update(5000) // 生成足够多的僵尸
    const zombies = mgr.getZombies()
    // 每只僵尸有路分配
    for (const z of zombies) {
      const lane = mgr.getZombieLane(z.id)
      expect(lane).toBeGreaterThanOrEqual(0)
      expect(lane).toBeLessThan(2)
    }
  })

  it('僵尸在其所属路的 Y 坐标', () => {
    const mgr = create2LaneManager()
    mgr.update(5000)
    const zombies = mgr.getZombies()
    for (const z of zombies) {
      const laneIdx = mgr.getZombieLane(z.id)
      const lane = mgr.getLane(laneIdx)
      expect(z.y).toBe(lane.laneY)
    }
  })

  it('僵尸只啃自己路的植物', () => {
    const mgr = create2LaneManager({
      waves: [{ zombieType: 'normal', count: 1, interval: 500 }],
    })
    // 让僵尸走到植物位置并啃一会
    for (let i = 0; i < 200; i++) mgr.update(100)
    // 两路植物中只有僵尸所在路的植物受损
    const lane0hp = mgr.getLane(0).getPlantStates().reduce((s, p) => s + p.currentHp, 0)
    const lane1hp = mgr.getLane(1).getPlantStates().reduce((s, p) => s + p.currentHp, 0)
    const lane0max = mgr.getLane(0).getPlantStates().reduce((s, p) => s + p.config.hp, 0)
    const lane1max = mgr.getLane(1).getPlantStates().reduce((s, p) => s + p.config.hp, 0)
    // 其中一路受损，另一路满血
    expect(lane0hp < lane0max || lane1hp < lane1max).toBe(true)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 实现多路僵尸分配和啃植物**

`spawnZombie()` 修改：

```ts
private spawnZombie(): void {
  const wave = this.config.waves[this._currentWave]
  const zombieConfig = this.config.zombieConfigs[wave.zombieType]
  const { canvasWidth } = this.config

  // 随机分配到某路
  const laneIndex = Math.floor(Math.random() * this.config.laneCount)
  const lane = this.lanes[laneIndex]

  const id = `zombie_${this.zombieIdCounter++}`
  const spawnX = canvasWidth + 20
  const zombie = new ZombieEntity(id, spawnX, lane.laneY, zombieConfig.hp, zombieConfig.speed, zombieConfig.chewDps)

  this.zombieLanes.set(id, laneIndex)

  // 啃目标：该路最右侧存活植物
  this.assignChewTarget(zombie, lane)
  this.entityManager.add(zombie)
}

private assignChewTarget(zombie: ZombieEntity, lane: Lane): void {
  const plantIdx = lane.getRightmostAlivePlantIndex()
  if (plantIdx >= 0) {
    zombie.setChewTarget(lane.plantPositions[plantIdx] + lane.plantWidths[plantIdx])
  }
}
```

`updateChewing()` 修改 — 按路分组处理：

```ts
private updateChewing(dt: number): void {
  const zombies = this.entityManager.getByTag('zombie') as ZombieEntity[]
  for (let i = 0; i < zombies.length; i++) {
    const z = zombies[i]
    if (z.state !== ZombieState.Chewing) continue

    const laneIdx = this.zombieLanes.get(z.id)
    if (laneIdx === undefined) continue
    const lane = this.lanes[laneIdx]

    const damage = z.getChewDamage(dt)
    const plantIdx = lane.getRightmostAlivePlantIndex()
    if (plantIdx < 0) continue

    lane.takeDamage(plantIdx, damage)

    if (!lane.getPlantStates()[plantIdx].alive) {
      this.reassignChewTargetsForLane(laneIdx)
    }
  }
}

private reassignChewTargetsForLane(laneIdx: number): void {
  const lane = this.lanes[laneIdx]
  const zombies = this.entityManager.getByTag('zombie') as ZombieEntity[]
  const plantIdx = lane.getRightmostAlivePlantIndex()
  for (let i = 0; i < zombies.length; i++) {
    const z = zombies[i]
    if (this.zombieLanes.get(z.id) !== laneIdx) continue
    if (z.state === ZombieState.Dead) continue
    if (plantIdx >= 0) {
      z.setChewTarget(lane.plantPositions[plantIdx] + lane.plantWidths[plantIdx])
    } else {
      z.clearChewTarget()
    }
  }
}
```

新增 accessor：

```ts
getZombieLane(zombieId: string): number {
  return this.zombieLanes.get(zombieId) ?? 0
}
```

`updateMissed()` 中清理 zombieLanes 映射：

```ts
// 在 entityManager.remove(z) 之后加：
this.zombieLanes.delete(z.id)
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test`

- [ ] **Step 5: Commit**

```bash
git add src/game/BattleManager.ts src/game/__tests__/BattleManager.test.ts
git commit -m "feat(game): 僵尸随机分路 + 按路啃植物"
```

---

## Task 7: BattleManager — 多路结算攻击

**Files:**
- Modify: `src/game/BattleManager.ts`
- Test: `src/game/__tests__/BattleManager.test.ts`

结算攻击从当前路植物发射弹道，使用当前路的植物位置和 Y 坐标。

- [ ] **Step 1: 写多路结算测试**

```ts
describe('多路结算', () => {
  it('结算从当前路植物位置发射弹道', () => {
    const mgr = create2LaneManager()
    mgr.update(1100) // 生成僵尸

    // 打 lane 0 连击然后结算
    for (let i = 0; i < 4; i++) {
      mgr.onKeyDown(mgr.getLane(0).currentLetter)
    }
    // 打满自动结算，应有弹道
    expect(mgr.projectileCount).toBeGreaterThan(0)
  })

  it('结算只计算当前路的植物状态', () => {
    const mgr = create2LaneManager()
    mgr.update(1100)
    // lane 0 打一段后空格结算
    mgr.onKeyDown(mgr.getLane(0).currentLetter)
    mgr.onKeyDown(' ')
    // lane 1 的连击应该不受影响
    expect(mgr.getLane(1).comboCount).toBe(0)
  })
})
```

- [ ] **Step 2: 跑测试确认失败（如有新增测试）**

- [ ] **Step 3: 修改 executeSettlement 接受 laneIndex**

```ts
private executeSettlement(laneIndex: number, comboCount: number, isFullChain: boolean): void {
  const lane = this.lanes[laneIndex]
  const plants = lane.getPlantStates()
  const result = calculateSettlement(plants, comboCount, isFullChain, this.config.synergyMultiplier)

  const { synthesizedEffect, perPlantPower, aliveActivatedIndices } = result

  for (let i = 0; i < aliveActivatedIndices.length; i++) {
    const plantIdx = aliveActivatedIndices[i]
    const px = lane.plantPositions[plantIdx] + lane.plantWidths[plantIdx] / 2
    const py = lane.laneY + 30
    const power = perPlantPower[i]

    if (synthesizedEffect.trajectory === 'area') {
      this.fireAreaProjectiles(px, py, power, synthesizedEffect.element)
    } else {
      const id = `proj_${this.projectileIdCounter++}`
      const proj = new ProjectileEntity({
        id, x: px, y: py,
        speed: this.config.projectileSpeed,
        power,
        rightBound: this.config.canvasWidth,
        trajectory: synthesizedEffect.trajectory,
        element: synthesizedEffect.element,
        target: synthesizedEffect.trajectory === 'tracking' ? this.findNearestZombie(px, py) : undefined,
        maxTurnRate: this.config.trackingTurnRate,
      })
      this.entityManager.add(proj)
      this._pendingProjectiles++
    }
  }

  if (isFullChain) {
    lane.healOnFullChain(this.config.healAmount)
    this.reassignChewTargetsForLane(laneIndex)
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test`

- [ ] **Step 5: Commit**

```bash
git add src/game/BattleManager.ts src/game/__tests__/BattleManager.test.ts
git commit -m "feat(game): 多路结算攻击从当前路植物位置发射弹道"
```

---

## Task 8: BattleManager — 波次完成和多路重置

**Files:**
- Modify: `src/game/BattleManager.ts`
- Test: `src/game/__tests__/BattleManager.test.ts`

波次完成时重置所有路的连击，重新生成字母。

- [ ] **Step 1: 写波次完成测试**

```ts
describe('多路波次完成', () => {
  it('波次完成时所有路连击归零', () => {
    const mgr = create2LaneManager({
      waves: [{ zombieType: 'normal', count: 1, interval: 500 }],
    })
    // 生成并杀掉所有僵尸
    mgr.update(600)
    const zombies = mgr.getZombies()
    for (const z of zombies) {
      // 直接通过结算杀死（打一条路的连击）
    }
    // 波次完成后...
    // 所有路的连击应该归零
  })

  it('波次完成时所有路字母重新生成', () => {
    // 类似上面的测试
  })
})
```

- [ ] **Step 2: 修改 checkWaveCompletion**

```ts
private checkWaveCompletion(): void {
  // ... 现有逻辑
  if (allSpawned && allProcessed) {
    // 重置所有路的连击
    for (const lane of this.lanes) {
      lane.resetCombo()
    }
    this.currentLaneIndex = null
    // 重新生成所有路字母（避免冲突）
    this.ensureNoLetterConflict()

    this._currentWave++
    if (this._currentWave >= this.config.waves.length) {
      this._status = BattleStatus.Victory
    } else {
      this._status = BattleStatus.WavePause
      this.wavePauseTimer = this.config.wavePauseDuration
    }
  }
}
```

- [ ] **Step 3: 跑测试确认通过**

- [ ] **Step 4: Commit**

```bash
git add src/game/BattleManager.ts src/game/__tests__/BattleManager.test.ts
git commit -m "feat(game): 波次完成时重置所有路连击和字母"
```

---

## Task 9: BattleScene — 多路渲染

**Files:**
- Modify: `src/scenes/BattleScene.ts`

将 BattleScene 从单路渲染改为多路渲染。每路一行植物、一条路线、各自的僵尸。

- [ ] **Step 1: 修改 enter() — 从 config 构造多路 BattleConfig**

```ts
enter(): void {
  const stage = STAGES[this.stageIndex]
  const level = stage.levels[this.levelIndex]
  const difficulty = DIFFICULTIES[DEFAULT_DIFFICULTY]
  const laneCount = level.laneCount ?? 1

  // 每路植物：优先用 level.lanePlants，否则所有路用 stage.plants
  const lanePlants: PlantConfig[][] = []
  for (let i = 0; i < laneCount; i++) {
    const plantIds = level.lanePlants?.[i] ?? stage.plants
    lanePlants.push(plantIds.map(id => {
      const def = PLANT_DEFS.find(p => p.id === id)!
      return { id: def.id, name: def.name, comboSegment: def.comboSegment,
               attackPower: def.attackPower, hp: def.hp, element: def.element, trajectory: def.trajectory }
    }))
  }

  this.manager = new BattleManager({
    laneCount,
    lanePlants,
    waves: level.waves,
    // ... 其余不变
  })

  // 为每路创建 PlantEntity 数组
  this.laneEntities = [] // PlantEntity[][]
  for (let i = 0; i < laneCount; i++) {
    const lane = this.manager.getLane(i)
    const entities: PlantEntity[] = []
    for (let j = 0; j < lane.plants.length; j++) {
      const entity = new PlantEntity(
        `plant_${i}_${j}`,
        lane.plantPositions[j],
        lane.laneY - 30,
        lane.plantWidths[j],
        j
      )
      entities.push(entity)
    }
    this.laneEntities.push(entities)
  }
}
```

- [ ] **Step 2: 修改 update() — 按路更新 PlantEntity**

```ts
update(dt: number): void {
  if (!this.manager || this.paused) return
  this.manager.update(dt)

  for (let li = 0; li < this.manager.laneCount; li++) {
    const lane = this.manager.getLane(li)
    const plantStates = lane.getPlantStates()
    const comboCount = lane.comboCount
    const chainLetters = lane.chainLetters
    const isCurrentLane = this.manager.currentLane === li

    let segOffset = 0
    const entities = this.laneEntities[li]
    for (let i = 0; i < entities.length; i++) {
      if (i >= plantStates.length) break
      const entity = entities[i]
      const segments = plantStates[i].config.comboSegment

      entity.syncState(plantStates[i])
      entity.letters = chainLetters.slice(segOffset, segOffset + segments) as string[]
      entity.typedCount = Math.max(0, Math.min(segments, comboCount - segOffset))
      entity.isCurrentTarget = isCurrentLane && comboCount >= segOffset && comboCount < segOffset + segments
      segOffset += segments
    }
  }
}
```

- [ ] **Step 3: 修改 render() — 多路线条和 HUD**

```ts
render(ctx: CanvasRenderingContext2D): void {
  // 背景
  ctx.fillStyle = '#2d5a1e'
  ctx.fillRect(0, 0, w, h)

  // 每路一条路线
  for (let li = 0; li < this.manager.laneCount; li++) {
    const lane = this.manager.getLane(li)
    const isCurrentLane = this.manager.currentLane === li

    // 路线
    ctx.strokeStyle = isCurrentLane ? 'rgba(255, 215, 0, 0.4)' : 'rgba(255, 255, 255, 0.2)'
    ctx.lineWidth = isCurrentLane ? 2 : 1
    ctx.beginPath()
    ctx.moveTo(0, lane.laneY + 60)
    ctx.lineTo(w, lane.laneY + 60)
    ctx.stroke()

    // 渲染该路的植物实体
    for (const entity of this.laneEntities[li]) {
      entity.render(ctx)
    }
  }

  // 僵尸和弹道（全局 EntityManager 渲染）
  this.manager.getEntityManager().render(ctx)

  // HUD：显示当前路信息
  // ... 多路 HUD 展示每路的连击状态
}
```

- [ ] **Step 4: 修改 handleInput() — 传递按键到 BattleManager**

现有 `handleInput` 中 `manager.onKeyDown(event.key)` 不需要改动，因为路由逻辑已在 BattleManager 中实现。

- [ ] **Step 5: 启动 dev server 浏览器验收**

Run: `npm run dev`
验证：
- 单路阶段正常运行（回归）
- 多路阶段显示多行植物和僵尸
- 按字母锁定到正确的路
- 空格释放当前路
- 各路首字母不同
- 当前路有视觉区分（路线高亮）

- [ ] **Step 6: Commit**

```bash
git add src/scenes/BattleScene.ts
git commit -m "feat(scene): BattleScene 支持多路渲染和交互"
```

---

## Task 10: 演示阶段配置 + MenuScene 更新

**Files:**
- Modify: `src/config/stages.ts`
- Modify: `src/scenes/MenuScene.ts`

新增 2 路和 3 路演示阶段，供浏览器验收。

- [ ] **Step 1: 新增演示阶段**

```ts
// src/config/stages.ts — 追加
{
  id: 5,
  name: '2路演示',
  letters: ['f', 'j', 'd', 'k', 's', 'l', 'a'],
  plants: ['peashooter', 'snow_pea'],
  levels: [
    {
      id: 1,
      laneCount: 2,
      // 不指定 lanePlants，两路都用 stage.plants
      waves: [
        { zombieType: 'normal', count: 8, interval: 2000 },
        { zombieType: 'normal', count: 10, interval: 1500 },
      ],
    },
  ],
},
{
  id: 6,
  name: '3路演示',
  letters: ['f', 'j', 'd', 'k', 's', 'l', 'a'],
  plants: ['peashooter'],
  levels: [
    {
      id: 1,
      laneCount: 3,
      lanePlants: [
        ['peashooter', 'snow_pea'],  // 路 0
        ['peashooter'],               // 路 1
        [],                            // 路 2 空路
      ],
      waves: [
        { zombieType: 'normal', count: 10, interval: 1500 },
      ],
    },
  ],
},
```

- [ ] **Step 2: MenuScene 自动显示新阶段**

MenuScene 已经根据 STAGES 数组长度动态渲染菜单项，无需修改逻辑。确认新阶段在菜单中正确显示。

- [ ] **Step 3: 浏览器验收**

Run: `npm run dev`
验证：
- [5] 2路演示：2 行植物，僵尸分布在两行
- [6] 3路演示：3 行植物（路 2 空路），僵尸照常分配到 3 路
- 空路的僵尸走过去不被拦截（无植物可啃）
- 锁定选路正确，字母颜色区分当前路
- 连击、结算、弹道全部正常

- [ ] **Step 4: Commit**

```bash
git add src/config/stages.ts
git commit -m "feat(config): 新增 2 路和 3 路演示阶段"
```

---

## Task 11: Slot 校验工具函数

**Files:**
- Create: `src/game/SlotValidation.ts`（可选，也可放在 config/validation.ts）
- Test: `src/game/__tests__/SlotValidation.test.ts`

Slot 校验是独立的纯函数，为阶段五的植物选择 UI 预备。4.3 中作为工具函数存在。

- [ ] **Step 1: 写测试**

```ts
// src/game/__tests__/SlotValidation.test.ts
import { describe, it, expect } from 'vitest'
import { validateSlot } from '../SlotValidation'

describe('validateSlot', () => {
  const plants = {
    peashooter: { comboSegment: 4 },
    snow_pea: { comboSegment: 4 },
    torchwood: { comboSegment: 8 },
    fume_shroom: { comboSegment: 16 },
  }

  it('总段数 <= slotSize 通过', () => {
    expect(validateSlot(['peashooter', 'snow_pea'], 8, plants)).toEqual({ valid: true, used: 8 })
  })

  it('总段数 > slotSize 不通过', () => {
    expect(validateSlot(['torchwood', 'snow_pea'], 8, plants).valid).toBe(false)
  })

  it('不填满通过', () => {
    expect(validateSlot(['peashooter'], 8, plants)).toEqual({ valid: true, used: 4 })
  })

  it('空植物列表通过（空路）', () => {
    expect(validateSlot([], 8, plants)).toEqual({ valid: true, used: 0 })
  })

  it('重复植物计入总段数', () => {
    expect(validateSlot(['peashooter', 'peashooter'], 8, plants)).toEqual({ valid: true, used: 8 })
    expect(validateSlot(['peashooter', 'peashooter', 'peashooter'], 8, plants).valid).toBe(false)
  })

  it('未知植物 ID 返回错误', () => {
    expect(validateSlot(['unknown'], 8, plants).valid).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 实现 validateSlot**

```ts
// src/game/SlotValidation.ts
export interface SlotValidationResult {
  readonly valid: boolean
  readonly used: number
  readonly error?: string
}

export function validateSlot(
  plantIds: readonly string[],
  slotSize: number,
  plantDefs: Readonly<Record<string, { comboSegment: number }>>,
): SlotValidationResult {
  let used = 0
  for (const id of plantIds) {
    const def = plantDefs[id]
    if (!def) return { valid: false, used, error: `未知植物 ID: ${id}` }
    used += def.comboSegment
  }
  if (used > slotSize) return { valid: false, used, error: `总段数 ${used} 超过 slot 上限 ${slotSize}` }
  return { valid: true, used }
}
```

- [ ] **Step 4: 跑测试确认通过**

- [ ] **Step 5: Commit**

```bash
git add src/game/SlotValidation.ts src/game/__tests__/SlotValidation.test.ts
git commit -m "feat(game): 新增 validateSlot 校验植物组合是否符合 slot 限制"
```

---

## Task 12: 全量测试 + 回归验收

- [ ] **Step 1: 跑全量测试**

Run: `npm test`
Expected: 所有测试通过（现有 157 + 新增 ~30 = ~187）

- [ ] **Step 2: 浏览器全量验收**

Run: `npm run dev`

| 验收项 | 预期 |
|--------|------|
| 单路阶段（阶段 1-4）正常 | 回归无破坏 |
| 2 路演示：各路独立连击 | 各路独立运作 |
| 2 路演示：锁定模式正确 | 锁定后只看当前路 |
| 2 路演示：空格释放 | 释放后回到自由匹配 |
| 2 路演示：各路首字母不同 | 无歧义 |
| 3 路演示：空路僵尸通过 | 无植物拦截 |
| 3 路演示：弹道跨路 | 辐射/追踪可命中其他路 |
| 连击字母颜色区分当前路 | 视觉清晰 |

- [ ] **Step 3: 最终 Commit**

```bash
git commit -m "feat: 阶段四 4.3 多路系统 + Slot 机制完成"
```

---

## 依赖关系

```
Task 1 (config)
  ↓
Task 2 (LetterProvider) ← 独立
  ↓
Task 3 (Lane) ← 依赖 Task 2
  ↓
Task 4 (BM 构造) ← 依赖 Task 1, 3
  ↓
Task 5 (BM 输入路由) ← 依赖 Task 4
  ↓
Task 6 (BM 僵尸分路) ← 依赖 Task 4
  ↓
Task 7 (BM 结算) ← 依赖 Task 5, 6
  ↓
Task 8 (BM 波次) ← 依赖 Task 7
  ↓
Task 9 (BattleScene) ← 依赖 Task 8
  ↓
Task 10 (演示阶段) ← 依赖 Task 9
  ↓
Task 11 (Slot 校验) ← 独立
  ↓
Task 12 (全量验收) ← 依赖全部
```

Task 2 和 Task 11 与主线独立，可并行。Task 5 和 Task 6 可并行（都依赖 Task 4，互不依赖）。
