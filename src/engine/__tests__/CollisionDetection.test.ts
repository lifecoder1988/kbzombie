// src/engine/__tests__/CollisionDetection.test.ts
import { describe, it, expect } from 'vitest'
import { intersects } from '../CollisionDetection'

describe('intersects', () => {
  it('两矩形明显重叠返回 true', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 }
    const b = { x: 5, y: 5, width: 10, height: 10 }
    expect(intersects(a, b)).toBe(true)
  })

  it('一个矩形完全包含另一个返回 true', () => {
    const outer = { x: 0, y: 0, width: 100, height: 100 }
    const inner = { x: 10, y: 10, width: 5, height: 5 }
    expect(intersects(outer, inner)).toBe(true)
    expect(intersects(inner, outer)).toBe(true)
  })

  it('X 轴分离返回 false', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 }
    const b = { x: 20, y: 0, width: 10, height: 10 }
    expect(intersects(a, b)).toBe(false)
  })

  it('Y 轴分离返回 false', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 }
    const b = { x: 0, y: 20, width: 10, height: 10 }
    expect(intersects(a, b)).toBe(false)
  })

  it('边界恰好接触返回 false（开区间）', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 }
    const right = { x: 10, y: 0, width: 10, height: 10 }
    const bottom = { x: 0, y: 10, width: 10, height: 10 }
    expect(intersects(a, right)).toBe(false)
    expect(intersects(a, bottom)).toBe(false)
  })

  it('零面积矩形返回 false', () => {
    const normal = { x: 0, y: 0, width: 10, height: 10 }
    const zeroWidth = { x: 5, y: 5, width: 0, height: 10 }
    const zeroHeight = { x: 5, y: 5, width: 10, height: 0 }
    expect(intersects(normal, zeroWidth)).toBe(false)
    expect(intersects(zeroWidth, normal)).toBe(false)
    expect(intersects(normal, zeroHeight)).toBe(false)
  })

  it('负面积矩形返回 false', () => {
    const normal = { x: 0, y: 0, width: 10, height: 10 }
    const negative = { x: 5, y: 5, width: -5, height: 10 }
    expect(intersects(normal, negative)).toBe(false)
  })

  it('对称性：intersects(a,b) === intersects(b,a)', () => {
    const a = { x: 3, y: 7, width: 12, height: 8 }
    const b = { x: 10, y: 10, width: 15, height: 15 }
    expect(intersects(a, b)).toBe(intersects(b, a))
  })
})
