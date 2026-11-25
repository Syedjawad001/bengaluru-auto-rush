// ── Pixel-art traffic, hazards and mission markers ───────────────────────────
//
// Every sprite here is drawn inside the exact hit-box the game logic already
// uses (centre ± hw/hl), so collisions are unchanged — only the art differs.
// Oncoming traffic faces DOWN the screen (front at the bottom).

import { PAL, Pix, makeCanvas, rng, FONT, pixelText } from './pixel'

const cache = new Map<string, HTMLCanvasElement>()
function sprite(key: string, w: number, h: number, draw: (p: Pix, w: number, h: number) => void): HTMLCanvasElement {
  let c = cache.get(key)
  if (!c) {
    if (cache.size > 200) cache.clear()
    const [cv, g] = makeCanvas(w, h)
    draw(new Pix(g), w, h)
    c = cv
    cache.set(key, c)
  }
  return c
}

function blit(ctx: CanvasRenderingContext2D, c: HTMLCanvasElement, cx: number, cy: number, px: number, shadow = true): void {
  const w = c.width * px, h = c.height * px
  const x = Math.round(cx - w / 2), y = Math.round(cy - h / 2)
  if (shadow) {
    ctx.fillStyle = 'rgba(24,14,40,0.30)'
    ctx.fillRect(x + px, y + 2 * px, w, h)
  }
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(c, x, y, w, h)
}

// ── traffic ───────────────────────────────────────────────────────────────────

const CAR_COLS = ['#e8e8ee', '#c0392b', '#9aa3b5', '#2e5fa8', '#f6c12c', '#2c2a36', '#1f7a5a']

function drawCar(p: Pix, W: number, H: number, body: string): void {
  const dk = PAL.outline
  const bx = 1, bw = W - 2
  // wheels peeking out
  for (const wy of [Math.round(H * 0.17), Math.round(H * 0.7)]) {
    p.r(0, wy, 1, Math.max(3, Math.round(H * 0.13)), dk)
    p.r(W - 1, wy, 1, Math.max(3, Math.round(H * 0.13)), dk)
  }
  // body
  p.r(bx + 1, 0, bw - 2, H, dk)
  p.r(bx, 1, bw, H - 2, dk)
  p.r(bx + 1, 1, bw - 2, H - 2, body)
  p.r(bx + 1, 1, 1, H - 2, 'rgba(255,255,255,0.35)')
  p.r(bx + bw - 2, 1, 1, H - 2, 'rgba(0,0,0,0.22)')
  // rear window (top), roof, windshield (bottom)
  const rwY = Math.round(H * 0.2), roofY = Math.round(H * 0.32), wsY = Math.round(H * 0.6), hoodY = Math.round(H * 0.76)
  p.r(bx + 2, rwY, bw - 4, roofY - rwY, '#2d3f63')
  p.r(bx + 2, roofY, bw - 4, wsY - roofY, body)
  p.r(bx + 3, roofY + 1, bw - 6, 1, 'rgba(255,255,255,0.3)')
  p.r(bx + 2, wsY, bw - 4, hoodY - wsY, '#2d3f63')
  p.r(bx + 3, wsY + 1, 2, 1, PAL.glassHi)
  // mirrors
  p.p(0, wsY, body); p.p(W - 1, wsY, body)
  // lights
  p.r(bx + 1, H - 2, 2, 1, '#fff6c8'); p.r(bx + bw - 3, H - 2, 2, 1, '#fff6c8')
  p.r(bx + 1, 1, 2, 1, '#e23b3b');     p.r(bx + bw - 3, 1, 2, 1, '#e23b3b')
}

function drawAuto(p: Pix, W: number, H: number): void {
  const dk = PAL.outline
  // rear wheels + single front wheel
  p.r(0, Math.round(H * 0.16), 1, 4, dk); p.r(W - 1, Math.round(H * 0.16), 1, 4, dk)
  p.r(Math.floor(W / 2) - 1, H - 2, 3, 2, dk)
  // body tapers toward the front
  for (let y = 0; y < H - 1; y++) {
    const t = y / H
    const inset = t > 0.7 ? Math.round((t - 0.7) * W * 0.9) : 0
    p.r(1 + inset, y, W - 2 - inset * 2, 1, dk)
    if (y > 0 && y < H - 2) p.r(2 + inset, y, W - 4 - inset * 2, 1, '#2f8f3f')
  }
  // black canopy with ribs
  const cTop = 1, cBot = Math.round(H * 0.66)
  p.r(2, cTop, W - 4, cBot - cTop, '#2b2b33')
  for (let y = cTop + 2; y < cBot; y += 3) p.r(2, y, W - 4, 1, '#44444f')
  p.r(2, cTop, 1, cBot - cTop, '#55556a')
  // yellow trim + windshield
  p.r(2, cBot, W - 4, 1, '#f6c624')
  p.r(3, cBot + 1, W - 6, 2, '#2d3f63')
  p.p(4, cBot + 1, PAL.glassHi)
  p.p(Math.floor(W / 2), H - 3, '#fff6c8')
}

function drawBus(p: Pix, W: number, H: number, body: string): void {
  const dk = PAL.outline
  p.r(1, 0, W - 2, H, dk)
  p.r(0, 1, W, H - 2, dk)
  p.r(1, 1, W - 2, H - 2, body)
  // window strips along both sides
  for (let y = 4; y < H - 7; y += 4) {
    p.r(1, y, 1, 3, '#2d3f63'); p.r(W - 2, y, 1, 3, '#2d3f63')
  }
  // roof with AC pods and hatches
  p.r(3, 3, W - 6, H - 9, '#d9dde6')
  p.r(3, 3, 1, H - 9, '#f2f4f8')
  p.r(W - 4, 3, 1, H - 9, '#aab0bf')
  p.box(4, Math.round(H * 0.2), W - 8, Math.max(4, Math.round(H * 0.16)), '#c4c9d6', PAL.outline2)
  p.box(5, Math.round(H * 0.55), W - 10, 4, '#c4c9d6', PAL.outline2)
  p.r(Math.floor(W / 2) - 1, Math.round(H * 0.45), 3, 2, PAL.metal)
  // stripe
  p.r(2, H - 9, W - 4, 1, '#ffffff')
  // windshield + LED destination board
  p.r(2, H - 6, W - 4, 3, '#2d3f63')
  p.r(3, H - 6, 2, 1, PAL.glassHi)
  for (let x = 4; x < W - 4; x += 2) p.p(x, H - 7, '#ffb020')
  p.r(2, H - 2, 2, 1, '#fff6c8'); p.r(W - 4, H - 2, 2, 1, '#fff6c8')
  p.r(2, 1, 2, 1, '#e23b3b');     p.r(W - 4, 1, 2, 1, '#e23b3b')
}

function drawTruck(p: Pix, W: number, H: number, cab: string, load: number): void {
  const dk = PAL.outline
  const cabY = Math.round(H * 0.7)
  // wheels
  for (const wy of [Math.round(H * 0.12), Math.round(H * 0.5), cabY + 3]) {
    p.r(0, wy, 1, 4, dk); p.r(W - 1, wy, 1, 4, dk)
  }
  // cargo bed
  p.box(1, 0, W - 2, cabY, '#7a5a3a', dk)
  if (load === 0) {
    // blue tarpaulin with ropes
    p.r(2, 1, W - 4, cabY - 2, '#2f5fa6')
    p.r(2, 1, 1, cabY - 2, '#4f84c8')
    for (let y = 3; y < cabY - 2; y += 5) for (let x = 2; x < W - 2; x++) if ((x + y) % 4 === 0) p.p(x, y + ((x >> 1) % 2), '#d9c08a')
  } else {
    // sacks of rice / produce
    p.r(2, 1, W - 4, cabY - 2, '#5a3f2a')
    for (let y = 2; y < cabY - 4; y += 4) {
      for (let x = 3; x < W - 5; x += 5) {
        p.box(x, y, 5, 4, load === 1 ? '#e8d6a8' : '#e06040', PAL.outline2)
        p.p(x + 1, y + 1, '#fff6dc')
      }
    }
  }
  // cab
  p.box(1, cabY, W - 2, H - cabY, cab, dk)
  p.r(2, cabY + 1, W - 4, 1, 'rgba(255,255,255,0.4)')
  p.r(3, cabY + 2, W - 6, 2, '#2d3f63')
  p.p(4, cabY + 2, PAL.glassHi)
  // painted bumper + lamps
  p.r(2, H - 2, W - 4, 1, '#e23b3b')
  p.r(2, H - 2, 2, 1, '#fff6c8'); p.r(W - 4, H - 2, 2, 1, '#fff6c8')
}

export function drawTrafficVehicle(
  ctx: CanvasRenderingContext2D,
  type: number, variant: number,
  cx: number, cy: number,
  hw: number, hl: number,
  px: number,
): void {
  const W = Math.max(8, Math.round((hw * 2) / px))
  const H = Math.max(10, Math.round((hl * 2) / px))
  let c: HTMLCanvasElement
  if (type === 0) {
    const col = ['#c8323a', '#2f6fd6', '#2e8b57'][variant % 3]
    c = sprite(`bus|${W}|${H}|${col}`, W, H, (p, w, h) => drawBus(p, w, h, col))
  } else if (type === 1) {
    if (variant % 3 === 1) {
      c = sprite(`auto|${W}|${H}`, W, H, (p, w, h) => drawAuto(p, w, h))
    } else {
      const col = CAR_COLS[variant % CAR_COLS.length]
      c = sprite(`car|${W}|${H}|${col}`, W, H, (p, w, h) => drawCar(p, w, h, col))
    }
  } else {
    const cab = ['#f2a33a', '#e8c53a', '#3e9a4f'][variant % 3]
    const load = variant % 3
    c = sprite(`truck|${W}|${H}|${cab}|${load}`, W, H, (p, w, h) => drawTruck(p, w, h, cab, load))
  }
  blit(ctx, c, cx, cy, px)
}

// ── hazards ───────────────────────────────────────────────────────────────────

export function drawPothole(ctx: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hl: number, px: number): void {
  const W = Math.max(6, Math.round((hw * 2) / px)), H = Math.max(6, Math.round((hl * 2) / px))
  const c = sprite(`pot|${W}|${H}`, W, H, (p, w, h) => {
    const R = rng(w * 31 + h)
    const rx = w / 2, ry = h / 2
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (x + 0.5 - rx) / rx, dy = (y + 0.5 - ry) / ry
        const d = Math.sqrt(dx * dx + dy * dy) + (R() - 0.5) * 0.18
        if (d > 1) continue
        let col = d > 0.82 ? '#6a6878' : d > 0.7 ? '#2a2333' : '#1d1826'
        if (d < 0.55 && dy > -0.1) col = '#4f6a8f'           // muddy water
        if (d < 0.3 && dy > 0 && dx < 0) col = '#86a6cf'      // glint
        p.p(x, y, col)
      }
    }
    // cracks radiating out
    p.p(0, Math.floor(h / 2), '#2a2333'); p.p(w - 1, Math.floor(h / 3), '#2a2333')
  })
  blit(ctx, c, cx, cy, px, false)
}

export function drawDog(ctx: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hl: number, px: number): void {
  const W = Math.max(7, Math.round((hw * 2) / px)), H = Math.max(10, Math.round((hl * 2) / px))
  const c = sprite(`dog|${W}|${H}`, W, H, (p, w, h) => {
    const mx = Math.floor(w / 2)
    const fur = '#c8903c', furDk = '#9a6a24', furLt = '#e6b860'
    // tail (top)
    p.r(mx, 0, 1, 3, furDk); p.p(mx + 1, 0, furDk)
    // legs
    const ly1 = Math.round(h * 0.28), ly2 = Math.round(h * 0.6)
    for (const ly of [ly1, ly2]) { p.r(mx - 3, ly, 1, 2, furDk); p.r(mx + 3, ly, 1, 2, furDk) }
    // body
    p.r(mx - 2, 3, 5, Math.round(h * 0.6), PAL.outline)
    p.r(mx - 1, 4, 3, Math.round(h * 0.6) - 2, fur)
    p.r(mx - 1, 4, 1, Math.round(h * 0.6) - 2, furLt)
    p.r(mx, Math.round(h * 0.35), 2, 2, '#ffffff')
    // head (bottom, facing the player)
    const hy = Math.round(h * 0.62)
    p.box(mx - 2, hy, 5, 4, fur, PAL.outline)
    p.p(mx - 2, hy, furDk); p.p(mx + 2, hy, furDk)        // ears
    p.p(mx - 1, hy + 1, PAL.outline); p.p(mx + 1, hy + 1, PAL.outline)
    p.r(mx, hy + 3, 1, 2, PAL.outline)                    // snout
  })
  blit(ctx, c, cx, cy, px)
}

// ── mission markers ───────────────────────────────────────────────────────────

/** Waving passenger at the kerb with a bouncing pixel arrow. */
export function drawPassenger(
  ctx: CanvasRenderingContext2D, cx: number, cy: number,
  approaching: boolean, now: number, px: number,
): void {
  const wave = Math.floor(now / 220) % 2
  const c = sprite(`pass|${wave}`, 9, 14, (p) => {
    p.r(2, 13, 6, 1, 'rgba(40,25,60,0.3)')
    p.r(3, 0, 3, 1, '#1a1a1a'); p.r(3, 1, 3, 2, '#c68642'); p.p(3, 1, '#1a1a1a')
    p.r(2, 3, 5, 5, '#ff8f00'); p.r(2, 3, 1, 5, '#ffb340')
    // waving arm
    if (wave) { p.r(7, 1, 1, 3, '#c68642'); p.p(7, 0, '#c68642') }
    else      { p.r(7, 2, 1, 3, '#c68642'); p.p(8, 1, '#c68642') }
    p.r(1, 4, 1, 3, '#c68642')
    p.box(0, 6, 3, 3, '#5c6bc0', PAL.outline)          // bag
    p.r(3, 8, 3, 3, '#34344a'); p.p(3, 11, PAL.outline); p.p(5, 11, PAL.outline)
  })
  blit(ctx, c, cx, cy - 7 * px, px, false)

  // bouncing arrow
  const bounce = Math.round(Math.sin(now / 160) * 2) * px
  const ay = cy - 24 * px + bounce
  ctx.fillStyle = PAL.outline
  ctx.fillRect(cx - 4 * px, ay - px, 9 * px, 3 * px)
  ctx.fillRect(cx - 3 * px, ay + 2 * px, 7 * px, 2 * px)
  ctx.fillRect(cx - 2 * px, ay + 4 * px, 5 * px, 2 * px)
  ctx.fillRect(cx - px, ay + 6 * px, 3 * px, 2 * px)
  ctx.fillStyle = '#ffd54f'
  ctx.fillRect(cx - 3 * px, ay, 7 * px, px)
  ctx.fillRect(cx - 2 * px, ay + px, 5 * px, 2 * px)
  ctx.fillRect(cx - px, ay + 3 * px, 3 * px, 2 * px)
  ctx.fillRect(cx, ay + 5 * px, px, 2 * px)

  if (approaching) {
    const pulse = (Math.sin(now / 150) + 1) * 0.5
    ctx.strokeStyle = `rgba(255,213,79,${(0.4 + pulse * 0.5).toFixed(2)})`
    ctx.lineWidth = px
    ctx.setLineDash([2 * px, 2 * px])
    ctx.beginPath()
    ctx.arc(cx, cy - 6 * px, 18 * px + pulse * 4 * px, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  }
}

export function drawPackage(ctx: CanvasRenderingContext2D, cx: number, cy: number, hw: number, now: number, px: number): void {
  const W = Math.max(6, Math.round((hw * 2) / px))
  const c = sprite(`pkg|${W}`, W, W, (p, w, h) => {
    p.box(0, 0, w, h, '#c8a24a', '#3a2800')
    p.r(1, 1, w - 2, 1, '#e6c46a')
    p.r(1, Math.floor(h / 2) - 1, w - 2, 2, '#7a5219')
    p.r(Math.floor(w / 2) - 1, 1, 2, h - 2, '#7a5219')
    p.r(w - 2, 1, 1, h - 2, '#a8823a')
  })
  const bounce = Math.round(Math.sin(now / 350) * 2) * px
  const pulse = 0.4 + 0.4 * Math.sin(now / 500)
  ctx.strokeStyle = `rgba(255,213,79,${pulse.toFixed(2)})`
  ctx.lineWidth = px
  ctx.setLineDash([2 * px, 2 * px])
  ctx.beginPath()
  ctx.arc(cx, cy + bounce, hw + 6 * px, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  blit(ctx, c, cx, cy + bounce, px)
}

export function drawDestMarker(ctx: CanvasRenderingContext2D, cx: number, cy: number, name: string, now: number, px: number): void {
  const pulse = (Math.sin(now / 220) + 1) * 0.5
  ctx.strokeStyle = `rgba(102,187,106,${(0.4 + pulse * 0.5).toFixed(2)})`
  ctx.lineWidth = px
  ctx.beginPath()
  ctx.ellipse(cx, cy, 26 * px / 2 + pulse * 3 * px, 10 * px / 2 + pulse * px, 0, 0, Math.PI * 2)
  ctx.stroke()
  // pole + checkered flag
  const pole = 22 * px
  ctx.fillStyle = PAL.outline
  ctx.fillRect(cx - px, cy - pole, 2 * px, pole)
  const fx = cx + px, fy = cy - pole
  ctx.fillRect(fx - px, fy - px, 10 * px, 6 * px)
  for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) {
    ctx.fillStyle = (i + j) % 2 ? '#1a1a1a' : '#ffffff'
    ctx.fillRect(fx + i * 2 * px, fy + j * 2 * px, 2 * px, 2 * px)
  }
  // label plate
  const fs = Math.max(7, 3 * px)
  ctx.font = `${fs}px ${FONT}`
  const tw = ctx.measureText(name).width
  const lx = cx - tw / 2 - 3 * px, ly = fy - 9 * px
  ctx.fillStyle = PAL.outline
  ctx.fillRect(lx - px, ly - px, tw + 8 * px, fs + 6 * px)
  ctx.fillStyle = '#1e8a4a'
  ctx.fillRect(lx, ly, tw + 6 * px, fs + 4 * px)
  pixelText(ctx, name, cx, ly + (fs + 4 * px) / 2, fs, '#ffffff')
}
