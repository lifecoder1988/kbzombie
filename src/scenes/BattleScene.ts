import type { Scene, InputEvent } from '../engine/types'
import type { PlantConfig } from '../game/types'
import { BattleStatus } from '../game/types'
import type { GameEvent } from '../game/types'
import { BattleManager } from '../game/BattleManager'
import { PlantEntity } from '../game/PlantEntity'
import { ZombieEntity } from '../game/ZombieEntity'
import { PLANT_DEFS, ZOMBIE_DEFS, STAGES, DIFFICULTIES, DEFAULT_DIFFICULTY, BATTLE_PARAMS, SYNERGY_PARAMS, SETTLEMENT_CONFIG } from '../config'
import type { BattleStatsData } from '../game/BattleStats'
import { matchTitle } from '../game/TitleMatcher'
import { validateConfig } from '../config/validation'
import { renderVirtualKeyboard } from './VirtualKeyboard'
import { drawBattlefield } from './renderers/BattlefieldRenderer'
import { VfxManager } from './VfxManager'
import { LetterPop } from './vfx/LetterPop'
import { FlashPulse } from './vfx/FlashPulse'
import { ParticleBurst } from './vfx/ParticleBurst'
import { DeathFlyout } from './vfx/DeathFlyout'
import { FullScreenFlash } from './vfx/FullScreenFlash'

// Fixed logical game dimensions — all game logic runs in this coordinate space
const GAME_WIDTH = 1280
const GAME_HEIGHT = 720

export class BattleScene implements Scene {
  readonly name = 'battle'
  private switchTo: (name: string) => void

  private manager: BattleManager | null = null
  private laneEntities: PlantEntity[][] = []
  private paused = false
  private screenWidth = 0
  private screenHeight = 0
  private stageIndex = 0
  private levelIndex = 0
  private difficultyKey = 'normal'
  private keyboardVisible = true
  private gameAreaHeight = 0
  private selectedPlants: readonly (readonly string[])[] | null = null
  private vfxManager = new VfxManager()
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

  setLevel(
    stageIndex: number,
    levelIndex: number,
    difficultyKey?: string,
    selectedPlants?: readonly (readonly string[])[],
    keyboardVisible?: boolean,
  ): void {
    this.stageIndex = stageIndex
    this.levelIndex = levelIndex
    if (difficultyKey !== undefined) this.difficultyKey = difficultyKey
    this.selectedPlants = selectedPlants ?? null
    this.keyboardVisible = keyboardVisible ?? true
  }

  enter(): void {
    this.screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1280
    this.screenHeight = typeof window !== 'undefined' ? window.innerHeight : 720
    this.gameAreaHeight = this.keyboardVisible ? Math.floor(GAME_HEIGHT * 0.82) : GAME_HEIGHT
    this.paused = false
    this.battleEnded = false

    const stage = STAGES[this.stageIndex]
    const level = stage.levels[this.levelIndex]
    const difficulty = DIFFICULTIES[this.difficultyKey] ?? DIFFICULTIES[DEFAULT_DIFFICULTY]
    const laneCount = level.laneCount ?? 1

    // Helper: resolve plant IDs → PlantConfig[]
    const resolvePlants = (ids: readonly string[]): PlantConfig[] =>
      ids.map(id => {
        const def = PLANT_DEFS.find(p => p.id === id)!
        return {
          id: def.id,
          name: def.name,
          comboSegment: Math.max(1, Math.round(def.comboSegment * (difficulty.plantSegmentOverrides?.[def.id] ?? difficulty.segmentMultiplier))),
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
      const ids = this.selectedPlants?.[i] ?? level.lanePlants?.[i] ?? stage.plants
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
      canvasWidth: GAME_WIDTH,
      canvasHeight: this.gameAreaHeight,
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
    this.vfxManager.clear()
  }

  exit(): void {
    this.vfxManager.clear()
    this.manager = null
    this.laneEntities = []
  }

  update(dt: number): void {
    // Read screen size for rendering (game logic uses fixed GAME_WIDTH/GAME_HEIGHT)
    this.screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1280
    this.screenHeight = typeof window !== 'undefined' ? window.innerHeight : 720

    if (!this.manager || this.paused) return

    this.manager.update(dt)

    const events = this.manager.consumeEvents()
    for (let i = 0; i < events.length; i++) {
      this.processGameEvent(events[i])
    }
    this.vfxManager.update(dt)

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
        return // switchTo in callback calls exit(), manager is now null
      }
    }

    if (!this.manager) return

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
        entities[i].update(dt)
        entities[i].syncState(plantStates[i])
        entities[i].letters = chainLetters.slice(segOffset, segOffset + segments) as string[]
        entities[i].typedCount = Math.max(0, Math.min(segments, comboCount - segOffset))
        entities[i].isCurrentTarget = isCurrentLane && comboCount >= segOffset && comboCount < segOffset + segments
        segOffset += segments
      }
    }
  }

  private processGameEvent(event: GameEvent): void {
    switch (event.type) {
      case 'hit': {
        // 金色字母弹出 — 大字、慢消散、上飘
        const pop = this.vfxManager.acquire('letterPop', () => new LetterPop())
        pop.init(event.x, event.y - 20, event.letter.toUpperCase(), '#ffd700', 36, 0.5, 2.5)
        this.vfxManager.spawn(pop)
        // 植物弹跳
        const laneEnts = this.laneEntities[event.laneIndex]
        if (laneEnts) {
          for (let j = 0; j < laneEnts.length; j++) {
            if (laneEnts[j].isCurrentTarget) {
              laneEnts[j].bounceTimer = 0.2
              break
            }
          }
        }
        break
      }
      case 'miss': {
        // 屏幕震动 — 更强更久
        this.vfxManager.shake(6, 0.25)
        if (this.manager) {
          const lane = this.manager.getLane(event.laneIndex)
          if (!lane.isEmpty) {
            // 红色大字闪烁
            const flash = this.vfxManager.acquire('letterPop', () => new LetterPop())
            flash.init(
              lane.plantPositions[0], lane.laneY - 20,
              lane.currentLetter.toUpperCase(), '#ff4444',
              40, 0.35, 1.5,
            )
            this.vfxManager.spawn(flash)
          }
        }
        break
      }
      case 'settlement': {
        const intensity = event.totalPlants > 0 ? event.plantCount / event.totalPlants : 0
        // 闪光脉冲 — 更大更亮
        const pulse = this.vfxManager.acquire('flashPulse', () => new FlashPulse())
        const endR = 80 + 150 * intensity
        const pulseAlpha = 0.4 + 0.4 * intensity
        const r = 255
        const g = Math.round(255 - 40 * intensity)
        const b = Math.round(255 - 255 * intensity)
        pulse.init(event.x, event.y, 30, endR, pulseAlpha, `rgb(${r},${g},${b})`, 0.4)
        this.vfxManager.spawn(pulse)
        // 屏幕震动 — 单棵也轻震，满链强震
        const shakeIntensity = 3 + 10 * intensity
        const shakeDuration = 0.2 + 0.3 * intensity
        this.vfxManager.shake(shakeIntensity, shakeDuration)
        // 粒子爆发 — 数量翻倍、速度更快
        const particleCount = Math.max(5, Math.floor(30 * intensity))
        const burst = this.vfxManager.acquire('particleBurst', () => new ParticleBurst())
        const burstG = Math.round(215 + 40 * (1 - intensity))
        const burstB = Math.round(255 * (1 - intensity))
        burst.init(event.x, event.y, particleCount, `rgb(255,${burstG},${burstB})`, 0.7)
        this.vfxManager.spawn(burst)
        // 满链大招 — 更亮更久
        if (event.isFullChain) {
          const fullFlash = this.vfxManager.acquire('fullScreenFlash', () => new FullScreenFlash())
          fullFlash.init('#ffd700', 0.5, 0.3)
          this.vfxManager.spawn(fullFlash)
          this.vfxManager.shake(14, 0.5)
        }
        break
      }
      case 'zombieHit': {
        // 僵尸闪白 — 更久
        if (this.manager) {
          const zombies = this.manager.getEntityManager().getByTag('zombie')
          for (let j = 0; j < zombies.length; j++) {
            if (zombies[j].id === event.zombieId) {
              (zombies[j] as ZombieEntity).flashTimer = 0.15
              break
            }
          }
        }
        break
      }
      case 'zombieDeath': {
        // 死亡残影 + 额外粒子碎片
        const flyout = this.vfxManager.acquire('deathFlyout', () => new DeathFlyout())
        flyout.init(event.x, event.y, event.width, event.height, event.color)
        this.vfxManager.spawn(flyout)
        // 碎片粒子
        const debris = this.vfxManager.acquire('particleBurst', () => new ParticleBurst())
        debris.init(event.x + event.width / 2, event.y + event.height / 2, 12, event.color, 0.6)
        this.vfxManager.spawn(debris)
        break
      }
      case 'waveStart':
      case 'waveEnd':
        break
    }
  }

  private calculateStars(stats: BattleStatsData): number {
    if (stats.missedCount === 0) return 3
    if (stats.missedCount <= Math.floor(this.manager!.missedLimit / 2)) return 2
    return 1
  }

  render(ctx: CanvasRenderingContext2D): void {
    const sw = this.screenWidth
    const sh = this.screenHeight

    // Compute keyboard area in screen space
    const kbScreenH = this.keyboardVisible ? Math.floor(sh * 0.18) : 0
    const gameScreenH = sh - kbScreenH

    // Scale logical game coordinates to screen
    const scaleX = sw / GAME_WIDTH
    const scaleY = gameScreenH / GAME_HEIGHT

    const shake = this.vfxManager.getShakeOffset()
    ctx.save()
    ctx.scale(scaleX, scaleY)
    ctx.translate(shake.x, shake.y)

    // All rendering below is in logical coordinates (GAME_WIDTH × GAME_HEIGHT)
    const w = GAME_WIDTH
    const h = GAME_HEIGHT

    // Background: checkerboard grass with plant zone
    drawBattlefield(ctx, w, this.gameAreaHeight, w * 0.35)

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

    ctx.restore() // end scale + shake translate

    // VFX renders in logical space too
    ctx.save()
    ctx.scale(scaleX, scaleY)
    this.vfxManager.render(ctx)
    ctx.restore()

    // Virtual keyboard — in screen space (not scaled)
    if (this.keyboardVisible && this.manager) {
      const kbY = gameScreenH
      const highlightKeys: string[] = []
      const status = this.manager.status
      if (status === BattleStatus.Fighting) {
        if (this.manager.currentLetter) {
          highlightKeys.push(this.manager.currentLetter)
        } else {
          for (let li = 0; li < this.manager.laneCount; li++) {
            const lane = this.manager.getLane(li)
            if (!lane.isEmpty) highlightKeys.push(lane.currentLetter)
          }
        }
      }

      renderVirtualKeyboard(ctx, 0, kbY, sw, kbScreenH, highlightKeys)
    }

    // Pause overlay (screen space)
    if (this.paused) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
      ctx.fillRect(0, 0, sw, sh)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 36px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('已暂停 - 按 P 继续', sw / 2, sh / 2)
    }

    // Victory / Defeat overlays (screen space)
    if (this.manager) {
      const status = this.manager.status

      if (status === BattleStatus.Victory || status === BattleStatus.Defeat) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
        ctx.fillRect(0, 0, sw, sh)
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
