export class AudioManager {
  private audioContext: AudioContext | null = null
  private buffers: Map<string, AudioBuffer> = new Map()
  private gainNode: GainNode | null = null
  private lastPlayTime: Map<string, number> = new Map()
  private minInterval = 50  // 同一音效最小间隔（毫秒），防叠加
  private savedVolume = 1
  private muted = false

  /** 初始化音频上下文（必须在用户交互后调用）。返回 AudioContext 供其他模块共享。 */
  init(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext()
      this.gainNode = this.audioContext.createGain()
      this.gainNode.connect(this.audioContext.destination)
    }
    return this.audioContext
  }

  register(id: string, buffer: AudioBuffer): void {
    this.buffers.set(id, buffer)
  }

  play(id: string): void {
    if (!this.audioContext || !this.gainNode) return
    const buffer = this.buffers.get(id)
    if (!buffer) return

    const now = performance.now()
    const lastTime = this.lastPlayTime.get(id) ?? 0
    if (now - lastTime < this.minInterval) return
    this.lastPlayTime.set(id, now)

    const source = this.audioContext.createBufferSource()
    source.buffer = buffer
    source.connect(this.gainNode)
    source.start(0)
  }

  setVolume(volume: number): void {
    this.savedVolume = Math.max(0, Math.min(1, volume))
    if (this.gainNode && !this.muted) {
      this.gainNode.gain.value = this.savedVolume
    }
  }

  mute(muted: boolean): void {
    this.muted = muted
    if (this.gainNode) {
      this.gainNode.gain.value = muted ? 0 : this.savedVolume
    }
  }
}
