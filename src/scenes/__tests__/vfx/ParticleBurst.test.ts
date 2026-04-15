import { describe, it, expect } from 'vitest'
import { ParticleBurst } from '../../vfx/ParticleBurst'

describe('ParticleBurst', () => {
  it('starts alive with particles', () => {
    const pb = new ParticleBurst()
    pb.init(100, 200, 10, '#ffd700', 0.5)
    expect(pb.alive).toBe(true)
  })

  it('dies after duration', () => {
    const pb = new ParticleBurst()
    pb.init(100, 200, 10, '#ffd700', 0.5)
    pb.update(0.5)
    expect(pb.alive).toBe(false)
  })

  it('zero particles = immediately dead', () => {
    const pb = new ParticleBurst()
    pb.init(100, 200, 0, '#ffd700', 0.5)
    expect(pb.alive).toBe(false)
  })

  it('reset restores alive', () => {
    const pb = new ParticleBurst()
    pb.init(100, 200, 10, '#ffd700', 0.5)
    pb.update(0.5)
    expect(pb.alive).toBe(false)
    pb.reset()
    expect(pb.alive).toBe(true)
  })
})
