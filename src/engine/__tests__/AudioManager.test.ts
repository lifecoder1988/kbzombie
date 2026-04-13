import { describe, it, expect } from 'vitest'
import { AudioManager } from '../AudioManager'

describe('AudioManager', () => {
  it('未 init 时 play 不报错', () => {
    const audio = new AudioManager()
    expect(() => audio.play('hit')).not.toThrow()
  })

  it('未 init 时 setVolume 不报错', () => {
    const audio = new AudioManager()
    expect(() => audio.setVolume(0.5)).not.toThrow()
  })

  it('未 init 时 mute 不报错', () => {
    const audio = new AudioManager()
    expect(() => audio.mute(true)).not.toThrow()
  })

  it('play 不存在的音效不报错', () => {
    const audio = new AudioManager()
    expect(() => audio.play('nonexistent')).not.toThrow()
  })
})
