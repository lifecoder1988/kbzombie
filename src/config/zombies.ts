import type { ZombieDef } from './types'

export const ZOMBIE_DEFS: Readonly<Record<string, ZombieDef>> = {
  normal: { id: 'normal', name: '普通僵尸', hp: 50, speed: 30, chewDps: 10 },
  slow: { id: 'slow', name: '慢速僵尸', hp: 80, speed: 15, chewDps: 5 },
}
