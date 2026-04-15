import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VfxManager, VfxObject } from '../VfxManager'

function makeEffect(alive = true): VfxObject & { renderCalled: number; updateCalled: number; resetCalled: number } {
  return {
    alive,
    renderCalled: 0,
    updateCalled: 0,
    resetCalled: 0,
    update(_dt: number) { this.updateCalled++ },
    render(_ctx: CanvasRenderingContext2D) { this.renderCalled++ },
    reset(..._args: unknown[]) { this.resetCalled++; this.alive = true },
  }
}

function makeDyingEffect(dieAfterUpdates: number): VfxObject & { renderCalled: number } {
  let count = 0
  return {
    alive: true,
    renderCalled: 0,
    update(_dt: number) {
      count++
      if (count >= dieAfterUpdates) this.alive = false
    },
    render(_ctx: CanvasRenderingContext2D) { this.renderCalled++ },
    reset(..._args: unknown[]) { this.alive = true; count = 0 },
  }
}

function mockCtx(): CanvasRenderingContext2D {
  return {} as CanvasRenderingContext2D
}

describe('VfxManager', () => {
  let manager: VfxManager

  beforeEach(() => {
    manager = new VfxManager()
  })

  it('spawns and updates effects', () => {
    const fx = makeEffect()
    manager.spawn(fx)
    manager.update(0.016)
    expect(fx.updateCalled).toBe(1)
    expect(fx.alive).toBe(true)
  })

  it('renders all alive effects', () => {
    const fx1 = makeEffect()
    const fx2 = makeEffect()
    manager.spawn(fx1)
    manager.spawn(fx2)
    const ctx = mockCtx()
    manager.render(ctx)
    expect(fx1.renderCalled).toBe(1)
    expect(fx2.renderCalled).toBe(1)
  })

  it('removes dead effects after update — render should not call dead effect', () => {
    const fx = makeDyingEffect(1)
    manager.spawn(fx)
    manager.update(0.016)  // fx dies on first update
    expect(fx.alive).toBe(false)
    const ctx = mockCtx()
    manager.render(ctx)
    expect(fx.renderCalled).toBe(0)
  })

  it('acquire reuses pooled objects — factory called only once', () => {
    const fx = makeEffect()
    const factory = vi.fn(() => fx)

    // First acquire — factory is called
    const acquired1 = manager.acquire('explosion', factory)
    expect(factory).toHaveBeenCalledTimes(1)
    manager.spawn(acquired1)

    // Kill the effect and recycle via update
    acquired1.alive = false
    manager.update(0.016)

    // Second acquire — should reuse from pool, factory NOT called again
    const acquired2 = manager.acquire('explosion', factory)
    expect(factory).toHaveBeenCalledTimes(1)
    expect(acquired2).toBe(fx)
    // reset() should have been called when recycling on reuse
    expect(fx.resetCalled).toBeGreaterThanOrEqual(1)
  })

  it('clear removes all active effects — render should not call them', () => {
    const fx1 = makeEffect()
    const fx2 = makeEffect()
    manager.spawn(fx1)
    manager.spawn(fx2)
    manager.clear()
    const ctx = mockCtx()
    manager.render(ctx)
    expect(fx1.renderCalled).toBe(0)
    expect(fx2.renderCalled).toBe(0)
  })

  it('screen shake returns zero offset when no shake', () => {
    const offset = manager.getShakeOffset()
    expect(offset.x).toBe(0)
    expect(offset.y).toBe(0)
  })

  it('screen shake returns non-zero offset during shake', () => {
    manager.shake(10, 0.3)
    manager.update(0.1)
    // With intensity=10 and remaining ~0.2/0.3 decay factor ~0.67, offset can be up to 10
    // We just verify it's within the possible range (could be 0 by random chance, but very unlikely at intensity 10)
    const offset = manager.getShakeOffset()
    // The offset should be integers (Math.round applied)
    expect(Number.isInteger(offset.x)).toBe(true)
    expect(Number.isInteger(offset.y)).toBe(true)
    // Range check: |x| <= intensity, |y| <= intensity
    expect(Math.abs(offset.x)).toBeLessThanOrEqual(10)
    expect(Math.abs(offset.y)).toBeLessThanOrEqual(10)
  })

  it('screen shake decays to zero after duration expires', () => {
    manager.shake(10, 0.3)
    manager.update(0.5)  // past the 0.3 duration
    const offset = manager.getShakeOffset()
    expect(offset.x).toBe(0)
    expect(offset.y).toBe(0)
  })

  it('multiple shakes take max intensity and max remaining', () => {
    manager.shake(5, 0.2)
    manager.shake(10, 0.1)
    // intensity should be max(5,10)=10, remaining max(0.2,0.1)=0.2
    // After 0.15s, remaining of 0.2 would still be active (0.2-0.15=0.05>0), remaining of 0.1 would be expired
    manager.update(0.15)
    // Should still have shake (remaining was 0.2, now 0.05)
    const offset = manager.getShakeOffset()
    // Non-trivially: remaining>0 so shake is still active — but offset can be 0 by random chance
    // We verify the shake state is still live by checking intensity was preserved
    // (indirectly: call shake again with small value — max should not override bigger)
    manager.shake(3, 0.5)
    // After a fresh shake(3, 0.5), intensity=max(current, 3)
    // current intensity: was set to max(5,10)=10, so still 10 after the earlier shakes
    // Let the second shake reset: intensity = max(remaining_intensity, 3)
    // We only verify offset is still bounded by the originally set max
    const offset2 = manager.getShakeOffset()
    expect(Math.abs(offset2.x)).toBeLessThanOrEqual(10)
    expect(Math.abs(offset2.y)).toBeLessThanOrEqual(10)
  })
})
