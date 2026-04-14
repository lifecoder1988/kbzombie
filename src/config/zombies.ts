import type { ZombieDef } from './types'

export const ZOMBIE_DEFS: Readonly<Record<string, ZombieDef>> = {
  normal:   { id: 'normal',   name: '普通僵尸', hp: 50,  speed: 30, chewDps: 10, width: 40, height: 60, color: '#44cc44' },
  conehead: { id: 'conehead', name: '路障僵尸', hp: 80,  speed: 28, chewDps: 10, width: 40, height: 65, color: '#ee8833' },
  fat:      { id: 'fat',      name: '胖僵尸',   hp: 150, speed: 15, chewDps: 5,  width: 55, height: 70, color: '#668844' },
  flag:     { id: 'flag',     name: '旗手僵尸', hp: 35,  speed: 50, chewDps: 15, width: 38, height: 60, color: '#cc4444' },
  imp:      { id: 'imp',      name: '小鬼僵尸', hp: 20,  speed: 55, chewDps: 8,  width: 28, height: 40, color: '#aa66cc' },
}
