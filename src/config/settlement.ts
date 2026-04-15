import type { SettlementConfig } from './types'

export const SETTLEMENT_CONFIG: SettlementConfig = {
  titleRules: [
    { id: 'perfect_commander', name: '完美指挥官', requires: { zeroMissed: true, minFullChainCount: 3 } },
    { id: 'no_miss', name: '滴水不漏', requires: { zeroMissed: true } },
    { id: 'combo_master', name: '连击大师', requires: { minLongestCombo: 20 } },
    { id: 'synergy_pro', name: '协同达人', requires: { minSynergyCount: 5 } },
    { id: 'full_chain_expert', name: '全链专家', requires: { minFullChainCount: 3 } },
  ],
  defaultVictoryTitle: '勇敢的键盘侠',
  encouragements: [
    '僵尸们也被你的勇气吓到了！再来一次？',
    '差一点点就成功了，加油！',
    '每个键盘侠都是从失败中成长的！',
    '僵尸只是运气好，再试试看？',
    '你已经很棒了，再挑战一次吧！',
  ],
}
