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

    // 更新 canvas 逻辑尺寸（与 Renderer.resize 同源）
    this.canvasWidth = typeof window !== 'undefined' ? window.innerWidth : 800
    this.canvasHeight = typeof window !== 'undefined' ? window.innerHeight : 600

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
        if (intersects(bullet, block)) {
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
