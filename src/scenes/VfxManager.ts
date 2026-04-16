// Pre-allocated shake offset — returned by every getShakeOffset() call to avoid per-frame allocation
const shakeOffset = { x: 0, y: 0 }

export interface VfxObject {
  alive: boolean
  _poolType?: string  // set by acquire() for recycling
  update(dt: number): void
  render(ctx: CanvasRenderingContext2D): void
  reset(...args: unknown[]): void
}

export class VfxManager {
  private effects: VfxObject[] = []
  private readonly pool = new Map<string, VfxObject[]>()

  // Screen shake state
  private shakeIntensity = 0
  private shakeRemaining = 0
  private shakeDuration = 0

  spawn(effect: VfxObject): void {
    this.effects.push(effect)
  }

  acquire<T extends VfxObject>(type: string, factory: () => T): T {
    const bucket = this.pool.get(type)
    if (bucket && bucket.length > 0) {
      const obj = bucket.pop() as T
      obj.reset()
      return obj
    }
    const obj = factory()
    obj._poolType = type
    return obj
  }

  update(dt: number): void {
    // Clamp dt to prevent effects dying instantly on tab-switch spikes
    // Clamp dt to prevent effects dying instantly on tab-switch spikes
    const clampedDt = Math.min(dt, 0.1)

    // Update shake timer (uses raw dt — shake can finish instantly on resume)
    if (this.shakeRemaining > 0) {
      this.shakeRemaining -= dt
      if (this.shakeRemaining <= 0) {
        this.shakeRemaining = 0
        shakeOffset.x = 0
        shakeOffset.y = 0
      } else {
        const decay = this.shakeRemaining / this.shakeDuration
        const magnitude = this.shakeIntensity * decay
        shakeOffset.x = Math.round((Math.random() * 2 - 1) * magnitude)
        shakeOffset.y = Math.round((Math.random() * 2 - 1) * magnitude)
      }
    }

    // Update effects and compact array in-place (no splice/filter)
    let writeIdx = 0
    for (let readIdx = 0; readIdx < this.effects.length; readIdx++) {
      const fx = this.effects[readIdx]
      fx.update(clampedDt)
      if (fx.alive) {
        this.effects[writeIdx] = fx
        writeIdx++
      } else {
        // Recycle dead effects back into pool
        if (fx._poolType !== undefined) {
          let bucket = this.pool.get(fx._poolType)
          if (bucket === undefined) {
            bucket = []
            this.pool.set(fx._poolType, bucket)
          }
          bucket.push(fx)
        }
      }
    }
    this.effects.length = writeIdx
  }

  render(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < this.effects.length; i++) {
      const fx = this.effects[i]
      fx.render(ctx)
    }
  }

  shake(intensity: number, duration: number): void {
    // Multiple shakes: take max intensity and max remaining time
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity)
    this.shakeRemaining = Math.max(this.shakeRemaining, duration)
    // Update duration to match remaining when we extend shake time
    if (duration > this.shakeDuration) {
      this.shakeDuration = duration
    }
  }

  getShakeOffset(): { readonly x: number; readonly y: number } {
    return shakeOffset
  }

  clear(): void {
    // Recycle all active effects back into pool, then clear
    for (let i = 0; i < this.effects.length; i++) {
      const fx = this.effects[i]
      if (fx._poolType !== undefined) {
        let bucket = this.pool.get(fx._poolType)
        if (bucket === undefined) {
          bucket = []
          this.pool.set(fx._poolType, bucket)
        }
        bucket.push(fx)
      }
    }
    this.effects.length = 0

    // Reset shake
    this.shakeIntensity = 0
    this.shakeRemaining = 0
    this.shakeDuration = 0
    shakeOffset.x = 0
    shakeOffset.y = 0
  }
}
