// ── Main menu: portrait arcade-cover panel (see design/references/Main Menu design.png)
//
// A dedicated screen, separate from gameplay. The street inside the panel is
// rendered live with the same pixel-art world renderer as the game (portrait
// panel layout + a menu-only sky), and every control is a real React button.

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import playerAutoUrl from '@/assets/vehicles/player-auto.png'
import { computePanelLayout, drawWorld, drawMenuSky } from '@/game/world'
import { cleanPlayerSprite, drawPlayer } from '@/game/playerSprite'
import { CREATOR_NAME, X_PROFILE_URL } from '@/config/site'

const FONT    = "'Press Start 2P', monospace"
const ASPECT  = 0.772          // panel width / height, from the reference
const SCROLL  = 38             // px/s — a gentle cruise behind the menu
const BG      = '#1c1a26'

interface Props {
  coins:          number
  sound:          boolean
  music:          boolean
  onStart:        () => void
  onHowToPlay:    () => void
  onGarage:       () => void
  onStats:        () => void
  onToggleSound:  () => void
  onToggleMusic:  () => void
}

export function MainMenu(p: Props) {
  const rootRef   = useRef<HTMLDivElement>(null)
  const footRef   = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [box, setBox] = useState({ pw: 0, ph: 0, pad: 16 })

  // ── size the portrait panel to the space left above the footer ──────────
  useLayoutEffect(() => {
    const root = rootRef.current, foot = footRef.current
    if (!root || !foot) return
    const measure = () => {
      const W = root.clientWidth, H = root.clientHeight
      const pad   = W < 520 ? 10 : 24
      const gap   = W < 520 ? 10 : 18
      const availH = H - foot.offsetHeight - pad * 2 - gap
      const availW = W - pad * 2 - 10          // room for the outer cyan ring
      const ph = Math.max(200, Math.floor(Math.min(availH, availW / ASPECT)))
      setBox({ pw: Math.floor(ph * ASPECT), ph, pad })
    }
    const ro = new ResizeObserver(measure)
    ro.observe(root)
    ro.observe(foot)
    measure()
    return () => ro.disconnect()
  }, [])

  // ── live street inside the panel ─────────────────────────────────────────
  const BORDER = 5
  const cw = Math.max(0, box.pw - BORDER * 2)
  const ch = Math.max(0, box.ph - BORDER * 2)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !cw || !ch) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(window.devicePixelRatio ?? 1, 2)
    canvas.width  = Math.round(cw * dpr)
    canvas.height = Math.round(ch * dpr)
    const L = computePanelLayout(cw, ch)

    let clean: HTMLCanvasElement | null = null
    const img = new Image()
    img.src = playerAutoUrl
    img.onload = () => { clean = cleanPlayerSprite(img) }

    let raf = 0, last = 0, scroll = 0
    const frame = (now: number) => {
      const dt = Math.min((now - (last || now)) / 1000, 0.05)
      last = now
      scroll += SCROLL * dt
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawWorld(ctx, L, scroll, now)
      drawMenuSky(ctx, L, Math.round(ch * 0.13), now)

      // the hero auto with exhaust puffs
      const hw = L.rW * 0.25          // sprite has wide transparent margins
      const hl = hw * 1.5
      const ax = cw / 2
      const ay = Math.round(ch * 0.6)
      for (let i = 0; i < 3; i++) {
        const t  = ((now / 900) + i / 3) % 1
        const s  = Math.round((1 + t * 2) * L.px)
        ctx.globalAlpha = 0.85 * (1 - t)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(Math.round(ax + (i - 1) * 3 * L.px), Math.round(ay + hl + 2 * L.px + t * 18 * L.px), s, s)
      }
      ctx.globalAlpha = 1
      if (clean) drawPlayer(ctx, clean, '', ax, ay, hw, hl, dpr, L.px)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [cw, ch])

  // ── type scale relative to the reference panel (≈640 px wide) ────────────
  const s      = box.pw / 640
  const t1     = Math.max(18, Math.round(40 * s))
  const t2     = Math.max(12, Math.round(25 * s))
  const btnFs  = Math.max(10, Math.round(13 * s))
  const btnH   = Math.max(40, Math.round(36 * s))
  const btnW   = Math.max(140, Math.round(196 * s))
  const chipFs = Math.max(8, Math.round(9 * s))
  const chipH  = Math.max(30, Math.round(26 * s))
  const footFs = box.pw < 420 ? 8 : Math.max(9, Math.round(12 * s))

  const key = (k: string, label: string) => (
    <span key={k} style={{ whiteSpace: 'nowrap' }}>
      <span style={{ color: '#f4eefc' }}>{k}</span>{' '}
      <span style={{ color: '#8a8299' }}>{label}</span>
    </span>
  )
  const dot = (id: string) => <span key={id} style={{ color: '#5a5270' }}>·</span>

  return (
    <div
      ref={rootRef}
      style={{
        position: 'absolute', inset: 0, background: BG,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: box.pad < 20 ? 10 : 18, padding: box.pad, boxSizing: 'border-box', overflow: 'hidden',
      }}
    >
      {/* ── cover panel ── */}
      <div
        style={{
          position: 'relative', width: box.pw, height: box.ph, flex: 'none',
          boxSizing: 'border-box', border: `${BORDER}px solid #f5c842`, borderRadius: 14,
          boxShadow: '0 0 0 2px #2a2238, 0 0 0 5px #7fe3f0, 0 0 0 7px #2a2238, inset 0 0 0 2px #2a2238, 0 18px 40px rgba(0,0,0,0.45)',
          overflow: 'hidden', background: '#8fd3f4',
        }}
      >
        <canvas ref={canvasRef} aria-hidden style={{ display: 'block', width: cw, height: ch, borderRadius: 9, imageRendering: 'pixelated' }} />

        {/* title plaque */}
        <div style={{ position: 'absolute', top: '13.5%', left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none', userSelect: 'none' }}>
          <h1 style={{
            margin: 0, fontFamily: FONT, fontSize: t1, lineHeight: 1, letterSpacing: '0.04em', fontWeight: 400,
            color: '#f6c624', textShadow: `${Math.max(2, Math.round(3 * s))}px ${Math.max(2, Math.round(3 * s))}px 0 #8a5a00`,
            background: '#221c2b', border: '3px solid #120c1e', borderRadius: Math.round(12 * s),
            padding: `${Math.round(18 * s)}px ${Math.round(22 * s)}px ${Math.round(16 * s)}px`,
            boxShadow: '0 4px 0 rgba(18,12,30,0.6)',
          }}>
            BENGALURU
          </h1>
          <div style={{
            marginTop: -3, fontFamily: FONT, fontSize: t2, lineHeight: 1, letterSpacing: '0.06em',
            background: '#221c2b', border: '3px solid #120c1e', borderTop: 'none',
            borderRadius: `0 0 ${Math.round(10 * s)}px ${Math.round(10 * s)}px`,
            padding: `${Math.round(8 * s)}px ${Math.round(26 * s)}px ${Math.round(12 * s)}px`,
            boxShadow: '0 4px 0 rgba(18,12,30,0.6)',
          }}>
            <span style={{ color: '#f6c624' }}>AUTO</span>{'  '}<span style={{ color: '#ffffff' }}>RUSH</span>
          </div>
          {p.coins > 0 && (
            <div className="bar-chip bar-chip--gold" style={{ marginTop: Math.round(10 * s), fontSize: chipFs, height: chipH - 6, padding: '0 10px', cursor: 'default' }}>
              <span aria-hidden style={{ width: '0.9em', height: '0.9em', background: '#ffc928', boxShadow: 'inset -2px -2px 0 #e6a400, 0 0 0 2px #7a5200', display: 'inline-block' }} />
              {p.coins} COINS
            </div>
          )}
        </div>

        {/* actions: primary row above the compact chips, stacked in one column so
            that on narrow phones the chips wrap upward instead of covering START */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: '4.5%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: Math.max(8, Math.round(box.ph * 0.08 - chipH)) }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: Math.max(10, Math.round(20 * s)) }}>
          <button type="button" className="bar-btn bar-btn--primary" style={{ width: btnW, height: btnH, fontSize: btnFs }} onClick={p.onStart}>
            START
          </button>
          <button type="button" className="bar-btn bar-btn--secondary" style={{ width: btnW, height: btnH, fontSize: btnFs }} onClick={p.onHowToPlay}>
            HOW TO PLAY
          </button>
        </div>

        {/* compact secondary controls */}
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: Math.max(6, Math.round(10 * s)), padding: '0 8px' }}>
          <button type="button" className="bar-chip" style={{ fontSize: chipFs, height: chipH, padding: '0 10px' }} onClick={p.onGarage}>GARAGE</button>
          <button type="button" className="bar-chip" style={{ fontSize: chipFs, height: chipH, padding: '0 10px' }} onClick={p.onStats}>STATS</button>
          <button type="button" className="bar-chip" aria-pressed={p.sound} style={{ fontSize: chipFs, height: chipH, padding: '0 10px' }} onClick={p.onToggleSound}>
            SOUND {p.sound ? 'ON' : 'OFF'}
          </button>
          <button type="button" className="bar-chip" aria-pressed={p.music} style={{ fontSize: chipFs, height: chipH, padding: '0 10px' }} onClick={p.onToggleMusic}>
            MUSIC {p.music ? 'ON' : 'OFF'}
          </button>
        </div>
        </div>
      </div>

      {/* ── footer (outside the panel) ── */}
      <div ref={footRef} style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: footFs + 4, fontFamily: FONT, fontSize: footFs, letterSpacing: '0.08em', textAlign: 'center', maxWidth: '100%' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: `${footFs * 0.6}px ${footFs}px`, lineHeight: 1.4 }}>
          {key('W A S D / ARROWS', 'DRIVE')}{dot('d1')}
          {key('SPACE', 'HORN')}{dot('d2')}
          {key('ESC', 'PAUSE')}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: footFs }}>
          <span style={{ color: '#8a8299' }}>BUILT BY</span>
          <span className="bar-chip bar-chip--gold" style={{ fontSize: footFs, height: footFs + 16, padding: '0 10px', cursor: 'default' }}>{CREATOR_NAME}</span>
          {dot('d3')}
          <a className="bar-chip bar-chip--gold" href={X_PROFILE_URL} target="_blank" rel="noopener noreferrer" style={{ fontSize: footFs, height: footFs + 16, padding: '0 10px' }}>
            FOLLOW ME ON X
          </a>
        </div>
      </div>
    </div>
  )
}
