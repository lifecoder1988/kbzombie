# 植物与特效系统

> 植物属性、Slot 机制、四维特效合成、协同攻击的详细设计。概述见 [GAME_DESIGN.md](./GAME_DESIGN.md)。

---

## 一、植物属性

每棵植物有以下可配置属性：

```
植物 {
  id: string               // 唯一标识
  name: string             // 显示名称
  comboSegment: number     // 占据的连击段数（4、8、16...）
  attackPower: number      // 基础攻击力
  element: Element         // 元素效果（normal / ice / fire / electric / stun / knockback）
  spread: Spread           // 发射模式（single / burst / fan）
  flight: Flight           // 飞行路径（straight / tracking）
  impact: Impact           // 命中行为（vanish / chain / pierce / explode）
  hp: number               // 血量上限
}
```

> 链条中的位置由关卡配置中植物数组的顺序决定，解锁阶段由关卡/阶段配置驱动，均不作为植物自身属性。

---

## 二、初版植物设计

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

**设计节奏**：
- **阶段 1-6（4 段为主）**：每棵植物只在 1 个维度非默认，逐步教会孩子每个维度的含义
- **阶段 7-9（8 段）**：出现单棵多维度升级的植物（玉米投手 stun+explode、猫尾草 tracking+chain）
- **阶段 10-12（8-12 段）**：高投入高回报，星星果贡献 3 个维度

> 段数和属性均为初版建议值，由策略配置决定，可随时调整。

---

## 三、植物排列与 Slot 机制

### Slot 槽

每路有一个 **slot 槽**，总长度是玩家的持久化状态值。植物的 `comboSegment` 即为其占用的 slot 长度。

```
slot 总长度 = 玩家当前 slotSize（初始值 4，通关奖励可增加）

规则：
- 放入植物的 comboSegment 总和 ≤ slot 长度
- 可以不填满（剩余空间留空）
- 同一植物可重复放置
- 只能选择已解锁的植物
- 每路可以放不同的植物组合
- 每关开始前选择，关内不可调整
```

### 排列顺序

**玩家自由决定链条中植物从左到右的排列顺序**。右侧最靠近僵尸，最先被啃。

```
示例：玩家 slotSize = 12

路 A: [豌豆(4)] → [寒冰(4)] → [豌豆(4)]  = 12 ✓（重复植物）
路 B: [火炬(8)]                            = 8  ✓（不填满）
路 C:（空路）                               = 0  ✓（僵尸照走，靠跨路攻击清理）
```

### Slot 值变化

- slotSize 是玩家的**持久化状态**（存在 SaveData 中）
- 不与具体阶段/关卡硬绑定
- **关卡奖励配置驱动**：每个关卡可配置 `rewards.slotIncrease`，通关后增加 slotSize
- 初始 slotSize = 4（只能放一棵 4 段植物）

### 植物选择 UI

- 关卡开始前进入植物选择界面（Canvas 渲染）
- 玩家从已解锁植物中选取，拖入各路的 slot 槽
- 每路独立选择，总 comboSegment ≤ slotSize
- 选择完成后进入战斗，关内不可调整

---

## 四、特效系统

每棵植物自带特效标签，协同时特效按分类规则叠加，自动产生组合攻击效果，**无需穷举配置具体植物组合**。

### 特效分类

特效分为**四个正交维度**，不同维度之间自由叠加，同维度内互斥取优：

| 维度 | 说明 | 可选值 |
|------|------|--------|
| **元素 Element**（命中后给僵尸施加的状态） | 冰+火互斥抵消，其余取优先级最高 | normal / ice / fire / electric / stun / knockback |
| **发射模式 Spread**（弹道发射形态） | 取优先级最高 | single / burst / fan |
| **飞行路径 Flight**（弹道飞行方式） | 取优先级最高 | straight / tracking |
| **命中行为 Impact**（弹道命中后处理） | 取优先级最高 | vanish / chain / pierce / explode |

四个维度完全正交，组合空间 6×3×2×4 = 144 种理论形态。加新植物 = 加特效标签，自动参与协同，不需要配置具体组合。

### 同维度优先级

**元素优先级**（从低到高）：

```
普通(normal) < 冰冻(ice) = 火焰(fire) < 电击(electric) < 眩晕(stun) < 击退(knockback)
```

特殊规则：冰冻 + 火焰同时存在 → **互相抵消**，移除冰和火后取剩余最高优先级；若无剩余则回退为 normal。

**发射模式优先级**（从低到高）：

```
单发(single) < 连发(burst) < 扇形散射(fan)
```

**飞行路径优先级**（从低到高）：

```
直线(straight) < 追踪(tracking)
```

**命中行为优先级**（从低到高）：

```
消失(vanish) < 连锁跳跃(chain) < 穿透(pierce) < 落点爆炸(explode)
```

### 元素效果详细行为

| 元素 | 命中后行为 | 关键参数 |
|------|-----------|---------|
| normal | 纯伤害，无附加 | — |
| ice | 减速（移动和啃食速度降低） | slowRatio（减速比例）、slowDuration（持续秒数） |
| fire | 灼烧（持续伤害） | burnDps（每秒伤害）、burnDuration（持续秒数） |
| electric | 电击（沿僵尸连通性传导伤害） | conductRadius（导电距离）、conductDamageDecay（每跳衰减比例）、conductMaxJumps（最大传导次数） |
| stun | 眩晕（完全停止移动和啃食） | stunDuration（持续秒数） |
| knockback | 击退（向右推回一段距离） | knockbackDistance（推回距离） |

**电击传导机制**：命中僵尸 A 后，从 A 开始检查周围 conductRadius 内的僵尸 B，B 受到弹道伤害 × conductDamageDecay 的伤害；B 周围再查 C，伤害继续衰减；最多传导 conductMaxJumps 次，每只僵尸只被传导一次（防环路）。传导是瞬时的，不创建新弹道实体。

**击退**是一次性位移，不是持续状态。其他状态效果（slow/burn/stun）同种不叠加、刷新持续时间，不同种可共存。

> 附加效果的具体数值由 `effectParams` 配置驱动，当前初版值见 [CONFIG_REFERENCE.md](./CONFIG_REFERENCE.md)。

### 弹道生命周期

弹道是**真实的游戏实体**，有位置、速度、碰撞体积，由引擎的实体系统管理生命周期，每帧参与 update/render 循环。

弹道生命周期分三个阶段，由 Spread / Flight / Impact 三个维度分别控制：

```
发射阶段（Spread 决定）→ 飞行阶段（Flight 决定）→ 命中阶段（Impact + Element 决定）
```

#### 发射阶段（Spread 决定）

| Spread | 创建逻辑 |
|--------|---------|
| single | 每棵植物发射 1 颗弹道，正前方 |
| burst | 每棵植物快速连发 N 颗（`burstCount`），同方向，按 `burstInterval` 间隔依次发射 |
| fan | 每棵植物扇形散射 N 颗（`fanBulletCount`），同时发射，均匀分布在 `fanSpreadAngle` 角度内，正前方必有一颗 |

burst 和 fan 创建的每颗子弹都是独立弹道实体，各自进入飞行和命中阶段。

#### 飞行阶段（Flight 决定）

| Flight | update 逻辑 |
|--------|------------|
| straight | 沿初始方向匀速直线飞行，飞出屏幕则消失 |
| tracking | 每帧调整飞行方向朝向目标（受 `trackingTurnRate` 限制），目标死亡后沿最后方向继续飞行 |

与 Spread 的组合自然生效：
- fan + tracking = 扇形射出的每颗子弹各自追踪最近目标
- burst + tracking = 连发的每颗子弹各自追踪（前一颗命中后可能追不同目标）

#### 命中阶段（Impact + Element 决定）

碰撞检测命中僵尸后：

| Impact | 命中后行为 |
|--------|-----------|
| vanish | 弹道消失 |
| chain | 在 `chainRange` 内找下一只未命中的僵尸，改变方向飞向它，弹跳次数 +1，达到 `chainBounces` 则消失 |
| pierce | 记录已命中僵尸（hitSet），弹道继续飞行，遇到新僵尸继续命中，每只僵尸只命中一次 |
| explode | 弹道消失，落点 `explodeRadius` 范围内所有僵尸受到 damage × `explodeDamageRatio` 伤害 |

**每次命中（包括 chain/pierce 的多次命中）都触发 Element 效果。**

### 碰撞判定

- 弹道和僵尸都有碰撞体积（矩形 AABB）
- 每帧检测弹道与僵尸的碰撞（引擎层通用能力，不感知具体玩法）
- 命中后对该僵尸独立计算伤害，超杀不溢出
- 同一只僵尸可被多发弹道命中（来自不同次结算的弹道）

### 特效合成示例

| 激活植物 | 元素 | 发射 | 飞行 | 命中 | 最终形态 |
|---------|------|------|------|------|---------|
| 豌豆 | normal | single | straight | vanish | 普通单发直射（基础攻击） |
| 寒冰 + 大喷菇 | ice | fan | straight | vanish | **冰冻扇形散射** |
| 火炬 + 猫尾草 | fire | single | tracking | chain | **火焰追踪连锁弹** |
| 寒冰 + 火炬 + 闪电芦苇 | 冰火抵消→electric | single | straight | vanish | **电击弹** |
| 寒冰 + 火炬 | 冰火抵消→normal | single | straight | vanish | **普通弹**（元素浪费） |
| 仙人掌 + 猫尾草 | normal | single | tracking | pierce>chain | **追踪穿透弹** |
| 玉米投手 + 大喷菇 + 猫尾草 | stun | fan | tracking | explode>chain | **眩晕追踪扇形爆炸** |
| 闪电芦苇 + 仙人掌 + 大喷菇 | electric | fan | straight | pierce | **电击扇形穿透弹** |

---

## 五、协同攻击系统

### 触发条件

结算时激活了 **2 棵及以上存活植物**即触发协同。单棵植物结算只使用自身特效，不算协同。

### 协同效果（两层）

**第一层：攻击力加成** — 由激活植物数量决定，与具体植物种类无关：

| 激活植物数 | 攻击力倍率 |
|-----------|-----------|
| 1 棵 | ×1.0（无加成） |
| 2 棵 | ×1.2 |
| 3 棵 | ×1.5 |
| 4 棵 | ×1.8 |
| 5 棵 | ×2.2 |
| 6 棵（满链） | ×3.0 |

> 倍率由配置驱动（`synergyMultiplier`），超出已配置最大 key 时 fallback 到最大已配置值。

**第二层：特效合成** — 收集所有已激活存活植物的四维特效标签，按上方分类规则合成最终攻击类型：

1. 元素维度：取优先级最高的元素（冰+火互相抵消后取剩余最高）
2. 发射维度：取优先级最高的发射模式
3. 飞行维度：取优先级最高的飞行路径
4. 命中维度：取优先级最高的命中行为
5. 四个维度的结果组合 = 最终攻击形态

### 设计优势

- **无需穷举组合**：新增植物自带四维特效标签，自动参与协同
- **规则可预测**：孩子打到一定阶段可以理解"冰+扇形=冰冻扇形散射"
- **策略深度**：冰火抵消让植物选择有策略意义；四维正交让组合空间丰富（144 种理论形态）
- **维度独立**：追踪+穿透、扇形+爆炸等有趣组合成为可能

---

## 六、结算攻击的完整计算流程

```
结算触发（按错 / 空格 / 打满）
  ↓
1. 确定已激活植物列表（连击打满全部段数且存活的植物）
  ↓
2. 计算协同倍率：按激活存活植物数量查表得到倍率（见上方协同系统）
  ↓
3. 计算每棵植物的独立伤害：每棵已激活存活植物的伤害 = 该植物 attackPower × 协同倍率
   （不同植物攻击力不同，各自携带独立伤害，不做总量平分）
  ↓
4. 合成特效：收集所有已激活存活植物的四维特效标签
   → 元素维度：冰+火互相抵消后取剩余最高优先级
   → 发射维度：取最高优先级（single < burst < fan）
   → 飞行维度：取最高优先级（straight < tracking）
   → 命中维度：取最高优先级（vanish < chain < pierce < explode）
   → 四维组合得到最终攻击形态
  ↓
5. 发射弹道：每棵已激活植物各自发射独立弹道（各自的射击动画）
   发射模式由 Spread 维度决定（single/burst/fan）
   每颗弹道携带该植物的独立伤害，统一使用合成后的攻击形态
   （弹道飞行期间玩家可继续打字，僵尸继续移动和啃食）
  ↓
6. 飞行与命中：弹道按 Flight 维度飞行（straight 直线 / tracking 追踪）
   碰到僵尸后按 Impact 维度处理（vanish 消失 / chain 弹跳 / pierce 穿透 / explode 爆炸）
  ↓
7. 伤害结算：对每只命中的僵尸独立计算伤害，超杀伤害不溢出到其他僵尸
   → 同时应用元素效果（ice 减速 / fire 灼烧 / electric 传导 / stun 眩晕 / knockback 击退）
  ↓
8. 如果是打满链条：额外触发存活植物回血 + 阵亡植物复活
   （复活的植物不参与上面第 1-7 步的攻击）
  ↓
9. 连击归零，链条回到第一棵植物
```
