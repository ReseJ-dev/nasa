import { useCallback, useEffect, useRef, useState } from 'react'
import type { SimEnvironment, ThreatId } from './contract/types'
import { DISTANCE_DELAY_FULL_SEC, ENVIRONMENTS } from './sim/constants'
import { BodyScene } from './twin'
import { Bench } from './Bench'
import { SCENARIOS, useHealthStore, type ScenarioId } from './twin/mockStore'
import { DEV_PANEL, REGION_LABEL } from './twin/labels'
import { GRAVITY_FIELDS, type Layer } from './twin/config'

// TEMPORARY dev page: test panel + scripted demo. Not part of the twin.

const GRAVITY_BUTTONS = ['zero', 'moon', 'mars', 'earth'] as const
const SCENARIO_BUTTONS: ScenarioId[] = ['healthy', 'day60', 'critical']

// Dev-page text (src/twin/labels.ts is the twin's own text and is not touched here).
const DEMO_LABEL = {
  button: 'Demo',
  stop: 'Stop demo (Esc)',
  hotkey: 'D',
}

// ---- Scripted demo -------------------------------------------------------------------
// Each step writes only the fields it changes (store.patch / setThreatLevel), so unchanged
// arrays such as `chain` keep their references. Values come from the critical scenario
// where possible (same objects, no new arrays).

interface DemoView {
  focus: ThreatId | null
  layer: Layer
  caption: string
}

interface DemoStep {
  at: number // seconds from the start
  caption: string
  focus?: ThreatId | null // undefined = keep
  layer?: Layer
  run?: () => void
}

const store = () => useHealthStore.getState()

const ENVIRONMENT_IDS: SimEnvironment[] = ['station', 'transit', 'mars_surface']
function setEnvironment(id: SimEnvironment) {
  const commDelaySec = ENVIRONMENTS[id].commDelaySec
  store().patch({ commDelaySec })
  store().setThreatLevel('distance', Math.min(commDelaySec / DISTANCE_DELAY_FULL_SEC, 1))
}
const critical = SCENARIOS.critical

const DEMO: DemoStep[] = [
  { at: 0, caption: 'Healthy crew, day 0', focus: null, layer: 'body', run: () => store().setScenario('healthy') },
  {
    at: 4,
    caption: 'Solar flare',
    focus: 'radiation',
    run: () => {
      store().setThreatLevel('radiation', critical.threats.radiation.level)
      store().patch({ radiationLevel: critical.radiationLevel, activeEvent: 'solar_flare', missionDay: 180 })
    },
  },
  {
    at: 9,
    caption: 'Crew in the shelter: isolation grows',
    focus: 'isolation',
    run: () => {
      store().setThreatLevel('isolation', 0.7)
      store().patch({ inShelter: true, sleepHours: critical.sleepHours, sleepShiftHours: critical.sleepShiftHours })
    },
  },
  {
    at: 15,
    caption: 'CO₂ builds up in the closed cabin',
    focus: 'environment',
    run: () => {
      const regions = store().regions
      store().setThreatLevel('environment', critical.threats.environment.level)
      store().patch({
        co2Level: critical.co2Level,
        cabinTempC: critical.cabinTempC,
        noiseDb: critical.noiseDb,
        chain: critical.chain,
        chainLinks: critical.chainLinks,
        // only the chain organs change; the other regions keep their objects
        regions: { ...regions, lungs: critical.regions.lungs, brain: critical.regions.brain, eyes: critical.regions.eyes },
      })
    },
  },
  {
    at: 22,
    caption: 'Earth is not answering',
    focus: 'distance',
    run: () => {
      store().setThreatLevel('distance', critical.threats.distance.level)
      store().patch({ earthLink: false, commDelaySec: critical.commDelaySec })
    },
  },
  {
    at: 28,
    caption: 'Microgravity: fluid shift and muscle loss',
    focus: 'gravity',
    run: () => {
      store().setThreatLevel('gravity', critical.threats.gravity.level)
      store().patch({
        fluidShift: critical.fluidShift,
        muscleMass: critical.muscleMass,
        boneDensity: critical.boneDensity, // needed for the landing: a weak bone to flash
      })
    },
  },
  {
    at: 32,
    caption: 'Landing: 1 g',
    layer: 'skeleton',
    run: () => store().patch({ gravityField: GRAVITY_FIELDS.earth }),
  },
  {
    at: 40,
    caption: 'How the threats feed each other',
    focus: null,
    layer: 'body',
    run: () => store().patch({ threatLinks: critical.threatLinks }),
  },
]

function useDemo() {
  const [running, setRunning] = useState(false)
  const [view, setView] = useState<DemoView>({ focus: null, layer: 'body', caption: '' })
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const clear = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  const stop = useCallback(() => {
    clear()
    setRunning(false)
    store().setScenario('healthy')
    setView({ focus: null, layer: 'body', caption: '' })
  }, [])

  const start = useCallback(() => {
    clear()
    setRunning(true)
    for (const step of DEMO) {
      timers.current.push(
        setTimeout(() => {
          step.run?.()
          setView((v) => ({
            focus: step.focus === undefined ? v.focus : step.focus,
            layer: step.layer ?? v.layer,
            caption: `${step.at} s · ${step.caption}`,
          }))
          if (step === DEMO[DEMO.length - 1]) setRunning(false) // last step: demo over, view stays
        }, step.at * 1000),
      )
    }
  }, [])

  useEffect(() => clear, [])
  return { running, view, setView, start, stop }
}

// ---- Dev page ------------------------------------------------------------------------

function TestPanel({ demo }: { demo: ReturnType<typeof useDemo> }) {
  const scenario = useHealthStore((s) => s.scenario)
  const setScenario = useHealthStore((s) => s.setScenario)
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
            onClick={() => setScenario(id)}
            style={{ fontWeight: scenario === id ? 'bold' : 'normal' }}
          >
            {DEV_PANEL.scenario[id]}
          </button>
        ))}
        <button onClick={demo.running ? demo.stop : demo.start} title={`${DEMO_LABEL.hotkey} / Esc`}>
          {demo.running ? DEMO_LABEL.stop : `${DEMO_LABEL.button} (${DEMO_LABEL.hotkey})`}
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
    </div>
  )
}

export default function App() {
  // Dev tool: FPS benchmark at ?bench (see Bench.tsx).
  if (location.search.includes('bench')) return <Bench />
  return <DevPage />
}

function DevPage() {
  const demo = useDemo()
  const { start, stop, setView } = demo

  // Hotkeys: D starts (or restarts) the demo, Esc stops it and resets to healthy.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'd' || e.key === 'D') start()
      if (e.key === 'Escape') stop()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [start, stop])

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
