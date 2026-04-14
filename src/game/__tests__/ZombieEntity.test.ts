import { describe, it, expect } from 'vitest'
import { ZombieEntity } from '../ZombieEntity'
import { ZombieState } from '../types'

describe('ZombieEntity', () => {
  it('初始状态为 Walking', () => {
    const z = new ZombieEntity('z-1', 800, 100, 50, 30, 10)
    expect(z.state).toBe(ZombieState.Walking)
    expect(z.active).toBe(true)
  })

  it('向左匀速移动', () => {
    const z = new ZombieEntity('z-1', 800, 100, 50, 30, 10)
    z.update(1000)
    expect(z.x).toBe(770) // 800 - 30*1
  })

  it('到达目标 x 后开始啃植物', () => {
    const z = new ZombieEntity('z-1', 500, 100, 50, 30, 10)
    z.setChewTarget(480)
    z.update(1000)
    expect(z.state).toBe(ZombieState.Chewing)
    expect(z.x).toBe(480)
  })

  it('啃植物时不移动', () => {
    const z = new ZombieEntity('z-1', 490, 100, 50, 30, 10)
    z.setChewTarget(480)
    z.update(1000)
    const xAfterChew = z.x
    z.update(1000)
    expect(z.x).toBe(xAfterChew)
  })

  it('受到伤害扣血', () => {
    const z = new ZombieEntity('z-1', 800, 100, 50, 30, 10)
    z.takeDamage(20)
    expect(z.currentHp).toBe(30)
  })

  it('血量归零时死亡', () => {
    const z = new ZombieEntity('z-1', 800, 100, 50, 30, 10)
    z.takeDamage(50)
    expect(z.state).toBe(ZombieState.Dead)
    expect(z.active).toBe(false)
  })

  it('超杀不产生负血量', () => {
    const z = new ZombieEntity('z-1', 800, 100, 50, 30, 10)
    z.takeDamage(999)
    expect(z.currentHp).toBe(0)
  })

  it('啃食时返回 DPS 伤害量', () => {
    const z = new ZombieEntity('z-1', 490, 100, 50, 30, 10)
    z.setChewTarget(480)
    z.update(500) // 到达
    const damage = z.getChewDamage(1000)
    expect(damage).toBe(10) // chewDps=10, 1秒
  })

  it('啃完当前植物后继续前进', () => {
    const z = new ZombieEntity('z-1', 490, 100, 50, 30, 10)
    z.setChewTarget(480)
    z.update(1000)
    expect(z.state).toBe(ZombieState.Chewing)
    z.clearChewTarget()
    expect(z.state).toBe(ZombieState.Walking)
    z.update(1000)
    expect(z.x).toBe(450) // 480 - 30*1
  })

  describe('status effects', () => {
    it('slow reduces movement speed', () => {
      const z = new ZombieEntity('z1', 500, 100, 100, 100, 10)
      z.setChewTarget(0)
      z.applyStatus({ type: 'slow', remaining: 2, value: 0.5 })
      z.update(1000) // 1 second
      // Normal: 500 - 100*1 = 400. With 50% slow: 500 - 100*0.5*1 = 450
      expect(z.x).toBeCloseTo(450)
    })

    it('slow reduces chew damage', () => {
      const z = new ZombieEntity('z1', 100, 100, 100, 100, 20)
      z.setChewTarget(100) // already at target
      z.update(1) // trigger chewing state
      z.applyStatus({ type: 'slow', remaining: 2, value: 0.5 })
      const dmg = z.getChewDamage(1000)
      expect(dmg).toBeCloseTo(10) // 20 * 0.5
    })

    it('burn deals damage over time', () => {
      const z = new ZombieEntity('z1', 500, 100, 100, 100, 10)
      z.applyStatus({ type: 'burn', remaining: 3, value: 10 }) // 10 DPS
      z.update(1000)
      expect(z.currentHp).toBe(90) // 100 - 10
    })

    it('burn can kill zombie', () => {
      const z = new ZombieEntity('z1', 500, 100, 15, 100, 10)
      z.applyStatus({ type: 'burn', remaining: 3, value: 10 })
      z.update(2000) // 2 seconds = 20 damage on 15 HP
      expect(z.active).toBe(false)
    })

    it('stun stops movement', () => {
      const z = new ZombieEntity('z1', 500, 100, 100, 100, 10)
      z.setChewTarget(0)
      z.applyStatus({ type: 'stun', remaining: 2, value: 0 })
      const xBefore = z.x
      z.update(1000)
      expect(z.x).toBe(xBefore)
    })

    it('stun stops chewing', () => {
      const z = new ZombieEntity('z1', 100, 100, 100, 100, 20)
      z.setChewTarget(100)
      z.update(1) // trigger chewing state
      z.applyStatus({ type: 'stun', remaining: 2, value: 0 })
      expect(z.getChewDamage(1000)).toBe(0)
    })

    it('status expires after remaining time', () => {
      const z = new ZombieEntity('z1', 500, 100, 100, 100, 10)
      z.setChewTarget(0)
      z.applyStatus({ type: 'slow', remaining: 0.5, value: 0.5 })
      z.update(600) // 0.6 seconds — slow expires during this update
      // Implementation note: status is checked at start of frame, so full 0.6s is slowed
      // With slow for full frame: x = 500 - 100*0.5*0.6 = 470
      const xAfterFirst = z.x
      z.update(1000) // next second — slow should be expired now
      expect(z.x).toBeCloseTo(xAfterFirst - 100) // full speed
    })

    it('same type status refreshes remaining', () => {
      const z = new ZombieEntity('z1', 500, 100, 100, 100, 10)
      z.applyStatus({ type: 'slow', remaining: 1, value: 0.5 })
      z.update(500) // 0.5s
      z.applyStatus({ type: 'slow', remaining: 1, value: 0.5 }) // refresh
      z.update(800) // 0.8s — within refreshed 1s
      expect(z.hasStatus('slow')).toBe(true)
    })

    it('different statuses coexist', () => {
      const z = new ZombieEntity('z1', 500, 100, 100, 100, 10)
      z.applyStatus({ type: 'slow', remaining: 2, value: 0.5 })
      z.applyStatus({ type: 'burn', remaining: 2, value: 10 })
      expect(z.hasStatus('slow')).toBe(true)
      expect(z.hasStatus('burn')).toBe(true)
    })

    it('knockback shifts position right', () => {
      const z = new ZombieEntity('z1', 300, 100, 100, 100, 10)
      z.applyKnockback(50, 800)
      expect(z.x).toBe(350)
    })

    it('knockback clamps to right bound', () => {
      const z = new ZombieEntity('z1', 780, 100, 100, 100, 10)
      z.applyKnockback(50, 800)
      expect(z.x).toBe(800)
    })
  })
})
