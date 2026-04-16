# 阶段一：游戏引擎基础 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建游戏引擎底层框架——Game Loop、输入、实体、渲染、场景、资源加载、音效七个模块，最终产出一个可交互的 Demo 验证引擎骨架完整。

**Architecture:** 引擎层（`src/engine/`）是纯通用游戏能力，不包含任何业务概念（无 zombie/plant 等词）。React 只管 DOM UI 外壳（菜单等），Canvas 由引擎独立管理。所有模块面向接口设计，支持无头测试（不依赖浏览器 API 可跑逻辑）。

**Tech Stack:** Vite + React 18 + TypeScript strict + Vitest + Canvas 2D

---

## 文件结构

```
src/
├── engine/
│   ├── types.ts              # 引擎层所有接口和类型定义
│   ├── GameLoop.ts           # 游戏主循环
│   ├── InputManager.ts       # 键盘输入管理
│   ├── EntityManager.ts      # 实体生命周期管理
│   ├── Renderer.ts           # Canvas 分层渲染
│   ├── SceneManager.ts       # 场景切换管理
│   ├── AssetLoader.ts        # 资源预加载
│   ├── AudioManager.ts       # 音效管理
│   └── __tests__/
│       ├── GameLoop.test.ts
│       ├── InputManager.test.ts
│       ├── EntityManager.test.ts
│       ├── Renderer.test.ts
│       ├── SceneManager.test.ts
│       ├── AssetLoader.test.ts
│       └── AudioManager.test.ts
├── demo/
│   └── DemoScene.ts          # 阶段一验收 Demo 场景（不进后续迭代）
├── App.tsx                   # React 外壳，挂载 Canvas
├── main.tsx                  # 入口
└── index.css                 # 基础样式
```

---

## Task 1: 项目脚手架

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- Create: `src/main.tsx`, `src/App.tsx`, `src/index.css`
- Create: `vitest.config.ts`（如果不复用 vite.config.ts）

- [ ] **Step 1: 用 Vite 初始化 React + TypeScript 项目**

```bash
cd /Users/work/workspace/kbzombie
npm create vite@latest . -- --template react-ts
```

如果目录非空需要确认覆盖，选择覆盖（只会创建模板文件不会删除 docs/）。

- [ ] **Step 2: 安装依赖**

```bash
npm install
```

- [ ] **Step 3: 启用 TypeScript strict 模式**

编辑 `tsconfig.json`（或 `tsconfig.app.json`），确认：

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

Vite 模板默认已开启 strict，确认即可。

- [ ] **Step 4: 配置 Vitest**

```bash
npm install -D vitest
```

编辑 `vite.config.ts`，加入 test 配置：

```typescript
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
  },
})
```

在 `package.json` 中添加 test script：

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 5: 验证脚手架**

```bash
npm run dev      # 浏览器打开能看到 Vite 默认页面
npm test         # 无测试文件，应正常退出（exit 0）
```

- [ ] **Step 6: 清理 Vite 模板默认内容**

删除 `src/App.css`，清理 `src/App.tsx` 为最小骨架：

```tsx
export default function App() {
  return <div id="game-root"></div>
}
```

清理 `src/index.css` 为：

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body, #root { width: 100%; height: 100%; overflow: hidden; background: #000; }
#game-root { width: 100%; height: 100%; position: relative; }
```

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "feat: 初始化 Vite + React + TypeScript + Vitest 项目脚手架"
```

---

## Task 2: 引擎类型定义

**Files:**
- Create: `src/engine/types.ts`

定义引擎层所有模块共用的接口。这是后续所有 Task 的基础，先锁定接口再写实现。

- [ ] **Step 1: 编写引擎类型定义**

```typescript
// src/engine/types.ts

/** 可更新的对象 */
export interface Updatable {
  update(dt: number): void
}

/** 可渲染的对象 */
export interface Renderable {
  render(ctx: CanvasRenderingContext2D): void
}

/** 游戏实体 */
export interface Entity extends Updatable, Renderable {
  readonly id: string
  x: number
  y: number
  width: number
  height: number
  active: boolean
  layer: RenderLayer
  tags: ReadonlySet<string>
}

/** 渲染层级，数值越大越在上面 */
export enum RenderLayer {
  Background = 0,
  Entity = 1,
  Effect = 2,
  UI = 3,
}

/** 场景接口 */
export interface Scene {
  readonly name: string
  enter(): void
  exit(): void
  update(dt: number): void
  render(ctx: CanvasRenderingContext2D): void
  handleInput?(event: InputEvent): void
}

/** 引擎层的输入事件（与浏览器 KeyboardEvent 解耦） */
export interface InputEvent {
  readonly key: string
  readonly type: 'keydown' | 'keyup'
  readonly timestamp: number
}

/** 输入事件监听器 */
export type InputListener = (event: InputEvent) => void

/** 资源清单 */
export interface AssetManifest {
  images: Record<string, string>   // id → URL
  audio: Record<string, string>    // id → URL
}

/** 已加载的资源集合 */
export interface LoadedAssets {
  images: Map<string, HTMLImageElement>
  audio: Map<string, AudioBuffer>
}

/** 资源加载进度回调 */
export type AssetProgressCallback = (loaded: number, total: number) => void
```

- [ ] **Step 2: 提交**

```bash
git add src/engine/types.ts
git commit -m "feat: 定义引擎层接口和类型"
```

---

## Task 3: Game Loop

**Files:**
- Create: `src/engine/GameLoop.ts`
- Test: `src/engine/__tests__/GameLoop.test.ts`

引擎层采用"先实现后测试"策略。

- [ ] **Step 1: 实现 GameLoop**

```typescript
// src/engine/GameLoop.ts
import type { Updatable, Renderable } from './types'

export class GameLoop {
  private running = false
  private paused = false
  private lastTime = 0
  private rafId = 0
  private target: (Updatable & Renderable) | null = null

  start(target: Updatable & Renderable): void {
    if (this.running) return
    this.target = target
    this.running = true
    this.paused = false
    this.lastTime = performance.now()
    this.rafId = requestAnimationFrame((t) => this.loop(t))
  }

  stop(): void {
    this.running = false
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = 0
    }
  }

  pause(): void {
    this.paused = true
  }

  resume(): void {
    if (this.paused) {
      this.paused = false
      this.lastTime = performance.now()
    }
  }

  get isPaused(): boolean {
    return this.paused
  }

  get isRunning(): boolean {
    return this.running
  }

  /** 供测试用：手动推进一帧，不走 rAF */
  tick(dt: number, ctx?: CanvasRenderingContext2D): void {
    if (!this.target) return
    if (!this.paused) {
      this.target.update(dt)
    }
    if (ctx) {
      this.target.render(ctx)
    }
  }

  private loop(now: number): void {
    if (!this.running) return
    const dt = now - this.lastTime
    this.lastTime = now
    if (this.target) {
      if (!this.paused) {
        this.target.update(dt)
      }
      // render 每帧都调用（暂停时画面需要保持，不能不画）
      // 但当前没有 ctx 在 loop 中，render 由外部场景自行管理
      // GameLoop 只驱动 update，render 由挂载 Canvas 的地方调用
    }
    this.rafId = requestAnimationFrame((t) => this.loop(t))
  }
}
```

等一下——GameLoop 驱动 update 和 render，但 render 需要 Canvas context。有两种做法：(a) GameLoop 持有 ctx 引用；(b) GameLoop 只驱动 update，render 由 target 自己在 update 后调用。

选 (a)，让 GameLoop 完整驱动两个阶段，但 ctx 是可选的（无头测试时不传）：

```typescript
// src/engine/GameLoop.ts
import type { Updatable, Renderable } from './types'

export interface GameLoopTarget extends Updatable, Renderable {}

export class GameLoop {
  private running = false
  private paused = false
  private lastTime = 0
  private rafId = 0
  private target: GameLoopTarget | null = null
  private ctx: CanvasRenderingContext2D | null = null

  start(target: GameLoopTarget, ctx?: CanvasRenderingContext2D): void {
    if (this.running) return
    this.target = target
    this.ctx = ctx ?? null
    this.running = true
    this.paused = false
    this.lastTime = performance.now()
    this.rafId = requestAnimationFrame((t) => this.loop(t))
  }

  stop(): void {
    this.running = false
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = 0
    }
  }

  pause(): void {
    this.paused = true
  }

  resume(): void {
    if (this.paused) {
      this.paused = false
      this.lastTime = performance.now()
    }
  }

  get isPaused(): boolean {
    return this.paused
  }

  get isRunning(): boolean {
    return this.running
  }

  /** 手动推进一帧，用于测试（不走 rAF） */
  tick(dt: number): void {
    if (!this.target) return
    if (!this.paused) {
      this.target.update(dt)
    }
    if (this.ctx) {
      this.target.render(this.ctx)
    }
  }

  private loop(now: number): void {
    if (!this.running) return
    const dt = now - this.lastTime
    this.lastTime = now
    if (this.target) {
      if (!this.paused) {
        this.target.update(dt)
      }
      if (this.ctx) {
        this.target.render(this.ctx)
      }
    }
    this.rafId = requestAnimationFrame((t) => this.loop(t))
  }
}
```

- [ ] **Step 2: 编写测试**

```typescript
// src/engine/__tests__/GameLoop.test.ts
import { describe, it, expect, vi } from 'vitest'
import { GameLoop } from '../GameLoop'
import type { GameLoopTarget } from '../GameLoop'

function createMockTarget(): GameLoopTarget & { updates: number[]; renderCount: number } {
  return {
    updates: [],
    renderCount: 0,
    update(dt: number) {
      this.updates.push(dt)
    },
    render(_ctx: CanvasRenderingContext2D) {
      this.renderCount++
    },
  }
}

describe('GameLoop', () => {
  it('tick 调用 target.update 并传入 dt', () => {
    const loop = new GameLoop()
    const target = createMockTarget()
    loop.start(target)
    loop.stop() // 立刻停掉 rAF，只用 tick 手动驱动

    loop.tick(16)
    loop.tick(32)

    expect(target.updates).toEqual([16, 32])
  })

  it('暂停时 tick 不调用 update', () => {
    const loop = new GameLoop()
    const target = createMockTarget()
    loop.start(target)
    loop.stop()

    loop.tick(16)
    loop.pause()
    loop.tick(16)
    loop.tick(16)

    expect(target.updates).toEqual([16])
    expect(loop.isPaused).toBe(true)
  })

  it('恢复后 tick 继续调用 update', () => {
    const loop = new GameLoop()
    const target = createMockTarget()
    loop.start(target)
    loop.stop()

    loop.tick(16)
    loop.pause()
    loop.tick(16)
    loop.resume()
    loop.tick(16)

    expect(target.updates).toEqual([16, 16])
    expect(loop.isPaused).toBe(false)
  })

  it('没有 ctx 时不调用 render', () => {
    const loop = new GameLoop()
    const target = createMockTarget()
    loop.start(target) // 不传 ctx
    loop.stop()

    loop.tick(16)

    expect(target.renderCount).toBe(0)
  })

  it('没有 target 时 tick 不报错', () => {
    const loop = new GameLoop()
    expect(() => loop.tick(16)).not.toThrow()
  })
})
```

- [ ] **Step 3: 运行测试**

```bash
npm test
```

Expected: 全部 PASS。

- [ ] **Step 4: 提交**

```bash
git add src/engine/GameLoop.ts src/engine/__tests__/GameLoop.test.ts
git commit -m "feat: 实现 GameLoop，支持暂停/恢复和手动 tick 测试"
```

---

## Task 4: Input Manager

**Files:**
- Create: `src/engine/InputManager.ts`
- Test: `src/engine/__tests__/InputManager.test.ts`

- [ ] **Step 1: 实现 InputManager**

```typescript
// src/engine/InputManager.ts
import type { InputEvent, InputListener } from './types'

export class InputManager {
  private listeners: Set<InputListener> = new Set()
  private composing = false  // 中文输入法状态
  private pressedKeys: Set<string> = new Set()

  /** 绑定浏览器事件。无头测试时不调用此方法。 */
  attach(target: EventTarget): void {
    target.addEventListener('keydown', this.onKeyDown as EventListener)
    target.addEventListener('keyup', this.onKeyUp as EventListener)
    target.addEventListener('compositionstart', this.onCompositionStart as EventListener)
    target.addEventListener('compositionend', this.onCompositionEnd as EventListener)
  }

  detach(target: EventTarget): void {
    target.removeEventListener('keydown', this.onKeyDown as EventListener)
    target.removeEventListener('keyup', this.onKeyUp as EventListener)
    target.removeEventListener('compositionstart', this.onCompositionStart as EventListener)
    target.removeEventListener('compositionend', this.onCompositionEnd as EventListener)
  }

  /** 注册监听器 */
  addListener(listener: InputListener): void {
    this.listeners.add(listener)
  }

  removeListener(listener: InputListener): void {
    this.listeners.delete(listener)
  }

  /** 手动注入输入事件（用于测试或脚本化输入） */
  inject(event: InputEvent): void {
    this.dispatch(event)
  }

  /** 查询某个键是否正在按下 */
  isKeyPressed(key: string): boolean {
    return this.pressedKeys.has(key)
  }

  private dispatch(event: InputEvent): void {
    if (event.type === 'keydown') {
      this.pressedKeys.add(event.key)
    } else {
      this.pressedKeys.delete(event.key)
    }
    for (const listener of this.listeners) {
      listener(event)
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.composing) return          // 输入法激活时忽略
    if (e.repeat) return                // 长按去重
    e.preventDefault()
    this.dispatch({
      key: e.key,
      type: 'keydown',
      timestamp: e.timeStamp,
    })
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    if (this.composing) return
    this.dispatch({
      key: e.key,
      type: 'keyup',
      timestamp: e.timeStamp,
    })
  }

  private onCompositionStart = (): void => {
    this.composing = true
  }

  private onCompositionEnd = (): void => {
    this.composing = false
  }
}
```

- [ ] **Step 2: 编写测试**

```typescript
// src/engine/__tests__/InputManager.test.ts
import { describe, it, expect, vi } from 'vitest'
import { InputManager } from '../InputManager'
import type { InputEvent } from '../types'

describe('InputManager', () => {
  it('inject 派发事件给所有监听器', () => {
    const input = new InputManager()
    const received: InputEvent[] = []
    input.addListener((e) => received.push(e))

    input.inject({ key: 'f', type: 'keydown', timestamp: 100 })
    input.inject({ key: 'j', type: 'keydown', timestamp: 200 })

    expect(received).toHaveLength(2)
    expect(received[0].key).toBe('f')
    expect(received[1].key).toBe('j')
  })

  it('移除监听器后不再收到事件', () => {
    const input = new InputManager()
    const received: InputEvent[] = []
    const listener = (e: InputEvent) => received.push(e)

    input.addListener(listener)
    input.inject({ key: 'f', type: 'keydown', timestamp: 100 })
    input.removeListener(listener)
    input.inject({ key: 'j', type: 'keydown', timestamp: 200 })

    expect(received).toHaveLength(1)
  })

  it('isKeyPressed 追踪按键状态', () => {
    const input = new InputManager()
    input.addListener(() => {}) // 需要至少一个监听器

    expect(input.isKeyPressed('f')).toBe(false)

    input.inject({ key: 'f', type: 'keydown', timestamp: 100 })
    expect(input.isKeyPressed('f')).toBe(true)

    input.inject({ key: 'f', type: 'keyup', timestamp: 200 })
    expect(input.isKeyPressed('f')).toBe(false)
  })

  it('多个监听器都能收到事件', () => {
    const input = new InputManager()
    let count1 = 0
    let count2 = 0
    input.addListener(() => count1++)
    input.addListener(() => count2++)

    input.inject({ key: 'a', type: 'keydown', timestamp: 0 })

    expect(count1).toBe(1)
    expect(count2).toBe(1)
  })
})
```

- [ ] **Step 3: 运行测试**

```bash
npm test
```

Expected: 全部 PASS。

- [ ] **Step 4: 提交**

```bash
git add src/engine/InputManager.ts src/engine/__tests__/InputManager.test.ts
git commit -m "feat: 实现 InputManager，支持 inject 注入和输入法过滤"
```

---

## Task 5: Entity Manager

**Files:**
- Create: `src/engine/EntityManager.ts`
- Test: `src/engine/__tests__/EntityManager.test.ts`

- [ ] **Step 1: 实现 EntityManager**

```typescript
// src/engine/EntityManager.ts
import type { Entity, RenderLayer } from './types'

export class EntityManager {
  private entities: Entity[] = []
  private toAdd: Entity[] = []

  /** 添加实体（在当前帧末尾实际加入，避免遍历中修改列表） */
  add(entity: Entity): void {
    this.toAdd.push(entity)
  }

  /** 移除实体（标记为 inactive，下次 cleanup 时删除） */
  remove(entity: Entity): void {
    entity.active = false
  }

  /** 更新所有活跃实体 */
  update(dt: number): void {
    this.flush()
    for (let i = 0; i < this.entities.length; i++) {
      if (this.entities[i].active) {
        this.entities[i].update(dt)
      }
    }
    this.cleanup()
  }

  /** 按层级顺序渲染所有活跃实体 */
  render(ctx: CanvasRenderingContext2D): void {
    // 按 layer 排序后渲染（layer 值小的先画）
    const sorted = this.entities.filter(e => e.active)
    sorted.sort((a, b) => a.layer - b.layer)
    for (let i = 0; i < sorted.length; i++) {
      sorted[i].render(ctx)
    }
  }

  /** 按 tag 查询实体 */
  getByTag(tag: string): Entity[] {
    return this.entities.filter(e => e.active && e.tags.has(tag))
  }

  /** 获取所有活跃实体数量 */
  get count(): number {
    return this.entities.filter(e => e.active).length
  }

  /** 清空所有实体 */
  clear(): void {
    this.entities.length = 0
    this.toAdd.length = 0
  }

  /** 将待添加的实体加入主列表 */
  private flush(): void {
    if (this.toAdd.length > 0) {
      for (let i = 0; i < this.toAdd.length; i++) {
        this.entities.push(this.toAdd[i])
      }
      this.toAdd.length = 0
    }
  }

  /** 清理 inactive 的实体 */
  private cleanup(): void {
    let write = 0
    for (let read = 0; read < this.entities.length; read++) {
      if (this.entities[read].active) {
        this.entities[write] = this.entities[read]
        write++
      }
    }
    this.entities.length = write
  }
}
```

- [ ] **Step 2: 编写测试**

```typescript
// src/engine/__tests__/EntityManager.test.ts
import { describe, it, expect } from 'vitest'
import { EntityManager } from '../EntityManager'
import { RenderLayer } from '../types'
import type { Entity } from '../types'

let entityIdCounter = 0

function createEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: `entity-${entityIdCounter++}`,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    active: true,
    layer: RenderLayer.Entity,
    tags: new Set(),
    update(_dt: number) {},
    render(_ctx: CanvasRenderingContext2D) {},
    ...overrides,
  }
}

describe('EntityManager', () => {
  it('add 后 update 会调用实体的 update', () => {
    const mgr = new EntityManager()
    let updated = false
    const entity = createEntity({ update: () => { updated = true } })

    mgr.add(entity)
    mgr.update(16)

    expect(updated).toBe(true)
  })

  it('remove 后实体不再被 update', () => {
    const mgr = new EntityManager()
    let updateCount = 0
    const entity = createEntity({ update: () => { updateCount++ } })

    mgr.add(entity)
    mgr.update(16)        // updateCount = 1
    mgr.remove(entity)
    mgr.update(16)        // cleanup 后不再调用

    expect(updateCount).toBe(1)
  })

  it('count 返回活跃实体数', () => {
    const mgr = new EntityManager()
    const e1 = createEntity()
    const e2 = createEntity()

    mgr.add(e1)
    mgr.add(e2)
    mgr.update(0)  // flush

    expect(mgr.count).toBe(2)

    mgr.remove(e1)
    mgr.update(0)  // cleanup

    expect(mgr.count).toBe(1)
  })

  it('getByTag 按标签过滤实体', () => {
    const mgr = new EntityManager()
    const e1 = createEntity({ tags: new Set(['enemy']) })
    const e2 = createEntity({ tags: new Set(['friendly']) })
    const e3 = createEntity({ tags: new Set(['enemy']) })

    mgr.add(e1)
    mgr.add(e2)
    mgr.add(e3)
    mgr.update(0)

    const enemies = mgr.getByTag('enemy')
    expect(enemies).toHaveLength(2)
  })

  it('clear 清空所有实体', () => {
    const mgr = new EntityManager()
    mgr.add(createEntity())
    mgr.add(createEntity())
    mgr.update(0)

    mgr.clear()

    expect(mgr.count).toBe(0)
  })

  it('在 update 遍历中 add 的实体在下一帧生效', () => {
    const mgr = new EntityManager()
    const laterEntity = createEntity()
    let laterUpdated = false
    laterEntity.update = () => { laterUpdated = true }

    const firstEntity = createEntity({
      update: () => { mgr.add(laterEntity) }
    })

    mgr.add(firstEntity)
    mgr.update(16)  // firstEntity.update 中 add 了 laterEntity

    expect(laterUpdated).toBe(false)  // 本帧不会被 update

    mgr.update(16)  // 下一帧 laterEntity 被 flush 进来

    expect(laterUpdated).toBe(true)
  })
})
```

- [ ] **Step 3: 运行测试**

```bash
npm test
```

Expected: 全部 PASS。

- [ ] **Step 4: 提交**

```bash
git add src/engine/EntityManager.ts src/engine/__tests__/EntityManager.test.ts
git commit -m "feat: 实现 EntityManager，支持增删查和延迟添加"
```

---

## Task 6: Renderer

**Files:**
- Create: `src/engine/Renderer.ts`
- Test: `src/engine/__tests__/Renderer.test.ts`

- [ ] **Step 1: 实现 Renderer**

```typescript
// src/engine/Renderer.ts
import type { RenderLayer } from './types'

export interface RenderCommand {
  layer: RenderLayer
  execute(ctx: CanvasRenderingContext2D): void
}

export class Renderer {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private width = 0
  private height = 0
  private commands: RenderCommand[] = []

  /** 绑定 Canvas。无头测试时不调用。 */
  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.resize()
  }

  /** 获取 Canvas context（可能为 null，无头模式） */
  getContext(): CanvasRenderingContext2D | null {
    return this.ctx
  }

  getWidth(): number {
    return this.width
  }

  getHeight(): number {
    return this.height
  }

  /** 调整 Canvas 尺寸 */
  resize(width?: number, height?: number): void {
    if (this.canvas) {
      this.width = width ?? this.canvas.clientWidth
      this.height = height ?? this.canvas.clientHeight
      this.canvas.width = this.width
      this.canvas.height = this.height
    }
  }

  /** 添加渲染指令 */
  submit(command: RenderCommand): void {
    this.commands.push(command)
  }

  /** 执行所有渲染指令（按 layer 排序）并清空 */
  flush(): void {
    if (!this.ctx) return
    this.ctx.clearRect(0, 0, this.width, this.height)
    this.commands.sort((a, b) => a.layer - b.layer)
    for (let i = 0; i < this.commands.length; i++) {
      this.commands[i].execute(this.ctx)
    }
    this.commands.length = 0
  }

  /** 清空指令队列（不执行） */
  clear(): void {
    this.commands.length = 0
  }
}
```

- [ ] **Step 2: 编写测试**

```typescript
// src/engine/__tests__/Renderer.test.ts
import { describe, it, expect, vi } from 'vitest'
import { Renderer } from '../Renderer'
import { RenderLayer } from '../types'

describe('Renderer', () => {
  it('submit 收集渲染指令', () => {
    const renderer = new Renderer()
    const cmd = { layer: RenderLayer.Entity, execute: vi.fn() }

    renderer.submit(cmd)
    renderer.submit(cmd)

    // 没有 ctx，flush 不执行
    renderer.flush()
    expect(cmd.execute).not.toHaveBeenCalled()
  })

  it('clear 清空指令队列', () => {
    const renderer = new Renderer()
    const cmd = { layer: RenderLayer.Entity, execute: vi.fn() }

    renderer.submit(cmd)
    renderer.clear()

    // 验证 clear 后再 submit 新指令能正常工作
    const cmd2 = { layer: RenderLayer.UI, execute: vi.fn() }
    renderer.submit(cmd2)

    // 内部状态正常（无 ctx 不会执行，但不报错）
    expect(() => renderer.flush()).not.toThrow()
  })

  it('getContext 未 attach 时返回 null', () => {
    const renderer = new Renderer()
    expect(renderer.getContext()).toBeNull()
  })
})
```

- [ ] **Step 3: 运行测试**

```bash
npm test
```

Expected: 全部 PASS。

- [ ] **Step 4: 提交**

```bash
git add src/engine/Renderer.ts src/engine/__tests__/Renderer.test.ts
git commit -m "feat: 实现 Renderer，指令式分层渲染"
```

---

## Task 7: Scene Manager

**Files:**
- Create: `src/engine/SceneManager.ts`
- Test: `src/engine/__tests__/SceneManager.test.ts`

- [ ] **Step 1: 实现 SceneManager**

```typescript
// src/engine/SceneManager.ts
import type { Scene, InputEvent, Updatable, Renderable } from './types'
import type { GameLoopTarget } from './GameLoop'

export class SceneManager implements GameLoopTarget {
  private currentScene: Scene | null = null
  private scenes: Map<string, Scene> = new Map()

  register(scene: Scene): void {
    this.scenes.set(scene.name, scene)
  }

  switchTo(name: string): void {
    const next = this.scenes.get(name)
    if (!next) {
      throw new Error(`Scene "${name}" not registered`)
    }
    if (this.currentScene) {
      this.currentScene.exit()
    }
    this.currentScene = next
    this.currentScene.enter()
  }

  getCurrent(): Scene | null {
    return this.currentScene
  }

  /** 转发输入事件给当前场景 */
  handleInput(event: InputEvent): void {
    if (this.currentScene?.handleInput) {
      this.currentScene.handleInput(event)
    }
  }

  /** GameLoopTarget: 转发 update */
  update(dt: number): void {
    if (this.currentScene) {
      this.currentScene.update(dt)
    }
  }

  /** GameLoopTarget: 转发 render */
  render(ctx: CanvasRenderingContext2D): void {
    if (this.currentScene) {
      this.currentScene.render(ctx)
    }
  }
}
```

- [ ] **Step 2: 编写测试**

```typescript
// src/engine/__tests__/SceneManager.test.ts
import { describe, it, expect, vi } from 'vitest'
import { SceneManager } from '../SceneManager'
import type { Scene } from '../types'

function createMockScene(name: string): Scene & {
  enterCalled: boolean
  exitCalled: boolean
  updates: number[]
} {
  return {
    name,
    enterCalled: false,
    exitCalled: false,
    updates: [],
    enter() { this.enterCalled = true },
    exit() { this.exitCalled = true },
    update(dt: number) { this.updates.push(dt) },
    render(_ctx: CanvasRenderingContext2D) {},
    handleInput: vi.fn(),
  }
}

describe('SceneManager', () => {
  it('switchTo 调用新场景的 enter', () => {
    const mgr = new SceneManager()
    const scene = createMockScene('menu')
    mgr.register(scene)

    mgr.switchTo('menu')

    expect(scene.enterCalled).toBe(true)
  })

  it('切换场景时调用旧场景 exit 和新场景 enter', () => {
    const mgr = new SceneManager()
    const scene1 = createMockScene('menu')
    const scene2 = createMockScene('battle')
    mgr.register(scene1)
    mgr.register(scene2)

    mgr.switchTo('menu')
    mgr.switchTo('battle')

    expect(scene1.exitCalled).toBe(true)
    expect(scene2.enterCalled).toBe(true)
  })

  it('switchTo 不存在的场景抛错', () => {
    const mgr = new SceneManager()
    expect(() => mgr.switchTo('nonexistent')).toThrow('Scene "nonexistent" not registered')
  })

  it('update 转发给当前场景', () => {
    const mgr = new SceneManager()
    const scene = createMockScene('menu')
    mgr.register(scene)
    mgr.switchTo('menu')

    mgr.update(16)
    mgr.update(32)

    expect(scene.updates).toEqual([16, 32])
  })

  it('handleInput 转发给当前场景', () => {
    const mgr = new SceneManager()
    const scene = createMockScene('menu')
    mgr.register(scene)
    mgr.switchTo('menu')

    const event = { key: 'f', type: 'keydown' as const, timestamp: 0 }
    mgr.handleInput(event)

    expect(scene.handleInput).toHaveBeenCalledWith(event)
  })

  it('没有当前场景时 update 和 handleInput 不报错', () => {
    const mgr = new SceneManager()
    expect(() => mgr.update(16)).not.toThrow()
    expect(() => mgr.handleInput({ key: 'f', type: 'keydown', timestamp: 0 })).not.toThrow()
  })
})
```

- [ ] **Step 3: 运行测试**

```bash
npm test
```

Expected: 全部 PASS。

- [ ] **Step 4: 提交**

```bash
git add src/engine/SceneManager.ts src/engine/__tests__/SceneManager.test.ts
git commit -m "feat: 实现 SceneManager，场景注册/切换/生命周期管理"
```

---

## Task 8: Asset Loader

**Files:**
- Create: `src/engine/AssetLoader.ts`
- Test: `src/engine/__tests__/AssetLoader.test.ts`

- [ ] **Step 1: 实现 AssetLoader**

```typescript
// src/engine/AssetLoader.ts
import type { AssetManifest, LoadedAssets, AssetProgressCallback } from './types'

export class AssetLoader {
  private images: Map<string, HTMLImageElement> = new Map()
  private audioBuffers: Map<string, AudioBuffer> = new Map()
  private audioContext: AudioContext | null = null

  /** 加载所有资源 */
  async load(manifest: AssetManifest, onProgress?: AssetProgressCallback): Promise<LoadedAssets> {
    const imageEntries = Object.entries(manifest.images)
    const audioEntries = Object.entries(manifest.audio)
    const total = imageEntries.length + audioEntries.length
    let loaded = 0

    const report = () => {
      loaded++
      onProgress?.(loaded, total)
    }

    // 加载图片
    const imagePromises = imageEntries.map(([id, url]) =>
      this.loadImage(id, url).then(report)
    )

    // 加载音频
    const audioPromises = audioEntries.map(([id, url]) =>
      this.loadAudio(id, url).then(report)
    )

    await Promise.all([...imagePromises, ...audioPromises])

    return {
      images: this.images,
      audio: this.audioBuffers,
    }
  }

  getImage(id: string): HTMLImageElement | undefined {
    return this.images.get(id)
  }

  getAudio(id: string): AudioBuffer | undefined {
    return this.audioBuffers.get(id)
  }

  private async loadImage(id: string, url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        this.images.set(id, img)
        resolve()
      }
      img.onerror = () => reject(new Error(`Failed to load image: ${id} (${url})`))
      img.src = url
    })
  }

  private async loadAudio(id: string, url: string): Promise<void> {
    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext()
      }
      const response = await fetch(url)
      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)
      this.audioBuffers.set(id, audioBuffer)
    } catch (e) {
      console.warn(`Failed to load audio: ${id} (${url})`, e)
      // 音频加载失败不阻断游戏，只警告
    }
  }
}
```

- [ ] **Step 2: 编写测试**

AssetLoader 重度依赖浏览器 API（Image、AudioContext、fetch），测试重点验证逻辑分支，用 mock 隔离浏览器 API。

```typescript
// src/engine/__tests__/AssetLoader.test.ts
import { describe, it, expect, vi } from 'vitest'
import { AssetLoader } from '../AssetLoader'

describe('AssetLoader', () => {
  it('空 manifest 直接返回空集合', async () => {
    const loader = new AssetLoader()
    const result = await loader.load({ images: {}, audio: {} })

    expect(result.images.size).toBe(0)
    expect(result.audio.size).toBe(0)
  })

  it('onProgress 在空 manifest 时不被调用', async () => {
    const loader = new AssetLoader()
    const progress = vi.fn()
    await loader.load({ images: {}, audio: {} }, progress)

    expect(progress).not.toHaveBeenCalled()
  })

  it('getImage 返回 undefined 当未加载', () => {
    const loader = new AssetLoader()
    expect(loader.getImage('nonexistent')).toBeUndefined()
  })

  it('getAudio 返回 undefined 当未加载', () => {
    const loader = new AssetLoader()
    expect(loader.getAudio('nonexistent')).toBeUndefined()
  })
})
```

- [ ] **Step 3: 运行测试**

```bash
npm test
```

Expected: 全部 PASS。

- [ ] **Step 4: 提交**

```bash
git add src/engine/AssetLoader.ts src/engine/__tests__/AssetLoader.test.ts
git commit -m "feat: 实现 AssetLoader，支持图片和音频预加载"
```

---

## Task 9: Audio Manager

**Files:**
- Create: `src/engine/AudioManager.ts`
- Test: `src/engine/__tests__/AudioManager.test.ts`

- [ ] **Step 1: 实现 AudioManager**

```typescript
// src/engine/AudioManager.ts

export class AudioManager {
  private audioContext: AudioContext | null = null
  private buffers: Map<string, AudioBuffer> = new Map()
  private gainNode: GainNode | null = null
  private lastPlayTime: Map<string, number> = new Map()
  private minInterval = 50  // 同一音效最小间隔（毫秒），防叠加

  /** 初始化音频上下文（必须在用户交互后调用） */
  init(): void {
    if (this.audioContext) return
    this.audioContext = new AudioContext()
    this.gainNode = this.audioContext.createGain()
    this.gainNode.connect(this.audioContext.destination)
  }

  /** 注册音频 buffer（通常由 AssetLoader 加载后传入） */
  register(id: string, buffer: AudioBuffer): void {
    this.buffers.set(id, buffer)
  }

  /** 播放音效 */
  play(id: string): void {
    if (!this.audioContext || !this.gainNode) return
    const buffer = this.buffers.get(id)
    if (!buffer) return

    // 防叠加：同一音效短时间内不重复播放
    const now = performance.now()
    const lastTime = this.lastPlayTime.get(id) ?? 0
    if (now - lastTime < this.minInterval) return
    this.lastPlayTime.set(id, now)

    const source = this.audioContext.createBufferSource()
    source.buffer = buffer
    source.connect(this.gainNode)
    source.start(0)
  }

  /** 设置音量 (0-1) */
  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume))
    }
  }

  /** 静音/取消静音 */
  mute(muted: boolean): void {
    if (this.gainNode) {
      this.gainNode.gain.value = muted ? 0 : 1
    }
  }
}
```

- [ ] **Step 2: 编写测试**

AudioManager 依赖 AudioContext，测试覆盖无浏览器环境下的安全行为。

```typescript
// src/engine/__tests__/AudioManager.test.ts
import { describe, it, expect } from 'vitest'
import { AudioManager } from '../AudioManager'

describe('AudioManager', () => {
  it('未 init 时 play 不报错', () => {
    const audio = new AudioManager()
    expect(() => audio.play('hit')).not.toThrow()
  })

  it('未 init 时 setVolume 不报错', () => {
    const audio = new AudioManager()
    expect(() => audio.setVolume(0.5)).not.toThrow()
  })

  it('未 init 时 mute 不报错', () => {
    const audio = new AudioManager()
    expect(() => audio.mute(true)).not.toThrow()
  })

  it('play 不存在的音效不报错', () => {
    const audio = new AudioManager()
    // 即使 init 了（如果环境支持），也不应报错
    expect(() => audio.play('nonexistent')).not.toThrow()
  })
})
```

- [ ] **Step 3: 运行测试**

```bash
npm test
```

Expected: 全部 PASS。

- [ ] **Step 4: 提交**

```bash
git add src/engine/AudioManager.ts src/engine/__tests__/AudioManager.test.ts
git commit -m "feat: 实现 AudioManager，支持播放防叠加和音量控制"
```

---

## Task 10: 引擎统一导出

**Files:**
- Create: `src/engine/index.ts`

- [ ] **Step 1: 创建 barrel export**

```typescript
// src/engine/index.ts
export { GameLoop } from './GameLoop'
export type { GameLoopTarget } from './GameLoop'
export { InputManager } from './InputManager'
export { EntityManager } from './EntityManager'
export { Renderer } from './Renderer'
export type { RenderCommand } from './Renderer'
export { SceneManager } from './SceneManager'
export { AssetLoader } from './AssetLoader'
export { AudioManager } from './AudioManager'
export * from './types'
```

- [ ] **Step 2: 运行测试确认无破坏**

```bash
npm test
```

- [ ] **Step 3: 提交**

```bash
git add src/engine/index.ts
git commit -m "feat: 引擎模块统一导出"
```

---

## Task 11: Demo 场景（验收 + 人工体验）

**Files:**
- Create: `src/demo/DemoScene.ts`
- Modify: `src/App.tsx`

这个 Demo 不进后续迭代，用于人工验证阶段一的引擎骨架。验收标准对照 ROADMAP：

1. 启动后显示主菜单（简单文字即可）
2. 按空格 → 切换到战斗场景
3. 一个色块从右往左匀速移动
4. 按任意字母键 → 最左边的色块消失
5. 色块走出左边界 → 控制台输出"missed"
6. 按 P 暂停/恢复
7. 按 ESC → 切回主菜单

- [ ] **Step 1: 实现 MenuScene**

```typescript
// src/demo/DemoScene.ts
import type { Scene, InputEvent } from '../engine/types'

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
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)

    ctx.fillStyle = '#e94560'
    ctx.font = 'bold 48px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('键盘侠大战僵尸', ctx.canvas.width / 2, ctx.canvas.height / 2 - 40)

    ctx.fillStyle = '#ffffff'
    ctx.font = '24px sans-serif'
    ctx.fillText('按空格开始', ctx.canvas.width / 2, ctx.canvas.height / 2 + 30)
  }

  handleInput(event: InputEvent): void {
    if (event.type === 'keydown' && event.key === ' ') {
      this.switchTo('battle')
    }
  }
}
```

- [ ] **Step 2: 实现 BattleScene**

在同一个文件中继续：

```typescript
// 追加到 src/demo/DemoScene.ts

interface Block {
  x: number
  y: number
  speed: number
  active: boolean
  letter: string
}

export class BattleScene implements Scene {
  readonly name = 'battle'
  private switchTo: (name: string) => void
  private blocks: Block[] = []
  private spawnTimer = 0
  private spawnInterval = 2000  // 每 2 秒生成一个色块
  private paused = false
  private canvasWidth = 0
  private canvasHeight = 0
  private readonly letters = 'fjdksla'

  constructor(switchTo: (name: string) => void) {
    this.switchTo = switchTo
  }

  enter(): void {
    this.blocks = []
    this.spawnTimer = 0
    this.paused = false
  }

  exit(): void {
    this.blocks = []
  }

  update(dt: number): void {
    if (this.paused) return

    // 生成色块
    this.spawnTimer += dt
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer -= this.spawnInterval
      this.spawnBlock()
    }

    // 移动色块
    for (let i = 0; i < this.blocks.length; i++) {
      const block = this.blocks[i]
      if (block.active) {
        block.x -= block.speed * (dt / 1000)
        if (block.x + 50 < 0) {
          block.active = false
          console.log('missed')
        }
      }
    }

    // 清理
    this.blocks = this.blocks.filter(b => b.active)
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.canvasWidth = ctx.canvas.width
    this.canvasHeight = ctx.canvas.height

    // 背景
    ctx.fillStyle = '#0f3460'
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight)

    // 色块
    for (const block of this.blocks) {
      if (!block.active) continue

      // 身体
      ctx.fillStyle = '#e94560'
      ctx.fillRect(block.x, block.y, 50, 60)

      // 字母
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 28px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(block.letter, block.x + 25, block.y - 10)
    }

    // 暂停提示
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
    ctx.fillText('按字母击杀 | P 暂停 | ESC 返回菜单', 10, 25)
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

    // 找最左边（最靠近边界）的字母匹配色块
    const key = event.key.toLowerCase()
    let target: Block | null = null
    for (const block of this.blocks) {
      if (block.active && block.letter === key) {
        if (!target || block.x < target.x) {
          target = block
        }
      }
    }
    if (target) {
      target.active = false
    }
  }

  private spawnBlock(): void {
    const letter = this.letters[Math.floor(Math.random() * this.letters.length)]
    this.blocks.push({
      x: this.canvasWidth > 0 ? this.canvasWidth : 800,
      y: 100 + Math.random() * 300,
      speed: 80 + Math.random() * 40,
      active: true,
      letter,
    })
  }
}
```

- [ ] **Step 3: 修改 App.tsx 挂载引擎和 Demo**

```tsx
// src/App.tsx
import { useEffect, useRef } from 'react'
import { GameLoop } from './engine/GameLoop'
import { SceneManager } from './engine/SceneManager'
import { InputManager } from './engine/InputManager'
import { Renderer } from './engine/Renderer'
import { MenuScene, BattleScene } from './demo/DemoScene'

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // 初始化引擎模块
    const renderer = new Renderer()
    renderer.attach(canvas)

    const sceneManager = new SceneManager()
    const inputManager = new InputManager()
    const gameLoop = new GameLoop()

    // 注册场景
    const switchTo = (name: string) => sceneManager.switchTo(name)
    sceneManager.register(new MenuScene(switchTo))
    sceneManager.register(new BattleScene(switchTo))

    // 输入 → 场景
    inputManager.addListener((event) => sceneManager.handleInput(event))
    inputManager.attach(window)

    // 监听窗口大小变化
    const handleResize = () => {
      renderer.resize(window.innerWidth, window.innerHeight)
    }
    handleResize()
    window.addEventListener('resize', handleResize)

    // 启动
    sceneManager.switchTo('menu')
    const ctx = renderer.getContext()!
    gameLoop.start(sceneManager, ctx)

    return () => {
      gameLoop.stop()
      inputManager.detach(window)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <div id="game-root">
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  )
}
```

- [ ] **Step 4: 运行测试确认无破坏**

```bash
npm test
```

- [ ] **Step 5: 启动 dev server 人工验证**

```bash
npm run dev
```

逐项验证：

| # | 验收项 | 操作 |
|---|--------|------|
| 1 | 主菜单显示 | 打开页面看到标题和"按空格开始" |
| 2 | 进入战斗 | 按空格，看到蓝色背景，色块从右侧出现 |
| 3 | 色块移动 | 色块匀速从右往左移动 |
| 4 | 打字击杀 | 按色块上对应的字母，色块消失 |
| 5 | 放过检测 | 不按键，色块走出左边界，控制台输出"missed" |
| 6 | 暂停/恢复 | 按 P 暂停，色块停止；再按 P 恢复 |
| 7 | 返回菜单 | 按 ESC 回到主菜单 |

- [ ] **Step 6: 提交**

```bash
git add src/demo/DemoScene.ts src/App.tsx
git commit -m "feat: 阶段一验收 Demo —— 引擎骨架完整可交互"
```

---

## 验收总结

完成 Task 1-11 后，阶段一的所有模块就位：

| 模块 | 状态 | 测试 |
|------|------|------|
| Game Loop | ✅ | 单元测试 |
| Input Manager | ✅ | 单元测试 |
| Entity Manager | ✅ | 单元测试 |
| Renderer | ✅ | 单元测试 |
| Scene Manager | ✅ | 单元测试 |
| Asset Loader | ✅ | 单元测试 |
| Audio Manager | ✅ | 单元测试 |
| Demo | ✅ | 人工验收 |

Demo（`src/demo/`）仅用于阶段一验收，进入阶段二后可删除或保留参考，不会被后续代码依赖。
