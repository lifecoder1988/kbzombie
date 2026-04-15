import { describe, it, expect } from 'vitest'
import { DeathFlyout } from '../../vfx/DeathFlyout'

describe('DeathFlyout', () => {
  it('starts alive after init', () => {
    const df = new DeathFlyout()
    df.init(100, 200, 40, 60, '#44cc44')
    expect(df.alive).toBe(true)
  })

  it('dies after 0.5s', () => {
    const df = new DeathFlyout()
    df.init(100, 200, 40, 60, '#44cc44')
    df.update(0.5)
    expect(df.alive).toBe(false)
  })

  it('reset restores alive', () => {
    const df = new DeathFlyout()
    df.init(100, 200, 40, 60, '#44cc44')
    df.update(0.5)
    expect(df.alive).toBe(false)
    df.reset()
    expect(df.alive).toBe(true)
  })
})
