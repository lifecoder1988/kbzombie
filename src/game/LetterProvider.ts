function mulberry32(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class LetterProvider {
  private readonly pool: readonly string[]
  private readonly random: () => number

  constructor(pool: readonly string[], seed?: number) {
    this.pool = pool
    this.random = seed !== undefined ? mulberry32(seed) : Math.random.bind(Math)
  }

  next(): string {
    const index = Math.floor(this.random() * this.pool.length)
    return this.pool[index]
  }

  nextExcluding(exclude: readonly string[]): string {
    if (exclude.length === 0 || exclude.length >= this.pool.length) {
      return this.next()
    }
    const maxAttempts = this.pool.length * 2
    for (let i = 0; i < maxAttempts; i++) {
      const letter = this.next()
      if (!exclude.includes(letter)) return letter
    }
    return this.next() // 降级
  }
}
