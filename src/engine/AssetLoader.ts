// src/engine/AssetLoader.ts
import type { AssetManifest, LoadedAssets, AssetProgressCallback } from './types'

export class AssetLoader {
  private images: Map<string, HTMLImageElement> = new Map()
  private audioBuffers: Map<string, AudioBuffer> = new Map()
  private audioContext: AudioContext | null = null

  async load(manifest: AssetManifest, onProgress?: AssetProgressCallback): Promise<LoadedAssets> {
    const imageEntries = Object.entries(manifest.images)
    const audioEntries = Object.entries(manifest.audio)
    const total = imageEntries.length + audioEntries.length
    let loaded = 0

    const report = () => {
      loaded++
      onProgress?.(loaded, total)
    }

    const imagePromises = imageEntries.map(([id, url]) =>
      this.loadImage(id, url).then(report)
    )

    const audioPromises = audioEntries.map(([id, url]) =>
      this.loadAudio(id, url).then(report)
    )

    await Promise.all([...imagePromises, ...audioPromises])

    return {
      images: this.images,
      audio: this.audioBuffers,
    }
  }

  getImage(id: string): HTMLImageElement | undefined {
    return this.images.get(id)
  }

  getAudio(id: string): AudioBuffer | undefined {
    return this.audioBuffers.get(id)
  }

  private async loadImage(id: string, url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        this.images.set(id, img)
        resolve()
      }
      img.onerror = () => reject(new Error(`Failed to load image: ${id} (${url})`))
      img.src = url
    })
  }

  private async loadAudio(id: string, url: string): Promise<void> {
    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext()
      }
      const response = await fetch(url)
      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)
      this.audioBuffers.set(id, audioBuffer)
    } catch (e) {
      console.warn(`Failed to load audio: ${id} (${url})`, e)
    }
  }
}
