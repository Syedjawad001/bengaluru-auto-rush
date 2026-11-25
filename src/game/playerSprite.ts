// ── Crisp player-auto rendering ──────────────────────────────────────────────
//
// Why this exists: the player PNG ships with a ring of semi-transparent,
// near-black pixels around its outline (≈8k pixels with alpha < 192). On the
// road that ring reads as a soft dark glow. Drawing the 512×768 image straight
// down to ~100 px with nearest-neighbour sampling also made the edges ragged.
//
// Pipeline (artwork, colours, proportions and transparency are unchanged):
//   1. cleanPlayerSprite: drop the halo — alpha < 160 → 0, everything else → 255.
//   2. scaledPlayer: downscale once with high-quality filtering to the exact
//      device-pixel size it will be drawn at, re-binarise the alpha so edges
//      stay hard, then apply the garage colour tint to opaque pixels only.
//   3. drawPlayer: blit 1:1 on the device-pixel grid with a crisp silhouette
//      shadow (same shape as the auto) so it still sits on the road.

const HALO_CUT = 160

export function cleanPlayerSprite(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width  = img.naturalWidth
  c.height = img.naturalHeight
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.drawImage(img, 0, 0)
  const im = g.getImageData(0, 0, c.width, c.height)
  const d  = im.data
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] < HALO_CUT ? 0 : 255
  g.putImageData(im, 0, 0)
  return c
}

interface Scaled { sprite: HTMLCanvasElement; shadow: HTMLCanvasElement }
const cache = new Map<string, Scaled>()

function scaledPlayer(clean: HTMLCanvasElement, tint: string, wDev: number, hDev: number): Scaled {
  const key = `${tint}|${wDev}|${hDev}`
  let s = cache.get(key)
  if (s) return s
  if (cache.size > 24) cache.clear()

  // step down by halves for a clean high-quality reduction
  let src: HTMLCanvasElement = clean
  while (src.width / 2 >= wDev * 1.5) {
    const half = document.createElement('canvas')
    half.width  = Math.round(src.width / 2)
    half.height = Math.round(src.height / 2)
    const hg = half.getContext('2d')!
    hg.imageSmoothingEnabled = true
    hg.imageSmoothingQuality = 'high'
    hg.drawImage(src, 0, 0, half.width, half.height)
    src = half
  }
  const sprite = document.createElement('canvas')
  sprite.width  = wDev
  sprite.height = hDev
  const g = sprite.getContext('2d', { willReadFrequently: true })!
  g.imageSmoothingEnabled = true
  g.imageSmoothingQuality = 'high'
  g.drawImage(src, 0, 0, wDev, hDev)
  const im = g.getImageData(0, 0, wDev, hDev)
  const d  = im.data
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] < 128 ? 0 : 255
  g.putImageData(im, 0, 0)
  if (tint) {
    g.globalCompositeOperation = 'source-atop'
    g.fillStyle = tint
    g.fillRect(0, 0, wDev, hDev)
    g.globalCompositeOperation = 'source-over'
  }

  const shadow = document.createElement('canvas')
  shadow.width  = wDev
  shadow.height = hDev
  const sg = shadow.getContext('2d')!
  sg.drawImage(sprite, 0, 0)
  sg.globalCompositeOperation = 'source-in'
  sg.fillStyle = '#180e28'
  sg.fillRect(0, 0, wDev, hDev)

  s = { sprite, shadow }
  cache.set(key, s)
  return s
}

/** Draw the player auto centred at (cx, cy) with half-size (hw, hl) in css px. */
export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  clean: HTMLCanvasElement,
  tint: string,
  cx: number, cy: number,
  hw: number, hl: number,
  dpr: number, px: number,
  hornActive = false,
): void {
  const wDev = Math.max(4, Math.round(hw * 2 * dpr))
  const hDev = Math.max(6, Math.round(hl * 2 * dpr))
  const { sprite, shadow } = scaledPlayer(clean, tint, wDev, hDev)
  const x = Math.round((cx - hw) * dpr) / dpr
  const y = Math.round((cy - hl) * dpr) / dpr
  const w = wDev / dpr, h = hDev / dpr

  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.globalAlpha = 0.32
  ctx.drawImage(shadow, x + px, y + Math.round(px * 1.5), w, h)
  ctx.globalAlpha = 1
  ctx.drawImage(sprite, x, y, w, h)
  ctx.restore()

  if (hornActive) {
    ctx.save()
    ctx.translate(cx, cy)
    const baseY = -hl - hw * 0.5
    for (let i = 1; i <= 3; i++) {
      ctx.strokeStyle = `rgba(255,230,0,${0.9 - i * 0.22})`
      ctx.lineWidth = 2.2 - i * 0.3
      ctx.beginPath()
      ctx.arc(0, baseY, hw * 0.55 * i, Math.PI * 1.1, Math.PI * 1.9)
      ctx.stroke()
    }
    ctx.restore()
  }
}
