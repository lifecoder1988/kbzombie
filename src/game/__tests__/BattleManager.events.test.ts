import { describe, it, expect } from 'vitest'
import { BattleManager, type BattleConfig } from '../BattleManager'
import type { PlantConfig, WaveConfig } from '../types'

const DEFAULT_EFFECT_PARAMS = {
  burst: { burstCount: 3, burstInterval: 80 },
  fan: { fanBulletCount: 5, fanSpreadAngle: Math.PI / 3 },
  tracking: { trackingTurnRate: Math.PI },
  chain: { chainBounces: 3, chainRange: 200 },
  explode: { explodeRadius: 80, explodeDamageRatio: 0.6 },
  ice: { slowRatio: 0.5, slowDuration: 3 },
  fire: { burnDps: 5, burnDuration: 3 },
  electric: { conductRadius: 100, conductDamageDecay: 0.7, conductMaxJumps: 3 },
  stun: { stunDuration: 1.5 },
  knockback: { knockbackDistance: 60 },
}

// Single 1-segment plant so one key press completes the full chain
const SINGLE_SEGMENT_PLANT: PlantConfig[] = [
  { id: 'quick', name: 'Quick', comboSegment: 1, attackPower: 10, hp: 100, element: 'normal', spread: 'single', flight: 'straight', impact: 'vanish' },
]

const SINGLE_ZOMBIE_WAVE: WaveConfig[] = [
  { zombieType: 'normal', count: 1, interval: 100 },
]

const TEST_ZOMBIE = { hp: 50, speed: 30, chewDps: 10, width: 40, height: 60, color: '#44cc44' }

function createEventsManager(overrides?: Partial<BattleConfig>): BattleManager {
  return new BattleManager({
    laneCount: 1,
    lanePlants: [SINGLE_SEGMENT_PLANT],
    waves: SINGLE_ZOMBIE_WAVE,
    zombieConfigs: { normal: TEST_ZOMBIE },
    letterPool: ['f', 'j', 'd', 'k'],
    missedLimit: 5,
    projectileSpeed: 500,
    healAmount: 30,
    wavePauseDuration: 3000,
    canvasWidth: 1000,
    canvasHeight: 600,
    letterSeed: 42,
    synergyMultiplier: { 1: 1.0, 2: 1.2, 3: 1.5 },
    effectParams: DEFAULT_EFFECT_PARAMS,
    ...overrides,
  })
}

describe('BattleManager.events — consumeEvents', () => {
  it('consumeEvents returns empty array initially', () => {
    const mgr = createEventsManager()
    const events = mgr.consumeEvents()
    expect(events).toEqual([])
  })

  it('consumeEvents clears the queue after reading', () => {
    const mgr = createEventsManager()
    // Spawn a zombie to get the game going
    mgr.update(200)
    // Press a letter to produce a hit event
    const letter = mgr.getLane(0).currentLetter
    mgr.onKeyDown(letter)

    // First consume gets the events
    const first = mgr.consumeEvents()
    expect(first.length).toBeGreaterThan(0)

    // Second consume returns empty
    const second = mgr.consumeEvents()
    expect(second).toEqual([])
  })
})

describe('BattleManager.events — hit event', () => {
  it('emits hit event on correct key press', () => {
    const mgr = createEventsManager()
    mgr.update(200)
    const letter = mgr.getLane(0).currentLetter
    mgr.onKeyDown(letter)

    const events = mgr.consumeEvents()
    const hitEvents = events.filter(e => e.type === 'hit')
    expect(hitEvents.length).toBeGreaterThanOrEqual(1)

    const hit = hitEvents[0]
    expect(hit.type).toBe('hit')
    if (hit.type === 'hit') {
      expect(hit.letter).toBe(letter)
      expect(hit.laneIndex).toBe(0)
      expect(typeof hit.x).toBe('number')
      expect(typeof hit.y).toBe('number')
    }
  })
})

describe('BattleManager.events — miss event', () => {
  it('emits miss event on wrong key press when locked to a lane', () => {
    const mgr = createEventsManager()
    mgr.update(200)

    // First lock on to the lane with a correct letter
    const letter = mgr.getLane(0).currentLetter
    mgr.onKeyDown(letter)
    mgr.consumeEvents() // clear the hit event

    // Now lock on again with the right letter for the next hit
    // With a 1-segment plant, the first hit causes auto-settlement and unlocks
    // We need a multi-segment plant to test miss while locked
    // Use a fresh manager with 2 segments so we can lock and then miss
    const twoSegMgr = createEventsManager({
      lanePlants: [[
        { id: 'two', name: 'Two', comboSegment: 2, attackPower: 10, hp: 100, element: 'normal', spread: 'single', flight: 'straight', impact: 'vanish' },
      ]],
    })
    twoSegMgr.update(200)
    const firstLetter = twoSegMgr.getLane(0).currentLetter
    twoSegMgr.onKeyDown(firstLetter) // lock on (combo = 1)
    twoSegMgr.consumeEvents()

    // Now press a wrong letter while locked
    twoSegMgr.onKeyDown('z')
    const missEvents = twoSegMgr.consumeEvents().filter(e => e.type === 'miss')
    expect(missEvents.length).toBeGreaterThanOrEqual(1)
    expect(missEvents[0].type).toBe('miss')
    if (missEvents[0].type === 'miss') {
      expect(missEvents[0].laneIndex).toBe(0)
    }
  })
})

describe('BattleManager.events — settlement event', () => {
  it('emits settlement event when combo completes', () => {
    const mgr = createEventsManager()
    mgr.update(200)

    // With a 1-segment plant, one correct keypress triggers auto-settlement
    const letter = mgr.getLane(0).currentLetter
    mgr.onKeyDown(letter)

    const events = mgr.consumeEvents()
    const settlementEvents = events.filter(e => e.type === 'settlement')
    expect(settlementEvents.length).toBeGreaterThanOrEqual(1)

    const settlement = settlementEvents[0]
    expect(settlement.type).toBe('settlement')
    if (settlement.type === 'settlement') {
      expect(typeof settlement.x).toBe('number')
      expect(typeof settlement.y).toBe('number')
      expect(typeof settlement.power).toBe('number')
      expect(settlement.power).toBeGreaterThan(0)
      expect(typeof settlement.isFullChain).toBe('boolean')
      expect(typeof settlement.plantCount).toBe('number')
      expect(typeof settlement.totalPlants).toBe('number')
    }
  })

  it('emits settlement event with isFullChain=true when all segments hit', () => {
    const mgr = createEventsManager()
    mgr.update(200)

    // 1-segment plant — 1 hit = full chain
    const letter = mgr.getLane(0).currentLetter
    mgr.onKeyDown(letter)

    const events = mgr.consumeEvents()
    const settlement = events.find(e => e.type === 'settlement')
    expect(settlement).toBeDefined()
    if (settlement?.type === 'settlement') {
      expect(settlement.isFullChain).toBe(true)
    }
  })
})
