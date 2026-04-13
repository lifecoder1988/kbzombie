// src/engine/__tests__/InputManager.test.ts
import { describe, it, expect } from 'vitest'
import { InputManager } from '../InputManager'
import type { InputEvent } from '../types'

describe('InputManager', () => {
  it('inject 派发事件给所有监听器', () => {
    const input = new InputManager()
    const received: InputEvent[] = []
    input.addListener((e) => received.push(e))

    input.inject({ key: 'f', type: 'keydown', timestamp: 100 })
    input.inject({ key: 'j', type: 'keydown', timestamp: 200 })

    expect(received).toHaveLength(2)
    expect(received[0].key).toBe('f')
    expect(received[1].key).toBe('j')
  })

  it('移除监听器后不再收到事件', () => {
    const input = new InputManager()
    const received: InputEvent[] = []
    const listener = (e: InputEvent) => received.push(e)

    input.addListener(listener)
    input.inject({ key: 'f', type: 'keydown', timestamp: 100 })
    input.removeListener(listener)
    input.inject({ key: 'j', type: 'keydown', timestamp: 200 })

    expect(received).toHaveLength(1)
  })

  it('isKeyPressed 追踪按键状态', () => {
    const input = new InputManager()
    input.addListener(() => {})

    expect(input.isKeyPressed('f')).toBe(false)

    input.inject({ key: 'f', type: 'keydown', timestamp: 100 })
    expect(input.isKeyPressed('f')).toBe(true)

    input.inject({ key: 'f', type: 'keyup', timestamp: 200 })
    expect(input.isKeyPressed('f')).toBe(false)
  })

  it('多个监听器都能收到事件', () => {
    const input = new InputManager()
    let count1 = 0
    let count2 = 0
    input.addListener(() => count1++)
    input.addListener(() => count2++)

    input.inject({ key: 'a', type: 'keydown', timestamp: 0 })

    expect(count1).toBe(1)
    expect(count2).toBe(1)
  })
})
