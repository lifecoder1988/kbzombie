import { describe, it, expect } from 'vitest'
import { LetterPop } from '../../vfx/LetterPop'

describe('LetterPop', () => {
  function makeLetterPop(): LetterPop {
    const lp = new LetterPop()
    lp.init(100, 200, 'A', '#ffd700', 20, 0.3, 2.0)
    return lp
  }

  it('starts alive after init', () => {
    const lp = makeLetterPop()
    expect(lp.alive).toBe(true)
  })

  it('dies after duration', () => {
    const lp = makeLetterPop()
    lp.update(0.3)
    expect(lp.alive).toBe(false)
  })

  it('scale increases over time — verify still alive at halfway', () => {
    const lp = makeLetterPop()
    lp.update(0.15) // halfway through duration
    expect(lp.alive).toBe(true)
  })

  it('reset restores to alive state', () => {
    const lp = makeLetterPop()
    lp.update(0.3) // kill it
    expect(lp.alive).toBe(false)
    lp.reset()
    expect(lp.alive).toBe(true)
  })
})
