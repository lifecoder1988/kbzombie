import { describe, it, expect } from 'vitest'
import { FullScreenFlash } from '../../vfx/FullScreenFlash'

describe('FullScreenFlash', () => {
  it('starts alive after init', () => {
    const fsf = new FullScreenFlash()
    fsf.init('#ffd700', 0.3, 0.15)
    expect(fsf.alive).toBe(true)
  })

  it('dies after duration', () => {
    const fsf = new FullScreenFlash()
    fsf.init('#ffd700', 0.3, 0.15)
    fsf.update(0.15)
    expect(fsf.alive).toBe(false)
  })

  it('reset restores alive', () => {
    const fsf = new FullScreenFlash()
    fsf.init('#ffd700', 0.3, 0.15)
    fsf.update(0.15)
    expect(fsf.alive).toBe(false)
    fsf.reset()
    expect(fsf.alive).toBe(true)
  })
})
