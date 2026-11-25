// ── On-screen touch controls (mobile) ─────────────────────────────────────────
//
// These buttons do not drive the auto themselves. They hold the SAME key codes
// the keyboard uses (ArrowLeft / ArrowRight / ArrowUp / ArrowDown) in the game's
// existing held-keys set, so the game loop, physics and garage upgrades treat a
// held touch button exactly like a held key. HORN calls the same horn trigger as
// Space; PAUSE is the existing HUD pause button (rendered by GameCanvas).
//
// Every finger (pointerId) is tracked on its own, so LEFT + ACCELERATE etc. work
// together, and a finger may slide from one button to its neighbour. A button is
// released on pointerup, pointercancel, window blur or the tab being hidden, and
// everything is released when the controls unmount (pause / game over), so no
// action can stay stuck.

import { useEffect, useRef, useState, type MutableRefObject } from 'react'

export type TouchCode = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'

interface Props {
  keysRef: MutableRefObject<Set<string>>
  onHorn:  () => void
  /** frame size in CSS px, used to size and place the buttons */
  w: number
  h: number
}

const FONT = "'Press Start 2P', monospace"

export function TouchControls({ keysRef, onHorn, w, h }: Props) {
  const rootRef  = useRef<HTMLDivElement>(null)
  const fingers  = useRef<Map<number, TouchCode | null>>(new Map())
  const owned    = useRef<Set<TouchCode>>(new Set())   // codes currently held by touch
  const [held, setHeld] = useState<ReadonlySet<TouchCode>>(new Set())
  const [horn, setHorn] = useState(false)

  // Push the union of all fingers' buttons into the shared key set.
  const sync = () => {
    const next = new Set<TouchCode>()
    fingers.current.forEach(c => { if (c) next.add(c) })
    const keys = keysRef.current
    owned.current.forEach(c => { if (!next.has(c)) keys.delete(c) })
    next.forEach(c => keys.add(c))
    owned.current = next
    setHeld(prev => (prev.size === next.size && [...next].every(c => prev.has(c)) ? prev : next))
  }

  const releaseAll = () => {
    fingers.current.clear()
    sync()
    setHorn(false)
  }

  const codeAt = (x: number, y: number): TouchCode | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-touch-code]')
    return el && rootRef.current?.contains(el) ? (el.dataset.touchCode as TouchCode) : null
  }

  useEffect(() => {
    const onBlur = () => releaseAll()
    const onVis  = () => { if (document.hidden) releaseAll() }
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVis)
      releaseAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onDown = (e: React.PointerEvent) => {
    const code = codeAt(e.clientX, e.clientY)
    if (!code) return
    e.preventDefault()
    fingers.current.set(e.pointerId, code)
    sync()
  }
  const onMove = (e: React.PointerEvent) => {
    if (!fingers.current.has(e.pointerId)) return
    const code = codeAt(e.clientX, e.clientY)
    if (fingers.current.get(e.pointerId) !== code) {
      fingers.current.set(e.pointerId, code)
      sync()
    }
  }
  const onUp = (e: React.PointerEvent) => {
    if (!fingers.current.delete(e.pointerId)) return
    sync()
  }

  // ── sizing: compact, comfortable, never over the auto (which sits at ~72% h)
  const short = Math.min(w, h)
  const B     = Math.round(Math.max(54, Math.min(84, short * 0.15)))   // pad size
  const gap   = Math.round(B * 0.16)
  const edge  = Math.max(12, Math.round(short * 0.035))
  const hornS = Math.round(B * 0.8)
  const fs    = Math.max(7, Math.round(B * 0.13))

  const pad = (code: TouchCode, label: string, glyph: React.ReactNode, tone: 'dark' | 'gas' | 'brake') => (
    <div
      key={code}
      data-touch-code={code}
      role="button"
      aria-label={label}
      aria-pressed={held.has(code)}
      className={`bar-touch bar-touch--${tone}${held.has(code) ? ' is-held' : ''}`}
      style={{ width: B, height: B }}
    >
      {glyph}
      <span className="bar-touch__label" style={{ fontSize: fs }}>{label}</span>
    </div>
  )

  const arrow = (dir: 'left' | 'right' | 'up' | 'down') => (
    <span aria-hidden className={`bar-touch__arrow bar-touch__arrow--${dir}`} style={{ borderWidth: Math.round(B * 0.16) }} />
  )

  return (
    <div
      ref={rootRef}
      className="bar-touch-layer"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onLostPointerCapture={onUp}
      onContextMenu={e => e.preventDefault()}
    >
      {/* steering — bottom left */}
      <div className="bar-touch-group" style={{ left: edge, bottom: edge, gap }}>
        {pad('ArrowLeft',  'LEFT',  arrow('left'),  'dark')}
        {pad('ArrowRight', 'RIGHT', arrow('right'), 'dark')}
      </div>

      {/* horn — bottom centre, below the auto */}
      <button
        type="button"
        aria-label="Horn"
        className={`bar-touch bar-touch--horn${horn ? ' is-held' : ''}`}
        style={{ position: 'absolute', left: '50%', bottom: edge + Math.round((B - hornS) / 2), width: hornS, height: hornS, marginLeft: -hornS / 2, fontFamily: FONT }}
        onPointerDown={e => { e.preventDefault(); e.stopPropagation(); setHorn(true); onHorn() }}
        onPointerUp={() => setHorn(false)}
        onPointerCancel={() => setHorn(false)}
        onPointerLeave={() => setHorn(false)}
      >
        <span aria-hidden className="bar-touch__horn" />
        <span className="bar-touch__label" style={{ fontSize: fs }}>HORN</span>
      </button>

      {/* pedals — bottom right: brake then accelerate (thumb rests on GAS) */}
      <div className="bar-touch-group" style={{ right: edge, bottom: edge, gap }}>
        {pad('ArrowDown', 'BRAKE', arrow('down'), 'brake')}
        {pad('ArrowUp',   'GAS',   arrow('up'),   'gas')}
      </div>
    </div>
  )
}
