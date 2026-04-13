# 测试策略

> 核心目标：让 AI 能通过跑测试来验证改动正确性，减少"改完在浏览器里手动点"的次数。

---

## 设计原则

### 可测试性是架构约束

游戏有个天然难题：核心产出是 Canvas 上的画面，而画面很难自动化断言。

解法：**让游戏能"无头运行"**——完整的游戏逻辑（僵尸移动、连击推进、结算计算、植物生死）全部可以在没有 Canvas、没有浏览器的环境下执行。测试只需要断言状态，不需要看画面。

这要求：

- **update() 不依赖 render()**。去掉整个渲染层，游戏逻辑照跑。
- **输入系统可注入**。测试时不接浏览器 keydown，而是直接喂入 `{ key: 'f', timestamp: 1000 }` 这样的输入事件。
- **时间可控制**。测试时不用 requestAnimationFrame，而是手动传入 dt，让游戏"快进"到想要的时刻。
- **随机可控制**。所有用到随机的地方（出什么字母、僵尸生成位置）通过可注入的随机种子控制，测试结果确定性重现。

如果某段游戏逻辑做不到无头测试，说明它和渲染或浏览器 API 耦合了，**先重构解耦，再写测试**。

### 测试金字塔

```
        /  浏览器验证  \          少量，人工确认视觉和手感
       /  无头集成测试  \         中量，模拟完整游戏场景
      /  系统单元测试    \        大量，测各系统的状态机
     /  纯函数单元测试    \       大量，测计算逻辑
```

底层两层跑得最多——AI 每次改代码都跑。顶层人工验证只在阶段性里程碑做。

---

## 四层测试详解

### 第一层：纯函数单元测试

测试对象：无状态的计算函数，输入 → 输出，最容易测。

覆盖范围：

| 模块 | 测试内容 |
|------|----------|
| 结算计算 | 给定已激活植物列表 → 返回正确的总攻击力 |
| 协同匹配 | 给定植物组合 → 返回匹配到的协同规则和加成 |
| 攻击范围 | 给定攻击类型和僵尸位置 → 返回命中的僵尸列表 |
| 连击段计算 | 给定植物链条配置和连击数 → 返回当前激活到哪棵植物 |
| 配置校验 | 给定配置 JSON → 返回校验结果（通过/具体错误） |

示例：

```typescript
// 结算计算测试
describe('calculateSettlement', () => {
  it('对所有存活的已激活植物求和', () => {
    const plants = [
      { id: 'peashooter', alive: true, attackPower: 10 },
      { id: 'snow_pea', alive: true, attackPower: 8 },
      { id: 'torchwood', alive: false, attackPower: 25 },  // 阵亡，不计
    ]
    const activated = [0, 1, 2]  // 三棵都被连击经过了
    const result = calculateSettlement(plants, activated, synergies)
    expect(result.totalPower).toBe(18)  // 10 + 8，火炬阵亡不算
  })

  it('触发协同攻击时应用加成', () => {
    const plants = [
      { id: 'peashooter', alive: true, attackPower: 10 },
      { id: 'torchwood', alive: true, attackPower: 25 },
    ]
    const activated = [0, 1]
    const result = calculateSettlement(plants, activated, synergies)
    // 豌豆+火炬 → 火焰豌豆协同，1.5 倍加成
    expect(result.totalPower).toBe(Math.floor((10 + 25) * 1.5))
    expect(result.attackType).toBe('single_fire')
  })
})
```

### 第二层：系统单元测试

测试对象：有内部状态的系统，需要模拟一系列操作后断言状态变化。

覆盖范围：

| 系统 | 测试内容 |
|------|----------|
| 连击系统 | 连续命中推进 → 按错归零 → 打满触发大招 → 空转段行为 |
| 僵尸行为 | 移动 → 到达植物 → 啃植物 → 植物阵亡 → 继续前进 |
| 植物系统 | 被啃掉血 → 阵亡 → 连击打满复活 → 回血 |
| 波次管理 | 生成僵尸 → 波次完成判定 → 失败判定 → 波次间状态保持 |
| 输入映射 | 多路场景下字母匹配到正确路线 |
| 实体管理 | 创建 → 更新 → 标记销毁 → 清理 |
| 场景管理 | 切换场景 → enter/exit 调用 → 正确转发 update |

示例：

```typescript
// 连击系统测试
describe('ComboSystem', () => {
  it('按错时结算当前已激活植物并归零', () => {
    const combo = new ComboSystem(plantChainConfig)
    combo.hit()  // 连击 1
    combo.hit()  // 连击 2
    combo.hit()  // 连击 3
    combo.hit()  // 连击 4
    combo.hit()  // 连击 5，推进到第二棵植物

    const settlement = combo.miss()  // 按错
    expect(settlement.activatedPlants).toEqual([0, 1])  // 两棵植物被激活
    expect(combo.current).toBe(0)  // 连击归零
  })

  it('打满链条触发复活并归零', () => {
    const combo = new ComboSystem(plantChainConfig)  // 总长 8
    for (let i = 0; i < 8; i++) combo.hit()

    const settlement = combo.fulfill()
    expect(settlement.isFullChain).toBe(true)
    expect(settlement.activatedPlants).toEqual([0, 1])
    expect(combo.current).toBe(0)
  })

  it('阵亡植物的空转段不贡献攻击', () => {
    const combo = new ComboSystem(plantChainConfig)
    combo.killPlant(1)  // 第二棵植物阵亡

    for (let i = 0; i < 6; i++) combo.hit()  // 连击到第二棵的空转段
    const settlement = combo.miss()

    // 第一棵活着贡献攻击，第二棵空转不贡献
    expect(settlement.activatedPlants).toEqual([0, 1])
    expect(settlement.alivePlants).toEqual([0])  // 只有第一棵存活
  })
})
```

### 第三层：无头集成测试（最关键的 AI 效率工具）

测试对象：完整的游戏流程，但不渲染。模拟"一个孩子玩了一局游戏"。

#### 核心组件：HeadlessGame

```typescript
// 无头游戏运行器——在测试中模拟完整游戏
class HeadlessGame {
  // 创建：传入配置，不传 Canvas
  constructor(config: GameConfig)

  // 手动推进时间（替代 requestAnimationFrame）
  tick(dt: number): void

  // 注入输入事件（替代键盘）
  pressKey(key: string): void

  // 读取当前状态
  getState(): GameState
  getLane(index: number): LaneState
  getZombies(): ZombieState[]
  getPlants(lane: number): PlantState[]
}
```

#### 测试场景示例

```typescript
describe('完整游戏流程', () => {
  it('打完一波僵尸后进入下一波，植物状态保持', () => {
    const game = new HeadlessGame(testConfig)
    game.startLevel(1)

    // 第一波：杀掉所有僵尸，但让一棵植物被啃到残血
    const zombies = game.getZombies()
    for (const z of zombies) {
      // 模拟僵尸走到中途时被击杀
      game.tick(2000)
      game.pressKey(z.letter)
    }

    // 第一波结束
    expect(game.getState().currentWave).toBe(2)

    // 植物残血状态带入第二波
    const plant = game.getPlants(0)[2]
    expect(plant.currentHp).toBeLessThan(plant.maxHp)
  })

  it('连续打满连击链复活阵亡植物', () => {
    const game = new HeadlessGame(testConfig)
    game.startLevel(1)

    // 让一棵植物被啃死
    game.tick(30000)  // 快进 30 秒，僵尸啃掉最右侧植物
    expect(game.getPlants(0)[2].alive).toBe(false)

    // 打满一次完整连击链
    for (let i = 0; i < game.getLane(0).comboMax; i++) {
      const zombie = game.getZombies().find(z => z.lane === 0)
      if (zombie) game.pressKey(zombie.letter)
      game.tick(100)
    }

    // 植物复活了
    expect(game.getPlants(0)[2].alive).toBe(true)
  })

  it('放过数超限触发本波失败', () => {
    const game = new HeadlessGame(testConfig)
    game.startLevel(1)

    // 什么都不按，让僵尸走过去
    game.tick(120000)  // 快进 2 分钟

    expect(game.getState().waveStatus).toBe('failed')
    expect(game.getState().missedCount).toBeGreaterThanOrEqual(
      game.getState().missedLimit
    )
  })
})

describe('多路切换', () => {
  it('空格释放当前路后，下一个字母自动选路', () => {
    const game = new HeadlessGame(multiLaneConfig)
    game.startLevel(1)
    game.tick(3000)

    // 在第 0 路连击几下
    const z0 = game.getZombies().find(z => z.lane === 0)!
    game.pressKey(z0.letter)
    game.pressKey(z0.letter)
    expect(game.getLane(0).comboCount).toBe(2)

    // 空格释放
    game.pressKey(' ')
    expect(game.getLane(0).comboCount).toBe(0)

    // 按第 1 路僵尸的字母，自动切到第 1 路
    const z1 = game.getZombies().find(z => z.lane === 1)!
    game.pressKey(z1.letter)
    expect(game.getLane(1).comboCount).toBe(1)
  })
})
```

#### 辅助工具：输入序列生成

```typescript
// 用于测试的脚本化输入——不用手动一个个 pressKey
function playScript(game: HeadlessGame, script: ScriptAction[]) {
  for (const action of script) {
    if (action.type === 'wait') {
      game.tick(action.ms)
    } else if (action.type === 'key') {
      game.pressKey(action.key)
    }
  }
}

// 使用
playScript(game, [
  { type: 'wait', ms: 2000 },
  { type: 'key', key: 'f' },
  { type: 'key', key: 'j' },
  { type: 'wait', ms: 1000 },
  { type: 'key', key: 'f' },
  { type: 'key', key: ' ' },   // 空格释放
  { type: 'key', key: 'j' },   // 切到另一路
])
```

#### 辅助工具：状态快照断言

```typescript
// 一次断言多个状态维度
function assertGameState(game: HeadlessGame, expected: Partial<{
  wave: number
  combo: number[]          // 各路连击数
  plantsAlive: boolean[][] // 各路各植物存活状态
  missedCount: number
  waveStatus: string
}>) {
  const state = game.getState()
  if (expected.wave !== undefined)
    expect(state.currentWave).toBe(expected.wave)
  if (expected.combo !== undefined)
    expected.combo.forEach((c, i) =>
      expect(game.getLane(i).comboCount).toBe(c))
  if (expected.missedCount !== undefined)
    expect(state.missedCount).toBe(expected.missedCount)
  // ...
}
```

### 第四层：浏览器验证（人工）

自动化测不了的东西：

- 动画是否流畅、打击是否有手感
- 音效节奏是否对
- 视觉风格是否符合"卡通蠢萌"
- 8 岁孩子能不能看懂界面

在阶段性里程碑（阶段一完成、阶段二完成等）做人工验证。日常开发以前三层自动化测试为主。

---

## 测试文件组织

```
src/
├── engine/
│   ├── GameLoop.ts
│   └── __tests__/
│       └── GameLoop.test.ts         # 引擎单元测试
├── game/
│   ├── ComboSystem.ts
│   ├── Settlement.ts
│   └── __tests__/
│       ├── ComboSystem.test.ts      # 系统单元测试
│       └── Settlement.test.ts       # 纯函数单元测试
├── config/
│   └── __tests__/
│       └── ConfigValidator.test.ts  # 配置校验测试
└── __tests__/
    ├── HeadlessGame.ts              # 无头游戏运行器
    ├── helpers.ts                   # playScript、assertGameState 等
    ├── integration/
    │   ├── singleLane.test.ts       # 单路完整流程
    │   ├── multiLane.test.ts        # 多路切换流程
    │   └── progression.test.ts      # 跨波次/跨关进度
    └── fixtures/
        └── testConfigs.ts           # 测试用简化配置
```

测试文件与源码就近放置（`__tests__/` 目录）。集成测试和测试工具放 `src/__tests__/`。

---

## 测试配置

```
// 测试用简化配置：少量僵尸、短链条，跑得快
testConfig = {
  plants: 2 棵植物，各 2 段连击（总长 4，几秒跑完一轮）
  waves: 1 波 3 只僵尸
  missedLimit: 2
}
```

测试配置和正式游戏配置分开。测试配置追求**跑得快、场景可控**，不追求好玩。

---

## 随机性控制

游戏中有随机的地方（出什么字母、僵尸出现时机的微小抖动等）：

- 所有随机通过统一的 `Random` 类生成
- `Random` 类支持传入种子（seed）
- 测试中使用固定种子 → 结果完全确定性

```typescript
class Random {
  constructor(seed?: number)  // 不传 seed 用 Math.random()，传了用确定性算法
  next(): number              // 0-1 之间
  pick<T>(arr: T[]): T        // 从数组随机选一个
  letter(pool: string[]): string  // 从字母池选
}
```

---

## 开发与测试的流程约定

### 按代码层选择测试时机

不同层的代码，测试和实现的先后顺序不同：

#### 引擎层（engine/）→ 实现优先，后补测试

引擎是基础设施，"对不对"更多靠跑起来看，不是算数字。

```
定义接口 → 写实现 → 跑通 → 补测试锁定行为 → 接入上层
```

补测试的目的是**防回退**——确保后续改动不会悄悄破坏引擎行为。

#### 游戏逻辑层（game/）→ 测试先行（TDD）

游戏规则在 GAME_DESIGN.md 里已经明确定义，每条规则就是一个测试用例。

```
从 GAME_DESIGN.md 提取一组规则
  ↓
翻译为测试（红，此时实现不存在）
  ↓
写最简实现通过测试（绿）
  ↓
审视有没有可以简化的地方（重构）
  ↓
下一组规则，重复
```

示例节奏：

```
规则："按错时，结算所有已激活的存活植物攻击力之和"
  → 写测试 it('按错时结算所有已激活的存活植物')
  → 写 calculateSettlement() 通过
  → 绿了

规则："阵亡植物的空转段不贡献攻击"
  → 写测试 it('阵亡植物不贡献攻击力')
  → 扩展 calculateSettlement() 通过
  → 绿了

规则："打满链条复活植物，但复活的不参与本次结算"
  → 写测试 it('复活的植物不参与本次结算攻击')
  → 再扩展，通过
  → 绿了
```

#### 无头集成测试 → 提前写场景，逐步变绿

在阶段二开始时，从游戏设计中提炼"典型游戏场景"写成测试。这些测试会随着功能推进逐步从红变绿：

```
"打完一波，植物残血保持到第二波"    → 波次机制做完后变绿
"空格切路，字母匹配到新路"          → 多路系统做完后变绿
"打满全链触发协同大招清屏"          → 协同系统做完后变绿
```

这些测试同时充当**功能完成度的检测器**——看还有几个红的，就知道还差多少。

### AI 改代码时的测试流程

```
改代码 → npm test → 全部通过 → 完成
                  → 有失败 → 先修测试失败，再继续
```

| 场景 | 流程 |
|------|------|
| 新增功能 | 先写测试（红）→ 写实现通过（绿）→ 重构 |
| 修 bug | 先写复现 bug 的测试（红）→ 修复（绿） |
| 重构 | 先跑现有测试确认全绿 → 改代码 → 再跑确认还是全绿 |

**硬性规则：不允许跳过失败的测试**（no `.skip`、no `xit`、no 注释掉测试）。
