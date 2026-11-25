import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/8bit/button'
import {
  type GarageData, type ColorScheme,
  ENGINE_COSTS, HANDLING_COSTS, BRAKE_COSTS, COLOR_COSTS,
  ENGINE_BOOST, HANDLING_BOOST, BRAKE_BOOST,
} from '@/lib/garage'
import type { PlayerStats } from '@/lib/save'

const RF = "'Press Start 2P', monospace"

const COLOR_DEFS: Array<{ key: ColorScheme; label: string; body: string; hood: string }> = [
  { key: 'classic', label: 'CLASSIC', body: '#f1c40f', hood: '#27ae60' },
  { key: 'royal',   label: 'ROYAL',   body: '#9b59b6', hood: '#e67e22' },
  { key: 'fire',    label: 'FIRE',    body: '#e74c3c', hood: '#e67e22' },
]

const UPGRADE_DEFS = [
  { key: 'engine'   as const, label: 'ENGINE',   costs: ENGINE_COSTS,   boost: ENGINE_BOOST,   unit: 'max spd' },
  { key: 'handling' as const, label: 'HANDLING', costs: HANDLING_COSTS, boost: HANDLING_BOOST, unit: 'steer'   },
  { key: 'brake'    as const, label: 'BRAKES',   costs: BRAKE_COSTS,    boost: BRAKE_BOOST,    unit: 'brake'   },
]

function drawPreview(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  colorKey: ColorScheme,
): void {
  const def = COLOR_DEFS.find(d => d.key === colorKey)!

  ctx.fillStyle = '#1a1f2e'
  ctx.fillRect(0, 0, W, H)

  const bw = Math.round(W * 0.44)
  const bh = Math.round(H * 0.68)
  const bx = Math.round((W - bw) / 2)
  const by = Math.round((H - bh) / 2)

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fillRect(bx + 3, by + 3, bw, bh)

  // Body
  ctx.fillStyle = def.body
  ctx.fillRect(bx, by, bw, bh)

  // Hood stripe
  ctx.fillStyle = def.hood
  ctx.fillRect(bx, by, bw, Math.round(bh * 0.22))

  // Hood centre stripe (body colour)
  ctx.fillStyle = def.body
  ctx.fillRect(bx + Math.round(bw * 0.42), by, Math.round(bw * 0.16), Math.round(bh * 0.22))

  // Windshield
  ctx.fillStyle = 'rgba(140,210,255,0.70)'
  ctx.fillRect(bx + Math.round(bw * 0.1), by + Math.round(bh * 0.24), Math.round(bw * 0.80), Math.round(bh * 0.14))

  // Cabin windows
  ctx.fillStyle = 'rgba(140,210,255,0.55)'
  ctx.fillRect(bx + Math.round(bw * 0.05), by + Math.round(bh * 0.42), Math.round(bw * 0.38), Math.round(bh * 0.22))
  ctx.fillRect(bx + Math.round(bw * 0.57), by + Math.round(bh * 0.42), Math.round(bw * 0.38), Math.round(bh * 0.22))

  // Outline
  ctx.strokeStyle = '#111'
  ctx.lineWidth = 1.5
  ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1)

  // Wheels
  const wr = Math.max(2, Math.round(bw * 0.14))
  ctx.fillStyle = '#111'
  ctx.beginPath()
  ctx.arc(Math.round(bx + bw / 2), by + Math.round(bh * 0.08), wr, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(bx - wr + 2, by + Math.round(bh * 0.75), wr, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(bx + bw + wr - 2, by + Math.round(bh * 0.75), wr, 0, Math.PI * 2)
  ctx.fill()
}

interface Props {
  stats:    PlayerStats
  garage:   GarageData
  onUpdate: (g: GarageData, s: PlayerStats) => void
  onBack:   () => void
}

export function Garage({ stats, garage, onUpdate, onBack }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    drawPreview(ctx, c.width, c.height, garage.equippedColor)
  }, [garage.equippedColor])

  const getLevel = (key: 'engine' | 'handling' | 'brake') =>
    key === 'engine' ? garage.engineLevel : key === 'handling' ? garage.handlingLevel : garage.brakeLevel

  const buyUpgrade = (key: 'engine' | 'handling' | 'brake') => {
    const level = getLevel(key)
    if (level >= 3) return
    const def  = UPGRADE_DEFS.find(d => d.key === key)!
    const cost = def.costs[level]
    if (stats.coins < cost) return
    const ng: GarageData = { ...garage }
    if (key === 'engine')        ng.engineLevel++
    else if (key === 'handling') ng.handlingLevel++
    else                         ng.brakeLevel++
    onUpdate(ng, { ...stats, coins: stats.coins - cost })
  }

  const handleColor = (c: ColorScheme) => {
    const owned = garage.unlockedColors.includes(c)
    const cost  = owned ? 0 : COLOR_COSTS[c]
    if (cost > 0 && stats.coins < cost) return
    const ng: GarageData = {
      ...garage,
      unlockedColors: owned ? garage.unlockedColors : [...garage.unlockedColors, c],
      equippedColor:  c,
    }
    onUpdate(ng, cost > 0 ? { ...stats, coins: stats.coins - cost } : stats)
  }

  const btn: React.CSSProperties = {
    fontFamily:  RF,
    fontSize:    'clamp(5px, 1.5vw, 8px)',
    padding:     '5px 9px',
    cursor:      'pointer',
    border:      '2px solid #aa3bff',
    background:  'rgba(170,59,255,0.18)',
    color:       '#fff',
  }
  const btnDim: React.CSSProperties = {
    ...btn,
    border:   '2px solid #333',
    background: 'rgba(0,0,0,0.3)',
    color:    '#444',
    cursor:   'not-allowed',
  }

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(0,0,0,0.93)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      overflowY: 'auto',
      padding: '4% 6%',
      boxSizing: 'border-box',
      gap: '5%',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <span style={{ fontFamily: RF, fontSize: 'clamp(10px, 3.2vw, 17px)', color: '#aa3bff' }}>
          GARAGE
        </span>
        <span style={{ fontFamily: RF, fontSize: 'clamp(7px, 2vw, 10px)', color: '#ffd54f' }}>
          COINS:{stats.coins}
        </span>
      </div>

      {/* Auto preview */}
      <canvas
        ref={canvasRef}
        width={100}
        height={150}
        style={{ imageRendering: 'pixelated', width: 'clamp(70px, 22%, 100px)', height: 'auto', flexShrink: 0 }}
      />

      {/* Colour scheme */}
      <div style={{ width: '100%' }}>
        <p style={{ fontFamily: RF, fontSize: 'clamp(6px, 1.8vw, 9px)', color: '#9e9e9e', margin: '0 0 8px 0' }}>
          COLOUR SCHEME:
        </p>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {COLOR_DEFS.map(cd => {
            const owned    = garage.unlockedColors.includes(cd.key)
            const equipped = garage.equippedColor === cd.key
            const cost     = COLOR_COSTS[cd.key]
            const canBuy   = owned || stats.coins >= cost
            return (
              <button
                key={cd.key}
                onClick={() => handleColor(cd.key)}
                disabled={!canBuy}
                style={{
                  fontFamily:   RF,
                  fontSize:     'clamp(5px, 1.5vw, 8px)',
                  padding:      '5px 7px',
                  border:       `2px solid ${equipped ? '#aa3bff' : owned ? '#555' : canBuy ? '#666' : '#333'}`,
                  background:   equipped ? 'rgba(170,59,255,0.2)' : 'rgba(0,0,0,0.5)',
                  color:        equipped ? '#fff' : owned ? '#ccc' : canBuy ? '#aaa' : '#444',
                  cursor:       canBuy ? 'pointer' : 'not-allowed',
                  display:      'flex',
                  flexDirection: 'column',
                  alignItems:   'center',
                  gap:          '3px',
                }}
              >
                <span style={{
                  display: 'inline-block',
                  width: 16, height: 10,
                  background: cd.body,
                  border: `1px solid ${cd.hood}`,
                }} />
                <span>{cd.label}</span>
                {!owned && <span style={{ color: '#ffd54f' }}>{cost}C</span>}
                {equipped && <span style={{ color: '#aa3bff', fontSize: '0.9em' }}>ON</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Upgrades */}
      <div style={{ width: '100%' }}>
        <p style={{ fontFamily: RF, fontSize: 'clamp(6px, 1.8vw, 9px)', color: '#9e9e9e', margin: '0 0 10px 0' }}>
          UPGRADES:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {UPGRADE_DEFS.map(ud => {
            const level    = getLevel(ud.key)
            const maxed    = level >= 3
            const nextCost = maxed ? 0 : ud.costs[level]
            const canAfford = !maxed && stats.coins >= nextCost
            return (
              <div key={ud.key} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                paddingBottom: '8px',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontFamily: RF, fontSize: 'clamp(6px, 1.8vw, 9px)', color: '#e0e0e0' }}>
                      {ud.label}
                    </span>
                    <span style={{ fontFamily: RF, fontSize: 'clamp(5px, 1.4vw, 7px)', color: '#9e9e9e' }}>
                      {'■'.repeat(level)}{'□'.repeat(3 - level)} {level}/3
                    </span>
                  </div>
                  {!maxed && (
                    <div style={{ fontFamily: RF, fontSize: 'clamp(5px, 1.4vw, 7px)', color: '#757575', marginTop: '3px' }}>
                      +{ud.boost} {ud.unit} · {nextCost}C
                    </div>
                  )}
                </div>
                {maxed ? (
                  <span style={{ fontFamily: RF, fontSize: 'clamp(5px, 1.4vw, 7px)', color: '#66bb6a' }}>MAX</span>
                ) : (
                  <button
                    onClick={() => buyUpgrade(ud.key)}
                    disabled={!canAfford}
                    style={canAfford ? btn : btnDim}
                  >
                    BUY
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Back */}
      <Button size="default" onClick={onBack}>← BACK</Button>
    </div>
  )
}
