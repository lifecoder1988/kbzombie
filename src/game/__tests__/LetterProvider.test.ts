import { describe, it, expect } from 'vitest'
import { LetterProvider } from '../LetterProvider'

describe('LetterProvider', () => {
  it('返回字母池中的字母', () => {
    const pool = ['f', 'j', 'd', 'k']
    const provider = new LetterProvider(pool)
    for (let i = 0; i < 20; i++) {
      const letter = provider.next()
      expect(pool).toContain(letter)
    }
  })

  it('传入固定种子时结果可复现', () => {
    const pool = ['f', 'j', 'd', 'k']
    const a = new LetterProvider(pool, 42)
    const b = new LetterProvider(pool, 42)
    for (let i = 0; i < 10; i++) {
      expect(a.next()).toBe(b.next())
    }
  })

  it('不同种子产生不同序列', () => {
    const pool = ['f', 'j', 'd', 'k', 's', 'l', 'a']
    const a = new LetterProvider(pool, 1)
    const b = new LetterProvider(pool, 999)
    const seqA = Array.from({ length: 10 }, () => a.next())
    const seqB = Array.from({ length: 10 }, () => b.next())
    expect(seqA).not.toEqual(seqB)
  })
})
