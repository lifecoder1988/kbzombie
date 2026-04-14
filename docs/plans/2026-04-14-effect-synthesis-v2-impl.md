# 特效合成系统 v2 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将特效合成从二维（Element × Trajectory）重构为四维正交（Element × Spread × Flight × Impact），同时新增僵尸状态系统。

**Architecture:** 自底向上重构：先改类型定义，再改纯函数模块（EffectSynthesis、Settlement），然后改实体（ProjectileEntity、ZombieEntity），再改 BattleManager 集成层，最后改配置层和场景层。每层 TDD：先写测试再写实现。

**Tech Stack:** TypeScript strict, Vitest, Canvas

**关键文件变更总览：**

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/game/types.ts` | 修改 | Element 扩展 6 值，Trajectory 拆为 Spread+Flight+Impact |
| `src/game/EffectSynthesis.ts` | 重写 | 四维合成算法 |
| `src/game/EffectSynthesis.test.ts` | 重写 | 四维合成测试 |
| `src/game/Settlement.ts` | 修改 | synthesizedEffect 改为四维结构 |
| `src/game/Settlement.test.ts` | 修改 | 适配新类型 |
| `src/game/ProjectileEntity.ts` | 重写 | flight+impact 驱动行为，取代 trajectory |
| `src/game/ProjectileEntity.test.ts` | 重写 | 按 flight×impact 组合测试 |
| `src/game/ZombieEntity.ts` | 修改 | 新增状态效果系统 |
| `src/game/ZombieEntity.test.ts` | 新增测试 | 状态效果测试 |
| `src/game/BattleManager.ts` | 修改 | spread 创建弹道，impact 碰撞处理，元素效果应用 |
| `src/game/BattleManager.test.ts` | 修改 | 适配新类型 |
| `src/config/types.ts` | 修改 | PlantDef、BattleDef 改为四维 |
| `src/config/plants.ts` | 修改 | 12 棵植物配置 |
| `src/config/battle.ts` | 修改 | effectParams 替换旧弹道参数 |
| `src/config/validation.ts` | 修改 | 校验新维度值 |
| `src/config/stages.ts` | 修改 | 适配新植物 ID |
| `src/scenes/BattleScene.ts` | 修改 | resolvePlants 和 BattleConfig 适配 |

---

### Task 1: 类型定义重构（game/types.ts）

**Files:**
- Modify: `src/game/types.ts`

- [ ] **Step 1: 更新 Element 和新增 Spread/Flight/Impact 类型**

```typescript
// src/game/types.ts — 替换前 2 行和 SynthesizedEffect
export type Element = 'normal' | 'ice' | 'fire' | 'electric' | 'stun' | 'knockback'
export type Spread = 'single' | 'burst' | 'fan'
export type Flight = 'straight' | 'tracking'
export type Impact = 'vanish' | 'chain' | 'pierce' | 'explode'

export interface SynthesizedEffect {
  readonly element: Element
  readonly spread: Spread
  readonly flight: Flight
  readonly impact: Impact
}
```

同时更新 `PlantConfig` 接口：

```typescript
export interface PlantConfig {
  readonly id: string
  readonly name: string
  readonly comboSegment: number
  readonly attackPower: number
  readonly hp: number
  readonly element: Element
  readonly spread: Spread
  readonly flight: Flight
  readonly impact: Impact
}
```

删除 `Trajectory` 类型。

- [ ] **Step 2: 更新 SettlementResult（不变，只是 SynthesizedEffect 结构变了）**

确认 `SettlementResult.synthesizedEffect` 的类型自动跟随新的 `SynthesizedEffect`，不需要额外改动。

- [ ] **Step 3: 确认编译状态**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: 大量编译错误（Trajectory 不存在、属性不匹配等），这是预期的。记录错误数量，后续任务逐一修复。

- [ ] **Step 4: Commit**

```bash
git add src/game/types.ts
git commit -m "refactor(types): Element 扩展6值，Trajectory 拆为 Spread+Flight+Impact"
```

---

### Task 2: EffectSynthesis 四维合成（TDD）

**Files:**
- Rewrite: `src/game/EffectSynthesis.ts`
- Rewrite: `src/game/__tests__/EffectSynthesis.test.ts`

- [ ] **Step 1: 写测试——元素合成（保留冰火抵消 + 新增元素优先级）**

```typescript
// src/game/__tests__/EffectSynthesis.test.ts
import { describe, it, expect } from 'vitest'
import { synthesizeEffects } from '../EffectSynthesis'

const plant = (
  element: 'normal' | 'ice' | 'fire' | 'electric' | 'stun' | 'knockback' = 'normal',
  spread: 'single' | 'burst' | 'fan' = 'single',
  flight: 'straight' | 'tracking' = 'straight',
  impact: 'vanish' | 'chain' | 'pierce' | 'explode' = 'vanish',
) => ({ element, spread, flight, impact })

describe('synthesizeEffects', () => {
  describe('element synthesis', () => {
    it('returns normal for empty input', () => {
      expect(synthesizeEffects([]).element).toBe('normal')
    })

    it('returns single element as-is', () => {
      expect(synthesizeEffects([plant('ice')]).element).toBe('ice')
      expect(synthesizeEffects([plant('fire')]).element).toBe('fire')
      expect(synthesizeEffects([plant('electric')]).element).toBe('electric')
      expect(synthesizeEffects([plant('stun')]).element).toBe('stun')
      expect(synthesizeEffects([plant('knockback')]).element).toBe('knockback')
    })

    it('ice + fire cancel to normal', () => {
      expect(synthesizeEffects([plant('ice'), plant('fire')]).element).toBe('normal')
    })

    it('ice + fire cancel but higher priority remains', () => {
      expect(synthesizeEffects([plant('ice'), plant('fire'), plant('electric')]).element).toBe('electric')
      expect(synthesizeEffects([plant('ice'), plant('fire'), plant('stun')]).element).toBe('stun')
    })

    it('takes highest priority element', () => {
      expect(synthesizeEffects([plant('normal'), plant('ice')]).element).toBe('ice')
      expect(synthesizeEffects([plant('ice'), plant('electric')]).element).toBe('electric')
      expect(synthesizeEffects([plant('electric'), plant('stun')]).element).toBe('stun')
      expect(synthesizeEffects([plant('stun'), plant('knockback')]).element).toBe('knockback')
    })
  })

  describe('spread synthesis', () => {
    it('returns single for empty input', () => {
      expect(synthesizeEffects([]).spread).toBe('single')
    })

    it('takes highest priority spread', () => {
      expect(synthesizeEffects([plant('normal', 'single'), plant('normal', 'burst')]).spread).toBe('burst')
      expect(synthesizeEffects([plant('normal', 'burst'), plant('normal', 'fan')]).spread).toBe('fan')
      expect(synthesizeEffects([plant('normal', 'single'), plant('normal', 'fan')]).spread).toBe('fan')
    })
  })

  describe('flight synthesis', () => {
    it('returns straight for empty input', () => {
      expect(synthesizeEffects([]).flight).toBe('straight')
    })

    it('tracking beats straight', () => {
      expect(synthesizeEffects([plant('normal', 'single', 'straight'), plant('normal', 'single', 'tracking')]).flight).toBe('tracking')
    })
  })

  describe('impact synthesis', () => {
    it('returns vanish for empty input', () => {
      expect(synthesizeEffects([]).impact).toBe('vanish')
    })

    it('takes highest priority impact', () => {
      expect(synthesizeEffects([
        plant('normal', 'single', 'straight', 'vanish'),
        plant('normal', 'single', 'straight', 'chain'),
      ]).impact).toBe('chain')

      expect(synthesizeEffects([
        plant('normal', 'single', 'straight', 'chain'),
        plant('normal', 'single', 'straight', 'pierce'),
      ]).impact).toBe('pierce')

      expect(synthesizeEffects([
        plant('normal', 'single', 'straight', 'pierce'),
        plant('normal', 'single', 'straight', 'explode'),
      ]).impact).toBe('explode')
    })
  })

  describe('full synthesis', () => {
    it('寒冰 + 大喷菇 = ice / fan / straight / vanish', () => {
      const result = synthesizeEffects([
        plant('ice', 'single', 'straight', 'vanish'),
        plant('normal', 'fan', 'straight', 'vanish'),
      ])
      expect(result).toEqual({ element: 'ice', spread: 'fan', flight: 'straight', impact: 'vanish' })
    })

    it('火炬 + 猫尾草 = fire / single / tracking / chain', () => {
      const result = synthesizeEffects([
        plant('fire', 'single', 'straight', 'vanish'),
        plant('normal', 'single', 'tracking', 'chain'),
      ])
      expect(result).toEqual({ element: 'fire', spread: 'single', flight: 'tracking', impact: 'chain' })
    })

    it('寒冰 + 火炬 + 闪电芦苇 = electric (ice+fire cancel)', () => {
      const result = synthesizeEffects([
        plant('ice'), plant('fire'), plant('electric'),
      ])
      expect(result.element).toBe('electric')
    })
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/game/__tests__/EffectSynthesis.test.ts`
Expected: FAIL（synthesizeEffects 参数类型不匹配）

- [ ] **Step 3: 实现四维合成**

```typescript
// src/game/EffectSynthesis.ts
import type { Element, Spread, Flight, Impact, SynthesizedEffect } from './types'

const ELEMENT_PRIORITY: Record<Element, number> = {
  normal: 0, ice: 1, fire: 1, electric: 2, stun: 3, knockback: 4,
}

const SPREAD_PRIORITY: Record<Spread, number> = {
  single: 0, burst: 1, fan: 2,
}

const FLIGHT_PRIORITY: Record<Flight, number> = {
  straight: 0, tracking: 1,
}

const IMPACT_PRIORITY: Record<Impact, number> = {
  vanish: 0, chain: 1, pierce: 2, explode: 3,
}

const SPREAD_BY_PRIORITY: Spread[] = ['single', 'burst', 'fan']
const FLIGHT_BY_PRIORITY: Flight[] = ['straight', 'tracking']
const IMPACT_BY_PRIORITY: Impact[] = ['vanish', 'chain', 'pierce', 'explode']

export function synthesizeEffects(
  plants: readonly { element: Element; spread: Spread; flight: Flight; impact: Impact }[],
): SynthesizedEffect {
  if (plants.length === 0) {
    return { element: 'normal', spread: 'single', flight: 'straight', impact: 'vanish' }
  }

  // Element synthesis: ice+fire cancel, then take highest priority
  let hasIce = false
  let hasFire = false
  let maxElementPriority = 0
  let maxElement: Element = 'normal'
  let maxSpreadPriority = 0
  let maxFlightPriority = 0
  let maxImpactPriority = 0

  for (let i = 0; i < plants.length; i++) {
    const p = plants[i]

    // Element
    if (p.element === 'ice') hasIce = true
    if (p.element === 'fire') hasFire = true

    // Spread
    const sp = SPREAD_PRIORITY[p.spread]
    if (sp > maxSpreadPriority) maxSpreadPriority = sp

    // Flight
    const fp = FLIGHT_PRIORITY[p.flight]
    if (fp > maxFlightPriority) maxFlightPriority = fp

    // Impact
    const ip = IMPACT_PRIORITY[p.impact]
    if (ip > maxImpactPriority) maxImpactPriority = ip
  }

  // Element resolution: first pass collected ice/fire flags
  // Now find highest priority element, excluding ice+fire if both present
  const cancelIceFire = hasIce && hasFire
  for (let i = 0; i < plants.length; i++) {
    const el = plants[i].element
    if (cancelIceFire && (el === 'ice' || el === 'fire')) continue
    const ep = ELEMENT_PRIORITY[el]
    if (ep > maxElementPriority) {
      maxElementPriority = ep
      maxElement = el
    }
  }

  return {
    element: maxElement,
    spread: SPREAD_BY_PRIORITY[maxSpreadPriority],
    flight: FLIGHT_BY_PRIORITY[maxFlightPriority],
    impact: IMPACT_BY_PRIORITY[maxImpactPriority],
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/game/__tests__/EffectSynthesis.test.ts`
Expected: 所有测试 PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/EffectSynthesis.ts src/game/__tests__/EffectSynthesis.test.ts
git commit -m "feat(game): EffectSynthesis 四维合成（Element×Spread×Flight×Impact）TDD"
```

---

### Task 3: Settlement 适配四维（TDD）

**Files:**
- Modify: `src/game/Settlement.ts`
- Modify: `src/game/__tests__/Settlement.test.ts`

- [ ] **Step 1: 更新测试中的 PlantState mock 和断言**

在测试文件中，所有 `makePlant` helper 需要把 `trajectory` 改为 `spread`/`flight`/`impact` 三个字段。`synthesizedEffect` 的断言也要改为四维结构。

对每个现有测试：
- `config.trajectory: 'direct'` → `config.spread: 'single', config.flight: 'straight', config.impact: 'vanish'`
- `config.trajectory: 'pierce'` → `config.spread: 'single', config.flight: 'straight', config.impact: 'pierce'`
- `config.trajectory: 'area'` → `config.spread: 'fan', config.flight: 'straight', config.impact: 'vanish'`
- `config.trajectory: 'tracking'` → `config.spread: 'single', config.flight: 'tracking', config.impact: 'vanish'`
- `synthesizedEffect: { element: X, trajectory: Y }` → `synthesizedEffect: { element: X, spread: ..., flight: ..., impact: ... }`

- [ ] **Step 2: 更新 Settlement.ts 的 effectInputs 映射**

```typescript
// Settlement.ts — 修改 effectInputs 映射（约第 64-68 行）
// 旧：
// const effectInputs = aliveActivatedIndices.map(idx => ({
//   element: plants[idx].config.element,
//   trajectory: plants[idx].config.trajectory,
// }))

// 新：
const effectInputs = aliveActivatedIndices.map(idx => ({
  element: plants[idx].config.element,
  spread: plants[idx].config.spread,
  flight: plants[idx].config.flight,
  impact: plants[idx].config.impact,
}))
```

同时更新空结果默认值：
```typescript
const empty: SettlementResult = {
  totalPower: 0,
  activatedIndices: [],
  aliveActivatedIndices: [],
  isFullChain: false,
  synergyMultiplier: 1.0,
  perPlantPower: [],
  synthesizedEffect: { element: 'normal', spread: 'single', flight: 'straight', impact: 'vanish' },
}
```

- [ ] **Step 3: 运行测试确认通过**

Run: `npx vitest run src/game/__tests__/Settlement.test.ts`
Expected: 所有测试 PASS

- [ ] **Step 4: Commit**

```bash
git add src/game/Settlement.ts src/game/__tests__/Settlement.test.ts
git commit -m "refactor(game): Settlement 适配四维 SynthesizedEffect"
```

---

### Task 4: ProjectileEntity 重构为 flight+impact 驱动（TDD）

**Files:**
- Rewrite: `src/game/ProjectileEntity.ts`
- Rewrite: `src/game/__tests__/ProjectileEntity.test.ts`

- [ ] **Step 1: 写测试——flight 行为**

```typescript
// src/game/__tests__/ProjectileEntity.test.ts
import { describe, it, expect } from 'vitest'
import { ProjectileEntity } from '../ProjectileEntity'
import type { ProjectileConfig } from '../ProjectileEntity'

const baseConfig = (overrides: Partial<ProjectileConfig> = {}): ProjectileConfig => ({
  id: 'proj_1',
  x: 100,
  y: 200,
  speed: 500,
  power: 10,
  rightBound: 1000,
  element: 'normal',
  spread: 'single',
  flight: 'straight',
  impact: 'vanish',
  ...overrides,
})

describe('ProjectileEntity', () => {
  describe('flight: straight', () => {
    it('moves horizontally at constant speed', () => {
      const p = new ProjectileEntity(baseConfig({ flight: 'straight' }))
      p.update(100) // 100ms
      expect(p.x).toBeCloseTo(150) // 100 + 500 * 0.1
    })

    it('deactivates when past right bound', () => {
      const p = new ProjectileEntity(baseConfig({ x: 995, flight: 'straight' }))
      p.update(100)
      expect(p.active).toBe(false)
    })
  })

  describe('flight: straight with angle (fan spread)', () => {
    it('moves at angle when angle is provided', () => {
      const angle = Math.PI / 6 // 30 degrees
      const p = new ProjectileEntity(baseConfig({ flight: 'straight', angle }))
      p.update(100)
      expect(p.x).toBeCloseTo(100 + 500 * Math.cos(angle) * 0.1)
      expect(p.y).toBeCloseTo(200 + 500 * Math.sin(angle) * 0.1)
    })
  })

  describe('flight: tracking', () => {
    it('adjusts heading toward target', () => {
      const target = { x: 200, y: 300, active: true }
      const p = new ProjectileEntity(baseConfig({ flight: 'tracking', target, maxTurnRate: Math.PI }))
      const initialX = p.x
      p.update(100)
      // Should have moved somewhat toward target (not purely horizontal)
      expect(p.x).toBeGreaterThan(initialX)
    })

    it('continues on last heading when target dies', () => {
      const target = { x: 200, y: 300, active: false }
      const p = new ProjectileEntity(baseConfig({ flight: 'tracking', target, maxTurnRate: Math.PI }))
      p.update(100)
      expect(p.active).toBe(true) // still flying
    })
  })

  describe('impact: vanish', () => {
    it('deactivates on hit', () => {
      const p = new ProjectileEntity(baseConfig({ impact: 'vanish' }))
      p.onHit('z1')
      expect(p.active).toBe(false)
    })
  })

  describe('impact: pierce', () => {
    it('stays active after hit, tracks hit set', () => {
      const p = new ProjectileEntity(baseConfig({ impact: 'pierce' }))
      p.onHit('z1')
      expect(p.active).toBe(true)
      expect(p.hasHit('z1')).toBe(true)
      expect(p.hasHit('z2')).toBe(false)
    })
  })

  describe('impact: chain', () => {
    it('tracks hit set and increments bounce count', () => {
      const p = new ProjectileEntity(baseConfig({ impact: 'chain', chainBounces: 3, chainRange: 200 }))
      p.onHit('z1')
      expect(p.active).toBe(true)
      expect(p.hasHit('z1')).toBe(true)
      expect(p.bounceCount).toBe(1)
    })

    it('deactivates when max bounces reached', () => {
      const p = new ProjectileEntity(baseConfig({ impact: 'chain', chainBounces: 2, chainRange: 200 }))
      p.onHit('z1')
      expect(p.bounceCount).toBe(1)
      p.onHit('z2')
      expect(p.bounceCount).toBe(2)
      expect(p.active).toBe(false) // reached max
    })

    it('needs redirect after hit (BattleManager responsibility)', () => {
      const p = new ProjectileEntity(baseConfig({ impact: 'chain', chainBounces: 3, chainRange: 200 }))
      expect(p.needsRedirect).toBe(false)
      p.onHit('z1')
      expect(p.needsRedirect).toBe(true)
    })
  })

  describe('impact: explode', () => {
    it('deactivates on hit (explosion handled by BattleManager)', () => {
      const p = new ProjectileEntity(baseConfig({ impact: 'explode' }))
      p.onHit('z1')
      expect(p.active).toBe(false)
    })
  })

  describe('element color', () => {
    it('returns correct color for each element', () => {
      expect(new ProjectileEntity(baseConfig({ element: 'normal' })).element).toBe('normal')
      expect(new ProjectileEntity(baseConfig({ element: 'ice' })).element).toBe('ice')
      expect(new ProjectileEntity(baseConfig({ element: 'fire' })).element).toBe('fire')
      expect(new ProjectileEntity(baseConfig({ element: 'electric' })).element).toBe('electric')
      expect(new ProjectileEntity(baseConfig({ element: 'stun' })).element).toBe('stun')
      expect(new ProjectileEntity(baseConfig({ element: 'knockback' })).element).toBe('knockback')
    })
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/game/__tests__/ProjectileEntity.test.ts`
Expected: FAIL

- [ ] **Step 3: 重写 ProjectileEntity**

```typescript
// src/game/ProjectileEntity.ts
import type { Entity } from '../engine/types'
import { RenderLayer } from '../engine/types'
import type { Element, Spread, Flight, Impact } from './types'

const PROJECTILE_TAGS: ReadonlySet<string> = new Set(['projectile'])

const ELEMENT_COLORS: Record<Element, string> = {
  normal: '#ffd700',
  ice: '#87ceeb',
  fire: '#ff6347',
  electric: '#9b59b6',
  stun: '#f1c40f',
  knockback: '#e67e22',
}

export interface ProjectileConfig {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly speed: number
  readonly power: number
  readonly rightBound: number
  readonly element: Element
  readonly spread: Spread
  readonly flight: Flight
  readonly impact: Impact
  readonly angle?: number
  readonly target?: { x: number; y: number; active?: boolean }
  readonly maxTurnRate?: number
  readonly chainBounces?: number
  readonly chainRange?: number
}

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
  readonly spread: Spread
  readonly flight: Flight
  readonly impact: Impact

  private readonly speed: number
  private readonly rightBound: number
  private readonly spawnY: number

  // Pierce + Chain: hit tracking
  private readonly hitSet: Set<string> | null
  private _bounceCount = 0
  private readonly maxBounces: number
  readonly chainRange: number
  private _needsRedirect = false

  // Heading (used for angled flight and tracking)
  private heading: number

  // Tracking: target reference
  private readonly target: { x: number; y: number; active?: boolean } | null
  private readonly maxTurnRate: number

  constructor(config: ProjectileConfig) {
    this.id = config.id
    this.x = config.x
    this.y = config.y
    this.speed = config.speed
    this.power = config.power
    this.rightBound = config.rightBound
    this.element = config.element
    this.spread = config.spread
    this.flight = config.flight
    this.impact = config.impact
    this.spawnY = config.y

    // Hit tracking for pierce and chain
    this.hitSet = (config.impact === 'pierce' || config.impact === 'chain') ? new Set() : null
    this.maxBounces = config.chainBounces ?? 0
    this.chainRange = config.chainRange ?? 0

    // Target for tracking flight
    this.target = config.target ?? null
    this.maxTurnRate = config.maxTurnRate ?? Math.PI

    // Heading initialization
    if (config.flight === 'tracking' && config.target) {
      this.heading = Math.atan2(config.target.y - config.y, config.target.x - config.x)
    } else {
      this.heading = config.angle ?? 0
    }
  }

  get bounceCount(): number { return this._bounceCount }
  get needsRedirect(): boolean { return this._needsRedirect }

  hasHit(zombieId: string): boolean {
    return this.hitSet !== null && this.hitSet.has(zombieId)
  }

  onHit(zombieId: string): void {
    if (this.impact === 'pierce') {
      this.hitSet!.add(zombieId)
      // stays active, continues flying
    } else if (this.impact === 'chain') {
      this.hitSet!.add(zombieId)
      this._bounceCount++
      if (this._bounceCount >= this.maxBounces) {
        this.active = false
      } else {
        this._needsRedirect = true
      }
    } else {
      // vanish and explode: deactivate (explode area damage handled by BattleManager)
      this.active = false
    }
  }

  /** Called by BattleManager after finding chain redirect target */
  redirectTo(targetX: number, targetY: number): void {
    this.heading = Math.atan2(targetY - this.y, targetX - this.x)
    this._needsRedirect = false
  }

  /** Called when no chain target found — just keep flying */
  clearRedirect(): void {
    this._needsRedirect = false
  }

  update(dt: number): void {
    const dtSec = dt / 1000

    if (this.flight === 'tracking') {
      this.updateTracking(dtSec)
    } else {
      // straight flight (with optional angle for fan spread)
      this.x += this.speed * Math.cos(this.heading) * dtSec
      this.y += this.speed * Math.sin(this.heading) * dtSec
    }

    // Bounds check
    if (this.x > this.rightBound) {
      this.active = false
    }
    // Vertical bounds for angled projectiles
    if (this.heading !== 0 && Math.abs(this.y - this.spawnY) > Y_BOUND) {
      this.active = false
    }
  }

  private updateTracking(dtSec: number): void {
    if (this.target && this.target.active !== false) {
      const desired = Math.atan2(this.target.y - this.y, this.target.x - this.x)
      let diff = desired - this.heading
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      const maxTurn = this.maxTurnRate * dtSec
      if (Math.abs(diff) <= maxTurn) {
        this.heading = desired
      } else {
        this.heading += Math.sign(diff) * maxTurn
      }
    }
    this.x += this.speed * Math.cos(this.heading) * dtSec
    this.y += this.speed * Math.sin(this.heading) * dtSec
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = ELEMENT_COLORS[this.element]
    ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height)
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/game/__tests__/ProjectileEntity.test.ts`
Expected: 所有测试 PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/ProjectileEntity.ts src/game/__tests__/ProjectileEntity.test.ts
git commit -m "feat(game): ProjectileEntity 重构为 flight+impact 驱动（TDD）"
```

---

### Task 5: ZombieEntity 状态效果系统（TDD）

**Files:**
- Modify: `src/game/ZombieEntity.ts`
- Modify: `src/game/__tests__/ZombieEntity.test.ts`

- [ ] **Step 1: 写测试——状态效果**

```typescript
// 在 ZombieEntity.test.ts 中新增测试
describe('status effects', () => {
  it('slow reduces movement speed', () => {
    const z = new ZombieEntity('z1', 500, 100, 100, 100, 10)
    z.setChewTarget(0)
    z.applyStatus({ type: 'slow', remaining: 2, value: 0.5 })
    z.update(1000) // 1 second
    // Normal: 500 - 100 = 400. With 50% slow: 500 - 50 = 450
    expect(z.x).toBeCloseTo(450)
  })

  it('slow reduces chew damage', () => {
    const z = new ZombieEntity('z1', 100, 100, 100, 100, 20)
    z.setChewTarget(100) // at target, will chew
    z.update(100) // force chewing state
    z.applyStatus({ type: 'slow', remaining: 2, value: 0.5 })
    const dmg = z.getChewDamage(1000) // 1 second
    expect(dmg).toBeCloseTo(10) // 20 * 0.5
  })

  it('burn deals damage over time', () => {
    const z = new ZombieEntity('z1', 500, 100, 100, 100, 10)
    z.applyStatus({ type: 'burn', remaining: 3, value: 10 }) // 10 DPS
    z.update(1000) // 1 second
    expect(z.currentHp).toBe(90) // 100 - 10
  })

  it('stun stops movement and chewing', () => {
    const z = new ZombieEntity('z1', 500, 100, 100, 100, 10)
    z.setChewTarget(0)
    z.applyStatus({ type: 'stun', remaining: 2, value: 0 })
    const xBefore = z.x
    z.update(1000)
    expect(z.x).toBe(xBefore) // didn't move
    expect(z.getChewDamage(1000)).toBe(0) // didn't chew
  })

  it('status expires after remaining time', () => {
    const z = new ZombieEntity('z1', 500, 100, 100, 100, 10)
    z.setChewTarget(0)
    z.applyStatus({ type: 'slow', remaining: 0.5, value: 0.5 })
    z.update(600) // 0.6 seconds — status should expire
    const xAfterExpiry = z.x
    z.update(1000) // 1 second — should move at full speed
    expect(z.x).toBeCloseTo(xAfterExpiry - 100) // full speed
  })

  it('same type status refreshes remaining', () => {
    const z = new ZombieEntity('z1', 500, 100, 100, 100, 10)
    z.applyStatus({ type: 'slow', remaining: 1, value: 0.5 })
    z.update(500) // 0.5 seconds
    z.applyStatus({ type: 'slow', remaining: 1, value: 0.5 }) // refresh
    z.update(800) // 0.8 seconds — still active because refreshed
    expect(z.hasStatus('slow')).toBe(true)
  })

  it('different statuses can coexist', () => {
    const z = new ZombieEntity('z1', 500, 100, 100, 100, 10)
    z.applyStatus({ type: 'slow', remaining: 2, value: 0.5 })
    z.applyStatus({ type: 'burn', remaining: 2, value: 10 })
    expect(z.hasStatus('slow')).toBe(true)
    expect(z.hasStatus('burn')).toBe(true)
  })

  it('knockback shifts position right', () => {
    const z = new ZombieEntity('z1', 300, 100, 100, 100, 10)
    z.applyKnockback(50, 800) // push 50px, right bound 800
    expect(z.x).toBe(350)
  })

  it('knockback does not push past right bound', () => {
    const z = new ZombieEntity('z1', 780, 100, 100, 100, 10)
    z.applyKnockback(50, 800)
    expect(z.x).toBe(800)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/game/__tests__/ZombieEntity.test.ts`
Expected: FAIL（applyStatus、applyKnockback、hasStatus 不存在）

- [ ] **Step 3: 实现状态效果系统**

在 `ZombieEntity.ts` 中添加：

```typescript
// types.ts 中添加
export interface ZombieStatus {
  type: 'slow' | 'burn' | 'stun'
  remaining: number
  value: number
}
```

在 `ZombieEntity` 类中：

```typescript
// 新增字段
private statuses: ZombieStatus[] = []

// 新增方法
applyStatus(status: ZombieStatus): void {
  const existing = this.statuses.find(s => s.type === status.type)
  if (existing) {
    existing.remaining = status.remaining
    existing.value = status.value
  } else {
    this.statuses.push({ ...status })
  }
}

applyKnockback(distance: number, rightBound: number): void {
  this.x = Math.min(rightBound, this.x + distance)
}

hasStatus(type: string): boolean {
  return this.statuses.some(s => s.type === type)
}

// 修改 update 方法
update(dt: number): void {
  if (this._state === ZombieState.Dead) return

  const dtSec = dt / 1000

  // Update status timers and apply burn
  for (let i = this.statuses.length - 1; i >= 0; i--) {
    const s = this.statuses[i]
    if (s.type === 'burn') {
      this._currentHp = Math.max(0, this._currentHp - s.value * dtSec)
      if (this._currentHp <= 0) {
        this._state = ZombieState.Dead
        this.active = false
        return
      }
    }
    s.remaining -= dtSec
    if (s.remaining <= 0) {
      this.statuses.splice(i, 1)
    }
  }

  // Check stun
  const isStunned = this.statuses.some(s => s.type === 'stun')
  if (isStunned) return

  // Check slow
  const slowStatus = this.statuses.find(s => s.type === 'slow')
  const speedMult = slowStatus ? (1 - slowStatus.value) : 1

  if (this._state === ZombieState.Walking) {
    this.x -= this.speed * speedMult * dtSec
    if (this.x <= this.chewTargetX) {
      this.x = this.chewTargetX
      this._state = ZombieState.Chewing
    }
  }
}

// 修改 getChewDamage 方法
getChewDamage(dt: number): number {
  if (this._state !== ZombieState.Chewing) return 0
  const isStunned = this.statuses.some(s => s.type === 'stun')
  if (isStunned) return 0
  const slowStatus = this.statuses.find(s => s.type === 'slow')
  const speedMult = slowStatus ? (1 - slowStatus.value) : 1
  return this.chewDps * speedMult * (dt / 1000)
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/game/__tests__/ZombieEntity.test.ts`
Expected: 所有测试 PASS

- [ ] **Step 5: Commit**

```bash
git add src/game/types.ts src/game/ZombieEntity.ts src/game/__tests__/ZombieEntity.test.ts
git commit -m "feat(game): ZombieEntity 新增状态效果系统（slow/burn/stun/knockback）TDD"
```

---

### Task 6: BattleManager 适配——Spread 弹道创建

**Files:**
- Modify: `src/game/BattleManager.ts`

- [ ] **Step 1: 更新 BattleConfig 接口**

将旧的弹道参数替换为新的 effectParams 结构：

```typescript
export interface BattleConfig {
  readonly laneCount: number
  readonly lanePlants: readonly (readonly PlantConfig[])[]
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
  // 新的效果参数（替换旧的 areaBulletCount 等）
  readonly effectParams: {
    readonly burst: { readonly burstCount: number; readonly burstInterval: number }
    readonly fan: { readonly fanBulletCount: number; readonly fanSpreadAngle: number }
    readonly tracking: { readonly trackingTurnRate: number }
    readonly chain: { readonly chainBounces: number; readonly chainRange: number }
    readonly explode: { readonly explodeRadius: number; readonly explodeDamageRatio: number }
    readonly ice: { readonly slowRatio: number; readonly slowDuration: number }
    readonly fire: { readonly burnDps: number; readonly burnDuration: number }
    readonly electric: { readonly conductRadius: number; readonly conductDamageDecay: number; readonly conductMaxJumps: number }
    readonly stun: { readonly stunDuration: number }
    readonly knockback: { readonly knockbackDistance: number }
  }
}
```

- [ ] **Step 2: 重写 executeSettlement 方法**

用 spread 维度替代旧的 `trajectory === 'area'` 分支：

```typescript
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

    switch (synthesizedEffect.spread) {
      case 'fan':
        this.fireFanProjectiles(px, py, power, synthesizedEffect)
        break
      case 'burst':
        this.fireBurstProjectiles(px, py, power, synthesizedEffect)
        break
      case 'single':
      default:
        this.fireSingleProjectile(px, py, power, synthesizedEffect)
        break
    }
  }

  if (isFullChain) {
    lane.healOnFullChain(this.config.healAmount)
    this.reassignChewTargetsForLane(laneIndex)
  }
}
```

- [ ] **Step 3: 实现三种发射模式方法**

```typescript
private fireSingleProjectile(
  px: number, py: number, power: number, effect: SynthesizedEffect,
): void {
  const id = `proj_${this.projectileIdCounter++}`
  const proj = new ProjectileEntity({
    id, x: px, y: py,
    speed: this.config.projectileSpeed,
    power,
    rightBound: this.config.canvasWidth,
    element: effect.element,
    spread: effect.spread,
    flight: effect.flight,
    impact: effect.impact,
    target: effect.flight === 'tracking' ? this.findNearestZombie(px, py) : undefined,
    maxTurnRate: this.config.effectParams.tracking.trackingTurnRate,
    chainBounces: this.config.effectParams.chain.chainBounces,
    chainRange: this.config.effectParams.chain.chainRange,
  })
  this.entityManager.add(proj)
  this._pendingProjectiles++
}

private fireFanProjectiles(
  px: number, py: number, power: number, effect: SynthesizedEffect,
): void {
  const { fanBulletCount: count, fanSpreadAngle } = this.config.effectParams.fan
  const halfSpread = fanSpreadAngle / 2
  const angles: number[] = [0]
  const pairs = Math.floor((count - 1) / 2)
  if (pairs > 0) {
    const step = halfSpread / pairs
    for (let j = 1; j <= pairs; j++) {
      angles.push(step * j)
      angles.push(-step * j)
    }
  }
  if (count > 1 && count % 2 === 0) {
    const step = pairs > 0 ? halfSpread / pairs : halfSpread
    angles.push(step / 2)
  }
  for (const angle of angles) {
    const id = `proj_${this.projectileIdCounter++}`
    const proj = new ProjectileEntity({
      id, x: px, y: py,
      speed: this.config.projectileSpeed,
      power,
      rightBound: this.config.canvasWidth,
      element: effect.element,
      spread: effect.spread,
      flight: effect.flight,
      impact: effect.impact,
      angle,
      target: effect.flight === 'tracking' ? this.findNearestZombie(px, py) : undefined,
      maxTurnRate: this.config.effectParams.tracking.trackingTurnRate,
      chainBounces: this.config.effectParams.chain.chainBounces,
      chainRange: this.config.effectParams.chain.chainRange,
    })
    this.entityManager.add(proj)
    this._pendingProjectiles++
  }
}

private fireBurstProjectiles(
  px: number, py: number, power: number, effect: SynthesizedEffect,
): void {
  const { burstCount, burstInterval } = this.config.effectParams.burst
  for (let i = 0; i < burstCount; i++) {
    const id = `proj_${this.projectileIdCounter++}`
    const proj = new ProjectileEntity({
      id, x: px, y: py,
      speed: this.config.projectileSpeed,
      power,
      rightBound: this.config.canvasWidth,
      element: effect.element,
      spread: effect.spread,
      flight: effect.flight,
      impact: effect.impact,
      target: effect.flight === 'tracking' ? this.findNearestZombie(px, py) : undefined,
      maxTurnRate: this.config.effectParams.tracking.trackingTurnRate,
      chainBounces: this.config.effectParams.chain.chainBounces,
      chainRange: this.config.effectParams.chain.chainRange,
    })
    // Offset x position for burst spacing (slight delay simulation)
    proj.x = px - i * this.config.projectileSpeed * burstInterval / 1000
    this.entityManager.add(proj)
    this._pendingProjectiles++
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/game/BattleManager.ts
git commit -m "refactor(game): BattleManager 用 Spread 维度创建弹道（single/burst/fan）"
```

---

### Task 7: BattleManager 适配——Impact 碰撞处理 + 元素效果

**Files:**
- Modify: `src/game/BattleManager.ts`

- [ ] **Step 1: 重写 updateCollisions 处理 chain 和 explode**

```typescript
private updateCollisions(): void {
  const projectiles = this.entityManager.getByTag('projectile') as ProjectileEntity[]
  const zombies = this.entityManager.getByTag('zombie') as ZombieEntity[]

  for (let pi = 0; pi < projectiles.length; pi++) {
    const proj = projectiles[pi]
    if (!proj.active) continue

    // Chain redirect: find next target
    if (proj.needsRedirect) {
      const next = this.findChainTarget(proj, zombies)
      if (next) {
        proj.redirectTo(next.x, next.y)
      } else {
        proj.clearRedirect()
      }
    }

    for (let zi = 0; zi < zombies.length; zi++) {
      const z = zombies[zi]
      if (!z.active) continue
      if (proj.hasHit(z.id)) continue

      if (intersects(proj, z)) {
        z.takeDamage(proj.power)
        this.applyElementEffect(z, proj)

        // Explode: area damage around impact point
        if (proj.impact === 'explode') {
          this.applyExplosion(proj, z, zombies)
        }

        proj.onHit(z.id)
        if (!z.active) {
          this.processedInWave++
        }
        // For pierce, continue checking other zombies
        // For chain/vanish/explode, break (proj handles its own active state)
        if (proj.impact !== 'pierce') break
      }
    }
  }
}
```

- [ ] **Step 2: 实现 applyElementEffect**

```typescript
private applyElementEffect(zombie: ZombieEntity, proj: ProjectileEntity): void {
  const params = this.config.effectParams
  switch (proj.element) {
    case 'ice':
      zombie.applyStatus({ type: 'slow', remaining: params.ice.slowDuration, value: params.ice.slowRatio })
      break
    case 'fire':
      zombie.applyStatus({ type: 'burn', remaining: params.fire.burnDuration, value: params.fire.burnDps })
      break
    case 'electric':
      this.applyElectricConduction(zombie, proj.power, params.electric)
      break
    case 'stun':
      zombie.applyStatus({ type: 'stun', remaining: params.stun.stunDuration, value: 0 })
      break
    case 'knockback':
      zombie.applyKnockback(params.knockback.knockbackDistance, this.config.canvasWidth)
      // After knockback, reassign chew target
      const laneIdx = this.zombieLanes.get(zombie.id) ?? 0
      this.assignChewTarget(zombie, this.lanes[laneIdx])
      break
  }
}
```

- [ ] **Step 3: 实现 applyElectricConduction**

```typescript
private applyElectricConduction(
  source: ZombieEntity,
  baseDamage: number,
  params: { conductRadius: number; conductDamageDecay: number; conductMaxJumps: number },
): void {
  const zombies = this.entityManager.getByTag('zombie') as ZombieEntity[]
  const visited = new Set<string>([source.id])
  let currentTargets = [source]
  let currentDamage = baseDamage * params.conductDamageDecay

  for (let jump = 0; jump < params.conductMaxJumps; jump++) {
    const nextTargets: ZombieEntity[] = []
    for (const current of currentTargets) {
      for (const z of zombies) {
        if (!z.active || visited.has(z.id)) continue
        const dx = z.x - current.x
        const dy = z.y - current.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist <= params.conductRadius) {
          z.takeDamage(currentDamage)
          visited.add(z.id)
          nextTargets.push(z)
          if (!z.active) this.processedInWave++
        }
      }
    }
    if (nextTargets.length === 0) break
    currentTargets = nextTargets
    currentDamage *= params.conductDamageDecay
  }
}
```

- [ ] **Step 4: 实现 applyExplosion 和 findChainTarget**

```typescript
private applyExplosion(
  proj: ProjectileEntity,
  hitZombie: ZombieEntity,
  allZombies: ZombieEntity[],
): void {
  const { explodeRadius, explodeDamageRatio } = this.config.effectParams.explode
  const splashDamage = proj.power * explodeDamageRatio
  for (const z of allZombies) {
    if (!z.active || z.id === hitZombie.id) continue
    const dx = z.x - proj.x
    const dy = z.y - proj.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist <= explodeRadius) {
      z.takeDamage(splashDamage)
      if (!z.active) this.processedInWave++
    }
  }
}

private findChainTarget(proj: ProjectileEntity, zombies: ZombieEntity[]): ZombieEntity | null {
  let nearest: ZombieEntity | null = null
  let minDist = proj.chainRange
  for (const z of zombies) {
    if (!z.active || proj.hasHit(z.id)) continue
    const dx = z.x - proj.x
    const dy = z.y - proj.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < minDist) {
      minDist = dist
      nearest = z
    }
  }
  return nearest
}
```

- [ ] **Step 5: 删除旧的 fireAreaProjectiles 方法**

删除 `BattleManager.fireAreaProjectiles` 方法（已被 `fireFanProjectiles` 替代）。

- [ ] **Step 6: Commit**

```bash
git add src/game/BattleManager.ts
git commit -m "feat(game): BattleManager 支持 impact 碰撞（chain/explode）+ 元素效果（ice/fire/electric/stun/knockback）"
```

---

### Task 8: 配置层重构

**Files:**
- Modify: `src/config/types.ts`
- Modify: `src/config/plants.ts`
- Modify: `src/config/battle.ts`
- Modify: `src/config/synergy.ts`（不变，确认）
- Modify: `src/config/validation.ts`
- Modify: `src/config/stages.ts`
- Modify: `src/config/index.ts`

- [ ] **Step 1: 更新 config/types.ts**

```typescript
// src/config/types.ts
export type Element = 'normal' | 'ice' | 'fire' | 'electric' | 'stun' | 'knockback'
export type Spread = 'single' | 'burst' | 'fan'
export type Flight = 'straight' | 'tracking'
export type Impact = 'vanish' | 'chain' | 'pierce' | 'explode'

export interface SynergyDef {
  readonly multiplier: Readonly<Record<number, number>>
}

export interface PlantDef {
  readonly id: string
  readonly name: string
  readonly comboSegment: number
  readonly attackPower: number
  readonly hp: number
  readonly element: Element
  readonly spread: Spread
  readonly flight: Flight
  readonly impact: Impact
}

// ZombieDef, WaveDef, LevelDef, StageDef, DifficultyDef 不变

export interface EffectParamsDef {
  readonly burst: { readonly burstCount: number; readonly burstInterval: number }
  readonly fan: { readonly fanBulletCount: number; readonly fanSpreadAngle: number }
  readonly tracking: { readonly trackingTurnRate: number }
  readonly chain: { readonly chainBounces: number; readonly chainRange: number }
  readonly explode: { readonly explodeRadius: number; readonly explodeDamageRatio: number }
  readonly ice: { readonly slowRatio: number; readonly slowDuration: number }
  readonly fire: { readonly burnDps: number; readonly burnDuration: number }
  readonly electric: { readonly conductRadius: number; readonly conductDamageDecay: number; readonly conductMaxJumps: number }
  readonly stun: { readonly stunDuration: number }
  readonly knockback: { readonly knockbackDistance: number }
}

export interface BattleDef {
  readonly projectileSpeed: number
  readonly healAmount: number
  readonly wavePauseDuration: number
  readonly effectParams: EffectParamsDef
}
```

- [ ] **Step 2: 更新 config/plants.ts（12 棵植物）**

```typescript
import type { PlantDef } from './types'

export const PLANT_DEFS: readonly PlantDef[] = [
  { id: 'peashooter',      name: '豌豆射手',  comboSegment: 4,  attackPower: 10, hp: 100, element: 'normal',    spread: 'single', flight: 'straight', impact: 'vanish' },
  { id: 'snow_pea',        name: '寒冰射手',  comboSegment: 4,  attackPower: 8,  hp: 100, element: 'ice',       spread: 'single', flight: 'straight', impact: 'vanish' },
  { id: 'repeater',        name: '双发射手',  comboSegment: 4,  attackPower: 18, hp: 100, element: 'normal',    spread: 'burst',  flight: 'straight', impact: 'vanish' },
  { id: 'torchwood',       name: '火炬树桩',  comboSegment: 8,  attackPower: 25, hp: 120, element: 'fire',      spread: 'single', flight: 'straight', impact: 'vanish' },
  { id: 'cactus',          name: '仙人掌',    comboSegment: 4,  attackPower: 12, hp: 100, element: 'normal',    spread: 'single', flight: 'straight', impact: 'pierce' },
  { id: 'lightning_reed',  name: '闪电芦苇',  comboSegment: 4,  attackPower: 10, hp: 80,  element: 'electric',  spread: 'single', flight: 'straight', impact: 'vanish' },
  { id: 'kernel_pult',     name: '玉米投手',  comboSegment: 8,  attackPower: 20, hp: 120, element: 'stun',      spread: 'single', flight: 'straight', impact: 'explode' },
  { id: 'fume_shroom',     name: '大喷菇',    comboSegment: 16, attackPower: 30, hp: 150, element: 'normal',    spread: 'fan',    flight: 'straight', impact: 'vanish' },
  { id: 'cattail',         name: '猫尾草',    comboSegment: 8,  attackPower: 15, hp: 100, element: 'normal',    spread: 'single', flight: 'tracking', impact: 'chain' },
  { id: 'hurricane_flower',name: '飓风花',    comboSegment: 8,  attackPower: 15, hp: 120, element: 'knockback', spread: 'single', flight: 'straight', impact: 'vanish' },
  { id: 'melon_pult',      name: '西瓜投手',  comboSegment: 12, attackPower: 35, hp: 150, element: 'normal',    spread: 'single', flight: 'straight', impact: 'explode' },
  { id: 'starfruit',       name: '星星果',    comboSegment: 12, attackPower: 20, hp: 100, element: 'electric',  spread: 'fan',    flight: 'tracking', impact: 'vanish' },
]
```

- [ ] **Step 3: 更新 config/battle.ts**

```typescript
import type { BattleDef } from './types'

export const BATTLE_PARAMS: BattleDef = {
  projectileSpeed: 500,
  healAmount: 30,
  wavePauseDuration: 3000,
  effectParams: {
    burst: { burstCount: 3, burstInterval: 80 },
    fan: { fanBulletCount: 5, fanSpreadAngle: Math.PI / 3 },
    tracking: { trackingTurnRate: Math.PI },
    chain: { chainBounces: 3, chainRange: 200 },
    explode: { explodeRadius: 80, explodeDamageRatio: 0.6 },
    ice: { slowRatio: 0.5, slowDuration: 3 },
    fire: { burnDps: 5, burnDuration: 3 },
    electric: { conductRadius: 100, conductDamageDecay: 0.7, conductMaxJumps: 3 },
    stun: { stunDuration: 1.5 },
    knockback: { knockbackDistance: 60 },
  },
}
```

- [ ] **Step 4: 更新 config/validation.ts**

```typescript
// 替换顶部的 VALID 集合
const VALID_ELEMENTS = new Set(['normal', 'ice', 'fire', 'electric', 'stun', 'knockback'])
const VALID_SPREADS = new Set(['single', 'burst', 'fan'])
const VALID_FLIGHTS = new Set(['straight', 'tracking'])
const VALID_IMPACTS = new Set(['vanish', 'chain', 'pierce', 'explode'])

// 在植物校验循环中，替换 trajectory 校验为三个新维度：
// 删除：
// if (!VALID_TRAJECTORIES.has(p.trajectory)) { ... }
// 新增：
if (!VALID_SPREADS.has(p.spread)) {
  errors.push(`植物 "${p.id}" spread 不合法: "${p.spread}"，允许: ${[...VALID_SPREADS].join(', ')}`)
}
if (!VALID_FLIGHTS.has(p.flight)) {
  errors.push(`植物 "${p.id}" flight 不合法: "${p.flight}"，允许: ${[...VALID_FLIGHTS].join(', ')}`)
}
if (!VALID_IMPACTS.has(p.impact)) {
  errors.push(`植物 "${p.id}" impact 不合法: "${p.impact}"，允许: ${[...VALID_IMPACTS].join(', ')}`)
}

// 替换旧的 battle 参数校验为 effectParams 校验：
// 删除 areaBulletCount / areaSpreadAngle / areaDamageDecay 校验
// 新增：
if (battle.effectParams.fan.fanBulletCount < 1) {
  errors.push(`effectParams.fan.fanBulletCount 必须 >= 1，当前: ${battle.effectParams.fan.fanBulletCount}`)
}
if (battle.effectParams.fan.fanSpreadAngle <= 0) {
  errors.push(`effectParams.fan.fanSpreadAngle 必须 > 0，当前: ${battle.effectParams.fan.fanSpreadAngle}`)
}
if (battle.effectParams.burst.burstCount < 1) {
  errors.push(`effectParams.burst.burstCount 必须 >= 1，当前: ${battle.effectParams.burst.burstCount}`)
}
if (battle.effectParams.chain.chainBounces < 1) {
  errors.push(`effectParams.chain.chainBounces 必须 >= 1，当前: ${battle.effectParams.chain.chainBounces}`)
}
if (battle.effectParams.explode.explodeRadius <= 0) {
  errors.push(`effectParams.explode.explodeRadius 必须 > 0，当前: ${battle.effectParams.explode.explodeRadius}`)
}
```

- [ ] **Step 5: 更新 config/stages.ts**

将现有的植物引用更新为新的植物 ID。保持前几个阶段简单，用新的植物名：

Stage 1-3 的 plants 引用从 `['peashooter', 'snow_pea', 'repeater']` 改为合适的新组合。Stage 4-6 按新的多路配置更新 lanePlants 引用。

- [ ] **Step 6: 更新 config/index.ts 的类型导出**

```typescript
// 删除 Trajectory 导出，新增 Spread, Flight, Impact, EffectParamsDef
export type { PlantDef, ZombieDef, WaveDef, LevelDef, StageDef, DifficultyDef, BattleDef, SynergyDef, Element, Spread, Flight, Impact, EffectParamsDef } from './types'
```

- [ ] **Step 7: Commit**

```bash
git add src/config/
git commit -m "refactor(config): 四维植物配置 + effectParams + 12棵植物 + 校验更新"
```

---

### Task 9: BattleScene 适配

**Files:**
- Modify: `src/scenes/BattleScene.ts`

- [ ] **Step 1: 更新 resolvePlants 函数**

```typescript
// 替换旧的 resolvePlants（约第 46-58 行）
const resolvePlants = (ids: readonly string[]): PlantConfig[] =>
  ids.map(id => {
    const def = PLANT_DEFS.find(p => p.id === id)!
    return {
      id: def.id,
      name: def.name,
      comboSegment: def.comboSegment,
      attackPower: def.attackPower,
      hp: def.hp,
      element: def.element,
      spread: def.spread,
      flight: def.flight,
      impact: def.impact,
    }
  })
```

- [ ] **Step 2: 更新 BattleManager 构造参数**

```typescript
// 替换旧的弹道参数为 effectParams（约第 77-94 行）
this.manager = new BattleManager({
  laneCount,
  lanePlants,
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
  effectParams: BATTLE_PARAMS.effectParams,
})
```

- [ ] **Step 3: 更新 import 语句**

```typescript
// 删除旧的 Trajectory import（如果有），添加 Spread, Flight, Impact（如果需要）
// 大部分情况下 BattleScene 不直接用这些类型，只传配置
```

- [ ] **Step 4: Commit**

```bash
git add src/scenes/BattleScene.ts
git commit -m "refactor(scene): BattleScene 适配四维植物配置和 effectParams"
```

---

### Task 10: 校验测试更新 + 全量测试

**Files:**
- Modify: `src/config/__tests__/validation.test.ts`
- Modify: `src/game/__tests__/BattleManager.test.ts`
- Modify: `src/game/__tests__/Lane.test.ts`

- [ ] **Step 1: 更新 validation 测试**

将所有测试中的 `trajectory` 引用替换为 `spread`/`flight`/`impact`。更新不合法值的测试用例：

- `trajectory: 'invalid'` → 分别测试 `spread: 'invalid'`、`flight: 'invalid'`、`impact: 'invalid'`
- battle 参数校验测试从 `areaBulletCount` 等更新为 `effectParams.fan.fanBulletCount` 等

- [ ] **Step 2: 更新 BattleManager 测试**

在所有 `makePlant` / `makeConfig` helper 中：
- `trajectory: 'direct'` → `spread: 'single', flight: 'straight', impact: 'vanish'`
- `trajectory: 'pierce'` → `spread: 'single', flight: 'straight', impact: 'pierce'`
- `trajectory: 'area'` → `spread: 'fan', flight: 'straight', impact: 'vanish'`
- `trajectory: 'tracking'` → `spread: 'single', flight: 'tracking', impact: 'vanish'`
- `areaBulletCount` → `effectParams.fan.fanBulletCount`
- `areaSpreadAngle` → `effectParams.fan.fanSpreadAngle`
- `areaDamageDecay` → 删除（不再需要，fan 弹道无衰减）
- `trackingTurnRate` → `effectParams.tracking.trackingTurnRate`
- 添加所有 effectParams 的默认值到 makeConfig

同时更新 `Lane.test.ts` 中的 PlantConfig mock（`trajectory: 'direct'` → `spread: 'single', flight: 'straight', impact: 'vanish'`）。

BattleConfig mock helper 需要添加完整的 effectParams：

```typescript
const defaultEffectParams = {
  burst: { burstCount: 3, burstInterval: 80 },
  fan: { fanBulletCount: 5, fanSpreadAngle: Math.PI / 3 },
  tracking: { trackingTurnRate: Math.PI },
  chain: { chainBounces: 3, chainRange: 200 },
  explode: { explodeRadius: 80, explodeDamageRatio: 0.6 },
  ice: { slowRatio: 0.5, slowDuration: 3 },
  fire: { burnDps: 5, burnDuration: 3 },
  electric: { conductRadius: 100, conductDamageDecay: 0.7, conductMaxJumps: 3 },
  stun: { stunDuration: 1.5 },
  knockback: { knockbackDistance: 60 },
}
```

- [ ] **Step 3: 运行全量测试**

Run: `npx vitest run`
Expected: 所有测试 PASS

- [ ] **Step 4: Commit**

```bash
git add src/config/__tests__/ src/game/__tests__/
git commit -m "test: 全量测试适配四维特效合成系统 v2"
```

---

### Task 11: 浏览器验收 + 最终提交

**Files:** 无新文件

- [ ] **Step 1: 启动 dev server**

Run: `npm run dev`

- [ ] **Step 2: 浏览器验收**

在浏览器中验证：
1. 主菜单能进入战斗
2. 打字连击正常推进
3. 按错/空格结算，弹道正常发射
4. 单发/连发/扇形散射视觉正确
5. 追踪弹道曲线飞行正常
6. 穿透弹道穿过多只僵尸
7. 元素颜色正确渲染（6 种颜色）
8. 僵尸被击中后状态效果生效（减速可观察到移动变慢）

- [ ] **Step 3: 更新 ROADMAP.md**

在阶段四 4.1+4.2 的完成记录中注明 v2 重构。

- [ ] **Step 4: 最终提交**

```bash
git add docs/ROADMAP.md
git commit -m "docs: 更新 ROADMAP 标记特效合成系统 v2 完成"
```
