# 特效合成系统 v2 设计文档

> 重构现有二维特效合成（element × trajectory）为四维正交合成系统，提升组合策略深度。

---

## 一、设计动机

当前特效合成系统将弹道的"散射方式"、"飞行路径"、"穿透行为"压缩为单一 trajectory 维度，同维度互斥导致组合空间受限。例如穿透和追踪不能共存、扇形散射和穿透不能共存。

拆分为四个正交维度后：
- 组合空间从 3×4=12 扩展到 6×3×2×4=144 种理论形态
- 每个维度独立贡献，植物设计空间更大
- "追踪穿透弹"、"扇形爆炸弹"等有趣组合成为可能

---

## 二、四个维度定义

### 2.1 元素 Element（命中后给僵尸施加的状态）

| 值 | 优先级 | 效果 |
|----|--------|------|
| normal | 0 | 纯伤害，无附加 |
| ice | 1 | 减速（移动和啃食速度降低） |
| fire | 1 | 灼烧（持续伤害） |
| electric | 2 | 电击（沿僵尸连通性传导伤害） |
| stun | 3 | 眩晕（完全停止移动和啃食） |
| knockback | 4 | 击退（向右推回一段距离） |

**ice 和 fire 优先级相同**，有特殊互斥规则（见合成规则）。

### 2.2 发射模式 Spread（弹道发射形态）

| 值 | 优先级 | 效果 |
|----|--------|------|
| single | 0 | 每棵植物发射 1 颗弹道 |
| burst | 1 | 每棵植物快速连发 N 颗，同方向微间隔 |
| fan | 2 | 每棵植物扇形散射 N 颗 |

### 2.3 飞行路径 Flight（弹道飞行方式）

| 值 | 优先级 | 效果 |
|----|--------|------|
| straight | 0 | 沿初始方向匀速直线飞行 |
| tracking | 1 | 每帧调整方向朝目标，受最大转向速率限制 |

### 2.4 命中行为 Impact（弹道命中后处理）

| 值 | 优先级 | 效果 |
|----|--------|------|
| vanish | 0 | 弹道消失 |
| chain | 1 | 改变方向弹向范围内下一只僵尸，最多弹 N 次 |
| pierce | 2 | 继续飞行，可命中直线上所有僵尸（每只只命中一次） |
| explode | 3 | 弹道消失，落点范围内所有僵尸受伤 |

---

## 三、合成规则

### 3.1 统一合成模式

所有已激活存活植物的标签汇总，每个维度独立合成，产出一个统一的 `SynthesizedEffect`。所有弹道共享该形态。

### 3.2 元素维度（特殊规则）

1. 收集所有已激活存活植物的元素标签
2. 检查 ice 和 fire 是否同时存在
   - 是 → 移除 ice 和 fire（互相抵消）
3. 剩余标签取优先级最高的
4. 若无剩余标签（只有被抵消的冰火） → normal

示例：
- `[ice, fire, electric]` → 冰火抵消 → 剩余 `[electric]` → **electric**
- `[ice, fire]` → 冰火抵消 → 剩余 `[]` → **normal**
- `[ice, normal]` → 无冲突 → 取最高 **ice**

### 3.3 其他三个维度（通用规则）

取所有植物中该维度优先级最高的值。

### 3.4 合成示例

| 激活植物 | 元素合成 | 发射合成 | 飞行合成 | 命中合成 | 最终形态 |
|---------|---------|---------|---------|---------|---------|
| 寒冰射手 + 大喷菇 | ice | fan | straight | vanish | 冰冻扇形散射 |
| 火炬树桩 + 猫尾草 | fire | single | tracking | chain | 火焰追踪连锁弹 |
| 寒冰 + 火炬 + 闪电芦苇 | 冰火抵消→electric | single | straight | vanish | 电击弹 |
| 寒冰 + 火炬 | 冰火抵消→normal | single | straight | vanish | 普通弹（元素浪费） |
| 仙人掌 + 猫尾草 | normal | single | tracking | pierce>chain | 追踪穿透弹 |
| 玉米投手 + 大喷菇 + 猫尾草 | stun | fan | tracking | explode>chain | 眩晕追踪扇形爆炸 |

---

## 四、效果参数配置

```typescript
interface EffectParams {
  // 元素参数
  ice: { slowRatio: number; slowDuration: number }
  fire: { burnDps: number; burnDuration: number }
  electric: { conductRadius: number; conductDamageDecay: number; conductMaxJumps: number }
  stun: { stunDuration: number }
  knockback: { knockbackDistance: number }

  // 发射参数
  burst: { burstCount: number; burstInterval: number }
  fan: { fanBulletCount: number; fanSpreadAngle: number }

  // 飞行参数
  tracking: { trackingTurnRate: number }

  // 命中参数
  chain: { chainBounces: number; chainRange: number }
  explode: { explodeRadius: number; explodeDamageRatio: number }
}
```

所有参数集中在 BattleDef 的 effectParams 中，纯配置驱动。

---

## 五、类型定义

```typescript
type Element = 'normal' | 'ice' | 'fire' | 'electric' | 'stun' | 'knockback'
type Spread = 'single' | 'burst' | 'fan'
type Flight = 'straight' | 'tracking'
type Impact = 'vanish' | 'chain' | 'pierce' | 'explode'

interface SynthesizedEffect {
  element: Element
  spread: Spread
  flight: Flight
  impact: Impact
}

// 植物配置扩展
interface PlantDef {
  id: string
  name: string
  comboSegment: number
  attackPower: number
  hp: number
  element: Element
  spread: Spread
  flight: Flight
  impact: Impact
  unlockStage: number
}
```

---

## 六、元素效果详细行为

### 6.1 冰冻 ice

- 命中僵尸施加 slow 状态
- 移动速度和啃食速度乘以 (1 - slowRatio)
- 持续 slowDuration 秒
- 同种状态不叠加，刷新持续时间

### 6.2 火焰 fire

- 命中僵尸施加 burn 状态
- 每秒受 burnDps 点伤害
- 持续 burnDuration 秒
- 同种状态不叠加，刷新持续时间

### 6.3 电击 electric

- 命中僵尸 A 后，从 A 开始检查连通性
- A 周围 conductRadius 内的僵尸 B 受到 弹道伤害 × conductDamageDecay 伤害
- B 周围再检查 C，C 受到 弹道伤害 × conductDamageDecay² 伤害
- 最多传导 conductMaxJumps 次
- 每只僵尸只被传导一次（防止环路）
- 传导是瞬时的（非弹道），不创建新实体

### 6.4 眩晕 stun

- 命中僵尸施加 stun 状态
- 完全停止移动和啃食
- 持续 stunDuration 秒
- 同种状态不叠加，刷新持续时间

### 6.5 击退 knockback

- 命中僵尸瞬间向右位移 knockbackDistance
- 不是持续状态，是一次性位移
- 击退后僵尸继续正常行为（继续前进）
- 不能推出屏幕右边界（到边界停住）

---

## 七、弹道生命周期

三个阶段：发射 → 飞行 → 命中，由 Spread/Flight/Impact 三个维度分别控制。

### 7.1 发射阶段（Spread 决定）

| Spread | 创建逻辑 |
|--------|---------|
| single | 1 颗弹道，正前方 |
| burst | N 颗弹道，同方向，结算时一次性创建并排入发射队列，按 burstInterval 间隔依次发射（不阻塞玩家操作） |
| fan | N 颗弹道，同时发射，均匀分布在扇形角度内，正前方必有一颗 |

burst 和 fan 创建的每颗子弹都是独立弹道实体，各自进入飞行和命中阶段。

### 7.2 飞行阶段（Flight 决定）

| Flight | update 逻辑 |
|--------|------------|
| straight | 沿初始方向匀速飞行 |
| tracking | 每帧调整方向朝目标（受 trackingTurnRate 限制），目标死亡后沿最后方向继续飞行 |

与 Spread 的组合自然生效：
- fan + tracking = 扇形射出的每颗子弹各自追踪最近目标
- burst + tracking = 连发的每颗子弹各自追踪（前一颗命中后可能追不同目标）

### 7.3 命中阶段（Impact + Element 决定）

碰撞检测命中僵尸后：

| Impact | 命中后行为 |
|--------|-----------|
| vanish | 弹道销毁 |
| chain | 在 chainRange 内找下一只未命中的僵尸，改变方向飞向它，弹跳次数 +1，达到 chainBounces 则销毁 |
| pierce | 记录已命中僵尸（hitSet），弹道继续飞行，遇到新僵尸继续命中 |
| explode | 弹道销毁，落点 explodeRadius 范围内所有僵尸受到 damage × explodeDamageRatio 伤害 |

**每次命中（包括 chain/pierce 的多次命中）都触发 Element 效果**。

---

## 八、僵尸状态系统（新增）

当前僵尸无状态系统，需新增。

### 8.1 状态结构

```typescript
interface ZombieStatus {
  type: 'slow' | 'burn' | 'stun'
  remaining: number    // 剩余持续时间（秒）
  value: number        // 效果数值（减速比例 / 灼烧DPS）
}
```

注意：knockback 是一次性位移，不进入状态列表，命中时直接修改僵尸位置。

### 8.2 状态规则

- 僵尸持有一个状态列表
- 每帧 update 时：遍历状态列表，应用效果，递减 remaining，移除过期状态
- **同种状态不叠加，刷新持续时间**（新的同种状态覆盖旧的 remaining）
- **不同种状态可共存**（一只僵尸可以同时被减速和灼烧）

---

## 九、初版植物阵容（12 棵）

| # | 植物 | 段数 | 元素 | 发射 | 飞行 | 命中 | 特色定位 | 解锁阶段 |
|---|------|------|------|------|------|------|----------|---------|
| 1 | 豌豆射手 | 4 | normal | single | straight | vanish | 基础款，零门槛 | 1 |
| 2 | 寒冰射手 | 4 | ice | single | straight | vanish | 入门元素：减速 | 2 |
| 3 | 双发射手 | 4 | normal | burst | straight | vanish | 入门发射：连发 | 3 |
| 4 | 火炬树桩 | 8 | fire | single | straight | vanish | 冰火互斥策略入门 | 4 |
| 5 | 仙人掌 | 4 | normal | single | straight | pierce | 入门命中：穿透 | 5 |
| 6 | 闪电芦苇 | 4 | electric | single | straight | vanish | 入门电击：僵尸扎堆时强 | 6 |
| 7 | 玉米投手 | 8 | stun | single | straight | explode | 眩晕+落点爆炸，控制型 | 7 |
| 8 | 大喷菇 | 16 | normal | fan | straight | vanish | 高段数高回报：扇形散射 | 8 |
| 9 | 猫尾草 | 8 | normal | single | tracking | chain | 跨路追踪+弹跳 | 9 |
| 10 | 飓风花 | 8 | knockback | single | straight | vanish | 击退争取时间 | 10 |
| 11 | 西瓜投手 | 12 | normal | single | straight | explode | 高段数：大范围爆炸 | 11 |
| 12 | 星星果 | 12 | electric | fan | tracking | vanish | 终极多维：电击+扇形+追踪 | 12 |

### 设计节奏

- **阶段 1-6（4 段为主）**：每棵植物只在 1 个维度非默认，逐步教会孩子每个维度的含义
- **阶段 7-9（8 段）**：出现单棵多维度升级的植物（玉米投手 stun+explode、猫尾草 tracking+chain）
- **阶段 10-12（8-12 段）**：高投入高回报，星星果贡献 3 个维度

### 维度覆盖

| 维度 | 值 | 覆盖植物 |
|------|-----|---------|
| 元素 | normal | 豌豆、双发、仙人掌、大喷菇、猫尾草、西瓜 |
| | ice | 寒冰射手 |
| | fire | 火炬树桩 |
| | electric | 闪电芦苇、星星果 |
| | stun | 玉米投手 |
| | knockback | 飓风花 |
| 发射 | single | 大部分植物 |
| | burst | 双发射手 |
| | fan | 大喷菇、星星果 |
| 飞行 | straight | 大部分植物 |
| | tracking | 猫尾草、星星果 |
| 命中 | vanish | 大部分植物 |
| | pierce | 仙人掌 |
| | chain | 猫尾草 |
| | explode | 玉米投手、西瓜投手 |

---

## 十、与现有代码的对应关系

| 现有概念 | 新设计 | 变更方式 |
|---------|--------|---------|
| `Element` ('normal'\|'ice'\|'fire') | 扩展为 6 值 | 类型扩展 |
| `Trajectory` ('direct'\|'pierce'\|'area'\|'tracking') | 拆为 Spread + Flight + Impact | 类型替换 |
| `synthesizeEffects()` 返回 `{element, trajectory}` | 返回 `{element, spread, flight, impact}` | 函数重写 |
| `ProjectileEntity` 按 trajectory 分支行为 | 按 spread/flight/impact 三阶段驱动 | 重构 |
| 无僵尸状态系统 | 新增 ZombieStatus | 新增模块 |
| `PlantDef.trajectory` | 拆为 `spread` + `flight` + `impact` | 类型+配置更新 |
| `BattleDef` 中的弹道参数 | 统一到 `effectParams` | 配置重组 |

---

## 十一、协同倍率（不变）

协同倍率系统不受本次重构影响，仍按已激活存活植物数量查表：

```
{ 1: 1.0, 2: 1.2, 3: 1.5, 4: 1.8, 5: 2.2, 6: 3.0 }
```

每棵植物的伤害 = attackPower × 协同倍率，独立携带在各自弹道上。
