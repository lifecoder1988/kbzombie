import { EntityManager } from '../engine/EntityManager'
import { intersects } from '../engine/CollisionDetection'
import { BattleStatus } from './types'
import type { PlantConfig, PlantState, WaveConfig, ZombieConfig } from './types'
import { PlantChain } from './PlantChain'
import { ComboSystem } from './ComboSystem'
import { LetterProvider } from './LetterProvider'
import { calculateSettlement } from './Settlement'
import { classifyInput, InputAction } from './InputHandler'
import { ZombieEntity } from './ZombieEntity'
import { ProjectileEntity } from './ProjectileEntity'
import { ZombieState } from './types'

export interface BattleConfig {
  readonly plants: readonly PlantConfig[]
  readonly waves: readonly WaveConfig[]
  readonly zombieConfig: ZombieConfig
  readonly letterPool: readonly string[]
  readonly missedLimit: number
  readonly projectileSpeed: number
  readonly healAmount: number
  readonly canvasWidth: number
  readonly canvasHeight: number
  readonly letterSeed?: number
}

const WAVE_PAUSE_DURATION = 3000

export class BattleManager {
  private readonly config: BattleConfig
  private readonly entityManager: EntityManager
  private readonly plantChain: PlantChain
  private readonly combo: ComboSystem
  private readonly letters: LetterProvider

  private _status: BattleStatus = BattleStatus.Fighting
  private _currentWave = 0
  private _missedCount = 0
  /** 整条链条的字母序列，长度 = totalSegments */
  private _chainLetters: string[]

  // wave spawn tracking
  private spawnedInWave = 0
  private spawnTimer = 0
  private waveComplete = false

  // wave pause
  private wavePauseTimer = 0

  // processed (killed or missed) in current wave
  private processedInWave = 0

  // zombie id counter
  private zombieIdCounter = 0
  private projectileIdCounter = 0
  private _pendingProjectiles = 0

  // plant layout
  private readonly plantPositions: readonly number[]
  private readonly plantWidths: readonly number[]
  private readonly laneY: number

  constructor(config: BattleConfig) {
    this.config = config
    this.entityManager = new EntityManager()
    this.plantChain = new PlantChain(config.plants)
    this.combo = new ComboSystem(config.plants.map(p => p.segments))
    this.letters = new LetterProvider(config.letterPool, config.letterSeed)
    const totalSeg = config.plants.reduce((s, p) => s + p.segments, 0)
    this._chainLetters = Array.from({ length: totalSeg }, () => this.letters.next())

    // 植物位置按段数比例分配，占画面左 35%
    const plantAreaWidth = config.canvasWidth * 0.35
    const totalSeg2 = config.plants.reduce((s, p) => s + p.segments, 0)
    const gap = 8
    const totalGap = gap * (config.plants.length - 1)
    const usableWidth = plantAreaWidth - totalGap
    const startX = 20
    const positions: number[] = []
    const widths: number[] = []
    let curX = startX
    for (let i = 0; i < config.plants.length; i++) {
      const w = Math.round((config.plants[i].segments / totalSeg2) * usableWidth)
      positions.push(curX)
      widths.push(w)
      curX += w + gap
    }
    this.plantPositions = positions
    this.plantWidths = widths
    this.laneY = Math.round(config.canvasHeight * 0.4)
  }

  get status(): BattleStatus { return this._status }
  get currentWave(): number { return this._currentWave }
  get comboCount(): number { return this.combo.current }
  get missedCount(): number { return this._missedCount }
  /** 当前需要输入的字母（链条中 combo 位置的字母） */
  get currentLetter(): string {
    return this._chainLetters[this.combo.current] ?? this._chainLetters[0]
  }

  /** 获取整条链条的字母序列 */
  getChainLetters(): readonly string[] {
    return this._chainLetters
  }

  private regenerateAllLetters(): void {
    for (let i = 0; i < this._chainLetters.length; i++) {
      this._chainLetters[i] = this.letters.next()
    }
  }

  get zombieCount(): number {
    return this.entityManager.getByTag('zombie').length
  }

  get projectileCount(): number {
    // getByTag only returns flushed entities; after firing use pending count too
    return this._pendingProjectiles + this.entityManager.getByTag('projectile').length
  }

  getZombies(): ZombieEntity[] {
    return this.entityManager.getByTag('zombie') as ZombieEntity[]
  }

  getPlantStates(): readonly PlantState[] {
    return this.plantChain.getStates()
  }

  getEntityManager(): EntityManager {
    return this.entityManager
  }

  update(dt: number): void {
    if (this._status === BattleStatus.Victory || this._status === BattleStatus.Defeat) return

    if (this._status === BattleStatus.WavePause) {
      this.wavePauseTimer -= dt
      if (this.wavePauseTimer <= 0) {
        this._status = BattleStatus.Fighting
        this.spawnedInWave = 0
        this.processedInWave = 0
        this.waveComplete = false
        this.spawnTimer = 0
      }
      return
    }

    // Spawn zombies
    this.updateSpawn(dt)

    // Update entities (flush pending adds)
    this.entityManager.update(dt)
    this._pendingProjectiles = 0

    // Handle chewing
    this.updateChewing(dt)

    // Collision: projectiles vs zombies
    this.updateCollisions()

    // Check missed zombies (gone past left edge)
    this.updateMissed()

    // Check wave completion
    this.checkWaveCompletion()
  }

  private updateSpawn(dt: number): void {
    if (this._currentWave >= this.config.waves.length) return
    const wave = this.config.waves[this._currentWave]
    if (this.spawnedInWave >= wave.count) return

    this.spawnTimer += dt
    const toSpawn = Math.floor(this.spawnTimer / wave.interval)
    if (toSpawn > 0) {
      this.spawnTimer -= toSpawn * wave.interval
      const actualSpawn = Math.min(toSpawn, wave.count - this.spawnedInWave)
      for (let i = 0; i < actualSpawn; i++) {
        this.spawnZombie()
        this.spawnedInWave++
      }
    }
  }

  private spawnZombie(): void {
    const { zombieConfig, canvasWidth } = this.config
    const id = `zombie_${this.zombieIdCounter++}`
    const spawnX = canvasWidth + 20
    const zombie = new ZombieEntity(id, spawnX, this.laneY, zombieConfig.hp, zombieConfig.speed, zombieConfig.chewDps)

    // Set chew target to rightmost alive plant
    this.assignChewTarget(zombie)
    this.entityManager.add(zombie)
  }

  private assignChewTarget(zombie: ZombieEntity): void {
    const plantIdx = this.plantChain.getRightmostAlivePlantIndex()
    if (plantIdx >= 0) {
      zombie.setChewTarget(this.plantPositions[plantIdx] + this.plantWidths[plantIdx])
    }
  }

  private updateChewing(dt: number): void {
    const zombies = this.entityManager.getByTag('zombie') as ZombieEntity[]
    for (let i = 0; i < zombies.length; i++) {
      const z = zombies[i]
      if (z.state !== ZombieState.Chewing) continue

      const damage = z.getChewDamage(dt)
      const plantIdx = this.plantChain.getRightmostAlivePlantIndex()
      if (plantIdx < 0) continue

      this.plantChain.takeDamage(plantIdx, damage)

      // If that plant just died, reassign all chewing zombies
      if (!this.plantChain.getStates()[plantIdx].alive) {
        this.reassignAllChewTargets()
      }
    }
  }

  private reassignAllChewTargets(): void {
    const zombies = this.entityManager.getByTag('zombie') as ZombieEntity[]
    const plantIdx = this.plantChain.getRightmostAlivePlantIndex()
    for (let i = 0; i < zombies.length; i++) {
      const z = zombies[i]
      if (z.state === ZombieState.Dead) continue
      if (plantIdx >= 0) {
        z.setChewTarget(this.plantPositions[plantIdx] + this.plantWidths[plantIdx])
      } else {
        z.clearChewTarget()
      }
    }
  }

  private updateCollisions(): void {
    const projectiles = this.entityManager.getByTag('projectile') as ProjectileEntity[]
    const zombies = this.entityManager.getByTag('zombie') as ZombieEntity[]

    for (let pi = 0; pi < projectiles.length; pi++) {
      const proj = projectiles[pi]
      if (!proj.active) continue

      for (let zi = 0; zi < zombies.length; zi++) {
        const z = zombies[zi]
        if (!z.active) continue

        if (intersects(proj, z)) {
          z.takeDamage(proj.power)
          proj.onHit()
          if (!z.active) {
            // zombie dead - count as processed
            this.processedInWave++
          }
          break
        }
      }
    }
  }

  private updateMissed(): void {
    const zombies = this.entityManager.getByTag('zombie') as ZombieEntity[]
    for (let i = 0; i < zombies.length; i++) {
      const z = zombies[i]
      if (z.active && z.x + z.width < 0) {
        this._missedCount++
        this.processedInWave++
        this.entityManager.remove(z)

        if (this._missedCount >= this.config.missedLimit) {
          this._status = BattleStatus.Defeat
          return
        }
      }
    }
  }

  private checkWaveCompletion(): void {
    if (this._status !== BattleStatus.Fighting) return
    if (this._currentWave >= this.config.waves.length) return

    const wave = this.config.waves[this._currentWave]
    const allSpawned = this.spawnedInWave >= wave.count
    const allProcessed = this.processedInWave >= wave.count

    if (allSpawned && allProcessed) {
      this.combo.reset()
      this.regenerateAllLetters()
      this._currentWave++
      if (this._currentWave >= this.config.waves.length) {
        this._status = BattleStatus.Victory
      } else {
        this._status = BattleStatus.WavePause
        this.wavePauseTimer = WAVE_PAUSE_DURATION
      }
    }
  }

  onKeyDown(key: string): void {
    if (this._status !== BattleStatus.Fighting) return

    const action = classifyInput(key, this.currentLetter)
    let settlement = null

    if (action === InputAction.LetterHit) {
      settlement = this.combo.hit()
    } else if (action === InputAction.LetterMiss) {
      settlement = this.combo.miss()
    } else if (action === InputAction.Space) {
      settlement = this.combo.settle()
    } else {
      return
    }

    if (settlement) {
      this.executeSettlement(settlement.comboCount, settlement.isFullChain)
      this.regenerateAllLetters()
    } else if (action === InputAction.LetterHit) {
      // combo already advanced — the old position letter was consumed, no need to regenerate
      // (it will show as "already typed" visually)
    }
  }

  private executeSettlement(comboCount: number, isFullChain: boolean): void {
    const plants = this.plantChain.getStates()
    const result = calculateSettlement(plants, comboCount, isFullChain)

    // Fire projectiles from each alive activated plant, splitting total power evenly
    const powerPerProjectile = result.aliveActivatedIndices.length > 0
      ? result.totalPower / result.aliveActivatedIndices.length
      : 0
    for (const plantIdx of result.aliveActivatedIndices) {
      const px = this.plantPositions[plantIdx] + this.plantWidths[plantIdx]
      const py = this.laneY + 30
      const id = `proj_${this.projectileIdCounter++}`
      const proj = new ProjectileEntity(id, px, py, this.config.projectileSpeed, powerPerProjectile, this.config.canvasWidth)
      this.entityManager.add(proj)
      this._pendingProjectiles++
    }

    // Heal on full chain, then reassign zombie targets (revived plants need to be chewed again)
    if (isFullChain) {
      this.plantChain.healOnFullChain(this.config.healAmount)
      this.reassignAllChewTargets()
    }
  }
}
