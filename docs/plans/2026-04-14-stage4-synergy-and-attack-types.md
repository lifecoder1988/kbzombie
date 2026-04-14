# 阶段四（4.1 + 4.2）：协同攻击系统 + 多种攻击类型

> 范围：ROADMAP 阶段四中的模块 4.1（协同攻击系统）和 4.2（多种攻击类型）。多路系统（4.3）和多种僵尸（4.4）不在本次范围内。

---

## 设计决策记录

| 问题 | 决策 |
|------|------|
| 元素附加效果（冰冻减速/火焰灼烧） | 本阶段搭框架，不实现实际效果，数值后续调平衡 |
| 辐射弹道参数 | 子弹数量、扇形角度、衰减系数均走 config，角度按数量动态计算，正前方必有一颗 |
| 协同倍率数值 | 用 GAME_DESIGN 建议值（2 棵 ×1.2 ~ 6 棵 ×3.0），走 config 配置 |
| 伤害分配 | 每棵植物独立计算：该植物 attackPower × 协同倍率，不做总量平分 |
| 弹道实现方式 | 扩展现有 ProjectileEntity，switch 分支处理 4 种弹道，不拆子类 |

---

## 一、Config 层变更

### 1.1 新增类型（`src/config/types.ts`）

```ts
export type Element = 'normal' | 'ice' | 'fire'
export type Trajectory = 'direct' | 'tracking' | 'pierce' | 'area'

export interface SynergyDef {
  /** key = 激活植物数量, value = 攻击力倍率 */
  readonly multiplier: Readonly<Record<number, number>>
}
```

### 1.2 PlantDef 扩展

新增 `element: Element` 和 `trajectory: Trajectory` 两个字段。

### 1.3 BattleDef 扩展

新增辐射弹道参数：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `areaBulletCount` | number | 5 | 辐射散射子弹数量 |
| `areaSpreadAngle` | number | π/3 | 扇形总角度（弧度） |
| `areaDamageDecay` | number | 1.0 | 每颗子弹的威力衰减系数 |
| `trackingTurnRate` | number | π (3.14) | 追踪弹道最大转向速率（弧度/秒） |

### 1.4 新增 `src/config/synergy.ts`

协同倍率查找表：

```ts
export const SYNERGY_PARAMS: SynergyDef = {
  multiplier: { 1: 1.0, 2: 1.2, 3: 1.5, 4: 1.8, 5: 2.2, 6: 3.0 }
}
```

### 1.5 `src/config/plants.ts` 更新

现有 3 棵植物补充 element 和 trajectory：

| 植物 | element | trajectory |
|------|---------|------------|
| 豌豆射手 | normal | direct |
| 寒冰射手 | ice | direct |
| 双发射手 | normal | direct |

当前阶段都是 direct 弹道，但框架已就位，后续解锁火炬/大喷菇/猫尾草时直接加配置行。

### 1.6 校验扩展（`src/config/validation.ts`）

- element 值必须是 `'normal' | 'ice' | 'fire'`
- trajectory 值必须是 `'direct' | 'tracking' | 'pierce' | 'area'`
- synergy multiplier 表中 key=1 必须存在且值为 1.0
- areaBulletCount ≥ 1，areaSpreadAngle > 0，areaDamageDecay > 0

---

## 二、游戏逻辑层变更

### 2.1 新增 `src/game/EffectSynthesis.ts`

纯函数模块，输入植物特效标签列表，输出合成后的攻击类型。

**接口：**

```ts
interface SynthesizedEffect {
  readonly element: Element
  readonly trajectory: Trajectory
}

function synthesizeEffects(
  plants: readonly { element: Element; trajectory: Trajectory }[]
): SynthesizedEffect
```

**元素合成规则：**

1. 收集所有植物的 element，去重
2. 只含 normal → normal
3. 含 ice 不含 fire → ice
4. 含 fire 不含 ice → fire
5. 同时含 ice 和 fire → 互相抵消 → normal

**弹道合成规则：**

- 优先级：direct(0) < tracking(1) < pierce(2) < area(3)
- 取所有植物中最高优先级

**边界情况：**

- 空数组 → `{ element: 'normal', trajectory: 'direct' }`
- 单棵植物 → 直接返回其自身标签

### 2.2 `src/game/types.ts` 扩展

**PlantConfig** 新增：

```ts
readonly element: Element
readonly trajectory: Trajectory
```

**SettlementResult** 新增：

```ts
readonly synergyMultiplier: number             // 协同倍率
readonly perPlantPower: readonly number[]       // 与 aliveActivatedIndices 一一对应，每棵激活存活植物的最终伤害
readonly synthesizedEffect: SynthesizedEffect   // 合成后的攻击类型
```

### 2.3 `src/game/Settlement.ts` 扩展

函数签名新增 `synergyMultiplier` 参数（由场景层从 config 注入）：

```ts
function calculateSettlement(
  plants: readonly PlantState[],
  comboCount: number,
  isFullChain: boolean,
  synergyMultiplier: Readonly<Record<number, number>>,
): SettlementResult
```

计算流程：

1. 遍历植物，按段数累加判断激活（现有逻辑不变）
2. 收集激活且存活的植物
3. 按激活存活数量查 synergyMultiplier 表 → multiplier（表中无对应数量时取最大已配置数量的倍率）
4. `perPlantPower[i] = plants[i].config.attackPower × multiplier`
5. `totalPower = sum(perPlantPower)`
6. 调用 `synthesizeEffects` 合成特效
7. 返回完整 SettlementResult

### 2.4 `src/game/ProjectileEntity.ts` 多弹道支持

构造参数扩展为配置对象：

```ts
interface ProjectileConfig {
  id: string
  x: number
  y: number
  speed: number
  power: number
  rightBound: number
  trajectory: Trajectory
  element: Element
  angle?: number                    // 辐射弹道的散射角度（弧度）
  target?: Entity                   // 追踪弹道的目标僵尸实体（活引用，位置实时跟踪）
  maxTurnRate?: number              // 追踪弹道最大转向速率（弧度/秒），从 config trackingTurnRate 注入
}
```

**四种弹道的 update 行为：**

| 弹道 | 移动 | 命中后 | 消失条件 |
|------|------|--------|----------|
| direct | 水平向右 | active = false | 命中或飞出右边界 |
| pierce | 水平向右 | 记录已命中 zombieId，不消失 | 飞出右边界 |
| area 的每颗子弹 | 按 angle 方向飞行 | active = false | 命中或飞出边界 |
| tracking | 每帧转向目标，受 maxTurnRate 限制 | active = false | 命中或飞出边界；目标死亡后沿惯性飞行 |

**pierce 碰撞处理：**

- 维护 `hitSet: Set<string>`（已命中的僵尸 id）
- `onHit(zombieId)` 时加入 hitSet，不置 active = false
- 碰撞检测时跳过 hitSet 中已有的僵尸

**element 渲染颜色：**

- normal: 金色 `#ffd700`（现有）
- ice: 浅蓝 `#87ceeb`
- fire: 橙红 `#ff6347`

### 2.5 `src/game/BattleManager.ts` 结算调用变化

`executeSettlement` 改动：

1. 调用 `calculateSettlement` 时传入 `synergyMultiplier`（从 config 注入）
2. 从 `result.perPlantPower` 取每棵植物的独立伤害
3. 根据 `result.synthesizedEffect.trajectory` 创建弹道：
   - direct / pierce / tracking → 每棵激活植物发 1 颗弹道
   - area → 每棵激活植物发 `areaBulletCount` 颗弹道，每颗 power = perPlantPower[i] × areaDamageDecay，angle 按扇形对称分布
4. 碰撞检测循环中，对 pierce 弹道调用 `onHit(zombieId)` 并检查 hitSet

**辐射扇形角度计算：**

- 总角度 = `areaSpreadAngle`（可配置）
- count 颗子弹均匀分布在 `[-areaSpreadAngle/2, +areaSpreadAngle/2]`
- 0° = 正右方，始终包含一颗
- 无论奇偶，0°（正右方）始终有一颗
- count = 1 时只发正前方一颗
- count > 1 时其余子弹在 `[-areaSpreadAngle/2, +areaSpreadAngle/2]` 范围内均匀填充（间距 = areaSpreadAngle / (count - 1)）

---

## 三、场景层变更

### `src/scenes/BattleScene.ts`

- 从 `synergy.ts` 读取 `SYNERGY_PARAMS.multiplier`，传入 BattleManager config
- 从 `battle.ts` 读取 `areaBulletCount`、`areaSpreadAngle`、`areaDamageDecay`，传入 BattleManager config
- PlantConfig 组装时从 PlantDef 中取 element/trajectory 传入

---

## 四、不改动的部分

| 模块 | 原因 |
|------|------|
| 引擎层全部 | 零改动，AABB `intersects` 通用能力足够 |
| ComboSystem / PlantChain / InputHandler | 连击和植物链条逻辑不涉及 |
| ZombieEntity | `takeDamage` 接口足够，冰冻减速/灼烧留后续 |
| LetterProvider | 出题逻辑不涉及 |

---

## 五、测试计划

游戏逻辑层测试先行（TDD），按 CLAUDE.md 约定。

| 模块 | 测试用例 |
|------|----------|
| EffectSynthesis | 单元素返回自身；ice+fire 抵消为 normal；弹道取最高优先级；空输入返回默认值；单植物返回自身标签 |
| Settlement | 协同倍率正确应用（1/2/3 棵）；perPlantPower 独立计算各不相同；表中无对应数量取最大配置值；0 连击返回空结果；阵亡植物不计入协同数量 |
| ProjectileEntity | direct 命中消失；pierce 命中不消失 + 已命中跳过；area 角度分布正确 + 正前方必有一颗；tracking 转向 + 目标死亡后惯性；element 不影响飞行逻辑 |
| config/validation | element/trajectory 合法值检查；synergy 表完整性；area 参数合法性 |
| BattleManager | area 创建 areaBulletCount 颗弹道；衰减系数正确应用；协同倍率从 config 注入生效 |

---

*文档版本：v1.0 | 2026-04-14 | 基于 GAME_DESIGN.md v1.5*
