import { GameCanvas } from './game/GameCanvas'

function App() {
  return (
    <div
      style={{
        width: '100vw',
        height: '100svh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1c1a26',
        overflow: 'hidden',
      }}
    >
      {/*
        Responsive game frame. The canvas fills the browser and keeps its
        pixels square (it is re-sized, never stretched). The aspect ratio is
        clamped between 9:16 (phones) and 16:10 (wide desktops) so ultra-wide
        and ultra-tall windows get only slim margins.

        Road, auto and traffic are sized from the 9:16 "playfield" width at
        this height (see computeLayout in game/world.ts), so physics feel is
        unchanged; the extra width becomes Bengaluru street scenery.
      */}
      <div
        style={{
          position: 'relative',
          width: 'min(100vw, calc(100svh * 16 / 10))',
          height: 'min(100svh, calc(100vw * 16 / 9))',
          overflow: 'hidden',
        }}
      >
        <GameCanvas />
      </div>
    </div>
  )
}

export default App
