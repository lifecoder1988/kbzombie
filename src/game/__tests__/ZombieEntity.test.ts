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
})
