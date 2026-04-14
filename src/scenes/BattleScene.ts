import type { Scene, InputEvent } from '../engine/types'
import type { PlantConfig, WaveConfig, ZombieConfig } from '../game/types'
import { BattleStatus } from '../game/types'
import { BattleManager } from '../game/BattleManager'
import { PlantEntity } from '../game/PlantEntity'

// ---- 阶段二硬编码常量（阶段三抽配置） ----
const PLANTS: PlantConfig[] = [
  { id: 'peashooter', name: '豌豆射手', segments: 4, attackPower: 20, hp: 100 },
  { id: 'snow_pea',   name: '寒冰射手', segments: 4, attackPower: 15, hp: 80 },
  { id: 'repeater',   name: '双发射手', segments: 8, attackPower: 35, hp: 120 },
]
const ZOMBIE_CONFIG: ZombieConfig = { hp: 50, speed: 30, chewDps: 10 }
const WAVES: WaveConfig[] = [
  { count: 5, interval: 3000 },
  { count: 7, interval: 2500 },
  { count: 10, interval: 2000 },
]
const MISSED_LIMIT = 3
const LETTER_POOL = ['f', 'j', 'd', 'k', 's', 'l', 'a']
const PROJECTILE_SPEED = 500
const HEAL_AMOUNT = 30

export class BattleScene implements Scene {
  readonly name = 'battle'
  private switchTo: (name: string) => void

  private manager: BattleManager | null = null
  private plantEntities: PlantEntity[] = []
  private paused = false
  private canvasWidth = 0
  private canvasHeight = 0

  constructor(switchTo: (name: string) => void) {
    this.switchTo = switchTo
  }

  enter(): void {
    this.canvasWidth = typeof window !== 'undefined' ? window.innerWidth : 800
    this.canvasHeight = typeof window !== 'undefined' ? window.innerHeight : 600
    this.paused = false

    this.manager = new BattleManager({
      plants: PLANTS,
      waves: WAVES,
      zombieConfig: ZOMBIE_CONFIG,
      letterPool: LETTER_POOL,
      missedLimit: MISSED_LIMIT,
      projectileSpeed: PROJECTILE_SPEED,
      healAmount: HEAL_AMOUNT,
      canvasWidth: this.canvasWidth,
      canvasHeight: this.canvasHeight,
    })

    // 植物宽度按段数比例分配，占据画面左 35%
    const plantAreaWidth = this.canvasWidth * 0.35
    const laneY = Math.round(this.canvasHeight * 0.4)
    const totalSegments = PLANTS.reduce((s, p) => s + p.segments, 0)
    const gap = 8 // 植物间距
    const totalGap = gap * (PLANTS.length - 1)
    const usableWidth = plantAreaWidth - totalGap
    const startX = 20

    this.plantEntities = []
    let curX = startX
    for (let i = 0; i < PLANTS.length; i++) {
      const w = Math.round((PLANTS[i].segments / totalSegments) * usableWidth)
      const entity = new PlantEntity(`plant_${i}`, curX, laneY - 30, w, i)
      this.plantEntities.push(entity)
      curX += w + gap
    }
  }

  exit(): void {
    this.manager = null
    this.plantEntities = []
  }

  update(dt: number): void {
    this.canvasWidth = typeof window !== 'undefined' ? window.innerWidth : 800
    this.canvasHeight = typeof window !== 'undefined' ? window.innerHeight : 600

    if (!this.manager || this.paused) return

    this.manager.update(dt)

    // Sync plant entity states
    const plantStates = this.manager.getPlantStates()
    const comboCount = this.manager.comboCount

    const chainLetters = this.manager.getChainLetters()

    // 按植物切割链条字母，并计算各植物的已打段数
    let segOffset = 0
    for (let i = 0; i < this.plantEntities.length; i++) {
      const entity = this.plantEntities[i]
      const segments = PLANTS[i].segments

      if (i < plantStates.length) {
        entity.syncState(plantStates[i])
      }

      // 该植物对应的字母片段
      entity.letters = chainLetters.slice(segOffset, segOffset + segments) as string[]

      // 该植物中已打过的段数
      const typedInPlant = Math.max(0, Math.min(segments, comboCount - segOffset))
      entity.typedCount = typedInPlant

      // 当前连击目标是否在这棵植物上
      entity.isCurrentTarget = comboCount >= segOffset && comboCount < segOffset + segments

      segOffset += segments
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const w = this.canvasWidth
    const h = this.canvasHeight

    // Background: green grass
    ctx.fillStyle = '#2d5a1e'
    ctx.fillRect(0, 0, w, h)

    // Lane line
    const laneY = Math.round(h * 0.4)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, laneY + 60)
    ctx.lineTo(w, laneY + 60)
    ctx.stroke()

    // Render plant entities
    for (let i = 0; i < this.plantEntities.length; i++) {
      this.plantEntities[i].render(ctx)
    }

    // Render manager entity manager (zombies + projectiles)
    if (this.manager) {
      this.manager.getEntityManager().render(ctx)
    }

    // HUD
    if (this.manager) {
      const status = this.manager.status
      const wave = this.manager.currentWave
      const combo = this.manager.comboCount
      const missed = this.manager.missedCount
      const letter = this.manager.currentLetter

      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
      ctx.fillRect(0, 0, w, 40)

      ctx.fillStyle = '#ffffff'
      ctx.font = '16px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(`波次: ${wave + 1}/${WAVES.length}`, 10, 25)
      ctx.fillText(`连击: ${combo}`, 150, 25)
      ctx.fillText(`漏过: ${missed}/${MISSED_LIMIT}`, 280, 25)

      if (status === BattleStatus.Fighting) {
        ctx.textAlign = 'right'
        ctx.fillStyle = '#ffd700'
        ctx.font = 'bold 20px monospace'
        ctx.fillText(`按: ${letter.toUpperCase()}`, w - 10, 25)
      }

      if (status === BattleStatus.WavePause) {
        ctx.textAlign = 'center'
        ctx.fillStyle = '#ffd700'
        ctx.font = 'bold 24px sans-serif'
        ctx.fillText(`波次 ${wave} 完成！准备下一波...`, w / 2, h / 2)
      }
    }

    // Pause overlay
    if (this.paused) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 36px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('已暂停 - 按 P 继续', w / 2, h / 2)
    }

    // Victory / Defeat overlays
    if (this.manager) {
      const status = this.manager.status

      if (status === BattleStatus.Victory) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
        ctx.fillRect(0, 0, w, h)
        ctx.fillStyle = '#ffd700'
        ctx.font = 'bold 56px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('胜利！', w / 2, h / 2 - 20)
        ctx.fillStyle = '#ffffff'
        ctx.font = '24px sans-serif'
        ctx.fillText('按空格返回菜单', w / 2, h / 2 + 40)
      }

      if (status === BattleStatus.Defeat) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'
        ctx.fillRect(0, 0, w, h)
        ctx.fillStyle = '#e94560'
        ctx.font = 'bold 56px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('失败！', w / 2, h / 2 - 20)
        ctx.fillStyle = '#ffffff'
        ctx.font = '24px sans-serif'
        ctx.fillText('按空格重新开始', w / 2, h / 2 + 40)
      }
    }
  }

  handleInput(event: InputEvent): void {
    if (event.type !== 'keydown') return

    if (event.key === 'Escape') {
      this.switchTo('menu')
      return
    }

    if (event.key === 'p' || event.key === 'P') {
      this.paused = !this.paused
      return
    }

    if (!this.manager) return

    const status = this.manager.status

    if (status === BattleStatus.Victory && event.key === ' ') {
      this.switchTo('menu')
      return
    }

    if (status === BattleStatus.Defeat && event.key === ' ') {
      this.enter()
      return
    }

    if (!this.paused) {
      this.manager.onKeyDown(event.key)
    }
  }
}
