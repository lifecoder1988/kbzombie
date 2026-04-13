# 引擎升级：碰撞检测 + getByTag 优化 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为阶段二弹道系统补齐引擎层两项能力——AABB 碰撞检测纯函数和 EntityManager tag 查询的缓存优化。

**Architecture:** 碰撞检测为无状态纯函数（`intersects`），只做几何计算，不持有实体引用。EntityManager 内部新增 tag 索引缓存，脏标记驱动懒重建，对外 API 语义不变（返回类型收窄为 `ReadonlyArray`）。

**Tech Stack:** TypeScript strict + Vitest

**测试策略说明:** CLAUDE.md 规定引擎层「先写实现跑通，后补测试锁定行为」。本计划遵循此规则，每个 Task 先实现后补测试。

---

## 文件结构

```
src/engine/
├── types.ts                     # 修改：新增 Rect 接口
├── CollisionDetection.ts        # 新增：intersects 纯函数
├── EntityManager.ts             # 修改：getByTag 缓存优化
├── index.ts                     # 修改：导出 CollisionDetection
└── __tests__/
    ├── CollisionDetection.test.ts  # 新增
    └── EntityManager.test.ts       # 修改：补充缓存行为测试
```

---

## Task 1: Rect 接口 + CollisionDetection 模块

**Files:**
- Modify: `src/engine/types.ts`
- Create: `src/engine/CollisionDetection.ts`
- Modify: `src/engine/index.ts`

- [ ] **Step 1: 在 types.ts 末尾新增 Rect 接口**

在 `AssetProgressCallback` 类型定义之后添加：

```ts
/** 轴对齐矩形，用于碰撞检测 */
export interface Rect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}
```

> Entity 已有 x/y/width/height 字段，结构上自动满足 Rect，无需修改 Entity 定义。

- [ ] **Step 2: 创建 CollisionDetection.ts**

```ts
// src/engine/CollisionDetection.ts
import type { Rect } from './types'

/** AABB 矩形重叠判定。边界接触不算碰撞，零面积矩形不碰撞。 */
export function intersects(a: Rect, b: Rect): boolean {
  if (a.width <= 0 || a.height <= 0 || b.width <= 0 || b.height <= 0) {
    return false
  }
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}
```

- [ ] **Step 3: 在 index.ts 添加导出**

在现有导出列表末尾（`export * from './types'` 之前）添加：

```ts
export { intersects } from './CollisionDetection'
```

- [ ] **Step 4: 编译检查**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add src/engine/types.ts src/engine/CollisionDetection.ts src/engine/index.ts
git commit -m "feat(engine): 新增 Rect 接口和 AABB 碰撞检测函数"
```

---

## Task 2: CollisionDetection 测试

**Files:**
- Create: `src/engine/__tests__/CollisionDetection.test.ts`

- [ ] **Step 1: 编写碰撞检测测试用例**

```ts
// src/engine/__tests__/CollisionDetection.test.ts
import { describe, it, expect } from 'vitest'
import { intersects } from '../CollisionDetection'

describe('intersects', () => {
  it('两矩形明显重叠返回 true', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 }
    const b = { x: 5, y: 5, width: 10, height: 10 }
    expect(intersects(a, b)).toBe(true)
  })

  it('一个矩形完全包含另一个返回 true', () => {
    const outer = { x: 0, y: 0, width: 100, height: 100 }
    const inner = { x: 10, y: 10, width: 5, height: 5 }
    expect(intersects(outer, inner)).toBe(true)
    expect(intersects(inner, outer)).toBe(true)
  })

  it('X 轴分离返回 false', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 }
    const b = { x: 20, y: 0, width: 10, height: 10 }
    expect(intersects(a, b)).toBe(false)
  })

  it('Y 轴分离返回 false', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 }
    const b = { x: 0, y: 20, width: 10, height: 10 }
    expect(intersects(a, b)).toBe(false)
  })

  it('边界恰好接触返回 false（开区间）', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 }
    const right = { x: 10, y: 0, width: 10, height: 10 }
    const bottom = { x: 0, y: 10, width: 10, height: 10 }
    expect(intersects(a, right)).toBe(false)
    expect(intersects(a, bottom)).toBe(false)
  })

  it('零面积矩形返回 false', () => {
    const normal = { x: 0, y: 0, width: 10, height: 10 }
    const zeroWidth = { x: 5, y: 5, width: 0, height: 10 }
    const zeroHeight = { x: 5, y: 5, width: 10, height: 0 }
    expect(intersects(normal, zeroWidth)).toBe(false)
    expect(intersects(zeroWidth, normal)).toBe(false)
    expect(intersects(normal, zeroHeight)).toBe(false)
  })

  it('负面积矩形返回 false', () => {
    const normal = { x: 0, y: 0, width: 10, height: 10 }
    const negative = { x: 5, y: 5, width: -5, height: 10 }
    expect(intersects(normal, negative)).toBe(false)
  })

  it('对称性：intersects(a,b) === intersects(b,a)', () => {
    const a = { x: 3, y: 7, width: 12, height: 8 }
    const b = { x: 10, y: 10, width: 15, height: 15 }
    expect(intersects(a, b)).toBe(intersects(b, a))
  })
})
```

- [ ] **Step 2: 运行测试**

Run: `npx vitest run src/engine/__tests__/CollisionDetection.test.ts`
Expected: 全部通过（8 个用例）

- [ ] **Step 3: Commit**

```bash
git add src/engine/__tests__/CollisionDetection.test.ts
git commit -m "test(engine): 碰撞检测测试用例"
```

---

## Task 3: EntityManager.getByTag 缓存优化

**Files:**
- Modify: `src/engine/EntityManager.ts`

- [ ] **Step 1: 添加缓存相关私有属性**

在 `EntityManager` 类顶部的私有属性区域，`activeCount` 之后添加：

```ts
  private tagCache = new Map<string, Entity[]>()
  private tagCacheDirty = true
```

- [ ] **Step 2: 在文件末尾（类定义之外）添加空数组常量**

在文件最末尾添加：

```ts
const EMPTY_ARRAY: ReadonlyArray<Entity> = []
```

- [ ] **Step 3: 替换 getByTag 实现**

将：

```ts
  getByTag(tag: string): Entity[] {
    return this.entities.filter(e => e.active && e.tags.has(tag))
  }
```

替换为：

```ts
  getByTag(tag: string): ReadonlyArray<Entity> {
    if (this.tagCacheDirty) {
      this.rebuildTagCache()
    }
    return this.tagCache.get(tag) ?? EMPTY_ARRAY
  }
```

- [ ] **Step 4: 在 flush() 中标记 tag 缓存脏**

将 flush 中已有的 `this.renderDirty = true` 之后添加一行：

```ts
  private flush(): void {
    if (this.toAdd.length > 0) {
      for (let i = 0; i < this.toAdd.length; i++) {
        this.entities.push(this.toAdd[i])
      }
      this.toAdd.length = 0
      this.renderDirty = true
      this.tagCacheDirty = true
    }
  }
```

- [ ] **Step 5: 在 cleanup() 中标记 tag 缓存脏**

将 cleanup 中已有的 `this.renderDirty = true` 之后添加一行：

```ts
  private cleanup(): void {
    let write = 0
    for (let read = 0; read < this.entities.length; read++) {
      if (this.entities[read].active) {
        this.entities[write] = this.entities[read]
        write++
      }
    }
    if (write !== this.entities.length) {
      this.renderDirty = true
      this.tagCacheDirty = true
    }
    this.entities.length = write
    this.activeCount = write
  }
```

- [ ] **Step 6: 在 clear() 中清空 tag 缓存**

在 clear 方法中，`this.activeCount = 0` 之后添加：

```ts
    this.tagCache.clear()
    this.tagCacheDirty = false
```

- [ ] **Step 7: 添加 rebuildTagCache 私有方法**

在 `rebuildRenderList` 方法之后添加：

```ts
  private rebuildTagCache(): void {
    for (const arr of this.tagCache.values()) {
      arr.length = 0
    }
    for (let i = 0; i < this.entities.length; i++) {
      const entity = this.entities[i]
      if (entity.active) {
        for (const tag of entity.tags) {
          let arr = this.tagCache.get(tag)
          if (!arr) {
            arr = []
            this.tagCache.set(tag, arr)
          }
          arr.push(entity)
        }
      }
    }
    this.tagCacheDirty = false
  }
```

- [ ] **Step 8: 编译检查 + 运行已有测试确认无回归**

Run: `npx tsc --noEmit && npx vitest run src/engine/__tests__/EntityManager.test.ts`
Expected: 编译无错误，5 个已有测试全部通过

- [ ] **Step 9: Commit**

```bash
git add src/engine/EntityManager.ts
git commit -m "perf(engine): EntityManager.getByTag 缓存优化，避免每帧分配数组"
```

---

## Task 4: EntityManager 缓存行为测试

**Files:**
- Modify: `src/engine/__tests__/EntityManager.test.ts`

- [ ] **Step 1: 在已有测试文件末尾（describe 块内）追加缓存行为测试**

在最后一个 `it(...)` 之后添加：

```ts
  it('getByTag 不存在的 tag 返回空数组', () => {
    const mgr = new EntityManager()
    mgr.add(createEntity({ tags: new Set(['a']) }))
    mgr.update(0)

    const result = mgr.getByTag('nonexistent')
    expect(result).toHaveLength(0)
  })

  it('getByTag 返回的数组在实体不变时是同一个引用（缓存复用）', () => {
    const mgr = new EntityManager()
    mgr.add(createEntity({ tags: new Set(['enemy']) }))
    mgr.update(0)

    const first = mgr.getByTag('enemy')
    const second = mgr.getByTag('enemy')
    expect(first).toBe(second)
  })

  it('getByTag 在实体变化后正确更新缓存', () => {
    const mgr = new EntityManager()
    const e1 = createEntity({ tags: new Set(['enemy']) })
    mgr.add(e1)
    mgr.update(0)

    expect(mgr.getByTag('enemy')).toHaveLength(1)

    mgr.add(createEntity({ tags: new Set(['enemy']) }))
    mgr.update(0)

    expect(mgr.getByTag('enemy')).toHaveLength(2)
  })

  it('getByTag 在实体移除后正确更新缓存', () => {
    const mgr = new EntityManager()
    const e1 = createEntity({ tags: new Set(['enemy']) })
    const e2 = createEntity({ tags: new Set(['enemy']) })
    mgr.add(e1)
    mgr.add(e2)
    mgr.update(0)

    expect(mgr.getByTag('enemy')).toHaveLength(2)

    mgr.remove(e1)
    mgr.update(0)

    expect(mgr.getByTag('enemy')).toHaveLength(1)
  })

  it('getByTag 在 clear 后返回空数组', () => {
    const mgr = new EntityManager()
    mgr.add(createEntity({ tags: new Set(['enemy']) }))
    mgr.update(0)

    expect(mgr.getByTag('enemy')).toHaveLength(1)

    mgr.clear()

    expect(mgr.getByTag('enemy')).toHaveLength(0)
  })

  it('getByTag 不包含已被直接设为 inactive 的实体', () => {
    const mgr = new EntityManager()
    const e1 = createEntity({ tags: new Set(['enemy']) })
    mgr.add(e1)
    mgr.update(0)

    expect(mgr.getByTag('enemy')).toHaveLength(1)

    e1.active = false
    mgr.update(0)

    expect(mgr.getByTag('enemy')).toHaveLength(0)
  })
```

- [ ] **Step 2: 运行全部 EntityManager 测试**

Run: `npx vitest run src/engine/__tests__/EntityManager.test.ts`
Expected: 全部通过（原有 5 个 + 新增 6 个 = 11 个）

- [ ] **Step 3: 运行全部引擎测试确认无回归**

Run: `npx vitest run src/engine/`
Expected: 全部通过

- [ ] **Step 4: Commit**

```bash
git add src/engine/__tests__/EntityManager.test.ts
git commit -m "test(engine): EntityManager getByTag 缓存行为测试"
```
