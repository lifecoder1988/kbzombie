// src/engine/__tests__/AssetLoader.test.ts
import { describe, it, expect, vi } from 'vitest'
import { AssetLoader } from '../AssetLoader'

describe('AssetLoader', () => {
  it('空 manifest 直接返回空集合', async () => {
    const loader = new AssetLoader()
    const result = await loader.load({ images: {}, audio: {} })

    expect(result.images.size).toBe(0)
    expect(result.audio.size).toBe(0)
  })

  it('onProgress 在空 manifest 时不被调用', async () => {
    const loader = new AssetLoader()
    const progress = vi.fn()
    await loader.load({ images: {}, audio: {} }, progress)

    expect(progress).not.toHaveBeenCalled()
  })

  it('getImage 返回 undefined 当未加载', () => {
    const loader = new AssetLoader()
    expect(loader.getImage('nonexistent')).toBeUndefined()
  })

  it('getAudio 返回 undefined 当未加载', () => {
    const loader = new AssetLoader()
    expect(loader.getAudio('nonexistent')).toBeUndefined()
  })
})
