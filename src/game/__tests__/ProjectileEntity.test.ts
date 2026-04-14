import { describe, it, expect } from 'vitest'
import { ProjectileEntity } from '../ProjectileEntity'

describe('ProjectileEntity', () => {
  it('向右匀速飞行', () => {
    const p = new ProjectileEntity('p-1', 100, 200, 500, 30, 1000)
    p.update(1000)
    expect(p.x).toBe(600) // 100 + 500*1
  })

  it('飞出右边界后自动消失', () => {
    const p = new ProjectileEntity('p-1', 900, 200, 500, 30, 1000)
    p.update(1000)
    expect(p.active).toBe(false)
  })

  it('命中后标记不活跃', () => {
    const p = new ProjectileEntity('p-1', 100, 200, 500, 30, 1000)
    p.onHit()
    expect(p.active).toBe(false)
  })

  it('携带攻击力信息', () => {
    const p = new ProjectileEntity('p-1', 100, 200, 500, 30, 1000)
    expect(p.power).toBe(30)
  })
})
