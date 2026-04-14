import type { BattleDef } from './types'

export const BATTLE_PARAMS: BattleDef = {
  projectileSpeed: 500,
  healAmount: 30,
  wavePauseDuration: 3000,
  effectParams: {
    burst: { burstCount: 3, burstInterval: 80 },
    fan: { fanBulletCount: 5, fanSpreadAngle: Math.PI / 3 },
    tracking: { trackingTurnRate: Math.PI / 3 },
    chain: { chainBounces: 3, chainRange: 200 },
    explode: { explodeRadius: 80, explodeDamageRatio: 0.6 },
    ice: { slowRatio: 0.5, slowDuration: 3 },
    fire: { burnDps: 5, burnDuration: 3 },
    electric: { conductRadius: 100, conductDamageDecay: 0.7, conductMaxJumps: 3 },
    stun: { stunDuration: 1.5 },
    knockback: { knockbackDistance: 60 },
  },
}
