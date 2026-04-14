export type Element = 'normal' | 'ice' | 'fire' | 'electric' | 'stun' | 'knockback'
export type Spread = 'single' | 'burst' | 'fan'
export type Flight = 'straight' | 'tracking'
export type Impact = 'vanish' | 'chain' | 'pierce' | 'explode'

export interface SynthesizedEffect {
  readonly element: Element
  readonly spread: Spread
  readonly flight: Flight
  readonly impact: Impact
}

/** 植物配置（硬编码，阶段三再抽配置文件） */
export interface PlantConfig {
  readonly id: string
  readonly name: string
  readonly comboSegment: number
  readonly attackPower: number
  readonly hp: number
  readonly element: Element
  readonly spread: Spread
  readonly flight: Flight
  readonly impact: Impact
}

/** 植物运行时状态 */
export interface PlantState {
  readonly config: PlantConfig
  currentHp: number
  alive: boolean
  /** 链条中的索引（0 = 最左/最弱） */
  readonly chainIndex: number
}

/** 僵尸配置 */
export interface ZombieConfig {
  readonly hp: number
  readonly speed: number       // 像素/秒
  readonly chewDps: number     // 啃植物每秒伤害
  readonly width: number
  readonly height: number
  readonly color: string
}

/** 波次配置 */
export interface WaveConfig {
  readonly zombieType: string  // 僵尸类型 id
  readonly count: number       // 本波僵尸数量
  readonly interval: number    // 生成间隔（毫秒）
}

/** 结算结果 */
export interface SettlementResult {
  /** 总攻击力（已激活存活植物攻击力之和） */
  readonly totalPower: number
  /** 已激活的植物索引列表 */
  readonly activatedIndices: readonly number[]
  /** 已激活且存活的植物索引列表（实际贡献攻击的） */
  readonly aliveActivatedIndices: readonly number[]
  /** 是否打满整条链条 */
  readonly isFullChain: boolean
  readonly synergyMultiplier: number
  readonly perPlantPower: readonly number[]
  readonly synthesizedEffect: SynthesizedEffect
}

/** 战斗状态枚举 */
export const enum BattleStatus {
  /** 战斗进行中 */
  Fighting = 0,
  /** 波次间停顿 */
  WavePause = 1,
  /** 关卡通关 */
  Victory = 2,
  /** 关卡失败 */
  Defeat = 3,
}

/** 僵尸行为状态 */
export const enum ZombieState {
  Walking = 0,
  Chewing = 1,
  Dead = 2,
}

export interface ZombieStatus {
  type: 'slow' | 'burn' | 'stun'
  remaining: number
  value: number
}
