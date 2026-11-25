// ── In-game HUD: chunky 8-bit panels with clear hierarchy ────────────────────
//
// Three framed panels across the top — SCORE/SPEED (left), MISSION (centre),
// HP/COINS (right). Sizes scale with the art pixel size so the HUD reads the
// same on phones and wide desktop windows, and stays out of the driving lane.

import { FONT, KN_FONT, PAL, pixelText } from './pixel'
import { NEIGHBOURHOOD_NAMES, NEIGHBOURHOOD_KN, type Layout } from './world'

export interface HudData {
  score:      number
  speed:      number
  maxSpeed:   number
  condition:  number
  coins:      number
  objective:  string
  objColor:   string
  hint?:      string
  detail?:    string
  detailColor?: string
  progress?:  number
  nIdx:       number
}

const INK    = '#f4eefc'
const MUTED  = '#b9a7d6'
const YELLOW = '#ffd54f'

/** HUD pixel unit: one step larger than the art pixel on wide desktop frames. */
function hudUnit(L: Layout): number {
  return L.px + (L.w >= 1100 ? 1 : 0)
}

function fonts(u: number): { S: number; B: number } {
  return u <= 2 ? { S: 7, B: 10 } : u === 3 ? { S: 8, B: 12 } : u === 4 ? { S: 10, B: 16 } : { S: 12, B: 18 }
}

/** Notched pixel panel: outline, body, bevel highlight and accent strip. */
export function hudPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, u: number, accent: string, body = 'rgba(36,26,56,0.93)'): void {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h)
  ctx.fillStyle = 'rgba(10,6,20,0.35)'
  ctx.fillRect(x + u, y + u, w, h)
  ctx.fillStyle = '#120c1e'
  ctx.fillRect(x + u, y, w - 2 * u, h)
  ctx.fillRect(x, y + u, w, h - 2 * u)
  ctx.fillStyle = body
  ctx.fillRect(x + u, y + u, w - 2 * u, h - 2 * u)
  ctx.fillStyle = 'rgba(120,96,170,0.45)'
  ctx.fillRect(x + u, y + u, w - 2 * u, u)
  ctx.fillStyle = accent
  ctx.fillRect(x + u, y + h - 2 * u, w - 2 * u, u)
}

function segBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, u: number, frac: number, n: number, color: (i: number) => string): void {
  const gap = u
  const sw  = Math.floor((w - gap * (n - 1)) / n)
  const on  = Math.round(Math.max(0, Math.min(1, frac)) * n)
  for (let i = 0; i < n; i++) {
    const sx = Math.round(x + i * (sw + gap))
    ctx.fillStyle = '#120c1e'
    ctx.fillRect(sx, y, sw, h)
    if (i < on) {
      ctx.fillStyle = color(i)
      ctx.fillRect(sx, y, sw, h)
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.fillRect(sx, y, sw, Math.max(1, Math.floor(u / 2)))
    } else {
      ctx.fillStyle = 'rgba(120,96,170,0.25)'
      ctx.fillRect(sx, y, sw, h)
    }
  }
}

function coinIcon(ctx: CanvasRenderingContext2D, x: number, y: number, u: number): void {
  const s = Math.max(1, Math.round(u * 0.75))
  const P = (cx: number, cy: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(x + cx * s, y + cy * s, w * s, h * s) }
  P(1, 0, 4, 6, '#7a5200'); P(0, 1, 6, 4, '#7a5200')
  P(1, 1, 4, 4, '#ffc928'); P(1, 1, 1, 2, '#fff1a0'); P(2, 2, 2, 2, '#e6a400')
}

/** HUD geometry shared with the React pause button so they line up exactly. */
export function hudMetrics(L: Layout): { u: number; m: number; ph: number; sideW: number } {
  const u = hudUnit(L)
  const { S } = fonts(u)
  return { u, m: 3 * u, ph: 21 * u, sideW: Math.max(46 * u, Math.round(S * 13 + 8 * u)) }
}

export function drawHUD(ctx: CanvasRenderingContext2D, L: Layout, d: HudData): void {
  const { u, m, ph, sideW } = hudMetrics(L)
  const { S, B } = fonts(u)

  // ── left: score + speed
  const lx = m
  hudPanel(ctx, lx, m, sideW, ph, u, YELLOW)
  pixelText(ctx, 'SCORE', lx + 4 * u, m + 5 * u, S, MUTED, 'left')
  pixelText(ctx, String(d.score).padStart(6, '0'), lx + 4 * u, m + 10.5 * u, B, YELLOW, 'left')
  const kmh = Math.round(d.speed * 0.1)
  pixelText(ctx, `${kmh}`, lx + 4 * u, m + 16.5 * u, S, INK, 'left')
  ctx.font = `${S}px ${FONT}`
  const kw = ctx.measureText('000').width
  pixelText(ctx, 'KM/H', lx + 5 * u + kw, m + 16.5 * u, Math.max(6, S - 2), MUTED, 'left')
  const barX = lx + 6 * u + kw + ctx.measureText('KM/H').width * 0.8
  segBar(ctx, barX, m + 15 * u, lx + sideW - 4 * u - barX, 3 * u, u, d.speed / d.maxSpeed, 8,
    i => (i < 4 ? '#66bb6a' : i < 6 ? '#ffd54f' : '#ff7043'))

  // ── right: HP + coins
  const rx = L.w - m - sideW
  const hpCol = d.condition > 50 ? '#66bb6a' : d.condition > 25 ? '#ffa726' : '#ef5350'
  hudPanel(ctx, rx, m, sideW, ph, u, hpCol)
  pixelText(ctx, 'HP', rx + 4 * u, m + 5 * u, S, MUTED, 'left')
  pixelText(ctx, String(Math.round(d.condition)).padStart(3, '0'), rx + sideW - 4 * u, m + 5 * u, S, hpCol, 'right')
  segBar(ctx, rx + 4 * u, m + 8 * u, sideW - 8 * u, 4 * u, u, d.condition / 100, 10, () => hpCol)
  coinIcon(ctx, rx + 4 * u, m + 14 * u, u)
  pixelText(ctx, String(d.coins), rx + sideW - 4 * u, m + 16.5 * u, S, YELLOW, 'right')

  // ── centre: mission
  const gap   = 2 * u
  let cw      = Math.min(L.w - 2 * m - 2 * sideW - 2 * gap, 132 * u)
  let cx0     = L.w / 2 - cw / 2
  let cy0     = m
  if (cw < 64 * u) {
    cw  = Math.min(L.w - 2 * m, 110 * u)
    cx0 = L.w / 2 - cw / 2
    cy0 = m + ph + u
  }
  hudPanel(ctx, cx0, cy0, cw, ph, u, '#aa3bff')
  const ccx = L.w / 2
  const objFs = Math.min(B, Math.floor((cw - 8 * u) / Math.max(1, d.objective.length)))
  pixelText(ctx, d.objective, ccx, cy0 + 6 * u, Math.max(6, objFs), d.objColor)

  // neighbourhood line: English + Kannada
  const en = NEIGHBOURHOOD_NAMES[d.nIdx]
  const kn = NEIGHBOURHOOD_KN[d.nIdx]
  const sF = Math.max(6, S - 1)
  const kF = Math.round(sF * 1.35)
  ctx.font = `${sF}px ${FONT}`
  const ew = ctx.measureText(en).width
  ctx.font = `${kF}px ${KN_FONT}`
  const kw2 = ctx.measureText(kn).width
  const tot = ew + 3 * u + kw2
  const ly  = cy0 + 11.5 * u
  if (tot < cw - 6 * u) {
    pixelText(ctx, en, ccx - tot / 2, ly, sF, YELLOW, 'left')
    pixelText(ctx, kn, ccx - tot / 2 + ew + 3 * u, ly, kF, '#ffe9a0', 'left', 'rgba(20,10,30,0.5)', KN_FONT)
  } else {
    pixelText(ctx, en, ccx, ly, sF, YELLOW)
  }

  // bottom row: trip progress / timer / hint
  const by = cy0 + 15.5 * u
  if (d.progress !== undefined || d.detail) {
    let right = cx0 + cw - 4 * u
    if (d.detail) {
      ctx.font = `${S}px ${FONT}`
      const dw = ctx.measureText(d.detail).width
      pixelText(ctx, d.detail, right, by + 1.5 * u, S, d.detailColor ?? INK, 'right')
      right -= dw + 3 * u
    }
    if (d.progress !== undefined) {
      const bx = cx0 + 4 * u
      const bw = right - bx
      ctx.fillStyle = '#120c1e'
      ctx.fillRect(bx, by, bw, 3 * u)
      ctx.fillStyle = 'rgba(120,96,170,0.3)'
      ctx.fillRect(bx + u, by + u, bw - 2 * u, u)
      const fw = Math.round((bw - 2 * u) * Math.max(0, Math.min(1, d.progress)))
      ctx.fillStyle = '#66bb6a'
      ctx.fillRect(bx + u, by + u, fw, u)
      // destination flag at the end, auto marker at the current point
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(bx + bw - u, by - u, u, 5 * u)
      ctx.fillStyle = YELLOW
      ctx.fillRect(bx + u + fw - u, by - u, 2 * u, 5 * u)
    }
  } else if (d.hint) {
    pixelText(ctx, d.hint, ccx, by + 1.5 * u, Math.max(6, S - 1), MUTED)
  }
}

/** Green road-sign style banner announcing a new neighbourhood. */
export function drawNeighbourhoodBanner(ctx: CanvasRenderingContext2D, L: Layout, nIdx: number, alpha: number): void {
  const u  = hudUnit(L)
  const { S } = fonts(u)
  const w  = Math.min(L.w - 6 * u, 104 * u)
  const h  = 26 * u
  const x  = Math.round(L.w / 2 - w / 2)
  const y  = Math.round(L.h * 0.2)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = PAL.outline
  ctx.fillRect(x - u, y - u, w + 2 * u, h + 2 * u)
  ctx.fillStyle = '#1e8a4a'
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = '#e9f7ee'
  ctx.fillRect(x + 2 * u, y + 2 * u, w - 4 * u, u)
  ctx.fillRect(x + 2 * u, y + h - 3 * u, w - 4 * u, u)
  ctx.fillRect(x + 2 * u, y + 2 * u, u, h - 4 * u)
  ctx.fillRect(x + w - 3 * u, y + 2 * u, u, h - 4 * u)
  pixelText(ctx, 'ENTERING', L.w / 2, y + 6 * u, Math.max(6, S - 1), '#bff0d0', 'center', 'rgba(10,40,20,0.6)')
  pixelText(ctx, NEIGHBOURHOOD_KN[nIdx], L.w / 2, y + 12.5 * u, Math.round(S * 1.6), '#ffffff', 'center', 'rgba(10,40,20,0.6)', KN_FONT)
  pixelText(ctx, NEIGHBOURHOOD_NAMES[nIdx], L.w / 2, y + 19.5 * u, Math.round(S * 1.2), '#ffffff', 'center', 'rgba(10,40,20,0.6)')
  ctx.restore()
}

/** Short toast in the HUD style (pickups, near misses). */
export function drawToast(ctx: CanvasRenderingContext2D, L: Layout, text: string, color: string, alpha: number, y: number): void {
  const u = hudUnit(L)
  const { B } = fonts(u)
  ctx.font = `${B}px ${FONT}`
  const tw = ctx.measureText(text).width
  const w  = Math.min(L.w - 6 * u, tw + 12 * u)
  const fs = tw + 12 * u > w ? Math.floor(B * (w - 12 * u) / tw) : B
  const h  = 13 * u
  ctx.save()
  ctx.globalAlpha = alpha
  hudPanel(ctx, L.w / 2 - w / 2, y, w, h, u, color)
  pixelText(ctx, text, L.w / 2, y + 6 * u, fs, color)
  ctx.restore()
}

/** Floating score pop near the player (near-miss feedback). */
export function drawPop(ctx: CanvasRenderingContext2D, L: Layout, text: string, x: number, y: number, alpha: number): void {
  const { S } = fonts(hudUnit(L))
  ctx.save()
  ctx.globalAlpha = alpha
  pixelText(ctx, text, x, y, S + 2, '#ffd54f', 'center', '#2a2238')
  ctx.restore()
}
