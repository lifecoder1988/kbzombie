# 键盘侠大战僵尸 - 开发路线图

> 详细游戏设计见 [GAME_DESIGN.md](./GAME_DESIGN.md)

---

## 总览

```
阶段一  游戏引擎基础  → 打地基，后面所有内容都建在这上面
阶段二  核心战斗机制  → 最小可玩版本，验证手感
阶段三  策略配置层    → 机制与内容分离，验证架构
阶段四  协同与多路    → 策略深度，完整战斗体验
阶段五  进度与激励    → 持续动力，让孩子想反复玩
阶段六  打磨与体验    → 从"能玩"到"好玩"
```

---

## 阶段一：游戏引擎基础

**目标**：搭建可复用的游戏底层框架，建立持续运转的游戏世界骨架。

### 模块清单

| # | 模块 | 职责 | 要点 |
|---|------|------|------|
| 1.1 | Game Loop | 游戏主循环，驱动一切 | update(dt) + render() 分离；dt 控制速度一致性；暂停 = dt 置零 |
| 1.2 | Scene Manager | 场景切换 | 主菜单 / 战斗 / 结算等场景互相隔离；统一 enter() / exit() 生命周期 |
| 1.3 | Entity Manager | 实体生命周期管理 | 创建 / 更新 / 销毁；按类型查询；不感知具体游戏对象 |
| 1.4 | Renderer | Canvas 分层绘制 | 背景层 / 实体层 / 特效层 / UI 层；单 Canvas 按序绘制 |
| 1.5 | Input Manager | 键盘输入抽象 | 中文输入法干扰处理；按键去重；与游戏逻辑解耦 |
| 1.6 | Audio Manager | 音效播放管理 | 预加载；play/stop；连续触发防叠加 |
| 1.7 | Asset Loader | 资源预加载 | 图片 + 音效统一加载；进度回调；加载完才进游戏 |
| 1.8 | Collision Detection | AABB 碰撞检测 | 无状态纯函数 `intersects`；`Rect` 接口；引擎层通用能力 |

### 模块依赖关系

```
          Asset Loader（启动时加载资源）
               ↓
          Game Loop（主循环，驱动一切）
           ↓      ↓
    Scene Manager  Input Manager
         ↓              ↓
    当前 Scene ←── 接收输入
      ↓     ↓
  Entity    Renderer（分层绘制）
  Manager
      ↓
  各 Entity.render() → 通过 Renderer 绘制
                        Audio Manager ← 各处按需调用
```

### 完成标准

- [x] 启动后显示加载界面 → 加载完进入主菜单场景
- [x] 主菜单点"开始" → 切换到战斗场景
- [x] 战斗场景中：一个色块从右往左匀速移动（模拟僵尸）
- [x] 按键盘任意键 → 色块消失（模拟击杀）
- [x] 色块走出左边界 → 控制台输出"放过"
- [x] 能暂停 / 恢复
- [x] 按 ESC → 切回主菜单

> **已完成** — 7 个引擎模块 + 32 个单元测试 + Demo 验收场景。详见 `docs/plans/2026-04-13-stage1-game-engine.md`。
>
> **阶段二前引擎升级** — 新增 AABB 碰撞检测模块（`intersects` 纯函数 + `Rect` 接口）、优化 `EntityManager.getByTag` 为懒重建缓存避免每帧分配数组、升级 Demo 演示全部引擎特性（Entity 接口、EntityManager 生命周期、RenderLayer 分层、tag 查询、碰撞检测）。48 个单元测试。详见 `docs/plans/2026-04-13-engine-upgrade-for-stage2.md`。

**验收原则**：没有任何真实游戏逻辑，但引擎骨架完整——循环在跑、场景能切、实体能增删、输入能收到、画面能画出来、碰撞能检测。

---

## 阶段二：核心战斗机制

**目标**：在引擎上实现打字→攻击的核心循环，用最简单的数值验证手感。

### 模块清单

| # | 模块 | 职责 |
|---|------|------|
| 2.1 | 单路战场 | 一条路，僵尸从右走到左 |
| 2.2 | 打字系统 | 字母匹配、命中判定 |
| 2.3 | 连击系统 | 植物链条推进、可变段数、连击归零 |
| 2.4 | 结算计算 | 已激活存活植物攻击力求和（不含协同） |
| 2.5 | 植物系统 | 血量、被啃扣血、阵亡、打满回血/复活 |
| 2.6 | 僵尸行为 | 移动、到达啃植物、被击杀 |
| 2.7 | 胜负判定 | 放过计数、波次完成、关卡通关/失败 |

### 完成标准

- [x] 能完整打完一关（多波僵尸）
- [x] 连击链条正确推进，按错/空格正确结算
- [x] 僵尸能啃植物，植物会阵亡
- [x] 打满连击能复活阵亡植物、回血存活植物
- [x] 放过数超限触发失败，能重打当前关
- [x] 波次之间植物状态保持（不恢复）

> **已完成** — 10 个游戏逻辑模块 + 2 个场景 + 105 个单元测试 + 浏览器验收。详见 `docs/plans/2026-04-14-stage2-core-battle.md`。
>
> **实现要点**：
> - 游戏逻辑层 TDD 开发：Settlement、LetterProvider、PlantChain、ComboSystem、InputHandler、ZombieEntity、ProjectileEntity、BattleManager
> - 弹道系统：真实飞行实体 + AABB 碰撞检测，非瞬时伤害
> - 植物激活条件：连击打满该植物全部段数才算激活（非"经过即激活"，GAME_DESIGN 已同步更新）
> - 植物链条字母全显示：每棵植物头顶显示全部段字母，已打过灰显、当前金色高亮
> - 植物宽度按段数比例分配

**验收原则**：只有一路、一种僵尸、几棵固定植物，数值硬编码，但核心循环完整、手感可验证。

---

## 阶段三：策略配置层

**目标**：把阶段二的硬编码数值全部抽成配置，验证"机制与策略分离"的架构能力。

### 模块清单

| # | 模块 | 职责 |
|---|------|------|
| 3.1 | 配置加载器 | 统一读取、校验配置文件 |
| 3.2 | 植物配置 | 属性、段数、攻击力等走配置 |
| 3.3 | 僵尸配置 | 类型、血量、速度等走配置 |
| 3.4 | 波次配置 | 每波出什么僵尸、间隔、数量 |
| 3.5 | 关卡配置 | 每关几波，属于哪个阶段 |
| 3.6 | 难度配置 | 放过上限、速度倍率等 |

### 完成标准

- [x] 改一行 JSON 能出一个新关卡，不碰代码
- [x] 改植物属性（段数、攻击力、血量）只需改配置
- [x] 改僵尸属性只需改配置
- [x] 改难度参数只需改配置
- [x] 配置有校验，填错能报错

> **已完成** — 8 个配置文件 + 校验函数 + 8 个校验测试 + 113 个总测试通过。详见 `docs/plans/2026-04-14-stage3-config-layer.md`。
>
> **实现要点**：
> - 配置层 5 个文件：plants / zombies / stages / difficulty / battle，字段名对齐 GAME_DESIGN
> - 运行时配置校验：植物 id 唯一性、引用完整性、数值合法性
> - 游戏层重命名 `segments` → `comboSegment` 对齐设计文档
> - BattleConfig 支持多僵尸类型（`zombieConfigs` Record）和可配波次暂停时长
> - BattleScene 全部硬编码常量删除，从 config 层组装参数注入
> - 两个体验不同的关卡验收通过：关卡 1（少量慢僵尸）vs 关卡 2（大量快僵尸）
> - 通关自动进入下一关，全部通关回菜单

**验收原则**：核心代码零改动的情况下，纯靠配置能做出体验明显不同的两个关卡。

---

## 阶段四：协同攻击与多路

**目标**：加入策略深度，形成完整的战斗体验。

### 模块清单

| # | 模块 | 职责 |
|---|------|------|
| 4.1 | 协同攻击系统 | 植物组合判断、攻击力加成、四维特效合成 |
| 4.2 | 多种攻击类型 | 四维正交：Element(6) × Spread(3) × Flight(2) × Impact(4) |
| 4.3 | 多路系统 + Slot 机制 | 独立链条、锁定选路、出题不重复、Slot 植物自选 |
| 4.4 | 多种僵尸 | 胖僵尸（多字母）、旗手（快速）、单词僵尸 |

### 完成标准

- [x] 结算时正确匹配协同规则并计算加成（四维合成）
- [x] 四维弹道正确：Spread(single/burst/fan) × Flight(straight/tracking) × Impact(vanish/chain/pierce/explode)
- [x] 六种元素效果正确：normal/ice/fire/electric/stun/knockback
- [x] 僵尸状态系统正确：slow/burn/stun 持续状态 + knockback 位移
- [x] tracking 弹道每帧重新索敌，排除已命中僵尸
- [x] fan+tracking 子弹独立索敌，各追不同目标
- [x] 2 路和 3 路模式可玩，各路独立运作（含空路）
- [x] 锁定模式选路正确（锁定后只看当前路，结算后解除）
- [x] 自由匹配状态下各路当前字母不重复
- [x] Slot 机制：validateSlot 校验函数就绪，植物选择 UI 属阶段五
- [x] 5 种僵尸类型配置完成（普通/路障/胖僵尸/旗手/小鬼），体型和颜色可视区分
- [x] 波次支持混合出怪（zombies 权重数组）
- [x] 协同规则走配置，新增协同不改代码

> **4.1 + 4.2 已完成** — 新增 EffectSynthesis 特效合成模块 + Settlement 协同倍率 + ProjectileEntity 4 种弹道（direct/pierce/area/tracking）+ element 渲染 + BattleManager 集成。157 个测试通过。详见 `docs/plans/2026-04-14-stage4-synergy-and-attack-types.md`（设计）和 `docs/plans/2026-04-14-stage4-synergy-and-attack-types-impl.md`（实现计划）。
>
> **实现要点**：
> - 协同倍率查表：按激活存活植物数量查 config，支持 fallback 到最大已配置 key
> - 伤害独立计算：每棵植物 attackPower × 协同倍率，各自携带独立伤害
> - 特效合成：元素维度（ice+fire 抵消）× 弹道维度（取最高优先级），纯函数可独立测试
> - 辐射弹道：扇形散射多颗子弹，正前方必有一颗，areaDamageDecay 衰减系数可配
> - 追踪弹道：每帧转向目标，受 trackingTurnRate 限制，目标死亡后惯性飞行
> - 穿透弹道：hitSet 记录已命中僵尸，命中后不消失继续飞行
>
> **4.3 已完成** — Lane 类 + BattleManager 多路重构 + 锁定模式选路 + BattleScene 多路渲染 + validateSlot 校验。201 个测试通过。详见 `docs/plans/2026-04-14-stage4-multi-lane.md`。
>
> **实现要点**：
> - Lane 类封装单路状态（PlantChain + ComboSystem + 字母序列 + 布局）
> - BattleManager 持有 Lane 数组，laneCount=1 时向后兼容
> - 锁定模式：匹配某路后锁定，只看当前路字母，结算/按错/打满解除
> - 僵尸随机分路，zombieLanes Map 追踪，按路独立啃植物
> - 出题冲突避免：LetterProvider.nextExcluding + 结算后重新生成检查
> - 辐射弹道扇形可跨路，追踪弹道全局锁定最近僵尸
> - 植物宽度按全局最大段数对齐，各路视觉一致
> - LevelDef 新增 laneCount + lanePlants，config 驱动多路
>
> **特效合成 v2 重构完成** — 从二维（Element×Trajectory）重构为四维正交（Element×Spread×Flight×Impact）。232 个测试通过。详见 `docs/plans/2026-04-14-effect-synthesis-v2-design.md`（设计）和 `docs/plans/2026-04-14-effect-synthesis-v2-impl.md`（实现计划）。
>
> **重构要点**：
> - 四维正交合成：Element(6值) × Spread(3值) × Flight(2值) × Impact(4值) = 144 种理论形态
> - 冰火抵消规则保留，抵消后取剩余最高优先级元素
> - 弹道生命周期三阶段：发射（Spread）→ 飞行（Flight）→ 命中（Impact）
> - 新增命中行为：chain（弹跳到下一只僵尸）、explode（落点范围爆炸）
> - 新增元素效果：electric（僵尸连通性传导伤害）、stun（眩晕）、knockback（击退位移）
> - 僵尸状态系统：slow/burn/stun 持续状态 + knockback 一次性位移
> - 初版植物从 6 棵扩展到 12 棵，覆盖全部维度值
> - effectParams 集中配置所有效果参数
>
> **4.4 已完成** — 5 种僵尸类型 + 混合出怪 + 演示关卡。239 个测试通过。详见 `docs/plans/2026-04-14-stage4-zombie-types.md`。
>
> **实现要点**：
> - ZombieDef 新增 width/height/color 字段，ZombieEntity 改用对象参数构造
> - WaveDef 支持 zombies 权重数组混合出怪，向后兼容 zombieType 单类型
> - 5 种僵尸覆盖 hp/速度/体型/chewDps 全参数空间：普通/路障/胖僵尸/旗手/小鬼
> - 两个演示关卡验证：肉盾编队（普通+路障+胖）、混合冲锋（全部 5 种）

**验收原则**：3 路 + 多种僵尸 + 协同攻击，有策略选择的完整战斗。

---

## 阶段五：进度与激励系统

**目标**：从"一局体验"变成"持续想玩"。

### 模块清单

| # | 模块 | 职责 |
|---|------|------|
| 5.1 | 指法阶段系统 | 阶段通关、关卡追踪 |
| 5.2 | 植物解锁 | 通关阶段解锁新植物 |
| 5.3 | 指法引导 | 虚拟键盘显示、手指高亮 |
| 5.4 | 持久化存储 | localStorage 存档读档 |
| 5.5 | 波次结算界面 | 数据展示、趣味称号 |
| 5.6 | 成就系统 | 里程碑徽章 |
| 5.7 | 植物图鉴 | 收集展示所有植物 |
| 5.8 | 关卡选择界面 | 阶段 / 关卡浏览和选择 |

### 完成标准

- [ ] 从第 1 阶段打到第 5 阶段的完整流程可走通
- [ ] 每通关一个阶段正确解锁对应植物
- [ ] 虚拟键盘正确高亮当前键位和手指
- [ ] 关闭浏览器重开后进度不丢失
- [ ] 每波结束有数据总结
- [ ] 成就能触发和展示

**验收原则**：一个孩子可以从零开始，经过多次游玩逐步解锁所有内容。

---

## 阶段六：打磨与体验

**目标**：从"能玩"到"好玩"。

### 模块清单

| # | 模块 | 职责 |
|---|------|------|
| 6.1 | 视觉打磨 | 植物/僵尸完整动画、攻击特效、大招特效 |
| 6.2 | 音效完善 | 不同植物音效、连击递进音效、大招音效 |
| 6.3 | 难度自适应 | 字母熟练度追踪、智能出题频率 |
| 6.4 | UI 完善 | 主菜单、设置、难度选择、整体视觉风格统一 |
| 6.5 | 平衡调整 | 基于实际游玩数据调数值 |

### 完成标准

- [ ] 视觉风格统一，符合"卡通蠢萌"定位
- [ ] 打击反馈有手感（音效 + 动画配合）
- [ ] 难度曲线平滑，不出现断崖
- [ ] 8-9 岁孩子能自己看懂 UI 并上手

**验收原则**：找目标年龄段的孩子试玩，能主动想继续玩。

---

## 文档索引

| 文档 | 说明 |
|------|------|
| [GAME_DESIGN.md](./GAME_DESIGN.md) | 游戏设计索引（概述、架构、优先级）+ 子文档链接 |
| [BATTLE_MECHANICS.md](./BATTLE_MECHANICS.md) | 战斗机制详细设计（打字、连击、结算、波次、多路） |
| [PLANTS_AND_EFFECTS.md](./PLANTS_AND_EFFECTS.md) | 植物与特效系统（属性、Slot、四维特效合成、协同） |
| [ZOMBIES_AND_STAGES.md](./ZOMBIES_AND_STAGES.md) | 僵尸与阶段进度（僵尸属性/状态、指法阶段、反馈） |
| [CONFIG_REFERENCE.md](./CONFIG_REFERENCE.md) | 数据模型与策略配置示例 |
| ROADMAP.md（本文档） | 开发路线图与进度跟踪 |
| [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) | 测试策略（四层测试、无头集成、AI 测试流程） |
| [plans/2026-04-13-stage1-game-engine.md](./plans/2026-04-13-stage1-game-engine.md) | 阶段一实现计划（已完成） |
| [plans/2026-04-13-engine-upgrade-for-stage2.md](./plans/2026-04-13-engine-upgrade-for-stage2.md) | 阶段二前引擎升级设计（已完成） |
| [plans/2026-04-14-stage2-core-battle.md](./plans/2026-04-14-stage2-core-battle.md) | 阶段二核心战斗机制实现计划（已完成） |
| [plans/2026-04-14-stage3-config-layer.md](./plans/2026-04-14-stage3-config-layer.md) | 阶段三策略配置层实现计划（已完成） |
| [plans/2026-04-14-stage4-synergy-and-attack-types.md](./plans/2026-04-14-stage4-synergy-and-attack-types.md) | 阶段四协同攻击+多弹道设计文档（4.1+4.2 已完成） |
| [plans/2026-04-14-stage4-synergy-and-attack-types-impl.md](./plans/2026-04-14-stage4-synergy-and-attack-types-impl.md) | 阶段四协同攻击+多弹道实现计划（4.1+4.2 已完成） |
| [plans/2026-04-14-stage4-multi-lane.md](./plans/2026-04-14-stage4-multi-lane.md) | 阶段四多路系统+Slot机制实现计划（4.3 已完成） |
| [plans/2026-04-14-effect-synthesis-v2-design.md](./plans/2026-04-14-effect-synthesis-v2-design.md) | 特效合成系统 v2 设计文档（四维正交重构，已完成） |
| [plans/2026-04-14-effect-synthesis-v2-impl.md](./plans/2026-04-14-effect-synthesis-v2-impl.md) | 特效合成系统 v2 实现计划（已完成） |
| [plans/2026-04-14-stage4-zombie-types.md](./plans/2026-04-14-stage4-zombie-types.md) | 阶段四多种僵尸类型实现计划（4.4 已完成） |
