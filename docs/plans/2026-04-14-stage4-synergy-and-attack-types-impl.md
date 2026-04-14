# 阶段四（4.1+4.2）协同攻击与多弹道 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现协同攻击倍率系统和多弹道类型（direct/pierce/area/tracking），让结算攻击从单一直射变为支持 4 种弹道 + 元素标签 + 协同加成的完整攻击系统。

**Architecture:** 新增 EffectSynthesis 纯函数模块负责特效合成，扩展 Settlement 加入协同倍率计算，扩展 ProjectileEntity 支持 4 种弹道飞行行为。Config 层新增 Element/Trajectory 类型、协同倍率表、辐射弹道参数。场景层负责从 config 读取并注入游戏逻辑层。

**Tech Stack:** TypeScript strict, Vitest, Canvas 2D

---

## 文件变更总览

| 操作 | 文件 | 职责 |
|------|------|------|
| 修改 | `src/config/types.ts` | 新增 Element/Trajectory/SynergyDef 类型，扩展 PlantDef/BattleDef |
| 修改 | `src/config/plants.ts` | 现有植物补充 element/trajectory |
| 创建 | `src/config/synergy.ts` | 协同倍率配置 |
| 修改 | `src/config/battle.ts` | 新增辐射弹道参数 + trackingTurnRate |
| 修改 | `src/config/validation.ts` | 新增 element/trajectory/synergy/area 校验 |
| 修改 | `src/config/index.ts` | 导出新增模块 |
| 修改 | `src/config/__tests__/validation.test.ts` | 新增校验测试 |
| 创建 | `src/game/EffectSynthesis.ts` | 特效合成纯函数 |
| 创建 | `src/game/__tests__/EffectSynthesis.test.ts` | 特效合成测试 |
| 修改 | `src/game/types.ts` | PlantConfig 加 element/trajectory，SettlementResult 扩展 |
| 修改 | `src/game/Settlement.ts` | 加协同倍率 + 调用 EffectSynthesis |
| 修改 | `src/game/__tests__/Settlement.test.ts` | 协同倍率测试 |
| 修改 | `src/game/ProjectileEntity.ts` | 支持 4 种弹道 + element 渲染 |
| 修改 | `src/game/__tests__/ProjectileEntity.test.ts` | 多弹道测试 |
| 修改 | `src/game/BattleManager.ts` | BattleConfig 扩展，结算创建多弹道，碰撞处理 pierce |
| 修改 | `src/game/__tests__/BattleManager.test.ts` | 协同 + 多弹道集成测试 |
| 修改 | `src/scenes/BattleScene.ts` | 注入协同倍率 + 弹道参数 |

---

### Task 1: Config 层类型扩展

**Files:**
- Modify: `src/config/types.ts`

- [ ] **Step 1: 在 types.ts 中新增 Element、Trajectory 类型和 SynergyDef 接口，扩展 PlantDef 和 BattleDef**

```ts
// 在文件顶部新增
export type Element = 'normal' | 'ice' | 'fire'
export type Trajectory = 'direct' | 'tracking' | 'pierce' | 'area'

export interface SynergyDef {
  readonly multiplier: Readonly<Record<number, number>>
}
```

PlantDef 新增两个字段：

```ts
export interface PlantDef {
  readonly id: string
  readonly name: string
  readonly comboSegment: number
  readonly attackPower: number
  readonly hp: number
  readonly element: Element
  readonly trajectory: Trajectory
}
```

BattleDef 新增四个字段：

```ts
export interface BattleDef {
  readonly projectileSpeed: number
  readonly healAmount: number
  readonly wavePauseDuration: number
  readonly areaBulletCount: number
  readonly areaSpreadAngle: number
  readonly areaDamageDecay: number
  readonly trackingTurnRate: number
}
```

- [ ] **Step 2: 确认 TypeScript 编译无报错**

Run: `npx tsc --noEmit 2>&1 | head -30`

预期：会有编译错误（plants.ts 和 validation.test.ts 中的 PlantDef 缺少新字段，battle.ts 缺少新字段）。这是正常的，后续 Task 会修复。

- [ ] **Step 3: Commit**

```bash
git add src/config/types.ts
git commit -m "feat(config): 新增 Element/Trajectory/SynergyDef 类型，扩展 PlantDef 和 BattleDef"
```

---

### Task 2: Config 层数据文件更新

**Files:**
- Modify: `src/config/plants.ts`
- Modify: `src/config/battle.ts`
- Create: `src/config/synergy.ts`
- Modify: `src/config/index.ts`

- [ ] **Step 1: 更新 plants.ts，现有植物补充 element 和 trajectory**

```ts
import type { PlantDef } from './types'

export const PLANT_DEFS: readonly PlantDef[] = [
  { id: 'peashooter', name: '豌豆射手', comboSegment: 4, attackPower: 20, hp: 100, element: 'normal', trajectory: 'direct' },
  { id: 'snow_pea',   name: '寒冰射手', comboSegment: 4, attackPower: 15, hp: 80,  element: 'ice',    trajectory: 'direct' },
  { id: 'repeater',   name: '双发射手', comboSegment: 8, attackPower: 35, hp: 120, element: 'normal', trajectory: 'direct' },
]
```

- [ ] **Step 2: 更新 battle.ts，新增辐射弹道参数和追踪转向速率**

```ts
import type { BattleDef } from './types'

export const BATTLE_PARAMS: BattleDef = {
  projectileSpeed: 500,
  healAmount: 30,
  wavePauseDuration: 3000,
  areaBulletCount: 5,
  areaSpreadAngle: Math.PI / 3,
  areaDamageDecay: 1.0,
  trackingTurnRate: Math.PI,
}
```

- [ ] **Step 3: 创建 synergy.ts**

```ts
import type { SynergyDef } from './types'

export const SYNERGY_PARAMS: SynergyDef = {
  multiplier: { 1: 1.0, 2: 1.2, 3: 1.5, 4: 1.8, 5: 2.2, 6: 3.0 },
}
```

- [ ] **Step 4: 更新 config/index.ts 导出新模块**

```ts
export { PLANT_DEFS } from './plants'
export { ZOMBIE_DEFS } from './zombies'
export { STAGES } from './stages'
export { DIFFICULTIES, DEFAULT_DIFFICULTY } from './difficulty'
export { BATTLE_PARAMS } from './battle'
export { SYNERGY_PARAMS } from './synergy'
export type { PlantDef, ZombieDef, WaveDef, LevelDef, StageDef, DifficultyDef, BattleDef, SynergyDef, Element, Trajectory } from './types'
```

- [ ] **Step 5: Commit**

```bash
git add src/config/plants.ts src/config/battle.ts src/config/synergy.ts src/config/index.ts
git commit -m "feat(config): 植物补充 element/trajectory，新增 synergy 配置和辐射弹道参数"
```

---

### Task 3: Config 校验扩展

**Files:**
- Modify: `src/config/validation.ts`
- Modify: `src/config/__tests__/validation.test.ts`

- [ ] **Step 1: 写校验测试（红）**

在 `src/config/__tests__/validation.test.ts` 中，先更新顶部测试数据以符合新的 PlantDef 结构，然后新增测试用例：

更新已有测试数据：

```ts
const validPlants: PlantDef[] = [
  { id: 'p1', name: 'Plant1', comboSegment: 4, attackPower: 10, hp: 100, element: 'normal', trajectory: 'direct' },
  { id: 'p2', name: 'Plant2', comboSegment: 8, attackPower: 20, hp: 80, element: 'ice', trajectory: 'direct' },
]
```

新增导入 SynergyDef 和 BattleDef：

```ts
import type { PlantDef, ZombieDef, StageDef, SynergyDef, BattleDef } from '../types'
```

新增测试数据：

```ts
const validSynergy: SynergyDef = {
  multiplier: { 1: 1.0, 2: 1.2, 3: 1.5 },
}

const validBattle: BattleDef = {
  projectileSpeed: 500,
  healAmount: 30,
  wavePauseDuration: 3000,
  areaBulletCount: 5,
  areaSpreadAngle: Math.PI / 3,
  areaDamageDecay: 1.0,
  trackingTurnRate: Math.PI,
}
```

更新已有 `validateConfig` 调用为新签名（传入 synergy + battle）：

```ts
const errors = validateConfig(validPlants, validZombies, validStages, validSynergy, validBattle)
```

新增测试：

```ts
  it('植物 element 非法值报错', () => {
    const plants = [
      { id: 'bad', name: 'Bad', comboSegment: 4, attackPower: 10, hp: 100, element: 'lightning' as any, trajectory: 'direct' as any },
    ]
    const errors = validateConfig(plants, validZombies, validStages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('element'))).toBe(true)
  })

  it('植物 trajectory 非法值报错', () => {
    const plants = [
      { id: 'bad', name: 'Bad', comboSegment: 4, attackPower: 10, hp: 100, element: 'normal' as any, trajectory: 'laser' as any },
    ]
    const errors = validateConfig(plants, validZombies, validStages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('trajectory'))).toBe(true)
  })

  it('synergy multiplier 缺少 key=1 报错', () => {
    const synergy: SynergyDef = { multiplier: { 2: 1.2 } }
    const errors = validateConfig(validPlants, validZombies, validStages, synergy, validBattle)
    expect(errors.some(e => e.includes('multiplier'))).toBe(true)
  })

  it('synergy multiplier key=1 的值不为 1.0 报错', () => {
    const synergy: SynergyDef = { multiplier: { 1: 1.5 } }
    const errors = validateConfig(validPlants, validZombies, validStages, synergy, validBattle)
    expect(errors.some(e => e.includes('1.0'))).toBe(true)
  })

  it('areaBulletCount < 1 报错', () => {
    const battle = { ...validBattle, areaBulletCount: 0 }
    const errors = validateConfig(validPlants, validZombies, validStages, validSynergy, battle)
    expect(errors.some(e => e.includes('areaBulletCount'))).toBe(true)
  })

  it('areaSpreadAngle <= 0 报错', () => {
    const battle = { ...validBattle, areaSpreadAngle: 0 }
    const errors = validateConfig(validPlants, validZombies, validStages, validSynergy, battle)
    expect(errors.some(e => e.includes('areaSpreadAngle'))).toBe(true)
  })

  it('areaDamageDecay <= 0 报错', () => {
    const battle = { ...validBattle, areaDamageDecay: -1 }
    const errors = validateConfig(validPlants, validZombies, validStages, validSynergy, battle)
    expect(errors.some(e => e.includes('areaDamageDecay'))).toBe(true)
  })
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/config/__tests__/validation.test.ts`

预期：编译错误或测试失败（validateConfig 签名还未更新）。

- [ ] **Step 3: 实现校验逻辑**

更新 `src/config/validation.ts`：

```ts
import type { PlantDef, ZombieDef, StageDef, SynergyDef, BattleDef } from './types'

const VALID_ELEMENTS = new Set(['normal', 'ice', 'fire'])
const VALID_TRAJECTORIES = new Set(['direct', 'tracking', 'pierce', 'area'])

export function validateConfig(
  plants: readonly PlantDef[],
  zombies: Readonly<Record<string, ZombieDef>>,
  stages: readonly StageDef[],
  synergy: SynergyDef,
  battle: BattleDef,
): string[] {
  const errors: string[] = []
  const plantIds = new Set<string>()

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
    if (!VALID_ELEMENTS.has(p.element)) {
      errors.push(`植物 "${p.id}" element 不合法: "${p.element}"，允许: ${[...VALID_ELEMENTS].join(', ')}`)
    }
    if (!VALID_TRAJECTORIES.has(p.trajectory)) {
      errors.push(`植物 "${p.id}" trajectory 不合法: "${p.trajectory}"，允许: ${[...VALID_TRAJECTORIES].join(', ')}`)
    }
  }

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

  // Synergy validation
  if (!(1 in synergy.multiplier)) {
    errors.push('synergy multiplier 必须包含 key=1')
  } else if (synergy.multiplier[1] !== 1.0) {
    errors.push(`synergy multiplier[1] 必须为 1.0，当前: ${synergy.multiplier[1]}`)
  }

  // Battle area params validation
  if (battle.areaBulletCount < 1) {
    errors.push(`areaBulletCount 必须 >= 1，当前: ${battle.areaBulletCount}`)
  }
  if (battle.areaSpreadAngle <= 0) {
    errors.push(`areaSpreadAngle 必须 > 0，当前: ${battle.areaSpreadAngle}`)
  }
  if (battle.areaDamageDecay <= 0) {
    errors.push(`areaDamageDecay 必须 > 0，当前: ${battle.areaDamageDecay}`)
  }

  return errors
}
```

- [ ] **Step 4: 运行测试确认全部通过**

Run: `npx vitest run src/config/__tests__/validation.test.ts`

预期：全部通过。

- [ ] **Step 5: 更新 BattleScene 中 validateConfig 调用以匹配新签名**

在 `src/scenes/BattleScene.ts` 中更新导入和构造函数中的调用：

```ts
import { PLANT_DEFS, ZOMBIE_DEFS, STAGES, DIFFICULTIES, DEFAULT_DIFFICULTY, BATTLE_PARAMS, SYNERGY_PARAMS } from '../config'
```

更新校验调用：

```ts
const errors = validateConfig(PLANT_DEFS, ZOMBIE_DEFS, STAGES, SYNERGY_PARAMS, BATTLE_PARAMS)
```

- [ ] **Step 6: Commit**

```bash
git add src/config/validation.ts src/config/__tests__/validation.test.ts src/scenes/BattleScene.ts
git commit -m "feat(config): 扩展校验函数，新增 element/trajectory/synergy/area 参数校验"
```

---

### Task 4: 游戏逻辑层类型扩展

**Files:**
- Modify: `src/game/types.ts`

- [ ] **Step 1: 扩展 PlantConfig 和 SettlementResult**

在 `src/game/types.ts` 顶部新增导入（注意：game/types.ts 不导入 config 层，而是重新定义 Element/Trajectory 类型供游戏层使用）：

```ts
export type Element = 'normal' | 'ice' | 'fire'
export type Trajectory = 'direct' | 'tracking' | 'pierce' | 'area'

export interface SynthesizedEffect {
  readonly element: Element
  readonly trajectory: Trajectory
}
```

扩展 PlantConfig：

```ts
export interface PlantConfig {
  readonly id: string
  readonly name: string
  readonly comboSegment: number
  readonly attackPower: number
  readonly hp: number
  readonly element: Element
  readonly trajectory: Trajectory
}
```

扩展 SettlementResult：

```ts
export interface SettlementResult {
  readonly totalPower: number
  readonly activatedIndices: readonly number[]
  readonly aliveActivatedIndices: readonly number[]
  readonly isFullChain: boolean
  readonly synergyMultiplier: number
  readonly perPlantPower: readonly number[]
  readonly synthesizedEffect: SynthesizedEffect
}
```

- [ ] **Step 2: 确认类型文件无语法错误**

Run: `npx tsc --noEmit 2>&1 | head -30`

预期：会有编译错误（Settlement.ts 返回值不匹配新 SettlementResult，测试中 PlantConfig 缺少新字段）。后续 Task 修复。

- [ ] **Step 3: Commit**

```bash
git add src/game/types.ts
git commit -m "feat(game): PlantConfig 加 element/trajectory，SettlementResult 加协同字段"
```

---

### Task 5: EffectSynthesis 模块（TDD）

**Files:**
- Create: `src/game/__tests__/EffectSynthesis.test.ts`
- Create: `src/game/EffectSynthesis.ts`

- [ ] **Step 1: 写特效合成测试（红）**

创建 `src/game/__tests__/EffectSynthesis.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { synthesizeEffects } from '../EffectSynthesis'

describe('synthesizeEffects', () => {
  it('空数组返回默认值 normal/direct', () => {
    const result = synthesizeEffects([])
    expect(result).toEqual({ element: 'normal', trajectory: 'direct' })
  })

  it('单棵植物返回自身标签', () => {
    const result = synthesizeEffects([{ element: 'ice', trajectory: 'pierce' }])
    expect(result).toEqual({ element: 'ice', trajectory: 'pierce' })
  })

  it('全 normal 元素返回 normal', () => {
    const result = synthesizeEffects([
      { element: 'normal', trajectory: 'direct' },
      { element: 'normal', trajectory: 'direct' },
    ])
    expect(result.element).toBe('normal')
  })

  it('含 ice 不含 fire 返回 ice', () => {
    const result = synthesizeEffects([
      { element: 'normal', trajectory: 'direct' },
      { element: 'ice', trajectory: 'direct' },
    ])
    expect(result.element).toBe('ice')
  })

  it('含 fire 不含 ice 返回 fire', () => {
    const result = synthesizeEffects([
      { element: 'normal', trajectory: 'direct' },
      { element: 'fire', trajectory: 'direct' },
    ])
    expect(result.element).toBe('fire')
  })

  it('ice + fire 互相抵消返回 normal', () => {
    const result = synthesizeEffects([
      { element: 'ice', trajectory: 'direct' },
      { element: 'fire', trajectory: 'direct' },
    ])
    expect(result.element).toBe('normal')
  })

  it('ice + fire + normal 仍然抵消为 normal', () => {
    const result = synthesizeEffects([
      { element: 'normal', trajectory: 'direct' },
      { element: 'ice', trajectory: 'direct' },
      { element: 'fire', trajectory: 'direct' },
    ])
    expect(result.element).toBe('normal')
  })

  it('弹道取最高优先级：area > pierce > tracking > direct', () => {
    const result = synthesizeEffects([
      { element: 'normal', trajectory: 'direct' },
      { element: 'normal', trajectory: 'tracking' },
    ])
    expect(result.trajectory).toBe('tracking')
  })

  it('弹道取最高优先级：pierce 高于 tracking', () => {
    const result = synthesizeEffects([
      { element: 'normal', trajectory: 'tracking' },
      { element: 'normal', trajectory: 'pierce' },
    ])
    expect(result.trajectory).toBe('pierce')
  })

  it('弹道取最高优先级：area 最高', () => {
    const result = synthesizeEffects([
      { element: 'normal', trajectory: 'direct' },
      { element: 'normal', trajectory: 'pierce' },
      { element: 'normal', trajectory: 'area' },
    ])
    expect(result.trajectory).toBe('area')
  })

  it('组合测试：ice + fire 抵消 + area 弹道', () => {
    const result = synthesizeEffects([
      { element: 'ice', trajectory: 'direct' },
      { element: 'fire', trajectory: 'area' },
    ])
    expect(result).toEqual({ element: 'normal', trajectory: 'area' })
  })

  it('组合测试：fire + tracking', () => {
    const result = synthesizeEffects([
      { element: 'fire', trajectory: 'direct' },
      { element: 'normal', trajectory: 'tracking' },
    ])
    expect(result).toEqual({ element: 'fire', trajectory: 'tracking' })
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/game/__tests__/EffectSynthesis.test.ts`

预期：FAIL（模块不存在）。

- [ ] **Step 3: 实现 EffectSynthesis**

创建 `src/game/EffectSynthesis.ts`：

```ts
import type { Element, Trajectory, SynthesizedEffect } from './types'

const TRAJECTORY_PRIORITY: Record<Trajectory, number> = {
  direct: 0,
  tracking: 1,
  pierce: 2,
  area: 3,
}

const TRAJECTORY_BY_PRIORITY: Trajectory[] = ['direct', 'tracking', 'pierce', 'area']

export function synthesizeEffects(
  plants: readonly { element: Element; trajectory: Trajectory }[],
): SynthesizedEffect {
  if (plants.length === 0) {
    return { element: 'normal', trajectory: 'direct' }
  }

  // Element: collect unique elements
  let hasIce = false
  let hasFire = false
  let maxTrajectoryPriority = 0

  for (let i = 0; i < plants.length; i++) {
    const p = plants[i]
    if (p.element === 'ice') hasIce = true
    if (p.element === 'fire') hasFire = true
    const tp = TRAJECTORY_PRIORITY[p.trajectory]
    if (tp > maxTrajectoryPriority) maxTrajectoryPriority = tp
  }

  // Ice + fire cancel out
  let element: Element
  if (hasIce && hasFire) {
    element = 'normal'
  } else if (hasIce) {
    element = 'ice'
  } else if (hasFire) {
    element = 'fire'
  } else {
    element = 'normal'
  }

  return { element, trajectory: TRAJECTORY_BY_PRIORITY[maxTrajectoryPriority] }
}
```

- [ ] **Step 4: 运行测试确认全部通过**

Run: `npx vitest run src/game/__tests__/EffectSynthesis.test.ts`

预期：全部通过。

- [ ] **Step 5: Commit**

```bash
git add src/game/EffectSynthesis.ts src/game/__tests__/EffectSynthesis.test.ts
git commit -m "feat(game): 新增 EffectSynthesis 特效合成模块（TDD）"
```

---

### Task 6: Settlement 协同倍率扩展（TDD）

**Files:**
- Modify: `src/game/__tests__/Settlement.test.ts`
- Modify: `src/game/Settlement.ts`

- [ ] **Step 1: 更新现有测试数据并新增协同测试（红）**

更新 `src/game/__tests__/Settlement.test.ts`：

首先更新 `makePlant` helper 以支持新字段：

```ts
import type { PlantState, PlantConfig, Element, Trajectory } from '../types'

function makePlant(
  index: number,
  attackPower: number,
  comboSegment = 4,
  alive = true,
  element: Element = 'normal',
  trajectory: Trajectory = 'direct',
): PlantState {
  const config: PlantConfig = {
    id: `plant-${index}`,
    name: `Plant ${index}`,
    comboSegment,
    attackPower,
    hp: 100,
    element,
    trajectory,
  }
  return { config, currentHp: alive ? 100 : 0, alive, chainIndex: index }
}
```

更新已有测试调用，所有 `calculateSettlement` 调用加第四个参数 `synergyTable`：

```ts
const defaultSynergy: Readonly<Record<number, number>> = { 1: 1.0, 2: 1.2, 3: 1.5 }
```

已有测试统一改为四参数调用，例如：

```ts
  it('打满的植物才算激活：连击 10 只激活前两棵（4+4 满），第三棵 2/8 未满不算', () => {
    const plants = [makePlant(0, 20), makePlant(1, 15), makePlant(2, 35, 8)]
    const result = calculateSettlement(plants, 10, false, defaultSynergy)
    // 2 棵激活存活 → multiplier = 1.2
    expect(result.synergyMultiplier).toBe(1.2)
    expect(result.perPlantPower).toEqual([20 * 1.2, 15 * 1.2])
    expect(result.totalPower).toBeCloseTo(20 * 1.2 + 15 * 1.2)
    expect(result.activatedIndices).toEqual([0, 1])
    expect(result.aliveActivatedIndices).toEqual([0, 1])
  })

  it('连击刚好打满一棵植物时激活该植物', () => {
    const plants = [makePlant(0, 20), makePlant(1, 15), makePlant(2, 35, 8)]
    const result = calculateSettlement(plants, 4, false, defaultSynergy)
    // 1 棵激活 → multiplier = 1.0
    expect(result.synergyMultiplier).toBe(1.0)
    expect(result.perPlantPower).toEqual([20])
    expect(result.totalPower).toBe(20)
    expect(result.activatedIndices).toEqual([0])
  })

  it('连击未打满第一棵植物时无激活', () => {
    const plants = [makePlant(0, 20), makePlant(1, 15), makePlant(2, 35, 8)]
    const result = calculateSettlement(plants, 3, false, defaultSynergy)
    expect(result.totalPower).toBe(0)
    expect(result.synergyMultiplier).toBe(1.0)
    expect(result.perPlantPower).toEqual([])
    expect(result.activatedIndices).toEqual([])
  })

  it('阵亡植物即使打满也不贡献攻击力', () => {
    const plants = [makePlant(0, 20), makePlant(1, 15, 4, false), makePlant(2, 35, 8)]
    const result = calculateSettlement(plants, 10, false, defaultSynergy)
    // P1 阵亡，只有 P0 存活激活 → multiplier = 1.0
    expect(result.synergyMultiplier).toBe(1.0)
    expect(result.perPlantPower).toEqual([20])
    expect(result.totalPower).toBe(20)
    expect(result.activatedIndices).toEqual([0, 1])
    expect(result.aliveActivatedIndices).toEqual([0])
  })

  it('连击为 0 时攻击力为 0', () => {
    const plants = [makePlant(0, 20)]
    const result = calculateSettlement(plants, 0, false, defaultSynergy)
    expect(result.totalPower).toBe(0)
    expect(result.synergyMultiplier).toBe(1.0)
    expect(result.perPlantPower).toEqual([])
    expect(result.activatedIndices).toEqual([])
  })

  it('打满全链条所有植物都激活', () => {
    const plants = [makePlant(0, 20), makePlant(1, 15)]
    const result = calculateSettlement(plants, 8, true, defaultSynergy)
    expect(result.isFullChain).toBe(true)
    expect(result.synergyMultiplier).toBe(1.2)
    expect(result.perPlantPower).toEqual([20 * 1.2, 15 * 1.2])
    expect(result.totalPower).toBeCloseTo(20 * 1.2 + 15 * 1.2)
    expect(result.activatedIndices).toEqual([0, 1])
  })
```

新增协同专属测试：

```ts
  it('3 棵植物全激活使用 multiplier[3]', () => {
    const plants = [makePlant(0, 20), makePlant(1, 15), makePlant(2, 10)]
    const result = calculateSettlement(plants, 12, true, defaultSynergy)
    expect(result.synergyMultiplier).toBe(1.5)
    expect(result.perPlantPower).toEqual([20 * 1.5, 15 * 1.5, 10 * 1.5])
    expect(result.totalPower).toBeCloseTo((20 + 15 + 10) * 1.5)
  })

  it('激活数量超出倍率表时取表中最大 key 的倍率', () => {
    const smallTable: Readonly<Record<number, number>> = { 1: 1.0, 2: 1.5 }
    const plants = [makePlant(0, 10), makePlant(1, 10), makePlant(2, 10)]
    const result = calculateSettlement(plants, 12, true, smallTable)
    // 3 棵激活但表中最大 key=2 → 用 1.5
    expect(result.synergyMultiplier).toBe(1.5)
  })

  it('特效合成返回正确的 synthesizedEffect', () => {
    const plants = [
      makePlant(0, 20, 4, true, 'ice', 'direct'),
      makePlant(1, 15, 4, true, 'normal', 'pierce'),
    ]
    const result = calculateSettlement(plants, 8, true, defaultSynergy)
    expect(result.synthesizedEffect).toEqual({ element: 'ice', trajectory: 'pierce' })
  })

  it('阵亡植物不参与特效合成', () => {
    const plants = [
      makePlant(0, 20, 4, true, 'normal', 'direct'),
      makePlant(1, 15, 4, false, 'ice', 'area'),  // 阵亡
    ]
    const result = calculateSettlement(plants, 8, true, defaultSynergy)
    // P1 阵亡不参与合成 → 只有 P0 的 normal/direct
    expect(result.synthesizedEffect).toEqual({ element: 'normal', trajectory: 'direct' })
  })

  it('不同植物有不同的 perPlantPower', () => {
    const plants = [makePlant(0, 20), makePlant(1, 30)]
    const result = calculateSettlement(plants, 8, true, defaultSynergy)
    expect(result.perPlantPower[0]).toBeCloseTo(20 * 1.2)
    expect(result.perPlantPower[1]).toBeCloseTo(30 * 1.2)
  })
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/game/__tests__/Settlement.test.ts`

预期：FAIL（calculateSettlement 签名不匹配）。

- [ ] **Step 3: 实现 Settlement 协同逻辑**

更新 `src/game/Settlement.ts`：

```ts
import type { PlantState, SettlementResult, SynthesizedEffect } from './types'
import { synthesizeEffects } from './EffectSynthesis'

export function calculateSettlement(
  plants: readonly PlantState[],
  comboCount: number,
  isFullChain: boolean,
  synergyMultiplier: Readonly<Record<number, number>>,
): SettlementResult {
  const empty: SettlementResult = {
    totalPower: 0,
    activatedIndices: [],
    aliveActivatedIndices: [],
    isFullChain: false,
    synergyMultiplier: 1.0,
    perPlantPower: [],
    synthesizedEffect: { element: 'normal', trajectory: 'direct' },
  }

  if (comboCount <= 0) {
    return empty
  }

  const activatedIndices: number[] = []
  const aliveActivatedIndices: number[] = []
  let segmentEnd = 0

  for (let i = 0; i < plants.length; i++) {
    const plant = plants[i]
    segmentEnd += plant.config.comboSegment
    if (comboCount >= segmentEnd) {
      activatedIndices.push(i)
      if (plant.alive) {
        aliveActivatedIndices.push(i)
      }
    }
  }

  const aliveCount = aliveActivatedIndices.length
  if (aliveCount === 0) {
    return { ...empty, activatedIndices, isFullChain }
  }

  // Lookup multiplier: use exact count or fallback to max configured key
  let multiplier = synergyMultiplier[aliveCount]
  if (multiplier === undefined) {
    let maxKey = 0
    for (const key in synergyMultiplier) {
      const k = Number(key)
      if (k <= aliveCount && k > maxKey) maxKey = k
    }
    multiplier = maxKey > 0 ? synergyMultiplier[maxKey] : 1.0
  }

  const perPlantPower: number[] = []
  let totalPower = 0
  for (const idx of aliveActivatedIndices) {
    const power = plants[idx].config.attackPower * multiplier
    perPlantPower.push(power)
    totalPower += power
  }

  // Synthesize effects from alive activated plants only
  const effectInputs = aliveActivatedIndices.map(idx => ({
    element: plants[idx].config.element,
    trajectory: plants[idx].config.trajectory,
  }))
  const synthesizedEffect: SynthesizedEffect = synthesizeEffects(effectInputs)

  return {
    totalPower,
    activatedIndices,
    aliveActivatedIndices,
    isFullChain,
    synergyMultiplier: multiplier,
    perPlantPower,
    synthesizedEffect,
  }
}
```

- [ ] **Step 4: 运行测试确认全部通过**

Run: `npx vitest run src/game/__tests__/Settlement.test.ts`

预期：全部通过。

- [ ] **Step 5: Commit**

```bash
git add src/game/Settlement.ts src/game/__tests__/Settlement.test.ts
git commit -m "feat(game): Settlement 加入协同倍率和特效合成（TDD）"
```

---

### Task 7: ProjectileEntity 多弹道支持（TDD）

**Files:**
- Modify: `src/game/__tests__/ProjectileEntity.test.ts`
- Modify: `src/game/ProjectileEntity.ts`

- [ ] **Step 1: 写多弹道测试（红）**

更新 `src/game/__tests__/ProjectileEntity.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { ProjectileEntity } from '../ProjectileEntity'
import type { ProjectileConfig } from '../ProjectileEntity'

function makeConfig(overrides: Partial<ProjectileConfig> = {}): ProjectileConfig {
  return {
    id: 'p-1',
    x: 100,
    y: 200,
    speed: 500,
    power: 30,
    rightBound: 1000,
    trajectory: 'direct',
    element: 'normal',
    ...overrides,
  }
}

describe('ProjectileEntity', () => {
  describe('direct 弹道', () => {
    it('向右匀速飞行', () => {
      const p = new ProjectileEntity(makeConfig())
      p.update(1000)
      expect(p.x).toBe(600) // 100 + 500*1
    })

    it('飞出右边界后自动消失', () => {
      const p = new ProjectileEntity(makeConfig({ x: 900 }))
      p.update(1000)
      expect(p.active).toBe(false)
    })

    it('命中后标记不活跃', () => {
      const p = new ProjectileEntity(makeConfig())
      p.onHit('z-1')
      expect(p.active).toBe(false)
    })

    it('携带攻击力信息', () => {
      const p = new ProjectileEntity(makeConfig())
      expect(p.power).toBe(30)
    })
  })

  describe('pierce 弹道', () => {
    it('命中后不消失，继续飞行', () => {
      const p = new ProjectileEntity(makeConfig({ trajectory: 'pierce' }))
      p.onHit('z-1')
      expect(p.active).toBe(true)
    })

    it('记录已命中的僵尸', () => {
      const p = new ProjectileEntity(makeConfig({ trajectory: 'pierce' }))
      p.onHit('z-1')
      expect(p.hasHit('z-1')).toBe(true)
      expect(p.hasHit('z-2')).toBe(false)
    })

    it('命中多只不同僵尸', () => {
      const p = new ProjectileEntity(makeConfig({ trajectory: 'pierce' }))
      p.onHit('z-1')
      p.onHit('z-2')
      expect(p.active).toBe(true)
      expect(p.hasHit('z-1')).toBe(true)
      expect(p.hasHit('z-2')).toBe(true)
    })

    it('飞出右边界消失', () => {
      const p = new ProjectileEntity(makeConfig({ trajectory: 'pierce', x: 900 }))
      p.update(1000)
      expect(p.active).toBe(false)
    })
  })

  describe('area 弹道（单颗散射子弹）', () => {
    it('按指定角度飞行', () => {
      const angle = Math.PI / 6 // 30°
      const p = new ProjectileEntity(makeConfig({ trajectory: 'area', angle }))
      p.update(1000) // dt=1000ms → 500px
      // dx = 500 * cos(30°) ≈ 433
      // dy = 500 * sin(30°) = 250
      expect(p.x).toBeCloseTo(100 + 500 * Math.cos(angle), 0)
      expect(p.y).toBeCloseTo(200 + 500 * Math.sin(angle), 0)
    })

    it('angle=0 时等同水平直射', () => {
      const p = new ProjectileEntity(makeConfig({ trajectory: 'area', angle: 0 }))
      p.update(1000)
      expect(p.x).toBe(600)
      expect(p.y).toBe(200)
    })

    it('命中后消失（同 direct）', () => {
      const p = new ProjectileEntity(makeConfig({ trajectory: 'area', angle: 0 }))
      p.onHit('z-1')
      expect(p.active).toBe(false)
    })

    it('飞出边界消失（x > rightBound）', () => {
      const p = new ProjectileEntity(makeConfig({ trajectory: 'area', angle: 0, x: 900 }))
      p.update(1000)
      expect(p.active).toBe(false)
    })

    it('飞出边界消失（y 超出合理范围）', () => {
      const angle = Math.PI / 2 // 向下 90°
      const p = new ProjectileEntity(makeConfig({ trajectory: 'area', angle, rightBound: 2000 }))
      p.update(5000) // 飞很远
      expect(p.active).toBe(false) // y 超出边界
    })
  })

  describe('tracking 弹道', () => {
    it('朝目标方向飞行', () => {
      const target = { x: 500, y: 200 } // 正右方
      const p = new ProjectileEntity(makeConfig({
        trajectory: 'tracking',
        target,
        maxTurnRate: Math.PI,
      }))
      p.update(1000)
      // 目标在正右方，应接近直线飞行
      expect(p.x).toBeGreaterThan(100)
      expect(p.y).toBeCloseTo(200, 0)
    })

    it('目标在上方时向上偏转', () => {
      const target = { x: 500, y: 0 } // 右上方
      const p = new ProjectileEntity(makeConfig({
        trajectory: 'tracking',
        target,
        maxTurnRate: Math.PI * 4, // 高转向率，快速转向
      }))
      p.update(1000)
      expect(p.y).toBeLessThan(200) // 应该向上移动
    })

    it('目标死亡（active=false）后沿惯性飞行', () => {
      const target = { x: 500, y: 200, active: false } as any
      const p = new ProjectileEntity(makeConfig({
        trajectory: 'tracking',
        target,
        maxTurnRate: Math.PI,
      }))
      const heading0 = (p as any).heading
      p.update(500)
      const heading1 = (p as any).heading
      // 目标已死，方向不应改变
      expect(heading1).toBeCloseTo(heading0)
    })

    it('命中后消失', () => {
      const target = { x: 500, y: 200 }
      const p = new ProjectileEntity(makeConfig({
        trajectory: 'tracking',
        target,
        maxTurnRate: Math.PI,
      }))
      p.onHit('z-1')
      expect(p.active).toBe(false)
    })
  })

  describe('element 渲染颜色', () => {
    it('element 为 normal 时颜色为金色', () => {
      const p = new ProjectileEntity(makeConfig({ element: 'normal' }))
      expect(p.element).toBe('normal')
    })

    it('element 为 ice 时记录 ice', () => {
      const p = new ProjectileEntity(makeConfig({ element: 'ice' }))
      expect(p.element).toBe('ice')
    })

    it('element 为 fire 时记录 fire', () => {
      const p = new ProjectileEntity(makeConfig({ element: 'fire' }))
      expect(p.element).toBe('fire')
    })
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/game/__tests__/ProjectileEntity.test.ts`

预期：FAIL（ProjectileEntity 构造函数签名不匹配）。

- [ ] **Step 3: 实现多弹道 ProjectileEntity**

更新 `src/game/ProjectileEntity.ts`：

```ts
import type { Entity } from '../engine/types'
import { RenderLayer } from '../engine/types'
import type { Element, Trajectory } from './types'

const PROJECTILE_TAGS: ReadonlySet<string> = new Set(['projectile'])

const ELEMENT_COLORS: Record<Element, string> = {
  normal: '#ffd700',
  ice: '#87ceeb',
  fire: '#ff6347',
}

export interface ProjectileConfig {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly speed: number
  readonly power: number
  readonly rightBound: number
  readonly trajectory: Trajectory
  readonly element: Element
  readonly angle?: number
  readonly target?: { x: number; y: number; active?: boolean }
  readonly maxTurnRate?: number
}

// Vertical bounds for area projectiles (pixels from spawn)
const Y_BOUND = 800

export class ProjectileEntity implements Entity {
  readonly id: string
  x: number
  y: number
  width = 12
  height = 8
  active = true
  layer = RenderLayer.Effect
  tags = PROJECTILE_TAGS
  readonly power: number
  readonly element: Element
  readonly trajectory: Trajectory

  private readonly speed: number
  private readonly rightBound: number
  private readonly spawnY: number

  // Pierce: hit tracking
  private readonly hitSet: Set<string> | null

  // Area: flight angle
  private readonly angle: number

  // Tracking: target and heading
  private readonly target: { x: number; y: number; active?: boolean } | null
  private readonly maxTurnRate: number
  private heading: number

  constructor(config: ProjectileConfig) {
    this.id = config.id
    this.x = config.x
    this.y = config.y
    this.spawnY = config.y
    this.speed = config.speed
    this.power = config.power
    this.rightBound = config.rightBound
    this.trajectory = config.trajectory
    this.element = config.element
    this.angle = config.angle ?? 0
    this.target = config.target ?? null
    this.maxTurnRate = config.maxTurnRate ?? Math.PI

    // Pierce trajectory tracks hit zombies
    this.hitSet = config.trajectory === 'pierce' ? new Set() : null

    // Tracking: initial heading toward target or rightward
    if (config.trajectory === 'tracking' && config.target) {
      this.heading = Math.atan2(
        config.target.y - config.y,
        config.target.x - config.x,
      )
    } else if (config.trajectory === 'area') {
      this.heading = config.angle ?? 0
    } else {
      this.heading = 0
    }
  }

  hasHit(zombieId: string): boolean {
    return this.hitSet !== null && this.hitSet.has(zombieId)
  }

  onHit(zombieId: string): void {
    if (this.trajectory === 'pierce' && this.hitSet) {
      this.hitSet.add(zombieId)
      // Pierce doesn't deactivate
    } else {
      this.active = false
    }
  }

  update(dt: number): void {
    const dtSec = dt / 1000

    switch (this.trajectory) {
      case 'direct':
        this.x += this.speed * dtSec
        break

      case 'pierce':
        this.x += this.speed * dtSec
        break

      case 'area':
        this.x += this.speed * Math.cos(this.heading) * dtSec
        this.y += this.speed * Math.sin(this.heading) * dtSec
        break

      case 'tracking':
        this.updateTracking(dtSec)
        break
    }

    // Bounds check
    if (this.x > this.rightBound) {
      this.active = false
    }
    if (this.trajectory === 'area' && Math.abs(this.y - this.spawnY) > Y_BOUND) {
      this.active = false
    }
  }

  private updateTracking(dtSec: number): void {
    // Adjust heading toward target if target is alive
    if (this.target && this.target.active !== false) {
      const desired = Math.atan2(
        this.target.y - this.y,
        this.target.x - this.x,
      )
      let diff = desired - this.heading
      // Normalize to [-PI, PI]
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      const maxTurn = this.maxTurnRate * dtSec
      if (Math.abs(diff) <= maxTurn) {
        this.heading = desired
      } else {
        this.heading += Math.sign(diff) * maxTurn
      }
    }
    // Move along heading
    this.x += this.speed * Math.cos(this.heading) * dtSec
    this.y += this.speed * Math.sin(this.heading) * dtSec
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = ELEMENT_COLORS[this.element]
    ctx.beginPath()
    ctx.ellipse(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, this.height / 2, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}
```

- [ ] **Step 4: 运行测试确认全部通过**

Run: `npx vitest run src/game/__tests__/ProjectileEntity.test.ts`

预期：全部通过。

- [ ] **Step 5: Commit**

```bash
git add src/game/ProjectileEntity.ts src/game/__tests__/ProjectileEntity.test.ts
git commit -m "feat(game): ProjectileEntity 支持 4 种弹道 + element 渲染颜色（TDD）"
```

---

### Task 8: BattleManager 集成协同 + 多弹道

**Files:**
- Modify: `src/game/BattleManager.ts`
- Modify: `src/game/__tests__/BattleManager.test.ts`

- [ ] **Step 1: 更新 BattleManager 测试数据并新增集成测试（红）**

更新 `src/game/__tests__/BattleManager.test.ts`：

更新 TEST_PLANTS 以包含新字段：

```ts
import type { WaveConfig, PlantConfig, Element, Trajectory } from '../types'

const TEST_PLANTS: PlantConfig[] = [
  { id: 'peashooter', name: '豌豆射手', comboSegment: 4, attackPower: 20, hp: 100, element: 'normal', trajectory: 'direct' },
  { id: 'snow_pea', name: '寒冰射手', comboSegment: 4, attackPower: 15, hp: 80, element: 'ice', trajectory: 'direct' },
]
```

更新 `createManager` 以包含新 config 字段：

```ts
function createManager(overrides?: Partial<BattleConfig>) {
  return new BattleManager({
    plants: TEST_PLANTS,
    waves: TEST_WAVES,
    zombieConfigs: { normal: TEST_ZOMBIE },
    letterPool: TEST_LETTERS,
    missedLimit: 2,
    projectileSpeed: 500,
    healAmount: 30,
    wavePauseDuration: 3000,
    canvasWidth: 1000,
    canvasHeight: 600,
    letterSeed: 42,
    synergyMultiplier: { 1: 1.0, 2: 1.2, 3: 1.5 },
    areaBulletCount: 5,
    areaSpreadAngle: Math.PI / 3,
    areaDamageDecay: 0.8,
    trackingTurnRate: Math.PI,
    ...overrides,
  })
}
```

需要导入 BattleConfig：

```ts
import { BattleManager, type BattleConfig } from '../BattleManager'
```

新增测试：

```ts
  it('协同倍率从 config 注入生效', () => {
    const mgr = createManager()
    mgr.update(1100)
    // 打满两棵植物（4+4=8段），触发结算
    for (let i = 0; i < 8; i++) {
      mgr.onKeyDown(mgr.currentLetter)
    }
    // 打满链条自动结算，2棵植物 → multiplier=1.2
    // 每颗弹道: P0=20*1.2=24, P1=15*1.2=18
    expect(mgr.projectileCount).toBe(2)
  })

  it('area 弹道创建 areaBulletCount 颗子弹（奇数）', () => {
    const areaPlants: PlantConfig[] = [
      { id: 'area_plant', name: '大喷菇', comboSegment: 4, attackPower: 20, hp: 100, element: 'normal', trajectory: 'area' },
    ]
    const mgr = createManager({ plants: areaPlants, areaBulletCount: 3 })
    mgr.update(1100)
    for (let i = 0; i < 4; i++) {
      mgr.onKeyDown(mgr.currentLetter)
    }
    expect(mgr.projectileCount).toBe(3)
  })

  it('area 弹道偶数颗子弹也能正确创建', () => {
    const areaPlants: PlantConfig[] = [
      { id: 'area_plant', name: '大喷菇', comboSegment: 4, attackPower: 20, hp: 100, element: 'normal', trajectory: 'area' },
    ]
    const mgr = createManager({ plants: areaPlants, areaBulletCount: 4 })
    mgr.update(1100)
    for (let i = 0; i < 4; i++) {
      mgr.onKeyDown(mgr.currentLetter)
    }
    expect(mgr.projectileCount).toBe(4)
  })

  it('pierce 弹道命中后继续飞行可命中下一只僵尸', () => {
    const piercePlants: PlantConfig[] = [
      { id: 'pierce_plant', name: '穿透', comboSegment: 4, attackPower: 100, hp: 100, element: 'normal', trajectory: 'pierce' },
    ]
    const waves: WaveConfig[] = [{ zombieType: 'normal', count: 3, interval: 200 }]
    const mgr = createManager({ plants: piercePlants, waves })
    // 生成多只僵尸
    mgr.update(800) // spawn 3 zombies (interval=200, at 200/400/600)
    const zombiesBefore = mgr.zombieCount
    expect(zombiesBefore).toBe(3)
    // 打满触发穿透弹道
    for (let i = 0; i < 4; i++) {
      mgr.onKeyDown(mgr.currentLetter)
    }
    // 让弹道飞行足够时间穿过所有僵尸
    mgr.update(5000)
    // pierce 弹道应该命中多只（HP 50 vs power 100 → 一击必杀）
    expect(mgr.zombieCount).toBeLessThan(zombiesBefore)
  })
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/game/__tests__/BattleManager.test.ts`

预期：FAIL（BattleConfig 缺少新字段）。

- [ ] **Step 3: 更新 BattleManager 实现**

在 `src/game/BattleManager.ts` 中：

**更新 BattleConfig 接口：**

```ts
export interface BattleConfig {
  readonly plants: readonly PlantConfig[]
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

**更新 executeSettlement 方法：**

```ts
  private executeSettlement(comboCount: number, isFullChain: boolean): void {
    const plants = this.plantChain.getStates()
    const result = calculateSettlement(plants, comboCount, isFullChain, this.config.synergyMultiplier)

    const { synthesizedEffect, perPlantPower, aliveActivatedIndices } = result

    for (let i = 0; i < aliveActivatedIndices.length; i++) {
      const plantIdx = aliveActivatedIndices[i]
      const px = this.plantPositions[plantIdx] + this.plantWidths[plantIdx] / 2
      const py = this.laneY + 30
      const power = perPlantPower[i]

      if (synthesizedEffect.trajectory === 'area') {
        this.fireAreaProjectiles(px, py, power, synthesizedEffect)
      } else {
        const id = `proj_${this.projectileIdCounter++}`
        const proj = new ProjectileEntity({
          id,
          x: px,
          y: py,
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
      this.plantChain.healOnFullChain(this.config.healAmount)
      this.reassignAllChewTargets()
    }
  }

  private fireAreaProjectiles(px: number, py: number, power: number, effect: { element: Element; trajectory: Trajectory }): void {
    const count = this.config.areaBulletCount
    const halfSpread = this.config.areaSpreadAngle / 2
    const decay = this.config.areaDamageDecay
    const bulletPower = power * decay

    // Build angle list: 0° always included, symmetric pairs outward
    const angles: number[] = [0]
    const pairs = Math.floor((count - 1) / 2)
    if (pairs > 0) {
      const step = halfSpread / pairs
      for (let j = 1; j <= pairs; j++) {
        angles.push(step * j)
        angles.push(-step * j)
      }
    }
    // Even count: one extra bullet between center and first pair
    if (count > 1 && count % 2 === 0) {
      const step = pairs > 0 ? halfSpread / pairs : halfSpread
      angles.push(step / 2)
    }

    for (let i = 0; i < angles.length; i++) {
      const id = `proj_${this.projectileIdCounter++}`
      const proj = new ProjectileEntity({
        id,
        x: px,
        y: py,
        speed: this.config.projectileSpeed,
        power: bulletPower,
        rightBound: this.config.canvasWidth,
        trajectory: 'area',
        element: effect.element,
        angle: angles[i],
      })
      this.entityManager.add(proj)
      this._pendingProjectiles++
    }
  }

  private findNearestZombie(px: number, py: number): { x: number; y: number; active?: boolean } | undefined {
    const zombies = this.entityManager.getByTag('zombie') as ZombieEntity[]
    let nearest: ZombieEntity | undefined
    let minDist = Infinity
    for (const z of zombies) {
      if (!z.active) continue
      const dx = z.x - px
      const dy = z.y - py
      const dist = dx * dx + dy * dy
      if (dist < minDist) {
        minDist = dist
        nearest = z
      }
    }
    return nearest
  }
```

**更新 updateCollisions 方法，处理 pierce 弹道：**

```ts
  private updateCollisions(): void {
    const projectiles = this.entityManager.getByTag('projectile') as ProjectileEntity[]
    const zombies = this.entityManager.getByTag('zombie') as ZombieEntity[]

    for (let pi = 0; pi < projectiles.length; pi++) {
      const proj = projectiles[pi]
      if (!proj.active) continue

      for (let zi = 0; zi < zombies.length; zi++) {
        const z = zombies[zi]
        if (!z.active) continue
        // Pierce: skip already-hit zombies
        if (proj.hasHit(z.id)) continue

        if (intersects(proj, z)) {
          z.takeDamage(proj.power)
          proj.onHit(z.id)
          if (!z.active) {
            this.processedInWave++
          }
          // Non-pierce projectiles break after first hit
          if (proj.trajectory !== 'pierce') break
        }
      }
    }
  }
```

需要在文件顶部导入 Element 和 Trajectory：

```ts
import type { PlantConfig, PlantState, WaveConfig, ZombieConfig, Element, Trajectory } from './types'
```

还需要导入 ProjectileConfig（如果通过 ProjectileEntity 的导出类型使用）。由于 ProjectileEntity 构造函数现在接受 config 对象，现有的构造调用也需要更新。

- [ ] **Step 4: 运行测试确认全部通过**

Run: `npx vitest run src/game/__tests__/BattleManager.test.ts`

预期：全部通过。

- [ ] **Step 5: 运行全部测试确认无回归**

Run: `npx vitest run`

预期：全部通过。

- [ ] **Step 6: Commit**

```bash
git add src/game/BattleManager.ts src/game/__tests__/BattleManager.test.ts
git commit -m "feat(game): BattleManager 集成协同倍率 + 多弹道创建 + pierce 碰撞处理"
```

---

### Task 9: BattleScene 注入新 config 参数

**Files:**
- Modify: `src/scenes/BattleScene.ts`

- [ ] **Step 1: 更新 BattleScene 的 config 组装**

在 `src/scenes/BattleScene.ts` 中：

更新导入（Task 3 中已更新 validateConfig 调用，这里只需更新 BattleManager config 组装）：

```ts
import { PLANT_DEFS, ZOMBIE_DEFS, STAGES, DIFFICULTIES, DEFAULT_DIFFICULTY, BATTLE_PARAMS, SYNERGY_PARAMS } from '../config'
```

更新 `enter()` 中 PlantDef → PlantConfig 映射，加入 element/trajectory：

```ts
    const plants: PlantConfig[] = stage.plants.map(id => {
      const def = PLANT_DEFS.find(p => p.id === id)!
      return {
        id: def.id,
        name: def.name,
        comboSegment: def.comboSegment,
        attackPower: def.attackPower,
        hp: def.hp,
        element: def.element,
        trajectory: def.trajectory,
      }
    })
```

更新 BattleManager 构造参数，注入协同和弹道配置：

```ts
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
      synergyMultiplier: SYNERGY_PARAMS.multiplier,
      areaBulletCount: BATTLE_PARAMS.areaBulletCount,
      areaSpreadAngle: BATTLE_PARAMS.areaSpreadAngle,
      areaDamageDecay: BATTLE_PARAMS.areaDamageDecay,
      trackingTurnRate: BATTLE_PARAMS.trackingTurnRate,
    })
```

- [ ] **Step 2: 运行全部测试确认通过**

Run: `npx vitest run`

预期：全部通过。

- [ ] **Step 3: 启动 dev server 在浏览器中验证**

Run: `npm run dev`

在浏览器中验证：
- 游戏正常启动，能进入战斗
- 打字→结算→弹道飞行正常（当前植物都是 direct 弹道，行为应和之前一致）
- 打满两棵植物结算时，攻击力应比之前略高（协同倍率 1.2×）

- [ ] **Step 4: Commit**

```bash
git add src/scenes/BattleScene.ts
git commit -m "feat(scenes): BattleScene 注入协同倍率和弹道参数"
```

---

### Task 10: 全量回归 + 最终验证

**Files:** 无新增，验证已有改动

- [ ] **Step 1: 运行全部测试**

Run: `npx vitest run`

预期：全部通过，0 失败。

- [ ] **Step 2: TypeScript 类型检查**

Run: `npx tsc --noEmit`

预期：无错误。

- [ ] **Step 3: 浏览器手动验证**

启动 dev server，在浏览器中完整打一关：
- 正确按键推进连击
- 按错键/空格正确结算
- 弹道发射和命中正常
- 打满链条复活/回血正常
- 关卡通过/失败流程正常

- [ ] **Step 4: 最终 commit（如有遗漏修复）**

如果前面的步骤中有遗漏的修复，在这里统一提交。
