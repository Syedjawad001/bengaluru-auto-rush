const SAVE_KEY = 'bar_save_v1'

export interface PlayerStats {
  coins:      number
  totalRides: number
  totalFare:  number
  highScore:  number
}

const DEFAULTS: PlayerStats = { coins: 0, totalRides: 0, totalFare: 0, highScore: 0 }

export function loadStats(): PlayerStats {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return { ...DEFAULTS }
    const p = JSON.parse(raw) as Partial<PlayerStats>
    return {
      coins:      typeof p.coins      === 'number' && p.coins      >= 0 ? Math.floor(p.coins)      : 0,
      totalRides: typeof p.totalRides === 'number' && p.totalRides >= 0 ? Math.floor(p.totalRides) : 0,
      totalFare:  typeof p.totalFare  === 'number' && p.totalFare  >= 0 ? Math.floor(p.totalFare)  : 0,
      highScore:  typeof p.highScore  === 'number' && p.highScore  >= 0 ? Math.floor(p.highScore)  : 0,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveStats(s: PlayerStats): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s))
  } catch {
    // quota exceeded or private browsing — ignore
  }
}
