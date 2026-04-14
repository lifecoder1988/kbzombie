export interface ComboSettlement {
  readonly comboCount: number
  readonly isFullChain: boolean
}

export class ComboSystem {
  private _current = 0
  private readonly totalSegments: number

  constructor(segments: readonly number[]) {
    this.totalSegments = segments.reduce((sum, s) => sum + s, 0)
  }

  get current(): number {
    return this._current
  }

  hit(): ComboSettlement | null {
    this._current++
    if (this._current >= this.totalSegments) {
      return this.doSettle(true)
    }
    return null
  }

  miss(): ComboSettlement | null {
    if (this._current === 0) return null
    return this.doSettle(false)
  }

  settle(): ComboSettlement | null {
    if (this._current === 0) return null
    return this.doSettle(false)
  }

  reset(): void {
    this._current = 0
  }

  private doSettle(isFullChain: boolean): ComboSettlement {
    const comboCount = this._current
    this._current = 0
    return { comboCount, isFullChain }
  }
}
