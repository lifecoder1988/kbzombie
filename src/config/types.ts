export type Element = 'normal' | 'ice' | 'fire' | 'electric' | 'stun' | 'knockback'
export type Spread = 'single' | 'burst' | 'fan'
export type Flight = 'straight' | 'tracking'
export type Impact = 'vanish' | 'chain' | 'pierce' | 'explode'

export interface SynergyDef {
  readonly multiplier: Readonly<Record<number, number>>
}

/** 植物定义（字段名对齐 GAME_DESIGN.md 4.1） */
export interface PlantDef {
  readonly id: string
  readonly name: string
  readonly comboSegment: number   // 占据的连击段数
  readonly attackPower: number    // 基础攻击力
  readonly hp: number             // 血量上限
  readonly element: Element
  readonly spread: Spread
  readonly flight: Flight
  readonly impact: Impact
}

/** 僵尸定义（字段名对齐 GAME_DESIGN.md 5.1） */
export interface ZombieDef {
  readonly id: string
  readonly name: string
  readonly hp: number
  readonly speed: number          // 像素/秒
  readonly chewDps: number        // 啃植物每秒伤害
  readonly width: number
  readonly height: number
  readonly color: string
}

/** 混合出怪条目 */
export interface WaveZombieEntry {
  readonly type: string       // ZombieDef.id
  readonly weight: number     // 出现权重
}

/** 单波配置 */
export interface WaveDef {
  readonly count: number          // 本波僵尸数量
  readonly interval: number       // 生成间隔（毫秒）
  readonly zombieType?: string                    // 单类型（向后兼容）
  readonly zombies?: readonly WaveZombieEntry[]   // 混合出怪
}

/** 关卡配置 */
export interface LevelDef {
  readonly id: number
  readonly waves: readonly WaveDef[]
  readonly laneCount?: number                           // 路数（默认 1）
  readonly lanePlants?: readonly (readonly string[])[]  // 每路植物 ID，长度 = laneCount
}

/** 阶段配置 */
export interface StageDef {
  readonly id: number
  readonly name: string
  readonly letters: readonly string[]
  readonly plants: readonly string[]
  readonly levels: readonly LevelDef[]
}

/** 难度配置 */
export interface DifficultyDef {
  readonly missedLimit: number
  readonly zombieSpeedMultiplier: number
  readonly displayName: string
}

/** 效果参数定义 */
export interface EffectParamsDef {
  readonly burst: { readonly burstCount: number; readonly burstInterval: number }
  readonly fan: { readonly fanBulletCount: number; readonly fanSpreadAngle: number }
  readonly tracking: { readonly trackingTurnRate: number }
  readonly chain: { readonly chainBounces: number; readonly chainRange: number }
  readonly explode: { readonly explodeRadius: number; readonly explodeDamageRatio: number }
  readonly ice: { readonly slowRatio: number; readonly slowDuration: number }
  readonly fire: { readonly burnDps: number; readonly burnDuration: number }
  readonly electric: { readonly conductRadius: number; readonly conductDamageDecay: number; readonly conductMaxJumps: number }
  readonly stun: { readonly stunDuration: number }
  readonly knockback: { readonly knockbackDistance: number }
}

/** 称号规则（纯数据，判定逻辑在游戏层） */
export interface TitleRule {
  readonly id: string
  readonly name: string
  readonly requires: {
    readonly zeroMissed?: boolean
    readonly minLongestCombo?: number
    readonly minSynergyCount?: number
    readonly minFullChainCount?: number
  }
}

/** 结算配置 */
export interface SettlementConfig {
  readonly titleRules: readonly TitleRule[]
  readonly defaultVictoryTitle: string
  readonly encouragements: readonly string[]
}

/** 战斗通用参数 */
export interface BattleDef {
  readonly projectileSpeed: number
  readonly healAmount: number
  readonly wavePauseDuration: number
  readonly effectParams: EffectParamsDef
}
