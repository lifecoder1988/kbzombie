import type { BattleDef } from './types'

export const BATTLE_PARAMS: BattleDef = {
  projectileSpeed: 500,
  healAmount: 30,
  wavePauseDuration: 3000,
  areaBulletCount: 5,
  areaSpreadAngle: Math.PI / 3,
  areaDamageDecay: 1.0,
  trackingTurnRate: Math.PI,
}
