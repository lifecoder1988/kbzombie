import type { Scene, InputEvent } from '../engine/types'
import type { PlantConfig } from '../game/types'
import { BattleStatus } from '../game/types'
import { BattleManager } from '../game/BattleManager'
import { PlantEntity } from '../game/PlantEntity'
import { PLANT_DEFS, ZOMBIE_DEFS, STAGES, DIFFICULTIES, DEFAULT_DIFFICULTY, BATTLE_PARAMS, SYNERGY_PARAMS, SETTLEMENT_CONFIG } from '../config'
import type { BattleStatsData } from '../game/BattleStats'
import { matchTitle } from '../game/TitleMatcher'
import { validateConfig } from '../config/validation'

export class BattleScene implements Scene {
  readonly name = 'battle'
  private switchTo: (name: string) => void

  private manager: BattleManager | null = null
  private laneEntities: PlantEntity[][] = []
  private paused = false
  private canvasWidth = 0
  private canvasHeight = 0
  private stageIndex = 0
  private levelIndex = 0
  private battleEnded = false
  private onBattleEnd: ((params: {
    result: 'victory' | 'defeat'
    stats: BattleStatsData
    stars: number
    title: string
    stageIndex: number
    levelIndex: number
  }) => void) | null = null

  setBattleEndHandler(fn: typeof this.onBattleEnd): void {
    this.onBattleEnd = fn
  }

  constructor(switchTo: (name: string) => void) {
    this.switchTo = switchTo
    const errors = validateConfig(PLANT_DEFS, ZOMBIE_DEFS, STAGES, SYNERGY_PARAMS, BATTLE_PARAMS)
    if (errors.length > 0) {
      console.error('配置校验失败:')
      for (const e of errors) console.error('  -', e)
    }
  }

  setLevel(stageIndex: number, levelIndex: number): void {
    this.stageIndex = stageIndex
    this.levelIndex = levelIndex
  }

  enter(): void {
    this.canvasWidth = typeof window !== 'undefined' ? window.innerWidth : 800
    this.canvasHeight = typeof window !== 'undefined' ? window.innerHeight : 600
    this.paused = false
    this.battleEnded = false

    const stage = STAGES[this.stageIndex]
    const level = stage.levels[this.levelIndex]
    const difficulty = DIFFICULTIES[DEFAULT_DIFFICULTY]
    const laneCount = level.laneCount ?? 1

    // Helper: resolve plant IDs → PlantConfig[]
    const resolvePlants = (ids: readonly string[]): PlantConfig[] =>
      ids.map(id => {
        const def = PLANT_DEFS.find(p => p.id === id)!
        return {
          id: def.id,
          name: def.name,
          comboSegment: def.comboSegment,
          attackPower: def.attackPower,
          hp: def.hp,
          element: def.element,
          spread: def.spread,
          flight: def.flight,
          impact: def.impact,
        }
      })

    // Build per-lane PlantConfig arrays
    const lanePlants: PlantConfig[][] = []
    for (let i = 0; i < laneCount; i++) {
      const ids = level.lanePlants?.[i] ?? stage.plants
      lanePlants.push(resolvePlants(ids))
    }

    // ZombieDef → ZombieConfig (apply difficulty speed multiplier)
    const zombieConfigs: Record<string, { hp: number; speed: number; chewDps: number; width: number; height: number; color: string }> = {}
    for (const [id, def] of Object.entries(ZOMBIE_DEFS)) {
      zombieConfigs[id] = {
        hp: def.hp,
        speed: def.speed * difficulty.zombieSpeedMultiplier,
        chewDps: def.chewDps,
        width: def.width,
        height: def.height,
        color: def.color,
      }
    }

    this.manager = new BattleManager({
      laneCount,
      lanePlants,
      waves: level.waves,
      zombieConfigs,
      letterPool: stage.letters,
      missedLimit: difficulty.missedLimit,
      projectileSpeed: BATTLE_PARAMS.projectileSpeed,
      healAmount: BATTLE_PARAMS.healAmount,
      wavePauseDuration: BATTLE_PARAMS.wavePauseDuration,
      canvasWidth: this.canvasWidth,
      canvasHeight: this.canvasHeight,
      synergyMultiplier: SYNERGY_PARAMS.multiplier,
      effectParams: BATTLE_PARAMS.effectParams,
    })

    // Build plant entities per lane using manager's lane layout
    this.laneEntities = []
    for (let i = 0; i < laneCount; i++) {
      const lane = this.manager.getLane(i)
      const entities: PlantEntity[] = []
      for (let j = 0; j < lane.plants.length; j++) {
        const entity = new PlantEntity(
          `plant_${i}_${j}`,
          lane.plantPositions[j],
          lane.laneY - 30,
          lane.plantWidths[j],
          j,
        )
        entities.push(entity)
      }
      this.laneEntities.push(entities)
    }
  }

  exit(): void {
    this.manager = null
    this.laneEntities = []
  }

  update(dt: number): void {
    this.canvasWidth = typeof window !== 'undefined' ? window.innerWidth : 800
    this.canvasHeight = typeof window !== 'undefined' ? window.innerHeight : 600

    if (!this.manager || this.paused) return

    this.manager.update(dt)

    if (!this.battleEnded && (this.manager.status === BattleStatus.Victory || this.manager.status === BattleStatus.Defeat)) {
      this.battleEnded = true
      if (this.onBattleEnd) {
        const stats = this.manager.getStats()
        const result = this.manager.status === BattleStatus.Victory ? 'victory' as const : 'defeat' as const
        const stars = result === 'victory' ? this.calculateStars(stats) : 0
        const title = result === 'victory'
          ? matchTitle(stats, SETTLEMENT_CONFIG.titleRules, SETTLEMENT_CONFIG.defaultVictoryTitle)
          : SETTLEMENT_CONFIG.encouragements[Math.floor(Math.random() * SETTLEMENT_CONFIG.encouragements.length)]
        this.onBattleEnd({ result, stats, stars, title, stageIndex: this.stageIndex, levelIndex: this.levelIndex })
      }
    }

    for (let li = 0; li < this.manager.laneCount; li++) {
      const lane = this.manager.getLane(li)
      const plantStates = lane.getPlantStates()
      const comboCount = lane.comboCount
      const chainLetters = lane.chainLetters
      const isCurrentLane = this.manager.currentLane === li

      let segOffset = 0
      const entities = this.laneEntities[li]
      for (let i = 0; i < entities.length; i++) {
        if (i >= plantStates.length) break
        const segments = plantStates[i].config.comboSegment
        entities[i].syncState(plantStates[i])
        entities[i].letters = chainLetters.slice(segOffset, segOffset + segments) as string[]
        entities[i].typedCount = Math.max(0, Math.min(segments, comboCount - segOffset))
        entities[i].isCurrentTarget = isCurrentLane && comboCount >= segOffset && comboCount < segOffset + segments
        segOffset += segments
      }
    }
  }

  private calculateStars(stats: BattleStatsData): number {
    if (stats.missedCount === 0) return 3
    if (stats.missedCount <= Math.floor(this.manager!.missedLimit / 2)) return 2
    return 1
  }

  render(ctx: CanvasRenderingContext2D): void {
    const w = this.canvasWidth
    const h = this.canvasHeight

    // Background: green grass
    ctx.fillStyle = '#2d5a1e'
    ctx.fillRect(0, 0, w, h)

    // Lane lines (highlight current lane)
    if (this.manager) {
      for (let li = 0; li < this.manager.laneCount; li++) {
        const lane = this.manager.getLane(li)
        const isCurrentLane = this.manager.currentLane === li
        ctx.strokeStyle = isCurrentLane ? 'rgba(255, 215, 0, 0.4)' : 'rgba(255, 255, 255, 0.15)'
        ctx.lineWidth = isCurrentLane ? 2 : 1
        ctx.beginPath()
        ctx.moveTo(0, lane.laneY + 60)
        ctx.lineTo(w, lane.laneY + 60)
        ctx.stroke()
      }
    }

    // Render plant entities from all lanes
    for (const laneEnts of this.laneEntities) {
      for (const entity of laneEnts) {
        entity.render(ctx)
      }
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
        if (letter) {
          // Locked to a lane — show current expected key
          ctx.fillText(`按: ${letter.toUpperCase()}`, w - 10, 25)
        } else {
          // Free match — show each lane's first key
          const laneLetters: string[] = []
          for (let li = 0; li < this.manager.laneCount; li++) {
            const l = this.manager.getLane(li)
            if (!l.isEmpty) laneLetters.push(l.currentLetter.toUpperCase())
          }
          if (laneLetters.length > 0) ctx.fillText(`按: ${laneLetters.join(' / ')}`, w - 10, 25)
        }
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

    // Victory / Defeat overlays (SettlementScene handles the actual UI)
    if (this.manager) {
      const status = this.manager.status

      if (status === BattleStatus.Victory || status === BattleStatus.Defeat) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
        ctx.fillRect(0, 0, w, h)
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

    if (status === BattleStatus.Victory || status === BattleStatus.Defeat) {
      return
    }

    if (!this.paused) {
      this.manager.onKeyDown(event.key)
    }
  }
}
