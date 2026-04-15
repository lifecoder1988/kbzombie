import { describe, it, expect } from 'vitest'
import { FlashPulse } from '../../vfx/FlashPulse'

describe('FlashPulse', () => {
  it('starts alive after init', () => {
    const fp = new FlashPulse()
    fp.init(100, 200, 20, 80, 0.4, '#ffffff', 0.3)
    expect(fp.alive).toBe(true)
  })

  it('dies after duration', () => {
    const fp = new FlashPulse()
    fp.init(100, 200, 20, 80, 0.4, '#ffffff', 0.3)
    fp.update(0.3)
    expect(fp.alive).toBe(false)
  })

  it('reset restores alive', () => {
    const fp = new FlashPulse()
    fp.init(100, 200, 20, 80, 0.4, '#ffffff', 0.3)
    fp.update(0.3)
    expect(fp.alive).toBe(false)
    fp.reset()
    expect(fp.alive).toBe(true)
  })
})
