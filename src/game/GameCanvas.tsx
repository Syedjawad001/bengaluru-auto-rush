import { useEffect, useRef, useState } from 'react'
import playerAutoUrl from '@/assets/vehicles/player-auto.png'
import { Button } from '@/components/ui/8bit/button'
import { loadStats, saveStats, type PlayerStats } from '@/lib/save'
import {
  loadGarage, saveGarage, type GarageData,
  ENGINE_BOOST, HANDLING_BOOST, BRAKE_BOOST, COLOR_DEFS,
} from '@/lib/garage'
import { loadSettings, saveSettings, type Settings } from '@/lib/settings'
import { Garage } from '@/game/Garage'
import {
  computeLayout, drawWorld, drawOverhead, prewarmWorld, neighbourhoodAt,
  type Layout,
} from '@/game/world'
import {
  drawTrafficVehicle, drawPothole, drawDog, drawPassenger, drawPackage,
  drawDestMarker,
} from '@/game/vehicles'
import { TouchControls } from '@/game/TouchControls'
import { audio } from '@/game/audio/AudioManager'
import { drawHUD, drawNeighbourhoodBanner, drawToast, drawPop, hudMetrics } from '@/game/hud'
import { cleanPlayerSprite, drawPlayer } from '@/game/playerSprite'
import { MainMenu } from '@/game/MainMenu'

// ── sprite ────────────────────────────────────────────────────────────────────

const SPRITE_W      = 1024
const SPRITE_H      = 1536
const SPRITE_ASPECT = SPRITE_H / SPRITE_W

// ── player movement ───────────────────────────────────────────────────────────

const MIN_SPEED   = 150
const MAX_SPEED   = 500
const BASE_SPEED  = 300
const ACCEL       = 200
const BRAKE       = 300
const STEER_ACCEL = 700
const MAX_VX      = 260
const DECAY_BASE  = Math.pow(0.5, 1 / 0.08)

const HORN_MS = 650

const MENU_SCROLL_SPEED = 110

// ── traffic ───────────────────────────────────────────────────────────────────

const NUM_LANES = 3

interface TrafficDef { hwR: number; hlR: number; spd: number }

const TRAFFIC_DEFS: TrafficDef[] = [
  { hwR: 0.125, hlR: 0.210, spd: 60  },
  { hwR: 0.082, hlR: 0.130, spd: 115 },
  { hwR: 0.105, hlR: 0.195, spd: 80  },
]

const SPAWN_MIN      = 1.5
const SPAWN_MAX      = 2.8
const MIN_GAP_FRAC   = 0.30
const HIT_SHRINK     = 0.68
const GRACE_SECS     = 3.0
const NEAR_MISS_BONUS = 50
const NEAR_MISS_FRAC  = 2.2

// ── hazards ───────────────────────────────────────────────────────────────────

const HAZARD_DAMAGE    = 15
const TRAFFIC_DAMAGE   = 35
const FLASH_MS         = 400
const HAZARD_SPAWN_MIN = 3.0
const HAZARD_SPAWN_MAX = 5.5

// ── mission ───────────────────────────────────────────────────────────────────

const PICKUP_RADIUS_R  = 0.30
const DEST_DIST_MIN    = 1800
const DEST_DIST_MAX    = 3000
const PICKUP_NOTIF_MS  = 2200
const DEST_MARKER_DIST = 500
const BASE_FARE        = 40
const FARE_PER_100     = 3
const DEST_NAMES       = ['KORAMANGALA', 'INDIRANAGAR', 'JAYANAGAR', 'MG ROAD', 'HEBBAL']

// package delivery
const PKG_COLLECT_RADIUS = 0.28
const PKG_DEST_DIST_MIN  = 1500
const PKG_DEST_DIST_MAX  = 2500
const PKG_COINS          = 20

// time trial
const TIME_CHALLENGE_SECS = 30
const TIME_DEST_DIST      = 4500
const TIME_COINS_BASE     = 5
const TIME_COINS_PER_SEC  = 1

type MissionPhase = 'searching' | 'approaching' | 'riding'
type MissionType  = 'passenger' | 'package' | 'time'

// ── types ─────────────────────────────────────────────────────────────────────

type GameScreen = 'menu' | 'howtoplay' | 'stats' | 'garage' | 'missionselect' | 'playing' | 'paused' | 'gameover' | 'ridecomplete'

interface Dims  { w: number; h: number; dpr: number }
interface State {
  scroll:    number
  autoX:     number
  autoVX:    number
  hornUntil: number
  condition: number
  speed:     number
}

interface TrafficVehicle {
  id:         number
  type:       number
  lane:       number
  y:          number
  speed:      number
  nearMissed: boolean
}

interface Hazard {
  id:   number
  type: number
  lane: number
  y:    number
  hw:   number
  hl:   number
  hit:  boolean
}

interface SpawnState { nextTime: number; idCounter: number }

interface Mission {
  phase:         MissionPhase
  passY:         number         // passenger Y (passenger) | package Y (package)
  passSide:      'left' | 'right'
  notifUntil:    number
  destName:      string
  destRemain:    number
  destTotal:     number
  bonusAtPickup: number
  pkgLane:       number         // lane index for package pickup
  timerSecs:     number         // countdown seconds (time trial)
}

interface RideResult {
  label:      string
  fare:       number
  coins:      number
  bonus:      number
  destName:   string
  totalCoins: number
}

// ── menu scene ────────────────────────────────────────────────────────────────
// Reuses the gameplay street so the menu previews the real environment.

function drawMenuScene(
  ctx: CanvasRenderingContext2D,
  L: Layout,
  scroll: number,
  now: number,
  clean: HTMLCanvasElement | null,
  dpr: number,
): void {
  const { w, h, rL, rW, px } = L
  drawWorld(ctx, L, scroll, now)

  // a little ambient traffic in the far lanes
  const laneW = rW / NUM_LANES
  for (let i = 0; i < 2; i++) {
    const def  = TRAFFIC_DEFS[i === 0 ? 1 : 2]
    const lane = i === 0 ? 0 : 2
    const span = h + def.hlR * rW * 4
    const y    = ((now / 1000) * (90 + i * 40) + i * span * 0.5) % span - def.hlR * rW * 2
    drawTrafficVehicle(ctx, i === 0 ? 1 : 2, i * 4, rL + (lane + 0.5) * laneW, y, def.hwR * rW, def.hlR * rW, px)
  }

  if (clean) {
    const autoHW = rW * 0.145
    const autoHL = autoHW * SPRITE_ASPECT
    drawPlayer(ctx, clean, '', w / 2, h * 0.74, autoHW, autoHL, dpr, px)
  }
  drawOverhead(ctx, L, scroll)

  // stepped scrim behind the title and buttons (pixel bands, not a gradient)
  const bands = 6
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = `rgba(18,12,30,${(0.5 - i * 0.08).toFixed(2)})`
    ctx.fillRect(0, Math.round((i * h * 0.3) / bands), w, Math.ceil((h * 0.3) / bands))
    ctx.fillRect(0, Math.round(h - ((i + 1) * h * 0.42) / bands), w, Math.ceil((h * 0.42) / bands))
  }
}

// ── shared overlay styles ─────────────────────────────────────────────────────

const RETRO_FONT = "'Press Start 2P', monospace"

// Screens whose UI is rendered inside the centred overlay column.
const COLUMN_SCREENS: ReadonlySet<GameScreen> = new Set<GameScreen>([
  'missionselect', 'howtoplay', 'stats', 'garage', 'gameover', 'ridecomplete',
])

const overlayBase: React.CSSProperties = {
  position: 'absolute', inset: 0,
  display: 'flex', flexDirection: 'column',
  alignItems: 'center',
}

// ── component ─────────────────────────────────────────────────────────────────

export function GameCanvas() {
  const wrapRef          = useRef<HTMLDivElement>(null)
  const canvasRef        = useRef<HTMLCanvasElement>(null)
  const cleanSpriteRef   = useRef<HTMLCanvasElement | null>(null)
  const dimsRef          = useRef<Dims>({ w: 0, h: 0, dpr: 1 })
  const stateRef         = useRef<State>({ scroll: 0, autoX: 0, autoVX: 0, hornUntil: 0, condition: 100, speed: BASE_SPEED })
  const trafficRef       = useRef<TrafficVehicle[]>([])
  const spawnRef         = useRef<SpawnState>({ nextTime: GRACE_SECS, idCounter: 0 })
  const hazardsRef       = useRef<Hazard[]>([])
  const hazardSpawnRef   = useRef<SpawnState>({ nextTime: GRACE_SECS + 2.0, idCounter: 0 })
  const nearMissBonusRef  = useRef(0)
  const flashRef          = useRef(0)
  const trafficGraceRef   = useRef(0)
  const menuScrollRef     = useRef(0)
  const statsRef          = useRef<PlayerStats>(loadStats())
  const garageRef         = useRef<GarageData>(loadGarage())
  const missionRef        = useRef<Mission>({
    phase: 'searching', passY: 0, passSide: 'left',
    notifUntil: 0, destName: '', destRemain: 0, destTotal: 0, bonusAtPickup: 0,
    pkgLane: 0, timerSecs: 0,
  })
  const missionTypeRef         = useRef<MissionType>('passenger')
  const prevNeighbourhoodRef   = useRef<number>(0)
  const nbrNotifRef            = useRef<number>(0)
  const layoutRef              = useRef<Layout>(computeLayout(1, 1))
  const nearMissPopRef         = useRef<{ until: number; x: number }>({ until: 0, x: 0 })
  const screenRef       = useRef<GameScreen>('menu')
  const tickRef          = useRef<FrameRequestCallback>(() => {})
  const menuTickRef      = useRef<FrameRequestCallback>(() => {})
  const keysRef          = useRef<Set<string>>(new Set())
  const rafRef           = useRef<number>(0)
  const lastRef          = useRef<number>(0)

  const [screen,     setScreen]     = useState<GameScreen>('menu')
  const [settings,   setSettings]   = useState<Settings>(loadSettings)
  const [pauseBtn,   setPauseBtn]   = useState({ top: 0, right: 0, size: 44 })
  const [pausedMission, setPausedMission] = useState('')
  const [frame,      setFrame]      = useState({ w: 0, h: 0 })
  // On-screen controls: shown on touch-first devices, or as soon as a touch is seen.
  const [touchUI,    setTouchUI]    = useState(() =>
    typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse), (hover: none)').matches)
  const uiScreenRef = useRef<GameScreen>('menu')
  // window/document listeners are bound once; they call the latest handlers via refs
  const pauseFnRef  = useRef<() => void>(() => {})
  const resumeFnRef = useRef<() => void>(() => {})
  const [finalScore, setFinalScore] = useState(0)
  const [rideResult, setRideResult] = useState<RideResult | null>(null)
  const [stats,      setStats]      = useState<PlayerStats>(statsRef.current)
  const [garageData, setGarageData] = useState<GarageData>(garageRef.current)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap   = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.src = playerAutoUrl
    img.onload = () => {
      // halo removed once here; tint + exact-size scaling happen in drawPlayer
      cleanSpriteRef.current = cleanPlayerSprite(img)
    }

    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      const dpr  = Math.min(window.devicePixelRatio ?? 1, 2)
      const w    = Math.round(rect.width)
      const h    = Math.round(rect.height)
      dimsRef.current = { w, h, dpr }
      canvas.width         = w * dpr
      canvas.height        = h * dpr
      canvas.style.width   = `${w}px`
      canvas.style.height  = `${h}px`
      if (w && h) {
        const prev = layoutRef.current
        layoutRef.current = computeLayout(w, h)
        prewarmWorld(layoutRef.current)
        // pause button sits right under the HP panel, aligned to its right edge
        const hm = hudMetrics(layoutRef.current)
        setPauseBtn({ top: hm.m + hm.ph + 2 * hm.u, right: hm.m, size: Math.max(40, 13 * hm.u) })
        setFrame({ w, h })
        // keep the auto in the same relative road position across resizes
        if (prev.rW > 1 && stateRef.current.autoX !== 0) {
          const rel = (stateRef.current.autoX - prev.rL) / prev.rW
          stateRef.current.autoX = layoutRef.current.rL + rel * layoutRef.current.rW
        }
      }
      if (stateRef.current.autoX === 0) stateRef.current.autoX = w / 2
    }

    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    resize()

    const PREVENT = new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'])
    const onDown  = (e: KeyboardEvent) => {
      if (screenRef.current === 'playing') {
        keysRef.current.add(e.code)
        if (PREVENT.has(e.code)) e.preventDefault()
        if (e.code === 'Space') {
          stateRef.current.hornUntil = performance.now() + HORN_MS
          if (!e.repeat) audio.play('horn')   // key auto-repeat extends the visual, not the sound
        }
      }
      if (e.code === 'Escape') {
        if (screenRef.current === 'playing') pauseFnRef.current()
        else if (screenRef.current === 'paused') resumeFnRef.current()
      }
    }
    const onUp = (e: KeyboardEvent) => { keysRef.current.delete(e.code) }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup',   onUp)

    // Losing focus: keyup events never arrive, so drop every held key to avoid
    // the auto steering/accelerating on its own when the player comes back.
    const onBlur = () => { keysRef.current.clear() }
    // Hidden tab: pause a running game so it resumes exactly where it stopped.
    const onVisibility = () => {
      if (!document.hidden) return
      keysRef.current.clear()
      if (screenRef.current === 'playing') pauseFnRef.current()
    }
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibility)
    const onAnyPointer = (e: PointerEvent) => { if (e.pointerType === 'touch') setTouchUI(true) }
    window.addEventListener('pointerdown', onAnyPointer, { passive: true })

    // ── menu animation loop ───────────────────────────────────────────────────
    const menuTick: FrameRequestCallback = (now) => {
      if (screenRef.current !== 'menu' && screenRef.current !== 'howtoplay' && screenRef.current !== 'missionselect') return

      const { w, h, dpr } = dimsRef.current
      if (!w || !h) { rafRef.current = requestAnimationFrame(menuTick); return }

      const dt = Math.min((now - (lastRef.current || now)) / 1000, 0.05)
      lastRef.current = now
      menuScrollRef.current += MENU_SCROLL_SPEED * dt

      // the dedicated MainMenu panel covers the frame — skip the backdrop there
      if (uiScreenRef.current !== 'menu') {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        drawMenuScene(ctx, layoutRef.current, menuScrollRef.current, now, cleanSpriteRef.current, dpr)
      }

      rafRef.current = requestAnimationFrame(menuTick)
    }

    // ── game loop ─────────────────────────────────────────────────────────────
    const tick: FrameRequestCallback = (now) => {
      if (screenRef.current !== 'playing') return

      const dt = Math.min((now - (lastRef.current || now)) / 1000, 0.05)
      lastRef.current = now

      const { w, h, dpr } = dimsRef.current
      if (!w || !h) { rafRef.current = requestAnimationFrame(tick); return }

      const st   = stateRef.current
      const keys = keysRef.current

      // Road geometry comes from the 9:16 reference width, so sizes and
      // physics feel are identical to the portrait build at the same height.
      const L     = layoutRef.current
      const rL    = L.rL
      const rR    = L.rR
      const rW    = L.rW
      const laneW = rW / NUM_LANES
      const hw    = rW * 0.145
      const hl    = hw * SPRITE_ASPECT
      const autoY = h * 0.72

      // Effective physics — boosted per garage upgrade level
      const effMaxSpeed   = MAX_SPEED   + garageRef.current.engineLevel   * ENGINE_BOOST
      const effSteerAccel = STEER_ACCEL + garageRef.current.handlingLevel * HANDLING_BOOST
      const effBrake      = BRAKE       + garageRef.current.brakeLevel    * BRAKE_BOOST
      st.speed = Math.min(effMaxSpeed, st.speed)
      audio.setEngineSpeed((st.speed - MIN_SPEED) / Math.max(1, effMaxSpeed - MIN_SPEED))

      // Speed
      const goFwd  = keys.has('KeyW') || keys.has('ArrowUp')
      const goBack = keys.has('KeyS') || keys.has('ArrowDown')
      if (goFwd && !goBack) {
        st.speed = Math.min(effMaxSpeed, st.speed + ACCEL * dt)
      } else if (goBack && !goFwd) {
        st.speed = Math.max(MIN_SPEED, st.speed - effBrake * dt)
      } else {
        if (st.speed > BASE_SPEED) {
          st.speed = Math.max(BASE_SPEED, st.speed - effBrake * 0.5 * dt)
        } else if (st.speed < BASE_SPEED) {
          st.speed = Math.min(BASE_SPEED, st.speed + ACCEL * 0.5 * dt)
        }
      }

      // Steering
      const goLeft  = keys.has('ArrowLeft')  || keys.has('KeyA')
      const goRight = keys.has('ArrowRight') || keys.has('KeyD')
      if (goLeft && !goRight) {
        st.autoVX -= effSteerAccel * dt
      } else if (goRight && !goLeft) {
        st.autoVX += effSteerAccel * dt
      } else {
        st.autoVX *= Math.pow(DECAY_BASE, dt)
        if (Math.abs(st.autoVX) < 0.5) st.autoVX = 0
      }
      st.autoVX = Math.max(-MAX_VX, Math.min(MAX_VX, st.autoVX))
      st.autoX += st.autoVX * dt
      const minX = rL + hw + 4
      const maxX = rR - hw - 4
      if (st.autoX < minX) { st.autoX = minX; if (st.autoVX < 0) st.autoVX = 0 }
      if (st.autoX > maxX) { st.autoX = maxX; if (st.autoVX > 0) st.autoVX = 0 }

      st.scroll    += st.speed * dt
      st.condition  = Math.max(0, st.condition - dt * 0.5)

      const score             = Math.floor(st.scroll / 10) + nearMissBonusRef.current
      // neighbourhood at the auto's world position (changes as you pass under the gantry)
      const neighbourhoodIdx  = neighbourhoodAt(st.scroll - autoY)
      if (neighbourhoodIdx !== prevNeighbourhoodRef.current) {
        prevNeighbourhoodRef.current = neighbourhoodIdx
        nbrNotifRef.current          = now + 2500
      }

      // Spawn traffic
      const sp = spawnRef.current
      if (now / 1000 >= sp.nextTime) {
        const lanes = [0, 1, 2].sort(() => Math.random() - 0.5)
        let spawned = false
        for (const lane of lanes) {
          const blocked = trafficRef.current.some(v => v.lane === lane && v.y < h * MIN_GAP_FRAC)
          if (!blocked) {
            const type = Math.floor(Math.random() * TRAFFIC_DEFS.length)
            const def  = TRAFFIC_DEFS[type]
            trafficRef.current.push({
              id: sp.idCounter++, type, lane,
              y: -(def.hlR * rW), speed: def.spd,
              nearMissed: false,
            })
            spawned = true
            break
          }
        }
        const delay = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN)
        sp.nextTime = now / 1000 + (spawned ? delay : 0.4)
      }

      // Move traffic
      for (const v of trafficRef.current) {
        v.y += (st.speed + v.speed) * dt
      }

      // Near-miss
      for (const v of trafficRef.current) {
        if (!v.nearMissed) {
          const prevY = v.y - (st.speed + v.speed) * dt
          if (prevY < autoY && v.y >= autoY) {
            const def   = TRAFFIC_DEFS[v.type]
            const vcx   = rL + (v.lane + 0.5) * laneW
            const vhw   = def.hwR * rW
            const s     = HIT_SHRINK
            const xDist = Math.abs(st.autoX - vcx)
            if (xDist > (hw + vhw) * s && xDist < (hw + vhw) * NEAR_MISS_FRAC) {
              nearMissBonusRef.current += NEAR_MISS_BONUS
              nearMissPopRef.current = { until: now + 900, x: st.autoX }
              audio.play('nearMiss')
            }
            v.nearMissed = true
          }
        }
      }

      trafficRef.current = trafficRef.current.filter(v => v.y < h * 1.15)

      // Traffic collision — deals damage with a 1.5 s grace period between hits
      for (const v of trafficRef.current) {
        const def = TRAFFIC_DEFS[v.type]
        const vcx = rL + (v.lane + 0.5) * laneW
        const vhw = def.hwR * rW
        const vhl = def.hlR * rW
        const s   = HIT_SHRINK
        if (
          st.autoX - hw * s < vcx + vhw * s &&
          st.autoX + hw * s > vcx - vhw * s &&
          autoY    - hl * s < v.y + vhl * s &&
          autoY    + hl * s > v.y - vhl * s
        ) {
          if (now > trafficGraceRef.current) {
            st.condition            = Math.max(0, st.condition - TRAFFIC_DAMAGE)
            trafficGraceRef.current = now + 1500
            flashRef.current        = now + FLASH_MS
            audio.play('collision')
          }
          break
        }
      }

      // Spawn hazards
      const hsp = hazardSpawnRef.current
      if (now / 1000 >= hsp.nextTime) {
        const lane = Math.floor(Math.random() * NUM_LANES)
        const type = Math.random() < 0.6 ? 0 : 1
        const hHW  = rW * (type === 0 ? 0.070 : 0.065)
        const hHL  = rW * (type === 0 ? 0.070 : 0.105)
        hazardsRef.current.push({ id: hsp.idCounter++, type, lane, y: -hHL, hw: hHW, hl: hHL, hit: false })
        hsp.nextTime = now / 1000 + HAZARD_SPAWN_MIN + Math.random() * (HAZARD_SPAWN_MAX - HAZARD_SPAWN_MIN)
      }

      // Move hazards
      for (const hz of hazardsRef.current) {
        hz.y += st.speed * dt
      }

      // Hazard collision
      for (const hz of hazardsRef.current) {
        const hcx = rL + (hz.lane + 0.5) * laneW
        const s   = HIT_SHRINK
        const overlapping =
          st.autoX - hw * s < hcx  + hz.hw * s &&
          st.autoX + hw * s > hcx  - hz.hw * s &&
          autoY    - hl * s < hz.y + hz.hl * s &&
          autoY    + hl * s > hz.y - hz.hl * s
        if (overlapping) {
          if (!hz.hit) {
            st.condition = Math.max(0, st.condition - HAZARD_DAMAGE)
            hz.hit = true
            flashRef.current = now + FLASH_MS
            audio.play('collision')
          }
        } else {
          hz.hit = false
        }
      }

      hazardsRef.current = hazardsRef.current.filter(hz => hz.y < h * 1.1)

      // ── Mission ──────────────────────────────────────────────────────────────
      const kerbMid = L.kerbW * 0.5
      const ms      = missionRef.current
      const mType   = missionTypeRef.current
      const passX   = ms.passSide === 'left' ? rL - kerbMid : rR + kerbMid
      let missionComplete = false

      if (mType === 'passenger') {
        // ── passenger ride ──────────────────────────────────────────────────────
        if (ms.phase === 'searching' || ms.phase === 'approaching') {
          ms.passY += st.speed * dt
          if (ms.passY > h * 1.1) {
            ms.passY    = -(h * 0.6)
            ms.passSide = Math.random() < 0.5 ? 'left' : 'right'
            ms.phase    = 'searching'
          } else {
            const dist = Math.hypot(st.autoX - passX, autoY - ms.passY)
            if (dist < rW * PICKUP_RADIUS_R) {
              ms.phase         = 'riding'
              ms.notifUntil    = now + PICKUP_NOTIF_MS
              ms.destName      = DEST_NAMES[Math.floor(Math.random() * DEST_NAMES.length)]
              ms.destRemain    = DEST_DIST_MIN + Math.random() * (DEST_DIST_MAX - DEST_DIST_MIN)
              ms.destTotal     = ms.destRemain
              ms.bonusAtPickup = nearMissBonusRef.current
              audio.play('pickup')
            } else {
              ms.phase = dist < rW * PICKUP_RADIUS_R * 1.8 ? 'approaching' : 'searching'
            }
          }
        } else if (ms.phase === 'riding') {
          ms.destRemain = Math.max(0, ms.destRemain - st.speed * dt)
          if (ms.destRemain <= 0) {
            const fare      = BASE_FARE + Math.round(ms.destTotal / 100) * FARE_PER_100
            const rideBonus = nearMissBonusRef.current - ms.bonusAtPickup
            const coins     = Math.floor(fare / 10) + Math.floor(rideBonus / 50) * 2
            const prev      = statsRef.current
            const updated: PlayerStats = {
              coins:      prev.coins + coins,
              totalRides: prev.totalRides + 1,
              totalFare:  prev.totalFare + fare,
              highScore:  Math.max(prev.highScore, score),
            }
            statsRef.current = updated
            saveStats(updated)
            setStats(updated)
            audio.play('dropoff')
            if (coins > 0) audio.play('coin', 0.7)
            setRideResult({ label: 'RIDE COMPLETE!', fare, coins, bonus: rideBonus, destName: ms.destName, totalCoins: updated.coins })
            screenRef.current = 'ridecomplete'
            setScreen('ridecomplete')
            missionComplete = true
          }
        }

      } else if (mType === 'package') {
        // ── package delivery ────────────────────────────────────────────────────
        if (ms.phase === 'searching') {
          ms.passY += st.speed * dt
          if (ms.passY > h * 1.1) {
            ms.passY   = -(h * 0.5)
            ms.pkgLane = Math.floor(Math.random() * NUM_LANES)
          }
          const pkgX = rL + (ms.pkgLane + 0.5) * laneW
          const dist = Math.hypot(st.autoX - pkgX, autoY - ms.passY)
          if (dist < rW * PKG_COLLECT_RADIUS) {
            ms.phase         = 'riding'
            ms.notifUntil    = now + PICKUP_NOTIF_MS
            ms.destName      = DEST_NAMES[Math.floor(Math.random() * DEST_NAMES.length)]
            ms.destRemain    = PKG_DEST_DIST_MIN + Math.random() * (PKG_DEST_DIST_MAX - PKG_DEST_DIST_MIN)
            ms.destTotal     = ms.destRemain
            ms.bonusAtPickup = nearMissBonusRef.current
            audio.play('pickup')
          }
        } else if (ms.phase === 'riding') {
          ms.destRemain = Math.max(0, ms.destRemain - st.speed * dt)
          if (ms.destRemain <= 0) {
            const rideBonus = nearMissBonusRef.current - ms.bonusAtPickup
            const coins     = PKG_COINS + Math.floor(rideBonus / 50) * 2
            const prev      = statsRef.current
            const updated: PlayerStats = {
              coins:      prev.coins + coins,
              totalRides: prev.totalRides + 1,
              totalFare:  prev.totalFare + PKG_COINS * 10,
              highScore:  Math.max(prev.highScore, score),
            }
            statsRef.current = updated
            saveStats(updated)
            setStats(updated)
            audio.play('package')
            if (coins > 0) audio.play('coin', 0.85)
            setRideResult({ label: 'DELIVERY DONE!', fare: 0, coins, bonus: rideBonus, destName: ms.destName, totalCoins: updated.coins })
            screenRef.current = 'ridecomplete'
            setScreen('ridecomplete')
            missionComplete = true
          }
        }

      } else {
        // ── time trial ──────────────────────────────────────────────────────────
        ms.timerSecs = Math.max(0, ms.timerSecs - dt)

        if (ms.timerSecs <= 0) {
          const prev    = statsRef.current
          const updated: PlayerStats = { ...prev, highScore: Math.max(prev.highScore, score) }
          statsRef.current = updated
          saveStats(updated)
          setStats(updated)
          audio.play('timeUp')
          setRideResult({ label: 'TIME UP!', fare: 0, coins: 0, bonus: 0, destName: ms.destName, totalCoins: updated.coins })
          screenRef.current = 'ridecomplete'
          setScreen('ridecomplete')
          missionComplete = true
        } else {
          ms.destRemain = Math.max(0, ms.destRemain - st.speed * dt)
          if (ms.destRemain <= 0) {
            const secsLeft  = Math.round(ms.timerSecs)
            const coins     = TIME_COINS_BASE + secsLeft * TIME_COINS_PER_SEC
            const prev      = statsRef.current
            const updated: PlayerStats = {
              coins:      prev.coins + coins,
              totalRides: prev.totalRides + 1,
              totalFare:  prev.totalFare + coins * 8,
              highScore:  Math.max(prev.highScore, score),
            }
            statsRef.current = updated
            saveStats(updated)
            setStats(updated)
            audio.play('missionClear')
            if (coins > 0) audio.play('coin', 0.85)
            setRideResult({ label: 'MISSION CLEAR!', fare: 0, coins, bonus: 0, destName: ms.destName, totalCoins: updated.coins })
            screenRef.current = 'ridecomplete'
            setScreen('ridecomplete')
            missionComplete = true
          }
        }
      }

      // Game over check
      const shouldGameOver = !missionComplete && st.condition <= 0
      if (shouldGameOver) {
        const hs = statsRef.current
        if (score > hs.highScore) {
          const updated = { ...hs, highScore: score }
          statsRef.current = updated
          saveStats(updated)
          setStats(updated)
        }
        audio.play('gameOver')
        screenRef.current = 'gameover'
        setScreen('gameover')
        setFinalScore(score)
      }

      // ── Render ───────────────────────────────────────────────────────────────
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const px = L.px

      // brief camera shake on impact (visual only — no effect on physics)
      if (flashRef.current > now) {
        const k = (flashRef.current - now) / FLASH_MS
        ctx.translate(Math.round((Math.random() - 0.5) * 2 * px * k), Math.round((Math.random() - 0.5) * 2 * px * k))
      }

      drawWorld(ctx, L, st.scroll, now)

      for (const hz of hazardsRef.current) {
        const hcx = rL + (hz.lane + 0.5) * laneW
        if (hz.type === 0) drawPothole(ctx, hcx, hz.y, hz.hw, hz.hl, px)
        else                drawDog(ctx, hcx, hz.y, hz.hw, hz.hl, px)
      }

      for (const v of trafficRef.current) {
        const def = TRAFFIC_DEFS[v.type]
        drawTrafficVehicle(ctx, v.type, v.id, rL + (v.lane + 0.5) * laneW, v.y, def.hwR * rW, def.hlR * rW, px)
      }

      // Passenger / Package indicator
      if (mType === 'passenger' && (ms.phase === 'searching' || ms.phase === 'approaching') && ms.passY > -50 && ms.passY < h + 50) {
        drawPassenger(ctx, passX, ms.passY, ms.phase === 'approaching', now, px)
      }
      if (mType === 'package' && ms.phase === 'searching' && ms.passY > -50 && ms.passY < h + 50) {
        const pkgX  = rL + (ms.pkgLane + 0.5) * laneW
        const pkgHW = rW * 0.07
        drawPackage(ctx, pkgX, ms.passY, pkgHW, now, px)
      }

      // Destination marker
      if (ms.phase === 'riding' && ms.destRemain < DEST_MARKER_DIST) {
        drawDestMarker(ctx, w * 0.5, autoY - ms.destRemain, ms.destName, now, px)
      }

      // speed streaks along the kerbs when going fast
      if (st.speed > BASE_SPEED * 1.2) {
        const k = Math.min(1, (st.speed - BASE_SPEED * 1.2) / (effMaxSpeed - BASE_SPEED * 1.2 + 1))
        ctx.fillStyle = `rgba(255,255,255,${(0.12 + k * 0.25).toFixed(2)})`
        const period = 46 * px
        const off = (st.scroll * 1.6) % period
        for (let y = off - period; y < h; y += period) {
          ctx.fillRect(rL + 2 * px, y, px, 18 * px)
          ctx.fillRect(rR - 3 * px, y + period / 2, px, 18 * px)
        }
      }

      if (cleanSpriteRef.current) {
        // same garage tints as before (COLOR_DEFS), applied to the crisp sprite
        const tint = COLOR_DEFS[garageRef.current.equippedColor].tint
        drawPlayer(ctx, cleanSpriteRef.current, tint, st.autoX, autoY, hw, hl, dpr, px, now < st.hornUntil)
      }

      // overhead gantry signs pass above the traffic
      drawOverhead(ctx, L, st.scroll)

      // near-miss pop
      const pop = nearMissPopRef.current
      if (pop.until > now) {
        const t = 1 - (pop.until - now) / 900
        drawPop(ctx, L, `+${NEAR_MISS_BONUS} CLOSE CALL!`, pop.x, autoY - hl - 8 * px - t * 14 * px, Math.min(1, (pop.until - now) / 300))
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // HUD
      let hudCenter    = 'FIND FARE'
      let hudColor     = '#a0e4ff'
      let hudHint: string | undefined = 'WAVING RIDER AT THE KERB'
      let hudDist:      string | undefined
      let hudDistColor: string | undefined
      let hudProgress:  number | undefined

      if (mType === 'passenger') {
        if (ms.phase === 'approaching') { hudCenter = 'BOARD NOW!'; hudColor = '#ffd54f'; hudHint = 'STEER TO THE KERB' }
        else if (ms.phase === 'riding') {
          hudCenter   = ms.destName
          hudColor    = '#ffffff'
          hudProgress = 1 - ms.destRemain / Math.max(1, ms.destTotal)
          hudDist     = `${Math.round(ms.destRemain)}m`
          if (ms.destRemain < DEST_MARKER_DIST) hudDistColor = '#66bb6a'
        }
      } else if (mType === 'package') {
        if (ms.phase === 'searching') { hudCenter = 'FIND PKG'; hudHint = 'DRIVE OVER THE PARCEL' }
        else {
          hudCenter   = ms.destName
          hudColor    = '#ffffff'
          hudProgress = 1 - ms.destRemain / Math.max(1, ms.destTotal)
          hudDist     = `${Math.round(ms.destRemain)}m`
          if (ms.destRemain < DEST_MARKER_DIST) hudDistColor = '#66bb6a'
        }
      } else {
        // time trial — show destination and countdown
        hudCenter = ms.destName
        hudColor  = '#ffffff'
        const secs = Math.ceil(ms.timerSecs)
        const mins = Math.floor(secs / 60)
        const rem  = secs % 60
        hudProgress  = 1 - ms.destRemain / Math.max(1, ms.destTotal)
        hudDist      = mins > 0 ? `${mins}:${String(rem).padStart(2, '0')}` : `${rem}s`
        hudDistColor = ms.timerSecs < 10 ? '#ef5350' : '#ffd54f'
      }

      drawHUD(ctx, L, {
        score, speed: st.speed, maxSpeed: effMaxSpeed, condition: st.condition,
        coins: statsRef.current.coins,
        objective: hudCenter, objColor: hudColor, hint: hudHint,
        detail: hudDist, detailColor: hudDistColor, progress: hudProgress,
        nIdx: neighbourhoodIdx,
      })

      // Pickup notification
      if (ms.notifUntil > now) {
        const alpha = Math.min(1, (ms.notifUntil - now) / 400)
        drawToast(ctx, L, mType === 'package' ? 'PACKAGE COLLECTED!' : 'PASSENGER PICKED UP!', '#66bb6a', alpha, Math.round(h * 0.34))
      }

      // Neighbourhood entry banner
      if (nbrNotifRef.current > now) {
        const alpha = Math.min(1, (nbrNotifRef.current - now) / 400)
        drawNeighbourhoodBanner(ctx, L, neighbourhoodIdx, alpha)
      }

      if (flashRef.current > now) {
        const alpha = ((flashRef.current - now) / FLASH_MS) * 0.38
        ctx.fillStyle = `rgba(239,68,68,${alpha.toFixed(3)})`
        ctx.fillRect(0, 0, w, h)
      }

      if (!shouldGameOver && !missionComplete) rafRef.current = requestAnimationFrame(tick)
    }

    tickRef.current     = tick
    menuTickRef.current = menuTick
    rafRef.current      = requestAnimationFrame(menuTick)

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup',   onUp)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pointerdown', onAnyPointer)
    }
  }, [])

  // ── game flow functions ───────────────────────────────────────────────────────

  const startGame = (mType: MissionType = 'passenger') => {
    missionTypeRef.current = mType
    const { w, h } = dimsRef.current
    stateRef.current = { scroll: 0, autoX: w / 2, autoVX: 0, hornUntil: 0, condition: 100, speed: BASE_SPEED }
    trafficRef.current     = []
    hazardsRef.current     = []
    spawnRef.current       = { nextTime: performance.now() / 1000 + 2.0, idCounter: 0 }
    hazardSpawnRef.current = { nextTime: performance.now() / 1000 + 3.5, idCounter: 0 }
    nearMissBonusRef.current     = 0
    flashRef.current             = 0
    trafficGraceRef.current      = 0
    prevNeighbourhoodRef.current = 0
    nbrNotifRef.current          = 0
    nearMissPopRef.current       = { until: 0, x: 0 }
    missionRef.current = {
      phase:         mType === 'time' ? 'riding' : 'searching',
      passY:         mType === 'package' ? -(h * 0.5) : -(h * 0.6),
      passSide:      Math.random() < 0.5 ? 'left' : 'right',
      notifUntil:    0,
      destName:      mType === 'time' ? DEST_NAMES[Math.floor(Math.random() * DEST_NAMES.length)] : '',
      destRemain:    mType === 'time' ? TIME_DEST_DIST : 0,
      destTotal:     mType === 'time' ? TIME_DEST_DIST : 0,
      bonusAtPickup: 0,
      pkgLane:       Math.floor(Math.random() * NUM_LANES),
      timerSecs:     mType === 'time' ? TIME_CHALLENGE_SECS : 0,
    }
    keysRef.current.clear()
    lastRef.current   = 0
    screenRef.current = 'playing'
    setScreen('playing')
    setRideResult(null)
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tickRef.current)
  }

  // Shared by the HUD pause button, Escape and the hidden-tab handler. The game
  // loop is cancelled, so the auto, traffic, hazards and mission timer freeze
  // exactly where they are; the last frame stays visible under the pause card.
  const pauseGame = () => {
    if (screenRef.current !== 'playing') return
    cancelAnimationFrame(rafRef.current)
    keysRef.current.clear()
    const mt = missionTypeRef.current
    const ms = missionRef.current
    setPausedMission(
      mt === 'time'      ? `TIME TRIAL · ${ms.destName}` :
      ms.phase === 'riding' ? `${mt === 'package' ? 'DELIVERY' : 'RIDE'} TO ${ms.destName}` :
      mt === 'package'   ? 'PACKAGE RUN' : 'PASSENGER RIDE',
    )
    screenRef.current = 'paused'
    setScreen('paused')
  }

  useEffect(() => { uiScreenRef.current = screen }, [screen])

  // ── audio: one manager for the whole game (see game/audio/AudioManager.ts) ──
  useEffect(() => audio.attach(), [])
  useEffect(() => { audio.setPrefs(settings) }, [settings])
  useEffect(() => { audio.setScene(screen === 'playing' ? 'playing' : screen === 'paused' ? 'paused' : 'menu') }, [screen])

  const updateSettings = (patch: Partial<Settings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      return next
    })
  }

  const resumeGame = () => {
    cancelAnimationFrame(rafRef.current)
    keysRef.current.clear()
    screenRef.current = 'playing'
    setScreen('playing')
    lastRef.current = 0
    rafRef.current = requestAnimationFrame(tickRef.current)
  }

  // Restart / Play Again: leave the finished run cleanly. The game loop is
  // stopped and the animated street resumes behind Mission Select; choosing a
  // mission then calls startGame(), which resets every piece of run state.
  const goToMissionSelect = () => {
    cancelAnimationFrame(rafRef.current)
    keysRef.current.clear()
    lastRef.current   = 0
    screenRef.current = 'missionselect'
    setScreen('missionselect')
    setRideResult(null)
    rafRef.current = requestAnimationFrame(menuTickRef.current)
  }

  const continueRide = () => {
    if (missionTypeRef.current !== 'passenger') {
      goToMissionSelect()
      return
    }
    const { h } = dimsRef.current
    missionRef.current = {
      phase:         'searching',
      passY:         -(h * 0.6),
      passSide:      Math.random() < 0.5 ? 'left' : 'right',
      notifUntil:    0,
      destName:      '',
      destRemain:    0,
      destTotal:     0,
      bonusAtPickup: nearMissBonusRef.current,
      pkgLane:       0,
      timerSecs:     0,
    }
    setRideResult(null)
    screenRef.current = 'playing'
    setScreen('playing')
    lastRef.current = 0
    rafRef.current = requestAnimationFrame(tickRef.current)
  }

  useEffect(() => {
    pauseFnRef.current  = pauseGame
    resumeFnRef.current = resumeGame
  })

  const returnToMenu = () => {
    cancelAnimationFrame(rafRef.current)
    keysRef.current.clear()
    lastRef.current   = 0
    screenRef.current = 'menu'
    setScreen('menu')
    rafRef.current = requestAnimationFrame(menuTickRef.current)
  }

  // ── render ────────────────────────────────────────────────────────────────────

  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%', position: 'relative', touchAction: screen === 'playing' && touchUI ? 'none' : undefined }}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />

      {/* ── MAIN MENU: dedicated portrait cover screen (separate from gameplay) ── */}
      {screen === 'menu' && (
        <MainMenu
          coins={stats.coins}
          sound={settings.sound}
          music={settings.music}
          onStart={() => setScreen('missionselect')}
          onHowToPlay={() => setScreen('howtoplay')}
          onGarage={() => setScreen('garage')}
          onStats={() => setScreen('stats')}
          onToggleSound={() => updateSettings({ sound: !settings.sound })}
          onToggleMusic={() => updateSettings({ music: !settings.music })}
        />
      )}

      {/* ── HUD PAUSE BUTTON (under the HP panel) ── */}
      {screen === 'playing' && (
        <button
          type="button"
          className="bar-pause-btn"
          aria-label="Pause game"
          title="Pause (Esc)"
          style={{ top: pauseBtn.top, right: pauseBtn.right, width: touchUI ? Math.max(48, pauseBtn.size) : pauseBtn.size, height: touchUI ? Math.max(48, pauseBtn.size) : pauseBtn.size }}
          onMouseDown={e => e.preventDefault()}   // keep keyboard focus on the game
          onClick={pauseGame}
        >
          <span /><span />
        </button>
      )}

      {/* ── TOUCH CONTROLS: hold the same key codes as the keyboard ── */}
      {screen === 'playing' && touchUI && frame.w > 0 && (
        <TouchControls
          keysRef={keysRef}
          onHorn={() => { stateRef.current.hornUntil = performance.now() + HORN_MS; audio.play('horn') }}
          w={frame.w}
          h={frame.h}
        />
      )}

      {/* ── PAUSED: full-frame dim over the frozen game + pause card ── */}
      {screen === 'paused' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(14,9,24,0.62)', padding: 16, boxSizing: 'border-box' }}>
          <div
            role="dialog"
            aria-label="Game paused"
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
              width: 'min(100%, 360px)', padding: '28px 22px 24px', boxSizing: 'border-box',
              background: '#221c2b', border: '5px solid #f5c842', borderRadius: 12,
              boxShadow: '0 0 0 2px #2a2238, 0 0 0 5px #7fe3f0, 0 0 0 7px #2a2238, inset 0 0 0 2px #2a2238',
            }}
          >
            <p style={{ margin: 0, fontFamily: RETRO_FONT, fontSize: 22, color: '#f6c624', letterSpacing: '0.08em', textShadow: '3px 3px 0 #8a5a00' }}>
              PAUSED
            </p>
            {pausedMission && (
              <p style={{ margin: 0, fontFamily: RETRO_FONT, fontSize: 9, color: '#b9a7d6', letterSpacing: '0.06em', textAlign: 'center', lineHeight: 1.6 }}>
                {pausedMission}
              </p>
            )}
            <button type="button" className="bar-btn bar-btn--primary" style={{ width: '100%', maxWidth: 240, height: 44, fontSize: 13, marginTop: 6 }} onClick={resumeGame} autoFocus>
              RESUME
            </button>
            <button type="button" className="bar-btn bar-btn--secondary" style={{ width: '100%', maxWidth: 240, height: 44, fontSize: 12 }} onClick={returnToMenu}>
              MAIN MENU
            </button>
            <p style={{ margin: '4px 0 0', fontFamily: RETRO_FONT, fontSize: 8, color: '#8a8299', letterSpacing: '0.06em' }}>
              ESC TO RESUME
            </p>
          </div>
        </div>
      )}

      {/* Other menus/overlays live in a centred column so they stay readable on wide frames.
          It is a full-height transparent layer ABOVE MainMenu / the pause button, so it must
          only take pointer events on screens that actually render inside it — otherwise it
          swallows every real click on the main menu. */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 'min(100%, max(560px, 62svh))', pointerEvents: COLUMN_SCREENS.has(screen) ? 'auto' : 'none' }}>

      {/* ── MISSION SELECT ── */}
      {screen === 'missionselect' && (
        <div style={{
          ...overlayBase,
          background: 'rgba(0,0,0,0.90)',
          justifyContent: 'flex-start',
          padding: '5% 6%',
          overflowY: 'auto',
          boxSizing: 'border-box',
        }}>
          <p style={{
            fontFamily: RETRO_FONT,
            fontSize: 'clamp(10px, 3vw, 16px)',
            color: '#aa3bff',
            margin: '0 0 6% 0',
            textAlign: 'center',
            width: '100%',
            letterSpacing: '0.05em',
          }}>
            CHOOSE MISSION
          </p>

          {([
            {
              type:   'passenger' as MissionType,
              label:  'PASSENGER RIDE',
              desc:   'PICK UP A FARE\nREACH DESTINATION',
              reward: 'EARN ₹ + COINS',
              color:  '#66bb6a',
              icon:   '🛺',
            },
            {
              type:   'package' as MissionType,
              label:  'PACKAGE RUN',
              desc:   'COLLECT PACKAGE\nDELIVER ON TIME',
              reward: `${PKG_COINS}+ COINS`,
              color:  '#ffa726',
              icon:   '📦',
            },
            {
              type:   'time' as MissionType,
              label:  'TIME TRIAL',
              desc:   `REACH DEST IN\n${TIME_CHALLENGE_SECS}S`,
              reward: 'UP TO 35 COINS',
              color:  '#ef5350',
              icon:   '⏱',
            },
          ] as Array<{ type: MissionType; label: string; desc: string; reward: string; color: string; icon: string }>).map(m => (
            <div key={m.type} style={{
              width: '100%',
              border: `2px solid ${m.color}`,
              marginBottom: '5%',
              padding: '5%',
              background: `${m.color}18`,
              boxSizing: 'border-box',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '5%' }}>
                <div>
                  <p style={{ fontFamily: RETRO_FONT, fontSize: 'clamp(7px, 2.2vw, 12px)', color: m.color, margin: '0 0 6px 0' }}>
                    {m.label}
                  </p>
                  <p style={{ fontFamily: RETRO_FONT, fontSize: 'clamp(5px, 1.5vw, 8px)', color: '#9e9e9e', margin: 0, whiteSpace: 'pre-line', lineHeight: 1.9 }}>
                    {m.desc}
                  </p>
                </div>
                <span style={{ fontSize: 'clamp(22px, 7vw, 36px)', lineHeight: 1 }}>{m.icon}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: RETRO_FONT, fontSize: 'clamp(5px, 1.5vw, 8px)', color: '#ffd54f' }}>
                  {m.reward}
                </span>
                <Button size="default" onClick={() => startGame(m.type)}>SELECT</Button>
              </div>
            </div>
          ))}

          <Button size="default" onClick={() => setScreen('menu')}>← BACK</Button>
        </div>
      )}

      {/* ── PLAYER STATS ── */}
      {screen === 'stats' && (
        <div style={{
          ...overlayBase,
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.92)',
          padding: '5% 7%',
        }}>
          <p style={{
            fontFamily: RETRO_FONT,
            fontSize: 'clamp(11px, 3.2vw, 17px)',
            color: '#aa3bff',
            margin: '0 0 8% 0',
            letterSpacing: '0.05em',
          }}>
            PLAYER STATS
          </p>

          <div style={{
            display: 'flex', flexDirection: 'column', gap: '10px',
            width: '100%', marginBottom: '10%',
          }}>
            {([
              ['RIDES DONE',   String(stats.totalRides)],
              ['COINS',        String(stats.coins)],
              ['FARE EARNED',  `Rs.${stats.totalFare}`],
              ['HIGH SCORE',   String(stats.highScore).padStart(5, '0')],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between',
                fontFamily: RETRO_FONT,
                fontSize: 'clamp(7px, 2vw, 11px)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                paddingBottom: '7px',
              }}>
                <span style={{ color: '#9e9e9e' }}>{label}</span>
                <span style={{ color: '#f1c40f' }}>{value}</span>
              </div>
            ))}
          </div>

          <Button size="default" onClick={() => setScreen('menu')}>← BACK</Button>
        </div>
      )}

      {/* ── GARAGE ── */}
      {screen === 'garage' && (
        <Garage
          stats={stats}
          garage={garageData}
          onUpdate={(newGarage, newStats) => {
            garageRef.current = newGarage
            statsRef.current  = newStats
            saveGarage(newGarage)
            saveStats(newStats)
            setGarageData(newGarage)
            setStats(newStats)
          }}
          onBack={() => setScreen('menu')}
        />
      )}

      {/* ── HOW TO PLAY ── */}
      {screen === 'howtoplay' && (
        <div style={{
          ...overlayBase,
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.90)',
          padding: '5% 7%',
          gap: '0',
        }}>
          <p style={{
            fontFamily: RETRO_FONT,
            fontSize: 'clamp(11px, 3.2vw, 17px)',
            color: '#aa3bff',
            margin: '0 0 6% 0',
            letterSpacing: '0.05em',
          }}>
            HOW TO PLAY
          </p>

          <div style={{
            display: 'flex', flexDirection: 'column', gap: '8px',
            width: '100%', marginBottom: '8%',
          }}>
            {([
              ['W / ↑',    'ACCELERATE'],
              ['S / ↓',    'BRAKE'],
              ['A / ← D / →', 'STEER'],
              ['SPACE',    'HORN'],
              ['ESC',      'PAUSE'],
            ] as [string, string][]).map(([key, action]) => (
              <div key={key} style={{
                display: 'flex', justifyContent: 'space-between',
                fontFamily: RETRO_FONT,
                fontSize: 'clamp(7px, 2vw, 11px)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                paddingBottom: '6px',
              }}>
                <span style={{ color: '#f1c40f' }}>{key}</span>
                <span style={{ color: '#e0e0e0' }}>{action}</span>
              </div>
            ))}
          </div>

          <div style={{
            fontFamily: RETRO_FONT,
            fontSize: 'clamp(6px, 1.8vw, 9px)',
            color: '#9e9e9e',
            textAlign: 'center',
            lineHeight: 2.0,
            marginBottom: '8%',
          }}>
            STEER TO KERB → PICK UP FARE<br />
            REACH DESTINATION → EARN ₹<br />
            NEAR MISS: +50 PTS<br />
            HP = 0 → GAME OVER
          </div>

          <Button size="default" onClick={() => setScreen('menu')}>← BACK</Button>
        </div>
      )}

      {/* ── GAME OVER ── */}
      {screen === 'gameover' && (
        <div style={{
          ...overlayBase,
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.85)',
          gap: '20px',
        }}>
          <p style={{
            fontFamily: RETRO_FONT,
            fontSize: 'clamp(18px, 5vw, 32px)',
            color: '#ef4444',
            margin: 0,
            textAlign: 'center',
            lineHeight: 1.7,
            textShadow: '0 0 24px rgba(239,68,68,0.55)',
          }}>
            GAME OVER
          </p>
          <p style={{
            fontFamily: RETRO_FONT,
            fontSize: 'clamp(10px, 2.8vw, 16px)',
            color: '#f1c40f',
            margin: 0,
            textShadow: '2px 2px 0 rgba(0,0,0,0.5)',
          }}>
            SCORE: {String(finalScore).padStart(5, '0')}
          </p>
          <Button size="lg" onClick={goToMissionSelect}>RESTART</Button>
          <Button size="default" onClick={returnToMenu}>MAIN MENU</Button>
        </div>
      )}

      {/* ── RIDE COMPLETE ── */}
      {screen === 'ridecomplete' && rideResult && (() => {
        const labelColor = rideResult.label === 'TIME UP!'        ? '#ef5350'
                         : rideResult.label === 'DELIVERY DONE!'  ? '#ffa726'
                         : rideResult.label === 'MISSION CLEAR!'  ? '#f1c40f'
                         : '#66bb6a'
        const isPassenger = missionTypeRef.current === 'passenger'
        return (
          <div style={{
            ...overlayBase,
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.88)',
            gap: '14px',
          }}>
            <p style={{
              fontFamily: RETRO_FONT,
              fontSize: 'clamp(12px, 3.5vw, 20px)',
              color: labelColor,
              margin: 0,
              textShadow: '2px 2px 0 rgba(0,0,0,0.5)',
              textAlign: 'center',
            }}>
              {rideResult.label}
            </p>
            <p style={{
              fontFamily: RETRO_FONT,
              fontSize: 'clamp(7px, 2vw, 11px)',
              color: '#a0e4ff',
              margin: 0,
              letterSpacing: '0.04em',
            }}>
              {rideResult.destName}
            </p>
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: '8px',
              border: `2px solid ${labelColor}`,
              padding: '12px 24px',
              background: `${labelColor}14`,
            }}>
              {rideResult.fare > 0 && (
                <p style={{ fontFamily: RETRO_FONT, fontSize: 'clamp(8px, 2.2vw, 13px)', color: '#f1c40f', margin: 0 }}>
                  FARE: ₹{rideResult.fare}
                </p>
              )}
              <p style={{ fontFamily: RETRO_FONT, fontSize: 'clamp(7px, 2vw, 11px)', color: '#ffd54f', margin: 0 }}>
                {rideResult.coins > 0 ? `+${rideResult.coins} COINS` : 'NO COINS'}
              </p>
              {rideResult.bonus > 0 && (
                <p style={{ fontFamily: RETRO_FONT, fontSize: 'clamp(6px, 1.8vw, 10px)', color: '#66bb6a', margin: 0 }}>
                  BONUS: +{rideResult.bonus}
                </p>
              )}
              <p style={{
                fontFamily: RETRO_FONT,
                fontSize: 'clamp(6px, 1.8vw, 10px)',
                color: '#9e9e9e', margin: '4px 0 0 0',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                paddingTop: '6px',
                alignSelf: 'stretch',
                textAlign: 'center',
              }}>
                WALLET: {rideResult.totalCoins} COINS
              </p>
            </div>
            {isPassenger
              ? <Button size="lg" onClick={continueRide}>CONTINUE</Button>
              : <Button size="lg" onClick={goToMissionSelect}>PLAY AGAIN</Button>
            }
            <Button size="default" onClick={returnToMenu}>MAIN MENU</Button>
          </div>
        )
      })()}
      </div>
    </div>
  )
}
