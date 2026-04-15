# Stage 5B: Plant Unlock + Slot Mechanism + Virtual Keyboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement plant unlocking via level rewards, slot-based plant selection before battle, and a virtual keyboard with finger zone highlighting for typing guidance.

**Architecture:** Three features sharing a SaveData v2 foundation. Level rewards are config-driven (`LevelDef.rewards`). Slot mechanism adds a PlantSelectScene between level selection and battle. Virtual keyboard is a Canvas rendering module integrated into BattleScene's bottom 18% area.

**Tech Stack:** TypeScript, Canvas 2D, Vitest (TDD for game logic layer)

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/scenes/PlantSelectScene.ts` | Plant selection scene before battle — keyboard-driven UI for assigning unlocked plants to lane slots |
| `src/scenes/VirtualKeyboard.ts` | Keyboard layout data, finger zone mapping, Canvas render function — standalone module used by BattleScene |

### Modified Files

| File | Changes |
|------|---------|
| `src/config/types.ts` | Add `RewardsDef` interface, add `rewards?` to `LevelDef` |
| `src/config/plants.ts` | Add `PLANT_MAP` (Record keyed by plant ID) |
| `src/config/index.ts` | Export `PLANT_MAP` and `RewardsDef` |
| `src/config/stages.ts` | Add `rewards` to selected levels |
| `src/config/validation.ts` | Validate `rewards` field in levels |
| `src/game/SaveDataService.ts` | SaveData v2 (`unlockedPlants`, `slotSize`, `keyboardVisible`), migration, reward application |
| `src/scenes/SettlementScene.ts` | Show unlocked plants and slot increase on first completion |
| `src/scenes/StageSelectScene.ts` | Show reward hints next to levels |
| `src/scenes/BattleScene.ts` | Accept `selectedPlants`, adjust game area height for keyboard, render keyboard |
| `src/App.tsx` | Register PlantSelectScene, wire full flow, keyboard toggle in menu |

### Test Files

| File | Changes |
|------|---------|
| `src/game/__tests__/SaveDataService.test.ts` | Tests for v2 migration, reward claiming, keyboard toggle |
| `src/config/__tests__/validation.test.ts` | Tests for rewards validation |

---

## Design Decisions

- **Slot validation uses base `comboSegment`**, not difficulty-adjusted. Difficulty multiplier affects combo chain length during gameplay, not slot capacity. This prevents harder difficulty from restricting plant selection.
- **Game layer doesn't import config layer.** `SaveDataService.completeLevel` accepts rewards as an inline parameter type (structurally compatible with `RewardsDef`) — no config import needed.
- **Keyboard visibility is fixed per battle.** Toggling takes effect on next battle start, avoiding mid-battle layout recalculation.
- **PlantSelectScene pre-fills with stage defaults.** Uses `StageDef.plants` (filtered to unlocked only) for a reasonable default — player can just press Enter to start.

---

## Task 1: Config Types + PLANT_MAP

**Files:**
- Modify: `src/config/types.ts`
- Modify: `src/config/plants.ts`
- Modify: `src/config/index.ts`

- [ ] **Step 1: Add `RewardsDef` interface and update `LevelDef`**

In `src/config/types.ts`, add the `RewardsDef` interface and add `rewards?` to `LevelDef`:

```typescript
/** 关卡通关奖励 */
export interface RewardsDef {
  readonly unlockPlants?: readonly string[]   // 解锁的植物 ID 列表
  readonly slotIncrease?: number              // slot 长度增加量
}
```

Add to `LevelDef`:

```typescript
export interface LevelDef {
  readonly id: number
  readonly waves: readonly WaveDef[]
  readonly laneCount?: number
  readonly lanePlants?: readonly (readonly string[])[]
  readonly rewards?: RewardsDef                        // ← new
}
```

- [ ] **Step 2: Add `PLANT_MAP` to `plants.ts`**

In `src/config/plants.ts`, add after `PLANT_DEFS`:

```typescript
/** 按 ID 索引的植物定义 Map */
export const PLANT_MAP: Readonly<Record<string, PlantDef>> = Object.fromEntries(
  PLANT_DEFS.map(p => [p.id, p])
) as Record<string, PlantDef>
```

- [ ] **Step 3: Update `config/index.ts` exports**

Add to `src/config/index.ts`:

```typescript
export { PLANT_DEFS, PLANT_MAP } from './plants'
```

And add `RewardsDef` to the type exports:

```typescript
export type { ..., RewardsDef } from './types'
```

- [ ] **Step 4: Run tests to verify no breakage**

Run: `npm test`
Expected: All existing tests pass (no behavior change).

- [ ] **Step 5: Commit**

```bash
git add src/config/types.ts src/config/plants.ts src/config/index.ts
git commit -m "feat(config): add RewardsDef type and PLANT_MAP helper"
```

---

## Task 2: SaveData v2 — New Fields + Migration (TDD)

**Files:**
- Test: `src/game/__tests__/SaveDataService.test.ts`
- Modify: `src/game/SaveDataService.ts`

- [ ] **Step 1: Write failing tests for SaveData v2**

Add these tests to `src/game/__tests__/SaveDataService.test.ts`:

```typescript
it('首次 load 返回 v2 默认存档（含 unlockedPlants/slotSize/keyboardVisible）', () => {
  const data = service.load()
  expect(data.version).toBe(2)
  expect(data.unlockedPlants).toEqual(['peashooter'])
  expect(data.slotSize).toBe(4)
  expect(data.keyboardVisible).toBe(true)
})

it('v1 存档 load 时自动迁移到 v2', () => {
  // Simulate v1 save data
  storage.save('kbzombie_save', {
    version: 1,
    currentStageIndex: 2,
    currentLevelIndex: 1,
    completedLevels: ['0-0', '0-1', '1-0'],
    difficulty: 'hard',
    bestStars: { '0-0': 3, '0-1': 2, '1-0': 1 },
  })

  const data = service.load()
  expect(data.version).toBe(2)
  expect(data.unlockedPlants).toEqual(['peashooter'])
  expect(data.slotSize).toBe(4)
  expect(data.keyboardVisible).toBe(true)
  // Existing fields preserved
  expect(data.currentStageIndex).toBe(2)
  expect(data.currentLevelIndex).toBe(1)
  expect(data.completedLevels).toEqual(['0-0', '0-1', '1-0'])
  expect(data.difficulty).toBe('hard')
  expect(data.bestStars).toEqual({ '0-0': 3, '0-1': 2, '1-0': 1 })
})

it('v1→v2 迁移后再次 load 不重复迁移', () => {
  storage.save('kbzombie_save', {
    version: 1,
    currentStageIndex: 0,
    currentLevelIndex: 0,
    completedLevels: [],
    difficulty: 'normal',
    bestStars: {},
  })

  service.load() // triggers migration
  const data = service.load() // second load
  expect(data.version).toBe(2)
  expect(data.unlockedPlants).toEqual(['peashooter'])
})

it('reset 恢复 v2 默认值', () => {
  service.completeLevel(0, 0, 3, 2, true)
  service.reset()
  const data = service.load()
  expect(data.version).toBe(2)
  expect(data.unlockedPlants).toEqual(['peashooter'])
  expect(data.slotSize).toBe(4)
  expect(data.keyboardVisible).toBe(true)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/game/__tests__/SaveDataService.test.ts`
Expected: New tests FAIL (SaveData doesn't have v2 fields yet).

- [ ] **Step 3: Update SaveData interface and defaults**

In `src/game/SaveDataService.ts`, update the interface and defaults:

```typescript
export interface SaveData {
  version: number
  currentStageIndex: number
  currentLevelIndex: number
  completedLevels: string[]
  difficulty: string
  bestStars: Record<string, number>
  unlockedPlants: string[]
  slotSize: number
  keyboardVisible: boolean
}

const SAVE_KEY = 'kbzombie_save'

const DEFAULT_SAVE: SaveData = {
  version: 2,
  currentStageIndex: 0,
  currentLevelIndex: 0,
  completedLevels: [],
  difficulty: 'normal',
  bestStars: {},
  unlockedPlants: ['peashooter'],
  slotSize: 4,
  keyboardVisible: true,
}
```

- [ ] **Step 4: Add migration logic in `load()`**

Replace the `load()` method:

```typescript
load(): SaveData {
  const data = this.storage.load<SaveData>(SAVE_KEY)
  if (!data) return { ...DEFAULT_SAVE, completedLevels: [], bestStars: {}, unlockedPlants: ['peashooter'] }

  // v1 → v2 migration
  if (data.version < 2) {
    data.version = 2
    if (!data.unlockedPlants) data.unlockedPlants = ['peashooter']
    if (!data.slotSize) data.slotSize = 4
    if (data.keyboardVisible === undefined) data.keyboardVisible = true
    this.save(data)
  }

  return data
}
```

- [ ] **Step 5: Update `reset()`**

```typescript
reset(): void {
  this.save({ ...DEFAULT_SAVE, completedLevels: [], bestStars: {}, unlockedPlants: ['peashooter'] })
}
```

- [ ] **Step 6: Fix existing test expectation for version**

Update the first existing test — change `expect(data.version).toBe(1)` to `expect(data.version).toBe(2)`.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- --run src/game/__tests__/SaveDataService.test.ts`
Expected: ALL tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/game/SaveDataService.ts src/game/__tests__/SaveDataService.test.ts
git commit -m "feat(game): SaveData v2 with unlockedPlants, slotSize, keyboardVisible + v1 migration"
```

---

## Task 3: SaveDataService — Reward Claiming + Keyboard + Getters (TDD)

**Files:**
- Test: `src/game/__tests__/SaveDataService.test.ts`
- Modify: `src/game/SaveDataService.ts`

- [ ] **Step 1: Write failing tests for reward claiming**

Add to `src/game/__tests__/SaveDataService.test.ts`:

```typescript
describe('reward claiming', () => {
  it('completeLevel 首次通关时应用 rewards（解锁植物 + slot 增加）', () => {
    service.completeLevel(0, 0, 3, 2, true, {
      unlockPlants: ['snow_pea', 'repeater'],
      slotIncrease: 4,
    })
    const data = service.load()
    expect(data.unlockedPlants).toContain('peashooter')
    expect(data.unlockedPlants).toContain('snow_pea')
    expect(data.unlockedPlants).toContain('repeater')
    expect(data.slotSize).toBe(8) // 4 + 4
  })

  it('completeLevel 重复通关不重复发放 rewards', () => {
    service.completeLevel(0, 0, 2, 2, true, {
      unlockPlants: ['snow_pea'],
      slotIncrease: 4,
    })
    service.completeLevel(0, 0, 3, 2, true, {
      unlockPlants: ['snow_pea'],
      slotIncrease: 4,
    })
    const data = service.load()
    expect(data.unlockedPlants.filter(p => p === 'snow_pea').length).toBe(1)
    expect(data.slotSize).toBe(8) // not 12
  })

  it('completeLevel 不传 rewards 时行为不变', () => {
    service.completeLevel(0, 0, 3, 2, true)
    const data = service.load()
    expect(data.unlockedPlants).toEqual(['peashooter'])
    expect(data.slotSize).toBe(4)
  })

  it('completeLevel 只传 unlockPlants 不影响 slotSize', () => {
    service.completeLevel(0, 0, 3, 2, true, { unlockPlants: ['snow_pea'] })
    const data = service.load()
    expect(data.unlockedPlants).toContain('snow_pea')
    expect(data.slotSize).toBe(4)
  })

  it('completeLevel 只传 slotIncrease 不影响 unlockedPlants', () => {
    service.completeLevel(0, 0, 3, 2, true, { slotIncrease: 4 })
    const data = service.load()
    expect(data.unlockedPlants).toEqual(['peashooter'])
    expect(data.slotSize).toBe(8)
  })
})

describe('keyboard toggle', () => {
  it('setKeyboardVisible 写入存档', () => {
    service.setKeyboardVisible(false)
    expect(service.load().keyboardVisible).toBe(false)
    service.setKeyboardVisible(true)
    expect(service.load().keyboardVisible).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/game/__tests__/SaveDataService.test.ts`
Expected: New tests FAIL.

- [ ] **Step 3: Extend `completeLevel` to accept and apply rewards**

Update `completeLevel` in `src/game/SaveDataService.ts`:

```typescript
completeLevel(
  stageIndex: number,
  levelIndex: number,
  stars: number,
  stageLevelCount: number,
  hasNextStage: boolean,
  rewards?: { unlockPlants?: readonly string[]; slotIncrease?: number },
): void {
  const data = this.load()
  const levelId = `${stageIndex}-${levelIndex}`
  const isFirstCompletion = !data.completedLevels.includes(levelId)

  if (isFirstCompletion) {
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

  // Apply rewards on first completion only
  if (isFirstCompletion && rewards) {
    if (rewards.unlockPlants) {
      for (const plantId of rewards.unlockPlants) {
        if (!data.unlockedPlants.includes(plantId)) {
          data.unlockedPlants.push(plantId)
        }
      }
    }
    if (rewards.slotIncrease) {
      data.slotSize += rewards.slotIncrease
    }
  }

  this.save(data)
}
```

- [ ] **Step 4: Add `setKeyboardVisible`**

```typescript
setKeyboardVisible(visible: boolean): void {
  const data = this.load()
  data.keyboardVisible = visible
  this.save(data)
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- --run src/game/__tests__/SaveDataService.test.ts`
Expected: ALL tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/game/SaveDataService.ts src/game/__tests__/SaveDataService.test.ts
git commit -m "feat(game): SaveDataService reward claiming + keyboard toggle"
```

---

## Task 4: Config Validation for Rewards (TDD)

**Files:**
- Test: `src/config/__tests__/validation.test.ts`
- Modify: `src/config/validation.ts`

- [ ] **Step 1: Write failing tests for rewards validation**

Add to `src/config/__tests__/validation.test.ts` (use existing test helpers pattern):

```typescript
describe('rewards validation', () => {
  it('rewards.unlockPlants 引用不存在的植物报错', () => {
    const stages: StageDef[] = [{
      id: 1, name: 'test', letters: ['f'], plants: ['peashooter'],
      levels: [{
        id: 1,
        waves: [{ count: 1, interval: 1000, zombieType: 'normal' }],
        rewards: { unlockPlants: ['nonexistent_plant'] },
      }],
    }]
    const errors = validateConfig(validPlants, validZombies, stages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('nonexistent_plant'))).toBe(true)
  })

  it('rewards.slotIncrease <= 0 报错', () => {
    const stages: StageDef[] = [{
      id: 1, name: 'test', letters: ['f'], plants: ['peashooter'],
      levels: [{
        id: 1,
        waves: [{ count: 1, interval: 1000, zombieType: 'normal' }],
        rewards: { slotIncrease: 0 },
      }],
    }]
    const errors = validateConfig(validPlants, validZombies, stages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('slotIncrease'))).toBe(true)
  })

  it('合法 rewards 不报错', () => {
    const stages: StageDef[] = [{
      id: 1, name: 'test', letters: ['f'], plants: ['peashooter'],
      levels: [{
        id: 1,
        waves: [{ count: 1, interval: 1000, zombieType: 'normal' }],
        rewards: { unlockPlants: ['peashooter'], slotIncrease: 4 },
      }],
    }]
    const errors = validateConfig(validPlants, validZombies, stages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('rewards'))).toBe(false)
    expect(errors.some(e => e.includes('slotIncrease'))).toBe(false)
  })
})
```

Note: `validPlants`, `validZombies`, `validSynergy`, `validBattle` are existing test helpers in the file — use the same valid baseline data already defined there. If they're defined inline per test, extract them to `describe`-level constants first.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/config/__tests__/validation.test.ts`
Expected: New tests FAIL (rewards validation doesn't exist yet).

- [ ] **Step 3: Add rewards validation to `validateConfig`**

In `src/config/validation.ts`, add inside the `for (const level of stage.levels)` loop, after the existing wave validation:

```typescript
// Validate rewards
if (level.rewards) {
  if (level.rewards.unlockPlants) {
    for (const plantId of level.rewards.unlockPlants) {
      if (!plantIds.has(plantId)) {
        errors.push(`阶段 ${stage.id} 关卡 ${level.id} rewards.unlockPlants 引用不存在的植物: "${plantId}"`)
      }
    }
  }
  if (level.rewards.slotIncrease !== undefined && level.rewards.slotIncrease <= 0) {
    errors.push(`阶段 ${stage.id} 关卡 ${level.id} rewards.slotIncrease 必须 > 0，当前: ${level.rewards.slotIncrease}`)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/config/__tests__/validation.test.ts`
Expected: ALL tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/config/validation.ts src/config/__tests__/validation.test.ts
git commit -m "feat(config): validate rewards in level definitions"
```

---

## Task 5: Stage Rewards Configuration

**Files:**
- Modify: `src/config/stages.ts`

- [ ] **Step 1: Add rewards to selected levels**

In `src/config/stages.ts`, add `rewards` to levels that should grant unlocks. The first stage's last level unlocks the next plant and expands slot:

```typescript
// Stage 1, Level 2 (last level of stage 1)
{
  id: 2,
  laneCount: 1,
  waves: [
    { zombieType: 'normal', count: 8, interval: 2000 },
    { zombieType: 'normal', count: 12, interval: 1500 },
    { zombieType: 'normal', count: 15, interval: 1200 },
  ],
  rewards: { unlockPlants: ['snow_pea'], slotIncrease: 4 },
},
```

Add rewards to other stages' levels as appropriate — at minimum, one level per stage that unlocks the stage's featured plant. Example for stage 2 (弹道演示):

```typescript
// Stage 2, Level 1
{
  id: 1,
  laneCount: 1,
  waves: [
    { zombieType: 'fat', count: 8, interval: 800 },
  ],
  rewards: { unlockPlants: ['cactus'] },
},
```

Apply the same pattern for stages 3-8, unlocking: `fume_shroom`, `cattail`, `repeater`, `torchwood`, and any other plants used in later stages.

**Important:** Ensure every plant referenced in any stage's `plants` or `lanePlants` is either `'peashooter'` (default unlocked) or unlocked by a reward in an earlier level. Otherwise the player can't access it.

- [ ] **Step 2: Run tests to verify no breakage**

Run: `npm test`
Expected: All tests pass (config validation should pass with valid rewards).

- [ ] **Step 3: Commit**

```bash
git add src/config/stages.ts
git commit -m "feat(config): add rewards to stage levels for plant unlocking and slot expansion"
```

---

## Task 6: SettlementScene Rewards Display

**Files:**
- Modify: `src/scenes/SettlementScene.ts`
- Modify: `src/App.tsx` (battle end handler only)

- [ ] **Step 1: Extend `SettlementSceneParams`**

In `src/scenes/SettlementScene.ts`, update the interface:

```typescript
export interface SettlementSceneParams {
  result: 'victory' | 'defeat'
  stats: BattleStatsData
  stars: number
  title: string
  stageIndex: number
  levelIndex: number
  rewards?: { unlockPlants?: readonly string[]; slotIncrease?: number }  // level rewards config
  isFirstCompletion?: boolean                                            // true if this is the first time completing
  plantNames?: Readonly<Record<string, string>>                          // plant id → display name
}
```

- [ ] **Step 2: Add rewards rendering**

In the `render()` method, after the stats list and before button hints, add a rewards section. Insert between the stats rendering and the button hints (around line 91):

```typescript
// Rewards section (victory + first completion + has rewards)
let rewardsEndY = dataStartY + labels.length * lineHeight
if (result === 'victory' && this.params.isFirstCompletion && this.params.rewards) {
  const rewards = this.params.rewards
  rewardsEndY += 20 // spacing

  ctx.fillStyle = '#ffd700'
  ctx.font = 'bold 20px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('— 通关奖励 —', w / 2, rewardsEndY)
  rewardsEndY += 30

  ctx.font = '20px sans-serif'
  if (rewards.unlockPlants && rewards.unlockPlants.length > 0) {
    for (const plantId of rewards.unlockPlants) {
      const name = this.params.plantNames?.[plantId] ?? plantId
      ctx.fillStyle = '#69DB7C'
      ctx.fillText(`解锁植物：${name}`, w / 2, rewardsEndY)
      rewardsEndY += 28
    }
  }
  if (rewards.slotIncrease) {
    ctx.fillStyle = '#4DABF7'
    ctx.fillText(`阵地扩展 +${rewards.slotIncrease}`, w / 2, rewardsEndY)
    rewardsEndY += 28
  }
}
```

- [ ] **Step 3: Update App.tsx battle end handler to pass rewards info**

In `src/App.tsx`, update the `battleScene.setBattleEndHandler` callback:

```typescript
battleScene.setBattleEndHandler((params) => {
  const level = STAGES[params.stageIndex].levels[params.levelIndex]
  const isFirstCompletion = params.result === 'victory'
    && !saveService.load().completedLevels.includes(`${params.stageIndex}-${params.levelIndex}`)
  const plantNames: Record<string, string> = {}
  for (const p of PLANT_DEFS) { plantNames[p.id] = p.name }
  settlementScene.setParams({
    ...params,
    rewards: level.rewards,
    isFirstCompletion,
    plantNames,
  })
  switchTo('settlement')
})
```

Add `PLANT_DEFS` to the existing import from `'./config'` if not already there.

- [ ] **Step 4: Update App.tsx settlement `'continue'` action to pass rewards**

In the `settlementScene.setActionHandler` callback, update the `'continue'` branch:

```typescript
if (action === 'continue') {
  const stage = STAGES[stageIndex]
  const level = stage.levels[levelIndex]
  const stars = settlementScene.getParams()?.stars ?? 1
  const hasNextStage = stageIndex + 1 < STAGES.length
  saveService.completeLevel(stageIndex, levelIndex, stars, stage.levels.length, hasNextStage, level.rewards)

  // ... rest unchanged
}
```

- [ ] **Step 5: Run tests + verify in browser**

Run: `npm test`
Expected: All tests pass.

Run: `npm run dev`
Expected: Complete a level with rewards → settlement scene shows "通关奖励" section with plant name and/or slot increase.

- [ ] **Step 6: Commit**

```bash
git add src/scenes/SettlementScene.ts src/App.tsx
git commit -m "feat(scenes): SettlementScene shows rewards on first completion"
```

---

## Task 7: StageSelectScene Reward Hints

**Files:**
- Modify: `src/scenes/StageSelectScene.ts`

- [ ] **Step 1: Add plant names data to `setData`**

Extend `setData` to receive plant definitions:

```typescript
private plantNames: Readonly<Record<string, string>> = {}

setData(stages: readonly StageDef[], saveData: SaveData, plantNames?: Readonly<Record<string, string>>): void {
  this.stages = stages
  this.saveData = saveData
  this.plantNames = plantNames ?? {}
  this.cursorStage = saveData.currentStageIndex
  this.cursorLevel = saveData.currentLevelIndex
}
```

- [ ] **Step 2: Render reward hints next to levels**

In the `render()` method, after rendering the level name (around line 137-143), add reward indicators:

```typescript
if (completed) {
  const starStr = '\u2605'.repeat(stars) + '\u2606'.repeat(3 - stars)
  ctx.fillStyle = '#ffd700'
  ctx.fillText(starStr, 80, y)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(`关卡 ${li + 1}`, 160, y)
} else {
  ctx.fillStyle = '#aaaaaa'
  ctx.fillText('\u25CB', 80, y)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(`关卡 ${li + 1}`, 160, y)
}

// Reward hints
const level = stage.levels[li]
if (level.rewards) {
  const rewardTexts: string[] = []
  if (level.rewards.unlockPlants) {
    for (const pid of level.rewards.unlockPlants) {
      rewardTexts.push(this.plantNames[pid] ?? pid)
    }
  }
  if (level.rewards.slotIncrease) {
    rewardTexts.push(`阵地+${level.rewards.slotIncrease}`)
  }
  if (rewardTexts.length > 0) {
    ctx.fillStyle = completed ? '#555555' : '#ffd700'
    ctx.font = '14px sans-serif'
    const prefix = completed ? '✓ ' : '🎁 '
    ctx.fillText(`${prefix}${rewardTexts.join(', ')}`, 260, y)
    ctx.font = '18px sans-serif' // restore
  }
}
```

- [ ] **Step 3: Update App.tsx to pass plantNames to StageSelectScene**

In `src/App.tsx`, update all `stageSelectScene.setData(...)` calls to include plantNames:

```typescript
const plantNames: Record<string, string> = {}
for (const p of PLANT_DEFS) { plantNames[p.id] = p.name }
```

Build `plantNames` once after creating services, then pass it:

```typescript
stageSelectScene.setData(STAGES, saveService.load(), plantNames)
```

Update all call sites (there are 3: initial select action, settlement select action, and settlement continue → stageSelect path if applicable).

- [ ] **Step 4: Run tests + verify in browser**

Run: `npm test`
Expected: All tests pass.

Run: `npm run dev`
Expected: Stage select scene shows reward hints (gold for uncompleted, gray for completed).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/StageSelectScene.ts src/App.tsx
git commit -m "feat(scenes): StageSelectScene shows reward hints per level"
```

---

## Task 8: PlantSelectScene

**Files:**
- Create: `src/scenes/PlantSelectScene.ts`
- Modify: `src/App.tsx` (wiring, in Task 11)

- [ ] **Step 1: Create PlantSelectScene**

Create `src/scenes/PlantSelectScene.ts`:

```typescript
import type { Scene, InputEvent } from '../engine/types'
import type { PlantDef } from '../config/types'

type PlantSelectAction = 'start' | 'back'

export class PlantSelectScene implements Scene {
  readonly name = 'plantSelect'
  private switchTo: (name: string) => void
  private onAction: ((action: PlantSelectAction, lanePlants: readonly (readonly string[])[]) => void) | null = null

  private canvasWidth = 0
  private canvasHeight = 0
  private laneCount = 1
  private slotSize = 4
  private unlockedPlants: PlantDef[] = []
  private currentLane = 0
  private laneSelections: string[][] = []
  private stageIndex = 0
  private levelIndex = 0

  constructor(switchTo: (name: string) => void) {
    this.switchTo = switchTo
  }

  setActionHandler(fn: (action: PlantSelectAction, lanePlants: readonly (readonly string[])[]) => void): void {
    this.onAction = fn
  }

  setData(
    stageIndex: number,
    levelIndex: number,
    laneCount: number,
    slotSize: number,
    unlockedPlants: PlantDef[],
    defaultPlants: readonly string[],
  ): void {
    this.stageIndex = stageIndex
    this.levelIndex = levelIndex
    this.laneCount = laneCount
    this.slotSize = slotSize
    this.unlockedPlants = unlockedPlants
    this.currentLane = 0

    // Pre-fill lanes with defaults (filtered to unlocked only)
    const unlockedIds = new Set(unlockedPlants.map(p => p.id))
    const plantMap = Object.fromEntries(unlockedPlants.map(p => [p.id, p]))
    this.laneSelections = []
    for (let i = 0; i < laneCount; i++) {
      const lane: string[] = []
      let used = 0
      for (const id of defaultPlants) {
        if (!unlockedIds.has(id)) continue
        const seg = plantMap[id]?.comboSegment ?? 0
        if (used + seg <= slotSize) {
          lane.push(id)
          used += seg
        }
      }
      this.laneSelections.push(lane)
    }
  }

  private getLaneUsed(laneIdx: number): number {
    const plantMap = Object.fromEntries(this.unlockedPlants.map(p => [p.id, p]))
    return this.laneSelections[laneIdx].reduce((sum, id) => sum + (plantMap[id]?.comboSegment ?? 0), 0)
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
    const plantMap = Object.fromEntries(this.unlockedPlants.map(p => [p.id, p]))

    // Background
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, w, h)

    // Title
    ctx.fillStyle = '#ffd700'
    ctx.font = 'bold 28px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('选择植物阵容', w / 2, 40)

    ctx.fillStyle = '#aaaaaa'
    ctx.font = '16px sans-serif'
    ctx.fillText(`第${this.stageIndex + 1}阶段 关卡${this.levelIndex + 1}  |  阵地容量: ${this.slotSize}`, w / 2, 65)

    // Lane slots
    const laneStartY = 90
    const laneHeight = 60
    for (let i = 0; i < this.laneCount; i++) {
      const y = laneStartY + i * laneHeight
      const isCurrent = i === this.currentLane
      const used = this.getLaneUsed(i)

      // Lane label
      ctx.fillStyle = isCurrent ? '#ffd700' : '#aaaaaa'
      ctx.font = isCurrent ? 'bold 18px sans-serif' : '18px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(`第${i + 1}路`, 40, y + 20)

      // Slot usage
      ctx.fillStyle = used > this.slotSize ? '#e94560' : '#69DB7C'
      ctx.font = '14px sans-serif'
      ctx.fillText(`${used}/${this.slotSize}`, 40, y + 40)

      // Selected plants
      let px = 120
      for (const plantId of this.laneSelections[i]) {
        const def = plantMap[plantId]
        if (!def) continue
        const boxW = Math.max(80, def.name.length * 18 + 30)

        // Plant box
        ctx.fillStyle = isCurrent ? 'rgba(255, 215, 0, 0.15)' : 'rgba(255, 255, 255, 0.08)'
        ctx.fillRect(px, y + 4, boxW, 44)
        ctx.strokeStyle = isCurrent ? '#ffd700' : '#555555'
        ctx.lineWidth = 1
        ctx.strokeRect(px, y + 4, boxW, 44)

        ctx.fillStyle = '#ffffff'
        ctx.font = '15px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(def.name, px + boxW / 2, y + 22)
        ctx.fillStyle = '#aaaaaa'
        ctx.font = '12px sans-serif'
        ctx.fillText(`${def.comboSegment}段`, px + boxW / 2, y + 40)

        px += boxW + 8
      }

      // Current lane highlight
      if (isCurrent) {
        ctx.strokeStyle = '#ffd700'
        ctx.lineWidth = 2
        ctx.strokeRect(30, y - 2, w - 60, laneHeight - 4)
      }
    }

    // Divider
    const divY = laneStartY + this.laneCount * laneHeight + 10
    ctx.strokeStyle = '#444444'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(40, divY)
    ctx.lineTo(w - 40, divY)
    ctx.stroke()

    // Available plants
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 20px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('已解锁植物：', 40, divY + 30)

    const gridStartY = divY + 50
    const colWidth = 200
    const rowH = 30
    const cols = Math.max(1, Math.floor((w - 80) / colWidth))

    for (let i = 0; i < this.unlockedPlants.length; i++) {
      const plant = this.unlockedPlants[i]
      const col = i % cols
      const row = Math.floor(i / cols)
      const px = 50 + col * colWidth
      const py = gridStartY + row * rowH

      ctx.fillStyle = '#ffd700'
      ctx.font = 'bold 16px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(`[${i + 1}]`, px, py)

      ctx.fillStyle = '#ffffff'
      ctx.font = '16px sans-serif'
      ctx.fillText(`${plant.name}`, px + 35, py)

      ctx.fillStyle = '#aaaaaa'
      ctx.fillText(`(${plant.comboSegment}段)`, px + 35 + plant.name.length * 16 + 5, py)
    }

    // Help text
    ctx.fillStyle = '#777777'
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('↑↓切换路线 | 数字键添加植物 | Backspace删除 | Enter开始战斗 | Esc返回', w / 2, h - 20)
  }

  handleInput(event: InputEvent): void {
    if (event.type !== 'keydown') return

    if (event.key === 'Escape') {
      this.onAction?.('back', this.laneSelections)
      return
    }

    if (event.key === 'Enter') {
      // Validate: at least one lane has plants
      const hasPlants = this.laneSelections.some(lane => lane.length > 0)
      if (hasPlants) {
        this.onAction?.('start', this.laneSelections)
      }
      return
    }

    if (event.key === 'ArrowUp') {
      this.currentLane = Math.max(0, this.currentLane - 1)
      return
    }

    if (event.key === 'ArrowDown') {
      this.currentLane = Math.min(this.laneCount - 1, this.currentLane + 1)
      return
    }

    if (event.key === 'Backspace') {
      this.laneSelections[this.currentLane].pop()
      return
    }

    // Number keys 1-9 → add plant
    const num = parseInt(event.key, 10)
    if (num >= 1 && num <= this.unlockedPlants.length) {
      const plant = this.unlockedPlants[num - 1]
      const used = this.getLaneUsed(this.currentLane)
      if (used + plant.comboSegment <= this.slotSize) {
        this.laneSelections[this.currentLane].push(plant.id)
      }
    }
  }
}
```

- [ ] **Step 2: Run tests to verify no breakage**

Run: `npm test`
Expected: All tests pass (new file, no integration yet).

- [ ] **Step 3: Commit**

```bash
git add src/scenes/PlantSelectScene.ts
git commit -m "feat(scenes): add PlantSelectScene for pre-battle plant selection"
```

---

## Task 9: VirtualKeyboard Module

**Files:**
- Create: `src/scenes/VirtualKeyboard.ts`

- [ ] **Step 1: Create VirtualKeyboard module**

Create `src/scenes/VirtualKeyboard.ts`:

```typescript
// Keyboard layout: 4 rows (numbers + QWERTY)
const ROWS: readonly (readonly string[])[] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
]

// Row horizontal offsets in key-width units (staggered layout)
const ROW_OFFSETS = [0, 0.25, 0.6, 1.1]

// 8 finger zones: 0=left pinky → 7=right pinky
const FINGER_ZONE: Readonly<Record<string, number>> = {
  '1': 0, 'Q': 0, 'A': 0, 'Z': 0,
  '2': 1, 'W': 1, 'S': 1, 'X': 1,
  '3': 2, 'E': 2, 'D': 2, 'C': 2,
  '4': 3, '5': 3, 'R': 3, 'T': 3, 'F': 3, 'G': 3, 'V': 3, 'B': 3,
  '6': 4, '7': 4, 'Y': 4, 'U': 4, 'H': 4, 'J': 4, 'N': 4, 'M': 4,
  '8': 5, 'I': 5, 'K': 5,
  '9': 6, 'O': 6, 'L': 6,
  '0': 7, 'P': 7,
}

// 8 colors for 8 fingers (left→right: pinky→index, index→pinky)
const ZONE_COLORS = [
  '#FF6B6B', // left pinky - red
  '#FFA94D', // left ring - orange
  '#FFD93D', // left middle - yellow
  '#69DB7C', // left index - green
  '#4DABF7', // right index - blue
  '#748FFC', // right middle - indigo
  '#CC5DE8', // right ring - purple
  '#F06595', // right pinky - pink
]

/**
 * Render a virtual keyboard in the given canvas area.
 * @param highlightKeys - Keys to highlight (case-insensitive).
 */
export function renderVirtualKeyboard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  highlightKeys: readonly string[],
): void {
  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
  ctx.fillRect(x, y, width, height)

  const highlightSet = new Set(highlightKeys.map(k => k.toUpperCase()))

  const padding = 8
  const gap = 3
  const maxKeysPerRow = 10
  const keyW = (width - padding * 2 - gap * (maxKeysPerRow - 1)) / (maxKeysPerRow + 1) // +1 for offset room
  const keyH = (height - padding * 2 - gap * 3) / 4

  for (let row = 0; row < ROWS.length; row++) {
    const keys = ROWS[row]
    const offsetPx = ROW_OFFSETS[row] * (keyW + gap)
    const rowY = y + padding + row * (keyH + gap)

    // Center the row accounting for offset
    const totalRowW = keys.length * keyW + (keys.length - 1) * gap
    const rowX = x + (width - totalRowW) / 2 + offsetPx / 2

    for (let col = 0; col < keys.length; col++) {
      const key = keys[col]
      const kx = rowX + col * (keyW + gap)
      const ky = rowY
      const zone = FINGER_ZONE[key] ?? 0
      const color = ZONE_COLORS[zone]
      const isHl = highlightSet.has(key)

      // Key background
      if (isHl) {
        ctx.fillStyle = color
        ctx.globalAlpha = 1.0
      } else {
        ctx.fillStyle = color
        ctx.globalAlpha = 0.25
      }
      ctx.beginPath()
      ctx.roundRect(kx, ky, keyW, keyH, 4)
      ctx.fill()
      ctx.globalAlpha = 1.0

      // Highlight border
      if (isHl) {
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.roundRect(kx, ky, keyW, keyH, 4)
        ctx.stroke()
      }

      // Key label
      ctx.fillStyle = isHl ? '#ffffff' : 'rgba(255, 255, 255, 0.5)'
      ctx.font = `bold ${Math.max(10, Math.floor(keyH * 0.5))}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(key, kx + keyW / 2, ky + keyH / 2)
    }
  }

  // Reset text baseline
  ctx.textBaseline = 'alphabetic'
}
```

- [ ] **Step 2: Run tests to verify no breakage**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/VirtualKeyboard.ts
git commit -m "feat(scenes): add VirtualKeyboard rendering module with finger zone colors"
```

---

## Task 10: BattleScene Keyboard Integration

**Files:**
- Modify: `src/scenes/BattleScene.ts`

- [ ] **Step 1: Add imports and keyboard state fields**

At the top of `src/scenes/BattleScene.ts`, add:

```typescript
import { renderVirtualKeyboard } from './VirtualKeyboard'
```

Add fields to the class:

```typescript
private keyboardVisible = true
private gameAreaHeight = 0
private selectedPlants: readonly (readonly string[])[] | null = null
```

- [ ] **Step 2: Extend `setLevel` to accept keyboard visibility and selected plants**

Replace the `setLevel` method:

```typescript
setLevel(
  stageIndex: number,
  levelIndex: number,
  difficultyKey?: string,
  selectedPlants?: readonly (readonly string[])[],
  keyboardVisible?: boolean,
): void {
  this.stageIndex = stageIndex
  this.levelIndex = levelIndex
  if (difficultyKey !== undefined) this.difficultyKey = difficultyKey
  this.selectedPlants = selectedPlants ?? null
  this.keyboardVisible = keyboardVisible ?? true
}
```

- [ ] **Step 3: Adjust game area height in `enter()`**

In `enter()`, after setting `this.canvasHeight`, compute game area height:

```typescript
this.gameAreaHeight = this.keyboardVisible ? Math.floor(this.canvasHeight * 0.82) : this.canvasHeight
```

Update the BattleManager construction to use `gameAreaHeight`:

```typescript
this.manager = new BattleManager({
  // ...
  canvasHeight: this.gameAreaHeight,  // ← was this.canvasHeight
  // ...
})
```

- [ ] **Step 4: Use selectedPlants in plant resolution**

In `enter()`, update the plant resolution loop to use `this.selectedPlants`:

```typescript
// Build per-lane PlantConfig arrays
const lanePlants: PlantConfig[][] = []
for (let i = 0; i < laneCount; i++) {
  const ids = this.selectedPlants?.[i] ?? level.lanePlants?.[i] ?? stage.plants
  lanePlants.push(resolvePlants(ids))
}
```

- [ ] **Step 5: Update `render()` to draw keyboard**

At the end of the `render()` method, before the pause overlay, add keyboard rendering:

```typescript
// Virtual keyboard
if (this.keyboardVisible && this.manager) {
  const kbY = this.gameAreaHeight
  const kbH = this.canvasHeight - this.gameAreaHeight

  // Collect current expected letters for highlighting
  const highlightKeys: string[] = []
  const status = this.manager.status
  if (status === BattleStatus.Fighting) {
    if (this.manager.currentLetter) {
      highlightKeys.push(this.manager.currentLetter)
    } else {
      for (let li = 0; li < this.manager.laneCount; li++) {
        const lane = this.manager.getLane(li)
        if (!lane.isEmpty) highlightKeys.push(lane.currentLetter)
      }
    }
  }

  renderVirtualKeyboard(ctx, 0, kbY, w, kbH, highlightKeys)
}
```

- [ ] **Step 6: Limit background and overlays to game area**

Update the background fill and overlays that currently use `h` to use `this.gameAreaHeight` where appropriate. The background should still fill the full canvas (the keyboard has its own background), but battle overlays (pause, victory/defeat) should cover the full canvas:

The grass background line stays `ctx.fillRect(0, 0, w, h)` — that's fine, the keyboard renders on top.

No change needed for overlays — they should cover the full screen including keyboard area.

- [ ] **Step 7: Update `update()` to recompute gameAreaHeight on resize**

In `update()`, after updating canvasWidth/canvasHeight:

```typescript
this.gameAreaHeight = this.keyboardVisible ? Math.floor(this.canvasHeight * 0.82) : this.canvasHeight
```

Note: This doesn't affect BattleManager since its canvasHeight was set at construction. Lane positions are fixed for the duration of the battle.

- [ ] **Step 8: Run tests + verify in browser**

Run: `npm test`
Expected: All tests pass.

Run: `npm run dev`
Expected: Battle scene shows virtual keyboard at bottom with finger zone colors. Current letter is highlighted.

- [ ] **Step 9: Commit**

```bash
git add src/scenes/BattleScene.ts
git commit -m "feat(scenes): BattleScene integrates virtual keyboard + selectedPlants support"
```

---

## Task 11: App.tsx Full Wiring

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import PlantSelectScene and PLANT_MAP**

Add to imports:

```typescript
import { PlantSelectScene } from './scenes/PlantSelectScene'
import { STAGES, DIFFICULTIES, DIFFICULTY_ORDER, PLANT_DEFS, PLANT_MAP } from './config'
```

- [ ] **Step 2: Create and register PlantSelectScene**

After creating existing scenes:

```typescript
const plantSelectScene = new PlantSelectScene(switchTo)
sceneManager.register(plantSelectScene)
```

- [ ] **Step 3: Build plantNames once for reuse**

After creating `saveService`:

```typescript
const plantNames: Record<string, string> = {}
for (const p of PLANT_DEFS) { plantNames[p.id] = p.name }
```

- [ ] **Step 4: Create helper to navigate to PlantSelectScene**

```typescript
const goToPlantSelect = (stageIndex: number, levelIndex: number) => {
  const save = saveService.load()
  const stage = STAGES[stageIndex]
  const level = stage.levels[levelIndex]
  const laneCount = level.laneCount ?? 1

  // Resolve unlocked plants in PLANT_DEFS order (preserves display order)
  const unlockedSet = new Set(save.unlockedPlants)
  const unlockedPlants = PLANT_DEFS.filter(p => unlockedSet.has(p.id))

  plantSelectScene.setData(
    stageIndex,
    levelIndex,
    laneCount,
    save.slotSize,
    unlockedPlants,
    stage.plants,
  )
  switchTo('plantSelect')
}
```

- [ ] **Step 5: Update MenuScene 'continue' action → PlantSelectScene**

Replace the `'continue'` branch:

```typescript
if (action === 'continue') {
  const save = saveService.load()
  goToPlantSelect(save.currentStageIndex, save.currentLevelIndex)
}
```

- [ ] **Step 6: Add keyboard toggle to MenuScene**

Add `'keyboard'` to `MenuAction`:

In `src/scenes/MenuScene.ts`, add `'keyboard'` to the MenuAction type:

```typescript
type MenuAction = 'continue' | 'select' | 'difficulty' | 'keyboard'
```

Add keyboard toggle display in `render()`, after the difficulty line:

```typescript
ctx.fillText(`[K] 键盘提示：${this.saveData.keyboardVisible ? '开启' : '关闭'}`, w / 2, h * 0.80)
```

Add key handler in `handleInput()`:

```typescript
if (event.key === 'k' || event.key === 'K') {
  this.onAction?.('keyboard')
  return
}
```

In App.tsx, handle the `'keyboard'` action:

```typescript
} else if (action === 'keyboard') {
  const save = saveService.load()
  saveService.setKeyboardVisible(!save.keyboardVisible)
  refreshMenu()
}
```

- [ ] **Step 7: Wire PlantSelectScene actions**

```typescript
plantSelectScene.setActionHandler((action, lanePlants) => {
  if (action === 'start') {
    const save = saveService.load()
    // stageIndex/levelIndex are embedded in PlantSelectScene's setData
    // We need to retrieve them. Add getter or pass through.
    // Simplest: store in App scope.
    battleScene.setLevel(
      pendingStageIndex, pendingLevelIndex,
      save.difficulty,
      lanePlants,
      save.keyboardVisible,
    )
    switchTo('battle')
  } else if (action === 'back') {
    refreshMenu()
    switchTo('menu')
  }
})
```

For this to work, we need `pendingStageIndex`/`pendingLevelIndex` tracked in App scope. Refactor `goToPlantSelect` to store them:

```typescript
let pendingStageIndex = 0
let pendingLevelIndex = 0

const goToPlantSelect = (stageIndex: number, levelIndex: number) => {
  pendingStageIndex = stageIndex
  pendingLevelIndex = levelIndex
  // ... rest as before
}
```

- [ ] **Step 8: Update StageSelectScene 'play' action → PlantSelectScene**

```typescript
stageSelectScene.setActionHandler((action, stageIndex, levelIndex) => {
  if (action === 'play') {
    goToPlantSelect(stageIndex, levelIndex)
  } else if (action === 'back') {
    refreshMenu()
    switchTo('menu')
  }
})
```

- [ ] **Step 9: Update StageSelectScene.setData calls with plantNames**

```typescript
stageSelectScene.setData(STAGES, saveService.load(), plantNames)
```

Update all call sites.

- [ ] **Step 10: Update SettlementScene 'continue' to pass rewards**

Already done in Task 6 Step 4, but verify it flows through PlantSelectScene for the next level:

```typescript
if (action === 'continue') {
  const stage = STAGES[stageIndex]
  const level = stage.levels[levelIndex]
  const stars = settlementScene.getParams()?.stars ?? 1
  const hasNextStage = stageIndex + 1 < STAGES.length
  saveService.completeLevel(stageIndex, levelIndex, stars, stage.levels.length, hasNextStage, level.rewards)

  const save = saveService.load()
  if (saveService.isAllCompleted()) {
    refreshMenu()
    switchTo('menu')
  } else {
    goToPlantSelect(save.currentStageIndex, save.currentLevelIndex)
  }
}
```

And update `'replay'` to also go through plant select:

```typescript
} else if (action === 'replay') {
  goToPlantSelect(stageIndex, levelIndex)
}
```

- [ ] **Step 11: Run all tests**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 12: Full browser verification**

Run: `npm run dev`

Verify the complete flow:
1. **Menu** → shows keyboard toggle `[K]`
2. **Continue/Select** → goes to PlantSelectScene
3. **PlantSelectScene** → shows lanes, unlocked plants, slot capacity; can add/remove plants; Enter starts battle
4. **BattleScene** → uses selected plants; virtual keyboard shows at bottom with highlighted keys
5. **SettlementScene** → shows "通关奖励" on first completion with rewards
6. **StageSelectScene** → shows reward hints next to levels
7. **Replay/next level** → goes through PlantSelectScene again
8. **Toggle keyboard off** → battle scene uses full height, no keyboard
9. **Unlock flow** → complete a level with rewards → plant appears in PlantSelectScene next time

- [ ] **Step 13: Commit**

```bash
git add src/App.tsx src/scenes/MenuScene.ts
git commit -m "feat: wire PlantSelectScene + keyboard toggle into full game flow"
```

---

## Post-Implementation Checklist

- [ ] All 272+ existing tests still pass
- [ ] New SaveDataService tests pass (v2 migration, rewards, keyboard)
- [ ] New validation tests pass (rewards)
- [ ] Browser: complete flow from menu → plant select → battle → settlement → next level
- [ ] Browser: plant unlock shows in settlement and is available in next plant selection
- [ ] Browser: slot increase persists and allows more plants
- [ ] Browser: keyboard toggle works (on/off persists across sessions)
- [ ] Browser: virtual keyboard highlights current letter(s) correctly
- [ ] Browser: multi-lane plant selection works (arrows switch lanes)
- [ ] Old save data (v1) migrates cleanly on first load
