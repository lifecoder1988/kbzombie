# 键盘侠大战僵尸 - AI 协作规范

## 项目概况

- 面向 8-9 岁儿童的打字练习游戏，植物大战僵尸主题
- 技术栈：React + Canvas，桌面端浏览器
- 详细设计见 `docs/GAME_DESIGN.md`（索引）及其子文档，开发路线见 `docs/ROADMAP.md`

## 目录结构约定

```
kbzombie/
├── CLAUDE.md              # 本文件，AI 协作规范
├── docs/                  # 设计文档、路线图
├── src/
│   ├── engine/            # 游戏引擎层（Game Loop、场景、实体、渲染、输入、音效、碰撞检测）
│   ├── game/              # 游戏逻辑层（战斗、连击、植物、僵尸、结算）
│   ├── config/            # 策略配置（植物、僵尸、关卡、波次、难度、战斗参数、校验）
│   ├── scenes/            # 各场景实现（主菜单、战斗、结算等）+ renderers/ + vfx/
│   ├── ui/                # React UI 组件（非 Canvas 部分）
│   └── assets/            # 图片、音效资源
├── public/
└── package.json
```

## 架构原则

### 三层分离

```
策略配置层（config/）    → 数据驱动，改 JSON 不改代码
游戏逻辑层（game/）      → 具体玩法，依赖引擎接口
游戏引擎层（engine/）    → 通用能力，不感知具体玩法
```

- **引擎层不导入游戏层或配置层**。引擎不知道什么是僵尸、植物、连击。
- **游戏层不直接操作 Canvas 或 DOM**。通过引擎提供的渲染接口绘制。
- **配置层是纯数据**。不包含逻辑代码，只有 TS 常量和类型定义（唯一例外：`validation.ts` 做语义校验）。
- **游戏逻辑层不直接导入配置层**。场景层（scenes/）负责从 config 读取并以参数注入游戏逻辑层。
- **配置字段名对齐设计文档**（`docs/PLANTS_AND_EFFECTS.md`、`docs/ZOMBIES_AND_STAGES.md`）。如 `comboSegment`（非 `segments`）。
- 新增植物、僵尸、协同规则只加配置，不改引擎和游戏逻辑代码。

### 引擎层设计原则

- Game Loop 中 update(dt) 和 render(ctx) 严格分离：update 不碰 Canvas，render 不改状态
- 实体通过统一接口管理生命周期，不用各处手动 new/delete
- 输入系统只做事件转译，不包含业务判断
- 场景之间完全隔离，通过 Scene Manager 切换

## 编码规范

### 语言与风格

- TypeScript strict 模式
- 有意义的命名优先于注释，只在"为什么"不明显时加注释
- 不写无用的 JSDoc——接口名和参数名本身就应该自解释

### 游戏开发特有规范

- **不在 update() 里创建对象**。每帧跑 60 次，临时对象会产生 GC 抖动。预分配或对象池复用。
- **不在 render() 里做计算**。render 只读取状态并绘制，所有计算在 update 里完成。
- **用 dt 驱动一切运动**。位移 = 速度 × dt，不写"每帧移动 N 像素"。
- **dt 时间单位约定**。GameLoop 传出的 dt 是**毫秒**（`performance.now()` 差值）。各层约定如下：
  - **引擎层 / 游戏逻辑层**：接收毫秒 dt。实体内部需要秒的地方自行 `dt / 1000` 转换（如 ZombieEntity、ProjectileEntity）。速度单位是 px/s，计时器单位是 ms。
  - **VFX 层**：BattleScene 调用 `vfxManager.update(dt / 1000)` 统一转秒。VFX 对象内部全部使用**秒**（DURATION、速度等）。VfxManager 内部对 dt clamp 到 0.1s 防止标签页切换导致的突刺。
  - **场景层**：fadeAlpha 等动画直接用毫秒 dt 计算（如 `dt / 300` 表示 300ms 淡入）。SettlementScene 和 MenuScene 的复杂动画自行 `dt / 1000` 转秒。
  - **新增代码时**：明确当前 dt 是毫秒还是秒，不要混用。优先在接收处转换一次，后续统一用一种单位。
- **状态变更可追溯**。关键状态变更（植物阵亡、连击结算、波次切换）通过事件系统通知，不在各处直接修改。
- **数值不硬编码**。血量、速度、段数等走 `src/config/` 配置。代码中只有机制逻辑，没有具体数字。布局比例（植物区域占比、间距等）留在代码中，未来由 slot 机制动态计算。

### 文件组织

- 一个模块一个文件，文件名与导出的主类/函数同名
- 引擎层模块之间可以互相导入，但保持单向依赖，不出现循环引用
- 类型定义集中在各层的 `types.ts` 中

## 开发流程约定

### 分阶段推进

严格按 `docs/ROADMAP.md` 的阶段顺序开发。每个阶段有明确的完成标准，达标后再进入下一阶段。不跨阶段实现功能。

### 测试策略

详细设计见 `docs/TESTING_STRATEGY.md`。测试框架：Vitest。

**按代码层选择测试时机：**

- **引擎层**：先写实现跑通，后补测试锁定行为
- **游戏逻辑层**：测试先行——从 GAME_DESIGN.md 提取规则 → 写测试（红）→ 写实现通过（绿）→ 重构
- **集成场景**：提前写无头测试描述典型游戏场景，随功能推进逐步从红变绿

**硬性规则**：AI 改代码后必须跑 `npm test`，测试不过不算完成。不允许 `.skip` 跳过失败测试。

### 性能意识

- Canvas 同屏实体目标：流畅支撑 50+ 个精灵
- 避免每帧 new 对象、避免频繁字符串拼接
- 资源预加载，不在游戏中动态加载

## AI 协作注意事项

### 改代码前

- 先读现有代码，理解已有设计再改
- 确认改动属于当前阶段的范围，不超前实现后续阶段的功能
- 改引擎层时特别谨慎——引擎是地基，改动影响所有上层

### 改代码时

- 改配置加功能，不改引擎加功能
- 新增植物/僵尸/关卡/波次 → 改 `src/config/` 下对应文件，不改 game/ 或 engine/
- 新增植物只需声明四维标签（element/spread/flight/impact），自动参与特效合成，不改 EffectSynthesis 代码
- 新增僵尸只需在 `zombies.ts` 加配置（id/name/hp/speed/chewDps/width/height/color），不改 ZombieEntity 代码
- 波次配置支持 `zombieType`（单类型）或 `zombies` 权重数组（混合出怪），二选一
- 效果参数（减速比例、灼烧DPS、爆炸半径等）走 `effectParams` 配置，不硬编码在 game/ 中
- 难度参数（放过上限、速度倍率、段数倍率）走 `difficulty.ts` 配置，`segmentMultiplier` 全局倍率 + `plantSegmentOverrides` 单植物覆盖
- 结算称号规则走 `settlement.ts` 声明式配置（`TitleRule`），判定逻辑在游戏层 `TitleMatcher`
- 关卡奖励走 `LevelDef.rewards` 配置（`unlockPlants` + `slotIncrease`），SaveDataService 首次通关时发放
- Slot 验证用 base `comboSegment`，不受难度 `segmentMultiplier` 影响
- 植物选择在 PlantSelectScene 完成，App.tsx 通过 `goToPlantSelect` 统一路由，BattleScene 接收 `selectedPlants`
- 虚拟键盘是 `scenes/VirtualKeyboard.ts` 独立渲染模块，BattleScene 在底部 18% 区域调用
- 场景间通过 SceneManager 切换，场景不直接持有 SaveDataService，由 App.tsx 注入数据和回调
- 游戏逻辑使用固定 1280×720 逻辑尺寸，BattleScene 用 `ctx.scale()` 适配窗口，窗口大小不影响难度
- 植物布局宽度 = `20 + segments × 12`，左对齐紧密排列，视觉与碰撞一致
- 实体渲染委托给 `scenes/renderers/` 下的纯函数（PlantRenderer、ZombieRenderer、ProjectileRenderer、BattlefieldRenderer）
- 新增植物视觉：在 `PlantRenderer.ts` 中添加对应 plantId 的绘制分支，同时在 `PLANT_THEME` 中添加专属颜色
- VFX 效果走 `scenes/VfxManager.ts`（对象池复用），效果类在 `scenes/vfx/` 下，实体内仅保留极简 timer（bounceTimer、flashTimer、walkPhase）
- BattleManager 通过 `GameEvent` 队列通知视觉层，BattleScene 每帧 `consumeEvents()` 消费并生成 VFX
- 音效走 `scenes/SoundSynthesizer.ts`（Web Audio API 程序化合成），BattleScene 在 processGameEvent 各分支调用 `this.sound.play()`
- 新增 VFX 效果：在 `scenes/vfx/` 下创建实现 `VfxObject` 接口的类，BattleScene 中 acquire → init → spawn
- 场景淡入：各场景 enter() 设 fadeAlpha=1，update 中递减，render 末尾画黑色遮罩
- 不引入引擎层不需要的游戏概念（引擎不应出现 zombie、plant 等词）
- 不提前抽象——需要复用时再抽，不预测未来需求
- 不加 TODO 注释标记未来工作——未来工作在 ROADMAP 里跟踪

### 改代码后

- 跑测试确认没破坏现有功能
- 如果改了接口，检查所有调用方
- 启动 dev server 在浏览器中实际看效果
