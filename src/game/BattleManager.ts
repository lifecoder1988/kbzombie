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
import { BattleStats } from './BattleStats'
import type { BattleStatsData } from './BattleStats'

export interface EffectParams {
  readonly burst: { readonly burstCount: number; readonly burstInterval: number }
  readonly fan: { readonly fanBulletCount: number; readonly fanSpreadAngle: number }
  readonly tracking: { readonly trackingTurnRate: number }
  readonly chain: { readonly chainBounces: number; readonly chainRange: number }
  readonly explode: { readonly explodeRadius: number; readonly explodeDamageRatio: number }
  readonly ice: { readonly slowRatio: number; readonly slowDuration: number }
  readonly fire: { readonly burnDps: number; readonly burnDuration: number }
  readonly electric: { readonly conductRadius: number; readonly conductDamageDecay: number; readonly conductMaxJumps: number }
  readonly stun: { readonly stunDuration: number }
  readonly knockback: { readonly knockbackDistance: number }
}

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
  readonly effectParams: EffectParams
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
  private readonly stats = new BattleStats()

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

  getStats(): BattleStatsData {
    return this.stats.getStats()
  }

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

    // Re-acquire tracking targets each frame
    this.updateTrackingTargets()

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

  private resolveZombieType(wave: WaveConfig): string {
    if (wave.zombies && wave.zombies.length > 0) {
      let totalWeight = 0
      for (const entry of wave.zombies) totalWeight += entry.weight
      let roll = Math.random() * totalWeight
      for (const entry of wave.zombies) {
        roll -= entry.weight
        if (roll <= 0) return entry.type
      }
      return wave.zombies[wave.zombies.length - 1].type
    }
    return wave.zombieType!
  }

  private spawnZombie(): void {
    const wave = this.config.waves[this._currentWave]
    const zombieType = this.resolveZombieType(wave)
    const zombieConfig = this.config.zombieConfigs[zombieType]
    const { canvasWidth } = this.config
    const id = `zombie_${this.zombieIdCounter++}`
    const spawnX = canvasWidth + 20

    // Randomly assign to a lane
    const laneIdx = Math.floor(Math.random() * this.lanes.length)
    const lane = this.lanes[laneIdx]
    const zombie = new ZombieEntity({
      id,
      x: spawnX,
      y: lane.laneY,
      hp: zombieConfig.hp,
      speed: zombieConfig.speed,
      chewDps: zombieConfig.chewDps,
      width: zombieConfig.width,
      height: zombieConfig.height,
      color: zombieConfig.color,
    })

    this.zombieLanes.set(id, laneIdx)
    this.assignChewTarget(zombie, lane)
    this.entityManager.add(zombie)
  }

  private assignChewTarget(zombie: ZombieEntity, lane: Lane): void {
    const plants = lane.getPlantStates()
    for (let i = plants.length - 1; i >= 0; i--) {
      if (!plants[i].alive) continue
      const plantRightEdge = lane.plantPositions[i] + lane.plantWidths[i]
      if (plantRightEdge <= zombie.x) {
        // Plant is ahead of zombie — walk to its right edge
        zombie.setChewTarget(plantRightEdge)
        return
      }
      if (lane.plantPositions[i] <= zombie.x) {
        // Zombie overlaps with plant — chew at current position
        zombie.setChewTarget(zombie.x)
        return
      }
    }
    // No alive plant ahead of or overlapping with zombie
    zombie.clearChewTarget()
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
    for (let i = 0; i < zombies.length; i++) {
      const z = zombies[i]
      if (z.state === ZombieState.Dead) continue
      if ((this.zombieLanes.get(z.id) ?? 0) !== laneIdx) continue
      this.assignChewTarget(z, lane)
    }
  }

  private updateTrackingTargets(): void {
    const projectiles = this.entityManager.getByTag('projectile') as ProjectileEntity[]
    const zombies = this.entityManager.getByTag('zombie') as ZombieEntity[]
    for (let i = 0; i < projectiles.length; i++) {
      const proj = projectiles[i]
      if (!proj.active || proj.flight !== 'tracking') continue
      // Find nearest zombie that this projectile hasn't already hit
      let nearest: ZombieEntity | undefined
      let minDist = Infinity
      for (const z of zombies) {
        if (!z.active || proj.hasHit(z.id)) continue
        const dx = z.x - proj.x
        const dy = z.y - proj.y
        const dist = dx * dx + dy * dy
        if (dist < minDist) {
          minDist = dist
          nearest = z
        }
      }
      proj.setTarget(nearest ?? null)
    }
  }

  private updateCollisions(): void {
    const projectiles = this.entityManager.getByTag('projectile') as ProjectileEntity[]
    const zombies = this.entityManager.getByTag('zombie') as ZombieEntity[]
    const params = this.config.effectParams

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

          // Apply element effects
          this.applyElementEffect(proj.element, z, params)

          if (!z.active) {
            this.processedInWave++
            this.stats.recordKill()
          }

          // Handle impact type
          switch (proj.impact) {
            case 'pierce':
              // Don't break — continue checking other zombies
              continue

            case 'chain':
              // After hit, check if projectile needs redirect
              if (proj.needsRedirect) {
                const nearest = this.findNearestZombieExcluding(proj.x, proj.y, proj, zombies)
                if (nearest) {
                  proj.redirectTo(nearest.x, nearest.y)
                } else {
                  proj.clearRedirect()
                  // No more targets, deactivate
                  proj.active = false
                }
              }
              break

            case 'explode':
              // Deal area damage to nearby zombies
              this.applyExplosion(proj.x, proj.y, proj.power, proj.element, z.id, zombies, params)
              break

            case 'vanish':
              // Already deactivated by onHit
              break
          }
          break
        }
      }
    }
  }

  private applyElementEffect(element: Element, zombie: ZombieEntity, params: EffectParams): void {
    switch (element) {
      case 'ice':
        zombie.applyStatus({ type: 'slow', remaining: params.ice.slowDuration, value: params.ice.slowRatio })
        break
      case 'fire':
        zombie.applyStatus({ type: 'burn', remaining: params.fire.burnDuration, value: params.fire.burnDps })
        break
      case 'electric':
        this.applyConduction(zombie, params)
        break
      case 'stun':
        zombie.applyStatus({ type: 'stun', remaining: params.stun.stunDuration, value: 0 })
        break
      case 'knockback':
        zombie.applyKnockback(params.knockback.knockbackDistance, this.config.canvasWidth)
        // Reassign chew target after knockback
        {
          const laneIdx = this.zombieLanes.get(zombie.id) ?? 0
          const lane = this.lanes[laneIdx]
          this.assignChewTarget(zombie, lane)
        }
        break
      case 'normal':
        break
    }
  }

  private applyConduction(hitZombie: ZombieEntity, params: EffectParams): void {
    const zombies = this.entityManager.getByTag('zombie') as ZombieEntity[]
    const { conductRadius, conductDamageDecay, conductMaxJumps } = params.electric
    const visited = new Set<string>()
    visited.add(hitZombie.id)

    let currentTargets = [hitZombie]
    let currentDamageMultiplier = conductDamageDecay

    for (let jump = 0; jump < conductMaxJumps; jump++) {
      const nextTargets: ZombieEntity[] = []
      for (const source of currentTargets) {
        let nearest: ZombieEntity | undefined
        let minDist = Infinity
        for (const z of zombies) {
          if (!z.active || visited.has(z.id)) continue
          const dx = z.x - source.x
          const dy = z.y - source.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist <= conductRadius && dist < minDist) {
            minDist = dist
            nearest = z
          }
        }
        if (nearest) {
          visited.add(nearest.id)
          // Conduction damage not applied here — just status
          nearest.applyStatus({ type: 'stun', remaining: params.stun.stunDuration * 0.5, value: 0 })
          nextTargets.push(nearest)
          if (!nearest.active) {
            this.processedInWave++
            this.stats.recordKill()
          }
        }
      }
      if (nextTargets.length === 0) break
      currentTargets = nextTargets
      currentDamageMultiplier *= conductDamageDecay
    }
  }

  private applyExplosion(
    x: number, y: number, power: number, element: Element,
    directHitId: string, zombies: ZombieEntity[], params: EffectParams
  ): void {
    const { explodeRadius, explodeDamageRatio } = params.explode
    const splashDamage = power * explodeDamageRatio
    for (const z of zombies) {
      if (!z.active || z.id === directHitId) continue
      const dx = z.x - x
      const dy = z.y - y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist <= explodeRadius) {
        z.takeDamage(splashDamage)
        this.applyElementEffect(element, z, params)
        if (!z.active) {
          this.processedInWave++
          this.stats.recordKill()
        }
      }
    }
  }

  private findNearestZombieExcluding(
    px: number, py: number, proj: ProjectileEntity, zombies: ZombieEntity[]
  ): ZombieEntity | undefined {
    let nearest: ZombieEntity | undefined
    let minDist = Infinity
    const range = proj.chainRange
    for (const z of zombies) {
      if (!z.active || proj.hasHit(z.id)) continue
      const dx = z.x - px
      const dy = z.y - py
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist <= range && dist < minDist) {
        minDist = dist
        nearest = z
      }
    }
    return nearest
  }

  private updateMissed(): void {
    const zombies = this.entityManager.getByTag('zombie') as ZombieEntity[]
    for (let i = 0; i < zombies.length; i++) {
      const z = zombies[i]
      if (z.active && z.x + z.width < 0) {
        this._missedCount++
        this.stats.recordMiss()
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

    this.stats.recordCombo(comboCount)
    if (result.aliveActivatedIndices.length >= 2) {
      this.stats.recordSynergy()
    }
    if (isFullChain) {
      this.stats.recordFullChain()
    }

    const { synthesizedEffect, perPlantPower, aliveActivatedIndices } = result
    const params = this.config.effectParams

    for (let i = 0; i < aliveActivatedIndices.length; i++) {
      const plantIdx = aliveActivatedIndices[i]
      const px = lane.plantPositions[plantIdx] + lane.plantWidths[plantIdx] / 2
      const py = lane.laneY + 30

      const power = perPlantPower[i]

      switch (synthesizedEffect.spread) {
        case 'fan':
          this.fireFanProjectiles(px, py, power, synthesizedEffect, params)
          break

        case 'burst':
          this.fireBurstProjectiles(px, py, power, synthesizedEffect, params)
          break

        case 'single':
          this.fireSingleProjectile(px, py, power, synthesizedEffect, params)
          break
      }
    }

    if (isFullChain) {
      lane.healOnFullChain(this.config.healAmount)
      this.reassignChewTargetsForLane(laneIndex)
    }
  }

  private fireSingleProjectile(
    px: number, py: number, power: number,
    effect: { element: Element; spread: 'single' | 'burst' | 'fan'; flight: 'straight' | 'tracking'; impact: 'vanish' | 'chain' | 'pierce' | 'explode' },
    params: EffectParams
  ): void {
    const isTracking = effect.flight === 'tracking'
    const id = `proj_${this.projectileIdCounter++}`
    const proj = new ProjectileEntity({
      id,
      x: px,
      y: py,
      speed: this.config.projectileSpeed,
      power,
      rightBound: this.config.canvasWidth,
      element: effect.element,
      spread: effect.spread,
      flight: effect.flight,
      impact: effect.impact,
      target: isTracking ? this.findNearestZombie(px, py) : undefined,
      maxTurnRate: params.tracking.trackingTurnRate,
      chainBounces: params.chain.chainBounces,
      chainRange: params.chain.chainRange,
    })
    this.entityManager.add(proj)
    this._pendingProjectiles++
  }

  private fireBurstProjectiles(
    px: number, py: number, power: number,
    effect: { element: Element; spread: 'single' | 'burst' | 'fan'; flight: 'straight' | 'tracking'; impact: 'vanish' | 'chain' | 'pierce' | 'explode' },
    params: EffectParams
  ): void {
    const count = params.burst.burstCount
    for (let i = 0; i < count; i++) {
      const isTracking = effect.flight === 'tracking'
      const id = `proj_${this.projectileIdCounter++}`
      const proj = new ProjectileEntity({
        id,
        x: px + i * 8,  // slight x offset for each burst bullet
        y: py,
        speed: this.config.projectileSpeed,
        power,
        rightBound: this.config.canvasWidth,
        element: effect.element,
        spread: effect.spread,
        flight: effect.flight,
        impact: effect.impact,
        target: isTracking ? this.findNearestZombie(px, py) : undefined,
        maxTurnRate: params.tracking.trackingTurnRate,
        chainBounces: params.chain.chainBounces,
        chainRange: params.chain.chainRange,
      })
      this.entityManager.add(proj)
      this._pendingProjectiles++
    }
  }

  private fireFanProjectiles(
    px: number, py: number, power: number,
    effect: { element: Element; spread: 'single' | 'burst' | 'fan'; flight: 'straight' | 'tracking'; impact: 'vanish' | 'chain' | 'pierce' | 'explode' },
    params: EffectParams
  ): void {
    const count = params.fan.fanBulletCount
    const halfSpread = params.fan.fanSpreadAngle / 2

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

    const isTracking = effect.flight === 'tracking'
    // Fan+tracking: each bullet gets its own target
    const targets = isTracking ? this.findNearestZombies(px, py, angles.length) : []

    for (let i = 0; i < angles.length; i++) {
      const id = `proj_${this.projectileIdCounter++}`
      // Round-robin assign targets: if fewer zombies than bullets, wrap around
      const target = isTracking && targets.length > 0
        ? targets[i % targets.length]
        : undefined
      const proj = new ProjectileEntity({
        id,
        x: px,
        y: py,
        speed: this.config.projectileSpeed,
        power,
        rightBound: this.config.canvasWidth,
        element: effect.element,
        spread: effect.spread,
        flight: effect.flight,
        impact: effect.impact,
        angle: angles[i],
        target,
        maxTurnRate: params.tracking.trackingTurnRate,
        chainBounces: params.chain.chainBounces,
        chainRange: params.chain.chainRange,
      })
      this.entityManager.add(proj)
      this._pendingProjectiles++
    }
  }

  private findNearestZombie(px: number, py: number): ZombieEntity | undefined {
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

  private findNearestZombies(px: number, py: number, count: number): ZombieEntity[] {
    const zombies = this.entityManager.getByTag('zombie') as ZombieEntity[]
    const active: { z: ZombieEntity; dist: number }[] = []
    for (const z of zombies) {
      if (!z.active) continue
      const dx = z.x - px
      const dy = z.y - py
      active.push({ z, dist: dx * dx + dy * dy })
    }
    active.sort((a, b) => a.dist - b.dist)
    const result: ZombieEntity[] = []
    for (let i = 0; i < Math.min(count, active.length); i++) {
      result.push(active[i].z)
    }
    return result
  }
}
