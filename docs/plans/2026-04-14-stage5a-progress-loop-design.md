# 阶段五 A 组：进度闭环 — 设计文档

> **范围**：持久化存储（5.4）、阶段解锁与进度追踪（5.1）、结算界面（5.5）、关卡选择与主菜单改造（5.8）
>
> **不含**（B 组后续迭代）：植物解锁+图鉴（5.2/5.7）、指法引导/虚拟键盘（5.3）、成就系统（5.6）

---

## 一、设计决策汇总

| 问题 | 决定 |
|------|------|
| 范围 | A 组先做进度闭环，B 组后续加激励与引导 |
| 导航模式 | 线性推进为主 + 大"继续"按钮 + "选关"入口回玩 |
| 结算时机 | 关卡通关 + 失败时展示结算，波与波之间保持短暂停顿不弹结算 |
| 解锁规则 | 严格线性：通关第 N 关才开第 N+1 关，打完一阶段解锁下一阶段 |
| 难度选择 | 全局设置，主菜单直接切换，随时可改 |
| 结算内容 | 核心数据 + 1-3 星评级 + 趣味称号 |
| 失败鼓励 | 预设鼓励语池随机选，不依赖历史数据 |
| 持久化分层 | 引擎层提供 Storage 接口，游戏层构建 SaveDataService |
| 结算/选关界面 | 均为 Canvas 场景，通过 SceneManager 切换 |

---

## 二、持久化存储（5.4）

### 2.1 引擎层 — Storage 接口

新增 `engine/Storage.ts`，提供通用 key-value 持久化能力：

```typescript
interface Storage {
  save(key: string, data: unknown): void
  load<T>(key: string): T | null
  delete(key: string): void
}
```

实现类 `LocalStorage`：
- 包装 `window.localStorage`
- JSON 序列化/反序列化
- `save` 时自动 `JSON.stringify`，`load` 时 `JSON.parse`
- 异常处理：localStorage 不可用（隐私模式等）时静默降级，`load` 返回 null

### 2.2 游戏层 — SaveData 结构

新增 `game/SaveDataService.ts`：

```typescript
interface SaveData {
  version: number                  // 存档版本号，当前为 1，用于未来数据迁移
  currentStageId: string           // 当前所在阶段 ID
  currentLevelIndex: number        // 当前阶段内关卡索引（0-based）
  completedLevels: string[]        // 已通关关卡 ID 列表（格式："stageId-levelIndex"）
  difficulty: string               // 当前难度 "easy" | "normal" | "hard"
  bestStars: Record<string, number> // 每关最高星级（key 同 completedLevels 格式，value 1-3）
}
```

默认值（新玩家）：
```typescript
{
  version: 1,
  currentStageId: "stage1",      // 第一阶段
  currentLevelIndex: 0,          // 第一关
  completedLevels: [],
  difficulty: "normal",
  bestStars: {}
}
```

### 2.3 SaveDataService 核心方法

```typescript
class SaveDataService {
  constructor(storage: Storage)

  load(): SaveData
  save(data: SaveData): void

  // 通关：标记完成，推进进度
  // stageLevelCount 由场景层从 config 读取后传入，避免直接导入 config
  // nextStageId 为下一阶段 ID，null 表示已是最后阶段
  completeLevel(stageId: string, levelIndex: number, stars: number,
                stageLevelCount: number, nextStageId: string | null): void

  // 解锁判定：传入前一关信息，检查是否在 completedLevels 中
  isLevelUnlocked(stageId: string, levelIndex: number,
                  prevLevelId: string | null): boolean

  // 难度
  getDifficulty(): string
  setDifficulty(difficulty: string): void

  // 重置存档
  reset(): void
}
```

**架构约束**：
- SaveDataService 属于游戏逻辑层（`game/`），不导入 `config/`
- 阶段结构信息（关卡数量、阶段顺序）由场景层从 config 读取后以参数传入
- 引擎层的 Storage 接口不感知 SaveData 结构

---

## 三、结算界面（5.5）

### 3.1 数据采集 — BattleStats

BattleManager 在战斗过程中收集统计数据：

```typescript
interface BattleStats {
  zombiesKilled: number        // 击杀僵尸总数
  longestCombo: number         // 最长连击（连续正确按键数）
  totalCombo: number           // 总连击次数（触发结算的次数）
  synergyCount: number         // 协同攻击触发次数（激活 ≥2 棵植物的结算）
  missedCount: number          // 放过僵尸数
  fullChainCount: number       // 打满链条次数
}
```

埋点位置：
- `zombiesKilled`：僵尸 hp ≤ 0 时 ++
- `longestCombo`：每次按键正确时更新当前连击计数，结算时与 longestCombo 取 max
- `totalCombo`：每次触发结算时 ++
- `synergyCount`：结算时 activatedCount ≥ 2 则 ++
- `missedCount`：僵尸越过左边界时 ++（已有逻辑，复用）
- `fullChainCount`：结算时 isFullChain 则 ++

BattleManager 新增 `getStats(): BattleStats` 方法，关卡结束时由 BattleScene 读取传给 SettlementScene。

### 3.2 星级评价

通关时根据表现给 1-3 星：

| 星级 | 条件 |
|------|------|
| 3 星 | missedCount === 0（零放过） |
| 2 星 | missedCount ≤ missedLimit / 2（放过数不超过上限一半） |
| 1 星 | 通关即得 |

失败时不给星级。

### 3.3 趣味称号

从表现数据中按优先级匹配第一个命中的称号：

| 优先级 | 条件 | 称号 |
|--------|------|------|
| 1 | 零放过 + fullChainCount ≥ 3 | 「完美指挥官」 |
| 2 | 零放过 | 「滴水不漏」 |
| 3 | longestCombo ≥ 20 | 「连击大师」 |
| 4 | synergyCount ≥ 5 | 「协同达人」 |
| 5 | fullChainCount ≥ 3 | 「全链专家」 |
| 6 | 通关兜底 | 「勇敢的键盘侠」 |
| 7 | 失败兜底 | （不显示称号，显示鼓励语） |

称号阈值（20、5、3）走配置，放 `src/config/` 中，方便调整。

### 3.4 失败鼓励语

预设鼓励语池，随机选一条：

```typescript
const ENCOURAGEMENTS = [
  "僵尸们也被你的勇气吓到了！再来一次？",
  "差一点点就成功了，加油！",
  "每个键盘侠都是从失败中成长的！",
  "僵尸只是运气好，再试试看？",
  "你已经很棒了，再挑战一次吧！",
]
```

### 3.5 SettlementScene 布局

```
┌─────────────────────────────────┐
│                                   │
│        「连击大师」                │  ← 称号（通关）或鼓励语（失败）
│                                   │
│        ⭐⭐⭐                     │  ← 星级（仅通关显示）
│                                   │
│     击杀僵尸 .............. 12    │  ← 数据行
│     最长连击 .............. 8     │
│     协同攻击 .............. 3     │
│     放过僵尸 .............. 1     │
│                                   │
│      [ 继续 ]    [ 重玩 ]         │  ← 通关按钮
│      [ 重试 ]    [ 选关 ]         │  ← 失败按钮
│                                   │
└─────────────────────────────────┘
```

SettlementScene 构造参数：
```typescript
interface SettlementSceneParams {
  result: 'victory' | 'defeat'
  stats: BattleStats
  stars: number                    // 0（失败）或 1-3
  title: string                    // 称号或鼓励语
  stageId: string                  // 当前阶段（用于写存档和跳转）
  levelIndex: number               // 当前关卡索引
}
```

### 3.6 场景流转

- **通关** → BattleScene 调用 SceneManager 切到 SettlementScene（传入 victory + stats）
  - "继续"：写入存档（completeLevel），切到 BattleScene（下一关）；如果已全部通关，回 MenuScene
  - "重玩"：不写存档，重新进入 BattleScene（当前关）
- **失败** → BattleScene 切到 SettlementScene（传入 defeat + stats）
  - "重试"：重新进入 BattleScene（当前关）
  - "选关"：切到 StageSelectScene

---

## 四、关卡选择与主菜单改造（5.8）

### 4.1 MenuScene 改造

现有 MenuScene 只有"开始"按钮。改造后：

```
┌─────────────────────────────────┐
│                                   │
│        键盘侠大战僵尸              │  ← 标题
│                                   │
│     当前进度：基准键 F/J           │  ← 当前阶段名称
│     关卡 2 / 3                    │  ← 进度（当前关 / 阶段总关数）
│                                   │
│          [ 继 续 ]                │  ← 大按钮，进入下一个未完成关卡
│                                   │
│          [ 选 关 ]                │  ← 进入 StageSelectScene
│       [ 难度：普通 ]              │  ← 点击循环切换 easy/normal/hard
│                                   │
└─────────────────────────────────┘
```

**交互**：
- "继续"：读取 `currentStageId` + `currentLevelIndex`，直接进入 BattleScene
- "选关"：切到 StageSelectScene
- "难度"：点击循环切换（简单→普通→困难→简单），实时写入存档，界面直接刷新文案
- 全部通关后："继续"文案改为"自由练习"，可进入最后通关的关卡

MenuScene 启动时从 SaveDataService 读取存档，显示进度信息。

### 4.2 StageSelectScene

纵向列表展示所有阶段和关卡：

```
┌─────────────────────────────────┐
│   ← 返回                  选关   │  ← 顶栏
│                                   │
│  ▼ 阶段1：基准键 F/J              │  ← 已解锁阶段，展开关卡列表
│     ★★★  关卡 1                   │  ← 已通关，显示星级，可重玩
│     ★★☆  关卡 2                   │  ← 已通关
│     ○    关卡 3                   │  ← 已解锁未通关（当前关），可点击
│                                   │
│  🔒 阶段2：中间行                  │  ← 未解锁阶段，灰显不可点击
│  🔒 阶段3：上行                    │
│  ...                              │
└─────────────────────────────────┘
```

**交互规则**：
- 已通关关卡：显示最高星级，点击可重玩
- 当前关卡（已解锁未通关）：显示空心圆标记，可点击进入
- 未到达的关卡：不显示（该阶段只展示已通关 + 当前关）
- 未解锁阶段：灰显，显示阶段名称 + 锁图标，不展开关卡列表
- 点击可玩关卡 → 直接进入 BattleScene
- "返回" → 回 MenuScene

**重玩已通关关卡**：
- 重玩不影响进度，不更新星级（A 组简化）
- 纯练习用途

### 4.3 场景流转总览

```
MenuScene
 ├─ "继续" ──→ BattleScene(当前关)
 ├─ "选关" ──→ StageSelectScene
 │              └─ 点击关卡 ──→ BattleScene
 └─ "难度" ──→ 原地切换（不跳场景）

BattleScene
 ├─ 通关 ──→ SettlementScene(victory)
 │           ├─ "继续" ──→ BattleScene(下一关)
 │           └─ "重玩" ──→ BattleScene(当前关)
 ├─ 失败 ──→ SettlementScene(defeat)
 │           ├─ "重试" ──→ BattleScene(当前关)
 │           └─ "选关" ──→ StageSelectScene
 └─ ESC ──→ MenuScene
```

---

## 五、阶段解锁与进度追踪（5.1）

### 5.1 解锁判定逻辑

`SaveDataService.completeLevel()` 的推进规则：

```
通关一关时：
1. 将 "stageId-levelIndex" 加入 completedLevels
2. 记录星级到 bestStars（仅首次通关写入；重玩已通关关卡不写入不更新）
3. 判断是否阶段最后一关：
   - 否 → currentLevelIndex++
   - 是 + 有下一阶段 → currentStageId = nextStageId, currentLevelIndex = 0
   - 是 + 无下一阶段 → 全部通关，进度不再推进
4. 写入存档
```

`isLevelUnlocked()` 的判定规则：
- 第一阶段第一关（游戏起点）：始终解锁
- 其他关卡：前一关的 ID 在 `completedLevels` 中 → 解锁
- 跨阶段：上一阶段最后一关在 `completedLevels` 中 → 本阶段第一关解锁

### 5.2 全部通关状态

最后阶段最后一关通关后：
- `currentStageId` / `currentLevelIndex` 保持在最后通关的位置
- MenuScene："继续"文案改为"自由练习"
- StageSelectScene：所有关卡可选，均显示星级

---

## 六、配置层新增

### 6.1 结算配置

新增 `src/config/settlement.ts`：

```typescript
// 称号阈值配置
interface TitleThresholds {
  longestComboForMaster: number    // 默认 20
  synergyCountForPro: number      // 默认 5
  fullChainCountForExpert: number  // 默认 3
}

// 称号规则（纯数据，判定逻辑在游戏层）
// 每条规则声明所需条件字段和阈值，游戏层遍历匹配
interface TitleRule {
  id: string
  name: string
  requires: {
    zeroMissed?: boolean                  // 要求零放过
    minLongestCombo?: number              // 最长连击 ≥ 阈值
    minSynergyCount?: number             // 协同次数 ≥ 阈值
    minFullChainCount?: number           // 打满链条次数 ≥ 阈值
  }
}

// 鼓励语池
const ENCOURAGEMENTS: string[]
```

### 6.2 难度显示名

现有 `DifficultyDef` 新增 `displayName` 字段：
- easy → "简单"
- normal → "普通"
- hard → "困难"

---

## 七、不做的事（明确排除）

- **不做植物解锁逻辑**：A 组中通关不触发植物解锁事件，所有已配置植物默认可用
- **不做成就系统**：不采集成就触发数据
- **不做虚拟键盘**：指法引导放 B 组
- **不做植物图鉴**：放 B 组
- **不做重玩星级更新**：重玩不覆盖历史星级
- **不做历史数据对比**：失败鼓励不参考历史表现
- **不改引擎层核心逻辑**：只新增 Storage 接口，不改 GameLoop / EntityManager / SceneManager 等
