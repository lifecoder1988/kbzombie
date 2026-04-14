# 阶段四 4.4 多种僵尸类型 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 添加 5 种僵尸类型（普通、路障、胖僵尸、旗手、小鬼），支持 width/height 配置和波次混合出怪，用视觉区分和演示关卡验证。

**Architecture:** 扩展 ZombieDef 加 width/height 字段 → ZombieEntity 构造参数接受 width/height → WaveDef 改为数组支持混合出怪 → 配置层加 5 种僵尸 + 演示关卡 → 更新校验和文档。遵循"改配置加功能"原则，game/ 层改动限于 ZombieEntity 接受新构造参数和 BattleManager 适配新 WaveDef 结构。

**Tech Stack:** TypeScript, Vitest, Canvas

---

## 文件变更概览

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/config/types.ts` | 修改 | ZombieDef 加 width/height，WaveDef 改为支持混合出怪 |
| `src/game/types.ts` | 修改 | ZombieConfig 加 width/height，WaveConfig 改为数组形式 |
| `src/game/ZombieEntity.ts` | 修改 | 构造参数接受 width/height |
| `src/game/BattleManager.ts` | 修改 | spawnZombie 适配新 WaveDef 结构 |
| `src/config/zombies.ts` | 修改 | 添加 5 种僵尸配置 |
| `src/config/stages.ts` | 修改 | 添加演示关卡，使用混合出怪 |
| `src/config/validation.ts` | 修改 | 校验 width/height、混合 WaveDef |
| `src/scenes/BattleScene.ts` | 修改 | 适配 ZombieDef 新增 width/height 字段 |
| `docs/ZOMBIES_AND_STAGES.md` | 修改 | 更新僵尸类型表，删除单词僵尸 |
| `docs/ROADMAP.md` | 修改 | 更新 4.4 勾选项和完成记录 |

---

### Task 1: ZombieDef 和 ZombieConfig 加 width/height 字段

**Files:**
- Modify: `src/config/types.ts:24-30`
- Modify: `src/game/types.ts:37-41`

- [ ] **Step 1: 修改 config/types.ts 的 ZombieDef**

```typescript
/** 僵尸定义（字段名对齐 GAME_DESIGN.md 5.1） */
export interface ZombieDef {
  readonly id: string
  readonly name: string
  readonly hp: number
  readonly speed: number          // 像素/秒
  readonly chewDps: number        // 啃植物每秒伤害
  readonly width: number          // 碰撞宽度（像素）
  readonly height: number         // 碰撞高度（像素）
}
```

- [ ] **Step 2: 修改 game/types.ts 的 ZombieConfig**

```typescript
/** 僵尸配置 */
export interface ZombieConfig {
  readonly hp: number
  readonly speed: number       // 像素/秒
  readonly chewDps: number     // 啃植物每秒伤害
  readonly width: number       // 碰撞宽度（像素）
  readonly height: number      // 碰撞高度（像素）
}
```

- [ ] **Step 3: 更新 zombies.ts 现有配置加 width/height**

```typescript
import type { ZombieDef } from './types'

export const ZOMBIE_DEFS: Readonly<Record<string, ZombieDef>> = {
  normal: { id: 'normal', name: '普通僵尸', hp: 50, speed: 30, chewDps: 10, width: 40, height: 60 },
  slow: { id: 'slow', name: '慢速僵尸', hp: 80, speed: 15, chewDps: 5, width: 40, height: 60 },
}
```

- [ ] **Step 4: 修复编译错误**

在 `src/scenes/BattleScene.ts:70-77`，zombieConfigs 构建逻辑加入 width/height：

```typescript
    const zombieConfigs: Record<string, { hp: number; speed: number; chewDps: number; width: number; height: number }> = {}
    for (const [id, def] of Object.entries(ZOMBIE_DEFS)) {
      zombieConfigs[id] = {
        hp: def.hp,
        speed: def.speed * difficulty.zombieSpeedMultiplier,
        chewDps: def.chewDps,
        width: def.width,
        height: def.height,
      }
    }
```

在 `src/game/BattleManager.ts:29` 的 BattleConfig 类型中，zombieConfigs 已经是 `Record<string, ZombieConfig>`，ZombieConfig 扩展后自动生效。

修复所有测试中构造 zombieConfigs 的地方，加上 width/height 默认值。在 `src/game/__tests__/BattleManager.test.ts:28`：

```typescript
const TEST_ZOMBIE = { hp: 50, speed: 30, chewDps: 10, width: 40, height: 60 }
```

在 `src/game/__tests__/BattleManager.test.ts:399`（weakZombie）：

```typescript
    const weakZombie = { hp: 1, speed: 30, chewDps: 0, width: 40, height: 60 }
```

在 `src/game/__tests__/BattleManager.test.ts:222`（highHpZombie）：

```typescript
    const highHpZombie = { hp: 200, speed: 30, chewDps: 10, width: 40, height: 60 }
```

- [ ] **Step 5: 运行测试确认编译通过**

Run: `npm test`
Expected: 全部通过（此时 ZombieEntity 还没用 width/height，但类型兼容）

- [ ] **Step 6: Commit**

```bash
git add src/config/types.ts src/game/types.ts src/config/zombies.ts src/scenes/BattleScene.ts src/game/__tests__/BattleManager.test.ts
git commit -m "feat(config): ZombieDef 和 ZombieConfig 新增 width/height 字段"
```

---

### Task 2: ZombieEntity 接受 width/height 构造参数（TDD）

**Files:**
- Modify: `src/game/ZombieEntity.ts`
- Modify: `src/game/__tests__/ZombieEntity.test.ts`

- [ ] **Step 1: 写失败测试 — 构造参数传入 width/height 生效**

在 `src/game/__tests__/ZombieEntity.test.ts` 添加：

```typescript
  it('构造参数的 width/height 生效', () => {
    const z = new ZombieEntity('z-1', 800, 100, 50, 30, 10, 60, 80)
    expect(z.width).toBe(60)
    expect(z.height).toBe(80)
  })

  it('默认 width/height 为 40x60', () => {
    const z = new ZombieEntity('z-1', 800, 100, 50, 30, 10)
    expect(z.width).toBe(40)
    expect(z.height).toBe(60)
  })
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- src/game/__tests__/ZombieEntity.test.ts`
Expected: "构造参数的 width/height 生效" FAIL（构造函数还没接受这些参数）

- [ ] **Step 3: 实现 — ZombieEntity 构造函数接受可选 width/height**

在 `src/game/ZombieEntity.ts` 修改构造函数：

```typescript
  constructor(id: string, x: number, y: number, hp: number, speed: number, chewDps: number, width?: number, height?: number) {
    this.id = id
    this.x = x
    this.y = y
    this.maxHp = hp
    this._currentHp = hp
    this.speed = speed
    this.chewDps = chewDps
    if (width !== undefined) this.width = width
    if (height !== undefined) this.height = height
  }
```

同时修改字段声明为非 readonly：

```typescript
  width = 40
  height = 60
```

（这些已经是非 readonly，不需要改。）

- [ ] **Step 4: 运行测试确认通过**

Run: `npm test -- src/game/__tests__/ZombieEntity.test.ts`
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/ZombieEntity.ts src/game/__tests__/ZombieEntity.test.ts
git commit -m "feat(game): ZombieEntity 构造函数支持 width/height 参数"
```

---

### Task 3: BattleManager.spawnZombie 传入 width/height

**Files:**
- Modify: `src/game/BattleManager.ts:229-243`

- [ ] **Step 1: 修改 spawnZombie 传入 width/height**

```typescript
  private spawnZombie(): void {
    const wave = this.config.waves[this._currentWave]
    const zombieConfig = this.config.zombieConfigs[wave.zombieType]
    const { canvasWidth } = this.config
    const id = `zombie_${this.zombieIdCounter++}`
    const spawnX = canvasWidth + 20

    // Randomly assign to a lane
    const laneIdx = Math.floor(Math.random() * this.lanes.length)
    const lane = this.lanes[laneIdx]
    const zombie = new ZombieEntity(id, spawnX, lane.laneY, zombieConfig.hp, zombieConfig.speed, zombieConfig.chewDps, zombieConfig.width, zombieConfig.height)

    this.zombieLanes.set(id, laneIdx)
    this.assignChewTarget(zombie, lane)
    this.entityManager.add(zombie)
  }
```

- [ ] **Step 2: 运行全部测试确认通过**

Run: `npm test`
Expected: 全部 PASS

- [ ] **Step 3: Commit**

```bash
git add src/game/BattleManager.ts
git commit -m "feat(game): BattleManager 创建僵尸时传入配置的 width/height"
```

---

### Task 4: ZombieEntity render 区分不同体型视觉（TDD）

**Files:**
- Modify: `src/game/ZombieEntity.ts:167-178`
- Modify: `src/config/types.ts` (ZombieDef 加 color)
- Modify: `src/game/types.ts` (ZombieConfig 加 color)

当前所有僵尸都是绿色色块，不同类型无法区分。为了在阶段六之前有最低限度的视觉区分，给 ZombieDef 加一个 `color` 字段。

- [ ] **Step 1: ZombieDef 和 ZombieConfig 加 color 字段**

`src/config/types.ts`:
```typescript
export interface ZombieDef {
  readonly id: string
  readonly name: string
  readonly hp: number
  readonly speed: number
  readonly chewDps: number
  readonly width: number
  readonly height: number
  readonly color: string          // 渲染颜色（十六进制，如 '#44cc44'）
}
```

`src/game/types.ts`:
```typescript
export interface ZombieConfig {
  readonly hp: number
  readonly speed: number
  readonly chewDps: number
  readonly width: number
  readonly height: number
  readonly color: string
}
```

- [ ] **Step 2: 更新 zombies.ts 现有配置加 color**

```typescript
export const ZOMBIE_DEFS: Readonly<Record<string, ZombieDef>> = {
  normal: { id: 'normal', name: '普通僵尸', hp: 50, speed: 30, chewDps: 10, width: 40, height: 60, color: '#44cc44' },
  slow: { id: 'slow', name: '慢速僵尸', hp: 80, speed: 15, chewDps: 5, width: 40, height: 60, color: '#44cc44' },
}
```

- [ ] **Step 3: ZombieEntity 构造函数接受 color，render 使用**

构造函数签名改为接受一个配置对象（参数已经太多了）：

```typescript
export interface ZombieSpawnParams {
  id: string
  x: number
  y: number
  hp: number
  speed: number
  chewDps: number
  width?: number
  height?: number
  color?: string
}

export class ZombieEntity implements Entity {
  // ... existing fields ...
  private readonly color: string

  constructor(params: ZombieSpawnParams) {
    this.id = params.id
    this.x = params.x
    this.y = params.y
    this.maxHp = params.hp
    this._currentHp = params.hp
    this.speed = params.speed
    this.chewDps = params.chewDps
    if (params.width !== undefined) this.width = params.width
    if (params.height !== undefined) this.height = params.height
    this.color = params.color ?? '#44cc44'
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this._state === ZombieState.Chewing ? '#ff6600' : this.color
    ctx.fillRect(this.x, this.y, this.width, this.height)
    // HP bar (same as before)
    const barWidth = this.width
    const barHeight = 4
    const barY = this.y - 8
    const hpRatio = this._currentHp / this.maxHp
    ctx.fillStyle = '#333'
    ctx.fillRect(this.x, barY, barWidth, barHeight)
    ctx.fillStyle = '#ff3333'
    ctx.fillRect(this.x, barY, barWidth * hpRatio, barHeight)
  }
}
```

- [ ] **Step 4: 更新所有调用方**

`BattleManager.spawnZombie`:
```typescript
  private spawnZombie(): void {
    const wave = this.config.waves[this._currentWave]
    const zombieConfig = this.config.zombieConfigs[wave.zombieType]
    const { canvasWidth } = this.config
    const id = `zombie_${this.zombieIdCounter++}`
    const spawnX = canvasWidth + 20

    const laneIdx = Math.floor(Math.random() * this.lanes.length)
    const lane = this.lanes[laneIdx]
    const zombie = new ZombieEntity({
      id, x: spawnX, y: lane.laneY,
      hp: zombieConfig.hp, speed: zombieConfig.speed, chewDps: zombieConfig.chewDps,
      width: zombieConfig.width, height: zombieConfig.height, color: zombieConfig.color,
    })

    this.zombieLanes.set(id, laneIdx)
    this.assignChewTarget(zombie, lane)
    this.entityManager.add(zombie)
  }
```

`BattleScene.ts` zombieConfigs 构建加 color：
```typescript
    zombieConfigs[id] = {
      hp: def.hp,
      speed: def.speed * difficulty.zombieSpeedMultiplier,
      chewDps: def.chewDps,
      width: def.width,
      height: def.height,
      color: def.color,
    }
```

- [ ] **Step 5: 更新所有测试中的 ZombieEntity 构造调用**

全局搜索 `new ZombieEntity(` 并改为对象参数形式。`ZombieEntity.test.ts` 示例：

```typescript
  it('初始状态为 Walking', () => {
    const z = new ZombieEntity({ id: 'z-1', x: 800, y: 100, hp: 50, speed: 30, chewDps: 10 })
    expect(z.state).toBe(ZombieState.Walking)
    expect(z.active).toBe(true)
  })
```

TEST_ZOMBIE 也需要加 color：
```typescript
const TEST_ZOMBIE = { hp: 50, speed: 30, chewDps: 10, width: 40, height: 60, color: '#44cc44' }
```

highHpZombie 和 weakZombie 类似处理。

- [ ] **Step 6: 运行全部测试确认通过**

Run: `npm test`
Expected: 全部 PASS

- [ ] **Step 7: Commit**

```bash
git add src/config/types.ts src/game/types.ts src/game/ZombieEntity.ts src/game/BattleManager.ts src/config/zombies.ts src/scenes/BattleScene.ts src/game/__tests__/ZombieEntity.test.ts src/game/__tests__/BattleManager.test.ts
git commit -m "refactor(game): ZombieEntity 改用对象参数构造，新增 color 字段"
```

---

### Task 5: WaveDef 支持混合出怪

**Files:**
- Modify: `src/config/types.ts:32-37`
- Modify: `src/game/types.ts:43-48`
- Modify: `src/game/BattleManager.ts`
- Modify: `src/game/__tests__/BattleManager.test.ts`
- Modify: `src/config/validation.ts`
- Modify: `src/config/__tests__/validation.test.ts`

当前 WaveDef 是 `{ zombieType: string, count, interval }`，每波只能出一种。改为支持多种僵尸的混合编队。

**设计**：WaveDef 加一个可选的 `zombies` 数组字段，用于混合出怪。如果提供了 `zombies`，则按数组比例随机抽取；如果只有 `zombieType`，保持向后兼容。

```typescript
export interface WaveZombieEntry {
  readonly type: string       // ZombieDef.id
  readonly weight: number     // 出现权重（如 3 表示 3 份概率）
}

export interface WaveDef {
  readonly count: number
  readonly interval: number
  readonly zombieType?: string                    // 单类型（向后兼容）
  readonly zombies?: readonly WaveZombieEntry[]   // 混合出怪
}
```

`zombieType` 和 `zombies` 二选一：提供 `zombieType` 等价于 `zombies: [{ type: zombieType, weight: 1 }]`。

- [ ] **Step 1: 写失败测试 — 混合出怪波次中出现多种僵尸**

在 `src/game/__tests__/BattleManager.test.ts` 添加：

```typescript
describe('混合出怪', () => {
  it('混合波次能生成不同类型僵尸', () => {
    const fatZombie = { hp: 150, speed: 15, chewDps: 5, width: 55, height: 70, color: '#668844' }
    const mgr = createManager({
      waves: [{
        count: 20,
        interval: 100,
        zombies: [
          { type: 'normal', weight: 1 },
          { type: 'fat', weight: 1 },
        ],
      }],
      zombieConfigs: { normal: TEST_ZOMBIE, fat: fatZombie },
    })
    // Spawn all zombies
    for (let i = 0; i < 40; i++) mgr.update(100)
    const zombies = mgr.getZombies()
    const widths = new Set(zombies.map(z => z.width))
    // With 20 zombies at 50/50 weight, both sizes should appear
    expect(widths.size).toBeGreaterThanOrEqual(2)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- src/game/__tests__/BattleManager.test.ts`
Expected: FAIL（WaveConfig 类型还没有 zombies 字段）

- [ ] **Step 3: 修改 config/types.ts WaveDef**

```typescript
/** 混合出怪条目 */
export interface WaveZombieEntry {
  readonly type: string       // ZombieDef.id
  readonly weight: number     // 出现权重
}

/** 单波配置 */
export interface WaveDef {
  readonly count: number
  readonly interval: number
  readonly zombieType?: string
  readonly zombies?: readonly WaveZombieEntry[]
}
```

- [ ] **Step 4: 修改 game/types.ts WaveConfig**

```typescript
/** 混合出怪条目 */
export interface WaveZombieEntry {
  readonly type: string
  readonly weight: number
}

/** 波次配置 */
export interface WaveConfig {
  readonly count: number
  readonly interval: number
  readonly zombieType?: string
  readonly zombies?: readonly WaveZombieEntry[]
}
```

- [ ] **Step 5: BattleManager 新增 resolveZombieType 方法**

在 `BattleManager` 类中添加：

```typescript
  private resolveZombieType(wave: WaveConfig): string {
    if (wave.zombies && wave.zombies.length > 0) {
      let totalWeight = 0
      for (const entry of wave.zombies) totalWeight += entry.weight
      let roll = Math.random() * totalWeight
      for (const entry of wave.zombies) {
        roll -= entry.weight
        if (roll <= 0) return entry.type
      }
      return wave.zombies[wave.zombies.length - 1].type
    }
    return wave.zombieType!
  }
```

修改 `spawnZombie` 使用它：

```typescript
  private spawnZombie(): void {
    const wave = this.config.waves[this._currentWave]
    const zombieType = this.resolveZombieType(wave)
    const zombieConfig = this.config.zombieConfigs[zombieType]
    // ... rest unchanged, use zombieConfig ...
  }
```

- [ ] **Step 6: 运行测试确认通过**

Run: `npm test`
Expected: 全部 PASS

- [ ] **Step 7: Commit**

```bash
git add src/config/types.ts src/game/types.ts src/game/BattleManager.ts src/game/__tests__/BattleManager.test.ts
git commit -m "feat(game): WaveDef 支持混合出怪（zombies 权重数组）"
```

---

### Task 6: 配置校验适配新 WaveDef 结构

**Files:**
- Modify: `src/config/validation.ts:69-76`
- Modify: `src/config/__tests__/validation.test.ts`

- [ ] **Step 1: 写失败测试 — 校验 zombies 数组中的引用**

在 `src/config/__tests__/validation.test.ts` 添加：

```typescript
  it('波次 zombies 数组引用不存在的 type 报错', () => {
    const stages: StageDef[] = [
      {
        id: 1, name: 'S1', letters: ['f'], plants: ['p1'],
        levels: [{
          id: 1,
          waves: [{ count: 5, interval: 3000, zombies: [{ type: 'ghost', weight: 1 }] }],
        }],
      },
    ]
    const errors = validateConfig(validPlants, validZombies, stages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('ghost'))).toBe(true)
  })

  it('波次 zombies 数组 weight <= 0 报错', () => {
    const stages: StageDef[] = [
      {
        id: 1, name: 'S1', letters: ['f'], plants: ['p1'],
        levels: [{
          id: 1,
          waves: [{ count: 5, interval: 3000, zombies: [{ type: 'normal', weight: 0 }] }],
        }],
      },
    ]
    const errors = validateConfig(validPlants, validZombies, stages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('weight'))).toBe(true)
  })

  it('波次 zombieType 和 zombies 都未提供报错', () => {
    const stages: StageDef[] = [
      {
        id: 1, name: 'S1', letters: ['f'], plants: ['p1'],
        levels: [{
          id: 1,
          waves: [{ count: 5, interval: 3000 } as any],
        }],
      },
    ]
    const errors = validateConfig(validPlants, validZombies, stages, validSynergy, validBattle)
    expect(errors.some(e => e.includes('zombieType') || e.includes('zombies'))).toBe(true)
  })

  it('波次 zombies 数组合法时不报错', () => {
    const stages: StageDef[] = [
      {
        id: 1, name: 'S1', letters: ['f'], plants: ['p1'],
        levels: [{
          id: 1,
          waves: [{ count: 5, interval: 3000, zombies: [{ type: 'normal', weight: 1 }] }],
        }],
      },
    ]
    const errors = validateConfig(validPlants, validZombies, stages, validSynergy, validBattle)
    expect(errors).toEqual([])
  })
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm test -- src/config/__tests__/validation.test.ts`
Expected: 新增测试 FAIL

- [ ] **Step 3: 更新 validation.ts 的波次校验逻辑**

替换 `validation.ts:69-76` 中的波次校验为：

```typescript
      for (const wave of level.waves) {
        if (wave.count <= 0) {
          errors.push(`阶段 ${stage.id} 关卡 ${level.id} 波次 count 必须 > 0，当前: ${wave.count}`)
        }
        if (wave.zombies && wave.zombies.length > 0) {
          for (const entry of wave.zombies) {
            if (!(entry.type in zombies)) {
              errors.push(`阶段 ${stage.id} 关卡 ${level.id} 波次引用不存在的僵尸类型: "${entry.type}"`)
            }
            if (entry.weight <= 0) {
              errors.push(`阶段 ${stage.id} 关卡 ${level.id} 波次僵尸 "${entry.type}" weight 必须 > 0，当前: ${entry.weight}`)
            }
          }
        } else if (wave.zombieType) {
          if (!(wave.zombieType in zombies)) {
            errors.push(`阶段 ${stage.id} 关卡 ${level.id} 引用不存在的僵尸类型: "${wave.zombieType}"`)
          }
        } else {
          errors.push(`阶段 ${stage.id} 关卡 ${level.id} 波次必须提供 zombieType 或 zombies`)
        }
      }
```

- [ ] **Step 4: 更新 zombies.ts 校验测试中 validZombies 加 width/height/color**

```typescript
const validZombies: Record<string, ZombieDef> = {
  normal: { id: 'normal', name: 'Normal', hp: 50, speed: 30, chewDps: 10, width: 40, height: 60, color: '#44cc44' },
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npm test`
Expected: 全部 PASS

- [ ] **Step 6: Commit**

```bash
git add src/config/validation.ts src/config/__tests__/validation.test.ts
git commit -m "feat(config): 校验适配混合出怪 WaveDef 和 ZombieDef 新字段"
```

---

### Task 7: 添加 5 种僵尸配置

**Files:**
- Modify: `src/config/zombies.ts`

- [ ] **Step 1: 替换 zombies.ts 为完整 5 种僵尸配置**

```typescript
import type { ZombieDef } from './types'

export const ZOMBIE_DEFS: Readonly<Record<string, ZombieDef>> = {
  normal:   { id: 'normal',   name: '普通僵尸', hp: 50,  speed: 30, chewDps: 10, width: 40, height: 60, color: '#44cc44' },
  conehead: { id: 'conehead', name: '路障僵尸', hp: 80,  speed: 28, chewDps: 10, width: 40, height: 65, color: '#ee8833' },
  fat:      { id: 'fat',      name: '胖僵尸',   hp: 150, speed: 15, chewDps: 5,  width: 55, height: 70, color: '#668844' },
  flag:     { id: 'flag',     name: '旗手僵尸', hp: 35,  speed: 50, chewDps: 15, width: 38, height: 60, color: '#cc4444' },
  imp:      { id: 'imp',      name: '小鬼僵尸', hp: 20,  speed: 55, chewDps: 8,  width: 28, height: 40, color: '#aa66cc' },
}
```

数值设计说明（不写入代码）：
- **普通**：基准线，各维度居中
- **路障**：普通的微升级，血量 +60%，速度略慢，同 chewDps
- **胖僵尸**：hp ×3，速度减半，chewDps 减半，体型明显大（55×70），吸引范围伤害
- **旗手**：hp 低（35），速度 ×1.67，chewDps 高（15），标准体型，红色醒目
- **小鬼**：hp 最低（20），速度最快，体型小（28×40），紫色，难以被 fan/explode 覆盖

- [ ] **Step 2: 运行测试确认配置不破坏现有逻辑**

Run: `npm test`
Expected: 全部 PASS

- [ ] **Step 3: Commit**

```bash
git add src/config/zombies.ts
git commit -m "feat(config): 添加 5 种僵尸类型（普通/路障/胖僵尸/旗手/小鬼）"
```

---

### Task 8: 添加演示关卡验证多种僵尸

**Files:**
- Modify: `src/config/stages.ts`

- [ ] **Step 1: 添加两个演示关卡**

在 `STAGES` 数组末尾追加：

```typescript
  {
    id: 7,
    name: '僵尸类型演示-肉盾',
    letters: ['f', 'j', 'd', 'k', 's', 'l', 'a'],
    plants: ['peashooter', 'snow_pea', 'repeater'],
    levels: [
      {
        id: 1,
        laneCount: 1,
        waves: [
          { count: 5, interval: 2000, zombies: [
            { type: 'normal', weight: 2 },
            { type: 'conehead', weight: 1 },
          ]},
          { count: 5, interval: 1500, zombies: [
            { type: 'conehead', weight: 2 },
            { type: 'fat', weight: 1 },
          ]},
        ],
      },
    ],
  },
  {
    id: 8,
    name: '僵尸类型演示-混合冲锋',
    letters: ['f', 'j', 'd', 'k', 's', 'l', 'a'],
    plants: ['peashooter', 'snow_pea', 'cactus'],
    levels: [
      {
        id: 1,
        laneCount: 2,
        waves: [
          { count: 8, interval: 1500, zombies: [
            { type: 'normal', weight: 3 },
            { type: 'flag', weight: 1 },
            { type: 'imp', weight: 1 },
          ]},
          { count: 10, interval: 1000, zombies: [
            { type: 'normal', weight: 2 },
            { type: 'conehead', weight: 2 },
            { type: 'flag', weight: 2 },
            { type: 'imp', weight: 1 },
            { type: 'fat', weight: 1 },
          ]},
        ],
      },
    ],
  },
```

- [ ] **Step 2: 运行测试确认配置校验通过**

Run: `npm test`
Expected: 全部 PASS

- [ ] **Step 3: Commit**

```bash
git add src/config/stages.ts
git commit -m "feat(config): 添加僵尸类型演示关卡（肉盾编队+混合冲锋）"
```

---

### Task 9: 更新设计文档和 ROADMAP

**Files:**
- Modify: `docs/ZOMBIES_AND_STAGES.md`
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: 更新 ZOMBIES_AND_STAGES.md 僵尸类型表**

替换第二节的僵尸类型表为：

```markdown
## 二、初版僵尸类型

| 僵尸类型 | 血量 | 速度(px/s) | 啃速(DPS) | 体型(w×h) | 颜色 | 特点 | 解锁时机 |
|----------|------|-----------|----------|-----------|------|------|----------|
| 普通僵尸 | 50 | 30 | 10 | 40×60 | 绿 | 基础敌人 | 初始 |
| 路障僵尸 | 80 | 28 | 10 | 40×65 | 橙 | 普通僵尸的微升级 | 第 2 阶段 |
| 胖僵尸 | 150 | 15 | 5 | 55×70 | 暗绿 | 高血量大体型肉盾，易吸引范围攻击 | 第 2 阶段 |
| 旗手僵尸 | 35 | 50 | 15 | 38×60 | 红 | 速度快啃得快，缩短反应窗口 | 第 3 阶段 |
| 小鬼僵尸 | 20 | 55 | 8 | 28×40 | 紫 | 体型小速度极快，难以被范围攻击覆盖 | 第 3 阶段 |

> 更多僵尸类型可通过策略配置新增，不改动核心代码。
```

同时删除 `slow` 慢速僵尸的描述（已被胖僵尸取代，但 config 中暂保留以兼容弹道演示关卡）。

- [ ] **Step 2: 更新 ROADMAP.md 4.4 勾选项和完成记录**

将阶段四完成标准中的：
```
- [ ] 胖僵尸、旗手、单词僵尸各有正确行为
```
改为：
```
- [x] 5 种僵尸类型配置完成（普通/路障/胖僵尸/旗手/小鬼），体型和颜色可视区分
- [x] 波次支持混合出怪（zombies 权重数组）
```

在阶段四记录区块中添加 4.4 完成记录：
```
> **4.4 已完成** — 5 种僵尸类型 + 混合出怪 + 演示关卡。N 个测试通过。详见 `docs/plans/2026-04-14-stage4-zombie-types.md`。
>
> **实现要点**：
> - ZombieDef 新增 width/height/color 字段，ZombieEntity 改用对象参数构造
> - WaveDef 支持 zombies 权重数组混合出怪，向后兼容 zombieType 单类型
> - 5 种僵尸覆盖 hp/速度/体型/chewDps 全参数空间
> - 两个演示关卡验证：肉盾编队（普通+路障+胖）、混合冲锋（全部 5 种）
```

- [ ] **Step 3: Commit**

```bash
git add docs/ZOMBIES_AND_STAGES.md docs/ROADMAP.md
git commit -m "docs: 更新僵尸类型文档和 ROADMAP 标记 4.4 完成"
```

---

### Task 10: 浏览器验收

- [ ] **Step 1: 启动 dev server**

Run: `npm run dev`

- [ ] **Step 2: 在浏览器中验证**

1. 打开菜单，选择"僵尸类型演示-肉盾"关卡
2. 验证能看到不同颜色、不同大小的僵尸混合出现
3. 胖僵尸明显更大更慢，旗手僵尸快速移动
4. 切换到"僵尸类型演示-混合冲锋"关卡
5. 验证 2 路模式下 5 种僵尸都能出现
6. 打完一关确认胜负判定正常

- [ ] **Step 3: 确认全部测试通过**

Run: `npm test`
Expected: 全部 PASS
