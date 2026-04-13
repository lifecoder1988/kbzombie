export class AudioManager {
  private audioContext: AudioContext | null = null
  private buffers: Map<string, AudioBuffer> = new Map()
  private gainNode: GainNode | null = null
  private lastPlayTime: Map<string, number> = new Map()
  private minInterval = 50  // 同一音效最小间隔（毫秒），防叠加

  init(): void {
    if (this.audioContext) return
    this.audioContext = new AudioContext()
    this.gainNode = this.audioContext.createGain()
    this.gainNode.connect(this.audioContext.destination)
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
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume))
    }
  }

  mute(muted: boolean): void {
    if (this.gainNode) {
      this.gainNode.gain.value = muted ? 0 : 1
    }
  }
}
