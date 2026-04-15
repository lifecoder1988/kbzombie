# 阶段六视觉打磨设计文档（6.3 P0+P1）

> 对应 ROADMAP 6.3.1~6.3.10，覆盖 P0（打击反馈系统）和 P1（视觉辨识度）。

---

## 一、现状与目标

**现状**：游戏全部由 Canvas 基础图形绘制（矩形、椭圆），无动画、无粒子、无打击反馈。视觉停留在色块原型阶段。

**目标**：
- 每次按键有令人满足的视觉奖励（P0 核心）
- 连击越长，结算演出越猛，强化策略动机
- 植物/僵尸有辨识度和生命感，符合"卡通蠢萌"定位
- 不同元素弹道视觉差异明显

---

## 二、基础架构

### 2.1 Effect Queue（效果事件队列）

BattleManager 在关键时刻将事件推入队列，BattleScene 每帧读取并消费。保持现有轮询架构，不引入事件系统。

**GameEvent 类型定义**（`game/types.ts` 新增）：

```typescript
type GameEvent =
  | { type: 'hit'; x: number; y: number; letter: string; laneIndex: number }
  | { type: 'miss'; laneIndex: number }
  | { type: 'settlement'; x: number; y: number; power: number;
      isFullChain: boolean; plantCount: number; totalPlants: number }
  | { type: 'zombieHit'; x: number; y: number; zombieId: string; element: Element }
  | { type: 'zombieDeath'; x: number; y: number; width: number; height: number; color: string }
  | { type: 'waveStart'; waveIndex: number; totalWaves: number }
  | { type: 'waveEnd'; waveIndex: number }
```

**BattleManager 改动**：
- 新增 `private _events: GameEvent[] = []`
- 新增 `pushEvent(e: GameEvent)` — 内部各处调用
- 新增 `consumeEvents(): GameEvent[]` — 返回并清空队列

**推入点**：

| 事件 | 位置 |
|------|------|
| hit | `onKeyDown()` 匹配成功后 |
| miss | `onKeyDown()` 匹配失败后 |
| settlement | `executeSettlement()` 执行后 |
| zombieHit | `updateCollisions()` 弹道命中后 |
| zombieDeath | `updateCollisions()` 僵尸 HP≤0 后 |
| waveStart | `checkWaveCompletion()` 进入下一波时 |
| waveEnd | `checkWaveCompletion()` 波次完成时 |

### 2.2 VfxManager（视觉效果管理器）

放在 `scenes/VfxManager.ts`。管理所有活跃视觉效果对象的生命周期。VfxManager 及其效果类直接操作 Canvas 绑定，属于渲染层，按 CLAUDE.md"游戏层不直接操作 Canvas"的原则放在 `scenes/` 层。

**VfxObject 接口**：

```typescript
interface VfxObject {
  update(dt: number): void
  render(ctx: CanvasRenderingContext2D): void
  alive: boolean
  reset(...args: unknown[]): void   // 对象池复用时重置状态
}
```

**VfxManager**：

```typescript
class VfxManager {
  private effects: VfxObject[]
  private pool: Map<string, VfxObject[]>

  spawn(effect: VfxObject): void
  acquire<T extends VfxObject>(type: string, factory: () => T): T
  update(dt: number): void    // 遍历更新，alive=false 的回收入池
  render(ctx: CanvasRenderingContext2D): void
  clear(): void               // 场景退出时全部回收
}
```

**对象池**：`acquire()` 先从池里取同类型对象，没有才 `factory()` 创建。效果结束后自动回收入池。避免每帧 new。

**Screen Shake**（全局效果）：

```typescript
// VfxManager 内
private shakeOffsetX = 0
private shakeOffsetY = 0
private shakeRemaining = 0
private shakeIntensity = 0
private shakeDuration = 0

shake(intensity: number, duration: number): void
getShakeOffset(): { x: number; y: number }
```

- 多次震动取最大值：`intensity = max(current, new)`，`remaining = max(current, new)`
- 每帧偏移 = `(Math.random() - 0.5) * 2 * intensity * (remaining / duration)`，衰减式
- 整数化偏移避免亚像素模糊

**BattleScene 集成**：

```
update(dt):
  events = manager.consumeEvents()
  for event of events:
    根据 event.type 创建对应 VfxObject → vfxManager.spawn()
  vfxManager.update(dt)

render(ctx):
  offset = vfxManager.getShakeOffset()
  ctx.save()
  ctx.translate(offset.x, offset.y)
  ... 正常绘制 ...
  ctx.restore()
  vfxManager.render(ctx)  // 效果在震动之外绘制（或之内，视效果类型）
```

---

## 三、P0 — 打击反馈系统

### 3.1 打字命中反馈（6.3.1）

触发：`hit` 事件。

**效果 A — 字母弹出消散（LetterPop）**：
- VfxObject，由 VfxManager 管理
- 在命中字母位置生成放大淡出的字母
- 初始 scale = 1.0，0.3s 内放大到 2.0
- alpha 从 1.0 → 0
- 颜色：金色 `#ffd700`
- render：`globalAlpha = alpha`，`font = bold ${baseSize * scale}px monospace`，`fillText(letter, x, y)`

**效果 B — 植物微跳（bounceTimer）**：
- PlantEntity 自身状态，不走 VfxManager
- 命中时 BattleScene 设 `plantEntity.bounceTimer = 0.15`
- PlantEntity.render() 中：`bounceTimer > 0` 时 y 偏移 `-6 * Math.sin(bounceTimer / 0.15 * π)`
- 纯渲染偏移，不影响逻辑坐标

### 3.2 打字错误反馈（6.3.2）

触发：`miss` 事件。

**效果 A — 屏幕微震**：
- `vfxManager.shake(3, 0.15)` — 强度 3px，持续 0.15s

**效果 B — 当前字母红闪（LetterFlash）**：
- 复用 LetterPop 类（同一 VfxObject 类型，参数不同）
- 颜色：`#ff4444`，无放大（scale 恒为 1），alpha 从 0.8 → 0，持续 0.2s

### 3.3 连击结算演出（6.3.3）

触发：`settlement` 事件。携带 `plantCount`（激活植物数）和 `totalPlants`（总植物数）。

**视觉强度随 plantCount 线性插值**：

```
intensity = plantCount / totalPlants   // 0~1
```

**闪光脉冲（FlashPulse）**：
- 圆形白光扩散，从植物阵地中心发出
- 半径：`lerp(20, 120, intensity)` px 范围内扩散
- alpha：`lerp(0.2, 0.5, intensity)` → 0
- 颜色：白色 → 暖黄 → 金色，随 intensity 渐变
- 持续 0.3s

**屏幕震动**：
- `plantCount <= 1` 时不震
- 否则 `shake(lerp(2, 8, intensity), lerp(0.15, 0.4, intensity))`

**粒子爆发（ParticleBurst）**：
- 粒子数量 = `Math.floor(lerp(0, 30, intensity))`
- 从植物阵地中心向四周喷射小圆点
- 各粒子有随机速度（50~150 px/s）和随机方向
- 颜色随 intensity 从白到金
- 各粒子独立淡出，持续 0.3~0.5s
- 实现为单个 VfxObject（ParticleBurst），内部持有预分配的粒子数组（固定 30 个 slot），spawn 时按 count 激活

**满链额外效果**（`isFullChain = true`）：
- 全屏金色闪光叠加层：alpha 从 0.3 → 0，持续 0.15s

### 3.4 僵尸受击/死亡（6.3.4）

**受击闪白（flashTimer）**：
- 触发：`zombieHit` 事件
- ZombieEntity 自身状态，不走 VfxManager
- BattleScene 收到事件后通过 entityManager 找到对应僵尸，设 `flashTimer = 0.1`
- ZombieEntity.render() 中：`flashTimer > 0` 时 fillStyle 强制为 `#ffffff`

**死亡击飞淡出（DeathFlyout）**：
- 触发：`zombieDeath` 事件
- VfxObject，在僵尸最后位置生成同色同大小矩形残影
- 向右上方飞出：`vx = 150, vy = -100` px/s
- 同时旋转 + alpha 从 1 → 0
- 持续 0.5s

**死亡碎片（Debris）**（可选）：
- 4~6 个小矩形碎片，随机方向飞散 + 淡出
- 持续 0.4s
- 复用 ParticleBurst 或单独实现

### 3.5 屏幕震动系统（6.3.5）

见 2.2 中 Screen Shake 部分。

---

## 四、P1 — 视觉辨识度

### 4.1 草坪网格 + 泥土路径（6.3.6）

替换当前纯色 `#2d5a1e` 背景。

**草坪网格**：
- 按 lane 纵向划分行，每行内按固定列宽划分格子
- 相邻格子两种绿色交替（棋盘格）：`#3d6b2e` / `#2d5a1e`
- 格子边缘不画线，靠色差自然区分

**植物阵地区域**：
- 左侧 35% 背景色略深（`#1e4a15`）
- 阵地右边缘竖向泥土分隔带：宽 8px，颜色 `#8B6914`，两侧各 1px 深色描边

**实现位置**：BattleScene.render() 中替换 fillRect，纯渲染改动。

### 4.2 植物简笔画风格（6.3.7）

新建 `scenes/renderers/PlantRenderer.ts`，纯渲染函数。

**函数签名**：
```typescript
function drawPlant(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color: string, alive: boolean,
  options?: { bounceOffsetY?: number }
): void
```

**植物结构**（比例相对于 w × h 绘制框）：
- 头部：椭圆，宽 = w × 0.7，高 = h × 0.5，中心偏上
- 茎干：宽 = w × 0.15，从头部底到框底
- 叶片：两片对称弧线，从茎干中段伸出
- 眼睛：两个白色小圆 + 黑色瞳孔，头部偏上 1/3
- 嘴巴：小弧线，头部偏下 1/3
- 死亡：灰度化 + 低透明度 + 眼睛变 ×

PlantEntity.render() 委托给 PlantRenderer，替代 fillRect。

12 种植物本期以颜色为主要区分，独特形态留后续迭代。

### 4.3 僵尸简笔画风格（6.3.8）

新建 `scenes/renderers/ZombieRenderer.ts`，纯渲染函数。

**函数签名**：
```typescript
function drawZombie(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  type: string, color: string,
  options?: { flashTimer?: number; walkPhase?: number; state?: ZombieState;
              statusEffects?: { slow?: boolean; burn?: boolean; stun?: boolean } }
): void
```

**基本形态**：圆头 + 矩形身体 + 两条腿 + 两只前伸手臂。

**5 种僵尸视觉区分**：

| 类型 | 装饰特征 |
|------|---------|
| normal | 基础形态，无装饰 |
| conehead | 头顶橙色路障（梯形） |
| fat | 身体宽 1.5 倍，头更大 |
| flag | 手持红色小旗（斜线 + 三角） |
| imp | 整体缩小，跑步姿态（腿角度更大） |

**状态效果视觉**：

| 状态 | 视觉表现 |
|------|---------|
| slow | 身体叠加淡蓝色半透明层 |
| burn | 身体周围 2~3 个小火焰形状（橙红弧线），每帧微偏移 |
| stun | 头顶 2~3 个旋转小星星 |
| flash（受击） | 整体填充白色，持续 0.1s |

ZombieEntity.render() 委托给 ZombieRenderer。

### 4.4 弹道特效差异化（6.3.9）

新建 `scenes/renderers/ProjectileRenderer.ts`，纯渲染函数。

**函数签名**：
```typescript
function drawProjectile(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  element: Element,
  trail: Array<{ x: number; y: number; alpha: number }>,
  rotation: number
): void
```

**各元素形态与拖尾**：

| 元素 | 形状 | 拖尾 |
|------|------|------|
| normal | 圆形实心 | 无 |
| ice | 菱形（旋转 45° 正方形） | 淡蓝色渐隐残影，3~4 帧 |
| fire | 圆形 + 火焰轮廓（顶部锯齿弧线） | 橙红色渐隐残影 + 小粒子 |
| electric | 小圆 + 周围 2~3 条短闪电线（随机锯齿线） | 紫色闪烁，每帧随机偏移 |
| stun | 五角星形 | 黄色旋转 |
| knockback | 大圆 + 冲击波纹（同心圆环） | 橙色扩散环 |

**拖尾实现**：
- ProjectileEntity 新增 `trailPositions`：预分配固定长度数组（4 slot），环形写入
- 每帧记录当前位置，最多保留 4 帧历史
- render 时先画 trail（逐渐缩小 + 淡出），再画本体

ProjectileEntity.render() 委托给 ProjectileRenderer。

### 4.5 僵尸行走动画（6.3.10）

**ZombieEntity 改动**：
- 新增 `walkPhase: number = 0`
- update() 中：`walkPhase += dt * 6`（6 rad/s，约 1 秒一个完整步伐周期）

**ZombieRenderer 根据 walkPhase 计算**：
- 双腿交替角度：`legAngle = Math.sin(walkPhase) * 0.3` rad
- 身体上下浮动：`bodyOffsetY = Math.sin(walkPhase * 2) * 1.5` px
- 手臂微摆：`armAngle = Math.sin(walkPhase + 0.5) * 0.15` rad
- 啃食状态：停止行走，改为身体前后小幅抖动（`Math.sin(walkPhase * 12) * 2` px）

---

## 五、文件变更总结

### 新增文件

| 文件 | 层 | 职责 |
|------|---|------|
| `scenes/VfxManager.ts` | 场景层 | 视觉效果管理器 + 对象池 + 屏幕震动 |
| `scenes/vfx/LetterPop.ts` | 场景层 | 字母弹出/红闪效果 |
| `scenes/vfx/FlashPulse.ts` | 场景层 | 圆形闪光脉冲 |
| `scenes/vfx/ParticleBurst.ts` | 场景层 | 粒子爆发效果 |
| `scenes/vfx/DeathFlyout.ts` | 场景层 | 僵尸死亡击飞 |
| `scenes/vfx/FullScreenFlash.ts` | 场景层 | 全屏闪光叠加 |
| `scenes/renderers/PlantRenderer.ts` | 场景层 | 植物简笔画渲染 |
| `scenes/renderers/ZombieRenderer.ts` | 场景层 | 僵尸简笔画渲染 |
| `scenes/renderers/ProjectileRenderer.ts` | 场景层 | 弹道特效渲染 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `game/types.ts` | 新增 GameEvent 类型 |
| `game/BattleManager.ts` | 新增 _events 队列 + pushEvent + consumeEvents，各关键点插入 pushEvent 调用 |
| `game/PlantEntity.ts` | 新增 bounceTimer 字段，render() 委托 PlantRenderer |
| `game/ZombieEntity.ts` | 新增 flashTimer + walkPhase 字段，render() 委托 ZombieRenderer |
| `game/ProjectileEntity.ts` | 新增 trailPositions 字段，render() 委托 ProjectileRenderer |
| `scenes/BattleScene.ts` | 集成 VfxManager + 消费 effectQueue + 震屏 translate + 草坪背景 |

### 不改动的文件

- `engine/` 层全部不动
- `config/` 层全部不动
- 其他场景（MenuScene、SettlementScene 等）不动

---

## 六、架构约束

1. **VfxManager、vfx/、renderers/ 全部放 `scenes/` 层**：它们直接操作 Canvas，按"游戏层不直接操作 Canvas"的原则属于场景/渲染层
2. **引擎层零改动**：不引入引擎不需要的游戏概念
3. **配置层零改动**：视觉效果不需要新配置（参数硬编码在效果类中，都是视觉调参非策略数值）
4. **GameEvent 类型放 `game/types.ts`**：事件数据是游戏逻辑层的产物（BattleManager 生成），场景层消费
5. **对象池复用**：VfxManager.acquire() 避免每帧 new，所有 VfxObject 必须实现 reset()
6. **实体内效果仅限极简 timer**：bounceTimer（植物）、flashTimer（僵尸）、walkPhase（僵尸）、trailPositions（弹道）。复杂效果全走 VfxManager
