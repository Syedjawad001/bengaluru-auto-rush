// ── "Silk Board Shuffle": original looping chiptune ───────────────────────────
//
// 8 bars at 132 BPM in D Mixolydian (D – C – G – D | D – C – G – A), the bright
// flat-seven colour common to folk tunes. Four voices: pulse lead, thin pulse
// arpeggio, triangle bass and noise/sine drums. Written for this game.
//
// The pattern is compiled once into a 128-step table; the scheduler in
// AudioManager plays one 16th-note step at a time with a short look-ahead.

import { tone, noise, midiHz as N } from '@/game/audio/synth'

export const BPM = 132
export const STEP_SEC = 60 / BPM / 4
export const STEPS = 128

// melody: [step-in-bar, midi, length-in-steps] per bar
const LEAD: [number, number, number][][] = [
  [[0, 69, 2], [2, 74, 2], [4, 78, 2], [6, 76, 1], [7, 74, 1], [8, 76, 3], [12, 69, 2], [14, 71, 2]],
  [[0, 72, 2], [2, 76, 2], [4, 79, 2], [6, 78, 1], [7, 76, 1], [8, 74, 3], [12, 72, 2], [14, 69, 2]],
  [[0, 71, 2], [2, 74, 2], [4, 79, 3], [7, 78, 1], [8, 76, 2], [10, 74, 2], [12, 71, 2], [14, 74, 2]],
  [[0, 69, 3], [3, 66, 1], [4, 69, 2], [6, 74, 2], [8, 69, 5]],
  [[0, 78, 2], [2, 78, 1], [3, 76, 1], [4, 74, 2], [6, 76, 2], [8, 78, 2], [10, 81, 2], [12, 78, 2], [14, 76, 2]],
  [[0, 76, 2], [2, 76, 1], [3, 74, 1], [4, 72, 2], [6, 74, 2], [8, 76, 2], [10, 79, 2], [12, 76, 2], [14, 72, 2]],
  [[0, 74, 2], [2, 71, 2], [4, 67, 2], [6, 71, 2], [8, 74, 2], [10, 79, 2], [12, 78, 2], [14, 76, 2]],
  [[0, 76, 2], [2, 74, 1], [3, 73, 1], [4, 69, 4], [12, 74, 2], [14, 73, 2]],
]
// chord per bar: root (bass octave) and triad (arp octave)
const CHORDS: { root: number; triad: [number, number, number] }[] = [
  { root: 38, triad: [62, 66, 69] }, // D
  { root: 36, triad: [60, 64, 67] }, // C
  { root: 43, triad: [62, 67, 71] }, // G
  { root: 38, triad: [62, 66, 69] }, // D
  { root: 38, triad: [62, 66, 69] }, // D
  { root: 36, triad: [60, 64, 67] }, // C
  { root: 43, triad: [62, 67, 71] }, // G
  { root: 45, triad: [61, 64, 69] }, // A
]
const BASS_PATTERN: [number, number, number][] = [ // [step, semitone offset, length]
  [0, 0, 2], [3, 0, 1], [4, 12, 2], [6, 0, 2], [8, 0, 2], [10, 7, 2], [12, 12, 2], [14, 7, 2],
]

type Ev = { kind: 'lead' | 'arp' | 'bass' | 'kick' | 'snare' | 'hat'; midi?: number; len?: number }
const TABLE: Ev[][] = Array.from({ length: STEPS }, () => [])

for (let bar = 0; bar < 8; bar++) {
  const base = bar * 16
  for (const [s, m, l] of LEAD[bar]) TABLE[base + s].push({ kind: 'lead', midi: m, len: l })
  const ch = CHORDS[bar]
  for (const [s, off, l] of BASS_PATTERN) TABLE[base + s].push({ kind: 'bass', midi: ch.root + off, len: l })
  for (let s = 0; s < 16; s += 2) TABLE[base + s].push({ kind: 'arp', midi: ch.triad[(s / 2) % 3] + 12, len: 1 })
  for (const s of [0, 8, 11]) TABLE[base + s].push({ kind: 'kick' })
  for (const s of [4, 12]) TABLE[base + s].push({ kind: 'snare' })
  for (let s = 2; s < 16; s += 4) TABLE[base + s].push({ kind: 'hat' })
}

/** Schedule every note of one step at time t. */
export function playStep(ac: BaseAudioContext, out: AudioNode, step: number, t: number): void {
  for (const e of TABLE[step % STEPS]) {
    const d = (e.len ?? 1) * STEP_SEC
    switch (e.kind) {
      case 'lead':  tone(ac, out, 'pulse25', N(e.midi!), t, d * 0.92, 0.075, { release: 0.04, vibrato: d > 0.3 ? 0.006 : 0 }); break
      case 'arp':   tone(ac, out, 'pulse12', N(e.midi!), t, d * 0.6, 0.028); break
      case 'bass':  tone(ac, out, 'triangle', N(e.midi!), t, d * 0.9, 0.2, { release: 0.03 }); break
      case 'kick':  tone(ac, out, 'sine', 150, t, 0.11, 0.32, { f1: 45, release: 0.08 }); break
      case 'snare': noise(ac, out, t, 0.09, 0.09, 'highpass', 1800); break
      case 'hat':   noise(ac, out, t, 0.03, 0.035, 'highpass', 7000); break
    }
  }
}
