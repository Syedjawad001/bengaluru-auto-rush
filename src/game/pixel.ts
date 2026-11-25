// ── Pixel-art helpers shared by world, vehicle and HUD renderers ─────────────
//
// All environment art is generated procedurally at "art resolution" (1 art
// pixel = 1 canvas pixel) into small offscreen canvases, then blitted to the
// game canvas scaled by an integer pixel size with image smoothing disabled.
// That keeps one consistent pixel grid, crisp outlines and cheap frames.

export const FONT    = '"Press Start 2P", monospace'
export const KN_FONT = '"Noto Sans Kannada", "Kannada Sangam MN", "Kannada MN", "Tunga", "Nirmala UI", sans-serif'

// ── palette (sampled from the neighbourhood reference artwork) ──────────────

export const PAL = {
  outline:   '#2a2238',
  outline2:  '#4a3d5c',
  asphalt:   '#4b4959',
  asphaltDk: '#423f4f',
  asphaltLt: '#57556a',
  asphaltSp: '#615f74',
  lane:      '#ece6f2',
  kerbY:     '#f6c624',
  kerbYDk:   '#c99a12',
  kerbK:     '#2a2238',
  walk:      '#dcc4c1',
  walkDk:    '#c6abaa',
  walkLt:    '#ead7d3',
  walkEdge:  '#f3e6e2',
  glassA:    '#6fc1ee',
  glassB:    '#9bd8f6',
  glassDk:   '#3f7fb8',
  glassHi:   '#d8f3ff',
  lit:       '#ffd56a',
  litDk:     '#f0a640',
  litHi:     '#fff2b8',
  silh:      '#7a4b3d',
  silhDk:    '#5c3730',
  leafOl:    '#1f4d24',
  leafDk:    '#2f6d2c',
  leaf:      '#4e9b2f',
  leafLt:    '#7dc23b',
  leafHi:    '#b6e24e',
  flowerY:   '#ffd84a',
  pinkOl:    '#9c3f6f',
  pinkDk:    '#d0679d',
  pink:      '#ef93bf',
  pinkLt:    '#f8bfd9',
  pinkHi:    '#ffe3ef',
  trunk:     '#7a4a2c',
  trunkDk:   '#55331f',
  lawn:      '#6cb33a',
  lawnDk:    '#5a9e30',
  lawnLt:    '#86c94a',
  cream:     '#ffeccc',
  white:     '#f7f3fb',
  metal:     '#5d6478',
  metalLt:   '#8a91a6',
  metalDk:   '#3b3f50',
} as const

// Wall palettes: [base, shade, highlight]
export const WALLS = {
  pink:     ['#f2c3cc', '#d9a3b0', '#fbdde2'],
  lavender: ['#d9cbee', '#b9a8d6', '#ece3f8'],
  cream:    ['#f4e4c4', '#dcc79f', '#fbf1dc'],
  peach:    ['#f6cfae', '#dfb08b', '#fde3cc'],
  mint:     ['#cfe7d2', '#a9cdb0', '#e5f4e7'],
  lilac:    ['#e7c9e6', '#c9a5c8', '#f5e2f4'],
  stone:    ['#d8d0d6', '#b8aeb6', '#ece6ea'],
  sky:      ['#c9dcf0', '#a6bed8', '#e2eefa'],
} as const
export type WallKey = keyof typeof WALLS

// ── deterministic randomness ────────────────────────────────────────────────

export function hash(...ns: number[]): number {
  let h = 0x811c9dc5
  for (const n of ns) {
    h ^= n | 0
    h = Math.imul(h, 0x01000193)
    h ^= h >>> 13
    h = Math.imul(h, 0x5bd1e995)
    h ^= h >>> 15
  }
  return h >>> 0
}

export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── canvas + pixel painter ──────────────────────────────────────────────────

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width  = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  const g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  return [c, g]
}

/** Tiny integer-grid painter used by every sprite generator. */
export class Pix {
  g: CanvasRenderingContext2D
  constructor(g: CanvasRenderingContext2D) { this.g = g }
  r(x: number, y: number, w: number, h: number, c: string): void {
    if (w <= 0 || h <= 0) return
    this.g.fillStyle = c
    this.g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
  }
  p(x: number, y: number, c: string): void { this.r(x, y, 1, 1, c) }
  /** filled box with a 1-px outline */
  box(x: number, y: number, w: number, h: number, fill: string, ol: string): void {
    this.r(x, y, w, h, ol)
    this.r(x + 1, y + 1, w - 2, h - 2, fill)
  }
  /** 1-px outline only */
  frame(x: number, y: number, w: number, h: number, c: string): void {
    this.r(x, y, w, 1, c); this.r(x, y + h - 1, w, 1, c)
    this.r(x, y, 1, h, c); this.r(x + w - 1, y, 1, h, c)
  }
  /** filled disc, pixel-exact */
  disc(cx: number, cy: number, rad: number, c: string): void {
    for (let y = -rad; y <= rad; y++) {
      const span = Math.floor(Math.sqrt(rad * rad - y * y + rad * 0.6))
      this.r(cx - span, cy + y, span * 2 + 1, 1, c)
    }
  }
  /** filled ellipse, pixel-exact */
  oval(cx: number, cy: number, rx: number, ry: number, c: string): void {
    for (let y = -ry; y <= ry; y++) {
      const span = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.5))))
      this.r(cx - span, cy + y, span * 2 + 1, 1, c)
    }
  }
}

// ── 9×9 pixel icons for signboards ──────────────────────────────────────────

export const ICONS = {
  cup: [
    '..#..#...',
    '.#..#....',
    '..#..#...',
    '.........',
    '#######..',
    '#.....###',
    '#.....#.#',
    '.#...####',
    '..###....',
  ],
  cake: [
    '....#....',
    '....#....',
    '..#####..',
    '.#.....#.',
    '#########',
    '#.#.#.#.#',
    '#########',
    '#.......#',
    '#########',
  ],
  book: [
    '.........',
    '###...###',
    '#..#.#..#',
    '#..#.#..#',
    '#..#.#..#',
    '#..#.#..#',
    '###.#.###',
    '....#....',
    '.........',
  ],
  beer: [
    '.#.#.#...',
    '#######..',
    '#.....###',
    '#.#.#.#.#',
    '#.#.#.#.#',
    '#.#.#.###',
    '#.....#..',
    '#######..',
    '.........',
  ],
  dumbbell: [
    '.........',
    '##.....##',
    '##.....##',
    '###...###',
    '#########',
    '###...###',
    '##.....##',
    '##.....##',
    '.........',
  ],
  cloche: [
    '....#....',
    '...###...',
    '..#...#..',
    '.#.....#.',
    '.#.....#.',
    '#.......#',
    '#########',
    '.........',
    '#########',
  ],
  bowl: [
    '.#..#..#.',
    '..#..#...',
    '.#..#..#.',
    '.........',
    '#########',
    '#.......#',
    '.#.....#.',
    '..#####..',
    '...###...',
  ],
  gamepad: [
    '.........',
    '.#######.',
    '#.......#',
    '#.#...#.#',
    '###.#.#.#',
    '#.#...#.#',
    '#.......#',
    '.##...##.',
    '.........',
  ],
  train: [
    '.#######.',
    '#.......#',
    '#.##.##.#',
    '#.##.##.#',
    '#.......#',
    '#.#...#.#',
    '#########',
    '.#.....#.',
    '#.......#',
  ],
  shirt: [
    '.##...##.',
    '#########',
    '#.#####.#',
    '..#####..',
    '..#####..',
    '..#####..',
    '..#####..',
    '..#####..',
    '.........',
  ],
  cube: [
    '....#....',
    '..##.##..',
    '##.....##',
    '#.##.##.#',
    '#...#...#',
    '#...#...#',
    '##..#..##',
    '..#####..',
    '.........',
  ],
  bars: [
    '.........',
    '......#..',
    '....#.#..',
    '....#.#.#',
    '..#.#.#.#',
    '#.#.#.#.#',
    '#.#.#.#.#',
    '#########',
    '.........',
  ],
  bird: [
    '#.......#',
    '##.....##',
    '.##.#.##.',
    '..#####..',
    '...###...',
    '....#....',
    '...#.#...',
    '..#...#..',
    '.........',
  ],
  flower: [
    '...#.#...',
    '..#####..',
    '...###...',
    '#.#.#.#.#',
    '.#######.',
    '..#####..',
    '...###...',
    '....#....',
    '...###...',
  ],
  tree: [
    '...###...',
    '.#######.',
    '###.#.###',
    '#########',
    '.#######.',
    '...###...',
    '....#....',
    '....#....',
    '...###...',
  ],
  building: [
    '....#....',
    '...###...',
    '.#######.',
    '.#.#.#.#.',
    '.#######.',
    '.#.#.#.#.',
    '.#######.',
    '.#.#.#.#.',
    '#########',
  ],
  temple: [
    '....#....',
    '...###...',
    '..#.#.#..',
    '..#####..',
    '.#.#.#.#.',
    '.#######.',
    '#.#.#.#.#',
    '#########',
    '#.......#',
  ],
  laptop: [
    '.........',
    '.#######.',
    '.#.....#.',
    '.#.....#.',
    '.#.....#.',
    '.#######.',
    '#########',
    '#########',
    '.........',
  ],
} as const
export type IconName = keyof typeof ICONS

export function paintIcon(p: Pix, icon: IconName, x: number, y: number, c: string): void {
  const rows = ICONS[icon]
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j]
    for (let i = 0; i < row.length; i++) if (row[i] === '#') p.p(x + i, y + j, c)
  }
}

/** Draw an icon on the main canvas, one block per icon pixel. */
export function drawIconScaled(
  ctx: CanvasRenderingContext2D, icon: IconName,
  x: number, y: number, s: number, c: string,
): void {
  const rows = ICONS[icon]
  ctx.fillStyle = c
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j]
    for (let i = 0; i < row.length; i++) {
      if (row[i] === '#') ctx.fillRect(Math.round(x + i * s), Math.round(y + j * s), Math.ceil(s), Math.ceil(s))
    }
  }
}

// ── text ────────────────────────────────────────────────────────────────────

/** Pixel-font text with a hard 1-step drop shadow. */
export function pixelText(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number,
  fs: number, color: string,
  align: CanvasTextAlign = 'center',
  shadow: string | null = 'rgba(20,10,30,0.55)',
  font: string = FONT,
): void {
  ctx.font         = `${fs}px ${font}`
  ctx.textAlign    = align
  ctx.textBaseline = 'middle'
  const so = Math.max(1, Math.round(fs / 8))
  if (shadow) {
    ctx.fillStyle = shadow
    ctx.fillText(text, Math.round(x) + so, Math.round(y) + so)
  }
  ctx.fillStyle = color
  ctx.fillText(text, Math.round(x), Math.round(y))
}

const knWidthCache = new Map<string, number>()
/** width of Kannada text at 10px, cached; scale linearly for other sizes */
export function knWidth10(ctx: CanvasRenderingContext2D, text: string): number {
  let v = knWidthCache.get(text)
  if (v === undefined) {
    ctx.font = `10px ${KN_FONT}`
    v = ctx.measureText(text).width
    knWidthCache.set(text, v)
  }
  return v
}
