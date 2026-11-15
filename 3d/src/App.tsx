import { useEffect } from 'react'
import type { SimEnvironment, ThreatId } from './contract/types'
import { DISTANCE_DELAY_FULL_SEC, ENVIRONMENTS } from './sim/constants'
import { BodyScene } from './twin'
import { Bench } from './Bench'
import { DEMO_LABEL, useDemo } from './demo'
import { SCENARIOS } from './twin/mockStore'
import { useHealthStore, type ScenarioId } from './twin/store'
import { HealthDashboard } from './ui/HealthDashboard'
import { loadPreset } from './ui/presetState'
import { SoundControls } from './ui/SoundControls'
import { DEV_PANEL, REGION_LABEL } from './twin/labels'
import { GRAVITY_FIELDS, type Layer } from './twin/config'

// App entry: the presentation screen by default; the TEMPORARY dev page (test panel + scripted
// demo, not part of the twin) behind ?dev / ?preset / ?focus / ?layer; the FPS bench at ?bench.

const GRAVITY_BUTTONS = ['zero', 'moon', 'mars', 'earth'] as const
const SCENARIO_BUTTONS: ScenarioId[] = ['healthy', 'day60', 'critical']

const store = () => useHealthStore.getState()

const ENVIRONMENT_IDS: SimEnvironment[] = ['station', 'transit', 'mars_surface']
function setEnvironment(id: SimEnvironment) {
  const commDelaySec = ENVIRONMENTS[id].commDelaySec
  store().patch({ commDelaySec })
  store().setThreatLevel('distance', Math.min(commDelaySec / DISTANCE_DELAY_FULL_SEC, 1))
}
// Dev deep link, e.g. ?preset=critical&focus=isolation&layer=skeleton (handy for screenshots).
const params = new URLSearchParams(location.search)
const START_PRESET = SCENARIO_BUTTONS.find((id) => id === params.get('preset'))
const START_FOCUS = (Object.keys(SCENARIOS.healthy.threats) as ThreatId[]).find((id) => id === params.get('focus')) ?? null
const START_LAYER: Layer = params.get('layer') === 'skeleton' ? 'skeleton' : 'body'
if (START_PRESET) loadPreset(START_PRESET)

// ---- Dev page ------------------------------------------------------------------------

function TestPanel({ demo }: { demo: ReturnType<typeof useDemo> }) {
  const scenario = useHealthStore((s) => s.scenario)
  const selected = useHealthStore((s) => s.selectedRegion)
  const gravity = useHealthStore((s) => s.gravityField ?? 0)
  const setGravity = useHealthStore((s) => s.setGravityField)
  const earthLink = useHealthStore((s) => s.earthLink ?? true)
  const delay = useHealthStore((s) => s.commDelaySec ?? 0)
  const environment = ENVIRONMENT_IDS.find((e) => ENVIRONMENTS[e].commDelaySec === delay) ?? ''

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16, // top-left is taken by the FPS counter
        left: 16,
        padding: 12,
        borderRadius: 8,
        background: 'rgba(10, 14, 24, 0.8)',
        color: '#fff',
        font: '14px system-ui, sans-serif',
      }}
    >
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {SCENARIO_BUTTONS.map((id) => (
          <button
            key={id}
            onClick={() => loadPreset(id)}
            style={{ fontWeight: scenario === id ? 'bold' : 'normal' }}
          >
            {DEV_PANEL.scenario[id]}
          </button>
        ))}
        <button onClick={demo.running ? demo.stop : demo.start} title={`${DEMO_LABEL.hotkey} / Esc`}>
          {demo.running ? DEMO_LABEL.stop : `${DEMO_LABEL.button} (${DEMO_LABEL.hotkey})`}
        </button>
        <button onClick={demo.startIsolation} title={DEMO_LABEL.isolationHotkey}>
          {DEMO_LABEL.isolation} ({DEMO_LABEL.isolationHotkey})
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {GRAVITY_BUTTONS.map((id) => (
          <button
            key={id}
            onClick={() => setGravity(GRAVITY_FIELDS[id])}
            style={{ fontWeight: gravity === GRAVITY_FIELDS[id] ? 'bold' : 'normal' }}
          >
            {DEV_PANEL.gravity[id]}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={earthLink} onChange={(e) => store().patch({ earthLink: e.target.checked })} />
          {DEV_PANEL.earthLink}
        </label>
        {/* Sets the comm delay of that environment (and the distance threat level to match). */}
        <select value={environment} onChange={(e) => setEnvironment(e.target.value as SimEnvironment)}>
          {environment === '' && <option value="">{delay} s</option>}
          {ENVIRONMENT_IDS.map((id) => (
            <option key={id} value={id}>
              {DEV_PANEL.environment[id]}
            </option>
          ))}
        </select>
      </div>
      <div>
        {DEV_PANEL.selectedRegion}: {selected ? REGION_LABEL[selected] : DEV_PANEL.none}
      </div>
      {demo.view.caption && <div style={{ marginTop: 6, opacity: 0.8 }}>{demo.view.caption}</div>}
      <SoundControls />
    </div>
  )
}

export default function App() {
  // Dev tool: FPS benchmark at ?bench (see Bench.tsx).
  if (location.search.includes('bench')) return <Bench />
  // ?mode=present / ?mode=control always opens the main screen (a ?preset= still applies).
  const dev = params.has('dev') || params.has('preset') || params.has('focus') || params.has('layer')
  if (dev && !params.has('mode')) return <DevPage />
  return <HealthDashboard />
}

function DevPage() {
  const demo = useDemo({ focus: START_FOCUS, layer: START_LAYER })
  const { start, startIsolation, stop, setView } = demo

  // Hotkeys: D starts (or restarts) the demo, I plays the isolation step alone,
  // Esc stops either and resets to healthy.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'd' || e.key === 'D') start()
      if (e.key === 'i' || e.key === 'I') startIsolation()
      if (e.key === 'Escape') stop()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [start, startIsolation, stop])

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      {/* Layer and focus are controlled here, so the demo can drive them; the scene's own
          buttons and threat clicks still work through the callbacks. */}
      <BodyScene
        showFps
        layer={demo.view.layer}
        onLayerChange={(layer) => setView((v) => ({ ...v, layer }))}
        focusedThreat={demo.view.focus}
        onThreatClick={(id) => setView((v) => ({ ...v, focus: v.focus === id ? null : id }))}
      />
      <TestPanel demo={demo} />
    </div>
  )
}
