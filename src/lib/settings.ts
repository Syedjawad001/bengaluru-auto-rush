// Player preferences (separate key from stats/garage so existing saves are untouched).
// Read by the audio manager (game/audio/AudioManager.ts). Older saves that only
// contain { sound, music } load fine: missing volumes fall back to the defaults.

const SETTINGS_KEY = 'bar_settings_v1'

export interface Settings {
  sound:        boolean   // sound effects on/off
  music:        boolean   // background music on/off
  masterVolume: number    // 0..1
  musicVolume:  number    // 0..1
  sfxVolume:    number    // 0..1
}

const DEFAULTS: Settings = { sound: true, music: true, masterVolume: 0.8, musicVolume: 0.5, sfxVolume: 0.9 }

const vol = (v: unknown, d: number) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : d)

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULTS }
    const p = JSON.parse(raw) as Partial<Settings>
    return {
      sound: typeof p.sound === 'boolean' ? p.sound : DEFAULTS.sound,
      music: typeof p.music === 'boolean' ? p.music : DEFAULTS.music,
      masterVolume: vol(p.masterVolume, DEFAULTS.masterVolume),
      musicVolume:  vol(p.musicVolume,  DEFAULTS.musicVolume),
      sfxVolume:    vol(p.sfxVolume,    DEFAULTS.sfxVolume),
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    // storage unavailable — keep the in-memory value
  }
}
