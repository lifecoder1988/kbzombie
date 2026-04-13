# Demo 升级实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重写 DemoScene，用引擎标准 API（EntityManager、Entity 接口、RenderLayer、getByTag、intersects）实现子弹碰撞色块的演示，作为阶段二代码参考。

**Architecture:** 定义 BlockEntity 和 BulletEntity 两个 Entity 实现，BattleScene 通过 EntityManager 管理实体生命周期，每帧用 getByTag + intersects 做碰撞检测。MenuScene 和 App.tsx 不变。

**Tech Stack:** TypeScript strict, Canvas 2D

---

## 文件结构

```
src/demo/
└── DemoScene.ts    # 重写：BlockEntity + BulletEntity + MenuScene + BattleScene
```

仅修改此一个文件。App.tsx、引擎层零改动。

---

## Task 1: 重写 DemoScene.ts

**Files:**
- Modify: `src/demo/DemoScene.ts`

- [ ] **Step 1: 用以下完整代码替换 DemoScene.ts**

```ts
// src/demo/DemoScene.ts
import type { Scene, InputEvent, Entity } from '../engine/types'
import { RenderLayer } from '../engine/types'
import { EntityManager } from '../engine/EntityManager'
import { intersects } from '../engine/CollisionDetection'

// --- 共享常量 ---

const BLOCK_TAGS: ReadonlySet<string> = new Set(['block'])
const BULLET_TAGS: ReadonlySet<string> = new Set(['bullet'])

let entityIdCounter = 0
function nextEntityId(prefix: string): string {
  return `${prefix}-${entityIdCounter++}`
}

// --- 实体：色块（从右往左移动的目标） ---

class BlockEntity implements Entity {
  readonly id: string
  x: number
  y: number
  width = 50
  height = 60
  active = true
  layer = RenderLayer.Entity
  tags = BLOCK_TAGS
  readonly letter: string
  readonly speed: number

  constructor(letter: string, x: number, y: number, speed: number) {
    this.id = nextEntityId('block')
    this.letter = letter
    this.x = x
    this.y = y
    this.speed = speed
  }

  update(dt: number): void {
    this.x -= this.speed * (dt / 1000)
    if (this.x + this.width < 0) {
      this.active = false
      console.log('missed')
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#e94560'
    ctx.fillRect(this.x, this.y, this.width, this.height)

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 28px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(this.letter, this.x + this.width / 2, this.y - 10)
  }
}

// --- 实体：子弹（从左往右飞行的弹道） ---

class BulletEntity implements Entity {
  readonly id: string
  x: number
  y: number
  width = 12
  height = 8
  active = true
  layer = RenderLayer.Effect
  tags = BULLET_TAGS
  readonly targetLetter: string
  private readonly speed: number
  private readonly rightBound: number

  constructor(targetLetter: string, x: number, y: number, speed: number, rightBound: number) {
    this.id = nextEntityId('bullet')
    this.targetLetter = targetLetter
    this.x = x
    this.y = y
    this.speed = speed
    this.rightBound = rightBound
  }

  update(dt: number): void {
    this.x += this.speed * (dt / 1000)
    if (this.x > this.rightBound) {
      this.active = false
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#ffd700'
    ctx.fillRect(this.x, this.y, this.width, this.height)
  }
}

// --- 场景：主菜单 ---

export class MenuScene implements Scene {
  readonly name = 'menu'
  private switchTo: (name: string) => void

  constructor(switchTo: (name: string) => void) {
    this.switchTo = switchTo
  }

  enter(): void {}
  exit(): void {}
  update(_dt: number): void {}

  render(ctx: CanvasRenderingContext2D): void {
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1
    const w = ctx.canvas.width / dpr
    const h = ctx.canvas.height / dpr

    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, w, h)

    ctx.fillStyle = '#e94560'
    ctx.font = 'bold 48px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('键盘侠大战僵尸', w / 2, h / 2 - 40)

    ctx.fillStyle = '#ffffff'
    ctx.font = '24px sans-serif'
    ctx.fillText('按空格开始', w / 2, h / 2 + 30)
  }

  handleInput(event: InputEvent): void {
    if (event.type === 'keydown' && event.key === ' ') {
      this.switchTo('battle')
    }
  }
}

// --- 场景：战斗（引擎特性演示） ---

export class BattleScene implements Scene {
  readonly name = 'battle'
  private switchTo: (name: string) => void
  private entityManager = new EntityManager()
  private spawnTimer = 0
  private paused = false
  private canvasWidth = 0
  private canvasHeight = 0

  // 演示用硬编码参数（Demo 不进后续迭代）
  private readonly spawnInterval = 2000
  private readonly letters = 'fjdksla'
  private readonly bulletSpeed = 400
  private readonly bulletX = 60

  constructor(switchTo: (name: string) => void) {
    this.switchTo = switchTo
  }

  enter(): void {
    this.entityManager.clear()
    this.spawnTimer = 0
    this.paused = false
  }

  exit(): void {
    this.entityManager.clear()
  }

  update(dt: number): void {
    if (this.paused) return

    // 1. 定时生成色块
    this.spawnTimer += dt
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer -= this.spawnInterval
      this.spawnBlock()
    }

    // 2. 更新所有实体（EntityManager 驱动 Entity.update）
    this.entityManager.update(dt)

    // 3. 碰撞检测：getByTag 查询 + intersects 空间判定
    this.checkCollisions()
  }

  render(ctx: CanvasRenderingContext2D): void {
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1
    this.canvasWidth = ctx.canvas.width / dpr
    this.canvasHeight = ctx.canvas.height / dpr

    // 背景
    ctx.fillStyle = '#0f3460'
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight)

    // 实体绘制（EntityManager 按 RenderLayer 排序：Entity 层色块先画，Effect 层子弹后画）
    this.entityManager.render(ctx)

    // 暂停遮罩
    if (this.paused) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
      ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 36px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('已暂停 - 按 P 继续', this.canvasWidth / 2, this.canvasHeight / 2)
    }

    // HUD
    ctx.fillStyle = '#ffffff'
    ctx.font = '16px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('按字母发射子弹 | P 暂停 | ESC 返回菜单', 10, 25)
  }

  handleInput(event: InputEvent): void {
    if (event.type !== 'keydown') return

    if (event.key === 'Escape') {
      this.switchTo('menu')
      return
    }

    if (event.key === 'p' || event.key === 'P') {
      this.paused = !this.paused
      return
    }

    if (this.paused) return

    const key = event.key.toLowerCase()
    if (key.length !== 1 || key < 'a' || key > 'z') return

    // 在所有 block 中找最左边（最靠近边界）的匹配字母
    const blocks = this.entityManager.getByTag('block')
    let target: BlockEntity | null = null
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i] as BlockEntity
      if (block.letter === key) {
        if (!target || block.x < target.x) target = block
      }
    }

    if (target) {
      // 从左侧固定位置发射子弹，y 居中对齐目标色块
      const bullet = new BulletEntity(
        key,
        this.bulletX,
        target.y + target.height / 2 - 4,
        this.bulletSpeed,
        this.canvasWidth,
      )
      this.entityManager.add(bullet)
    }
  }

  /**
   * 碰撞检测循环（阶段二 弹道 vs 僵尸 的标准模式参考）：
   * 1. getByTag 按类型查出两组实体
   * 2. 双层循环 + intersects 空间判定
   * 3. 命中后 remove 双方
   */
  private checkCollisions(): void {
    const bullets = this.entityManager.getByTag('bullet')
    const blocks = this.entityManager.getByTag('block')
    for (let i = 0; i < bullets.length; i++) {
      const bullet = bullets[i] as BulletEntity
      if (!bullet.active) continue
      for (let j = 0; j < blocks.length; j++) {
        const block = blocks[j] as BlockEntity
        if (!block.active) continue
        if (bullet.targetLetter === block.letter && intersects(bullet, block)) {
          this.entityManager.remove(bullet)
          this.entityManager.remove(block)
          break
        }
      }
    }
  }

  private spawnBlock(): void {
    const letter = this.letters[Math.floor(Math.random() * this.letters.length)]
    const block = new BlockEntity(
      letter,
      this.canvasWidth > 0 ? this.canvasWidth : 800,
      100 + Math.random() * 300,
      80 + Math.random() * 40,
    )
    this.entityManager.add(block)
  }
}
```

> **引擎特性覆盖清单**：
> - `Entity` 接口：BlockEntity（Entity 层）+ BulletEntity（Effect 层）
> - `EntityManager`：add/remove/update/render/clear/getByTag
> - `RenderLayer`：色块 Entity 层，子弹 Effect 层
> - `getByTag`：碰撞检测前按 tag 查询
> - `intersects`：AABB 碰撞判定
> - `Scene` 接口：enter/exit/update/render/handleInput
> - `SceneManager`：菜单 ↔ 战斗切换

- [ ] **Step 2: 编译检查**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 运行全部测试确认无回归**

Run: `npx vitest run`
Expected: 48 个测试全部通过（Demo 无独立测试，确认引擎测试不受影响）

- [ ] **Step 4: Commit**

```bash
git add src/demo/DemoScene.ts
git commit -m "feat(demo): 升级 Demo 演示引擎全部特性 —— Entity/EntityManager/RenderLayer/碰撞检测"
```

---

## Task 2: 浏览器验证

- [ ] **Step 1: 启动开发服务器**

Run: `npm run dev`

- [ ] **Step 2: 在浏览器中验证以下行为**

| 验证项 | 预期行为 |
|--------|----------|
| 菜单场景 | 显示标题和"按空格开始" |
| 按空格 | 切换到战斗场景 |
| 色块生成 | 每 2 秒从右侧生成一个带字母的红色色块，向左移动 |
| 打字发射子弹 | 按匹配字母 → 左侧出现黄色小方块，水平向右飞行 |
| 碰撞击杀 | 子弹飞到匹配色块位置 → 两者同时消失 |
| 渲染层级 | 子弹（金色）在色块（红色）上方（Effect 层 > Entity 层） |
| 色块出界 | 色块走出左边界 → 消失，控制台输出 'missed' |
| 子弹出界 | 子弹飞出右边界 → 消失 |
| 暂停 | 按 P → 暂停/恢复，暂停时显示遮罩 |
| 返回菜单 | 按 ESC → 回到菜单，再按空格重新进入战斗（实体重置） |

- [ ] **Step 3: 确认无误后完成**

如果发现问题，修复后重新验证。
