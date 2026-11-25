const GARAGE_KEY = 'bar_garage_v1'

export type ColorScheme = 'classic' | 'royal' | 'fire'

export interface GarageData {
  engineLevel:    number       // 0–3
  handlingLevel:  number       // 0–3
  brakeLevel:     number       // 0–3
  unlockedColors: ColorScheme[]
  equippedColor:  ColorScheme
}

// Per-level upgrade costs
export const ENGINE_COSTS:   readonly number[] = [15, 25, 40]
export const HANDLING_COSTS: readonly number[] = [12, 22, 35]
export const BRAKE_COSTS:    readonly number[] = [12, 22, 35]

// Cost to unlock each colour (classic is always free)
export const COLOR_COSTS: Record<ColorScheme, number> = { classic: 0, royal: 20, fire: 35 }

// Stat improvement per level (applied multiplicatively in GameCanvas)
export const ENGINE_BOOST   = 50   // +50 max speed per level
export const HANDLING_BOOST = 150  // +150 steer accel per level
export const BRAKE_BOOST    = 75   // +75 brake force per level

// Colour palette used by both Garage preview and in-game tinting
export const COLOR_DEFS: Record<ColorScheme, { label: string; body: string; hood: string; tint: string }> = {
  classic: { label: 'CLASSIC', body: '#f1c40f', hood: '#27ae60', tint: '' },
  royal:   { label: 'ROYAL',   body: '#9b59b6', hood: '#e67e22', tint: 'rgba(90,0,180,0.44)' },
  fire:    { label: 'FIRE',    body: '#e74c3c', hood: '#e67e22', tint: 'rgba(210,50,0,0.48)' },
}

const DEFAULTS: GarageData = {
  engineLevel:    0,
  handlingLevel:  0,
  brakeLevel:     0,
  unlockedColors: ['classic'],
  equippedColor:  'classic',
}

function clampLevel(v: unknown): number {
  return typeof v === 'number' && v >= 0 && v <= 3 ? Math.floor(v) : 0
}

function isColorScheme(v: unknown): v is ColorScheme {
  return v === 'classic' || v === 'royal' || v === 'fire'
}

export function loadGarage(): GarageData {
  try {
    const raw = localStorage.getItem(GARAGE_KEY)
    if (!raw) return { ...DEFAULTS, unlockedColors: ['classic'] }
    const p = JSON.parse(raw) as Partial<{
      engineLevel:    unknown
      handlingLevel:  unknown
      brakeLevel:     unknown
      unlockedColors: unknown
      equippedColor:  unknown
    }>
    const unlocked: ColorScheme[] = Array.isArray(p.unlockedColors)
      ? (p.unlockedColors.filter(isColorScheme) as ColorScheme[])
      : ['classic']
    if (!unlocked.includes('classic')) unlocked.unshift('classic')
    const equipped: ColorScheme =
      isColorScheme(p.equippedColor) && unlocked.includes(p.equippedColor)
        ? p.equippedColor
        : 'classic'
    return {
      engineLevel:    clampLevel(p.engineLevel),
      handlingLevel:  clampLevel(p.handlingLevel),
      brakeLevel:     clampLevel(p.brakeLevel),
      unlockedColors: unlocked,
      equippedColor:  equipped,
    }
  } catch {
    return { ...DEFAULTS, unlockedColors: ['classic'] }
  }
}

export function saveGarage(g: GarageData): void {
  try {
    localStorage.setItem(GARAGE_KEY, JSON.stringify(g))
  } catch {
    // quota exceeded or private browsing — ignore
  }
}
