// @vitest-environment jsdom
// @vitest-environment-options { "url": "http://localhost" }
import { describe, it, expect, beforeEach } from 'vitest'
import { LocalStorage } from '../Storage'

// 使用 vitest 内置的 jsdom 环境提供 localStorage
describe('LocalStorage', () => {
  let storage: LocalStorage

  beforeEach(() => {
    localStorage.clear()
    storage = new LocalStorage()
  })

  it('load 不存在的 key 返回 null', () => {
    expect(storage.load('nonexistent')).toBeNull()
  })

  it('save 后 load 返回相同数据', () => {
    const data = { version: 1, name: 'test' }
    storage.save('game', data)
    expect(storage.load('game')).toEqual(data)
  })

  it('save 覆盖已有数据', () => {
    storage.save('key', { a: 1 })
    storage.save('key', { a: 2 })
    expect(storage.load('key')).toEqual({ a: 2 })
  })

  it('delete 后 load 返回 null', () => {
    storage.save('key', { a: 1 })
    storage.delete('key')
    expect(storage.load('key')).toBeNull()
  })

  it('load 解析失败返回 null', () => {
    localStorage.setItem('bad', 'not-json{{{')
    expect(storage.load('bad')).toBeNull()
  })
})
