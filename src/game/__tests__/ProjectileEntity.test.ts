import { describe, it, expect } from 'vitest'
import { ProjectileEntity } from '../ProjectileEntity'
import type { ProjectileConfig } from '../ProjectileEntity'

function makeConfig(overrides: Partial<ProjectileConfig> = {}): ProjectileConfig {
  return {
    id: 'p-1',
    x: 100,
    y: 200,
    speed: 500,
    power: 30,
    rightBound: 1000,
    element: 'normal',
    spread: 'single',
    flight: 'straight',
    impact: 'vanish',
    ...overrides,
  }
}

describe('ProjectileEntity', () => {
  describe('flight: straight', () => {
    it('水平匀速向右飞行', () => {
      const p = new ProjectileEntity(makeConfig())
      p.update(1000)
      expect(p.x).toBe(600) // 100 + 500*1
      expect(p.y).toBe(200)
    })

    it('飞出右边界后自动消失', () => {
      const p = new ProjectileEntity(makeConfig({ x: 900 }))
      p.update(1000)
      expect(p.active).toBe(false)
    })

    it('携带攻击力信息', () => {
      const p = new ProjectileEntity(makeConfig())
      expect(p.power).toBe(30)
    })
  })

  describe('flight: straight with angle', () => {
    it('按指定角度飞行', () => {
      const angle = Math.PI / 6 // 30°
      const p = new ProjectileEntity(makeConfig({ flight: 'straight', angle }))
      p.update(1000)
      expect(p.x).toBeCloseTo(100 + 500 * Math.cos(angle), 0)
      expect(p.y).toBeCloseTo(200 + 500 * Math.sin(angle), 0)
    })

    it('angle=0 时等同水平直射', () => {
      const p = new ProjectileEntity(makeConfig({ flight: 'straight', angle: 0 }))
      p.update(1000)
      expect(p.x).toBe(600)
      expect(p.y).toBe(200)
    })

    it('飞出边界消失（y 超出合理范围）', () => {
      const angle = Math.PI / 2 // 向下 90°
      const p = new ProjectileEntity(makeConfig({ flight: 'straight', angle, rightBound: 2000 }))
      p.update(5000) // 飞很远
      expect(p.active).toBe(false)
    })
  })

  describe('flight: tracking', () => {
    it('朝目标方向飞行', () => {
      const target = { x: 500, y: 200 } // 正右方
      const p = new ProjectileEntity(makeConfig({
        flight: 'tracking',
        target,
        maxTurnRate: Math.PI,
      }))
      p.update(1000)
      expect(p.x).toBeGreaterThan(100)
      expect(p.y).toBeCloseTo(200, 0)
    })

    it('目标在上方时向上偏转', () => {
      const target = { x: 500, y: 0 } // 右上方
      const p = new ProjectileEntity(makeConfig({
        flight: 'tracking',
        target,
        maxTurnRate: Math.PI * 4,
      }))
      p.update(1000)
      expect(p.y).toBeLessThan(200)
    })

    it('目标死亡后沿惯性飞行（方向不变）', () => {
      const target = { x: 500, y: 200, active: false }
      const p = new ProjectileEntity(makeConfig({
        flight: 'tracking',
        target,
        maxTurnRate: Math.PI,
      }))
      p.update(500)
      const x1 = p.x
      const y1 = p.y
      p.update(500)
      const x2 = p.x
      const y2 = p.y
      // Should move in straight line (same direction both intervals)
      const dx1 = x1 - 100
      const dy1 = y1 - 200
      const dx2 = x2 - x1
      const dy2 = y2 - y1
      // Direction vectors should be parallel (same angle)
      if (dx1 !== 0) {
        expect(dy2 / dx2).toBeCloseTo(dy1 / dx1, 1)
      }
    })
  })

  describe('impact: vanish', () => {
    it('命中后立即消失', () => {
      const p = new ProjectileEntity(makeConfig({ impact: 'vanish' }))
      p.onHit('z-1')
      expect(p.active).toBe(false)
    })
  })

  describe('impact: pierce', () => {
    it('命中后不消失，继续飞行', () => {
      const p = new ProjectileEntity(makeConfig({ impact: 'pierce' }))
      p.onHit('z-1')
      expect(p.active).toBe(true)
    })

    it('记录已命中的僵尸', () => {
      const p = new ProjectileEntity(makeConfig({ impact: 'pierce' }))
      p.onHit('z-1')
      expect(p.hasHit('z-1')).toBe(true)
      expect(p.hasHit('z-2')).toBe(false)
    })

    it('命中多只不同僵尸', () => {
      const p = new ProjectileEntity(makeConfig({ impact: 'pierce' }))
      p.onHit('z-1')
      p.onHit('z-2')
      expect(p.active).toBe(true)
      expect(p.hasHit('z-1')).toBe(true)
      expect(p.hasHit('z-2')).toBe(true)
    })

    it('飞出右边界消失', () => {
      const p = new ProjectileEntity(makeConfig({ impact: 'pierce', x: 900 }))
      p.update(1000)
      expect(p.active).toBe(false)
    })
  })

  describe('impact: chain', () => {
    it('命中后记录 hitSet，设置 needsRedirect', () => {
      const p = new ProjectileEntity(makeConfig({ impact: 'chain', chainBounces: 2, chainRange: 150 }))
      p.onHit('z-1')
      expect(p.hasHit('z-1')).toBe(true)
      expect(p.needsRedirect).toBe(true)
      expect(p.bounceCount).toBe(1)
    })

    it('bounceCount 达到 maxBounces 时消失', () => {
      const p = new ProjectileEntity(makeConfig({ impact: 'chain', chainBounces: 2, chainRange: 150 }))
      p.onHit('z-1')
      p.redirectTo(300, 200)
      p.onHit('z-2')
      expect(p.active).toBe(false)
    })

    it('redirectTo 更新方向并清除 needsRedirect', () => {
      const p = new ProjectileEntity(makeConfig({ impact: 'chain', chainBounces: 3, chainRange: 150 }))
      p.onHit('z-1')
      expect(p.needsRedirect).toBe(true)
      p.redirectTo(500, 200)
      expect(p.needsRedirect).toBe(false)
    })

    it('clearRedirect 清除 needsRedirect 标志', () => {
      const p = new ProjectileEntity(makeConfig({ impact: 'chain', chainBounces: 3, chainRange: 150 }))
      p.onHit('z-1')
      p.clearRedirect()
      expect(p.needsRedirect).toBe(false)
    })

    it('chainRange 可读取', () => {
      const p = new ProjectileEntity(makeConfig({ impact: 'chain', chainBounces: 2, chainRange: 200 }))
      expect(p.chainRange).toBe(200)
    })
  })

  describe('impact: explode', () => {
    it('命中后立即消失（BattleManager 处理面积伤害）', () => {
      const p = new ProjectileEntity(makeConfig({ impact: 'explode' }))
      p.onHit('z-1')
      expect(p.active).toBe(false)
    })
  })

  describe('element 属性', () => {
    it('element 为 normal', () => {
      const p = new ProjectileEntity(makeConfig({ element: 'normal' }))
      expect(p.element).toBe('normal')
    })

    it('element 为 ice', () => {
      const p = new ProjectileEntity(makeConfig({ element: 'ice' }))
      expect(p.element).toBe('ice')
    })

    it('element 为 fire', () => {
      const p = new ProjectileEntity(makeConfig({ element: 'fire' }))
      expect(p.element).toBe('fire')
    })

    it('element 为 electric', () => {
      const p = new ProjectileEntity(makeConfig({ element: 'electric' }))
      expect(p.element).toBe('electric')
    })

    it('element 为 stun', () => {
      const p = new ProjectileEntity(makeConfig({ element: 'stun' }))
      expect(p.element).toBe('stun')
    })

    it('element 为 knockback', () => {
      const p = new ProjectileEntity(makeConfig({ element: 'knockback' }))
      expect(p.element).toBe('knockback')
    })
  })

  describe('spread 属性', () => {
    it('存储 spread 值（BattleManager 使用）', () => {
      const p = new ProjectileEntity(makeConfig({ spread: 'fan' }))
      expect(p.spread).toBe('fan')
    })
  })
})
