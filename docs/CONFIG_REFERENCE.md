# 配置参考与数据模型

> 核心数据模型定义和策略配置示例。概述见 [GAME_DESIGN.md](./GAME_DESIGN.md)。

---

## 一、核心数据模型

### 游戏状态

```
GameState {
  currentStage: number          // 当前指法阶段
  currentLevel: number          // 当前关卡
  currentWave: number           // 当前波次
  difficulty: string            // 难度档位
  lanes: Lane[]                 // 各路状态
  missedCount: number           // 当前关累计放过数（波次间不归零）
  missedLimit: number           // 放过上限
  zombies: Zombie[]             // 场上所有僵尸
  waveStatus: string            // playing / waveComplete / levelComplete / failed
}
```

### 单路状态

```
Lane {
  id: number
  plants: PlantInstance[]       // 该路的植物链条（玩家自选，各路可不同）
  comboCount: number            // 当前连击数
  comboMax: number              // 连击上限（= 链条中所有植物段数之和）
  chainLetters: string[]        // 独立的字母序列
}
```

### 植物实例

```
PlantInstance {
  plantId: string               // 植物类型 ID
  position: number              // 链条中的位置
  comboStart: number            // 连击段起始（如第 5 下）
  comboEnd: number              // 连击段结束（如第 8 下）
  currentHp: number             // 当前血量
  maxHp: number                 // 血量上限
  alive: boolean                // 是否存活
}
```

### 持久化存储

```
SaveData {
  version: number               // 存档版本号（当前 1），用于未来数据迁移
  currentStageIndex: number     // 当前所在阶段索引
  currentLevelIndex: number     // 当前阶段内关卡索引（0-based）
  completedLevels: string[]     // 已通关关卡 ID 列表（"stageIndex-levelIndex" 格式）
  difficulty: string            // 当前难度 "easy" | "normal" | "hard"
  bestStars: Record<string, number>  // 每关最高星级（key 同 completedLevels 格式，value 1-3）
  unlockedPlants: string[]      // 已解锁植物 ID 列表（初始 ["peashooter"]）
  slotSize: number              // 当前 slot 长度（初始 4）
  keyboardVisible: boolean      // 虚拟键盘显示开关（初始 true）
}
```

> **后续扩展预留**（未实现）：`achievements`、`statistics` 等字段将在阶段六中加入。

---

## 二、策略配置示例

以下是策略配置的结构示例，展示如何通过配置驱动游戏内容而不修改核心代码。

### 植物配置

```json
{
  "plants": [
    {
      "id": "peashooter", "name": "豌豆射手",
      "comboSegment": 4, "attackPower": 10, "hp": 100,
      "element": "normal", "spread": "single", "flight": "straight", "impact": "vanish"
    },
    {
      "id": "snow_pea", "name": "寒冰射手",
      "comboSegment": 4, "attackPower": 8, "hp": 100,
      "element": "ice", "spread": "single", "flight": "straight", "impact": "vanish"
    },
    {
      "id": "repeater", "name": "双发射手",
      "comboSegment": 4, "attackPower": 18, "hp": 100,
      "element": "normal", "spread": "burst", "flight": "straight", "impact": "vanish"
    },
    {
      "id": "torchwood", "name": "火炬树桩",
      "comboSegment": 8, "attackPower": 25, "hp": 120,
      "element": "fire", "spread": "single", "flight": "straight", "impact": "vanish"
    },
    {
      "id": "cactus", "name": "仙人掌",
      "comboSegment": 4, "attackPower": 12, "hp": 100,
      "element": "normal", "spread": "single", "flight": "straight", "impact": "pierce"
    },
    {
      "id": "lightning_reed", "name": "闪电芦苇",
      "comboSegment": 4, "attackPower": 10, "hp": 80,
      "element": "electric", "spread": "single", "flight": "straight", "impact": "vanish"
    },
    {
      "id": "kernel_pult", "name": "玉米投手",
      "comboSegment": 8, "attackPower": 20, "hp": 120,
      "element": "stun", "spread": "single", "flight": "straight", "impact": "explode"
    },
    {
      "id": "fume_shroom", "name": "大喷菇",
      "comboSegment": 16, "attackPower": 30, "hp": 150,
      "element": "normal", "spread": "fan", "flight": "straight", "impact": "vanish"
    },
    {
      "id": "cattail", "name": "猫尾草",
      "comboSegment": 8, "attackPower": 15, "hp": 100,
      "element": "normal", "spread": "single", "flight": "tracking", "impact": "chain"
    },
    {
      "id": "hurricane_flower", "name": "飓风花",
      "comboSegment": 8, "attackPower": 15, "hp": 120,
      "element": "knockback", "spread": "single", "flight": "straight", "impact": "vanish"
    },
    {
      "id": "melon_pult", "name": "西瓜投手",
      "comboSegment": 12, "attackPower": 35, "hp": 150,
      "element": "normal", "spread": "single", "flight": "straight", "impact": "explode"
    },
    {
      "id": "starfruit", "name": "星星果",
      "comboSegment": 12, "attackPower": 20, "hp": 100,
      "element": "electric", "spread": "fan", "flight": "tracking", "impact": "vanish"
    }
  ]
}
```

### 协同加成配置

```json
{
  "synergyMultiplier": {
    "1": 1.0,
    "2": 1.2,
    "3": 1.5,
    "4": 1.8,
    "5": 2.2,
    "6": 3.0
  },
  "elementPriority": {
    "normal": 0, "ice": 1, "fire": 1, "electric": 2, "stun": 3, "knockback": 4,
    "_rule": "同优先级的 ice + fire 互相抵消，移除后取剩余最高"
  },
  "spreadPriority": { "single": 0, "burst": 1, "fan": 2 },
  "flightPriority": { "straight": 0, "tracking": 1 },
  "impactPriority": { "vanish": 0, "chain": 1, "pierce": 2, "explode": 3 },
  "effectParams": {
    "ice": { "slowRatio": 0.5, "slowDuration": 3 },
    "fire": { "burnDps": 5, "burnDuration": 3 },
    "electric": { "conductRadius": 100, "conductDamageDecay": 0.7, "conductMaxJumps": 3 },
    "stun": { "stunDuration": 1.5 },
    "knockback": { "knockbackDistance": 60 },
    "burst": { "burstCount": 3, "burstInterval": 80 },
    "fan": { "fanBulletCount": 5, "fanSpreadAngle": 1.047 },
    "tracking": { "trackingTurnRate": 1.047 },
    "chain": { "chainBounces": 3, "chainRange": 200 },
    "explode": { "explodeRadius": 80, "explodeDamageRatio": 0.6 }
  }
}
```

### 波次与关卡奖励配置示例

```json
{
  "stages": [
    {
      "id": 1,
      "name": "基准键练习",
      "letters": ["f", "j"],
      "laneCount": 1,
      "levels": [
        {
          "id": 1,
          "waves": [
            {
              "zombies": [
                { "type": "normal", "count": 10, "spawnInterval": 3000 }
              ]
            },
            {
              "zombies": [
                { "type": "normal", "count": 15, "spawnInterval": 2500 }
              ]
            }
          ]
        },
        {
          "id": 2,
          "waves": [
            {
              "zombies": [
                { "type": "normal", "count": 15, "spawnInterval": 2000 }
              ]
            }
          ],
          "rewards": {
            "unlockPlants": ["snow_pea"],
            "slotIncrease": 4
          }
        }
      ]
    }
  ],
  "difficulty": {
    "easy":   { "missedLimit": 5, "zombieSpeedMultiplier": 0.8, "segmentMultiplier": 0.75, "displayName": "简单" },
    "normal": { "missedLimit": 3, "zombieSpeedMultiplier": 1.0, "segmentMultiplier": 1.0,  "displayName": "普通" },
    "hard":   { "missedLimit": 1, "zombieSpeedMultiplier": 1.2, "segmentMultiplier": 1.5,  "displayName": "困难",
      "plantSegmentOverrides": { "cattail": 1.2 }
    }
  }
}
```
