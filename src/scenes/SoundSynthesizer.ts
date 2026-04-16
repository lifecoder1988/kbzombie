/**
 * Programmatic sound synthesis using Web Audio API.
 * All sounds are generated in real-time — no external audio files needed.
 *
 * Design notes:
 * - Each sound is a short burst of oscillators/noise, sculpted with gain envelopes
 * - Anti-stacking: same sound type respects a minimum interval (50ms)
 * - AudioContext is lazily initialized on first user interaction (browser policy)
 */

type SoundId =
  | 'hit'           // P0: typing correct key
  | 'miss'          // P0: typing wrong key
  | 'settlement'    // P0: combo settlement (fire projectile)
  | 'fullChain'     // P0: all plants activated
  | 'zombieHit'     // P1: projectile hits zombie
  | 'zombieDeath'   // P1: zombie dies
  | 'plantChew'     // P1: zombie chewing plant
  | 'plantDeath'    // P1: plant dies
  | 'waveStart'     // P2: new wave begins
  | 'victory'       // P2: level cleared
  | 'defeat'        // P2: level failed

const MIN_INTERVAL = 50  // ms between same sound plays

export class SoundSynthesizer {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private lastPlayTime = new Map<SoundId, number>()
  private volume = 0.5
  private muted = false

  /** Call on first user interaction to unlock AudioContext */
  init(): void {
    if (this.ctx) return
    this.ctx = new AudioContext()
    this.master = this.ctx.createGain()
    this.master.gain.value = this.muted ? 0 : this.volume
    this.master.connect(this.ctx.destination)
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v))
    if (this.master && !this.muted) {
      this.master.gain.value = this.volume
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    if (this.master) {
      this.master.gain.value = muted ? 0 : this.volume
    }
  }

  play(id: SoundId, params?: { pitch?: number; intensity?: number }): void {
    if (!this.ctx || !this.master || this.muted) return
    // Resume if suspended (browser autoplay policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }

    const now = performance.now()
    const last = this.lastPlayTime.get(id) ?? 0
    if (now - last < MIN_INTERVAL) return
    this.lastPlayTime.set(id, now)

    switch (id) {
      case 'hit': this.playHit(params?.pitch); break
      case 'miss': this.playMiss(); break
      case 'settlement': this.playSettlement(params?.intensity ?? 0.5); break
      case 'fullChain': this.playFullChain(); break
      case 'zombieHit': this.playZombieHit(); break
      case 'zombieDeath': this.playZombieDeath(); break
      case 'plantChew': this.playPlantChew(); break
      case 'plantDeath': this.playPlantDeath(); break
      case 'waveStart': this.playWaveStart(); break
      case 'victory': this.playVictory(); break
      case 'defeat': this.playDefeat(); break
    }
  }

  // ─── P0: Core typing feel ───────────────────────────────────────

  /** Crisp "ding" — pitch rises with combo progress */
  private playHit(pitchOffset = 0): void {
    const ctx = this.ctx!
    const t = ctx.currentTime
    const baseFreq = 880 + pitchOffset * 40  // C6 base, rises with combo

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(baseFreq, t)
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.2, t + 0.06)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.3, t)
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12)

    osc.connect(gain)
    gain.connect(this.master!)
    osc.start(t)
    osc.stop(t + 0.12)
  }

  /** Short low buzz — unmistakable but not annoying */
  private playMiss(): void {
    const ctx = this.ctx!
    const t = ctx.currentTime

    // Two detuned square waves for a rough buzz
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator()
      osc.type = 'square'
      osc.frequency.setValueAtTime(150 + i * 15, t)
      osc.frequency.exponentialRampToValueAtTime(100, t + 0.15)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.15, t)
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15)

      osc.connect(gain)
      gain.connect(this.master!)
      osc.start(t)
      osc.stop(t + 0.15)
    }
  }

  /** Whoosh/launch — intensity scales with activated plant ratio */
  private playSettlement(intensity: number): void {
    const ctx = this.ctx!
    const t = ctx.currentTime
    const baseFreq = 300 + intensity * 400

    // Rising sweep
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(baseFreq * 0.5, t)
    osc.frequency.exponentialRampToValueAtTime(baseFreq, t + 0.1)
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, t + 0.25)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.2 + intensity * 0.15, t)
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3)

    // Noise layer for whoosh texture
    const noiseGain = this.createNoiseLayer(t, 0.3, 0.1 + intensity * 0.1)

    osc.connect(gain)
    gain.connect(this.master!)
    noiseGain.connect(this.master!)
    osc.start(t)
    osc.stop(t + 0.3)
  }

  /** Epic burst — layered rising tones + noise explosion */
  private playFullChain(): void {
    const ctx = this.ctx!
    const t = ctx.currentTime

    // Major chord arpeggio (C-E-G-C)
    const freqs = [523, 659, 784, 1047]
    for (let i = 0; i < freqs.length; i++) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      const start = t + i * 0.05
      osc.frequency.setValueAtTime(freqs[i], start)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.25, start + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.01, start + 0.5)

      osc.connect(gain)
      gain.connect(this.master!)
      osc.start(start)
      osc.stop(start + 0.5)
    }

    // Big noise burst
    const noiseGain = this.createNoiseLayer(t, 0.6, 0.2)
    noiseGain.connect(this.master!)
  }

  // ─── P1: Battle feedback ────────────────────────────────────────

  /** Soft thud when projectile hits */
  private playZombieHit(): void {
    const ctx = this.ctx!
    const t = ctx.currentTime

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(200, t)
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.1)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.2, t)
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1)

    osc.connect(gain)
    gain.connect(this.master!)
    osc.start(t)
    osc.stop(t + 0.1)
  }

  /** Comical pop + descending tone */
  private playZombieDeath(): void {
    const ctx = this.ctx!
    const t = ctx.currentTime

    // Pop
    const pop = ctx.createOscillator()
    pop.type = 'sine'
    pop.frequency.setValueAtTime(600, t)
    pop.frequency.exponentialRampToValueAtTime(100, t + 0.2)

    const popGain = ctx.createGain()
    popGain.gain.setValueAtTime(0.3, t)
    popGain.gain.exponentialRampToValueAtTime(0.01, t + 0.25)

    pop.connect(popGain)
    popGain.connect(this.master!)
    pop.start(t)
    pop.stop(t + 0.25)

    // Noise puff
    const noiseGain = this.createNoiseLayer(t, 0.2, 0.12)
    noiseGain.connect(this.master!)
  }

  /** Crunchy munch sound */
  private playPlantChew(): void {
    const ctx = this.ctx!
    const t = ctx.currentTime

    // Short crunch — filtered noise
    const bufferSize = ctx.sampleRate * 0.08
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      // Amplitude modulation for crunch texture
      const mod = Math.sin(i / (ctx.sampleRate * 0.005)) > 0 ? 1 : 0.3
      data[i] = (Math.random() * 2 - 1) * mod
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(800, t)
    filter.Q.setValueAtTime(2, t)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.15, t)
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.master!)
    source.start(t)
  }

  /** Sad descending tone */
  private playPlantDeath(): void {
    const ctx = this.ctx!
    const t = ctx.currentTime

    // Descending minor tone
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(440, t)
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.3)

    const osc2 = ctx.createOscillator()
    osc2.type = 'triangle'
    osc2.frequency.setValueAtTime(523, t)  // minor third
    osc2.frequency.exponentialRampToValueAtTime(262, t + 0.3)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.2, t)
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35)

    osc.connect(gain)
    osc2.connect(gain)
    gain.connect(this.master!)
    osc.start(t)
    osc2.start(t)
    osc.stop(t + 0.35)
    osc2.stop(t + 0.35)
  }

  // ─── P2: Atmosphere & rhythm ────────────────────────────────────

  /** Drum roll + horn for wave announcement */
  private playWaveStart(): void {
    const ctx = this.ctx!
    const t = ctx.currentTime

    // Quick drum hits (low freq pops)
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      const start = t + i * 0.08
      osc.frequency.setValueAtTime(150, start)
      osc.frequency.exponentialRampToValueAtTime(60, start + 0.06)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.25, start)
      gain.gain.exponentialRampToValueAtTime(0.01, start + 0.06)

      osc.connect(gain)
      gain.connect(this.master!)
      osc.start(start)
      osc.stop(start + 0.06)
    }

    // Horn stab after drums
    const horn = ctx.createOscillator()
    horn.type = 'sawtooth'
    const hornStart = t + 0.28
    horn.frequency.setValueAtTime(440, hornStart)

    const hornGain = ctx.createGain()
    hornGain.gain.setValueAtTime(0, hornStart)
    hornGain.gain.linearRampToValueAtTime(0.15, hornStart + 0.05)
    hornGain.gain.setValueAtTime(0.15, hornStart + 0.15)
    hornGain.gain.exponentialRampToValueAtTime(0.01, hornStart + 0.35)

    // Soften the sawtooth
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(2000, hornStart)

    horn.connect(filter)
    filter.connect(hornGain)
    hornGain.connect(this.master!)
    horn.start(hornStart)
    horn.stop(hornStart + 0.35)
  }

  /** Cheerful ascending fanfare */
  private playVictory(): void {
    const ctx = this.ctx!
    const t = ctx.currentTime

    // C major arpeggio ascending: C5-E5-G5-C6
    const notes = [523, 659, 784, 1047]
    for (let i = 0; i < notes.length; i++) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      const start = t + i * 0.12

      osc.frequency.setValueAtTime(notes[i], start)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.25, start + 0.04)
      // Last note sustains longer
      const dur = i === notes.length - 1 ? 0.6 : 0.2
      gain.gain.setValueAtTime(0.25, start + dur * 0.6)
      gain.gain.exponentialRampToValueAtTime(0.01, start + dur)

      osc.connect(gain)
      gain.connect(this.master!)
      osc.start(start)
      osc.stop(start + dur)
    }

    // Shimmer overlay on final note
    const shimmer = ctx.createOscillator()
    shimmer.type = 'sine'
    const shimmerStart = t + 0.36
    shimmer.frequency.setValueAtTime(2094, shimmerStart)  // C7

    const shimmerGain = ctx.createGain()
    shimmerGain.gain.setValueAtTime(0, shimmerStart)
    shimmerGain.gain.linearRampToValueAtTime(0.08, shimmerStart + 0.1)
    shimmerGain.gain.exponentialRampToValueAtTime(0.01, shimmerStart + 0.6)

    shimmer.connect(shimmerGain)
    shimmerGain.connect(this.master!)
    shimmer.start(shimmerStart)
    shimmer.stop(shimmerStart + 0.6)
  }

  /** Descending minor — subdued, not punishing */
  private playDefeat(): void {
    const ctx = this.ctx!
    const t = ctx.currentTime

    // Descending minor: C5-Ab4-F4-C4
    const notes = [523, 415, 349, 262]
    for (let i = 0; i < notes.length; i++) {
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      const start = t + i * 0.15

      osc.frequency.setValueAtTime(notes[i], start)

      const gain = ctx.createGain()
      const vol = 0.2 - i * 0.03  // gradually quieter
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(vol, start + 0.04)
      const dur = i === notes.length - 1 ? 0.5 : 0.2
      gain.gain.setValueAtTime(vol, start + dur * 0.5)
      gain.gain.exponentialRampToValueAtTime(0.01, start + dur)

      osc.connect(gain)
      gain.connect(this.master!)
      osc.start(start)
      osc.stop(start + dur)
    }
  }

  // ─── Utility ────────────────────────────────────────────────────

  /** Create a noise burst and return its gain node (caller connects to destination) */
  private createNoiseLayer(startTime: number, duration: number, volume: number): GainNode {
    const ctx = this.ctx!
    const bufferSize = Math.ceil(ctx.sampleRate * duration)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(volume, startTime)
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration)

    source.connect(gain)
    source.start(startTime)

    return gain
  }
}
