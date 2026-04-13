# 引擎层升级：阶段二前碰撞检测 + getByTag 优化

> **背景**：GAME_DESIGN v1.5 细化了弹道系统，明确碰撞检测为引擎层职责。Review 现有引擎后发现两处需要补齐的能力。

---

## 改动范围

仅涉及引擎层（`src/engine/`），不涉及游戏层或配置层。

| 改动 | 类型 | 文件 |
|------|------|------|
| 碰撞检测模块 | 新增 | `CollisionDetection.ts` |
| getByTag 优化 | 修改 | `EntityManager.ts` |
| 导出更新 | 修改 | `index.ts` |
| 类型补充 | 修改 | `types.ts`（`Rect` 接口） |

不改动的模块：GameLoop、SceneManager、InputManager、AudioManager、AssetLoader、Renderer。

---

## 改动一：碰撞检测模块

### 设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 碰撞形状 | 仅 AABB 矩形 | Entity 已有 x/y/width/height；阶段二弹道体积小，矩形 vs 圆形肉眼不可见；圆形等需要时再加 |
| 模块形态 | 无状态纯函数 | 阶段二只有一种碰撞场景（弹道 vs 僵尸），有状态 class 过度设计；纯函数零耦合、好测试 |
| API 粒度 | 仅 `intersects` 单对判定 | 批量 API 要么返回数组（GC）要么用回调（闭包）；游戏层自己 for 循环零分配 |

### 新增接口

`Rect` 放在 `types.ts` 中（与 Entity 等引擎类型一起）：

```ts
/** 轴对齐矩形，用于碰撞检测 */
interface Rect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}
```

Entity 结构上已满足 `Rect`，无需修改 Entity 定义。

### 新增函数

`CollisionDetection.ts` 导出：

```ts
/** AABB 矩形重叠判定 */
function intersects(a: Rect, b: Rect): boolean
```

标准 AABB 算法：两矩形在 X 轴和 Y 轴上都有重叠则碰撞。

### 游戏层使用示例

```ts
import { intersects } from '../engine'

// 在战斗场景的 update 中
const projectiles = entityManager.getByTag('projectile')
const zombies = entityManager.getByTag('zombie')
for (let i = 0; i < projectiles.length; i++) {
  for (let j = 0; j < zombies.length; j++) {
    if (intersects(projectiles[i], zombies[j])) {
      // 游戏层处理命中逻辑
    }
  }
}
```

### 测试用例

| 用例 | 预期 |
|------|------|
| 两矩形明显重叠 | true |
| 两矩形完全不重叠（X 轴分离） | false |
| 两矩形完全不重叠（Y 轴分离） | false |
| 边界恰好接触（共享边） | false（开区间，接触不算碰撞） |
| 一个矩形完全包含另一个 | true |
| 零面积矩形（width=0 或 height=0） | false |

> **边界接触判定**：接触不算碰撞（用 `<` 而非 `<=`）。弹道和僵尸都有面积，严格重叠才算命中，避免擦边误判。

---

## 改动二：EntityManager.getByTag 优化

### 问题

当前实现每次调用创建新数组：

```ts
getByTag(tag: string): Entity[] {
  return this.entities.filter(e => e.active && e.tags.has(tag))
}
```

阶段二碰撞检测每帧至少调用 2 次，60fps = 120 次/秒数组分配，违反「不在 update() 里创建对象」规范。

### 方案：懒重建 tag 索引

新增内部状态：

- `tagCache: Map<string, Entity[]>` — 按 tag 缓存活跃实体列表
- `tagCacheDirty: boolean` — 脏标记

**脏标记时机**：

| 操作 | 是否置脏 | 说明 |
|------|----------|------|
| `flush()`（有新实体加入） | 是 | 新实体可能引入新 tag |
| `cleanup()`（有实体被移除） | 是 | 被移除的实体需要从缓存中清除 |
| `clear()` | 直接清空缓存 | 无需脏标记 |

**重建逻辑**：

1. 遍历 `tagCache` 中所有已有数组，`length = 0` 清空（复用数组对象，不 new）
2. 遍历 `entities`，对每个 active 实体的每个 tag，push 到对应数组
3. `tagCacheDirty = false`

**查询逻辑**：

1. 检查 `tagCacheDirty` → 如果脏则重建
2. 返回 `tagCache.get(tag) ?? EMPTY_ARRAY`

其中 `EMPTY_ARRAY` 是模块级预分配的空数组常量。

### 返回类型变更

```ts
// 之前
getByTag(tag: string): Entity[]

// 之后
getByTag(tag: string): ReadonlyArray<Entity>
```

返回 `ReadonlyArray` 防止调用方意外 push/splice 修改内部缓存。现有测试只做只读访问（`.length`、`[index]`、遍历），不受影响。

### 性能特征

| 场景 | 开销 |
|------|------|
| 实体无变化的帧 | 零（直接返回缓存） |
| 实体有变化的帧 | 一次全量重建（遍历 entities × tags） |
| 同一帧多次查不同 tag | 只重建一次，后续查询零开销 |

---

## 不改动的部分

以下确认不需要修改：

| 模块 | 理由 |
|------|------|
| `Entity` 接口 | x/y/width/height + tags + layer 已满足阶段二需求 |
| `RenderLayer` 枚举 | Background/Entity/Effect/UI 四层够用 |
| `GameLoop` | dt 驱动 + 暂停/恢复 + tick 测试，不需要改 |
| `InputManager` | 字母键/空格键 + IME 过滤，直接支撑打字系统 |
| `SceneManager` | 场景切换，直接够用 |
| `Renderer` | 指令式分层渲染，阶段二够用 |
| `AudioManager` | 播放防叠加，够用 |
| `AssetLoader` | 预加载，够用 |
