// ── Original 8-bit sound effects ──────────────────────────────────────────────
// Each recipe schedules a few short synth notes at time `t` on `out`.

import { tone, noise, midiHz as N } from '@/game/audio/synth'

export type Sfx =
  | 'horn' | 'collision' | 'nearMiss' | 'coin' | 'pickup'
  | 'dropoff' | 'package' | 'missionClear' | 'timeUp' | 'gameOver'

type Recipe = (ac: BaseAudioContext, out: AudioNode, t: number) => void

export const SFX: Record<Sfx, Recipe> = {
  // Auto-rickshaw "peep-peep": two short reedy blasts of a slightly sour dyad.
  horn: (ac, o, t) => {
    for (const s of [0, 0.17]) {
      tone(ac, o, 'pulse25', 415, t + s, 0.13, 0.16, { release: 0.03 })
      tone(ac, o, 'pulse25', 523, t + s, 0.13, 0.12, { release: 0.03 })
    }
  },

  // Crunch: noise crash with a falling square "thunk" underneath.
  collision: (ac, o, t) => {
    noise(ac, o, t, 0.34, 0.5, 'lowpass', 2400, 160)
    tone(ac, o, 'pulse50', 190, t, 0.28, 0.22, { f1: 42 })
  },

  // Close call: a quick whoosh, then a bright two-note "ting".
  nearMiss: (ac, o, t) => {
    noise(ac, o, t, 0.12, 0.18, 'bandpass', 900, 5000)
    tone(ac, o, 'pulse25', N(83), t + 0.05, 0.06, 0.17)
    tone(ac, o, 'pulse25', N(90), t + 0.1, 0.14, 0.17)
  },

  // Coins credited: a sparkly rising triple.
  coin: (ac, o, t) => {
    tone(ac, o, 'pulse25', N(88), t, 0.05, 0.12)
    tone(ac, o, 'pulse25', N(93), t + 0.05, 0.05, 0.12)
    tone(ac, o, 'pulse25', N(96), t + 0.1, 0.22, 0.11)
    tone(ac, o, 'triangle', N(96), t + 0.1, 0.22, 0.15)
  },

  // Passenger picked up: friendly major arpeggio.
  pickup: (ac, o, t) => {
    const notes = [74, 78, 81, 86]
    notes.forEach((m, i) => tone(ac, o, 'pulse50', N(m), t + i * 0.06, i === 3 ? 0.16 : 0.06, 0.12))
    tone(ac, o, 'triangle', N(62), t, 0.3, 0.16)
  },

  // Passenger dropped off: a little "arrived!" phrase.
  dropoff: (ac, o, t) => {
    const seq: [number, number, number][] = [[81, 0, 0.09], [78, 0.1, 0.09], [81, 0.2, 0.09], [86, 0.3, 0.32]]
    for (const [m, s, d] of seq) tone(ac, o, 'pulse25', N(m), t + s, d, 0.13)
    tone(ac, o, 'triangle', N(50), t + 0.3, 0.32, 0.2)
  },

  // Package delivered: doorbell "ding-dong" with a soft parcel thud.
  package: (ac, o, t) => {
    noise(ac, o, t, 0.1, 0.25, 'lowpass', 500)
    tone(ac, o, 'triangle', N(88), t + 0.04, 0.32, 0.26, { release: 0.25 })
    tone(ac, o, 'pulse12', N(88), t + 0.04, 0.2, 0.05)
    tone(ac, o, 'triangle', N(84), t + 0.3, 0.5, 0.26, { release: 0.4 })
    tone(ac, o, 'pulse12', N(84), t + 0.3, 0.3, 0.05)
  },

  // Mission clear: short victory fanfare with harmony and a sparkle on top.
  missionClear: (ac, o, t) => {
    const lead: [number, number, number][] = [[79, 0, 0.08], [81, 0.09, 0.08], [83, 0.18, 0.08], [86, 0.27, 0.45]]
    for (const [m, s, d] of lead) tone(ac, o, 'pulse25', N(m), t + s, d, 0.14, { vibrato: d > 0.3 ? 0.012 : 0 })
    const harm: [number, number, number][] = [[74, 0.27, 0.45], [67, 0, 0.27]]
    for (const [m, s, d] of harm) tone(ac, o, 'pulse50', N(m), t + s, d, 0.07)
    tone(ac, o, 'triangle', N(43), t + 0.27, 0.45, 0.22)
    for (let i = 0; i < 4; i++) tone(ac, o, 'pulse12', N(98 + (i % 2) * 5), t + 0.4 + i * 0.05, 0.05, 0.05)
  },

  // Time trial ran out: two falling beeps.
  timeUp: (ac, o, t) => {
    tone(ac, o, 'pulse50', N(76), t, 0.14, 0.13)
    tone(ac, o, 'pulse50', N(69), t + 0.16, 0.3, 0.13, { vibrato: 0.01 })
  },

  // Game over: slow chromatic slide down, wobbling out, plus a low thump.
  gameOver: (ac, o, t) => {
    const notes = [71, 70, 69]
    notes.forEach((m, i) => tone(ac, o, 'pulse50', N(m), t + i * 0.18, 0.16, 0.14))
    tone(ac, o, 'pulse50', N(68), t + 0.54, 0.6, 0.14, { vibrato: 0.02 })
    tone(ac, o, 'triangle', N(44), t + 0.54, 0.6, 0.22, { f1: N(32) })
    noise(ac, o, t + 0.54, 0.3, 0.15, 'lowpass', 400)
  },
}

/** Minimum time between two plays of the same effect (seconds). */
export const SFX_COOLDOWN: Record<Sfx, number> = {
  horn: 0.25, collision: 0.3, nearMiss: 0.08, coin: 0.1, pickup: 0.3,
  dropoff: 0.5, package: 0.5, missionClear: 0.5, timeUp: 0.5, gameOver: 0.8,
}
