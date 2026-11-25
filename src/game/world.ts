// ── Bengaluru street environment renderer ─────────────────────────────────────
//
// Art direction follows the neighbourhood references in /design/references (not shipped):
// front-facing pastel shop facades with maroon/navy signboards, striped
// awnings, warm-lit shopfronts, rooftop water tanks, hanging greenery, lush
// round-canopy trees, pink paver sidewalks, yellow/black kerbs and a dark
// purple-grey asphalt road with white lane dashes and zebra crossings.
//
// Everything is placed in WORLD space (worldY = scroll - screenY, css px), so
// a new neighbourhood's buildings scroll in naturally from the top instead of
// swapping all at once. Sprites are generated once at art resolution and
// cached; each frame is mostly drawImage calls.

import {
  PAL, WALLS, type WallKey, type IconName,
  hash, rng, makeCanvas, Pix, paintIcon, drawIconScaled,
  pixelText, knWidth10, FONT, KN_FONT,
} from './pixel'

// ── neighbourhoods ────────────────────────────────────────────────────────────

export const NEIGHBOURHOOD_DIST  = 3500
export const NEIGHBOURHOOD_NAMES = ['KORAMANGALA', 'WHITEFIELD', 'JAYANAGAR'] as const
export const NEIGHBOURHOOD_KN    = ['ಕೋರಮಂಗಲ', 'ವೈಟ್‌ಫೀಲ್ಡ್', 'ಜಯನಗರ'] as const

/** Neighbourhood index for a world-space Y position (css px). */
export function neighbourhoodAt(worldY: number): number {
  return Math.max(0, Math.floor(worldY / NEIGHBOURHOOD_DIST)) % 3
}

// ── layout ────────────────────────────────────────────────────────────────────

export interface Layout {
  w: number; h: number
  /** reference playfield width: the old 9:16 width at this height */
  bw: number
  /** css px per art pixel (integer) */
  px: number
  rL: number; rR: number; rW: number
  kerbW: number
  walkArt: number; walkW: number
  /** left edge of the left sidewalk */
  leftWalkX: number
  /** left edge of the right sidewalk */
  rightWalkX: number
}

/**
 * Road geometry is derived from the 9:16 reference width (bw) rather than the
 * full canvas width, so the road, the auto and every hitbox stay exactly the
 * size they were in the portrait build; extra width becomes scenery.
 */
export function computeLayout(w: number, h: number): Layout {
  const bw = Math.min(w, (h * 9) / 16)
  const px = Math.max(2, Math.min(4, Math.round(bw / 200)))
  return buildLayout(w, h, bw, px, Math.round(bw * 0.56))
}

/**
 * Layout for the main-menu cover panel only (portrait composition with a
 * narrower road, like the menu reference). Never used for gameplay.
 */
export function computePanelLayout(w: number, h: number): Layout {
  const px = w >= 760 ? 3 : 2
  return buildLayout(w, h, w * 0.5, px, Math.round(w * 0.28))
}

function buildLayout(w: number, h: number, bw: number, px: number, rW: number): Layout {
  const rL      = Math.round((w - rW) / 2)
  const rR      = rL + rW
  const kerbW   = px * 3
  const sideArt = Math.floor((rL - kerbW) / px)
  const walkArt = Math.max(8, Math.min(18, Math.floor(sideArt * 0.32)))
  const walkW   = walkArt * px
  return {
    w, h, bw, px, rL, rR, rW, kerbW, walkArt, walkW,
    leftWalkX:  rL - kerbW - walkW,
    rightWalkX: rR + kerbW,
  }
}

// ── themes ────────────────────────────────────────────────────────────────────

type Front   = 'cafe' | 'pub' | 'books' | 'clothes' | 'gym' | 'mall'
type Special = 'temple' | 'park' | 'metro'
type Gap     = 'trees' | 'cafe' | 'flowers' | 'parking' | 'garden'
type Back    = 'apartment' | 'office' | 'lot' | 'house'
type TreeKind = 'green' | 'yellow' | 'pink'

interface ShopDef {
  lines:   string[]
  kn?:     string
  icon?:   IconName
  sign:    string
  ink?:    string
  wall:    WallKey
  awning?: readonly [string, string]
  front:   Front
  tower?:  { glass: readonly [string, string]; frame: string }
}

interface Theme {
  shops:    ShopDef[]
  specials: Special[]
  gaps:     Gap[]
  backs:    Back[]
  trees:    TreeKind[]
}

const SIGN = {
  maroon:   '#7b2635',
  navy:     '#2c2f55',
  green:    '#1f6e3d',
  purple:   '#5a2a86',
  charcoal: '#2e2a3a',
  orange:   '#a8461a',
  teal:     '#1d5c66',
}
const AWN = {
  red:    ['#e0434f', '#fff4ec'] as const,
  pink:   ['#ec6f9a', '#fff4ec'] as const,
  yellow: ['#f6c12c', '#fff8e6'] as const,
}
const GLASS_BLUE = [PAL.glassA, PAL.glassB] as const
const GLASS_TEAL = ['#62c6d6', '#97dfe8'] as const
const GLASS_LAV  = ['#8fa8e8', '#b6c8f4'] as const

const THEMES: Theme[] = [
  // 0 · Koramangala — cafés, pubs, startups, pink trumpet trees
  {
    shops: [
      { lines: ['THIRD WAVE', 'COFFEE'], icon: 'cup', sign: SIGN.maroon, wall: 'lavender', front: 'cafe' },
      { lines: ['TOIT', 'BREWPUB'], icon: 'beer', sign: SIGN.maroon, wall: 'peach', front: 'pub' },
      { lines: ['KORAMANGALA', 'SOCIAL'], sign: SIGN.charcoal, ink: '#ffd54f', wall: 'stone', front: 'pub' },
      { lines: ['ZAP', 'FITNESS'], icon: 'dumbbell', sign: SIGN.navy, wall: 'lavender', front: 'gym' },
      { lines: ['NANDHANA', 'PALACE'], kn: 'ಹೋಟೆಲ್', icon: 'cloche', sign: SIGN.maroon, ink: '#ffd54f', wall: 'pink', awning: AWN.red, front: 'cafe' },
      { lines: ['CENTRAL', 'KORAMANGALA'], sign: SIGN.navy, wall: 'lilac', front: 'mall' },
      { lines: ['PUBG', 'LOUNGE'], icon: 'gamepad', sign: SIGN.purple, wall: 'lilac', front: 'pub' },
      { lines: ['THREADS', 'BOUTIQUE'], icon: 'shirt', sign: SIGN.teal, wall: 'peach', awning: AWN.yellow, front: 'clothes' },
    ],
    specials: [],
    gaps:  ['cafe', 'trees', 'garden', 'parking', 'cafe'],
    backs: ['apartment', 'office', 'apartment', 'lot'],
    trees: ['green', 'pink', 'green', 'pink'],
  },
  // 1 · Whitefield — glass tech parks, malls, metro
  {
    shops: [
      { lines: ['ITPL'], sign: SIGN.navy, wall: 'sky', front: 'mall', tower: { glass: GLASS_BLUE, frame: '#2c3e66' } },
      { lines: ['BRIGADE', 'TECH PARK'], sign: SIGN.navy, wall: 'sky', front: 'mall', tower: { glass: GLASS_TEAL, frame: '#24505a' } },
      { lines: ['BLUE TOKAI', 'COFFEE'], icon: 'cup', sign: SIGN.maroon, wall: 'cream', front: 'cafe' },
      { lines: ['WEWORK'], icon: 'laptop', sign: SIGN.charcoal, wall: 'stone', front: 'gym', tower: { glass: GLASS_LAV, frame: '#3a3550' } },
      { lines: ['WHITEFIELD', 'SOCIAL'], sign: SIGN.charcoal, ink: '#ffd54f', wall: 'lavender', front: 'pub' },
      { lines: ['RMZ', 'ECOWORLD'], sign: SIGN.navy, wall: 'sky', front: 'mall', tower: { glass: GLASS_BLUE, frame: '#33395e' } },
      { lines: ['ASCENDAS', 'PARK SQUARE'], icon: 'cube', sign: SIGN.navy, wall: 'sky', front: 'mall', tower: { glass: GLASS_TEAL, frame: '#2c3e66' } },
      { lines: ['PHOENIX', 'MARKETCITY'], icon: 'bird', sign: SIGN.maroon, ink: '#ffd54f', wall: 'lilac', awning: AWN.red, front: 'mall' },
      { lines: ['IBC KNOWLEDGE', 'PARK'], icon: 'bars', sign: SIGN.navy, wall: 'sky', front: 'mall', tower: { glass: GLASS_LAV, frame: '#2c3e66' } },
    ],
    specials: ['metro'],
    gaps:  ['trees', 'cafe', 'garden', 'trees'],
    backs: ['office', 'office', 'apartment', 'lot'],
    trees: ['green', 'pink', 'green'],
  },
  // 2 · Jayanagar — darshinis, bakeries, temple, park, flowering trees
  {
    shops: [
      { lines: ['DARSHINI'], kn: 'ದರ್ಶಿನಿ', icon: 'cup', sign: SIGN.maroon, wall: 'cream', front: 'cafe' },
      { lines: ['VB BAKERY'], kn: 'ಬೇಕರಿ', icon: 'cake', sign: SIGN.maroon, wall: 'pink', awning: AWN.pink, front: 'cafe' },
      { lines: ['JJM', 'BOOK HOUSE'], kn: 'ಪುಸ್ತಕ ಮನೆ', icon: 'book', sign: SIGN.navy, wall: 'peach', front: 'books' },
      { lines: ['MTR', 'TIFFINS'], kn: 'ಟಿಫಿನ್ಸ್', icon: 'bowl', sign: SIGN.maroon, wall: 'cream', awning: AWN.pink, front: 'cafe' },
      { lines: ['SILK', 'SAREES'], kn: 'ರೇಷ್ಮೆ ಸೀರೆ', icon: 'shirt', sign: SIGN.purple, wall: 'lilac', awning: AWN.yellow, front: 'clothes' },
      { lines: ['IYENGAR', 'BAKERY'], kn: 'ಅಯ್ಯಂಗಾರ್ ಬೇಕರಿ', icon: 'cake', sign: SIGN.orange, wall: 'mint', front: 'cafe' },
    ],
    specials: ['temple', 'park'],
    gaps:  ['flowers', 'trees', 'garden', 'trees'],
    backs: ['apartment', 'house', 'lot', 'house', 'apartment'],
    trees: ['green', 'yellow', 'yellow', 'pink'],
  },
]

// ── colour utils ─────────────────────────────────────────────────────────────

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16)
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)))
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255)
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}

const pick = <T,>(R: () => number, arr: readonly T[]): T => arr[Math.floor(R() * arr.length)]

// ── sprite cache ──────────────────────────────────────────────────────────────

interface SignText {
  x: number; y: number; w: number; h: number
  lines: string[]
  kn?: string
  color: string
}
interface Sprite { c: HTMLCanvasElement; texts: SignText[] }

const spriteCache = new Map<string, Sprite>()
function cached(key: string, gen: () => Sprite): Sprite {
  let s = spriteCache.get(key)
  if (!s) {
    if (spriteCache.size > 500) spriteCache.clear()
    s = gen()
    spriteCache.set(key, s)
  }
  return s
}

const canvasCache = new Map<string, HTMLCanvasElement>()
function cachedCanvas(key: string, gen: () => HTMLCanvasElement): HTMLCanvasElement {
  let c = canvasCache.get(key)
  if (!c) {
    if (canvasCache.size > 300) canvasCache.clear()
    c = gen()
    canvasCache.set(key, c)
  }
  return c
}

// ── trees ─────────────────────────────────────────────────────────────────────

const TREE_PAL: Record<TreeKind, readonly string[]> = {
  green:  [PAL.leafOl, PAL.leafDk, PAL.leaf, PAL.leafLt, PAL.leafHi],
  yellow: [PAL.leafOl, PAL.leafDk, PAL.leaf, PAL.leafLt, PAL.leafHi],
  pink:   [PAL.pinkOl, PAL.pinkDk, PAL.pink, PAL.pinkLt, PAL.pinkHi],
}

/** Round clustered canopy, lit from the top-left, trunk + ground shadow. */
function genTree(kind: TreeKind, D: number, seed: number): HTMLCanvasElement {
  const W = D + 4, H = D + 10
  const [c, g] = makeCanvas(W, H)
  const p = new Pix(g)
  const R = rng(seed)
  const cx = W / 2, cy = D / 2 + 1
  const [ol, dk, base, lt, hi] = TREE_PAL[kind]

  // ground shadow + trunk
  p.oval(Math.round(cx + 2), H - 4, Math.round(D * 0.38), 2, 'rgba(40,25,60,0.28)')
  const tx = Math.round(cx - 1.5)
  p.r(tx, Math.round(cy + D * 0.2), 4, H - 4 - Math.round(cy + D * 0.2), PAL.trunk)
  p.r(tx + 3, Math.round(cy + D * 0.2), 1, H - 4 - Math.round(cy + D * 0.2), PAL.trunkDk)
  p.r(tx - 1, H - 6, 1, 2, PAL.trunk); p.r(tx + 4, H - 5, 1, 1, PAL.trunkDk)
  p.r(tx - 1, Math.round(cy + D * 0.3), 1, 1, PAL.trunkDk)

  // canopy blobs
  const blobs: Array<{ x: number; y: number; r: number }> = [{ x: cx, y: cy, r: D * 0.33 }]
  const n = 6 + Math.floor(R() * 3)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + R() * 0.6
    const d = D * (0.2 + R() * 0.06)
    blobs.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.85, r: D * (0.17 + R() * 0.07) })
  }
  const mask: number[][] = []
  for (let y = 0; y < H; y++) {
    mask.push([])
    for (let x = 0; x < W; x++) {
      let idx = -1
      // later (outer) blobs sit on top of the core for clump definition
      for (let b = blobs.length - 1; b >= 0; b--) {
        const B = blobs[b]
        if ((x + 0.5 - B.x) ** 2 + (y + 0.5 - B.y) ** 2 <= B.r * B.r) { idx = b; break }
      }
      mask[y].push(idx)
    }
  }
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && mask[y][x] >= 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const b = mask[y][x]
      if (b < 0) continue
      const B  = blobs[b]
      const dx = (x + 0.5 - B.x) / B.r
      const dy = (y + 0.5 - B.y) / B.r
      const l  = -(dx * 0.62 + dy * 0.78) + (R() - 0.5) * 0.4
      let col  = l > 0.6 ? hi : l > 0.15 ? lt : l > -0.4 ? base : dk
      if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) col = ol
      else if (mask[y + 1]?.[x] !== b && mask[y + 1]?.[x] >= 0 && l < 0.3) col = dk
      p.p(x, y, col)
      if (col !== ol && l > -0.1) {
        if (kind === 'yellow' && R() < 0.09) p.p(x, y, PAL.flowerY)
        if (kind === 'pink'   && R() < 0.06) p.p(x, y, '#ffffff')
        if (kind === 'green'  && R() < 0.03) p.p(x, y, hi)
      }
    }
  }
  return c
}

function treeCanvas(kind: TreeKind, D: number, variant: number): HTMLCanvasElement {
  return cachedCanvas(`tree|${kind}|${D}|${variant}`, () => genTree(kind, D, hash(D, variant, kind.length)))
}

// ── shared facade parts ───────────────────────────────────────────────────────

function roofSlab(p: Pix, R: () => number, W: number, rh: number, top: string, edge: string): void {
  p.r(0, 0, W, rh, top)
  p.r(0, rh - 1, W, 1, edge)
  // black Sintex water tanks — the signature Bengaluru rooftop
  if (W >= 22 && R() < 0.85) {
    const tx = 3 + Math.floor(R() * (W - 13))
    p.box(tx, 0, 6, rh - 1, '#2c2a36', PAL.outline)
    p.r(tx + 1, 1, 1, rh - 3, '#5a586d')
  }
  if (W >= 40 && R() < 0.6) {
    const ax = 4 + Math.floor(R() * (W - 12))
    p.box(ax, 1, 5, 3, '#d4d7e0', PAL.outline2)
  }
  // rooftop potted plants
  const pots = Math.floor(W / 20)
  for (let i = 0; i < pots; i++) {
    if (R() < 0.5) continue
    const x = 2 + Math.floor(R() * (W - 6))
    p.r(x, rh - 3, 3, 2, PAL.leaf); p.p(x + 1, rh - 4, PAL.leafLt)
  }
}

function windowUnit(p: Pix, R: () => number, x: number, y: number, w: number, h: number, sill: string): void {
  p.r(x - 1, y - 1, w + 2, h + 2, '#5b4a6b')
  if (R() < 0.72) {
    p.r(x, y, w, h, PAL.lit)
    p.r(x, y, w, 1, PAL.litHi)
    p.r(x, y + h - 1, w, 1, PAL.litDk)
    if (R() < 0.45) {
      const sx = x + 1 + Math.floor(R() * Math.max(1, w - 3))
      p.r(sx, y + h - 3, 2, 3, PAL.silh)
      p.p(sx, y + h - 4, PAL.silh)
    }
  } else {
    p.r(x, y, w, h, '#7d8fb8')
    p.r(x, y, w, 1, '#a9bbdd')
    p.p(x + 1, y + 1, PAL.glassHi)
  }
  p.r(x + Math.floor(w / 2), y, 1, h, '#5b4a6b')
  p.r(x - 1, y + h + 1, w + 2, 1, sill)
  if (R() < 0.3) {
    // flower box
    p.r(x - 1, y + h + 2, w + 2, 1, '#9a6a44')
    for (let i = 0; i < w + 2; i++) if (R() < 0.7) p.p(x - 1 + i, y + h, R() < 0.3 ? '#ef6a8e' : PAL.leafLt)
  } else if (R() < 0.18) {
    // AC unit
    p.box(x + w + 1, y + h - 3, 4, 3, '#dfe2ea', PAL.outline2)
  }
}

function windowsGrid(p: Pix, R: () => number, x: number, y: number, w: number, h: number, sill: string, ww = 7, wh = 8): void {
  const gx = 4, gy = 5
  const cols = Math.max(1, Math.floor((w + gx) / (ww + gx)))
  const rows = Math.floor((h + gy) / (wh + gy))
  const ox   = x + Math.floor((w - (cols * (ww + gx) - gx)) / 2)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) windowUnit(p, R, ox + c * (ww + gx), y + 1 + r * (wh + gy), ww, wh, sill)
  }
}

function vines(p: Pix, R: () => number, W: number, top: number, bottom: number): void {
  const n = Math.max(1, Math.floor(W / 16))
  for (let i = 0; i < n; i++) {
    if (R() < 0.35) continue
    let x = R() < 0.5 ? 1 + Math.floor(R() * 4) : W - 5 - Math.floor(R() * 4)
    if (R() < 0.3) x = 2 + Math.floor(R() * (W - 6))
    const len = 4 + Math.floor(R() * Math.max(1, Math.min(16, bottom - top - 4)))
    for (let j = 0; j < len; j++) {
      const jx = x + (R() < 0.25 ? (R() < 0.5 ? -1 : 1) : 0)
      p.p(jx, top + j, j % 3 === 0 ? PAL.leafLt : PAL.leaf)
      if (R() < 0.45) p.p(jx + 1, top + j, PAL.leafDk)
      if (R() < 0.2)  p.p(jx - 1, top + j, PAL.leafHi)
    }
    p.r(x - 1, top + len, 3, 1, PAL.leafDk)
  }
}

function awning(p: Pix, x: number, y: number, w: number, h: number, cols: readonly [string, string]): void {
  p.r(x, y, w, 1, PAL.outline)
  for (let i = 0; i < w; i++) {
    const col = Math.floor(i / 3) % 2 ? cols[1] : cols[0]
    p.r(x + i, y + 1, 1, h - 2, col)
    if (i % 3 !== 2) p.p(x + i, y + h - 1, col)
  }
  p.r(x, y + 1, w, 1, 'rgba(255,255,255,0.35)')
}

function planter(p: Pix, x: number, y: number, R: () => number): void {
  p.box(x, y + 2, 7, 4, '#a8724a', PAL.outline)
  p.r(x + 1, y + 3, 5, 1, '#c48a5a')
  p.r(x, y - 1, 7, 3, PAL.leaf)
  p.r(x + 1, y - 2, 5, 1, PAL.leafLt)
  for (let i = 0; i < 4; i++) p.p(x + Math.floor(R() * 7), y - 1 + Math.floor(R() * 2), R() < 0.4 ? PAL.flowerY : PAL.leafHi)
  p.p(x, y - 1, PAL.leafDk); p.p(x + 6, y - 1, PAL.leafDk)
}

function person(p: Pix, x: number, y: number, c: string): void {
  p.r(x + 1, y, 3, 3, c)
  p.r(x, y + 3, 5, 4, c)
}

const BOOK_COLS = ['#c0392b', '#2e86de', '#27ae60', '#f39c12', '#8e44ad', '#e84393', '#16a085']

function shopfront(p: Pix, R: () => number, kind: Front, x: number, y: number, w: number, h: number): void {
  const modern = kind === 'gym' || kind === 'mall'
  const frameC = modern ? '#3a3f5c' : '#5b3a35'
  p.r(x, y, w, h, frameC)
  const n    = Math.max(2, Math.round(w / 12))
  const pw   = Math.floor((w - 1) / n) - 1
  const door = Math.floor(n / 2)
  for (let i = 0; i < n; i++) {
    const px = x + 1 + i * (pw + 1)
    const py = y + 1
    const ph = h - 2
    if (i === door && !modern) {
      p.r(px, py, pw, ph, '#8a5a44')
      p.r(px + 1, py + 1, pw - 2, Math.floor(ph / 2), PAL.lit)
      p.p(px + pw - 2, py + Math.floor(ph * 0.6), PAL.flowerY)
      continue
    }
    if (kind === 'gym') {
      p.r(px, py, pw, ph, PAL.glassB)
      p.r(px, py + ph - 4, pw, 4, PAL.glassDk)
      p.r(px + 1, py + ph - 6, pw - 2, 1, '#2b2b3a')
      if (R() < 0.6) person(p, px + Math.floor(R() * Math.max(1, pw - 5)), py + ph - 9, '#2c3e66')
    } else if (kind === 'mall') {
      p.r(px, py, pw, ph, PAL.glassB)
      p.r(px, py + Math.floor(ph / 2), pw, ph - Math.floor(ph / 2), PAL.lit)
      p.r(px, py + Math.floor(ph / 2), pw, 1, PAL.litHi)
      if (R() < 0.7) person(p, px + Math.floor(R() * Math.max(1, pw - 5)), py + ph - 8, PAL.silh)
    } else {
      const warm = kind === 'pub' ? '#f2b552' : PAL.lit
      p.r(px, py, pw, ph, warm)
      p.r(px, py, pw, 2, PAL.litHi)
      p.r(px, py + ph - 3, pw, 3, PAL.litDk)
      if (kind === 'books') {
        for (let s = py + 3; s < py + ph - 2; s += 4) {
          p.r(px, s + 3, pw, 1, '#6b4a3a')
          for (let b = 0; b < pw; b++) if (R() < 0.85) p.r(px + b, s, 1, 3, BOOK_COLS[Math.floor(R() * BOOK_COLS.length)])
        }
      } else if (kind === 'clothes') {
        p.r(px, py + 2, pw, 1, '#6b4a3a')
        for (let b = 1; b + 3 < pw; b += 4) {
          const cc = pick(R, ['#2e86de', '#ffffff', '#e84393', '#f39c12', '#8e44ad'])
          p.r(px + b, py + 3, 3, 4, cc); p.p(px + b - 1, py + 3, cc); p.p(px + b + 3, py + 3, cc)
        }
        if (R() < 0.6) person(p, px + Math.floor(R() * Math.max(1, pw - 5)), py + ph - 7, PAL.silh)
      } else {
        const ppl = 1 + Math.floor(R() * 2)
        for (let k = 0; k < ppl; k++) {
          if (R() < 0.8) person(p, px + Math.floor(R() * Math.max(1, pw - 5)), py + ph - 8, k ? PAL.silhDk : PAL.silh)
        }
        p.r(px, py + ph - 2, pw, 1, '#8a5a44')
      }
    }
    // glass glint
    p.p(px + 1, py + 1, 'rgba(255,255,255,0.8)')
    p.p(px + 2, py + 1, 'rgba(255,255,255,0.45)')
  }
  if (kind === 'pub') {
    // string lights
    for (let i = 0; i < w; i++) {
      const sag = Math.round(Math.sin((i / w) * Math.PI * 3) ** 2)
      p.p(x + i, y + 1 + sag, i % 3 === 0 ? '#fff6a8' : '#3b2a2a')
    }
  }
}

// ── building generators ───────────────────────────────────────────────────────

function signBoard(p: Pix, d: { sign: string; icon?: IconName; ink?: string }, x: number, y: number, w: number, h: number): number {
  p.box(x, y, w, h, d.sign, PAL.outline)
  p.r(x + 1, y + 1, w - 2, 1, shade(d.sign, 0.25))
  p.r(x + 1, y + h - 2, w - 2, 1, shade(d.sign, -0.3))
  // sign lamps
  for (let i = x + 4; i < x + w - 3; i += 10) p.p(i, y - 1, '#fff2b8')
  let tx = x + 3
  if (d.icon && w >= 44) {
    paintIcon(p, d.icon, x + 3, y + Math.floor((h - 9) / 2), d.ink ?? PAL.cream)
    tx = x + 14
  }
  return tx
}

function genShop(d: ShopDef, W: number, H: number, seed: number): Sprite {
  if (d.tower) return genTower(d, W, H, seed)
  const [c, g] = makeCanvas(W, H)
  const p = new Pix(g)
  const R = rng(seed)
  const [wb, ws, wh] = WALLS[d.wall]
  const texts: SignText[] = []
  const roofH = 5

  roofSlab(p, R, W, roofH, wh, ws)
  p.r(0, roofH, W, H - roofH, wb)
  p.r(W - 3, roofH, 3, H - roofH, ws)
  p.r(1, roofH, 1, H - roofH, wh)
  p.r(0, roofH, W, 1, ws)

  const baseH  = 3
  const frontH = Math.max(13, Math.min(22, Math.round(H * 0.24)))
  const awnH   = d.awning ? 5 : 0
  const want   = (d.kn ? 18 : d.lines.length > 1 ? 16 : 13) + (d.kn && d.lines.length > 1 ? 4 : 0)
  const signH  = Math.max(11, Math.min(want, Math.floor(H * 0.32)))
  const frontY = H - baseH - frontH
  const awnY   = frontY - awnH
  const signY  = awnY - signH - (d.awning ? 0 : 1)

  const upperTop = roofH + 3
  if (signY - 3 - upperTop >= 9) windowsGrid(p, R, 3, upperTop, W - 8, signY - 3 - upperTop, wh)
  vines(p, R, W, roofH + 1, signY - 1)

  const sx = 2, sw = W - 5
  const tx = signBoard(p, d, sx, signY, sw, signH)
  texts.push({ x: tx, y: signY + 1, w: sx + sw - 2 - tx, h: signH - 2, lines: d.lines, kn: d.kn, color: d.ink ?? PAL.cream })

  shopfront(p, R, d.front, 2, frontY, W - 5, frontH)
  if (d.awning) {
    p.r(2, frontY, W - 5, 2, 'rgba(60,30,40,0.25)')
    awning(p, 0, awnY, W - 1, awnH + 1, d.awning)
  }
  p.r(0, H - baseH, W, baseH, '#b9a6a8')
  p.r(0, H - baseH, W, 1, '#dacbcb')
  if (W >= 34) { planter(p, 1, H - baseH - 5, R); planter(p, W - 9, H - baseH - 5, R) }
  p.frame(0, 0, W, H, PAL.outline)
  return { c, texts }
}

function genTower(d: ShopDef | null, W: number, H: number, seed: number, glassIn?: readonly [string, string], frameIn?: string): Sprite {
  const [c, g] = makeCanvas(W, H)
  const p = new Pix(g)
  const R = rng(seed)
  const glass = d?.tower?.glass ?? glassIn ?? GLASS_BLUE
  const frame = d?.tower?.frame ?? frameIn ?? '#2c3e66'
  const texts: SignText[] = []
  const roofH = 5

  // roof: plant + railings
  p.r(0, 0, W, roofH, '#c9c4d6')
  p.r(0, roofH - 1, W, 1, '#9c96ae')
  for (let i = 3; i < W - 6; i += 9) if (R() < 0.7) p.box(i, 1, 5, 3, '#e4e6ee', PAL.outline2)
  for (let i = 0; i < W; i += 2) p.p(i, 0, '#8a849c')

  p.r(0, roofH, W, H - roofH, frame)

  let gy0 = roofH + 2
  if (d && d.lines.length) {
    const signH = d.lines.length > 1 ? 17 : 14
    const tx = signBoard(p, { sign: d.sign, icon: d.icon, ink: d.ink }, 2, roofH + 2, W - 5, signH)
    texts.push({ x: tx, y: roofH + 3, w: W - 5 - tx, h: signH - 2, lines: d.lines, kn: d.kn, color: d.ink ?? '#ffffff' })
    gy0 = roofH + 2 + signH + 2
  }
  const lobbyH = Math.max(12, Math.round(H * 0.16))
  const gy1    = H - lobbyH - 2
  const cw = 5, ch = 6
  const cols = Math.floor((W - 4) / (cw + 1))
  const ox   = Math.floor((W - cols * (cw + 1) + 1) / 2)
  const off  = Math.floor(R() * 7)
  for (let y = gy0, row = 0; y + ch <= gy1; y += ch + 1, row++) {
    for (let ci = 0; ci < cols; ci++) {
      const x = ox + ci * (cw + 1)
      const diag = (ci + row + off) % 9
      const col = diag < 2 ? PAL.glassHi : (ci + row) % 2 ? glass[0] : glass[1]
      p.r(x, y, cw, ch, col)
      p.r(x, y, cw, 1, shade(col, 0.25))
      if (R() < 0.08) { p.r(x, y + 2, cw, ch - 2, PAL.lit); p.r(x, y + 2, cw, 1, PAL.litHi) }
    }
    if (row % 3 === 2) p.r(1, y + ch, W - 2, 1, shade(frame, -0.25))
  }
  // vertical reflection band
  p.r(Math.floor(W * 0.22), gy0, 2, gy1 - gy0, 'rgba(255,255,255,0.14)')
  p.r(W - 3, roofH, 3, H - roofH, shade(frame, -0.3))

  // lobby
  const ly = H - lobbyH
  p.r(0, ly - 2, W, 2, shade(frame, -0.35))
  p.r(2, ly, W - 5, lobbyH - 3, PAL.lit)
  p.r(2, ly, W - 5, 2, PAL.litHi)
  for (let x = 2; x < W - 4; x += 8) p.r(x, ly, 1, lobbyH - 3, frame)
  for (let k = 0; k < Math.floor(W / 14); k++) if (R() < 0.7) person(p, 4 + Math.floor(R() * (W - 12)), H - 11, PAL.silh)
  p.r(0, H - 3, W, 3, '#b9a6a8')
  p.r(0, H - 3, W, 1, '#dacbcb')
  if (W >= 34) { planter(p, 2, H - 9, R); planter(p, W - 10, H - 9, R) }
  p.frame(0, 0, W, H, PAL.outline)
  return { c, texts }
}

function genApartment(W: number, H: number, seed: number, wall: WallKey): Sprite {
  const [c, g] = makeCanvas(W, H)
  const p = new Pix(g)
  const R = rng(seed)
  const [wb, ws, wh] = WALLS[wall]
  const roofH = 5
  roofSlab(p, R, W, roofH, wh, ws)
  p.r(0, roofH, W, H - roofH, wb)
  p.r(W - 3, roofH, 3, H - roofH, ws)
  p.r(0, roofH, W, 1, ws)

  const groundH = 16
  const floorH  = 15
  for (let fy = roofH + 2; fy + floorH <= H - groundH; fy += floorH) {
    windowsGrid(p, R, 3, fy + 1, W - 8, 9, wh, 7, 7)
    // balcony slab + railing + laundry
    const by = fy + floorH - 4
    p.r(1, by, W - 3, 1, wh)
    p.r(1, by + 1, W - 3, 2, ws)
    for (let x = 2; x < W - 3; x += 2) p.p(x, by - 1, '#5b4a6b')
    p.r(1, by - 2, W - 3, 1, '#5b4a6b')
    if (R() < 0.6) {
      const lx = 3 + Math.floor(R() * (W - 16))
      for (let i = 0; i < 9; i += 2) p.r(lx + i, by - 5, 1, 3, pick(R, ['#e84393', '#2e86de', '#f6c12c', '#ffffff', '#27ae60']))
    }
  }
  vines(p, R, W, roofH + 1, H - groundH)
  // ground floor: rolling-shutter shop or gate
  const gy = H - groundH
  p.r(0, gy, W, groundH, ws)
  if (R() < 0.55) {
    const sw = W - 10
    p.box(4, gy + 2, sw, groundH - 5, '#9aa0b4', PAL.outline)
    for (let y = gy + 3; y < H - 4; y += 2) p.r(5, y, sw - 2, 1, '#7d8398')
    const open = Math.floor((groundH - 5) * 0.55)
    p.r(5, H - 3 - open, sw - 2, open - 1, PAL.lit)
    p.r(5, H - 3 - open, sw - 2, 1, PAL.litHi)
    if (W > 30) person(p, 8 + Math.floor(R() * (sw - 14)), H - 11, PAL.silh)
  } else {
    p.r(0, gy + 5, W, groundH - 5, '#cdbdbb')
    p.box(Math.floor(W / 2) - 6, gy + 3, 12, groundH - 5, '#3b3048', PAL.outline)
    for (let x = Math.floor(W / 2) - 5; x < Math.floor(W / 2) + 5; x += 2) p.r(x, gy + 4, 1, groundH - 7, '#6b5a7e')
    planter(p, 2, H - 9, R)
    if (W > 30) planter(p, W - 10, H - 9, R)
  }
  p.r(0, H - 2, W, 2, '#b9a6a8')
  p.frame(0, 0, W, H, PAL.outline)
  return { c, texts: [] }
}

/** Independent house with Mangalore-tile roof and compound wall (Jayanagar). */
function genHouse(W: number, H: number, seed: number, wall: WallKey): Sprite {
  const [c, g] = makeCanvas(W, H)
  const p = new Pix(g)
  const R = rng(seed)
  const [wb, ws, wh] = WALLS[wall]
  // yard
  p.r(0, 0, W, H, PAL.lawn)
  for (let i = 0; i < W * H * 0.05; i++) p.p(Math.floor(R() * W), Math.floor(R() * H), R() < 0.5 ? PAL.lawnDk : PAL.lawnLt)
  const hx = 4, hw = W - 10
  const roofH = Math.round(H * 0.32)
  const wallY = 6 + roofH
  const houseH = H - wallY - 12
  // tiled roof
  for (let y = 6; y < 6 + roofH; y++) {
    const inset = Math.max(0, 3 - (y - 6))
    p.r(hx + inset, y, hw - inset * 2, 1, (y - 6) % 3 === 0 ? '#9e3d2c' : '#c8553d')
  }
  for (let x = hx + 3; x < hx + hw - 3; x += 4) p.r(x, 6, 1, roofH, 'rgba(120,40,30,0.5)')
  p.r(hx, 6 + roofH - 1, hw, 1, '#7a2a20')
  p.frame(hx, 6, hw, roofH, PAL.outline)
  // walls
  p.r(hx, wallY, hw, houseH, wb)
  p.r(hx + hw - 2, wallY, 2, houseH, ws)
  p.r(hx, wallY, hw, 1, wh)
  const wy = wallY + 3
  windowUnit(p, R, hx + 4, wy, 6, 6, wh)
  windowUnit(p, R, hx + hw - 11, wy, 6, 6, wh)
  p.box(hx + Math.floor(hw / 2) - 3, wallY + houseH - 10, 7, 10, '#8a5a44', PAL.outline)
  p.p(hx + Math.floor(hw / 2) + 2, wallY + houseH - 5, PAL.flowerY)
  p.frame(hx, wallY, hw, houseH, PAL.outline)
  // compound wall + gate + tulsi pot
  const cy = H - 7
  p.r(0, cy, W, 5, '#efe2d6')
  p.r(0, cy, W, 1, '#fff6ee')
  p.r(0, cy + 4, W, 1, '#c9b7a6')
  p.box(Math.floor(W / 2) - 5, cy - 1, 10, 6, '#3b3048', PAL.outline)
  for (let x = Math.floor(W / 2) - 4; x < Math.floor(W / 2) + 4; x += 2) p.r(x, cy, 1, 4, '#8a7a9e')
  p.box(3, cy - 4, 4, 4, '#c8553d', PAL.outline)
  p.r(3, cy - 6, 4, 2, PAL.leafLt)
  // bougainvillea over the wall
  for (let i = 0; i < 10; i++) {
    const x = W - 3 - Math.floor(R() * 12)
    p.p(x, cy - 1 - Math.floor(R() * 4), R() < 0.6 ? '#e0408a' : PAL.leaf)
  }
  p.r(0, H - 2, W, 2, '#b9a6a8')
  p.frame(0, 0, W, H, PAL.outline)
  return { c, texts: [] }
}

function lawnBase(p: Pix, R: () => number, W: number, H: number): void {
  p.r(0, 0, W, H, PAL.lawn)
  for (let y = 0; y < H; y += 4) for (let x = (y / 4) % 2 ? 0 : 4; x < W; x += 8) p.r(x, y, 4, 4, PAL.lawnLt)
  for (let i = 0; i < W * H * 0.04; i++) p.p(Math.floor(R() * W), Math.floor(R() * H), PAL.lawnDk)
}

function hedge(p: Pix, x: number, y: number, w: number): void {
  p.r(x, y, w, 4, PAL.leaf)
  p.r(x, y, w, 1, PAL.leafLt)
  p.r(x, y + 3, w, 1, PAL.leafDk)
  for (let i = x; i < x + w; i += 3) p.p(i, y + 1, PAL.leafHi)
}

function bench(p: Pix, x: number, y: number): void {
  p.r(x, y, 10, 2, '#a8724a')
  p.r(x, y + 2, 10, 1, '#7a4a2c')
  p.r(x + 1, y + 3, 1, 2, PAL.outline)
  p.r(x + 8, y + 3, 1, 2, PAL.outline)
  p.r(x, y - 2, 10, 1, '#c48a5a')
}

function stampTree(g: CanvasRenderingContext2D, kind: TreeKind, D: number, variant: number, cx: number, baseY: number): void {
  const t = treeCanvas(kind, D, variant)
  g.drawImage(t, Math.round(cx - t.width / 2), Math.round(baseY - t.height + 4))
}

function genLot(W: number, H: number, seed: number, th: Theme): Sprite {
  const [c, g] = makeCanvas(W, H)
  const p = new Pix(g)
  const R = rng(seed)
  lawnBase(p, R, W, H)
  // footpath
  const fx = Math.floor(W * (0.3 + R() * 0.4))
  p.r(fx, 0, 4, H, '#d9c7b4'); p.r(fx, 0, 1, H, '#efe2d6')
  if (H > 30 && R() < 0.6) bench(p, fx + 6, Math.floor(H * 0.5))
  const n = Math.max(1, Math.round(W / 30))
  for (let i = 0; i < n; i++) {
    const kind = th.trees[Math.floor(R() * th.trees.length)]
    const D = H >= 60 ? pick(R, [26, 30]) : pick(R, [20, 24])
    stampTree(g, kind, D, Math.floor(R() * 4), (i + 0.5) * (W / n) + (R() - 0.5) * 6, H - 3 - Math.floor(R() * Math.max(1, H - D - 12)))
  }
  hedge(p, 0, H - 4, W)
  p.frame(0, 0, W, H, PAL.leafOl)
  return { c, texts: [] }
}

function genGarden(W: number, H: number, seed: number, th: Theme): Sprite {
  const [c, g] = makeCanvas(W, H)
  const p = new Pix(g)
  const R = rng(seed)
  lawnBase(p, R, W, H)
  const flowers = ['#ef5350', '#ffd84a', '#ffffff', '#f48fb1', '#ff9f43']
  for (let y = 5; y < H - 8; y += 5) {
    p.r(3, y, W - 6, 3, '#7a4a2c')
    const fc = pick(R, flowers)
    for (let x = 4; x < W - 4; x += 2) { p.p(x, y, fc); p.p(x + 1, y + 1, PAL.leafLt) }
  }
  stampTree(g, pick(R, th.trees), 20, Math.floor(R() * 4), W - 12, H - 6)
  hedge(p, 0, H - 4, W)
  p.frame(0, 0, W, H, PAL.leafOl)
  return { c, texts: [] }
}

function umbrella(p: Pix, cx: number, y: number, col: string): void {
  p.r(cx, y + 4, 1, 6, '#5d4037')
  p.r(cx - 6, y + 2, 13, 3, col)
  p.r(cx - 4, y, 9, 2, col)
  p.r(cx - 2, y - 1, 5, 1, col)
  p.r(cx - 6, y + 4, 13, 1, shade(col, -0.25))
  p.r(cx - 3, y, 3, 1, 'rgba(255,255,255,0.55)')
  p.p(cx - 7, y + 3, PAL.outline); p.p(cx + 7, y + 3, PAL.outline)
}

function genCafe(W: number, H: number, seed: number): Sprite {
  const [c, g] = makeCanvas(W, H)
  const p = new Pix(g)
  const R = rng(seed)
  p.r(0, 0, W, H, '#e2cfc6')
  for (let y = 0; y < H; y += 6) for (let x = (y / 6) % 2 ? 0 : 3; x < W; x += 6) p.r(x, y, 1, 6, '#ccb5ad')
  for (let y = 0; y < H; y += 6) p.r(0, y, W, 1, '#ccb5ad')
  const n = Math.max(1, Math.floor(W / 24))
  const col = pick(R, ['#f6c12c', '#f6c12c', '#e0434f', '#3e9a4f'])
  for (let i = 0; i < n; i++) {
    const cx = Math.round((i + 0.5) * (W / n))
    const ty = Math.max(4, H - 18)
    p.box(cx - 3, ty + 8, 7, 3, '#8a5a44', PAL.outline)
    person(p, cx - 8, ty + 5, pick(R, ['#3a6ea5', '#c0392b', '#6b5a7e']))
    person(p, cx + 4, ty + 5, pick(R, ['#27ae60', '#e67e22', '#2c3e50']))
    umbrella(p, cx, ty - 3, col)
  }
  // string lights across the patio
  for (let x = 0; x < W; x++) p.p(x, 2 + Math.round(Math.sin(x / 5) ** 2), x % 3 ? '#3b2a2a' : '#fff6a8')
  planter(p, 1, H - 7, R)
  p.frame(0, 0, W, H, PAL.outline2)
  return { c, texts: [] }
}

function genFlowerStall(W: number, H: number, seed: number): Sprite {
  const [c, g] = makeCanvas(W, H)
  const p = new Pix(g)
  const R = rng(seed)
  p.r(0, 0, W, H, '#e2cfc6')
  for (let y = 0; y < H; y += 6) p.r(0, y, W, 1, '#ccb5ad')
  const sx = 3, sw = W - 6
  const ay = Math.max(2, H - 30)
  // stall table + buckets of flowers
  p.box(sx + 2, ay + 14, sw - 4, 8, '#8a5a44', PAL.outline)
  const cols = ['#ef5350', '#ffffff', '#ffd84a', '#f48fb1', '#ff9f43', '#ce93d8']
  for (let x = sx + 3; x < sx + sw - 8; x += 7) {
    p.box(x, ay + 19, 6, 5, '#b08060', PAL.outline)
    const fc = pick(R, cols)
    p.r(x, ay + 15, 6, 4, PAL.leaf)
    for (let k = 0; k < 7; k++) p.p(x + Math.floor(R() * 6), ay + 14 + Math.floor(R() * 4), fc)
  }
  // garland strings (mallige)
  for (let x = sx + 4; x < sx + sw - 4; x += 3) p.r(x, ay + 8, 1, 4, R() < 0.5 ? '#ffffff' : '#ff9f43')
  person(p, Math.floor(W / 2) - 2, ay + 7, '#c0392b')
  awning(p, sx, ay, sw, 7, AWN.yellow)
  p.r(sx, ay + 7, 1, 15, PAL.outline); p.r(sx + sw - 1, ay + 7, 1, 15, PAL.outline)
  p.frame(0, 0, W, H, PAL.outline2)
  return { c, texts: [] }
}

function genParking(W: number, H: number, seed: number): Sprite {
  const [c, g] = makeCanvas(W, H)
  const p = new Pix(g)
  const R = rng(seed)
  p.r(0, 0, W, H, '#8d8899')
  for (let i = 0; i < W * H * 0.05; i++) p.p(Math.floor(R() * W), Math.floor(R() * H), '#7d788a')
  for (let x = 2; x < W; x += 9) p.r(x, 2, 1, H - 4, '#e8e2ee')
  for (let x = 4; x + 6 < W; x += 9) {
    if (R() < 0.2) continue
    const y = 4 + Math.floor(R() * Math.max(1, H - 20))
    const col = pick(R, ['#c0392b', '#2e86de', '#f6c12c', '#ffffff', '#27ae60', '#2c2a36'])
    // scooter, top-down
    p.r(x + 2, y, 1, 2, PAL.outline)
    p.r(x, y + 2, 5, 1, PAL.metalDk)
    p.box(x + 1, y + 3, 3, 8, col, PAL.outline)
    p.r(x + 2, y + 6, 1, 3, '#2c2a36')
    p.r(x + 2, y + 11, 1, 2, PAL.outline)
  }
  p.frame(0, 0, W, H, PAL.outline2)
  return { c, texts: [] }
}

function genTemple(W: number, H: number, seed: number): Sprite {
  const [c, g] = makeCanvas(W, H)
  const p = new Pix(g)
  const R = rng(seed)
  const texts: SignText[] = []
  // stone courtyard
  p.r(0, 0, W, H, '#e8dccb')
  for (let y = 0; y < H; y += 5) p.r(0, y, W, 1, '#d6c6b0')
  for (let y = 0; y < H; y += 5) for (let x = (y / 5) % 2 ? 2 : 6; x < W; x += 8) p.r(x, y, 1, 5, '#d6c6b0')
  // gopuram tiers
  const cx = Math.floor(W / 2)
  const baseW = Math.min(W - 16, 62)
  const tiers = 6
  const tierH = Math.floor((H * 0.62) / tiers)
  let y = H - 30
  for (let t = 0; t < tiers; t++) {
    const tw = Math.round(baseW * (1 - t * 0.13))
    const x0 = cx - Math.floor(tw / 2)
    p.box(x0, y - tierH, tw, tierH + 1, t % 2 ? '#f3e0b0' : '#f7e9c6', PAL.outline)
    p.r(x0 + 1, y - tierH + 1, tw - 2, 1, '#e0603a')
    for (let x = x0 + 2; x < x0 + tw - 2; x += 3) p.r(x, y - tierH + 3, 1, tierH - 4, t % 2 ? '#d9a35a' : '#e7b872')
    for (let x = x0 + 3; x < x0 + tw - 3; x += 6) p.r(x, y - tierH + 2, 2, 2, '#4f9bd6')
    y -= tierH
  }
  // shikhara & kalasha
  p.box(cx - 7, y - 6, 15, 7, '#e0603a', PAL.outline)
  p.r(cx - 6, y - 5, 13, 1, '#f08a5d')
  p.r(cx - 1, y - 11, 3, 5, '#f2c230'); p.p(cx, y - 12, '#fff2b8')
  // flag
  p.r(cx + 6, y - 14, 1, 8, PAL.outline); p.r(cx + 7, y - 14, 5, 3, '#ff7a1a')
  // red & white striped compound wall (classic South Indian temple)
  const wy = H - 30
  p.r(0, wy, W, 10, '#ffffff')
  for (let x = 0; x < W; x += 6) p.r(x, wy, 3, 10, '#c8323a')
  p.r(0, wy, W, 1, PAL.outline); p.r(0, wy + 10, W, 1, PAL.outline)
  // entrance
  p.box(cx - 7, wy - 4, 14, 14, '#7a2a20', PAL.outline)
  p.r(cx - 5, wy - 2, 10, 11, PAL.lit)
  p.r(cx - 1, wy, 2, 6, '#f2c230')
  // sign board
  const sy = H - 18
  signBoard(p, { sign: SIGN.maroon, icon: 'temple', ink: PAL.cream }, 3, sy, W - 6, 15)
  texts.push({ x: 17, y: sy + 2, w: W - 22, h: 11, lines: ['RAGIGUDDA', 'TEMPLE'], kn: undefined, color: PAL.cream })
  // trees at the corners
  stampTree(g, 'yellow', 22, Math.floor(R() * 4), 9, wy - 2)
  stampTree(g, 'green', 22, Math.floor(R() * 4), W - 10, wy - 2)
  p.frame(0, 0, W, H, PAL.outline)
  return { c, texts }
}

function genPark(W: number, H: number, seed: number): Sprite {
  const [c, g] = makeCanvas(W, H)
  const p = new Pix(g)
  const R = rng(seed)
  lawnBase(p, R, W, H)
  // winding path
  for (let y = 0; y < H; y++) {
    const x = Math.round(W / 2 + Math.sin(y / 14) * W * 0.18)
    p.r(x - 3, y, 7, 1, '#dcc8b0')
    p.p(x - 3, y, '#efe2d6')
  }
  // trees
  stampTree(g, 'green',  30, Math.floor(R() * 4), W * 0.2, H * 0.42)
  stampTree(g, 'yellow', 26, Math.floor(R() * 4), W * 0.78, H * 0.36)
  stampTree(g, 'pink',   22, Math.floor(R() * 4), W * 0.62, H * 0.62)
  bench(p, Math.floor(W * 0.12), Math.floor(H * 0.64))
  // lamp posts
  for (const lx of [Math.floor(W * 0.3), Math.floor(W * 0.7)]) {
    p.r(lx, H - 42, 1, 10, PAL.outline)
    p.box(lx - 1, H - 45, 3, 3, '#fff2b8', PAL.outline)
  }
  // iron fence
  const fy = H - 20
  p.r(0, fy, W, 1, PAL.outline)
  p.r(0, fy + 5, W, 1, PAL.outline)
  for (let x = 0; x < W; x += 2) p.r(x, fy - 1, 1, 8, '#2c2a36')
  // arch gate with sign
  const gx = 6, gw = W - 12
  p.box(gx, fy - 22, 5, 30, '#f3e0b0', PAL.outline)
  p.box(gx + gw - 5, fy - 22, 5, 30, '#f3e0b0', PAL.outline)
  p.box(gx + 1, fy - 28, 3, 6, '#fff2b8', PAL.outline)
  p.box(gx + gw - 4, fy - 28, 3, 6, '#fff2b8', PAL.outline)
  const archY = fy - 22
  p.box(gx, archY - 16, gw, 17, '#f3e0b0', PAL.outline)
  p.r(gx + 1, archY - 15, gw - 2, 1, '#fff6e0')
  p.box(gx + 3, archY - 14, gw - 6, 13, SIGN.green, PAL.outline)
  const texts: SignText[] = [{
    x: gx + 5, y: archY - 13, w: gw - 10, h: 11,
    lines: ['JAYANAGAR PARK'], kn: 'ಜಯನಗರ ಉದ್ಯಾನವನ', color: '#ffffff',
  }]
  // flower beds by the gate
  for (let x = 2; x < W - 2; x++) if (x < gx + 8 || x > gx + gw - 8) p.p(x, fy + 8 + (x % 2), pick(R, ['#ef5350', '#ffd84a', '#ffffff', PAL.leafLt]))
  p.frame(0, 0, W, H, PAL.leafOl)
  return { c, texts }
}

function genMetro(W: number, H: number, seed: number): Sprite {
  const [c, g] = makeCanvas(W, H)
  const p = new Pix(g)
  const R = rng(seed)
  // plaza
  p.r(0, 0, W, H, '#ddd2dc')
  for (let y = 0; y < H; y += 6) p.r(0, y, W, 1, '#c9bccb')
  // elevated viaduct running away from the road
  p.r(0, 4, W, 12, '#cfc8d8')
  p.r(0, 4, W, 1, '#efe9f5')
  p.r(0, 15, W, 1, '#8f87a0')
  for (let x = 0; x < W; x += 14) p.box(x + 4, 16, 5, 14, '#bdb5c9', PAL.outline2)
  // purple line train on the viaduct
  p.box(2, 6, W - 4, 8, '#8e44ad', PAL.outline)
  p.r(3, 7, W - 6, 1, '#b57edc')
  for (let x = 5; x < W - 6; x += 6) p.r(x, 9, 4, 3, PAL.glassB)
  // station box
  const sy = 30, sh = H - sy - 6
  p.box(2, sy, W - 4, sh, '#7b3fb0', PAL.outline)
  p.r(3, sy + 1, W - 6, 1, '#a36ad6')
  const tx = signBoard(p, { sign: '#4a1f78', icon: 'train', ink: '#ffffff' }, 5, sy + 4, W - 10, 18)
  const texts: SignText[] = [{ x: tx, y: sy + 6, w: W - 7 - tx, h: 14, lines: ['WHITEFIELD', 'METRO'], kn: 'ಮೆಟ್ರೋ', color: '#ffffff' }]
  const gy = sy + 26
  for (let x = 6; x < W - 8; x += 8) {
    p.r(x, gy, 6, Math.max(4, sh - 36), PAL.glassB)
    p.r(x, gy, 6, 1, PAL.glassHi)
  }
  // entrance + stairs
  const ey = H - 18
  p.r(6, ey, W - 12, 10, PAL.lit)
  p.r(6, ey, W - 12, 1, PAL.litHi)
  for (let k = 0; k < Math.floor(W / 12); k++) if (R() < 0.8) person(p, 8 + Math.floor(R() * (W - 18)), ey + 2, PAL.silh)
  for (let y = H - 7; y < H - 1; y += 2) p.r(W / 2 - 10, y, 20, 1, '#a89cb4')
  p.frame(0, 0, W, H, PAL.outline)
  return { c, texts }
}

const BACK_WALLS: WallKey[] = ['pink', 'cream', 'lavender', 'peach', 'mint', 'lilac', 'stone']

function genBack(kind: Back, W: number, H: number, seed: number, th: Theme): Sprite {
  const R = rng(seed)
  switch (kind) {
    case 'office': {
      const glass = pick(R, [GLASS_BLUE, GLASS_TEAL, GLASS_LAV])
      return genTower(null, W, H, seed, glass, pick(R, ['#2c3e66', '#3a3550', '#24505a']))
    }
    case 'lot':   return genLot(W, H, seed, th)
    case 'house': return genHouse(W, H, seed, pick(R, BACK_WALLS))
    default:      return genApartment(W, H, seed, pick(R, BACK_WALLS))
  }
}

function genGap(kind: Gap, W: number, H: number, seed: number, th: Theme): Sprite {
  switch (kind) {
    case 'cafe':    return genCafe(W, H, seed)
    case 'flowers': return genFlowerStall(W, H, seed)
    case 'parking': return genParking(W, H, seed)
    case 'garden':  return genGarden(W, H, seed, th)
    default:        return genLot(W, H, seed, th)
  }
}

// ── column plans ──────────────────────────────────────────────────────────────

interface Plan { hs: number[]; offs: number[]; period: number; phase: number }
const planCache = new Map<string, Plan>()

function getPlan(side: number, col: number): Plan {
  const key = `${side}|${col}`
  let pl = planCache.get(key)
  if (pl) return pl
  const R = rng(hash(side, col, 4242))
  const hs: number[] = []
  const inner = col === 0
  const n = inner ? 13 : 10
  for (let i = 0; i < n; i++) {
    if (inner) {
      if (i === 4 || i === 10) hs.push(120)
      else if (R() < 0.28) hs.push(pick(R, [40, 44, 48]))
      else hs.push(pick(R, [72, 80, 88, 96]))
    } else {
      if (R() < 0.3) hs.push(pick(R, [44, 52]))
      else hs.push(pick(R, [64, 76, 88, 100]))
    }
  }
  const offs: number[] = []
  let acc = 0
  for (const v of hs) { offs.push(acc); acc += v }
  pl = { hs, offs, period: acc, phase: Math.floor(R() * acc) }
  planCache.set(key, pl)
  return pl
}

function slotSprite(nIdx: number, inner: boolean, hh: number, W: number, kh: number): Sprite {
  const th = THEMES[nIdx]
  const variant = (kh >>> 11) % 3
  if (hh < 60) {
    const gi = kh % th.gaps.length
    return cached(`g|${nIdx}|${gi}|${W}|${hh}|${variant}`, () => genGap(th.gaps[gi], W, hh, hash(nIdx, gi, variant, W), th))
  }
  if (inner) {
    if (hh >= 110 && th.specials.length) {
      const si = kh % th.specials.length
      const sp = th.specials[si]
      return cached(`x|${nIdx}|${sp}|${W}|${hh}`, () => {
        const sd = hash(nIdx, si, W)
        return sp === 'temple' ? genTemple(W, hh, sd) : sp === 'park' ? genPark(W, hh, sd) : genMetro(W, hh, sd)
      })
    }
    const si = kh % th.shops.length
    return cached(`s|${nIdx}|${si}|${W}|${hh}|${variant}`, () => genShop(th.shops[si], W, hh, hash(nIdx, si, variant, hh)))
  }
  const bi = kh % th.backs.length
  return cached(`b|${nIdx}|${bi}|${W}|${hh}|${variant}`, () => genBack(th.backs[bi], W, hh, hash(nIdx, bi, variant, W, hh), th))
}

// ── sign text (drawn at screen resolution so it stays legible) ───────────────

function drawSignText(ctx: CanvasRenderingContext2D, t: SignText, x: number, y: number, px: number): void {
  const rw = t.w * px, rh = t.h * px
  const maxChars = Math.max(...t.lines.map(l => l.length))
  const nLines = t.lines.length + (t.kn ? 1 : 0)
  let fs = Math.floor(Math.min((rw * 0.86) / maxChars, rh / (nLines * 1.25 + (t.kn ? 0.25 : 0)), px * 5))
  if (fs < 5) {
    if (!t.kn || rh < 10) return
    fs = 0
  }
  let knFs = 0
  if (t.kn) {
    knFs = Math.floor(Math.min((fs || rh / 1.6) * 1.35, (rw * 0.94 * 10) / knWidth10(ctx, t.kn)))
    if (knFs < 7) knFs = 0
  }
  const lh   = fs * 1.25
  const klh  = knFs * 1.15
  const tot  = (fs ? t.lines.length * lh : 0) + klh
  let cy     = y + rh / 2 - tot / 2
  const cx   = x + rw / 2
  if (knFs) {
    pixelText(ctx, t.kn!, cx, cy + klh / 2, knFs, t.color, 'center', 'rgba(20,10,30,0.5)', KN_FONT)
    cy += klh
  }
  if (fs) {
    for (const line of t.lines) {
      pixelText(ctx, line, cx, cy + lh / 2 + 1, fs, t.color)
      cy += lh
    }
  }
}

// ── side scenery ──────────────────────────────────────────────────────────────

const INNER_MAX = 104
const OUTER_W   = [92, 84, 100, 88]
const ALLEY     = 4

function drawColumns(ctx: CanvasRenderingContext2D, L: Layout, s: number, side: 0 | 1): void {
  const { px, h } = L
  const edge   = side === 0 ? L.leftWalkX : L.rightWalkX + L.walkW
  const room   = side === 0 ? edge : L.w - edge
  const innerW = Math.min(INNER_MAX, Math.floor(room / px))
  if (innerW < 20) return

  // alley ground
  ctx.fillStyle = '#bfa9a7'
  if (side === 0) ctx.fillRect(0, 0, edge, h)
  else ctx.fillRect(edge, 0, L.w - edge, h)

  let colX = side === 0 ? edge - innerW * px : edge
  let colW = innerW
  for (let col = 0; col < 6; col++) {
    if (side === 0 ? colX + colW * px <= 0 : colX >= L.w) break
    const plan = getPlan(side, col)
    const yMin = (s - h) / px - 130
    const yMax = s / px + 2
    const l0   = Math.floor((yMin - plan.phase) / plan.period)
    const l1   = Math.floor((yMax - plan.phase) / plan.period)
    for (let l = l0; l <= l1; l++) {
      const base = plan.phase + l * plan.period
      for (let i = 0; i < plan.hs.length; i++) {
        const hh  = plan.hs[i]
        const Y0  = base + plan.offs[i]
        const top = s - (Y0 + hh) * px
        if (top > h || top + hh * px < 0) continue
        const nIdx = neighbourhoodAt(Y0 * px)
        const kh   = hash(side, col, l, i)
        const spr  = slotSprite(nIdx, col === 0, hh, colW, kh)
        ctx.drawImage(spr.c, colX, top, colW * px, hh * px)
        for (const t of spr.texts) drawSignText(ctx, t, colX + t.x * px, top + t.y * px, px)
        // soft contact shadow between stacked buildings
        ctx.fillStyle = 'rgba(42,34,56,0.22)'
        ctx.fillRect(colX, top + hh * px, colW * px, px)
      }
    }
    // depth: outer columns sit slightly in shadow
    if (col > 0) {
      ctx.fillStyle = 'rgba(42,34,56,0.10)'
      ctx.fillRect(colX, 0, colW * px, h)
    }
    const nextW = OUTER_W[col % OUTER_W.length]
    if (side === 0) colX -= (ALLEY + nextW) * px
    else colX += (colW + ALLEY) * px
    colW = nextW
  }
}

function walkTile(walkArt: number, side: 0 | 1): HTMLCanvasElement {
  return cachedCanvas(`walk|${walkArt}|${side}`, () => {
    const H = 48
    const [c, g] = makeCanvas(walkArt, H)
    const p = new Pix(g)
    const R = rng(hash(walkArt, side, 7))
    p.r(0, 0, walkArt, H, PAL.walkDk)
    for (let row = 0; row < H / 6; row++) {
      const off = row % 2 ? 4 : 0
      for (let x = -off; x < walkArt; x += 8) {
        const tone = R()
        const col = tone < 0.15 ? '#d4b9b6' : tone > 0.85 ? PAL.walkLt : PAL.walk
        p.r(x + 1, row * 6 + 1, 7, 5, col)
        p.p(x + 1, row * 6 + 1, PAL.walkLt)
      }
    }
    // road-side curb lip + building-side shadow
    const roadX = side === 0 ? walkArt - 1 : 0
    const bldX  = side === 0 ? 0 : walkArt - 1
    p.r(roadX, 0, 1, H, PAL.walkEdge)
    p.r(bldX, 0, 1, H, '#b8999a')
    return c
  })
}

function drawSidewalks(ctx: CanvasRenderingContext2D, L: Layout, s: number): void {
  const { px, h, walkArt, walkW } = L
  const tileH = 48 * px
  const off   = ((s % tileH) + tileH) % tileH
  for (const side of [0, 1] as const) {
    const x = side === 0 ? L.leftWalkX : L.rightWalkX
    const t = walkTile(walkArt, side)
    for (let y = off - tileH; y < h; y += tileH) ctx.drawImage(t, x, y, walkW, tileH)
  }
}

// ── street furniture & pedestrians ────────────────────────────────────────────

/** Rect in art units relative to a css origin. */
function ar(ctx: CanvasRenderingContext2D, ox: number, oy: number, px: number, x: number, y: number, w: number, h: number, c: string): void {
  ctx.fillStyle = c
  ctx.fillRect(ox + x * px, oy + y * px, w * px, h * px)
}

function drawProp(ctx: CanvasRenderingContext2D, kind: number, ox: number, oy: number, px: number): void {
  const A = (x: number, y: number, w: number, h: number, c: string) => ar(ctx, ox, oy, px, x, y, w, h, c)
  switch (kind) {
    case 0: // green BBMP dustbin
      A(0, 0, 5, 7, PAL.outline); A(1, 1, 3, 5, '#3e9a4f'); A(1, 1, 3, 1, '#6cc27a'); A(1, 3, 3, 1, '#2e7a3d')
      A(1, 7, 4, 1, 'rgba(40,25,60,0.25)')
      break
    case 1: // planter box
      A(0, 2, 8, 5, PAL.outline); A(1, 3, 6, 3, '#a8724a')
      A(0, 0, 8, 3, PAL.leaf); A(1, -1, 6, 1, PAL.leafLt); A(2, 0, 1, 1, PAL.flowerY); A(5, 1, 1, 1, '#ef6a8e')
      break
    case 2: // bench (along the walk)
      A(0, 0, 3, 11, PAL.outline); A(1, 1, 1, 9, '#c48a5a'); A(2, 1, 1, 9, '#a8724a')
      A(3, 1, 1, 10, 'rgba(40,25,60,0.25)')
      break
    case 3: { // bicycle
      A(0, 2, 4, 4, PAL.outline); A(1, 3, 2, 2, '#bfa9a7')
      A(6, 2, 4, 4, PAL.outline); A(7, 3, 2, 2, '#bfa9a7')
      A(2, 2, 6, 1, '#d84b4b'); A(4, 0, 1, 3, '#d84b4b'); A(3, 0, 2, 1, PAL.outline); A(7, 0, 2, 1, PAL.outline)
      break
    }
    case 4: // bollards
      A(0, 0, 2, 3, PAL.outline); A(0, 0, 2, 1, PAL.kerbY)
      A(0, 6, 2, 3, PAL.outline); A(0, 6, 2, 1, PAL.kerbY)
      break
    case 5: // tender-coconut cart
      A(0, 2, 10, 5, PAL.outline); A(1, 3, 8, 3, '#8a5a44')
      for (let i = 0; i < 4; i++) A(1 + i * 2, 0, 2, 3, i % 2 ? '#5aa030' : '#6cb33a')
      A(1, 7, 2, 2, PAL.outline); A(7, 7, 2, 2, PAL.outline)
      break
  }
}

const SHIRTS = ['#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#ff7043', '#00897b', '#fdd835', '#ec407a']
const SKIN   = ['#c68642', '#8d5524', '#e0ac69', '#a86b3c']
const HAIR   = ['#1a1a1a', '#2b1b12', '#3d2a1e']

function drawWalker(ctx: CanvasRenderingContext2D, ox: number, oy: number, px: number, id: number, dir: number, frame: number): void {
  const A = (x: number, y: number, w: number, h: number, c: string) => ar(ctx, ox, oy, px, x, y, w, h, c)
  const shirt = SHIRTS[id % SHIRTS.length]
  const skin  = SKIN[(id >> 3) % SKIN.length]
  const hair  = HAIR[(id >> 5) % HAIR.length]
  const saree = (id >> 7) % 4 === 0
  A(0, 10, 5, 1, 'rgba(40,25,60,0.22)')
  // head
  A(1, 0, 3, 3, hair)
  if (dir > 0) A(1, 1, 3, 2, hair)           // walking away: back of head
  else A(1, 1, 3, 2, skin)                    // walking toward: face
  A(1, 0, 3, 1, hair)
  // torso + arms
  A(0, 3, 5, 3, shirt)
  const sw = frame ? 1 : 0
  A(0, 3 + sw, 1, 2, skin); A(4, 4 - sw, 1, 2, skin)
  if (saree) {
    A(1, 6, 3, 4, shirt); A(1, 9, 3, 1, '#ffd54f'); A(1, 3, 1, 3, '#ffd54f')
  } else {
    A(1, 6, 3, 2, '#34344a')
    A(1, 8, 1, 2 - sw, '#34344a'); A(3, 8, 1, 1 + sw, '#34344a')
    A(1, 10 - sw, 1, 1, PAL.outline); A(3, 9 + sw, 1, 1, PAL.outline)
  }
}

function drawStreetLife(ctx: CanvasRenderingContext2D, L: Layout, s: number, now: number): void {
  const { px, h, walkArt } = L
  const yMin = (s - h) / px - 20
  const yMax = s / px + 20
  for (const side of [0, 1] as const) {
    const wx = side === 0 ? L.leftWalkX : L.rightWalkX
    // props, close to the building side of the walk
    const PS = 36
    for (let k = Math.floor(yMin / PS); k <= Math.floor(yMax / PS); k++) {
      const hv = hash(k, side, 31)
      if (hv % 10 > 4) continue
      const kinds = walkArt >= 13 ? 6 : 3
      const kind  = (hv >>> 8) % kinds
      const Y  = k * PS + 18
      const sy = s - Y * px
      const lx = side === 0 ? 2 : walkArt - (kind === 3 || kind === 5 ? 11 : kind === 1 ? 9 : 6)
      drawProp(ctx, kind, wx + lx * px, sy, px)
    }
    // pedestrians: lanes of evenly spaced walkers moving with their own speed
    if (walkArt >= 9) {
      const lanes = [
        { f: 0.42, v: 13, S: 74 },
        { f: 0.62, v: -10, S: 86 },
      ]
      const t = now / 1000
      lanes.forEach((ln, li) => {
        const shift = ln.v * t
        for (let k = Math.floor((yMin - shift) / ln.S); k <= Math.floor((yMax - shift) / ln.S); k++) {
          const id = hash(k, side, li, 9)
          if (id % 10 > 5) continue
          const Y  = k * ln.S + shift + (id % 20)
          const sy = s - Y * px
          const lx = Math.round(walkArt * ln.f) - 2
          const frame = Math.floor(t * 5 + (id & 7)) % 2
          drawWalker(ctx, wx + lx * px, sy - 10 * px, px, id >>> 4, ln.v, frame)
        }
      })
    }
  }
}

function drawStreetTrees(ctx: CanvasRenderingContext2D, L: Layout, s: number): void {
  const { px, h } = L
  const TS = 58
  const yMin = (s - h) / px - 10
  const yMax = s / px + 50
  for (const side of [0, 1] as const) {
    for (let k = Math.floor(yMin / TS); k <= Math.floor(yMax / TS); k++) {
      const hv = hash(k, side, 77)
      if (hv % 10 > 6) continue
      const Y    = k * TS + (hv >>> 4) % 20
      const nIdx = neighbourhoodAt(Y * px)
      const th   = THEMES[nIdx]
      const kind = th.trees[(hv >>> 9) % th.trees.length]
      const D    = [26, 30, 34][(hv >>> 13) % 3]
      const t    = treeCanvas(kind, D, (hv >>> 16) % 4)
      const bx   = side === 0
        ? L.leftWalkX + (3 + ((hv >>> 18) % 3)) * px
        : L.rightWalkX + L.walkW - (3 + ((hv >>> 18) % 3)) * px
      const by   = s - Y * px
      ctx.drawImage(t, Math.round(bx - (t.width / 2) * px), by - (t.height - 4) * px, t.width * px, t.height * px)
    }
  }
}

function drawLamps(ctx: CanvasRenderingContext2D, L: Layout, s: number): void {
  const { px, h } = L
  const LS = 104
  const yMin = (s - h) / px - 4
  const yMax = s / px + 34
  for (const side of [0, 1] as const) {
    const phase = side === 0 ? 0 : 52
    for (let k = Math.floor((yMin - phase) / LS); k <= Math.floor((yMax - phase) / LS); k++) {
      const Y  = k * LS + phase
      const by = s - Y * px
      // base on the walk, near the kerb; arm reaches over the road
      const bx = side === 0 ? L.leftWalkX + L.walkW - 4 * px : L.rightWalkX + 2 * px
      const dir = side === 0 ? 1 : -1
      const A = (x: number, y: number, w: number, hh: number, c: string) => {
        ctx.fillStyle = c
        const xx = dir > 0 ? bx + x * px : bx - (x + w - 2) * px
        ctx.fillRect(xx, by + y * px, w * px, hh * px)
      }
      A(-1, -1, 4, 2, 'rgba(40,25,60,0.25)')
      A(0, -28, 2, 28, PAL.metalDk)
      A(0, -28, 1, 28, PAL.metalLt)
      A(-1, -3, 4, 3, PAL.metalDk)
      A(0, -29, 10, 2, PAL.metalDk)
      A(8, -29, 5, 3, PAL.outline)
      A(9, -28, 3, 1, '#fff2b8')
      // small warm halo just around the lamp head
      A(8, -30, 5, 1, 'rgba(255,226,120,0.45)')
      A(9, -26, 3, 1, 'rgba(255,226,120,0.45)')
    }
  }
}

// ── road ──────────────────────────────────────────────────────────────────────

function asphaltTile(artW: number, laneArt: number): HTMLCanvasElement {
  return cachedCanvas(`asph|${artW}`, () => {
    const H = 64
    const [c, g] = makeCanvas(artW, H)
    const p = new Pix(g)
    const R = rng(hash(artW, 5))
    p.r(0, 0, artW, H, PAL.asphalt)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < artW; x++) {
        // tyre-worn tracks in each lane
        const lp = (x % laneArt) / laneArt
        const track = Math.abs(lp - 0.3) < 0.06 || Math.abs(lp - 0.7) < 0.06
        const r = R()
        if (track && r < 0.22) p.p(x, y, PAL.asphaltDk)
        else if (r < 0.035) p.p(x, y, PAL.asphaltSp)
        else if (r < 0.07) p.p(x, y, PAL.asphaltDk)
        else if (r < 0.085) p.p(x, y, PAL.asphaltLt)
      }
    }
    return c
  })
}

function drawRoadDeco(ctx: CanvasRenderingContext2D, kind: number, ox: number, oy: number, px: number, v: number): void {
  const A = (x: number, y: number, w: number, h: number, c: string) => ar(ctx, ox, oy, px, x, y, w, h, c)
  switch (kind) {
    case 0: { // manhole cover
      const P: Array<[number, number, number]> = [[-2, -4, 5], [-3, -3, 7], [-4, -2, 9], [-4, -1, 9], [-4, 0, 9], [-4, 1, 9], [-4, 2, 9], [-3, 3, 7], [-2, 4, 5]]
      for (const [x, y, w] of P) A(x, y, w, 1, '#2f2d3a')
      for (const [x, y, w] of P.slice(1, -1)) A(x + 1, y, w - 2, 1, '#5d5b70')
      A(-2, -1, 5, 1, '#46445a'); A(-2, 1, 5, 1, '#46445a'); A(0, -3, 1, 7, '#46445a')
      break
    }
    case 1: { // tar patch
      const w = 10 + (v % 10), h = 6 + ((v >> 4) % 8)
      A(0, 0, w, h, '#3d3b49'); A(0, 0, w, 1, '#55536a'); A(1, h - 1, w - 1, 1, '#34323e')
      A(2 + (v % 4), 2, 2, 1, PAL.asphaltSp)
      break
    }
    case 2: { // crack
      let x = 0, y = 0
      for (let i = 0; i < 12; i++) { A(x, y, 1, 1, '#2f2d3a'); x += (v >> i) & 1 ? 1 : 0; y += 1; if (i === 6) A(x + 1, y, 2, 1, '#2f2d3a') }
      break
    }
    case 3: // oil stain
      A(-3, -1, 7, 3, 'rgba(25,20,35,0.35)'); A(-2, -2, 5, 5, 'rgba(25,20,35,0.25)')
      A(-1, -1, 1, 1, 'rgba(140,120,200,0.25)')
      break
    case 4: // painted straight-ahead arrow
      A(-1, -6, 2, 10, 'rgba(236,230,242,0.55)')
      A(-3, -6, 6, 1, 'rgba(236,230,242,0.55)'); A(-2, -8, 4, 2, 'rgba(236,230,242,0.55)'); A(-1, -9, 2, 1, 'rgba(236,230,242,0.55)')
      break
  }
}

function drawRoad(ctx: CanvasRenderingContext2D, L: Layout, s: number): void {
  const { px, h, rL, rR, rW, kerbW } = L
  const artW    = Math.ceil(rW / px)
  const laneArt = rW / px / 3
  const tile    = asphaltTile(artW, laneArt)
  const tileH   = 64 * px
  const off     = ((s % tileH) + tileH) % tileH

  ctx.save()
  ctx.beginPath(); ctx.rect(rL, 0, rW, h); ctx.clip()
  for (let y = off - tileH; y < h; y += tileH) ctx.drawImage(tile, rL, y, artW * px, tileH)

  const yMin = (s - h) / px - 20
  const yMax = s / px + 20

  // decorations
  const DS = 70
  for (let k = Math.floor(yMin / DS); k <= Math.floor(yMax / DS); k++) {
    const v = hash(k, 1234)
    const kind = v % 9
    if (kind > 4) continue
    const lane = (v >>> 6) % 3
    const lx   = rL + (lane + 0.25 + ((v >>> 10) % 50) / 100) * (rW / 3)
    drawRoadDeco(ctx, kind, Math.round(lx / px) * px, s - (k * DS + 30) * px, px, v >>> 3)
  }

  // zebra crossings (bars parallel to the direction of travel)
  const ZS = 520
  for (let k = Math.floor(yMin / ZS); k <= Math.floor((yMax + 14) / ZS); k++) {
    const top = s - (k * ZS + 200 + 12) * px
    for (let x = rL + 3 * px; x + 4 * px < rR - 2 * px; x += 7 * px) {
      ctx.fillStyle = PAL.lane
      ctx.fillRect(x, top, 4 * px, 12 * px)
      ctx.fillStyle = 'rgba(42,34,56,0.25)'
      ctx.fillRect(x, top + 12 * px, 4 * px, px)
    }
  }

  // lane dashes
  const DP = 24 * px, DL = 14 * px
  const dOff = ((s % DP) + DP) % DP
  for (let lane = 1; lane <= 2; lane++) {
    const x = Math.round((rL + (lane * rW) / 3) / px) * px - px
    for (let y = dOff - DP; y < h; y += DP) {
      ctx.fillStyle = PAL.lane
      ctx.fillRect(x, y, 2 * px, DL)
      ctx.fillStyle = 'rgba(42,34,56,0.3)'
      ctx.fillRect(x + 2 * px, y + px, px, DL - px)
    }
  }
  ctx.restore()

  // kerbs: yellow / black blocks with a dark outer edge
  const KP = 16 * px, KH = 8 * px
  const kOff = ((s % KP) + KP) % KP
  for (const kx of [rL - kerbW, rR]) {
    for (let y = kOff - KP; y < h; y += KP) {
      ctx.fillStyle = PAL.kerbY;  ctx.fillRect(kx, y, kerbW, KH)
      ctx.fillStyle = PAL.kerbYDk; ctx.fillRect(kx, y + KH - px, kerbW, px)
      ctx.fillStyle = PAL.kerbK;  ctx.fillRect(kx, y + KH, kerbW, KH)
    }
    ctx.fillStyle = 'rgba(42,34,56,0.45)'
    ctx.fillRect(kx === rR ? rR : rL - px, 0, px, h)
  }
}

// ── public entry points ───────────────────────────────────────────────────────

/** Ground layer: buildings, sidewalks, street life, road, trees, lamps. */
export function drawWorld(ctx: CanvasRenderingContext2D, L: Layout, scroll: number, now: number): void {
  const s = Math.round(scroll)
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#bfa9a7'
  ctx.fillRect(0, 0, L.w, L.h)
  drawColumns(ctx, L, s, 0)
  drawColumns(ctx, L, s, 1)
  drawSidewalks(ctx, L, s)
  drawStreetLife(ctx, L, s, now)
  drawRoad(ctx, L, s)
  drawStreetTrees(ctx, L, s)
  drawLamps(ctx, L, s)
}

/** World Y (css px) of every overhead gantry sign; the first welcomes the player. */
function gantryYs(s: number, h: number): number[] {
  const out: number[] = []
  const k0 = Math.max(1, Math.floor((s - h) / NEIGHBOURHOOD_DIST))
  for (let k = k0; k * NEIGHBOURHOOD_DIST <= s + 300; k++) out.push(k * NEIGHBOURHOOD_DIST)
  if (s - h < 600) out.unshift(-Math.round(h * 0.3))
  return out
}

/**
 * Overhead green gantry signs (Kannada + English) at every neighbourhood
 * boundary, drawn above traffic so you drive underneath them.
 */
export function drawOverhead(ctx: CanvasRenderingContext2D, L: Layout, scroll: number): void {
  const s = Math.round(scroll)
  const { px, h, rL, rW } = L
  for (const Y of gantryYs(s, h)) {
    const sy = s - Y
    const nIdx = neighbourhoodAt(Math.max(0, Y))
    const signW = Math.round(Math.min(rW * 0.94, 124 * px) / px) * px
    const signH = 26 * px
    const top   = sy - signH
    if (top > h + 40 * px || sy + 40 * px < 0) continue
    const cx    = Math.round(L.w / 2 / px) * px
    const x0    = cx - signW / 2

    // cast shadow on the road
    ctx.fillStyle = 'rgba(30,20,50,0.20)'
    ctx.fillRect(rL, sy + 10 * px, rW, 8 * px)

    // posts on both sidewalks + crossbeam
    for (const pxl of [L.leftWalkX + L.walkW - 6 * px, L.rightWalkX + 3 * px]) {
      ctx.fillStyle = PAL.outline;  ctx.fillRect(pxl - px, top + 4 * px, 5 * px, signH + 18 * px)
      ctx.fillStyle = PAL.metal;    ctx.fillRect(pxl, top + 4 * px, 3 * px, signH + 17 * px)
      ctx.fillStyle = PAL.metalLt;  ctx.fillRect(pxl, top + 4 * px, px, signH + 17 * px)
    }
    const beamL = L.leftWalkX + L.walkW - 6 * px
    const beamR = L.rightWalkX + 6 * px
    ctx.fillStyle = PAL.outline; ctx.fillRect(beamL, top + 8 * px, beamR - beamL, 5 * px)
    ctx.fillStyle = PAL.metal;   ctx.fillRect(beamL, top + 9 * px, beamR - beamL, 3 * px)
    ctx.fillStyle = PAL.metalLt; ctx.fillRect(beamL, top + 9 * px, beamR - beamL, px)

    // sign face
    ctx.fillStyle = PAL.outline; ctx.fillRect(x0 - px, top - px, signW + 2 * px, signH + 2 * px)
    ctx.fillStyle = '#1e8a4a';   ctx.fillRect(x0, top, signW, signH)
    ctx.fillStyle = '#2fa860';   ctx.fillRect(x0, top, signW, px)
    ctx.fillStyle = '#e9f7ee'
    ctx.fillRect(x0 + 2 * px, top + 2 * px, signW - 4 * px, px)
    ctx.fillRect(x0 + 2 * px, top + signH - 3 * px, signW - 4 * px, px)
    ctx.fillRect(x0 + 2 * px, top + 2 * px, px, signH - 4 * px)
    ctx.fillRect(x0 + signW - 3 * px, top + 2 * px, px, signH - 4 * px)

    const iconS = px
    drawIconScaled(ctx, nIdx === 2 ? 'tree' : 'building', x0 + 5 * px, top + 8.5 * px, iconS, '#e9f7ee')
    // up arrow
    const ax = x0 + signW - 13 * px, ay = top + 6 * px
    ctx.fillStyle = '#e9f7ee'
    ctx.fillRect(ax + 3 * px, ay + 3 * px, 2 * px, 11 * px)
    ctx.fillRect(ax + 2 * px, ay + 2 * px, 4 * px, 2 * px)
    ctx.fillRect(ax + px, ay + 3 * px, 6 * px, px)
    ctx.fillRect(ax, ay + 4 * px, 8 * px, px)
    ctx.fillRect(ax + 3 * px, ay, 2 * px, 2 * px)

    const textX0 = x0 + 16 * px, textX1 = ax - 2 * px
    const tw   = textX1 - textX0
    const name = NEIGHBOURHOOD_NAMES[nIdx]
    const kn   = NEIGHBOURHOOD_KN[nIdx]
    const efs  = Math.max(6, Math.floor(Math.min((tw * 0.95) / name.length, 4 * px)))
    const kfs  = Math.max(8, Math.floor(Math.min((tw * 0.9 * 10) / knWidth10(ctx, kn), 6 * px)))
    const tcx  = textX0 + tw / 2
    pixelText(ctx, kn, tcx, top + 9 * px, kfs, '#ffffff', 'center', 'rgba(10,40,20,0.6)', KN_FONT)
    pixelText(ctx, name, tcx, top + 19 * px, efs, '#ffffff', 'center', 'rgba(10,40,20,0.6)', FONT)
  }
}

/** Warm up the sprite cache so the first frames don't hitch. */
export function prewarmWorld(L: Layout): void {
  for (let n = 0; n < 3; n++) {
    for (const D of [26, 30, 34]) for (let v = 0; v < 4; v++) for (const k of THEMES[n].trees) treeCanvas(k, D, v)
  }
  walkTile(L.walkArt, 0); walkTile(L.walkArt, 1)
  asphaltTile(Math.ceil(L.rW / L.px), L.rW / L.px / 3)
}

// ── main-menu cover: sky, skyline and a tree line (menu panel only) ───────────

/**
 * Daytime sky band for the menu cover panel: pale-blue skyline silhouettes,
 * drifting pixel clouds and a row of canopies that hides the seam with the
 * street below. Gameplay never calls this.
 */
export function drawMenuSky(ctx: CanvasRenderingContext2D, L: Layout, skyH: number, now: number): void {
  const { w, px } = L
  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#8fd3f4'
  ctx.fillRect(0, 0, w, skyH)
  ctx.fillStyle = '#a9dcf6'
  ctx.fillRect(0, Math.round(skyH * 0.55), w, Math.round(skyH * 0.45))

  // skyline: two layers of towers with lit window dots
  for (const [layer, col, win, hMin, hMax] of [
    [0, '#b4daf2', '#d2ecfa', 0.35, 0.75],
    [1, '#93c3e6', '#bfe1f6', 0.25, 0.6],
  ] as const) {
    let x = -((layer * 13) % 17) * px
    let k = 0
    while (x < w) {
      const hv = hash(k++, layer, 515)
      const bwA = 8 + (hv % 10)
      const bh  = Math.round(skyH * (hMin + ((hv >>> 8) % 100) / 100 * (hMax - hMin)))
      const top = skyH - bh
      ctx.fillStyle = col
      ctx.fillRect(x, top, bwA * px, bh)
      if ((hv >>> 4) % 3 === 0) ctx.fillRect(x + Math.floor(bwA / 2) * px, top - 4 * px, px, 4 * px)
      ctx.fillStyle = win
      for (let wy = top + 3 * px; wy < skyH - 2 * px; wy += 4 * px) {
        for (let wx = x + 2 * px; wx < x + (bwA - 2) * px; wx += 3 * px) ctx.fillRect(wx, wy, px, px)
      }
      x += (bwA + 2 + ((hv >>> 12) % 4)) * px
    }
  }

  // drifting clouds
  const clouds = [[0.12, 0.18, 14], [0.55, 0.1, 18], [0.85, 0.26, 11]] as const
  ctx.fillStyle = '#ffffff'
  for (const [fx, fy, cw] of clouds) {
    const span = w + cw * px * 2
    const cx = ((fx * w + now * 0.006) % span) - cw * px
    const cy = Math.round(skyH * fy)
    ctx.fillRect(cx, cy + 2 * px, cw * px, 3 * px)
    ctx.fillRect(cx + 3 * px, cy, (cw - 7) * px, 2 * px)
    ctx.fillRect(cx + 5 * px, cy - px, 3 * px, px)
  }

  // tree line along the horizon
  const step = 22 * px
  for (let i = 0, x = -6 * px; x < w + step; i++, x += step) {
    const hv = hash(i, 811)
    const kind: TreeKind = hv % 5 === 0 ? 'pink' : 'green'
    const D = [26, 30][(hv >>> 4) % 2]
    const t = treeCanvas(kind, D, (hv >>> 8) % 4)
    const tw = t.width * px, th = t.height * px
    ctx.drawImage(t, x + ((hv >>> 12) % 5) * px, skyH + 8 * px - th, tw, th)
  }
}
