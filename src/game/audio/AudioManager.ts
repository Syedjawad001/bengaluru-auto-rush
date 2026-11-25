// ── Central audio manager (Web Audio API, no dependencies) ────────────────────
//
// One AudioContext for the whole game, created on the player's first genuine
// interaction (browser autoplay rules). React and the game loop only call the
// small API below; all synthesis and scheduling lives here and in sfx/music.
//
//   master ─ compressor ─ destination
//     ├─ sfxBus    (SOUND on/off × sfxVolume)  ← one-shot SFX + engine
//     └─ musicDuck (1, or lower while paused) ← musicBus (MUSIC on/off × musicVolume)
//
// Muting stops the work, not just the volume: muted SFX are never scheduled,
// the engine is torn down, and the music scheduler is stopped.

import { SFX, SFX_COOLDOWN, type Sfx } from '@/game/audio/sfx'
import { playStep, STEP_SEC, STEPS } from '@/game/audio/music'
import { createOsc } from '@/game/audio/synth'

export type { Sfx }
export type AudioScene = 'menu' | 'playing' | 'paused'

export interface AudioPrefs {
  sound:        boolean
  music:        boolean
  masterVolume: number   // 0..1
  musicVolume:  number   // 0..1
  sfxVolume:    number   // 0..1
}

const PAUSE_DUCK  = 0.3     // music level while the game is paused
const ENGINE_VOL  = 0.085
const LOOKAHEAD   = 0.12    // seconds of music scheduled ahead
const TICK_MS     = 25

interface Engine { osc: OscillatorNode; sub: OscillatorNode; lfo: OscillatorNode; out: GainNode; nodes: AudioNode[] }

type Ctor = typeof AudioContext

class AudioManager {
  private ac: AudioContext | null = null
  private master!: GainNode
  private sfxBus!: GainNode
  private musicBus!: GainNode
  private musicDuck!: GainNode

  private prefs: AudioPrefs = { sound: true, music: true, masterVolume: 0.8, musicVolume: 0.5, sfxVolume: 0.9 }
  private scene: AudioScene = 'menu'

  private musicTimer = 0
  private musicStep = 0
  private musicNextT = 0

  private engine: Engine | null = null
  private engineSpeed = 0
  private engineAppliedAt = 0

  private lastPlayed = new Map<Sfx, number>()
  private attachCount = 0
  private listening = false

  // ── lifecycle ──────────────────────────────────────────────────────────────

  /** Install the unlock/visibility listeners. Returns a cleanup function. */
  attach(): () => void {
    this.attachCount++
    if (!this.listening) {
      this.listening = true
      for (const ev of ['pointerdown', 'keydown', 'touchend'] as const) window.addEventListener(ev, this.unlock, true)
      document.addEventListener('visibilitychange', this.onVisibility)
    }
    return () => {
      this.attachCount--
      if (this.attachCount <= 0) this.dispose()
    }
  }

  /** Stop everything and release the AudioContext. */
  dispose(): void {
    this.attachCount = 0
    if (this.listening) {
      for (const ev of ['pointerdown', 'keydown', 'touchend'] as const) window.removeEventListener(ev, this.unlock, true)
      document.removeEventListener('visibilitychange', this.onVisibility)
      this.listening = false
    }
    this.stopMusic()
    this.stopEngine(true)
    const ac = this.ac
    this.ac = null
    if (ac) void ac.close().catch(() => {})
  }

  /** First user gesture: create or resume the context (autoplay policy). */
  private unlock = () => {
    if (document.hidden) return
    if (!this.ac) {
      const AC: Ctor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext
      if (!AC) return
      try { this.ac = new AC({ latencyHint: 'interactive' }) } catch { return }
      this.buildGraph()
    }
    if (this.ac.state !== 'running') void this.ac.resume().then(() => this.sync()).catch(() => {})
    this.sync()
  }

  private onVisibility = () => {
    if (!this.ac) return
    if (document.hidden) void this.ac.suspend().catch(() => {})
    else void this.ac.resume().then(() => this.sync()).catch(() => {})
  }

  private buildGraph() {
    const ac = this.ac!
    const comp = ac.createDynamicsCompressor()
    comp.threshold.value = -10
    comp.ratio.value = 4
    this.master    = ac.createGain()
    this.sfxBus    = ac.createGain()
    this.musicBus  = ac.createGain()
    this.musicDuck = ac.createGain()
    this.sfxBus.connect(this.master)
    this.musicBus.connect(this.musicDuck).connect(this.master)
    this.master.connect(comp).connect(ac.destination)
    this.applyLevels(true)
  }

  // ── settings / scene ───────────────────────────────────────────────────────

  setPrefs(p: AudioPrefs): void {
    this.prefs = { ...p }
    this.sync()
  }

  /** Which kind of screen is showing: drives music ducking and the engine. */
  setScene(scene: AudioScene): void {
    if (scene === this.scene) return
    this.scene = scene
    this.sync()
  }

  private applyLevels(immediate = false) {
    const ac = this.ac
    if (!ac) return
    const t = ac.currentTime
    const set = (g: AudioParam, v: number) => immediate ? g.setValueAtTime(v, t) : g.setTargetAtTime(v, t, 0.03)
    const clamp = (v: number) => Math.max(0, Math.min(1, v))
    set(this.master.gain, clamp(this.prefs.masterVolume))
    set(this.sfxBus.gain, this.prefs.sound ? clamp(this.prefs.sfxVolume) : 0)
    set(this.musicBus.gain, this.prefs.music ? clamp(this.prefs.musicVolume) : 0)
    set(this.musicDuck.gain, this.scene === 'paused' ? PAUSE_DUCK : 1)
  }

  /** Bring music, engine and levels in line with prefs + scene. */
  private sync() {
    if (!this.ac) return
    this.applyLevels()
    const running = this.ac.state === 'running'
    if (this.prefs.music && running) this.startMusic()
    else this.stopMusic()
    if (this.prefs.sound && running && this.scene === 'playing') this.startEngine()
    else this.stopEngine()
  }

  // ── music ──────────────────────────────────────────────────────────────────

  private startMusic() {
    if (this.musicTimer || !this.ac) return              // never two loops
    this.musicNextT = this.ac.currentTime + 0.06
    this.musicTimer = window.setInterval(this.pumpMusic, TICK_MS)
    this.pumpMusic()
  }

  private stopMusic() {
    if (!this.musicTimer) return
    window.clearInterval(this.musicTimer)
    this.musicTimer = 0
  }

  private pumpMusic = () => {
    const ac = this.ac
    if (!ac || ac.state !== 'running') return
    // after a stall (suspended tab, slow device) skip ahead instead of bursting
    if (this.musicNextT < ac.currentTime) this.musicNextT = ac.currentTime + 0.03
    while (this.musicNextT < ac.currentTime + LOOKAHEAD) {
      playStep(ac, this.musicBus, this.musicStep, this.musicNextT)
      this.musicStep = (this.musicStep + 1) % STEPS
      this.musicNextT += STEP_SEC
    }
  }

  // ── engine ─────────────────────────────────────────────────────────────────

  private startEngine() {
    const ac = this.ac
    if (this.engine || !ac) return
    const t = ac.currentTime
    const osc = createOsc(ac, 'pulse25')
    const sub = createOsc(ac, 'triangle')
    const lp  = ac.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 850
    // two-stroke "putt-putt": a square LFO chops the level
    const chug = ac.createGain()
    chug.gain.value = 0.6
    const lfo = ac.createOscillator()
    lfo.type = 'square'
    const depth = ac.createGain()
    depth.gain.value = 0.38
    lfo.connect(depth).connect(chug.gain)
    const out = ac.createGain()
    out.gain.setValueAtTime(0, t)
    out.gain.linearRampToValueAtTime(ENGINE_VOL, t + 0.2)
    osc.connect(lp); sub.connect(lp)
    lp.connect(chug).connect(out).connect(this.sfxBus)
    osc.start(t); sub.start(t); lfo.start(t)
    this.engine = { osc, sub, lfo, out, nodes: [osc, sub, lp, chug, lfo, depth, out] }
    this.applyEngine(true)
  }

  private stopEngine(now = false) {
    const e = this.engine, ac = this.ac
    if (!e) return
    this.engine = null
    if (!ac) return
    const t = ac.currentTime
    e.out.gain.cancelScheduledValues(t)
    e.out.gain.setTargetAtTime(0, t, now ? 0.005 : 0.05)
    const end = t + (now ? 0.03 : 0.3)
    for (const o of [e.osc, e.sub, e.lfo]) { try { o.stop(end) } catch { /* already stopped */ } }
    e.osc.onended = () => e.nodes.forEach(n => n.disconnect())
  }

  /** Speed 0..1 (min → max). Called every frame; applied at most ~16×/s. */
  setEngineSpeed(norm: number): void {
    this.engineSpeed = Math.max(0, Math.min(1, norm))
    const ac = this.ac
    if (!this.engine || !ac) return
    if (ac.currentTime - this.engineAppliedAt < 0.06) return
    this.applyEngine()
  }

  private applyEngine(immediate = false) {
    const e = this.engine, ac = this.ac
    if (!e || !ac) return
    const t = ac.currentTime
    this.engineAppliedAt = t
    const s = this.engineSpeed
    const f = 46 + s * 64
    const tc = immediate ? 0.001 : 0.09
    e.osc.frequency.setTargetAtTime(f, t, tc)
    e.sub.frequency.setTargetAtTime(f / 2, t, tc)
    e.lfo.frequency.setTargetAtTime(9 + s * 15, t, tc)
  }

  // ── one-shot effects ───────────────────────────────────────────────────────

  /** Play an effect (optionally after `delay` s). No-op when muted or locked. */
  play(name: Sfx, delay = 0): void {
    const ac = this.ac
    if (!ac || !this.prefs.sound || ac.state !== 'running') return
    const t = ac.currentTime + delay
    const last = this.lastPlayed.get(name) ?? -Infinity
    if (t - last < SFX_COOLDOWN[name]) return
    this.lastPlayed.set(name, t)
    SFX[name](ac, this.sfxBus, t + 0.005)
    // lightweight hook for automated tests; costs nothing without listeners
    window.dispatchEvent(new CustomEvent('bar:sfx', { detail: name }))
  }
}

/** The game's single audio manager. */
export const audio = new AudioManager()
