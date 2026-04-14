import { EntityManager } from '../engine/EntityManager'
import { intersects } from '../engine/CollisionDetection'
import { BattleStatus } from './types'
import type { PlantConfig, PlantState, WaveConfig, ZombieConfig, Element } from './types'
import { Lane } from './Lane'
import { calculateSettlement } from './Settlement'
import { IGNORED_KEYS } from './InputHandler'
import { ZombieEntity } from './ZombieEntity'
import { ProjectileEntity } from './ProjectileEntity'
import { ZombieState } from './types'

export interface BattleConfig {
  readonly laneCount: number
  readonly lanePlants: readonly (readonly PlantConfig[])[]
  readonly waves: readonly WaveConfig[]
  readonly zombieConfigs: Readonly<Record<string, ZombieConfig>>
  readonly letterPool: readonly string[]
  readonly missedLimit: number
  readonly projectileSpeed: number
  readonly healAmount: number
  readonly wavePauseDuration: number
  readonly canvasWidth: number
  readonly canvasHeight: number
  readonly letterSeed?: number
  readonly synergyMultiplier: Readonly<Record<number, number>>
  readonly areaBulletCount: number
  readonly areaSpreadAngle: number
  readonly areaDamageDecay: number
  readonly trackingTurnRate: number
}

export class BattleManager {
  private readonly config: BattleConfig
  private readonly entityManager: EntityManager
  private readonly lanes: Lane[]
  private currentLaneIndex: number | null = null
  private readonly zombieLanes = new Map<string, number>()

  private _status: BattleStatus = BattleStatus.Fighting
  private _currentWave = 0
  private _missedCount = 0

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

  constructor(config: BattleConfig) {
    this.config = config
    this.entityManager = new EntityManager()

    // Calculate lane Y positions
    const laneYPositions = this.calculateLaneYPositions(config.laneCount, config.canvasHeight)

    // Calculate max total segments across all lanes (for consistent plant width)
    let maxTotalSegments = 0
    for (let i = 0; i < config.laneCount; i++) {
      const plants = config.lanePlants[i] ?? []
      const seg = plants.reduce((s, p) => s + p.comboSegment, 0)
      if (seg > maxTotalSegments) maxTotalSegments = seg
    }

    // Create lanes
    this.lanes = []
    for (let i = 0; i < config.laneCount; i++) {
      const plants = config.lanePlants[i] ?? []
      const seed = config.letterSeed !== undefined ? config.letterSeed + i * 1000 : undefined
      const lane = new Lane(i, plants, config.letterPool, laneYPositions[i], config.canvasWidth, maxTotalSegments, seed)
      this.lanes.push(lane)
    }

    // Ensure no two lanes share the same first letter
    this.ensureNoLetterConflict()
  }

  private calculateLaneYPositions(laneCount: number, canvasHeight: number): number[] {
    if (laneCount === 1) {
      return [Math.round(canvasHeight * 0.4)]
    }
    const positions: number[] = []
    const topY = canvasHeight * 0.2
    const bottomY = canvasHeight * 0.7
    for (let i = 0; i < laneCount; i++) {
      const t = laneCount > 1 ? i / (laneCount - 1) : 0
      positions.push(Math.round(topY + t * (bottomY - topY)))
    }
    return positions
  }

  private ensureNoLetterConflict(): void {
    if (this.lanes.length <= 1) return
    for (let i = 1; i < this.lanes.length; i++) {
      const otherFirstLetters = this.lanes
        .filter((_, idx) => idx !== i)
        .map(l => l.currentLetter)
      if (otherFirstLetters.includes(this.lanes[i].currentLetter)) {
        this.lanes[i].regenerateLetters(otherFirstLetters)
      }
    }
  }

  get status(): BattleStatus { return this._status }
  get currentWave(): number { return this._currentWave }
  get missedCount(): number { return this._missedCount }
  get totalWaves(): number { return this.config.waves.length }
  get missedLimit(): number { return this.config.missedLimit }

  get comboCount(): number {
    if (this.currentLaneIndex !== null) return this.lanes[this.currentLaneIndex].comboCount
    return 0
  }

  get currentLetter(): string {
    if (this.currentLaneIndex !== null) return this.lanes[this.currentLaneIndex].currentLetter
    return ''
  }

  get currentLane(): number | null { return this.currentLaneIndex }
  get laneCount(): number { return this.lanes.length }

  getLane(index: number): Lane { return this.lanes[index] }

  getChainLetters(laneIndex?: number): readonly string[] {
    const idx = laneIndex ?? this.currentLaneIndex ?? 0
    return this.lanes[idx].chainLetters
  }

  getPlantStates(laneIndex?: number): readonly PlantState[] {
    const idx = laneIndex ?? 0
    return this.lanes[idx].getPlantStates()
  }

  getZombieLane(zombieId: string): number {
    return this.zombieLanes.get(zombieId) ?? 0
  }

  get zombieCount(): number {
    return this.entityManager.getByTag('zombie').length
  }

  get projectileCount(): number {
    return this._pendingProjectiles + this.entityManager.getByTag('projectile').length
  }

  getZombies(): ZombieEntity[] {
    return this.entityManager.getByTag('zombie') as ZombieEntity[]
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
    const wave = this.config.waves[this._currentWave]
    const zombieConfig = this.config.zombieConfigs[wave.zombieType]
    const { canvasWidth } = this.config
    const id = `zombie_${this.zombieIdCounter++}`
    const spawnX = canvasWidth + 20

    // Randomly assign to a lane
    const laneIdx = Math.floor(Math.random() * this.lanes.length)
    const lane = this.lanes[laneIdx]
    const zombie = new ZombieEntity(id, spawnX, lane.laneY, zombieConfig.hp, zombieConfig.speed, zombieConfig.chewDps)

    this.zombieLanes.set(id, laneIdx)
    this.assignChewTarget(zombie, lane)
    this.entityManager.add(zombie)
  }

  private assignChewTarget(zombie: ZombieEntity, lane: Lane): void {
    const plantIdx = lane.getRightmostAlivePlantIndex()
    if (plantIdx >= 0) {
      zombie.setChewTarget(lane.plantPositions[plantIdx] + lane.plantWidths[plantIdx])
    }
  }

  private updateChewing(dt: number): void {
    const zombies = this.entityManager.getByTag('zombie') as ZombieEntity[]
    for (let i = 0; i < zombies.length; i++) {
      const z = zombies[i]
      if (z.state !== ZombieState.Chewing) continue

      const damage = z.getChewDamage(dt)
      const laneIdx = this.zombieLanes.get(z.id) ?? 0
      const lane = this.lanes[laneIdx]
      const plantIdx = lane.getRightmostAlivePlantIndex()
      if (plantIdx < 0) continue

      lane.takeDamage(plantIdx, damage)

      // If that plant just died, reassign chewing zombies in that lane
      if (!lane.getPlantStates()[plantIdx].alive) {
        this.reassignChewTargetsForLane(laneIdx)
      }
    }
  }

  private reassignChewTargetsForLane(laneIdx: number): void {
    const lane = this.lanes[laneIdx]
    const zombies = this.entityManager.getByTag('zombie') as ZombieEntity[]
    const plantIdx = lane.getRightmostAlivePlantIndex()
    for (let i = 0; i < zombies.length; i++) {
      const z = zombies[i]
      if (z.state === ZombieState.Dead) continue
      if ((this.zombieLanes.get(z.id) ?? 0) !== laneIdx) continue
      if (plantIdx >= 0) {
        z.setChewTarget(lane.plantPositions[plantIdx] + lane.plantWidths[plantIdx])
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
        if (proj.hasHit(z.id)) continue

        if (intersects(proj, z)) {
          z.takeDamage(proj.power)
          proj.onHit(z.id)
          if (!z.active) {
            this.processedInWave++
          }
          if (proj.trajectory !== 'pierce') break
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
        this.zombieLanes.delete(z.id)
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
      // Reset all lanes
      for (let i = 0; i < this.lanes.length; i++) {
        this.lanes[i].resetCombo()
      }
      this.currentLaneIndex = null
      this.ensureNoLetterConflict()
      // Regenerate all lanes' letters
      for (let i = 0; i < this.lanes.length; i++) {
        const otherFirstLetters = this.lanes
          .filter((_, idx) => idx !== i)
          .map(l => l.currentLetter)
        this.lanes[i].regenerateLetters(otherFirstLetters)
      }

      this._currentWave++
      if (this._currentWave >= this.config.waves.length) {
        this._status = BattleStatus.Victory
      } else {
        this._status = BattleStatus.WavePause
        this.wavePauseTimer = this.config.wavePauseDuration
      }
    }
  }

  onKeyDown(key: string): void {
    if (this._status !== BattleStatus.Fighting) return

    // Ignore function/modifier keys
    if (key.length > 1 || IGNORED_KEYS.has(key)) return

    if (key === ' ') {
      // Space: settle current lane
      if (this.currentLaneIndex === null) return
      const settlement = this.lanes[this.currentLaneIndex].settle()
      if (settlement) {
        this.executeSettlement(this.currentLaneIndex, settlement.comboCount, settlement.isFullChain)
        this.onLaneSettled(this.currentLaneIndex)
      }
      this.currentLaneIndex = null
      return
    }

    const lower = key.toLowerCase()

    if (this.currentLaneIndex !== null) {
      // Locked to a lane
      const lane = this.lanes[this.currentLaneIndex]
      if (lower === lane.currentLetter) {
        // Hit
        const settlement = lane.hit()
        if (settlement) {
          this.executeSettlement(this.currentLaneIndex, settlement.comboCount, settlement.isFullChain)
          this.onLaneSettled(this.currentLaneIndex)
          this.currentLaneIndex = null
        }
      } else {
        // Miss
        const settlement = lane.miss()
        if (settlement) {
          this.executeSettlement(this.currentLaneIndex, settlement.comboCount, settlement.isFullChain)
          this.onLaneSettled(this.currentLaneIndex)
        }
        this.currentLaneIndex = null
      }
    } else {
      // Free match: scan all non-empty lanes for matching currentLetter
      for (let i = 0; i < this.lanes.length; i++) {
        const lane = this.lanes[i]
        if (lane.isEmpty) continue
        if (lower === lane.currentLetter) {
          this.currentLaneIndex = i
          const settlement = lane.hit()
          if (settlement) {
            this.executeSettlement(i, settlement.comboCount, settlement.isFullChain)
            this.onLaneSettled(i)
            this.currentLaneIndex = null
          }
          return
        }
      }
      // No match found — ignore
    }
  }

  private onLaneSettled(laneIndex: number): void {
    const otherFirstLetters = this.lanes
      .filter((_, idx) => idx !== laneIndex)
      .map(l => l.currentLetter)
    this.lanes[laneIndex].regenerateLetters(otherFirstLetters)
  }

  private executeSettlement(laneIndex: number, comboCount: number, isFullChain: boolean): void {
    const lane = this.lanes[laneIndex]
    const plants = lane.getPlantStates()
    const result = calculateSettlement(plants, comboCount, isFullChain, this.config.synergyMultiplier)

    const { synthesizedEffect, perPlantPower, aliveActivatedIndices } = result

    for (let i = 0; i < aliveActivatedIndices.length; i++) {
      const plantIdx = aliveActivatedIndices[i]
      const px = lane.plantPositions[plantIdx] + lane.plantWidths[plantIdx] / 2
      const py = lane.laneY + 30

      const power = perPlantPower[i]

      if (synthesizedEffect.spread === 'fan') {
        this.fireAreaProjectiles(px, py, power, synthesizedEffect.element)
      } else {
        const isTracking = synthesizedEffect.flight === 'tracking'
        const isPierce = synthesizedEffect.impact === 'pierce'
        // Map 4D fields to ProjectileEntity trajectory
        const trajectory = isPierce ? 'pierce' : isTracking ? 'tracking' : 'direct'
        const id = `proj_${this.projectileIdCounter++}`
        const proj = new ProjectileEntity({
          id,
          x: px,
          y: py,
          speed: this.config.projectileSpeed,
          power,
          rightBound: this.config.canvasWidth,
          trajectory,
          element: synthesizedEffect.element,
          target: isTracking ? this.findNearestZombie(px, py) : undefined,
          maxTurnRate: this.config.trackingTurnRate,
        })
        this.entityManager.add(proj)
        this._pendingProjectiles++
      }
    }

    if (isFullChain) {
      lane.healOnFullChain(this.config.healAmount)
      this.reassignChewTargetsForLane(laneIndex)
    }
  }

  private fireAreaProjectiles(px: number, py: number, power: number, element: Element): void {
    const count = this.config.areaBulletCount
    const halfSpread = this.config.areaSpreadAngle / 2
    const decay = this.config.areaDamageDecay
    const bulletPower = power * decay

    // Build angle list: 0 always included, symmetric pairs outward
    const angles: number[] = [0]
    const pairs = Math.floor((count - 1) / 2)
    if (pairs > 0) {
      const step = halfSpread / pairs
      for (let j = 1; j <= pairs; j++) {
        angles.push(step * j)
        angles.push(-step * j)
      }
    }
    // Even count: one extra bullet between center and first pair
    if (count > 1 && count % 2 === 0) {
      const step = pairs > 0 ? halfSpread / pairs : halfSpread
      angles.push(step / 2)
    }

    for (let i = 0; i < angles.length; i++) {
      const id = `proj_${this.projectileIdCounter++}`
      const proj = new ProjectileEntity({
        id,
        x: px,
        y: py,
        speed: this.config.projectileSpeed,
        power: bulletPower,
        rightBound: this.config.canvasWidth,
        trajectory: 'area',
        element,
        angle: angles[i],
      })
      this.entityManager.add(proj)
      this._pendingProjectiles++
    }
  }

  private findNearestZombie(px: number, py: number): { x: number; y: number; active?: boolean } | undefined {
    const zombies = this.entityManager.getByTag('zombie') as ZombieEntity[]
    let nearest: ZombieEntity | undefined
    let minDist = Infinity
    for (const z of zombies) {
      if (!z.active) continue
      const dx = z.x - px
      const dy = z.y - py
      const dist = dx * dx + dy * dy
      if (dist < minDist) {
        minDist = dist
        nearest = z
      }
    }
    return nearest
  }
}
