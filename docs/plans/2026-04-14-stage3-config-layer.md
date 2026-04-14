# 阶段三：策略配置层 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把阶段二硬编码在 BattleScene.ts 中的所有游戏数值抽成 `src/config/` 配置层，验证"改配置不改代码"的架构能力。

**Architecture:** 新增 `src/config/` 目录，包含 5 个配置文件（plants / zombies / stages / difficulty / battle）。游戏逻辑层（game/）不直接导入 config/，而是通过 BattleScene 从 config 读取后以参数注入。配置字段名对齐 GAME_DESIGN.md。运行时校验函数在启动时检查配置语义正确性。

**Tech Stack:** TypeScript strict, Vitest

---

## File Structure

### 新建文件

| 文件 | 职责 |
|------|------|
| `src/config/plants.ts` | 植物属性定义表 |
| `src/config/zombies.ts` | 僵尸属性定义表 |
| `src/config/stages.ts` | 阶段 → 关卡 → 波次配置 |
| `src/config/difficulty.ts` | 难度档位配置 |
| `src/config/battle.ts` | 战斗通用参数（弹速、回血、波次暂停） |
| `src/config/types.ts` | 配置层类型定义 |
| `src/config/index.ts` | 统一导出 |
| `src/config/validation.ts` | 运行时配置校验 |
| `src/config/__tests__/validation.test.ts` | 校验函数测试 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/game/types.ts` | `PlantConfig.segments` → `PlantConfig.comboSegment`，`WaveConfig` 新增 `zombieType` 字段 |
| `src/game/Settlement.ts` | `segments` → `comboSegment` |
| `src/game/PlantChain.ts` | `segments` → `comboSegment` |
| `src/game/ComboSystem.ts` | 构造参数命名跟随改名 |
| `src/game/BattleManager.ts` | `segments` → `comboSegment`，`WAVE_PAUSE_DURATION` 改从配置注入 |
| `src/game/PlantEntity.ts` | `segments` 相关引用 → `comboSegment` |
| `src/game/__tests__/Settlement.test.ts` | 测试中 `segments` → `comboSegment` |
| `src/game/__tests__/PlantChain.test.ts` | 同上 |
| `src/game/__tests__/BattleManager.test.ts` | 同上 |
| `src/game/__tests__/ComboSystem.test.ts` | 如有用到 `segments` 需同步 |
| `src/scenes/BattleScene.ts` | 删除硬编码常量，从 config 导入组装 |

---

## Task 1: 配置层类型定义

**Files:**
- Create: `src/config/types.ts`

- [ ] **Step 1: 创建配置层类型文件**

```ts
// src/config/types.ts

/** 植物定义（字段名对齐 GAME_DESIGN.md 4.1） */
export interface PlantDef {
  readonly id: string
  readonly name: string
  readonly comboSegment: number   // 占据的连击段数
  readonly attackPower: number    // 基础攻击力
  readonly hp: number             // 血量上限
}

/** 僵尸定义（字段名对齐 GAME_DESIGN.md 5.1） */
export interface ZombieDef {
  readonly id: string
  readonly name: string
  readonly hp: number
  readonly speed: number          // 像素/秒
  readonly chewDps: number        // 啃植物每秒伤害
}

/** 单波配置 */
export interface WaveDef {
  readonly zombieType: string     // 引用 ZombieDef.id
  readonly count: number          // 本波僵尸数量
  readonly interval: number       // 生成间隔（毫秒）
}

/** 关卡配置 */
export interface LevelDef {
  readonly id: number
  readonly waves: readonly WaveDef[]
}

/** 阶段配置 */
export interface StageDef {
  readonly id: number
  readonly name: string
  readonly letters: readonly string[]    // 本阶段字母池
  readonly plants: readonly string[]     // 本阶段可用植物 id 列表（按链条顺序）
  readonly levels: readonly LevelDef[]
}

/** 难度配置 */
export interface DifficultyDef {
  readonly missedLimit: number           // 放过上限
  readonly zombieSpeedMultiplier: number // 速度倍率
}

/** 战斗通用参数 */
export interface BattleDef {
  readonly projectileSpeed: number       // 弹道速度 像素/秒
  readonly healAmount: number            // 打满回血量
  readonly wavePauseDuration: number     // 波次间暂停时长 毫秒
}
```

- [ ] **Step 2: 提交**

```bash
git add src/config/types.ts
git commit -m "feat(config): 配置层类型定义，字段名对齐 GAME_DESIGN"
```

---

## Task 2: 植物配置

**Files:**
- Create: `src/config/plants.ts`

- [ ] **Step 1: 创建植物配置文件**

```ts
// src/config/plants.ts
import type { PlantDef } from './types'

/** 植物属性表，按链条位置排列（从左到右，从弱到强） */
export const PLANT_DEFS: readonly PlantDef[] = [
  { id: 'peashooter', name: '豌豆射手', comboSegment: 4, attackPower: 20, hp: 100 },
  { id: 'snow_pea',   name: '寒冰射手', comboSegment: 4, attackPower: 15, hp: 80 },
  { id: 'repeater',   name: '双发射手', comboSegment: 8, attackPower: 35, hp: 120 },
]
```

- [ ] **Step 2: 提交**

```bash
git add src/config/plants.ts
git commit -m "feat(config): 植物属性配置"
```

---

## Task 3: 僵尸配置

**Files:**
- Create: `src/config/zombies.ts`

- [ ] **Step 1: 创建僵尸配置文件**

```ts
// src/config/zombies.ts
import type { ZombieDef } from './types'

/** 僵尸属性表，按 id 索引 */
export const ZOMBIE_DEFS: Readonly<Record<string, ZombieDef>> = {
  normal: { id: 'normal', name: '普通僵尸', hp: 50, speed: 30, chewDps: 10 },
}
```

- [ ] **Step 2: 提交**

```bash
git add src/config/zombies.ts
git commit -m "feat(config): 僵尸属性配置"
```

---

## Task 4: 难度配置

**Files:**
- Create: `src/config/difficulty.ts`

- [ ] **Step 1: 创建难度配置文件**

```ts
// src/config/difficulty.ts
import type { DifficultyDef } from './types'

/** 难度档位（对齐 GAME_DESIGN 2.5 节） */
export const DIFFICULTIES: Readonly<Record<string, DifficultyDef>> = {
  easy:   { missedLimit: 5, zombieSpeedMultiplier: 0.8 },
  normal: { missedLimit: 3, zombieSpeedMultiplier: 1.0 },
  hard:   { missedLimit: 1, zombieSpeedMultiplier: 1.2 },
}

export const DEFAULT_DIFFICULTY = 'normal'
```

- [ ] **Step 2: 提交**

```bash
git add src/config/difficulty.ts
git commit -m "feat(config): 难度档位配置"
```

---

## Task 5: 战斗通用参数配置

**Files:**
- Create: `src/config/battle.ts`

- [ ] **Step 1: 创建战斗参数配置文件**

```ts
// src/config/battle.ts
import type { BattleDef } from './types'

/** 战斗通用参数 */
export const BATTLE_PARAMS: BattleDef = {
  projectileSpeed: 500,    // 弹道速度 像素/秒
  healAmount: 30,           // 打满回血量
  wavePauseDuration: 3000,  // 波次间暂停 毫秒
}
```

- [ ] **Step 2: 提交**

```bash
git add src/config/battle.ts
git commit -m "feat(config): 战斗通用参数配置"
```

---

## Task 6: 阶段/关卡/波次配置 — 两个体验不同的关卡

**Files:**
- Create: `src/config/stages.ts`

- [ ] **Step 1: 创建阶段配置文件**

第一关：少量慢僵尸、长间隔，让新手适应。第二关：更多更快的僵尸、短间隔，有节奏压力。

```ts
// src/config/stages.ts
import type { StageDef } from './types'

/** 阶段 → 关卡 → 波次配置 */
export const STAGES: readonly StageDef[] = [
  {
    id: 1,
    name: '基准键练习',
    letters: ['f', 'j', 'd', 'k', 's', 'l', 'a'],
    plants: ['peashooter', 'snow_pea', 'repeater'],
    levels: [
      {
        id: 1,
        waves: [
          { zombieType: 'normal', count: 5, interval: 3000 },
          { zombieType: 'normal', count: 7, interval: 2500 },
          { zombieType: 'normal', count: 10, interval: 2000 },
        ],
      },
      {
        id: 2,
        waves: [
          { zombieType: 'normal', count: 8, interval: 2000 },
          { zombieType: 'normal', count: 12, interval: 1500 },
          { zombieType: 'normal', count: 15, interval: 1200 },
        ],
      },
    ],
  },
]
```

- [ ] **Step 2: 提交**

```bash
git add src/config/stages.ts
git commit -m "feat(config): 阶段/关卡/波次配置，含两个体验不同的关卡"
```

---

## Task 7: 配置统一导出

**Files:**
- Create: `src/config/index.ts`

- [ ] **Step 1: 创建统一导出文件**

```ts
// src/config/index.ts
export { PLANT_DEFS } from './plants'
export { ZOMBIE_DEFS } from './zombies'
export { STAGES } from './stages'
export { DIFFICULTIES, DEFAULT_DIFFICULTY } from './difficulty'
export { BATTLE_PARAMS } from './battle'
export type { PlantDef, ZombieDef, WaveDef, LevelDef, StageDef, DifficultyDef, BattleDef } from './types'
```

- [ ] **Step 2: 提交**

```bash
git add src/config/index.ts
git commit -m "feat(config): 统一导出入口"
```

---

## Task 8: 配置校验函数 — 测试先行

**Files:**
- Create: `src/config/__tests__/validation.test.ts`
- Create: `src/config/validation.ts`

- [ ] **Step 1: 写校验函数的失败测试**

```ts
// src/config/__tests__/validation.test.ts
import { describe, it, expect } from 'vitest'
import { validateConfig } from '../validation'
import type { PlantDef, ZombieDef, StageDef } from '../types'

const validPlants: PlantDef[] = [
  { id: 'p1', name: 'Plant1', comboSegment: 4, attackPower: 10, hp: 100 },
  { id: 'p2', name: 'Plant2', comboSegment: 8, attackPower: 20, hp: 80 },
]

const validZombies: Record<string, ZombieDef> = {
  normal: { id: 'normal', name: 'Normal', hp: 50, speed: 30, chewDps: 10 },
}

const validStages: StageDef[] = [
  {
    id: 1,
    name: 'Stage 1',
    letters: ['f', 'j'],
    plants: ['p1', 'p2'],
    levels: [
      {
        id: 1,
        waves: [{ zombieType: 'normal', count: 5, interval: 3000 }],
      },
    ],
  },
]

describe('validateConfig', () => {
  it('合法配置返回空错误列表', () => {
    const errors = validateConfig(validPlants, validZombies, validStages)
    expect(errors).toEqual([])
  })

  it('植物 id 重复报错', () => {
    const plants: PlantDef[] = [
      { id: 'dup', name: 'A', comboSegment: 4, attackPower: 10, hp: 100 },
      { id: 'dup', name: 'B', comboSegment: 4, attackPower: 10, hp: 100 },
    ]
    const errors = validateConfig(plants, validZombies, validStages)
    expect(errors.some(e => e.includes('dup'))).toBe(true)
  })

  it('植物 comboSegment <= 0 报错', () => {
    const plants: PlantDef[] = [
      { id: 'bad', name: 'Bad', comboSegment: 0, attackPower: 10, hp: 100 },
    ]
    const errors = validateConfig(plants, validZombies, validStages)
    expect(errors.some(e => e.includes('comboSegment'))).toBe(true)
  })

  it('植物 hp <= 0 报错', () => {
    const plants: PlantDef[] = [
      { id: 'bad', name: 'Bad', comboSegment: 4, attackPower: 10, hp: 0 },
    ]
    const errors = validateConfig(plants, validZombies, validStages)
    expect(errors.some(e => e.includes('hp'))).toBe(true)
  })

  it('波次引用不存在的 zombieType 报错', () => {
    const stages: StageDef[] = [
      {
        id: 1,
        name: 'S1',
        letters: ['f'],
        plants: ['p1'],
        levels: [
          {
            id: 1,
            waves: [{ zombieType: 'ghost', count: 5, interval: 3000 }],
          },
        ],
      },
    ]
    const errors = validateConfig(validPlants, validZombies, stages)
    expect(errors.some(e => e.includes('ghost'))).toBe(true)
  })

  it('阶段引用不存在的植物 id 报错', () => {
    const stages: StageDef[] = [
      {
        id: 1,
        name: 'S1',
        letters: ['f'],
        plants: ['p1', 'nonexist'],
        levels: [
          {
            id: 1,
            waves: [{ zombieType: 'normal', count: 5, interval: 3000 }],
          },
        ],
      },
    ]
    const errors = validateConfig(validPlants, validZombies, stages)
    expect(errors.some(e => e.includes('nonexist'))).toBe(true)
  })

  it('波次 count <= 0 报错', () => {
    const stages: StageDef[] = [
      {
        id: 1,
        name: 'S1',
        letters: ['f'],
        plants: ['p1'],
        levels: [
          {
            id: 1,
            waves: [{ zombieType: 'normal', count: 0, interval: 3000 }],
          },
        ],
      },
    ]
    const errors = validateConfig(validPlants, validZombies, stages)
    expect(errors.some(e => e.includes('count'))).toBe(true)
  })

  it('阶段字母池为空报错', () => {
    const stages: StageDef[] = [
      {
        id: 1,
        name: 'S1',
        letters: [],
        plants: ['p1'],
        levels: [{ id: 1, waves: [{ zombieType: 'normal', count: 5, interval: 3000 }] }],
      },
    ]
    const errors = validateConfig(validPlants, validZombies, stages)
    expect(errors.some(e => e.includes('letters'))).toBe(true)
  })
})
```

- [ ] **Step 2: 运行测试确认全部失败**

Run: `npx vitest run src/config/__tests__/validation.test.ts`
Expected: FAIL — `validateConfig` 不存在

- [ ] **Step 3: 实现校验函数**

```ts
// src/config/validation.ts
import type { PlantDef, ZombieDef, StageDef } from './types'

/**
 * 校验配置语义正确性，返回错误消息列表。空列表表示通过。
 */
export function validateConfig(
  plants: readonly PlantDef[],
  zombies: Readonly<Record<string, ZombieDef>>,
  stages: readonly StageDef[],
): string[] {
  const errors: string[] = []
  const plantIds = new Set<string>()

  // 植物校验
  for (const p of plants) {
    if (plantIds.has(p.id)) {
      errors.push(`植物 id 重复: "${p.id}"`)
    }
    plantIds.add(p.id)

    if (p.comboSegment <= 0) {
      errors.push(`植物 "${p.id}" comboSegment 必须 > 0，当前: ${p.comboSegment}`)
    }
    if (p.hp <= 0) {
      errors.push(`植物 "${p.id}" hp 必须 > 0，当前: ${p.hp}`)
    }
  }

  // 阶段/关卡/波次校验
  for (const stage of stages) {
    if (stage.letters.length === 0) {
      errors.push(`阶段 ${stage.id} "${stage.name}" letters 字母池不能为空`)
    }

    for (const plantId of stage.plants) {
      if (!plantIds.has(plantId)) {
        errors.push(`阶段 ${stage.id} 引用不存在的植物: "${plantId}"`)
      }
    }

    for (const level of stage.levels) {
      for (const wave of level.waves) {
        if (!(wave.zombieType in zombies)) {
          errors.push(`阶段 ${stage.id} 关卡 ${level.id} 引用不存在的僵尸类型: "${wave.zombieType}"`)
        }
        if (wave.count <= 0) {
          errors.push(`阶段 ${stage.id} 关卡 ${level.id} 波次 count 必须 > 0，当前: ${wave.count}`)
        }
      }
    }
  }

  return errors
}
```

- [ ] **Step 4: 运行测试确认全部通过**

Run: `npx vitest run src/config/__tests__/validation.test.ts`
Expected: 8 tests PASS

- [ ] **Step 5: 提交**

```bash
git add src/config/validation.ts src/config/__tests__/validation.test.ts
git commit -m "feat(config): 配置校验函数 + 测试"
```

---

## Task 9: 游戏层类型重命名 segments → comboSegment

这一步是纯重命名，改完后所有现有测试必须通过。

**Files:**
- Modify: `src/game/types.ts`
- Modify: `src/game/Settlement.ts`
- Modify: `src/game/PlantChain.ts`
- Modify: `src/game/ComboSystem.ts`
- Modify: `src/game/BattleManager.ts`
- Modify: `src/game/PlantEntity.ts`
- Modify: `src/game/__tests__/Settlement.test.ts`
- Modify: `src/game/__tests__/PlantChain.test.ts`
- Modify: `src/game/__tests__/BattleManager.test.ts`
- Modify: `src/scenes/BattleScene.ts`

- [ ] **Step 1: 修改 `src/game/types.ts` — PlantConfig 接口**

将 `PlantConfig` 中的 `segments` 改为 `comboSegment`：

```ts
export interface PlantConfig {
  readonly id: string
  readonly name: string
  readonly comboSegment: number   // 原 segments，对齐 GAME_DESIGN
  readonly attackPower: number
  readonly hp: number
}
```

- [ ] **Step 2: 全局替换所有 `.segments` 引用**

在以下文件中，将所有 `config.segments`、`p.segments`、`.segments` 等引用改为 `.comboSegment`：

**`src/game/Settlement.ts`** — `plant.config.segments` → `plant.config.comboSegment`（1 处，约第 28 行）

**`src/game/PlantChain.ts`** — `config.segments`（2 处，约第 14 行和第 17 行）

**`src/game/ComboSystem.ts`** — 构造参数 `segments` 类型不变（它接收 `number[]`，不涉及字段名）。无需改动。

**`src/game/BattleManager.ts`** — 搜索 `.segments`，约 4 处：
- 第 51 行: `config.plants.reduce((s, p) => s + p.segments, 0)` → `p.comboSegment`
- 第 55 行: `config.plants.map(p => p.segments)` → `p.comboSegment`
- 第 74 行和第 78 行: `config.plants[i].segments` → `config.plants[i].comboSegment`

**`src/game/PlantEntity.ts`** — 搜索 `segments`，如有引用改为 `comboSegment`。（需确认文件内容，PlantEntity 可能不直接引用 PlantConfig.segments）

**`src/scenes/BattleScene.ts`** — 硬编码的 `PLANTS` 数组中 `segments:` → `comboSegment:`，以及 `PLANTS[i].segments` → `PLANTS[i].comboSegment`（约 3-4 处）

- [ ] **Step 3: 全局替换测试文件中的 segments**

**`src/game/__tests__/Settlement.test.ts`** — `makePlant` 函数参数名 `segments` → `comboSegment`，以及 `PlantConfig` 中 `segments:` → `comboSegment:`

**`src/game/__tests__/PlantChain.test.ts`** — 所有 `segments:` → `comboSegment:`

**`src/game/__tests__/BattleManager.test.ts`** — 所有 `segments:` → `comboSegment:`

- [ ] **Step 4: 运行全部测试确认无破坏**

Run: `npx vitest run`
Expected: 所有现有测试通过（约 105 个）

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "refactor(game): PlantConfig.segments → comboSegment 对齐 GAME_DESIGN"
```

---

## Task 10: WaveConfig 新增 zombieType 字段

当前 `WaveConfig` 只有 `count` 和 `interval`，需要新增 `zombieType` 字段以支持多种僵尸（虽然当前只有 normal 一种，但配置结构要就位）。

**Files:**
- Modify: `src/game/types.ts`
- Modify: `src/game/BattleManager.ts`
- Modify: `src/game/__tests__/BattleManager.test.ts`
- Modify: `src/scenes/BattleScene.ts`

- [ ] **Step 1: 修改 WaveConfig 类型**

在 `src/game/types.ts` 中：

```ts
/** 波次配置 */
export interface WaveConfig {
  readonly zombieType: string    // 僵尸类型 id
  readonly count: number
  readonly interval: number
}
```

- [ ] **Step 2: 修改 BattleConfig 新增僵尸查找表**

在 `src/game/BattleManager.ts` 中，`BattleConfig` 接口中的 `zombieConfig` 改为按类型索引的表：

```ts
export interface BattleConfig {
  readonly plants: readonly PlantConfig[]
  readonly waves: readonly WaveConfig[]
  readonly zombieConfigs: Readonly<Record<string, ZombieConfig>>  // 改为按类型索引
  readonly letterPool: readonly string[]
  readonly missedLimit: number
  readonly projectileSpeed: number
  readonly healAmount: number
  readonly wavePauseDuration: number   // 新增，从配置注入
  readonly canvasWidth: number
  readonly canvasHeight: number
  readonly letterSeed?: number
}
```

同时删除文件顶部的 `const WAVE_PAUSE_DURATION = 3000`，改用 `this.config.wavePauseDuration`。

- [ ] **Step 3: 修改 BattleManager.spawnZombie 按波次类型查找僵尸配置**

将 `spawnZombie()` 方法改为：

```ts
private spawnZombie(): void {
  const wave = this.config.waves[this._currentWave]
  const zombieConfig = this.config.zombieConfigs[wave.zombieType]
  const { canvasWidth } = this.config
  const id = `zombie_${this.zombieIdCounter++}`
  const spawnX = canvasWidth + 20
  const speed = zombieConfig.speed  // 未来阶段在此处乘以难度倍率
  const zombie = new ZombieEntity(id, spawnX, this.laneY, zombieConfig.hp, speed, zombieConfig.chewDps)
  this.assignChewTarget(zombie)
  this.entityManager.add(zombie)
}
```

将 `checkWaveCompletion()` 中的 `WAVE_PAUSE_DURATION` 改为 `this.config.wavePauseDuration`。

- [ ] **Step 4: 修改 BattleManager 测试文件**

在 `src/game/__tests__/BattleManager.test.ts` 中，所有构造 `BattleConfig` 的地方：
- `zombieConfig: { hp: ..., speed: ..., chewDps: ... }` → `zombieConfigs: { normal: { hp: ..., speed: ..., chewDps: ... } }`
- 所有 `WaveConfig` 对象加上 `zombieType: 'normal'`
- 新增 `wavePauseDuration: 3000`

- [ ] **Step 5: 修改 BattleScene.ts 中的硬编码**

临时更新 `BattleScene.ts` 中构造 `BattleManager` 的参数：
- `zombieConfig: ZOMBIE_CONFIG` → `zombieConfigs: { normal: ZOMBIE_CONFIG }`
- `WAVES` 数组的每个元素加上 `zombieType: 'normal'`
- 新增 `wavePauseDuration: 3000`

（这些硬编码会在 Task 11 被配置导入替换，此步只为确保编译通过。）

- [ ] **Step 6: 运行全部测试**

Run: `npx vitest run`
Expected: 所有测试通过

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "refactor(game): WaveConfig 新增 zombieType，BattleConfig 支持多僵尸类型和波次暂停配置"
```

---

## Task 11: BattleScene 改用配置层 — 删除所有硬编码

**Files:**
- Modify: `src/scenes/BattleScene.ts`

- [ ] **Step 1: 重写 BattleScene 顶部导入和配置组装**

删除 `BattleScene.ts` 顶部第 7-22 行的所有硬编码常量，替换为从 config 导入：

```ts
import type { Scene, InputEvent } from '../engine/types'
import type { PlantConfig, ZombieConfig } from '../game/types'
import { BattleStatus } from '../game/types'
import { BattleManager } from '../game/BattleManager'
import { PlantEntity } from '../game/PlantEntity'
import { PLANT_DEFS, ZOMBIE_DEFS, STAGES, DIFFICULTIES, DEFAULT_DIFFICULTY, BATTLE_PARAMS } from '../config'
import { validateConfig } from '../config/validation'
```

- [ ] **Step 2: 添加配置解析辅助方法**

在 `BattleScene` 类中添加私有字段和辅助方法，用于从 config 组装 BattleManager 所需参数：

```ts
export class BattleScene implements Scene {
  readonly name = 'battle'
  private switchTo: (name: string) => void

  private manager: BattleManager | null = null
  private plantEntities: PlantEntity[] = []
  private paused = false
  private canvasWidth = 0
  private canvasHeight = 0

  // 当前关卡信息（阶段三固定为第 1 阶段第 1 关，后续阶段支持选择）
  private stageIndex = 0
  private levelIndex = 0

  constructor(switchTo: (name: string) => void) {
    this.switchTo = switchTo

    // 启动时校验配置
    const errors = validateConfig(PLANT_DEFS, ZOMBIE_DEFS, STAGES)
    if (errors.length > 0) {
      console.error('配置校验失败:')
      for (const e of errors) console.error('  -', e)
    }
  }
```

- [ ] **Step 3: 重写 enter() 方法从配置组装参数**

```ts
  enter(): void {
    this.canvasWidth = typeof window !== 'undefined' ? window.innerWidth : 800
    this.canvasHeight = typeof window !== 'undefined' ? window.innerHeight : 600
    this.paused = false

    const stage = STAGES[this.stageIndex]
    const level = stage.levels[this.levelIndex]
    const difficulty = DIFFICULTIES[DEFAULT_DIFFICULTY]

    // 从配置层的 PlantDef 转换为游戏层的 PlantConfig
    const plants: PlantConfig[] = stage.plants.map(id => {
      const def = PLANT_DEFS.find(p => p.id === id)!
      return {
        id: def.id,
        name: def.name,
        comboSegment: def.comboSegment,
        attackPower: def.attackPower,
        hp: def.hp,
      }
    })

    // 从配置层的 ZombieDef 转换为游戏层的 ZombieConfig
    const zombieConfigs: Record<string, { hp: number; speed: number; chewDps: number }> = {}
    for (const [id, def] of Object.entries(ZOMBIE_DEFS)) {
      zombieConfigs[id] = {
        hp: def.hp,
        speed: def.speed * difficulty.zombieSpeedMultiplier,
        chewDps: def.chewDps,
      }
    }

    this.manager = new BattleManager({
      plants,
      waves: level.waves,
      zombieConfigs,
      letterPool: stage.letters,
      missedLimit: difficulty.missedLimit,
      projectileSpeed: BATTLE_PARAMS.projectileSpeed,
      healAmount: BATTLE_PARAMS.healAmount,
      wavePauseDuration: BATTLE_PARAMS.wavePauseDuration,
      canvasWidth: this.canvasWidth,
      canvasHeight: this.canvasHeight,
    })

    // 植物实体布局
    const plantAreaWidth = this.canvasWidth * 0.35
    const laneY = Math.round(this.canvasHeight * 0.4)
    const totalSegments = plants.reduce((s, p) => s + p.comboSegment, 0)
    const gap = 8
    const totalGap = gap * (plants.length - 1)
    const usableWidth = plantAreaWidth - totalGap
    const startX = 20

    this.plantEntities = []
    let curX = startX
    for (let i = 0; i < plants.length; i++) {
      const w = Math.round((plants[i].comboSegment / totalSegments) * usableWidth)
      const entity = new PlantEntity(`plant_${i}`, curX, laneY - 30, w, i)
      this.plantEntities.push(entity)
      curX += w + gap
    }
  }
```

- [ ] **Step 4: 更新 update() 和 render() 中对配置的引用**

在 `update()` 中，将 `PLANTS[i].segments` → 从 manager 获取（已通过 `plantStates[i].config.comboSegment` 可达）：

```ts
  update(dt: number): void {
    this.canvasWidth = typeof window !== 'undefined' ? window.innerWidth : 800
    this.canvasHeight = typeof window !== 'undefined' ? window.innerHeight : 600

    if (!this.manager || this.paused) return

    this.manager.update(dt)

    const plantStates = this.manager.getPlantStates()
    const comboCount = this.manager.comboCount
    const chainLetters = this.manager.getChainLetters()

    let segOffset = 0
    for (let i = 0; i < this.plantEntities.length; i++) {
      const entity = this.plantEntities[i]
      if (i >= plantStates.length) break

      const segments = plantStates[i].config.comboSegment
      entity.syncState(plantStates[i])
      entity.letters = chainLetters.slice(segOffset, segOffset + segments) as string[]
      entity.typedCount = Math.max(0, Math.min(segments, comboCount - segOffset))
      entity.isCurrentTarget = comboCount >= segOffset && comboCount < segOffset + segments
      segOffset += segments
    }
  }
```

在 `render()` 中，HUD 信息也不再引用顶部常量：
- `WAVES.length` → `this.manager` 提供的总波次数

在 BattleManager 中添加一个 getter：

```ts
// BattleManager.ts — 新增
get totalWaves(): number { return this.config.waves.length }
get missedLimit(): number { return this.config.missedLimit }
```

然后 `render()` 中：
- ``波次: ${wave + 1}/${WAVES.length}`` → ``波次: ${wave + 1}/${this.manager.totalWaves}``
- ``漏过: ${missed}/${MISSED_LIMIT}`` → ``漏过: ${missed}/${this.manager.missedLimit}``

- [ ] **Step 5: 运行全部测试**

Run: `npx vitest run`
Expected: 所有测试通过

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "refactor(scene): BattleScene 改用配置层，删除所有硬编码常量"
```

---

## Task 12: 关卡切换支持 — BattleScene 接受关卡参数

当前 BattleScene 硬编码 `stageIndex = 0, levelIndex = 0`。为了验收"两个关卡体验不同"，需要支持切换关卡。

**Files:**
- Modify: `src/scenes/BattleScene.ts`
- Modify: `src/scenes/MenuScene.ts`（如果存在菜单场景）

- [ ] **Step 1: 检查 MenuScene 现状并确认切换机制**

阅读 `src/scenes/MenuScene.ts`，了解当前菜单怎么切换到战斗场景。

- [ ] **Step 2: BattleScene 支持设置关卡**

在 BattleScene 中添加方法让外部设置关卡：

```ts
  setLevel(stageIndex: number, levelIndex: number): void {
    this.stageIndex = stageIndex
    this.levelIndex = levelIndex
  }
```

- [ ] **Step 3: 通关后自动进入下一关**

在 `handleInput()` 中，Victory 时按空格：如果当前阶段还有下一关，进入下一关；否则回菜单：

```ts
    if (status === BattleStatus.Victory && event.key === ' ') {
      const stage = STAGES[this.stageIndex]
      if (this.levelIndex + 1 < stage.levels.length) {
        this.levelIndex++
        this.enter()  // 重新初始化下一关
      } else {
        this.switchTo('menu')
      }
      return
    }
```

- [ ] **Step 4: 在 render() 中显示当前关卡信息**

在 HUD 中增加关卡显示：

```ts
ctx.fillText(`第${this.stageIndex + 1}阶段 关卡${this.levelIndex + 1}`, 10, 25)
```

原来的波次信息右移。

- [ ] **Step 5: 运行全部测试 + 浏览器验收**

Run: `npx vitest run`
Expected: 所有测试通过

浏览器验收：
- 打开游戏，第一关（5/7/10 只僵尸，间隔长）打完后按空格
- 自动进入第二关（8/12/15 只僵尸，间隔短），节奏明显更快
- 第二关打完按空格回到菜单
- 第一关失败按空格重打当前关（不跳到第二关）

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "feat(scene): 支持关卡切换，通关自动进入下一关"
```

---

## Task 13: 启动时运行配置校验

**Files:**
- Modify: `src/scenes/BattleScene.ts`（已在 Task 11 Step 2 中添加了校验调用，此 task 验证校验生效）

- [ ] **Step 1: 验证校验函数被正确调用**

临时在 `src/config/stages.ts` 中故意写一个不存在的植物 id，启动 dev server 打开浏览器控制台。

预期：控制台输出 `配置校验失败:` 和具体错误信息。

- [ ] **Step 2: 恢复正确配置**

撤销临时改动。

- [ ] **Step 3: 运行全部测试确认一切正常**

Run: `npx vitest run`
Expected: 全部通过

---

## Task 14: 最终验收 + 文档更新

**Files:**
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: 逐条验收完成标准**

对照 ROADMAP 阶段三完成标准：

1. ✅ 改一行 config 能出新关卡（stages.ts 已有两个关卡）
2. ✅ 改植物属性只需改 plants.ts
3. ✅ 改僵尸属性只需改 zombies.ts
4. ✅ 改难度参数只需改 difficulty.ts
5. ✅ 配置校验，填错报错

验收方式：修改 `plants.ts` 中豌豆射手的 `comboSegment` 从 4 改为 2，刷新浏览器确认链条缩短。改回。

- [ ] **Step 2: 更新 ROADMAP 标记阶段三完成**

在 ROADMAP.md 阶段三的完成标准全部打勾 `[x]`，并在下方添加完成记录：

```markdown
> **已完成** — 6 个配置文件 + 校验函数 + N 个单元测试。详见 `docs/plans/2026-04-14-stage3-config-layer.md`。
```

- [ ] **Step 3: 运行全部测试最终确认**

Run: `npx vitest run`
Expected: 全部通过

- [ ] **Step 4: 提交**

```bash
git add docs/ROADMAP.md
git commit -m "docs: 更新 ROADMAP 标记阶段三完成"
```

Plan complete and saved to [docs/plans/2026-04-14-stage3-config-layer.md](docs/plans/2026-04-14-stage3-config-layer.md). Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?