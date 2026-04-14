import type { Element, Spread, Flight, Impact, SynthesizedEffect } from './types'

const ELEMENT_PRIORITY: Record<Element, number> = {
  normal: 0, ice: 1, fire: 1, electric: 2, stun: 3, knockback: 4,
}

const SPREAD_PRIORITY: Record<Spread, number> = { single: 0, burst: 1, fan: 2 }
const FLIGHT_PRIORITY: Record<Flight, number> = { straight: 0, tracking: 1 }
const IMPACT_PRIORITY: Record<Impact, number> = { vanish: 0, chain: 1, pierce: 2, explode: 3 }

const SPREAD_BY_PRIORITY: Spread[] = ['single', 'burst', 'fan']
const FLIGHT_BY_PRIORITY: Flight[] = ['straight', 'tracking']
const IMPACT_BY_PRIORITY: Impact[] = ['vanish', 'chain', 'pierce', 'explode']

export function synthesizeEffects(
  plants: readonly { element: Element; spread: Spread; flight: Flight; impact: Impact }[],
): SynthesizedEffect {
  if (plants.length === 0) {
    return { element: 'normal', spread: 'single', flight: 'straight', impact: 'vanish' }
  }

  let hasIce = false
  let hasFire = false
  let maxSpreadPriority = 0
  let maxFlightPriority = 0
  let maxImpactPriority = 0

  for (let i = 0; i < plants.length; i++) {
    const p = plants[i]
    if (p.element === 'ice') hasIce = true
    if (p.element === 'fire') hasFire = true
    const sp = SPREAD_PRIORITY[p.spread]
    if (sp > maxSpreadPriority) maxSpreadPriority = sp
    const fp = FLIGHT_PRIORITY[p.flight]
    if (fp > maxFlightPriority) maxFlightPriority = fp
    const ip = IMPACT_PRIORITY[p.impact]
    if (ip > maxImpactPriority) maxImpactPriority = ip
  }

  // Element: ice+fire cancel, then take highest
  const cancelIceFire = hasIce && hasFire
  let maxElementPriority = 0
  let maxElement: Element = 'normal'
  for (let i = 0; i < plants.length; i++) {
    const el = plants[i].element
    if (cancelIceFire && (el === 'ice' || el === 'fire')) continue
    const ep = ELEMENT_PRIORITY[el]
    if (ep > maxElementPriority) {
      maxElementPriority = ep
      maxElement = el
    }
  }

  return {
    element: maxElement,
    spread: SPREAD_BY_PRIORITY[maxSpreadPriority],
    flight: FLIGHT_BY_PRIORITY[maxFlightPriority],
    impact: IMPACT_BY_PRIORITY[maxImpactPriority],
  }
}
