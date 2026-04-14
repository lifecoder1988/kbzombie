import type { Scene, InputEvent } from '../engine/types'
import type { PlantConfig } from '../game/types'
import { BattleStatus } from '../game/types'
import { BattleManager } from '../game/BattleManager'
import { PlantEntity } from '../game/PlantEntity'
import { PLANT_DEFS, ZOMBIE_DEFS, STAGES, DIFFICULTIES, DEFAULT_DIFFICULTY, BATTLE_PARAMS } from '../config'
import { validateConfig } from '../config/validation'

export class BattleScene implements Scene {
  readonly name = 'battle'
  private switchTo: (name: string) => void

  private manager: BattleManager | null = null
  private plantEntities: PlantEntity[] = []
  private paused = false
  private canvasWidth = 0
  private canvasHeight = 0
  private stageIndex = 0
  private levelIndex = 0

  constructor(switchTo: (name: string) => void) {
    this.switchTo = switchTo
    const errors = validateConfig(PLANT_DEFS, ZOMBIE_DEFS, STAGES)
    if (errors.length > 0) {
      console.error('配置校验失败:')
      for (const e of errors) console.error('  -', e)
    }
  }

  enter(): void {
    this.canvasWidth = typeof window !== 'undefined' ? window.innerWidth : 800
    this.canvasHeight = typeof window !== 'undefined' ? window.innerHeight : 600
    this.paused = false

    const stage = STAGES[this.stageIndex]
    const level = stage.levels[this.levelIndex]
    const difficulty = DIFFICULTIES[DEFAULT_DIFFICULTY]

    // PlantDef → PlantConfig
    const plants: PlantConfig[] = stage.plants.map(id => {
      const def = PLANT_DEFS.find(p => p.id === id)!
      return {
        id: def.id,
        name: def.name,
        comboSegment: def.comboSegment,
        attackPower: def.attackPower,
        hp: def.hp,
      }
    })

    // ZombieDef → ZombieConfig (apply difficulty speed multiplier)
    const zombieConfigs: Record<string, { hp: number; speed: number; chewDps: number }> = {}
    for (const [id, def] of Object.entries(ZOMBIE_DEFS)) {
      zombieConfigs[id] = {
        hp: def.hp,
        speed: def.speed * difficulty.zombieSpeedMultiplier,
        chewDps: def.chewDps,
      }
    }

    this.manager = new BattleManager({
      plants,
      waves: level.waves,
      zombieConfigs,
      letterPool: stage.letters,
      missedLimit: difficulty.missedLimit,
      projectileSpeed: BATTLE_PARAMS.projectileSpeed,
      healAmount: BATTLE_PARAMS.healAmount,
      wavePauseDuration: BATTLE_PARAMS.wavePauseDuration,
      canvasWidth: this.canvasWidth,
      canvasHeight: this.canvasHeight,
    })

    // Plant entity layout (layout ratios stay in code, not config)
    const plantAreaWidth = this.canvasWidth * 0.35
    const laneY = Math.round(this.canvasHeight * 0.4)
    const totalSegments = plants.reduce((s, p) => s + p.comboSegment, 0)
    const gap = 8
    const totalGap = gap * (plants.length - 1)
    const usableWidth = plantAreaWidth - totalGap
    const startX = 20

    this.plantEntities = []
    let curX = startX
    for (let i = 0; i < plants.length; i++) {
      const w = Math.round((plants[i].comboSegment / totalSegments) * usableWidth)
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

    const plantStates = this.manager.getPlantStates()
    const comboCount = this.manager.comboCount
    const chainLetters = this.manager.getChainLetters()

    let segOffset = 0
    for (let i = 0; i < this.plantEntities.length; i++) {
      const entity = this.plantEntities[i]
      if (i >= plantStates.length) break

      const segments = plantStates[i].config.comboSegment
      entity.syncState(plantStates[i])
      entity.letters = chainLetters.slice(segOffset, segOffset + segments) as string[]
      entity.typedCount = Math.max(0, Math.min(segments, comboCount - segOffset))
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
      ctx.fillText(`第${this.stageIndex + 1}阶段 关卡${this.levelIndex + 1}`, 10, 25)
      ctx.fillText(`波次: ${wave + 1}/${this.manager.totalWaves}`, 180, 25)
      ctx.fillText(`连击: ${combo}`, 310, 25)
      ctx.fillText(`漏过: ${missed}/${this.manager.missedLimit}`, 430, 25)

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
