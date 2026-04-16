# 阶段六 6.3 P2+P3 视觉打磨设计

> P2（场景氛围与过渡）+ P3（锦上添花），共 7 项。

---

## 总体原则

- 所有动画用 dt 驱动，不依赖帧率
- 不在 render 里改状态，不在 update 里碰 Canvas
- 新增 VfxObject 统一走 VfxManager 对象池
- 不改引擎层，所有改动在 scenes/ 和 game/types 中

---

## P2-1: 场景淡入（6.3.11 简化版）

**范围**：只做淡入，不做淡出。淡出需要异步 exit 流程，改动大且收益小。

**方案**：
- 在需要过渡的场景（BattleScene、SettlementScene、MenuScene、StageSelectScene、PlantSelectScene）的 enter() 中设置 `fadeAlpha = 1`
- update(dt) 中递减：`fadeAlpha = max(0, fadeAlpha - dt / 0.3)` （0.3s 淡入）
- render() 最后一步画全屏黑色遮罩：`ctx.fillStyle = rgba(0,0,0, fadeAlpha)`
- fadeAlpha 降为 0 后不再绘制遮罩

**改动文件**：5 个场景各加 ~5 行

---

## P2-2: 结算数据动态揭晓（6.3.12）

**方案**：重写 SettlementScene 的 update + render，用时间线驱动依次揭晓。

**时间线**（从 enter 开始计时）：

| 时间段 | 内容 |
|--------|------|
| 0.0-0.3s | 淡入 |
| 0.3-0.5s | 称号/鼓励语从 scale 2.0→1.0 弹入 |
| 0.6s 起 | 4 个数据项依次揭晓，每项 0.4s 间隔，数字从 0 跳到目标值 |
| 数据完成后 0.3s | 星星逐颗掉落（每颗 0.2s 间隔），从 y-30 掉到目标 y，带阻尼弹跳 |
| 星星完成后 0.3s | 奖励信息淡入（如有） |
| 奖励完成后 0.3s | 操作提示淡入，允许按键 |

**实现**：
- `elapsed` 计时器在 update 中累加
- 每个元素有 `startTime`，`progress = clamp((elapsed - startTime) / duration, 0, 1)`
- 数字跳动：`displayValue = floor(lerp(0, target, easeOut(progress)))`
- 星星掉落：`y = targetY - 30 * (1 - bounceEase(progress))`
- 按键在全部揭晓完毕前被忽略（`inputEnabled` 标志）

**改动文件**：SettlementScene.ts 重写 update + render

---

## P2-3: 波次开始演出（6.3.13）

**方案**：新建 `WaveAnnounce` VfxObject。

**动画**：
1. 文字 "Wave N" 从右侧飞入屏幕中央（0.3s，easeOut）
2. 居中停留 0.6s
3. 放大 + 淡出（0.3s，scale 1→1.5，alpha 1→0）

**文字样式**：白色描边 + 半透明填充，font bold 48px，居中于 gameAreaHeight 中部。

**接入**：BattleScene.processGameEvent 的 `waveStart` 分支生成 WaveAnnounce。

**改动文件**：
- 新建 `scenes/vfx/WaveAnnounce.ts`
- BattleScene.ts 导入并在 waveStart 事件中生成

---

## P2-4: 菜单背景动态（6.3.14）

**方案**：MenuScene 加 update 动画，render 增加背景装饰层。

**内容**：
- 背景：棋盘格草坪（复用 drawBattlefield），缓慢向左滚动（scrollX += dt × 10）
- 僵尸剪影：3 个剪影从右到左匀速移动，深灰半透明（alpha 0.15），不同 y 和速度。用 drawZombie 简化版绘制，到达左边界后重置到右边界
- 植物装饰：画面左下角 2 棵静态植物轻微摇摆（用 drawPlant + sin 偏移）

**状态**：
- `scrollX: number` — 草坪滚动偏移
- `silhouettes: Array<{x, y, speed, type, walkPhase}>` — 3 个僵尸剪影
- `idlePhase: number` — 植物摇摆相位

**改动文件**：MenuScene.ts 增加 update 逻辑 + render 背景层

---

## P3-1: 伤害飘字（6.3.16）

**方案**：新建 `DamageNumber` VfxObject。

**触发**：zombieDeath 事件时在死亡位置生成。

**动画**：数字从事件位置向上飘 40px，0.6s 消散，字体 bold 24px，颜色 #ffd700。

**伤害值来源**：需要在 `zombieDeath` GameEvent 中新增 `damage` 字段。BattleManager 在僵尸死亡时记录最后一击的伤害（实际上用僵尸的最大 HP 更有意义——展示"消灭了多强的僵尸"）。

**简化决策**：直接用僵尸 maxHp 作为显示值，不追踪实际最后一击伤害。在 zombieDeath 事件中新增 `hp: number` 字段。

**改动文件**：
- 新建 `scenes/vfx/DamageNumber.ts`
- `game/types.ts` — zombieDeath 事件加 `hp` 字段
- `game/BattleManager.ts` — 推送事件时带上 hp
- `scenes/BattleScene.ts` — zombieDeath 分支生成 DamageNumber

---

## P3-2: 植物待机微动（6.3.17）

**方案**：PlantEntity 新增 `idlePhase` 计时器，产生微小 y 偏移。

- `idlePhase` 在构造时用 `plantIndex × 0.7` 初始化（各植物错相）
- update 中：`idlePhase += dt × 2`
- 渲染时：`idleOffsetY = sin(idlePhase) × 2`（±2px 浮动）
- 与 bounceTimer 叠加：`totalOffsetY = bounceOffset + idleOffsetY`

**改动文件**：
- `game/PlantEntity.ts` — 新增 idlePhase 字段和 idleOffsetY getter
- BattleScene.ts render 中将 idleOffsetY 传给 drawPlant 的 bounceOffsetY 参数（合并后）

---

## P3-3: 实体阴影（6.3.18）

**方案**：在 PlantRenderer 和 ZombieRenderer 的绘制函数开头画扁椭圆阴影。

- 颜色：`rgba(0, 0, 0, 0.12)`
- 位置：实体底部中心
- 大小：宽 = 实体宽度 × 0.7，高 = 6px
- 用 `ellipse()` 绘制

**改动文件**：
- `scenes/renderers/PlantRenderer.ts` — drawPlant 开头加阴影
- `scenes/renderers/ZombieRenderer.ts` — drawZombie 开头加阴影

---

## 跳过：6.3.15 简易粒子系统

现有 VfxManager + ParticleBurst 已覆盖粒子需求，不需要独立粒子系统。

---

## 实施顺序

1. P3-2 植物待机微动 + P3-3 实体阴影 — 最小改动
2. P2-3 波次演出（WaveAnnounce）— 一个新 VfxObject
3. P3-1 伤害飘字（DamageNumber）— 一个新 VfxObject + GameEvent 扩展
4. P2-2 结算动态揭晓 — SettlementScene 重写
5. P2-1 场景淡入 — 5 个场景各加几行
6. P2-4 菜单背景 — MenuScene 装饰层
