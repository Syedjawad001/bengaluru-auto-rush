// ── Tiny 8-bit synth helpers shared by the SFX and the music ─────────────────
//
// Everything is plain Web Audio: short-lived oscillators / noise sources with
// a gain envelope. Nodes disconnect themselves when they finish, so nothing
// accumulates. Works on any BaseAudioContext (live or offline).

export type Wave = 'pulse50' | 'pulse25' | 'pulse12' | 'triangle' | 'sine' | 'sawtooth'

const pulseCache = new WeakMap<BaseAudioContext, Map<number, PeriodicWave>>()
const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>()

/** NES-style pulse wave with the given duty cycle (band-limited Fourier series). */
function pulseWave(ac: BaseAudioContext, duty: number): PeriodicWave {
  let m = pulseCache.get(ac)
  if (!m) { m = new Map(); pulseCache.set(ac, m) }
  let w = m.get(duty)
  if (!w) {
    const N = 48
    const real = new Float32Array(N), imag = new Float32Array(N)
    for (let n = 1; n < N; n++) real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty)
    w = ac.createPeriodicWave(real, imag)
    m.set(duty, w)
  }
  return w
}

/** One second of white noise, generated once per context. */
export function noiseBuffer(ac: BaseAudioContext): AudioBuffer {
  let b = noiseCache.get(ac)
  if (!b) {
    b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate)
    const d = b.getChannelData(0)
    // 15-bit LFSR, like the noise channel of old consoles
    let r = 1
    for (let i = 0; i < d.length; i++) {
      if (i % 4 === 0) { const bit = (r ^ (r >> 1)) & 1; r = (r >> 1) | (bit << 14) }
      d[i] = (r & 1) ? 0.9 : -0.9
    }
    noiseCache.set(ac, b)
  }
  return b
}

export function createOsc(ac: BaseAudioContext, wave: Wave): OscillatorNode {
  const o = ac.createOscillator()
  if (wave === 'pulse50') o.setPeriodicWave(pulseWave(ac, 0.5))
  else if (wave === 'pulse25') o.setPeriodicWave(pulseWave(ac, 0.25))
  else if (wave === 'pulse12') o.setPeriodicWave(pulseWave(ac, 0.125))
  else o.type = wave
  return o
}

export const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

/** A single enveloped tone, optionally gliding from f0 to f1. */
export function tone(
  ac: BaseAudioContext, out: AudioNode, wave: Wave,
  f0: number, t: number, dur: number, vol: number,
  opts: { f1?: number; attack?: number; release?: number; vibrato?: number } = {},
): void {
  const o = createOsc(ac, wave)
  const g = ac.createGain()
  const a = opts.attack ?? 0.004
  const r = opts.release ?? Math.min(0.08, dur * 0.5)
  o.frequency.setValueAtTime(f0, t)
  if (opts.f1 && opts.f1 !== f0) o.frequency.exponentialRampToValueAtTime(opts.f1, t + dur)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + a)
  g.gain.setValueAtTime(vol, Math.max(t + a, t + dur - r))
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  if (opts.vibrato) {
    const lfo = ac.createOscillator(), lg = ac.createGain()
    lfo.frequency.value = 9
    lg.gain.value = f0 * opts.vibrato
    lfo.connect(lg).connect(o.frequency)
    lfo.start(t); lfo.stop(t + dur + 0.02)
  }
  o.connect(g).connect(out)
  o.start(t)
  o.stop(t + dur + 0.02)
  o.onended = () => { o.disconnect(); g.disconnect() }
}

/** Filtered noise burst (drums, crashes, whooshes). */
export function noise(
  ac: BaseAudioContext, out: AudioNode, t: number, dur: number, vol: number,
  filter: BiquadFilterType, freq: number, freqEnd?: number,
): void {
  const s = ac.createBufferSource()
  s.buffer = noiseBuffer(ac)
  s.loop = true
  const f = ac.createBiquadFilter()
  f.type = filter
  f.frequency.setValueAtTime(freq, t)
  if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur)
  const g = ac.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  s.connect(f).connect(g).connect(out)
  s.start(t, Math.random() * 0.5)
  s.stop(t + dur + 0.02)
  s.onended = () => { s.disconnect(); f.disconnect(); g.disconnect() }
}
