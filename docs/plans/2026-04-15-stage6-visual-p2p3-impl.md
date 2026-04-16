# 6.3 P2+P3 Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add scene transitions, animated settlement, wave announcements, menu background, damage numbers, plant idle animation, and entity shadows.

**Architecture:** 7 independent visual improvements. Two new VfxObjects (WaveAnnounce, DamageNumber), SettlementScene rewrite for timeline-driven reveal, PlantEntity idle motion, renderer shadow additions, and scene fade-in across 5 scenes. MenuScene gets animated background with scrolling grass and zombie silhouettes.

**Tech Stack:** TypeScript, Canvas 2D, Web Audio API (existing SoundSynthesizer)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/scenes/vfx/WaveAnnounce.ts` | Wave start text fly-in VfxObject |
| Create | `src/scenes/vfx/DamageNumber.ts` | Damage number float-up VfxObject |
| Modify | `src/game/ZombieEntity.ts:67` | Add `maxHp` public getter |
| Modify | `src/game/types.ts:104` | Add `hp` field to zombieDeath event |
| Modify | `src/game/BattleManager.ts:389` | Include `z.maxHp` in zombieDeath event |
| Modify | `src/game/PlantEntity.ts` | Add `idlePhase` field + idle offset |
| Modify | `src/scenes/renderers/PlantRenderer.ts` | Add shadow ellipse |
| Modify | `src/scenes/renderers/ZombieRenderer.ts` | Add shadow ellipse |
| Modify | `src/scenes/BattleScene.ts` | Wire WaveAnnounce + DamageNumber + fade-in |
| Modify | `src/scenes/SettlementScene.ts` | Rewrite with timeline-driven animated reveal |
| Modify | `src/scenes/MenuScene.ts` | Animated background with grass + silhouettes |
| Modify | `src/scenes/StageSelectScene.ts` | Add fade-in |
| Modify | `src/scenes/PlantSelectScene.ts` | Add fade-in |

---

### Task 1: Plant Idle Animation (P3-2)

**Files:**
- Modify: `src/game/PlantEntity.ts`

- [ ] **Step 1: Add idlePhase field to PlantEntity**

In `src/game/PlantEntity.ts`, add `idlePhase` field after `bounceTimer`:

```typescript
// After line 28:
bounceTimer = 0
idlePhase = 0
```

Initialize `idlePhase` from `plantIndex` in constructor, after line 35:

```typescript
this.plantIndex = plantIndex
this.idlePhase = plantIndex * 0.7
```

- [ ] **Step 2: Update idlePhase in update()**

Replace the `update` method:

```typescript
update(dt: number): void {
  if (this.bounceTimer > 0) {
    this.bounceTimer -= dt
    if (this.bounceTimer < 0) this.bounceTimer = 0
  }
  this.idlePhase += dt * 2
}
```

- [ ] **Step 3: Use combined offset in render()**

In the `render` method, replace the `bounceOffsetY` calculation:

```typescript
const bounceOffsetY = this.bounceTimer > 0
  ? -12 * Math.sin(this.bounceTimer / 0.2 * Math.PI)
  : 0
const idleOffsetY = Math.sin(this.idlePhase) * 2
const totalOffsetY = bounceOffsetY + idleOffsetY
```

Then replace every occurrence of `bounceOffsetY` in the rest of `render()` with `totalOffsetY`. There are 6 occurrences:
- `drawPlant(ctx, this.x, this.y, this.width, this.height, baseColor, alive, totalOffsetY, plantId)`
- `ctx.strokeRect(this.x - 2, this.y + totalOffsetY - 2, ...)`
- `const barY = this.y + totalOffsetY + this.height + 4`
- `ctx.fillText(name, this.x + this.width / 2, this.y + totalOffsetY + this.height / 2 + 5)`
- `const ly = this.y + totalOffsetY - 10`

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: All 317 tests pass (no behavioral change, only visual offset)

- [ ] **Step 5: Commit**

```bash
git add src/game/PlantEntity.ts
git commit -m "feat(visual): plant idle floating animation (±2px sine wave)"
```

---

### Task 2: Entity Shadows (P3-3)

**Files:**
- Modify: `src/scenes/renderers/PlantRenderer.ts`
- Modify: `src/scenes/renderers/ZombieRenderer.ts`

- [ ] **Step 1: Add shadow to PlantRenderer**

In `src/scenes/renderers/PlantRenderer.ts`, at the start of `drawPlant` function body (after `const cy = y + bounceOffsetY`), add:

```typescript
// Shadow ellipse at plant base
ctx.save()
ctx.globalAlpha = 0.12
ctx.fillStyle = '#000000'
ctx.beginPath()
ctx.ellipse(x + w / 2, y + h, w * 0.35, 3, 0, 0, Math.PI * 2)
ctx.fill()
ctx.restore()
```

- [ ] **Step 2: Add shadow to ZombieRenderer**

In `src/scenes/renderers/ZombieRenderer.ts`, at the start of `drawZombie` function body (after the destructure line `const { flashTimer, walkPhase, state, statuses, statusCount } = options`), before the `const flash = flashTimer > 0` line, add:

```typescript
// Shadow ellipse at zombie base
ctx.save()
ctx.globalAlpha = 0.12
ctx.fillStyle = '#000000'
ctx.beginPath()
ctx.ellipse(x + w / 2, y + h, w * 0.35, 3, 0, 0, Math.PI * 2)
ctx.fill()
ctx.restore()
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/scenes/renderers/PlantRenderer.ts src/scenes/renderers/ZombieRenderer.ts
git commit -m "feat(visual): entity shadows (ellipse at base)"
```

---

### Task 3: Wave Announce VFX (P2-3)

**Files:**
- Create: `src/scenes/vfx/WaveAnnounce.ts`
- Modify: `src/scenes/BattleScene.ts`

- [ ] **Step 1: Create WaveAnnounce VfxObject**

Create `src/scenes/vfx/WaveAnnounce.ts`:

```typescript
import type { VfxObject } from '../VfxManager'

// Animation phases: fly-in (0.3s) → hold (0.6s) → scale-out (0.3s)
const FLY_IN = 0.3
const HOLD = 0.6
const SCALE_OUT = 0.3
const TOTAL = FLY_IN + HOLD + SCALE_OUT

export class WaveAnnounce implements VfxObject {
  alive = true
  _poolType?: string

  private text = ''
  private centerX = 0
  private centerY = 0
  private elapsed = 0

  init(waveIndex: number, totalWaves: number, centerX: number, centerY: number): void {
    this.text = `Wave ${waveIndex + 1} / ${totalWaves}`
    this.centerX = centerX
    this.centerY = centerY
    this.elapsed = 0
    this.alive = true
  }

  reset(): void {
    this.elapsed = 0
    this.alive = true
  }

  update(dt: number): void {
    this.elapsed += dt
    if (this.elapsed >= TOTAL) {
      this.alive = false
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const t = this.elapsed
    let x: number
    let scale: number
    let alpha: number

    if (t < FLY_IN) {
      // Fly in from right: easeOut
      const p = t / FLY_IN
      const ease = 1 - (1 - p) * (1 - p)
      x = this.centerX + 600 * (1 - ease)
      scale = 1
      alpha = ease
    } else if (t < FLY_IN + HOLD) {
      // Hold at center
      x = this.centerX
      scale = 1
      alpha = 1
    } else {
      // Scale out + fade
      const p = (t - FLY_IN - HOLD) / SCALE_OUT
      x = this.centerX
      scale = 1 + p * 0.5
      alpha = 1 - p
    }

    ctx.save()
    ctx.globalAlpha = Math.max(0, alpha)
    ctx.translate(x, this.centerY)
    ctx.scale(scale, scale)

    // Text with outline
    ctx.font = 'bold 48px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)'
    ctx.lineWidth = 4
    ctx.strokeText(this.text, 0, 0)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(this.text, 0, 0)

    ctx.restore()
  }
}
```

- [ ] **Step 2: Wire into BattleScene**

In `src/scenes/BattleScene.ts`, add import:

```typescript
import { WaveAnnounce } from './vfx/WaveAnnounce'
```

Replace the `waveStart` case in `processGameEvent`:

```typescript
case 'waveStart': {
  this.sound.play('waveStart')
  const announce = this.vfxManager.acquire('waveAnnounce', () => new WaveAnnounce())
  announce.init(event.waveIndex, event.totalWaves, GAME_WIDTH / 2, this.gameAreaHeight / 2)
  this.vfxManager.spawn(announce)
  break
}
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/scenes/vfx/WaveAnnounce.ts src/scenes/BattleScene.ts
git commit -m "feat(vfx): wave start announcement (fly-in → hold → scale-out)"
```

---

### Task 4: Damage Numbers (P3-1)

**Files:**
- Create: `src/scenes/vfx/DamageNumber.ts`
- Modify: `src/game/ZombieEntity.ts`
- Modify: `src/game/types.ts`
- Modify: `src/game/BattleManager.ts`
- Modify: `src/scenes/BattleScene.ts`

- [ ] **Step 1: Add maxHp getter to ZombieEntity**

In `src/game/ZombieEntity.ts`, after line 67 (`get currentHp`):

```typescript
get currentHp(): number { return this._currentHp }
get maxHp(): number { return this.maxHp }
```

Wait — `maxHp` is already the private field name. Use a different getter name or rename the field:

Replace the private field declaration (line 39):
```typescript
private readonly _maxHp: number
```

Replace the constructor assignment (line 56):
```typescript
this._maxHp = params.hp
this._currentHp = params.hp
```

Replace the hpRatio line (line ~213):
```typescript
const hpRatio = this._currentHp / this._maxHp
```

Add getter after `get currentHp`:
```typescript
get maxHp(): number { return this._maxHp }
```

- [ ] **Step 2: Add hp field to zombieDeath GameEvent**

In `src/game/types.ts`, update the zombieDeath event type:

```typescript
| { readonly type: 'zombieDeath'; readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly color: string; readonly hp: number }
```

- [ ] **Step 3: Include hp in BattleManager event push**

In `src/game/BattleManager.ts`, update the zombieDeath event push (~line 389):

```typescript
this._events.push({ type: 'zombieDeath', x: z.x, y: z.y, width: z.width, height: z.height, color: z.zombieColor, hp: z.maxHp })
```

- [ ] **Step 4: Create DamageNumber VfxObject**

Create `src/scenes/vfx/DamageNumber.ts`:

```typescript
import type { VfxObject } from '../VfxManager'

const DURATION = 0.6
const FLOAT_DISTANCE = 40

export class DamageNumber implements VfxObject {
  alive = true
  _poolType?: string

  private x = 0
  private startY = 0
  private value = 0
  private elapsed = 0

  init(x: number, y: number, value: number): void {
    this.x = x
    this.startY = y
    this.value = value
    this.elapsed = 0
    this.alive = true
  }

  reset(): void {
    this.elapsed = 0
    this.alive = true
  }

  update(dt: number): void {
    this.elapsed += dt
    if (this.elapsed >= DURATION) {
      this.alive = false
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const t = this.elapsed / DURATION
    const y = this.startY - FLOAT_DISTANCE * t
    const alpha = 1 - t * t  // Ease out fade

    ctx.save()
    ctx.globalAlpha = Math.max(0, alpha)
    ctx.fillStyle = '#ffd700'
    ctx.font = 'bold 24px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(this.value), this.x, y)
    ctx.restore()
  }
}
```

- [ ] **Step 5: Wire DamageNumber into BattleScene**

In `src/scenes/BattleScene.ts`, add import:

```typescript
import { DamageNumber } from './vfx/DamageNumber'
```

In the `zombieDeath` case of `processGameEvent`, after the particle debris spawn, add:

```typescript
// Damage number
const dmgNum = this.vfxManager.acquire('damageNumber', () => new DamageNumber())
dmgNum.init(event.x + event.width / 2, event.y, event.hp)
this.vfxManager.spawn(dmgNum)
```

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/game/ZombieEntity.ts src/game/types.ts src/game/BattleManager.ts src/scenes/vfx/DamageNumber.ts src/scenes/BattleScene.ts
git commit -m "feat(vfx): damage numbers on zombie death + maxHp getter"
```

---

### Task 5: Settlement Animated Reveal (P2-2)

**Files:**
- Modify: `src/scenes/SettlementScene.ts`

- [ ] **Step 1: Rewrite SettlementScene with timeline animation**

Replace the entire content of `src/scenes/SettlementScene.ts`:

```typescript
// src/scenes/SettlementScene.ts
import type { Scene, InputEvent } from '../engine/types'
import type { BattleStatsData } from '../game/BattleStats'
import { SoundSynthesizer } from './SoundSynthesizer'

export interface SettlementSceneParams {
  result: 'victory' | 'defeat'
  stats: BattleStatsData
  stars: number               // 0 (defeat) or 1-3
  title: string               // title (victory) or encouragement (defeat)
  stageIndex: number
  levelIndex: number
  rewards?: { unlockPlants?: readonly string[]; slotIncrease?: number }
  isFirstCompletion?: boolean
  plantNames?: Readonly<Record<string, string>>
}

type SettlementAction = 'continue' | 'replay' | 'select'

// Timeline: each element appears at a scheduled time
const FADE_IN_END = 0.3
const TITLE_START = 0.3
const TITLE_DUR = 0.3
const STATS_START = 0.7
const STAT_INTERVAL = 0.35
const STAT_DUR = 0.3       // each stat number animates over this duration
const STAR_INTERVAL = 0.2
const REWARD_DUR = 0.3
const BUTTON_DUR = 0.3

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t)
}

function bounceEase(t: number): number {
  if (t < 0.6) {
    return (t / 0.6) * (t / 0.6) * (1 / 0.36)  // overshoot slightly
  }
  if (t < 0.8) {
    return 1 + 0.15 * Math.sin((t - 0.6) / 0.2 * Math.PI)
  }
  return 1
}

export class SettlementScene implements Scene {
  readonly name = 'settlement'
  private switchTo: (name: string) => void
  private onAction: ((action: SettlementAction, stageIndex: number, levelIndex: number) => void) | null = null
  private params: SettlementSceneParams | null = null
  private canvasWidth = 0
  private canvasHeight = 0
  private elapsed = 0
  private inputEnabled = false
  private sound = new SoundSynthesizer()

  // Pre-computed timeline endpoints
  private starsStart = 0
  private rewardsStart = 0
  private buttonsStart = 0
  private totalRevealTime = 0

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
    this.sound.init()
    this.canvasWidth = typeof window !== 'undefined' ? window.innerWidth : 800
    this.canvasHeight = typeof window !== 'undefined' ? window.innerHeight : 600
    this.elapsed = 0
    this.inputEnabled = false

    // Compute timeline
    const statsEnd = STATS_START + 4 * STAT_INTERVAL + STAT_DUR
    this.starsStart = statsEnd + 0.3
    const starsEnd = this.starsStart + (this.params?.stars ?? 0) * STAR_INTERVAL
    this.rewardsStart = starsEnd + 0.3
    const hasRewards = this.params?.isFirstCompletion && this.params?.rewards &&
      ((this.params.rewards.unlockPlants?.length ?? 0) > 0 || (this.params.rewards.slotIncrease ?? 0) > 0)
    const rewardsEnd = hasRewards ? this.rewardsStart + REWARD_DUR : this.rewardsStart
    this.buttonsStart = rewardsEnd + 0.3
    this.totalRevealTime = this.buttonsStart + BUTTON_DUR
  }

  exit(): void {}

  update(dt: number): void {
    this.elapsed += dt
    if (!this.inputEnabled && this.elapsed >= this.totalRevealTime) {
      this.inputEnabled = true
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.params) return
    const { result, stats, stars, title } = this.params
    const w = this.canvasWidth
    const h = this.canvasHeight
    const t = this.elapsed

    // Background
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, w, h)

    // Fade-in overlay
    if (t < FADE_IN_END) {
      ctx.fillStyle = `rgba(0, 0, 0, ${1 - t / FADE_IN_END})`
      ctx.fillRect(0, 0, w, h)
    }

    ctx.textAlign = 'center'

    // Title — scale from 2 to 1
    if (t >= TITLE_START) {
      const tp = Math.min(1, (t - TITLE_START) / TITLE_DUR)
      const scale = 2 - easeOut(tp)
      const alpha = easeOut(tp)
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(w / 2, h * 0.18)
      ctx.scale(scale, scale)
      ctx.fillStyle = result === 'victory' ? '#ffd700' : '#e94560'
      ctx.font = 'bold 40px sans-serif'
      ctx.fillText(title, 0, 0)
      ctx.restore()
    }

    // Stats — number counting up
    const dataStartY = h * 0.38
    const lineHeight = 36
    const labels = [
      { label: '击杀僵尸', value: stats.zombiesKilled },
      { label: '最长连击', value: stats.longestCombo },
      { label: '协同攻击', value: stats.synergyCount },
      { label: '放过僵尸', value: stats.missedCount },
    ]

    for (let i = 0; i < labels.length; i++) {
      const statStart = STATS_START + i * STAT_INTERVAL
      if (t < statStart) break

      const sp = Math.min(1, (t - statStart) / STAT_DUR)
      const displayValue = Math.floor(labels[i].value * easeOut(sp))
      const alpha = Math.min(1, (t - statStart) / 0.15)
      const y = dataStartY + i * lineHeight

      ctx.globalAlpha = alpha
      ctx.font = '22px sans-serif'
      ctx.fillStyle = '#aaaaaa'
      ctx.textAlign = 'right'
      ctx.fillText(labels[i].label, w / 2 - 20, y)
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'left'
      ctx.fillText(String(displayValue), w / 2 + 20, y)
    }

    ctx.globalAlpha = 1

    // Stars — drop in one by one
    if (result === 'victory' && stars > 0 && t >= this.starsStart) {
      ctx.font = '36px sans-serif'
      ctx.textAlign = 'center'

      const fullStr = '\u2605'.repeat(stars) + '\u2606'.repeat(3 - stars)
      // Measure approximate per-star width
      const starWidth = 36

      for (let i = 0; i < 3; i++) {
        const starStart = this.starsStart + i * STAR_INTERVAL
        if (t < starStart) break

        const sp = Math.min(1, (t - starStart) / 0.2)
        const bEase = bounceEase(sp)
        const starY = h * 0.28 - 30 * (1 - bEase)
        const starX = w / 2 - (3 * starWidth / 2) + starWidth * i + starWidth / 2

        ctx.globalAlpha = Math.min(1, sp * 2)
        ctx.fillStyle = i < stars ? '#ffd700' : '#555555'
        ctx.fillText(i < stars ? '\u2605' : '\u2606', starX, starY)
      }
    }

    ctx.globalAlpha = 1

    // Rewards
    let rewardsEndY = dataStartY + labels.length * lineHeight
    if (result === 'victory' && this.params.isFirstCompletion && this.params.rewards && t >= this.rewardsStart) {
      const rp = Math.min(1, (t - this.rewardsStart) / REWARD_DUR)
      ctx.globalAlpha = easeOut(rp)

      const rewards = this.params.rewards
      rewardsEndY += 20

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

    ctx.globalAlpha = 1

    // Button hints — fade in
    if (t >= this.buttonsStart) {
      const bp = Math.min(1, (t - this.buttonsStart) / BUTTON_DUR)
      ctx.globalAlpha = easeOut(bp)

      const btnY = Math.max(rewardsEndY + 30, h * 0.72)
      ctx.font = '20px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillStyle = '#ffffff'

      if (result === 'victory') {
        ctx.fillText('[Enter] 继续    [R] 重玩', w / 2, btnY)
      } else {
        ctx.fillText('[Enter] 重试    [Esc] 选关', w / 2, btnY)
      }
    }

    ctx.globalAlpha = 1
  }

  handleInput(event: InputEvent): void {
    if (event.type !== 'keydown' || !this.params) return

    // Allow skipping the reveal animation
    if (!this.inputEnabled) {
      this.elapsed = this.totalRevealTime
      this.inputEnabled = true
      return
    }

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

Key design decisions:
- Any key press during reveal skips to fully revealed state (kids will mash keys)
- Numbers count from 0 to target using easeOut
- Stars drop from above with bounce
- Sound synthesizer initialized for future use (victory/defeat already played by BattleScene)

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: All tests pass (SettlementScene has no unit tests — it's a render-only scene)

- [ ] **Step 3: Commit**

```bash
git add src/scenes/SettlementScene.ts
git commit -m "feat(scenes): animated settlement reveal (counting numbers, bouncing stars, timed sequence)"
```

---

### Task 6: Scene Fade-In (P2-1)

**Files:**
- Modify: `src/scenes/BattleScene.ts`
- Modify: `src/scenes/MenuScene.ts`
- Modify: `src/scenes/StageSelectScene.ts`
- Modify: `src/scenes/PlantSelectScene.ts`

SettlementScene already has fade-in built into Task 5.

- [ ] **Step 1: Add fade-in to BattleScene**

In `src/scenes/BattleScene.ts`, add a field after `chewSoundTimer`:

```typescript
private fadeAlpha = 1
```

In `enter()`, after `this.battleEnded = false`:

```typescript
this.fadeAlpha = 1
```

In `update()`, after `this.sound.init()` (actually before the `if (!this.manager || this.paused) return`), add:

```typescript
if (this.fadeAlpha > 0) {
  this.fadeAlpha = Math.max(0, this.fadeAlpha - dt / 0.3)
}
```

In `render()`, just before `// Pause overlay (screen space)`, add the fade overlay (in screen space, after the scaled VFX rendering):

```typescript
// Fade-in overlay (screen space)
if (this.fadeAlpha > 0) {
  ctx.fillStyle = `rgba(0, 0, 0, ${this.fadeAlpha})`
  ctx.fillRect(0, 0, sw, sh)
}
```

- [ ] **Step 2: Add fade-in to MenuScene**

In `src/scenes/MenuScene.ts`, add fields:

```typescript
private fadeAlpha = 1
private elapsed = 0
```

Update `enter()` to reset:

```typescript
enter(): void {
  this.canvasWidth = typeof window !== 'undefined' ? window.innerWidth : 800
  this.canvasHeight = typeof window !== 'undefined' ? window.innerHeight : 600
  this.fadeAlpha = 1
  this.elapsed = 0
}
```

Replace `update`:

```typescript
update(dt: number): void {
  this.elapsed += dt
  if (this.fadeAlpha > 0) {
    this.fadeAlpha = Math.max(0, this.fadeAlpha - dt / 0.3)
  }
}
```

At the end of `render()`, before the closing brace, add:

```typescript
// Fade-in
if (this.fadeAlpha > 0) {
  ctx.fillStyle = `rgba(0, 0, 0, ${this.fadeAlpha})`
  ctx.fillRect(0, 0, w, h)
}
```

- [ ] **Step 3: Add fade-in to StageSelectScene**

In `src/scenes/StageSelectScene.ts`, add field:

```typescript
private fadeAlpha = 1
```

Update `enter()` to add `this.fadeAlpha = 1` at end.

Replace `update`:

```typescript
update(dt: number): void {
  if (this.fadeAlpha > 0) {
    this.fadeAlpha = Math.max(0, this.fadeAlpha - dt / 0.3)
  }
}
```

At end of `render()`, add:

```typescript
if (this.fadeAlpha > 0) {
  ctx.fillStyle = `rgba(0, 0, 0, ${this.fadeAlpha})`
  ctx.fillRect(0, 0, w, h)
}
```

- [ ] **Step 4: Add fade-in to PlantSelectScene**

Same pattern as StageSelectScene. In `src/scenes/PlantSelectScene.ts`:

Add field `private fadeAlpha = 1`.

In `enter()`, add `this.fadeAlpha = 1`.

Replace `update(_dt: number): void {}` with:

```typescript
update(dt: number): void {
  if (this.fadeAlpha > 0) {
    this.fadeAlpha = Math.max(0, this.fadeAlpha - dt / 0.3)
  }
}
```

At end of `render()`, add the same fade overlay.

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/scenes/BattleScene.ts src/scenes/MenuScene.ts src/scenes/StageSelectScene.ts src/scenes/PlantSelectScene.ts
git commit -m "feat(scenes): 0.3s fade-in transition on all scene entries"
```

---

### Task 7: Animated Menu Background (P2-4)

**Files:**
- Modify: `src/scenes/MenuScene.ts`

- [ ] **Step 1: Add background state and imports**

In `src/scenes/MenuScene.ts`, add imports at top:

```typescript
import { drawBattlefield } from './renderers/BattlefieldRenderer'
import { drawZombie } from './renderers/ZombieRenderer'
import { ZombieState } from '../game/types'
import { drawPlant } from './renderers/PlantRenderer'
```

Add silhouette state fields after `resetConfirm`:

```typescript
private scrollX = 0
private silhouettes = [
  { x: 900, y: 280, speed: 15, type: 'normal', walkPhase: 0 },
  { x: 1100, y: 180, speed: 12, type: 'roadblock', walkPhase: 1.5 },
  { x: 1300, y: 350, speed: 18, type: 'imp', walkPhase: 3.0 },
]
private plantIdlePhase = 0
```

- [ ] **Step 2: Update animation state in update()**

Replace the `update` method (which was updated in Task 6 with fade):

```typescript
update(dt: number): void {
  this.elapsed += dt
  if (this.fadeAlpha > 0) {
    this.fadeAlpha = Math.max(0, this.fadeAlpha - dt / 0.3)
  }

  // Scroll grass
  this.scrollX += dt * 10

  // Move silhouettes
  for (let i = 0; i < this.silhouettes.length; i++) {
    const s = this.silhouettes[i]
    s.x -= s.speed * dt
    s.walkPhase += dt * 3
    if (s.x < -80) {
      s.x = this.canvasWidth + 60 + Math.random() * 200
    }
  }

  // Plant sway
  this.plantIdlePhase += dt * 1.5
}
```

- [ ] **Step 3: Render background layers**

In `render()`, replace the background section (the first two lines after `const w` and `const h`):

Replace:
```typescript
// Background
ctx.fillStyle = '#1a1a2e'
ctx.fillRect(0, 0, w, h)
```

With:
```typescript
// Animated background
ctx.fillStyle = '#1a1a2e'
ctx.fillRect(0, 0, w, h)

// Scrolling grass (looping)
ctx.save()
ctx.globalAlpha = 0.3
const tileW = 800
const offsetX = -(this.scrollX % tileW)
for (let tx = offsetX; tx < w + tileW; tx += tileW) {
  ctx.save()
  ctx.translate(tx, 0)
  drawBattlefield(ctx, tileW, h, tileW * 0.35)
  ctx.restore()
}
ctx.restore()

// Zombie silhouettes
ctx.save()
ctx.globalAlpha = 0.15
const emptyStatuses: never[] = []
for (let i = 0; i < this.silhouettes.length; i++) {
  const s = this.silhouettes[i]
  drawZombie(ctx, s.x, s.y, 40, 60, s.type, '#666666', {
    flashTimer: 0,
    walkPhase: s.walkPhase,
    state: ZombieState.Walking,
    statuses: emptyStatuses,
    statusCount: 0,
  })
}
ctx.restore()

// Decorative plants — bottom left, swaying
ctx.save()
ctx.globalAlpha = 0.4
const sway1 = Math.sin(this.plantIdlePhase) * 3
const sway2 = Math.sin(this.plantIdlePhase + 1.5) * 3
drawPlant(ctx, 40, h - 100, 50, 60, '#22cc22', true, sway1, 'peashooter')
drawPlant(ctx, 120, h - 90, 45, 55, '#44aaff', true, sway2, 'snowpea')
ctx.restore()
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 5: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/scenes/MenuScene.ts
git commit -m "feat(scenes): animated menu background (scrolling grass, zombie silhouettes, plant decorations)"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 2: TypeScript strict check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Start dev server and test in browser**

Run: `npm run dev`

Verify each feature:
1. **Menu** — grass scrolls, zombies drift across, plants sway
2. **Scene transitions** — all scenes fade in from black on entry
3. **Battle** — plants gently float up/down, entities have small shadows
4. **Wave start** — "Wave N / M" flies in from right, holds, then scales out
5. **Zombie death** — gold damage number floats up from death position
6. **Settlement** — title zooms in, numbers count up, stars bounce in, buttons fade in
7. **Quick skip** — pressing any key during settlement reveal skips to final state

- [ ] **Step 4: Commit any fixes if needed**

- [ ] **Step 5: Update ROADMAP.md**

Mark P2 items (6.3.11 partial, 6.3.12, 6.3.13, 6.3.14) and P3 items (6.3.16, 6.3.17, 6.3.18) as complete with ✅.

```bash
git add docs/ROADMAP.md
git commit -m "docs: mark 6.3 P2+P3 visual polish items complete"
```
