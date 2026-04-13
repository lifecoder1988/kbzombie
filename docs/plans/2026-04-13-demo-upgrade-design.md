# Demo 升级设计：展示引擎全部特性

> **背景**：阶段一 Demo 未使用大部分引擎模块（EntityManager、RenderLayer、getByTag、碰撞检测），需要升级为使用引擎正确姿势的代码参考，供阶段二实现时参照。

---

## 目标

重写 `src/demo/DemoScene.ts` 中的 BattleScene，用引擎标准 API 实现"色块从右走、打字发射子弹、碰撞击杀"的演示。MenuScene 和 App.tsx 不变。

## 需演示的引擎特性

| 引擎模块 | 如何演示 |
|----------|----------|
| Entity 接口 | BlockEntity 和 BulletEntity 两个具体实现 |
| EntityManager | 所有实体通过 add/remove 管理，update/render 委托给 EntityManager |
| RenderLayer | 色块在 Entity 层，子弹在 Effect 层（子弹视觉上叠在色块上面） |
| getByTag | 碰撞检测前按 tag 分组查询 `'block'` 和 `'bullet'` |
| intersects | 每帧子弹 vs 色块 AABB 碰撞判定 |
| SceneManager | 保持现有：菜单 ↔ 战斗切换 |
| InputManager | 保持现有：字母键/空格/ESC/P 事件 |

不演示 AudioManager 和 AssetLoader（没有真实资源，Demo 用色块）。

## 游戏流程

```
色块从右侧生成，向左匀速移动（tagged 'block'，Entity 层）
        ↓
打对字母 → 从左侧固定位置发射子弹，向右飞行（tagged 'bullet'，Effect 层）
        ↓
每帧碰撞循环：getByTag('bullet') × getByTag('block')
  → intersects 空间判定 + 字母匹配
        ↓
命中 → remove 双方（子弹消失 + 色块消失）
色块出左边界 → active=false + console.log('missed')
子弹出右边界 → active=false
```

## 文件结构

只改 `src/demo/DemoScene.ts`，不动 App.tsx 或引擎层。

```
DemoScene.ts
├── BlockEntity class (implements Entity)
│   - id: 唯一 ID
│   - tags: Set(['block'])
│   - layer: RenderLayer.Entity
│   - letter: string, speed: number
│   - update(dt): x -= speed * dt/1000，出左边界 → active=false
│   - render(ctx): 画红色矩形 + 白色字母
│
├── BulletEntity class (implements Entity)
│   - id: 唯一 ID
│   - tags: Set(['bullet'])
│   - layer: RenderLayer.Effect
│   - targetLetter: string, speed: number
│   - update(dt): x += speed * dt/1000，出右边界 → active=false
│   - render(ctx): 画黄色小方块
│
├── MenuScene (不变)
│
└── BattleScene
    - 持有 EntityManager 实例
    - enter(): 重置 EntityManager
    - exit(): 清空 EntityManager
    - update(dt):
        1. 生成计时器 → 到时创建 BlockEntity，entityManager.add()
        2. entityManager.update(dt)
        3. 碰撞检测循环（见下方）
    - render(ctx):
        1. 画背景
        2. entityManager.render(ctx)  ← 按 RenderLayer 排序绘制
        3. 画 HUD 文字
    - handleInput(event):
        - ESC → switchTo('menu')
        - P → 暂停切换
        - 字母键 → 找最左匹配色块 → 发射 BulletEntity
```

## 碰撞检测循环（阶段二标准模式参考）

```ts
const bullets = this.entityManager.getByTag('bullet')
const blocks = this.entityManager.getByTag('block')
for (let i = 0; i < bullets.length; i++) {
  const bullet = bullets[i] as BulletEntity
  if (!bullet.active) continue
  for (let j = 0; j < blocks.length; j++) {
    const block = blocks[j] as BlockEntity
    if (!block.active) continue
    if (bullet.targetLetter === block.letter && intersects(bullet, block)) {
      this.entityManager.remove(bullet)
      this.entityManager.remove(block)
      break
    }
  }
}
```

## 子弹发射逻辑

```ts
handleInput(event):
  // 在所有 block 中找最左边的匹配字母
  const blocks = this.entityManager.getByTag('block')
  let target: BlockEntity | null = null
  for (const b of blocks) {
    const block = b as BlockEntity
    if (block.letter === key) {
      if (!target || block.x < target.x) target = block
    }
  }
  if (target) {
    // 从左侧固定位置发射，y 对准目标色块
    const bullet = new BulletEntity(nextId(), key, target.y, bulletSpeed)
    this.entityManager.add(bullet)
  }
```

## 数值参数

所有数值硬编码在 DemoScene.ts 内（Demo 代码不进后续迭代）：

| 参数 | 值 | 说明 |
|------|-----|------|
| 色块尺寸 | 50×60 | 同现有 Demo |
| 色块速度 | 80-120 px/s | 同现有 Demo |
| 色块生成间隔 | 2000ms | 同现有 Demo |
| 子弹尺寸 | 12×8 | 小矩形，视觉上明显是子弹 |
| 子弹速度 | 400 px/s | 快于色块，确保能追上 |
| 子弹发射 x | 60 | 左侧固定位置 |
| 字母池 | 'fjdksla' | 同现有 Demo |

## 不改动的部分

- MenuScene：保持现有（按空格进入战斗）
- App.tsx：不改，现有接线够用
- 引擎层：零改动
