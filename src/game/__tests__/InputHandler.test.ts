import { describe, it, expect } from 'vitest'
import { classifyInput, InputAction } from '../InputHandler'

describe('classifyInput', () => {
  it('字母池内的字母 → LetterHit', () => {
    const result = classifyInput('f', 'f')
    expect(result).toBe(InputAction.LetterHit)
  })

  it('字母池内但不匹配当前字母 → LetterMiss', () => {
    const result = classifyInput('j', 'f')
    expect(result).toBe(InputAction.LetterMiss)
  })

  it('字母池外的可见字符 → LetterMiss', () => {
    const result = classifyInput('z', 'f')
    expect(result).toBe(InputAction.LetterMiss)
  })

  it('空格 → Space', () => {
    const result = classifyInput(' ', 'f')
    expect(result).toBe(InputAction.Space)
  })

  it('功能键 → Ignore', () => {
    expect(classifyInput('Shift', 'f')).toBe(InputAction.Ignore)
    expect(classifyInput('Control', 'f')).toBe(InputAction.Ignore)
    expect(classifyInput('Alt', 'f')).toBe(InputAction.Ignore)
    expect(classifyInput('Meta', 'f')).toBe(InputAction.Ignore)
    expect(classifyInput('Escape', 'f')).toBe(InputAction.Ignore)
    expect(classifyInput('Tab', 'f')).toBe(InputAction.Ignore)
    expect(classifyInput('CapsLock', 'f')).toBe(InputAction.Ignore)
    expect(classifyInput('Enter', 'f')).toBe(InputAction.Ignore)
    expect(classifyInput('Backspace', 'f')).toBe(InputAction.Ignore)
    expect(classifyInput('ArrowUp', 'f')).toBe(InputAction.Ignore)
  })

  it('大写字母按键视为小写匹配', () => {
    const result = classifyInput('F', 'f')
    expect(result).toBe(InputAction.LetterHit)
  })

  it('数字键视为按错', () => {
    const result = classifyInput('5', 'f')
    expect(result).toBe(InputAction.LetterMiss)
  })
})
