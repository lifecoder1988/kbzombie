# 阶段六视觉打磨实现计划（6.3 P0+P1）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为游戏添加打击反馈系统（P0）和视觉辨识度升级（P1），从色块原型提升到有手感的卡通风格。

**Architecture:** BattleManager 通过 Effect Queue 推送游戏事件，BattleScene 每帧消费事件并通过 VfxManager 创建视觉效果对象。实体渲染委托给 `scenes/renderers/` 下的纯函数。引擎层和配置层零改动。

**Tech Stack:** TypeScript strict, Canvas 2D API, Vitest

**Design doc:** `docs/plans/2026-04-15-stage6-visual-polish-design.md`

---

## 文件结构

### 新增文件

| 文件 | 职责 |
|------|------|
| `src/scenes/VfxManager.ts` | VfxObject 接口 + VfxManager 类（对象池 + 屏幕震动） |
| `src/scenes/vfx/LetterPop.ts` | 字母弹出/红闪效果 |
| `src/scenes/vfx/FlashPulse.ts` | 圆形闪光脉冲 |
| `src/scenes/vfx/ParticleBurst.ts` | 粒子爆发效果 |
| `src/scenes/vfx/DeathFlyout.ts` | 僵尸死亡击飞 |
| `src/scenes/vfx/FullScreenFlash.ts` | 全屏闪光叠加 |
| `src/scenes/renderers/PlantRenderer.ts` | 植物简笔画渲染纯函数 |
| `src/scenes/renderers/ZombieRenderer.ts` | 僵尸简笔画渲染纯函数 |
| `src/scenes/renderers/ProjectileRenderer.ts` | 弹道特效渲染纯函数 |
| `src/scenes/renderers/BattlefieldRenderer.ts` | 草坪网格 + 泥土路径背景渲染 |
| `src/game/__tests__/BattleManager.events.test.ts` | Effect Queue 测试 |
| `src/scenes/__tests__/VfxManager.test.ts` | VfxManager 生命周期 + 对象池测试 |
| `src/scenes/__tests__/vfx/LetterPop.test.ts` | LetterPop 效果测试 |
| `src/scenes/__tests__/vfx/FlashPulse.test.ts` | FlashPulse 效果测试 |
| `src/scenes/__tests__/vfx/ParticleBurst.test.ts` | ParticleBurst 效果测试 |
| `src/scenes/__tests__/vfx/DeathFlyout.test.ts` | DeathFlyout 效果测试 |
| `src/scenes/__tests__/vfx/FullScreenFlash.test.ts` | FullScreenFlash 效果测试 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/game/types.ts` | 新增 GameEvent 类型 |
| `src/game/BattleManager.ts` | 新增 _events 队列 + pushEvent + consumeEvents + 各关键点插入 |
| `src/game/PlantEntity.ts` | 新增 bounceTimer，render() 委托 PlantRenderer |
| `src/game/ZombieEntity.ts` | 新增 flashTimer + walkPhase，render() 委托 ZombieRenderer，暴露状态查询 |
| `src/game/ProjectileEntity.ts` | 新增 trailPositions，render() 委托 ProjectileRenderer |
| `src/scenes/BattleScene.ts` | 集成 VfxManager + 消费 events + 震屏 + 草坪背景 |

---

## Task 1: GameEvent 类型 + Effect Queue

**Files:**
- Modify: `src/game/types.ts`
- Modify: `src/game/BattleManager.ts`
- Create: `src/game/__tests__/BattleManager.events.test.ts`

- [ ] **Step 1: 在 types.ts 末尾新增 GameEvent 类型**

```typescript
// src/game/types.ts — append at end

export type GameEvent =
  | { readonly type: 'hit'; readonly x: number; readonly y: number; readonly letter: string; readonly laneIndex: number }
  | { readonly type: 'miss'; readonly laneIndex: number }
  | { readonly type: 'settlement'; readonly x: number; readonly y: number; readonly power: number; readonly isFullChain: boolean; readonly plantCount: number; readonly totalPlants: number }
  | { readonly type: 'zombieHit'; readonly x: number; readonly y: number; readonly zombieId: string; readonly element: Element }
  | { readonly type: 'zombieDeath'; readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly color: string }
  | { readonly type: 'waveStart'; readonly waveIndex: number; readonly totalWaves: number }
  | { readonly type: 'waveEnd'; readonly waveIndex: number }
```

- [ ] **Step 2: 写 Effect Queue 测试**

```typescript
// src/game/__tests__/BattleManager.events.test.ts
import { describe, it, expect } from 'vitest'
import { BattleManager } from '../BattleManager'
import type { BattleConfig } from '../BattleManager'
import type { PlantConfig } from '../types'

// Minimal config for testing event queue
function makeConfig(overrides?: Partial<BattleConfig>): BattleConfig {
  const plant: PlantConfig = {
    id: 'p1', name: 'Test', comboSegment: 1, attackPower: 10, hp: 100,
    element: 'normal', spread: 'single', flight: 'straight', impact: 'vanish',
  }
  return {
    laneCount: 1,
    lanePlants: [[plant]],
    waves: [{ count: 1, interval: 1000, zombieType: 'normal' }],
    zombieConfigs: { normal: { hp: 5, speed: 50, chewDps: 10, width: 40, height: 60, color: '#44cc44' } },
    letterPool: ['a', 'b', 'c'],
    missedLimit: 5,
    projectileSpeed: 300,
    healAmount: 50,
    wavePauseDuration: 1000,
    canvasWidth: 800,
    canvasHeight: 600,
    synergyMultiplier: { 1: 1 },
    effectParams: {
      burst: { burstCount: 3, burstInterval: 50 },
      fan: { fanBulletCount: 3, fanSpreadAngle: 0.5 },
      tracking: { trackingTurnRate: 3 },
      chain: { chainBounces: 2, chainRange: 150 },
      explode: { explodeRadius: 80, explodeDamageRatio: 0.5 },
      ice: { slowRatio: 0.5, slowDuration: 2 },
      fire: { burnDps: 5, burnDuration: 3 },
      electric: { conductRadius: 100, conductDamageDecay: 0.5, conductMaxJumps: 3 },
      stun: { stunDuration: 1 },
      knockback: { knockbackDistance: 50 },
    },
    ...overrides,
  }
}

describe('BattleManager Effect Queue', () => {
  it('consumeEvents returns empty array initially', () => {
    const manager = new BattleManager(makeConfig())
    expect(manager.consumeEvents()).toEqual([])
  })

  it('consumeEvents clears the queue after reading', () => {
    const manager = new BattleManager(makeConfig())
    // Force a spawn and advance time so there is a zombie
    manager.update(0) // flush
    manager.update(1100) // spawn zombie

    // Hit the current letter to generate a hit event
    const lane = manager.getLane(0)
    const letter = lane.currentLetter
    manager.onKeyDown(letter)

    const events = manager.consumeEvents()
    expect(events.length).toBeGreaterThan(0)
    // Second call should be empty
    expect(manager.consumeEvents()).toEqual([])
  })

  it('emits hit event on correct key press', () => {
    const manager = new BattleManager(makeConfig())
    manager.update(0)
    manager.update(1100)

    const letter = manager.getLane(0).currentLetter
    manager.onKeyDown(letter)

    const events = manager.consumeEvents()
    const hitEvents = events.filter(e => e.type === 'hit')
    expect(hitEvents.length).toBe(1)
    expect(hitEvents[0].type).toBe('hit')
    if (hitEvents[0].type === 'hit') {
      expect(hitEvents[0].letter).toBe(letter)
      expect(hitEvents[0].laneIndex).toBe(0)
    }
  })

  it('emits miss event on wrong key press', () => {
    const manager = new BattleManager(makeConfig())
    manager.update(0)
    manager.update(1100)

    const letter = manager.getLane(0).currentLetter
    const wrongKey = letter === 'a' ? 'b' : 'a'
    manager.onKeyDown(wrongKey)

    const events = manager.consumeEvents()
    const missEvents = events.filter(e => e.type === 'miss')
    expect(missEvents.length).toBe(1)
  })

  it('emits settlement event when combo completes', () => {
    // 1-segment plant → single hit triggers settlement
    const manager = new BattleManager(makeConfig())
    manager.update(0)
    manager.update(1100)

    const letter = manager.getLane(0).currentLetter
    manager.onKeyDown(letter) // hit → settlement (1 segment)

    const events = manager.consumeEvents()
    const settlements = events.filter(e => e.type === 'settlement')
    expect(settlements.length).toBe(1)
    if (settlements[0].type === 'settlement') {
      expect(settlements[0].plantCount).toBe(1)
      expect(settlements[0].totalPlants).toBe(1)
      expect(settlements[0].isFullChain).toBe(true)
    }
  })
})
```

- [ ] **Step 3: 运行测试，确认失败**

Run: `npx vitest run src/game/__tests__/BattleManager.events.test.ts`
Expected: FAIL — `consumeEvents` is not a function

- [ ] **Step 4: 在 BattleManager 中实现 Effect Queue**

在 `src/game/BattleManager.ts` 中：

1. 添加导入 `GameEvent`：
```typescript
import type { PlantConfig, PlantState, WaveConfig, ZombieConfig, Element, GameEvent } from './types'
```

2. 在 `BattleManager` 类中新增字段和方法（在 `private readonly stats` 附近添加字段，在类末尾添加方法）：
```typescript
// 字段
private readonly _events: GameEvent[] = []

// 方法
consumeEvents(): GameEvent[] {
  if (this._events.length === 0) return this._events
  const events = this._events.slice()
  this._events.length = 0
  return events
}
```

3. 在 `onKeyDown()` 中插入事件推送：

在命中处理后（`lane.hit()` 调用后、settlement 检查前），对 locked-lane 和 free-match 两个分支都加：
```typescript
// After lane.hit() succeeds:
this._events.push({
  type: 'hit',
  x: lane.plantPositions[lane.comboCount - 1] ?? lane.plantPositions[0],
  y: lane.laneY - 10,
  letter: lower,
  laneIndex: /* current lane index */,
})
```

在 miss 处理处（locked-lane 分支 else 块）：
```typescript
this._events.push({ type: 'miss', laneIndex: this.currentLaneIndex })
```

4. 在 `executeSettlement()` 中，方法末尾（在 `if (isFullChain)` 块之后）插入：
```typescript
this._events.push({
  type: 'settlement',
  x: lane.plantPositions[0],
  y: lane.laneY,
  power: result.totalPower,
  isFullChain,
  plantCount: result.aliveActivatedIndices.length,
  totalPlants: plants.length,
})
```

5. 在 `updateCollisions()` 中，`z.takeDamage(proj.power)` 之后：
```typescript
this._events.push({
  type: 'zombieHit',
  x: z.x + z.width / 2,
  y: z.y + z.height / 2,
  zombieId: z.id,
  element: proj.element,
})
```

在 `if (!z.active)` 块内：
```typescript
this._events.push({
  type: 'zombieDeath',
  x: z.x,
  y: z.y,
  width: z.width,
  height: z.height,
  color: '#44cc44', // zombie color is private, use a neutral color or we expose it
})
```

注意：ZombieEntity 的 `color` 是 private。需要给 ZombieEntity 加一个 getter：
```typescript
// ZombieEntity — add getter
get zombieColor(): string { return this.color }
```
然后 BattleManager 中用 `z.zombieColor`。

6. 在 `checkWaveCompletion()` 中，`this._currentWave++` 之后，分两种情况：
```typescript
// Victory
if (this._currentWave >= this.config.waves.length) {
  this._status = BattleStatus.Victory
  this._events.push({ type: 'waveEnd', waveIndex: this._currentWave - 1 })
} else {
  this._status = BattleStatus.WavePause
  this.wavePauseTimer = this.config.wavePauseDuration
  this._events.push({ type: 'waveEnd', waveIndex: this._currentWave - 1 })
  this._events.push({ type: 'waveStart', waveIndex: this._currentWave, totalWaves: this.config.waves.length })
}
```

- [ ] **Step 5: 运行测试，确认通过**

Run: `npx vitest run src/game/__tests__/BattleManager.events.test.ts`
Expected: PASS

- [ ] **Step 6: 运行全量测试，确认无回归**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 7: 提交**

```bash
git add src/game/types.ts src/game/BattleManager.ts src/game/ZombieEntity.ts src/game/__tests__/BattleManager.events.test.ts
git commit -m "feat(game): add GameEvent type and Effect Queue to BattleManager"
```

---

## Task 2: VfxManager + 屏幕震动

**Files:**
- Create: `src/scenes/VfxManager.ts`
- Create: `src/scenes/__tests__/VfxManager.test.ts`

- [ ] **Step 1: 写 VfxManager 测试**

```typescript
// src/scenes/__tests__/VfxManager.test.ts
import { describe, it, expect, vi } from 'vitest'
import { VfxManager } from '../VfxManager'
import type { VfxObject } from '../VfxManager'

function makeMockVfx(duration: number): VfxObject {
  let elapsed = 0
  return {
    alive: true,
    update(dt: number) {
      elapsed += dt
      if (elapsed >= duration) this.alive = false
    },
    render: vi.fn(),
    reset() {
      elapsed = 0
      this.alive = true
    },
  }
}

describe('VfxManager', () => {
  it('spawns and updates effects', () => {
    const mgr = new VfxManager()
    const fx = makeMockVfx(0.5)
    mgr.spawn(fx)
    mgr.update(0.3)
    expect(fx.alive).toBe(true)
    mgr.update(0.3)
    expect(fx.alive).toBe(false)
  })

  it('renders all alive effects', () => {
    const mgr = new VfxManager()
    const fx1 = makeMockVfx(1)
    const fx2 = makeMockVfx(1)
    mgr.spawn(fx1)
    mgr.spawn(fx2)
    const ctx = {} as CanvasRenderingContext2D
    mgr.render(ctx)
    expect(fx1.render).toHaveBeenCalledWith(ctx)
    expect(fx2.render).toHaveBeenCalledWith(ctx)
  })

  it('removes dead effects after update', () => {
    const mgr = new VfxManager()
    const fx = makeMockVfx(0.1)
    mgr.spawn(fx)
    mgr.update(0.2) // expires
    const ctx = {} as CanvasRenderingContext2D
    mgr.render(ctx)
    // render should not be called after cleanup
    expect(fx.render).not.toHaveBeenCalled()
  })

  it('acquire reuses pooled objects', () => {
    const mgr = new VfxManager()
    const factory = vi.fn(() => makeMockVfx(0.1))
    const fx1 = mgr.acquire('test', factory)
    expect(factory).toHaveBeenCalledTimes(1)
    mgr.spawn(fx1)
    mgr.update(0.2) // fx1 dies and goes to pool

    const fx2 = mgr.acquire('test', factory)
    expect(factory).toHaveBeenCalledTimes(1) // not called again
    expect(fx2).toBe(fx1) // reused
    expect(fx2.alive).toBe(true) // reset() was called
  })

  it('clear recycles all effects', () => {
    const mgr = new VfxManager()
    const fx1 = makeMockVfx(10)
    const fx2 = makeMockVfx(10)
    mgr.spawn(fx1)
    mgr.spawn(fx2)
    mgr.clear()
    const ctx = {} as CanvasRenderingContext2D
    mgr.render(ctx)
    expect(fx1.render).not.toHaveBeenCalled()
  })

  it('screen shake returns zero offset when no shake', () => {
    const mgr = new VfxManager()
    const offset = mgr.getShakeOffset()
    expect(offset.x).toBe(0)
    expect(offset.y).toBe(0)
  })

  it('screen shake returns non-zero offset during shake', () => {
    const mgr = new VfxManager()
    mgr.shake(10, 0.3)
    mgr.update(0.1)
    const offset = mgr.getShakeOffset()
    // Offset should be within [-10, 10] range
    expect(Math.abs(offset.x)).toBeLessThanOrEqual(10)
    expect(Math.abs(offset.y)).toBeLessThanOrEqual(10)
  })

  it('screen shake decays to zero after duration', () => {
    const mgr = new VfxManager()
    mgr.shake(10, 0.3)
    mgr.update(0.5) // past duration
    const offset = mgr.getShakeOffset()
    expect(offset.x).toBe(0)
    expect(offset.y).toBe(0)
  })

  it('multiple shakes take max intensity', () => {
    const mgr = new VfxManager()
    mgr.shake(3, 0.15)
    mgr.shake(8, 0.4)
    mgr.update(0.05)
    // Internal intensity should be 8 (max), but we can only observe via offset range
    const offset = mgr.getShakeOffset()
    expect(Math.abs(offset.x)).toBeLessThanOrEqual(8)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/scenes/__tests__/VfxManager.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: 实现 VfxManager**

```typescript
// src/scenes/VfxManager.ts

export interface VfxObject {
  alive: boolean
  update(dt: number): void
  render(ctx: CanvasRenderingContext2D): void
  reset(...args: unknown[]): void
}

// Pre-allocated shake offset to avoid per-frame allocation
const shakeOffset = { x: 0, y: 0 }

export class VfxManager {
  private effects: VfxObject[] = []
  private readonly pool = new Map<string, VfxObject[]>()

  // Screen shake state
  private shakeIntensity = 0
  private shakeRemaining = 0
  private shakeDuration = 0

  spawn(effect: VfxObject): void {
    this.effects.push(effect)
  }

  acquire<T extends VfxObject>(type: string, factory: () => T): T {
    const bucket = this.pool.get(type)
    if (bucket && bucket.length > 0) {
      const obj = bucket.pop()! as T
      obj.reset()
      return obj
    }
    return factory()
  }

  update(dt: number): void {
    // Update shake
    if (this.shakeRemaining > 0) {
      this.shakeRemaining -= dt
      if (this.shakeRemaining <= 0) {
        this.shakeRemaining = 0
        this.shakeIntensity = 0
        shakeOffset.x = 0
        shakeOffset.y = 0
      } else {
        const decay = this.shakeRemaining / this.shakeDuration
        const mag = this.shakeIntensity * decay
        shakeOffset.x = Math.round((Math.random() - 0.5) * 2 * mag)
        shakeOffset.y = Math.round((Math.random() - 0.5) * 2 * mag)
      }
    }

    // Update effects and recycle dead ones
    let writeIdx = 0
    for (let i = 0; i < this.effects.length; i++) {
      const fx = this.effects[i]
      fx.update(dt)
      if (fx.alive) {
        this.effects[writeIdx++] = fx
      } else {
        // Try to recycle — we don't know the type string here,
        // so pool recycling only happens via acquire flow.
        // Dead effects are simply dropped from the active list.
      }
    }
    this.effects.length = writeIdx
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < this.effects.length; i++) {
      this.effects[i].render(ctx)
    }
  }

  shake(intensity: number, duration: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity)
    this.shakeRemaining = Math.max(this.shakeRemaining, duration)
    this.shakeDuration = Math.max(this.shakeDuration, duration)
  }

  getShakeOffset(): { readonly x: number; readonly y: number } {
    return shakeOffset
  }

  clear(): void {
    this.effects.length = 0
    this.shakeRemaining = 0
    this.shakeIntensity = 0
    shakeOffset.x = 0
    shakeOffset.y = 0
  }
}
```

Note on pool recycling: the `update` loop doesn't know the type string of each effect. Instead, the pool works at `acquire` time: when a type string is requested, if the pool has one, it reuses it. When effects die during `update`, they're removed from the active list. To actually pool them, we need to track type. Adjust: add a `_poolType` field.

Update implementation — add type tracking for pool recycling:

```typescript
export interface VfxObject {
  alive: boolean
  _poolType?: string  // set by acquire() for recycling
  update(dt: number): void
  render(ctx: CanvasRenderingContext2D): void
  reset(...args: unknown[]): void
}
```

And in `update()`, recycle dead effects:
```typescript
if (fx.alive) {
  this.effects[writeIdx++] = fx
} else if (fx._poolType) {
  let bucket = this.pool.get(fx._poolType)
  if (!bucket) {
    bucket = []
    this.pool.set(fx._poolType, bucket)
  }
  bucket.push(fx)
}
```

And in `acquire()`:
```typescript
acquire<T extends VfxObject>(type: string, factory: () => T): T {
  const bucket = this.pool.get(type)
  if (bucket && bucket.length > 0) {
    const obj = bucket.pop()! as T
    obj.reset()
    return obj
  }
  const obj = factory()
  obj._poolType = type
  return obj
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/scenes/__tests__/VfxManager.test.ts`
Expected: PASS

- [ ] **Step 5: 运行全量测试**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 6: 提交**

```bash
git add src/scenes/VfxManager.ts src/scenes/__tests__/VfxManager.test.ts
git commit -m "feat(scenes): add VfxManager with object pool and screen shake"
```

---

## Task 3: VFX 效果类 — LetterPop

**Files:**
- Create: `src/scenes/vfx/LetterPop.ts`
- Create: `src/scenes/__tests__/vfx/LetterPop.test.ts`

- [ ] **Step 1: 写测试**

```typescript
// src/scenes/__tests__/vfx/LetterPop.test.ts
import { describe, it, expect } from 'vitest'
import { LetterPop } from '../../vfx/LetterPop'

describe('LetterPop', () => {
  it('starts alive', () => {
    const pop = new LetterPop()
    pop.init(100, 200, 'A', '#ffd700', 20, 0.3, 2.0)
    expect(pop.alive).toBe(true)
  })

  it('dies after duration', () => {
    const pop = new LetterPop()
    pop.init(100, 200, 'A', '#ffd700', 20, 0.3, 2.0)
    pop.update(0.4)
    expect(pop.alive).toBe(false)
  })

  it('scale increases over time', () => {
    const pop = new LetterPop()
    pop.init(100, 200, 'A', '#ffd700', 20, 0.3, 2.0)
    // At t=0, scale=1. At t=0.15 (halfway), scale should be ~1.5
    pop.update(0.15)
    // Still alive
    expect(pop.alive).toBe(true)
  })

  it('reset restores to alive state', () => {
    const pop = new LetterPop()
    pop.init(100, 200, 'A', '#ffd700', 20, 0.3, 2.0)
    pop.update(0.4) // die
    expect(pop.alive).toBe(false)
    pop.reset()
    expect(pop.alive).toBe(true)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/scenes/__tests__/vfx/LetterPop.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 LetterPop**

```typescript
// src/scenes/vfx/LetterPop.ts
import type { VfxObject } from '../VfxManager'

export class LetterPop implements VfxObject {
  alive = true
  _poolType?: string

  private x = 0
  private y = 0
  private letter = ''
  private color = '#ffd700'
  private baseSize = 20
  private duration = 0.3
  private maxScale = 2.0
  private elapsed = 0

  init(x: number, y: number, letter: string, color: string, baseSize: number, duration: number, maxScale: number): void {
    this.x = x
    this.y = y
    this.letter = letter
    this.color = color
    this.baseSize = baseSize
    this.duration = duration
    this.maxScale = maxScale
    this.elapsed = 0
    this.alive = true
  }

  reset(): void {
    this.elapsed = 0
    this.alive = true
  }

  update(dt: number): void {
    this.elapsed += dt
    if (this.elapsed >= this.duration) {
      this.alive = false
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const t = Math.min(this.elapsed / this.duration, 1)
    const scale = 1 + (this.maxScale - 1) * t
    const alpha = 1 - t
    const fontSize = Math.round(this.baseSize * scale)

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = this.color
    ctx.font = `bold ${fontSize}px monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.letter, this.x, this.y)
    ctx.restore()
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/scenes/__tests__/vfx/LetterPop.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/scenes/vfx/LetterPop.ts src/scenes/__tests__/vfx/LetterPop.test.ts
git commit -m "feat(vfx): add LetterPop effect for typing hit/miss feedback"
```

---

## Task 4: VFX 效果类 — FlashPulse

**Files:**
- Create: `src/scenes/vfx/FlashPulse.ts`
- Create: `src/scenes/__tests__/vfx/FlashPulse.test.ts`

- [ ] **Step 1: 写测试**

```typescript
// src/scenes/__tests__/vfx/FlashPulse.test.ts
import { describe, it, expect } from 'vitest'
import { FlashPulse } from '../../vfx/FlashPulse'

describe('FlashPulse', () => {
  it('starts alive', () => {
    const pulse = new FlashPulse()
    pulse.init(400, 300, 20, 80, 0.4, '#ffffff', 0.3)
    expect(pulse.alive).toBe(true)
  })

  it('dies after duration', () => {
    const pulse = new FlashPulse()
    pulse.init(400, 300, 20, 80, 0.4, '#ffffff', 0.3)
    pulse.update(0.4)
    expect(pulse.alive).toBe(false)
  })

  it('reset restores alive', () => {
    const pulse = new FlashPulse()
    pulse.init(400, 300, 20, 80, 0.4, '#ffffff', 0.3)
    pulse.update(0.4)
    pulse.reset()
    expect(pulse.alive).toBe(true)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/scenes/__tests__/vfx/FlashPulse.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 FlashPulse**

```typescript
// src/scenes/vfx/FlashPulse.ts
import type { VfxObject } from '../VfxManager'

export class FlashPulse implements VfxObject {
  alive = true
  _poolType?: string

  private x = 0
  private y = 0
  private startRadius = 20
  private endRadius = 80
  private startAlpha = 0.4
  private color = '#ffffff'
  private duration = 0.3
  private elapsed = 0

  init(x: number, y: number, startRadius: number, endRadius: number, startAlpha: number, color: string, duration: number): void {
    this.x = x
    this.y = y
    this.startRadius = startRadius
    this.endRadius = endRadius
    this.startAlpha = startAlpha
    this.color = color
    this.duration = duration
    this.elapsed = 0
    this.alive = true
  }

  reset(): void {
    this.elapsed = 0
    this.alive = true
  }

  update(dt: number): void {
    this.elapsed += dt
    if (this.elapsed >= this.duration) {
      this.alive = false
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const t = Math.min(this.elapsed / this.duration, 1)
    const radius = this.startRadius + (this.endRadius - this.startRadius) * t
    const alpha = this.startAlpha * (1 - t)

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = this.color
    ctx.beginPath()
    ctx.arc(this.x, this.y, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/scenes/__tests__/vfx/FlashPulse.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/scenes/vfx/FlashPulse.ts src/scenes/__tests__/vfx/FlashPulse.test.ts
git commit -m "feat(vfx): add FlashPulse effect for settlement burst"
```

---

## Task 5: VFX 效果类 — ParticleBurst

**Files:**
- Create: `src/scenes/vfx/ParticleBurst.ts`
- Create: `src/scenes/__tests__/vfx/ParticleBurst.test.ts`

- [ ] **Step 1: 写测试**

```typescript
// src/scenes/__tests__/vfx/ParticleBurst.test.ts
import { describe, it, expect } from 'vitest'
import { ParticleBurst } from '../../vfx/ParticleBurst'

describe('ParticleBurst', () => {
  it('starts alive with particles', () => {
    const burst = new ParticleBurst()
    burst.init(400, 300, 10, '#ffd700', 0.5)
    expect(burst.alive).toBe(true)
  })

  it('dies after duration', () => {
    const burst = new ParticleBurst()
    burst.init(400, 300, 10, '#ffd700', 0.5)
    burst.update(0.6)
    expect(burst.alive).toBe(false)
  })

  it('zero particles = immediately dead', () => {
    const burst = new ParticleBurst()
    burst.init(400, 300, 0, '#ffd700', 0.5)
    expect(burst.alive).toBe(false)
  })

  it('reset restores alive', () => {
    const burst = new ParticleBurst()
    burst.init(400, 300, 10, '#ffd700', 0.5)
    burst.update(0.6)
    burst.reset()
    expect(burst.alive).toBe(true)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/scenes/__tests__/vfx/ParticleBurst.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 ParticleBurst**

```typescript
// src/scenes/vfx/ParticleBurst.ts
import type { VfxObject } from '../VfxManager'

const MAX_PARTICLES = 30
const TWO_PI = Math.PI * 2

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  alpha: number
  size: number
}

export class ParticleBurst implements VfxObject {
  alive = true
  _poolType?: string

  private originX = 0
  private originY = 0
  private count = 0
  private color = '#ffd700'
  private duration = 0.5
  private elapsed = 0

  // Pre-allocated particle array
  private readonly particles: Particle[] = Array.from({ length: MAX_PARTICLES }, () => ({
    x: 0, y: 0, vx: 0, vy: 0, alpha: 1, size: 3,
  }))

  init(x: number, y: number, count: number, color: string, duration: number): void {
    this.originX = x
    this.originY = y
    this.count = Math.min(count, MAX_PARTICLES)
    this.color = color
    this.duration = duration
    this.elapsed = 0

    if (this.count === 0) {
      this.alive = false
      return
    }

    this.alive = true

    for (let i = 0; i < this.count; i++) {
      const angle = Math.random() * TWO_PI
      const speed = 50 + Math.random() * 100
      this.particles[i].x = x
      this.particles[i].y = y
      this.particles[i].vx = Math.cos(angle) * speed
      this.particles[i].vy = Math.sin(angle) * speed
      this.particles[i].alpha = 1
      this.particles[i].size = 2 + Math.random() * 2
    }
  }

  reset(): void {
    this.elapsed = 0
    this.alive = true
  }

  update(dt: number): void {
    this.elapsed += dt
    if (this.elapsed >= this.duration) {
      this.alive = false
      return
    }

    const t = this.elapsed / this.duration
    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i]
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.alpha = 1 - t
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.color
    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i]
      ctx.globalAlpha = p.alpha
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, TWO_PI)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/scenes/__tests__/vfx/ParticleBurst.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/scenes/vfx/ParticleBurst.ts src/scenes/__tests__/vfx/ParticleBurst.test.ts
git commit -m "feat(vfx): add ParticleBurst effect for settlement particles"
```

---

## Task 6: VFX 效果类 — DeathFlyout + FullScreenFlash

**Files:**
- Create: `src/scenes/vfx/DeathFlyout.ts`
- Create: `src/scenes/vfx/FullScreenFlash.ts`
- Create: `src/scenes/__tests__/vfx/DeathFlyout.test.ts`
- Create: `src/scenes/__tests__/vfx/FullScreenFlash.test.ts`

- [ ] **Step 1: 写 DeathFlyout 测试**

```typescript
// src/scenes/__tests__/vfx/DeathFlyout.test.ts
import { describe, it, expect } from 'vitest'
import { DeathFlyout } from '../../vfx/DeathFlyout'

describe('DeathFlyout', () => {
  it('starts alive', () => {
    const fly = new DeathFlyout()
    fly.init(100, 200, 40, 60, '#44cc44')
    expect(fly.alive).toBe(true)
  })

  it('dies after 0.5s', () => {
    const fly = new DeathFlyout()
    fly.init(100, 200, 40, 60, '#44cc44')
    fly.update(0.6)
    expect(fly.alive).toBe(false)
  })

  it('reset restores alive', () => {
    const fly = new DeathFlyout()
    fly.init(100, 200, 40, 60, '#44cc44')
    fly.update(0.6)
    fly.reset()
    expect(fly.alive).toBe(true)
  })
})
```

- [ ] **Step 2: 写 FullScreenFlash 测试**

```typescript
// src/scenes/__tests__/vfx/FullScreenFlash.test.ts
import { describe, it, expect } from 'vitest'
import { FullScreenFlash } from '../../vfx/FullScreenFlash'

describe('FullScreenFlash', () => {
  it('starts alive', () => {
    const flash = new FullScreenFlash()
    flash.init('#ffd700', 0.3, 0.15)
    expect(flash.alive).toBe(true)
  })

  it('dies after duration', () => {
    const flash = new FullScreenFlash()
    flash.init('#ffd700', 0.3, 0.15)
    flash.update(0.2)
    expect(flash.alive).toBe(false)
  })

  it('reset restores alive', () => {
    const flash = new FullScreenFlash()
    flash.init('#ffd700', 0.3, 0.15)
    flash.update(0.2)
    flash.reset()
    expect(flash.alive).toBe(true)
  })
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npx vitest run src/scenes/__tests__/vfx/`
Expected: FAIL

- [ ] **Step 4: 实现 DeathFlyout**

```typescript
// src/scenes/vfx/DeathFlyout.ts
import type { VfxObject } from '../VfxManager'

const DURATION = 0.5
const VX = 150  // px/s rightward
const VY = -100 // px/s upward
const ROTATION_SPEED = 4 // rad/s

export class DeathFlyout implements VfxObject {
  alive = true
  _poolType?: string

  private x = 0
  private y = 0
  private w = 0
  private h = 0
  private color = '#44cc44'
  private elapsed = 0
  private rotation = 0

  init(x: number, y: number, w: number, h: number, color: string): void {
    this.x = x
    this.y = y
    this.w = w
    this.h = h
    this.color = color
    this.elapsed = 0
    this.rotation = 0
    this.alive = true
  }

  reset(): void {
    this.elapsed = 0
    this.rotation = 0
    this.alive = true
  }

  update(dt: number): void {
    this.elapsed += dt
    if (this.elapsed >= DURATION) {
      this.alive = false
      return
    }
    this.x += VX * dt
    this.y += VY * dt
    this.rotation += ROTATION_SPEED * dt
  }

  render(ctx: CanvasRenderingContext2D): void {
    const t = this.elapsed / DURATION
    const alpha = 1 - t

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(this.x + this.w / 2, this.y + this.h / 2)
    ctx.rotate(this.rotation)
    ctx.fillStyle = this.color
    ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h)
    ctx.restore()
  }
}
```

- [ ] **Step 5: 实现 FullScreenFlash**

```typescript
// src/scenes/vfx/FullScreenFlash.ts
import type { VfxObject } from '../VfxManager'

export class FullScreenFlash implements VfxObject {
  alive = true
  _poolType?: string

  private color = '#ffd700'
  private startAlpha = 0.3
  private duration = 0.15
  private elapsed = 0

  init(color: string, startAlpha: number, duration: number): void {
    this.color = color
    this.startAlpha = startAlpha
    this.duration = duration
    this.elapsed = 0
    this.alive = true
  }

  reset(): void {
    this.elapsed = 0
    this.alive = true
  }

  update(dt: number): void {
    this.elapsed += dt
    if (this.elapsed >= this.duration) {
      this.alive = false
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const t = Math.min(this.elapsed / this.duration, 1)
    const alpha = this.startAlpha * (1 - t)

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = this.color
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.restore()
  }
}
```

- [ ] **Step 6: 运行测试确认通过**

Run: `npx vitest run src/scenes/__tests__/vfx/`
Expected: All PASS

- [ ] **Step 7: 提交**

```bash
git add src/scenes/vfx/DeathFlyout.ts src/scenes/vfx/FullScreenFlash.ts src/scenes/__tests__/vfx/
git commit -m "feat(vfx): add DeathFlyout and FullScreenFlash effects"
```

---

## Task 7: BattleScene 集成 P0 — VfxManager + 事件消费

**Files:**
- Modify: `src/scenes/BattleScene.ts`
- Modify: `src/game/PlantEntity.ts`
- Modify: `src/game/ZombieEntity.ts`

这是 P0 的核心集成步骤，将 Effect Queue、VfxManager、所有效果类串起来。

- [ ] **Step 1: PlantEntity 新增 bounceTimer**

在 `src/game/PlantEntity.ts` 中：

1. 新增字段：
```typescript
// After isCurrentTarget field
bounceTimer = 0
```

2. 实现 update 中的 timer 递减：
```typescript
update(dt: number): void {
  if (this.bounceTimer > 0) {
    this.bounceTimer -= dt
    if (this.bounceTimer < 0) this.bounceTimer = 0
  }
}
```

3. 在 render() 中植物绘制前添加 bounce 偏移：
```typescript
// At the start of render(), after alive/hpRatio calculation:
const bounceOffsetY = this.bounceTimer > 0
  ? -6 * Math.sin(this.bounceTimer / 0.15 * Math.PI)
  : 0
```

在所有使用 `this.y` 的绘制调用中，改为 `this.y + bounceOffsetY`。影响的行：
- `ctx.fillRect(this.x, this.y + bounceOffsetY, this.width, this.height)` — 植物色块
- `ctx.strokeRect(this.x - 2, this.y + bounceOffsetY - 2, ...)` — 高亮边框
- `const barY = this.y + bounceOffsetY + this.height + 4` — 血条
- `ctx.fillText(name, ..., this.y + bounceOffsetY + this.height / 2 + 5)` — 名称
- `const ly = this.y + bounceOffsetY - 10` — 字母

- [ ] **Step 2: ZombieEntity 新增 flashTimer**

在 `src/game/ZombieEntity.ts` 中：

1. 新增字段（在 `private _statusCount` 附近）：
```typescript
flashTimer = 0
```

2. 在 update() 方法开头，Dead 检查之后：
```typescript
if (this.flashTimer > 0) {
  this.flashTimer -= dtSeconds
  if (this.flashTimer < 0) this.flashTimer = 0
}
```

3. 在 render() 中，修改 fillStyle 选择：
```typescript
render(ctx: CanvasRenderingContext2D): void {
  if (this.flashTimer > 0) {
    ctx.fillStyle = '#ffffff'
  } else {
    ctx.fillStyle = this._state === ZombieState.Chewing ? '#ff6600' : this.color
  }
  // ... rest unchanged
}
```

- [ ] **Step 3: BattleScene 集成 VfxManager 和事件消费**

在 `src/scenes/BattleScene.ts` 中：

1. 添加导入：
```typescript
import { VfxManager } from './VfxManager'
import { LetterPop } from './vfx/LetterPop'
import { FlashPulse } from './vfx/FlashPulse'
import { ParticleBurst } from './vfx/ParticleBurst'
import { DeathFlyout } from './vfx/DeathFlyout'
import { FullScreenFlash } from './vfx/FullScreenFlash'
import type { GameEvent } from '../game/types'
```

2. 新增字段：
```typescript
private vfxManager = new VfxManager()
```

3. 在 `enter()` 末尾：
```typescript
this.vfxManager.clear()
```

4. 在 `exit()` 中：
```typescript
this.vfxManager.clear()
```

5. 在 `update()` 中，`this.manager.update(dt)` 之后、状态同步循环之前，插入事件消费：
```typescript
// Consume game events and spawn VFX
const events = this.manager.consumeEvents()
for (let i = 0; i < events.length; i++) {
  this.processGameEvent(events[i])
}
this.vfxManager.update(dt)
```

6. 新增 `processGameEvent()` 方法：
```typescript
private processGameEvent(event: GameEvent): void {
  switch (event.type) {
    case 'hit': {
      // Letter pop effect
      const pop = this.vfxManager.acquire('letterPop', () => new LetterPop())
      pop.init(event.x, event.y, event.letter.toUpperCase(), '#ffd700', 20, 0.3, 2.0)
      this.vfxManager.spawn(pop)
      // Plant bounce — find current target plant
      const laneEnts = this.laneEntities[event.laneIndex]
      if (laneEnts) {
        for (let j = 0; j < laneEnts.length; j++) {
          if (laneEnts[j].isCurrentTarget) {
            laneEnts[j].bounceTimer = 0.15
            break
          }
        }
      }
      break
    }

    case 'miss': {
      this.vfxManager.shake(3, 0.15)
      // Red letter flash at current lane's target position
      if (this.manager) {
        const lane = this.manager.getLane(event.laneIndex)
        if (!lane.isEmpty) {
          const flash = this.vfxManager.acquire('letterPop', () => new LetterPop())
          flash.init(
            lane.plantPositions[0], lane.laneY - 10,
            lane.currentLetter.toUpperCase(), '#ff4444',
            20, 0.2, 1.0,
          )
          this.vfxManager.spawn(flash)
        }
      }
      break
    }

    case 'settlement': {
      const intensity = event.totalPlants > 0 ? event.plantCount / event.totalPlants : 0
      // Flash pulse
      const pulse = this.vfxManager.acquire('flashPulse', () => new FlashPulse())
      const startR = 20 + 100 * intensity * 0.0 // lerp(20,20) start
      const endR = 40 + 80 * intensity
      const pulseAlpha = 0.2 + 0.3 * intensity
      // Color: white → warm yellow → gold based on intensity
      const r = Math.round(255)
      const g = Math.round(255 - 40 * intensity)
      const b = Math.round(255 - 255 * intensity)
      const pulseColor = `rgb(${r},${g},${b})`
      pulse.init(event.x, event.y, 20, endR, pulseAlpha, pulseColor, 0.3)
      this.vfxManager.spawn(pulse)

      // Screen shake (not for single plant)
      if (event.plantCount > 1) {
        const shakeIntensity = 2 + 6 * intensity
        const shakeDuration = 0.15 + 0.25 * intensity
        this.vfxManager.shake(shakeIntensity, shakeDuration)
      }

      // Particle burst
      const particleCount = Math.floor(30 * intensity)
      if (particleCount > 0) {
        const burst = this.vfxManager.acquire('particleBurst', () => new ParticleBurst())
        const burstR = Math.round(255)
        const burstG = Math.round(215 + 40 * (1 - intensity))
        const burstB = Math.round(255 * (1 - intensity))
        burst.init(event.x, event.y, particleCount, `rgb(${burstR},${burstG},${burstB})`, 0.5)
        this.vfxManager.spawn(burst)
      }

      // Full chain: extra full-screen flash
      if (event.isFullChain) {
        const flash = this.vfxManager.acquire('fullScreenFlash', () => new FullScreenFlash())
        flash.init('#ffd700', 0.3, 0.15)
        this.vfxManager.spawn(flash)
      }
      break
    }

    case 'zombieHit': {
      // Set flash timer on zombie entity
      if (this.manager) {
        const zombies = this.manager.getEntityManager().getByTag('zombie')
        for (let j = 0; j < zombies.length; j++) {
          if (zombies[j].id === event.zombieId) {
            (zombies[j] as import('../game/ZombieEntity').ZombieEntity).flashTimer = 0.1
            break
          }
        }
      }
      break
    }

    case 'zombieDeath': {
      const flyout = this.vfxManager.acquire('deathFlyout', () => new DeathFlyout())
      flyout.init(event.x, event.y, event.width, event.height, event.color)
      this.vfxManager.spawn(flyout)
      break
    }

    case 'waveStart':
    case 'waveEnd':
      // Visual feedback for waves will be added in P2 (6.3.13)
      break
  }
}
```

7. 在 `render()` 中集成震屏和效果绘制：

在 render() 开头，背景绘制之前：
```typescript
const shake = this.vfxManager.getShakeOffset()
ctx.save()
ctx.translate(shake.x, shake.y)
```

在 render() 中所有场景内容绘制完（HUD 之后、虚拟键盘之前），恢复 shake 并绘制 VFX：
```typescript
ctx.restore() // end shake translate
this.vfxManager.render(ctx)
```

虚拟键盘和暂停覆盖层在 `ctx.restore()` 之后绘制，不受震屏影响。

- [ ] **Step 4: 运行全量测试**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 5: 启动 dev server 在浏览器中验证**

Run: `npm run dev`

验证项：
- 打字命中：金色字母弹出放大消散 + 植物微跳
- 打字错误：屏幕微震 + 红色字母闪烁
- 连击结算（1 棵植物）：小闪光脉冲，无震屏
- 连击结算（多棵植物）：大闪光 + 震屏 + 粒子
- 满链大招：全屏金色闪光 + 强震
- 僵尸受击：闪白 0.1s
- 僵尸死亡：残影击飞淡出

- [ ] **Step 6: 提交**

```bash
git add src/game/PlantEntity.ts src/game/ZombieEntity.ts src/scenes/BattleScene.ts
git commit -m "feat(scenes): integrate VfxManager with P0 hit feedback effects"
```

---

## Task 8: 草坪网格背景（P1 6.3.6）

**Files:**
- Create: `src/scenes/renderers/BattlefieldRenderer.ts`
- Modify: `src/scenes/BattleScene.ts`

- [ ] **Step 1: 实现 BattlefieldRenderer**

```typescript
// src/scenes/renderers/BattlefieldRenderer.ts

const GRASS_LIGHT = '#3d6b2e'
const GRASS_DARK = '#2d5a1e'
const PLANT_ZONE = '#1e4a15'
const DIRT_COLOR = '#8B6914'
const DIRT_EDGE = '#5a4510'

export function drawBattlefield(
  ctx: CanvasRenderingContext2D,
  width: number, height: number,
  plantZoneWidth: number,
  laneYPositions: number[],
  laneHeight: number,
): void {
  // Grass checkerboard
  const cellW = 60
  const cols = Math.ceil(width / cellW)
  const rows = Math.ceil(height / laneHeight)

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? GRASS_LIGHT : GRASS_DARK
      ctx.fillRect(col * cellW, row * laneHeight, cellW, laneHeight)
    }
  }

  // Plant zone darker overlay
  ctx.fillStyle = PLANT_ZONE
  ctx.fillRect(0, 0, plantZoneWidth, height)

  // Dirt divider at plant zone edge
  const dirtX = plantZoneWidth - 4
  ctx.fillStyle = DIRT_EDGE
  ctx.fillRect(dirtX - 1, 0, 1, height)
  ctx.fillStyle = DIRT_COLOR
  ctx.fillRect(dirtX, 0, 8, height)
  ctx.fillStyle = DIRT_EDGE
  ctx.fillRect(dirtX + 8, 0, 1, height)
}
```

- [ ] **Step 2: BattleScene 替换背景绘制**

在 `src/scenes/BattleScene.ts` 中：

1. 添加导入：
```typescript
import { drawBattlefield } from './renderers/BattlefieldRenderer'
```

2. 在 render() 中，将：
```typescript
ctx.fillStyle = '#2d5a1e'
ctx.fillRect(0, 0, w, h)
```
替换为：
```typescript
const laneYs: number[] = []
if (this.manager) {
  for (let i = 0; i < this.manager.laneCount; i++) {
    laneYs.push(this.manager.getLane(i).laneY)
  }
}
drawBattlefield(ctx, w, this.gameAreaHeight, w * 0.35, laneYs, 80)
```

- [ ] **Step 3: 运行全量测试**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 4: 浏览器验证**

Run: `npm run dev`
验证：草坪格子可见、植物阵地区域偏深、泥土分隔带可见

- [ ] **Step 5: 提交**

```bash
git add src/scenes/renderers/BattlefieldRenderer.ts src/scenes/BattleScene.ts
git commit -m "feat(renderers): add checkerboard grass battlefield background"
```

---

## Task 9: PlantRenderer 简笔画（P1 6.3.7）

**Files:**
- Create: `src/scenes/renderers/PlantRenderer.ts`
- Modify: `src/game/PlantEntity.ts`

- [ ] **Step 1: 实现 PlantRenderer**

```typescript
// src/scenes/renderers/PlantRenderer.ts

const DEAD_TINT = '#666666'

export function drawPlant(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color: string, alive: boolean,
  bounceOffsetY: number,
): void {
  const cy = y + bounceOffsetY
  const fillColor = alive ? color : DEAD_TINT
  const alpha = alive ? 1.0 : 0.3

  ctx.save()
  ctx.globalAlpha = alpha

  // Stem
  const stemW = w * 0.15
  const stemH = h * 0.45
  const stemX = x + (w - stemW) / 2
  const stemY = cy + h * 0.55
  ctx.fillStyle = alive ? '#2d8a2d' : '#555555'
  ctx.fillRect(stemX, stemY, stemW, stemH)

  // Leaves (two arcs from stem midpoint)
  const leafMidY = stemY + stemH * 0.4
  ctx.fillStyle = alive ? '#3aaf3a' : '#555555'

  // Left leaf
  ctx.beginPath()
  ctx.ellipse(stemX - w * 0.12, leafMidY, w * 0.15, h * 0.08, -0.3, 0, Math.PI * 2)
  ctx.fill()

  // Right leaf
  ctx.beginPath()
  ctx.ellipse(stemX + stemW + w * 0.12, leafMidY, w * 0.15, h * 0.08, 0.3, 0, Math.PI * 2)
  ctx.fill()

  // Head (large ellipse)
  const headW = w * 0.7
  const headH = h * 0.5
  const headCX = x + w / 2
  const headCY = cy + h * 0.3

  ctx.fillStyle = fillColor
  ctx.beginPath()
  ctx.ellipse(headCX, headCY, headW / 2, headH / 2, 0, 0, Math.PI * 2)
  ctx.fill()

  // Head outline
  ctx.strokeStyle = alive ? '#00000033' : '#00000011'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.ellipse(headCX, headCY, headW / 2, headH / 2, 0, 0, Math.PI * 2)
  ctx.stroke()

  // Eyes
  const eyeSpacing = headW * 0.22
  const eyeY = headCY - headH * 0.08
  const eyeRadius = Math.max(2, headW * 0.09)
  const pupilRadius = eyeRadius * 0.5

  if (alive) {
    // White sclera
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(headCX - eyeSpacing, eyeY, eyeRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(headCX + eyeSpacing, eyeY, eyeRadius, 0, Math.PI * 2)
    ctx.fill()

    // Black pupils
    ctx.fillStyle = '#000000'
    ctx.beginPath()
    ctx.arc(headCX - eyeSpacing + 1, eyeY, pupilRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(headCX + eyeSpacing + 1, eyeY, pupilRadius, 0, Math.PI * 2)
    ctx.fill()
  } else {
    // Dead eyes: X marks
    ctx.strokeStyle = '#333333'
    ctx.lineWidth = 1.5
    const xSize = eyeRadius * 0.7
    for (const ex of [headCX - eyeSpacing, headCX + eyeSpacing]) {
      ctx.beginPath()
      ctx.moveTo(ex - xSize, eyeY - xSize)
      ctx.lineTo(ex + xSize, eyeY + xSize)
      ctx.moveTo(ex + xSize, eyeY - xSize)
      ctx.lineTo(ex - xSize, eyeY + xSize)
      ctx.stroke()
    }
  }

  // Mouth
  const mouthY = headCY + headH * 0.15
  ctx.strokeStyle = alive ? '#000000' : '#333333'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  if (alive) {
    // Happy smile arc
    ctx.arc(headCX, mouthY, headW * 0.12, 0.1, Math.PI - 0.1)
  } else {
    // Sad frown
    ctx.arc(headCX, mouthY + headH * 0.1, headW * 0.1, Math.PI + 0.2, -0.2)
  }
  ctx.stroke()

  ctx.restore()
}
```

- [ ] **Step 2: PlantEntity.render() 委托给 PlantRenderer**

在 `src/game/PlantEntity.ts` 中：

1. 添加导入：
```typescript
import { drawPlant } from '../scenes/renderers/PlantRenderer'
```

注意：这里 game 层导入了 scenes 层。但 PlantEntity.render() 本身就是渲染方法，直接操作 Canvas 上下文，等同于渲染层代码。导入纯渲染函数不违反架构意图。

2. 替换 render() 中植物色块、高亮边框、血条、名称的绘制部分（保留字母序列绘制不变）：

```typescript
render(ctx: CanvasRenderingContext2D): void {
  const alive = this.plantState?.alive ?? true
  const hpRatio = this.plantState
    ? this.plantState.currentHp / this.plantState.config.hp
    : 1
  const bounceOffsetY = this.bounceTimer > 0
    ? -6 * Math.sin(this.bounceTimer / 0.15 * Math.PI)
    : 0
  const baseColor = PLANT_COLORS[this.plantIndex % PLANT_COLORS.length]

  // Draw plant body
  drawPlant(ctx, this.x, this.y, this.width, this.height, baseColor, alive, bounceOffsetY)

  // Current target highlight border
  if (this.isCurrentTarget && alive) {
    ctx.strokeStyle = '#ffd700'
    ctx.lineWidth = 3
    ctx.strokeRect(this.x - 2, this.y + bounceOffsetY - 2, this.width + 4, this.height + 4)
  }

  // HP bar (when damaged)
  if (alive && hpRatio < 1) {
    const barHeight = 4
    const barY = this.y + bounceOffsetY + this.height + 4
    ctx.fillStyle = '#333'
    ctx.fillRect(this.x, barY, this.width, barHeight)
    ctx.fillStyle = '#22cc22'
    ctx.fillRect(this.x, barY, this.width * hpRatio, barHeight)
  }

  // Plant name
  ctx.globalAlpha = alive ? 1.0 : 0.3
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 12px sans-serif'
  ctx.textAlign = 'center'
  const name = this.plantState?.config.name ?? ''
  ctx.fillText(name, this.x + this.width / 2, this.y + bounceOffsetY + this.height / 2 + 5)
  ctx.globalAlpha = 1.0

  // Letter sequence (above plant) — same logic as before but with bounceOffsetY
  if (this.letters.length > 0) {
    const fontSize = Math.min(20, Math.max(14, Math.floor(this.width / this.letters.length * 0.8)))
    ctx.font = `bold ${fontSize}px monospace`
    ctx.textAlign = 'center'
    const totalLetterWidth = this.letters.length * (fontSize * 0.7)
    const startX = this.x + (this.width - totalLetterWidth) / 2 + fontSize * 0.35

    for (let i = 0; i < this.letters.length; i++) {
      const lx = startX + i * (fontSize * 0.7)
      const ly = this.y + bounceOffsetY - 10

      if (i < this.typedCount) {
        ctx.fillStyle = alive ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'
      } else if (i === this.typedCount && this.isCurrentTarget) {
        ctx.fillStyle = '#ffd700'
      } else {
        ctx.fillStyle = alive ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.3)'
      }
      ctx.fillText(this.letters[i].toUpperCase(), lx, ly)
    }
  }
}
```

- [ ] **Step 3: 运行全量测试**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 4: 浏览器验证**

Run: `npm run dev`
验证：植物显示为卡通简笔画（椭圆头+茎干+叶片+眼睛+嘴巴），死亡植物灰色+X 眼

- [ ] **Step 5: 提交**

```bash
git add src/scenes/renderers/PlantRenderer.ts src/game/PlantEntity.ts
git commit -m "feat(renderers): cartoon plant rendering with face and bounce animation"
```

---

## Task 10: ZombieRenderer 简笔画 + 行走动画（P1 6.3.8 + 6.3.10）

**Files:**
- Create: `src/scenes/renderers/ZombieRenderer.ts`
- Modify: `src/game/ZombieEntity.ts`

- [ ] **Step 1: ZombieEntity 新增 walkPhase + 暴露状态查询**

在 `src/game/ZombieEntity.ts` 中：

1. 新增字段：
```typescript
walkPhase = 0
```

2. 新增 getter（用于 ZombieRenderer）：
```typescript
get zombieColor(): string { return this.color }
get statuses(): readonly ZombieStatus[] { return this._statuses }
get statusCount(): number { return this._statusCount }
```

注意：`zombieColor` getter 已在 Task 1 中添加（为了 zombieDeath 事件）。如果还没加，在这里加。

3. 在 update() 中，Dead 检查之后、status timer 处理之前，累加 walkPhase：
```typescript
// 在 update() 中，"const dtSeconds = dt / 1000" 之后：
this.walkPhase += dtSeconds * 6
```

- [ ] **Step 2: 实现 ZombieRenderer**

```typescript
// src/scenes/renderers/ZombieRenderer.ts
import { ZombieState } from '../../game/types'
import type { ZombieStatus } from '../../game/types'

const TWO_PI = Math.PI * 2

export function drawZombie(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  type: string, color: string,
  options: {
    flashTimer: number
    walkPhase: number
    state: ZombieState
    statuses: readonly ZombieStatus[]
    statusCount: number
  },
): void {
  const { flashTimer, walkPhase, state, statuses, statusCount } = options
  const isFlash = flashTimer > 0
  const bodyColor = isFlash ? '#ffffff' : color

  // Walk animation offsets
  const isWalking = state === ZombieState.Walking
  const isChewing = state === ZombieState.Chewing
  const legAngle = isWalking ? Math.sin(walkPhase) * 0.3 : 0
  const bodyBob = isWalking ? Math.sin(walkPhase * 2) * 1.5 : 0
  const chewShake = isChewing ? Math.sin(walkPhase * 12) * 2 : 0
  const armAngle = isWalking ? Math.sin(walkPhase + 0.5) * 0.15 : 0

  const cx = x + w / 2 + chewShake
  const bodyY = y + bodyBob

  ctx.save()

  // Legs (two rectangles from body bottom, alternating angles)
  const legW = w * 0.18
  const legH = h * 0.3
  const legY = bodyY + h * 0.65

  ctx.fillStyle = isFlash ? '#ffffff' : '#556655'
  // Left leg
  ctx.save()
  ctx.translate(cx - w * 0.15, legY)
  ctx.rotate(legAngle)
  ctx.fillRect(-legW / 2, 0, legW, legH)
  ctx.restore()
  // Right leg
  ctx.save()
  ctx.translate(cx + w * 0.15, legY)
  ctx.rotate(-legAngle)
  ctx.fillRect(-legW / 2, 0, legW, legH)
  ctx.restore()

  // Body (rectangle)
  const bodyW = w * 0.7
  const bodyH = h * 0.4
  const bodyX = cx - bodyW / 2
  const bodyTop = bodyY + h * 0.25
  ctx.fillStyle = bodyColor
  ctx.fillRect(bodyX, bodyTop, bodyW, bodyH)

  // Arms (two lines extending forward, zombie pose)
  ctx.strokeStyle = isFlash ? '#ffffff' : '#667766'
  ctx.lineWidth = Math.max(2, w * 0.08)
  ctx.lineCap = 'round'
  const armStartY = bodyTop + bodyH * 0.2
  const armLen = w * 0.5
  // Left arm
  ctx.save()
  ctx.translate(cx - bodyW * 0.35, armStartY)
  ctx.rotate(-0.3 + armAngle)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(armLen, 0)
  ctx.stroke()
  ctx.restore()
  // Right arm
  ctx.save()
  ctx.translate(cx - bodyW * 0.35, armStartY + bodyH * 0.3)
  ctx.rotate(-0.15 - armAngle)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(armLen * 0.9, 0)
  ctx.stroke()
  ctx.restore()

  // Head (circle)
  const headR = w * 0.35
  const headCY = bodyY + h * 0.2
  ctx.fillStyle = isFlash ? '#ffffff' : '#8fbc8f'
  ctx.beginPath()
  ctx.arc(cx, headCY, headR, 0, TWO_PI)
  ctx.fill()

  // Eyes (small circles)
  if (!isFlash) {
    const eyeY = headCY - headR * 0.1
    const eyeSpacing = headR * 0.4
    const eyeR = headR * 0.18
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(cx - eyeSpacing, eyeY, eyeR, 0, TWO_PI)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx + eyeSpacing, eyeY, eyeR, 0, TWO_PI)
    ctx.fill()
    // Pupils
    ctx.fillStyle = '#cc0000'
    const pupilR = eyeR * 0.6
    ctx.beginPath()
    ctx.arc(cx - eyeSpacing, eyeY, pupilR, 0, TWO_PI)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx + eyeSpacing, eyeY, pupilR, 0, TWO_PI)
    ctx.fill()
  }

  // Type-specific decorations
  switch (type) {
    case 'conehead': {
      // Orange traffic cone on head
      const coneH = headR * 0.8
      const coneBottom = headR * 0.5
      const coneTop = headR * 0.15
      ctx.fillStyle = isFlash ? '#ffffff' : '#ee8833'
      ctx.beginPath()
      ctx.moveTo(cx - coneBottom, headCY - headR * 0.6)
      ctx.lineTo(cx - coneTop, headCY - headR * 0.6 - coneH)
      ctx.lineTo(cx + coneTop, headCY - headR * 0.6 - coneH)
      ctx.lineTo(cx + coneBottom, headCY - headR * 0.6)
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'flag': {
      // Red flag on a stick
      const flagX = cx + headR * 0.3
      const flagY = headCY - headR
      ctx.strokeStyle = isFlash ? '#ffffff' : '#884422'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(flagX, flagY)
      ctx.lineTo(flagX, flagY - headR)
      ctx.stroke()
      ctx.fillStyle = isFlash ? '#ffffff' : '#cc4444'
      ctx.beginPath()
      ctx.moveTo(flagX, flagY - headR)
      ctx.lineTo(flagX + headR * 0.6, flagY - headR * 0.7)
      ctx.lineTo(flagX, flagY - headR * 0.4)
      ctx.closePath()
      ctx.fill()
      break
    }
    // fat and imp don't need decorations — distinguished by size
  }

  // Status effect visuals
  for (let i = 0; i < statusCount; i++) {
    const s = statuses[i]
    switch (s.type) {
      case 'slow': {
        // Blue overlay on body
        ctx.fillStyle = 'rgba(135, 206, 235, 0.3)'
        ctx.fillRect(bodyX, bodyTop, bodyW, bodyH)
        break
      }
      case 'burn': {
        // Small flames around body
        ctx.fillStyle = 'rgba(255, 100, 0, 0.7)'
        const flameOffset = Math.sin(walkPhase * 8) * 3
        for (let f = 0; f < 3; f++) {
          const fx = bodyX + bodyW * (0.2 + f * 0.3) + flameOffset * (f % 2 === 0 ? 1 : -1)
          const fy = bodyTop - 4
          ctx.beginPath()
          ctx.moveTo(fx, fy)
          ctx.quadraticCurveTo(fx + 4, fy - 10, fx + 2, fy - 14)
          ctx.quadraticCurveTo(fx - 2, fy - 8, fx, fy)
          ctx.fill()
        }
        break
      }
      case 'stun': {
        // Spinning stars above head
        ctx.fillStyle = '#f1c40f'
        const starY = headCY - headR - 10
        for (let s2 = 0; s2 < 3; s2++) {
          const angle = walkPhase * 3 + s2 * (TWO_PI / 3)
          const sx = cx + Math.cos(angle) * headR * 0.6
          const sy = starY + Math.sin(angle) * 4
          drawStar(ctx, sx, sy, 3)
        }
        break
      }
    }
  }

  ctx.restore()
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + i * (TWO_PI / 5)
    const innerAngle = angle + TWO_PI / 10
    ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r)
    ctx.lineTo(cx + Math.cos(innerAngle) * r * 0.4, cy + Math.sin(innerAngle) * r * 0.4)
  }
  ctx.closePath()
  ctx.fill()
}
```

- [ ] **Step 3: ZombieEntity.render() 委托给 ZombieRenderer**

```typescript
// ZombieEntity.ts — replace render() method
render(ctx: CanvasRenderingContext2D): void {
  drawZombie(ctx, this.x, this.y, this.width, this.height,
    this._type, this.color, {
      flashTimer: this.flashTimer,
      walkPhase: this.walkPhase,
      state: this._state,
      statuses: this._statuses,
      statusCount: this._statusCount,
    })
  // HP bar
  const barWidth = this.width
  const barHeight = 4
  const barY = this.y - 8
  const hpRatio = this._currentHp / this.maxHp
  ctx.fillStyle = '#333'
  ctx.fillRect(this.x, barY, barWidth, barHeight)
  ctx.fillStyle = '#ff3333'
  ctx.fillRect(this.x, barY, barWidth * hpRatio, barHeight)
}
```

注意：ZombieEntity 需要保存 zombie type。目前构造参数 `ZombieSpawnParams` 没有 type 字段。需要新增：

```typescript
// ZombieSpawnParams — add type field
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
  type?: string  // zombie type for rendering
}
```

在构造函数中存储：
```typescript
private readonly _type: string
// In constructor:
this._type = params.type ?? 'normal'
```

同时在 BattleManager 的 `spawnZombie()` 方法（约 line 261）中传入 type：
```typescript
const zombie = new ZombieEntity({
  id,
  x: spawnX,
  y: lane.laneY,
  hp: zombieConfig.hp,
  speed: zombieConfig.speed,
  chewDps: zombieConfig.chewDps,
  width: zombieConfig.width,
  height: zombieConfig.height,
  color: zombieConfig.color,
  type: zombieType,  // 新增：传入僵尸类型用于渲染
})
```

添加导入：
```typescript
import { drawZombie } from '../scenes/renderers/ZombieRenderer'
```

- [ ] **Step 4: 运行全量测试**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 5: 浏览器验证**

Run: `npm run dev`
验证：
- 僵尸显示为卡通形态（圆头+身体+腿+手臂）
- 路障僵尸头顶有橙色路障
- 旗手僵尸手持红旗
- 行走时腿交替摆动、身体微微上下浮动
- 啃食时身体前后抖动
- slow 状态有蓝色覆盖层
- burn 状态有火焰
- stun 状态有旋转星星

- [ ] **Step 6: 提交**

```bash
git add src/scenes/renderers/ZombieRenderer.ts src/game/ZombieEntity.ts src/game/BattleManager.ts
git commit -m "feat(renderers): cartoon zombie rendering with walk animation and status effects"
```

---

## Task 11: ProjectileRenderer 弹道特效（P1 6.3.9）

**Files:**
- Create: `src/scenes/renderers/ProjectileRenderer.ts`
- Modify: `src/game/ProjectileEntity.ts`

- [ ] **Step 1: ProjectileEntity 新增 trailPositions + rotation**

在 `src/game/ProjectileEntity.ts` 中：

1. 新增常量和字段：
```typescript
const MAX_TRAIL = 4

// In class:
private readonly trailPositions: Array<{ x: number; y: number; alpha: number }> = Array.from(
  { length: MAX_TRAIL },
  () => ({ x: 0, y: 0, alpha: 0 }),
)
private trailIndex = 0
private trailCount = 0
private rotation = 0
```

2. 在 update() 方法中，移动计算之后、bounds check 之前，记录 trail 和更新 rotation：
```typescript
// Record trail position (after movement, before bounds check)
if (this.element !== 'normal') {
  const slot = this.trailPositions[this.trailIndex % MAX_TRAIL]
  slot.x = this.x
  slot.y = this.y
  slot.alpha = 1
  this.trailIndex++
  if (this.trailCount < MAX_TRAIL) this.trailCount++
}
this.rotation += dt / 1000 * 8 // 8 rad/s rotation for star/diamond shapes
```

3. 新增 getter：
```typescript
get trail(): readonly { x: number; y: number; alpha: number }[] {
  return this.trailPositions
}
get trailLen(): number { return this.trailCount }
get trailIdx(): number { return this.trailIndex }
get currentRotation(): number { return this.rotation }
```

- [ ] **Step 2: 实现 ProjectileRenderer**

```typescript
// src/scenes/renderers/ProjectileRenderer.ts
import type { Element } from '../../game/types'

const TWO_PI = Math.PI * 2

const ELEMENT_COLORS: Record<Element, string> = {
  normal: '#ffd700',
  ice: '#87ceeb',
  fire: '#ff6347',
  electric: '#9b59b6',
  stun: '#f1c40f',
  knockback: '#e67e22',
}

export function drawProjectile(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  element: Element,
  trail: readonly { x: number; y: number; alpha: number }[],
  trailCount: number,
  trailIndex: number,
  rotation: number,
): void {
  const color = ELEMENT_COLORS[element]
  const cx = x + w / 2
  const cy = y + h / 2

  // Draw trail first (behind projectile)
  if (trailCount > 0 && element !== 'normal') {
    for (let i = 0; i < trailCount; i++) {
      const idx = ((trailIndex - trailCount + i) % trailCount + trailCount) % trailCount
      const t = trail[idx]
      const age = (trailCount - i) / trailCount
      ctx.globalAlpha = 0.5 * (1 - age)
      ctx.fillStyle = color
      const trailSize = (w / 2) * (1 - age * 0.5)
      ctx.beginPath()
      ctx.arc(t.x + w / 2, t.y + h / 2, trailSize, 0, TWO_PI)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  // Draw projectile body by element type
  ctx.fillStyle = color
  switch (element) {
    case 'normal': {
      ctx.beginPath()
      ctx.arc(cx, cy, w / 2, 0, TWO_PI)
      ctx.fill()
      break
    }

    case 'ice': {
      // Diamond shape (rotated square)
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(Math.PI / 4)
      ctx.fillRect(-w * 0.35, -h * 0.35, w * 0.7, h * 0.7)
      ctx.restore()
      break
    }

    case 'fire': {
      // Circle with flame tip
      ctx.beginPath()
      ctx.arc(cx, cy, w / 2, 0, TWO_PI)
      ctx.fill()
      // Flame on top
      ctx.fillStyle = '#ff4500'
      ctx.beginPath()
      ctx.moveTo(cx - w * 0.3, cy - h * 0.2)
      ctx.quadraticCurveTo(cx, cy - h, cx + w * 0.1, cy - h * 0.3)
      ctx.quadraticCurveTo(cx + w * 0.2, cy - h * 0.8, cx + w * 0.3, cy - h * 0.2)
      ctx.closePath()
      ctx.fill()
      break
    }

    case 'electric': {
      // Small circle with lightning bolts
      ctx.beginPath()
      ctx.arc(cx, cy, w * 0.3, 0, TWO_PI)
      ctx.fill()
      // 2-3 short zigzag lines
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      for (let i = 0; i < 3; i++) {
        const angle = rotation + i * (TWO_PI / 3)
        const dx = Math.cos(angle)
        const dy = Math.sin(angle)
        const len = w * 0.6
        ctx.beginPath()
        ctx.moveTo(cx + dx * w * 0.3, cy + dy * w * 0.3)
        ctx.lineTo(cx + dx * len * 0.5 + (Math.random() - 0.5) * 4, cy + dy * len * 0.5 + (Math.random() - 0.5) * 4)
        ctx.lineTo(cx + dx * len, cy + dy * len)
        ctx.stroke()
      }
      break
    }

    case 'stun': {
      // Star shape
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(rotation)
      ctx.beginPath()
      for (let i = 0; i < 5; i++) {
        const outerAngle = -Math.PI / 2 + i * (TWO_PI / 5)
        const innerAngle = outerAngle + TWO_PI / 10
        ctx.lineTo(Math.cos(outerAngle) * w * 0.5, Math.sin(outerAngle) * h * 0.5)
        ctx.lineTo(Math.cos(innerAngle) * w * 0.2, Math.sin(innerAngle) * h * 0.2)
      }
      ctx.closePath()
      ctx.fill()
      ctx.restore()
      break
    }

    case 'knockback': {
      // Large circle with shockwave rings
      ctx.beginPath()
      ctx.arc(cx, cy, w * 0.4, 0, TWO_PI)
      ctx.fill()
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.4
      ctx.beginPath()
      ctx.arc(cx, cy, w * 0.7, 0, TWO_PI)
      ctx.stroke()
      ctx.globalAlpha = 0.2
      ctx.beginPath()
      ctx.arc(cx, cy, w, 0, TWO_PI)
      ctx.stroke()
      ctx.globalAlpha = 1
      break
    }
  }
}
```

- [ ] **Step 3: ProjectileEntity.render() 委托给 ProjectileRenderer**

```typescript
// ProjectileEntity.ts — replace render() and add import
import { drawProjectile } from '../scenes/renderers/ProjectileRenderer'

render(ctx: CanvasRenderingContext2D): void {
  drawProjectile(
    ctx, this.x, this.y, this.width, this.height,
    this.element,
    this.trailPositions, this.trailCount, this.trailIndex,
    this.rotation,
  )
}
```

Remove the old `ELEMENT_COLORS` constant from ProjectileEntity.ts since it's now in ProjectileRenderer.

- [ ] **Step 4: 运行全量测试**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 5: 浏览器验证**

Run: `npm run dev`
验证：
- normal 弹道：金色圆形，无拖尾
- ice 弹道：蓝色菱形，淡蓝拖尾
- fire 弹道：红色圆形+火焰，橙红拖尾
- electric 弹道：紫色圆+闪电线，闪烁
- stun 弹道：黄色旋转星
- knockback 弹道：橙色大圆+冲击波纹

- [ ] **Step 6: 提交**

```bash
git add src/scenes/renderers/ProjectileRenderer.ts src/game/ProjectileEntity.ts
git commit -m "feat(renderers): element-specific projectile rendering with trails"
```

---

## Task 12: 全量验证 + 回归测试

- [ ] **Step 1: 运行全量测试**

Run: `npx vitest run`
Expected: All tests pass, no regressions

- [ ] **Step 2: 浏览器全流程验证**

Run: `npm run dev`

完整走一遍游戏流程：
1. 菜单 → 开始游戏
2. 植物选择 → 进入战斗
3. 验证草坪背景（格子+泥土分隔）
4. 验证植物简笔画（眼睛、嘴巴、叶片）
5. 验证僵尸简笔画（圆头、手臂前伸、行走动画）
6. 打字命中 → 金色字母弹出 + 植物微跳
7. 打字错误 → 屏幕微震 + 红色字母闪
8. 连击结算 → 闪光脉冲 + 粒子（强度随连击长度）
9. 满链大招 → 全屏金色闪光 + 强震
10. 弹道差异 → 各元素形态和拖尾
11. 僵尸受击 → 闪白
12. 僵尸死亡 → 击飞淡出
13. 僵尸状态效果 → slow 蓝色、burn 火焰、stun 星星
14. 通关 → 结算界面正常
15. 虚拟键盘正常显示

- [ ] **Step 3: 提交最终状态（如有调整）**

```bash
git add -A
git commit -m "fix: visual polish adjustments after full playthrough"
```
