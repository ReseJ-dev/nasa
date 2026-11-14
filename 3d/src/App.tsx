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
  isolation: 'Isolation step',
  isolationHotkey: 'I',
  isolationCaption: 'Isolation: sleep, alertness and activity break down',
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

// Lets a step schedule its own later writes; the demo clears them on stop.
type Schedule = (fn: () => void, ms: number) => void

interface DemoStep {
  at: number // seconds from the start
  caption: string
  focus?: ThreatId | null // undefined = keep
  layer?: Layer
  run?: (schedule: Schedule) => void
}

const store = () => useHealthStore.getState()

const ENVIRONMENT_IDS: SimEnvironment[] = ['station', 'transit', 'mars_surface']
function setEnvironment(id: SimEnvironment) {
  const commDelaySec = ENVIRONMENTS[id].commDelaySec
  store().patch({ commDelaySec })
  store().setThreatLevel('distance', Math.min(commDelaySec / DISTANCE_DELAY_FULL_SEC, 1))
}
const critical = SCENARIOS.critical

// ---- Isolation step ------------------------------------------------------------------
// The presentation moment: from healthy values, over ISOLATION_STEP.rampS seconds sleep shrinks
// (8 h -> 5 h), the sleep arc rotates by 3 h, the reaction readout climbs and the last two
// activity bars drop; then the alerts appear and the brain lights up.
// Only scripted values move here (healthy preset -> critical preset); the alerts and the brain
// state are the ones the simulation computed for the critical preset. The twin smooths every
// value itself, so a few writes per second look continuous.
const ISOLATION_STEP = {
  leadS: 1.4, // the elements fade in first (ring -> impulse -> bars -> labels)
  rampS: 4,
  frameMs: 200,
  alertAfterS: 0.4, // pause between the end of the ramp and the alert
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t

function isolationFrame(t: number) {
  const a = SCENARIOS.healthy
  const b = critical
  const e = t * t * (3 - 2 * t) // ease in and out
  store().patch({
    sleepHours: mix(a.sleepHours, b.sleepHours, e),
    sleepShiftHours: mix(a.sleepShiftHours, b.sleepShiftHours, e),
    brightLightMin: mix(a.brightLightMin, b.brightLightMin, e),
    reactionMs: mix(a.reactionMs, b.reactionMs, e),
    reactionLapses: Math.round(mix(a.reactionLapses, b.reactionLapses, e)),
    mood: mix(a.mood, b.mood, e),
    activityMin: mix(a.activityMin, b.activityMin, e),
    history: b.history.map((day, i) => ({
      sleepHours: mix(a.history[i].sleepHours, day.sleepHours, e),
      activityMin: mix(a.history[i].activityMin, day.activityMin, e),
    })),
  })
}

function runIsolationStep(schedule: Schedule) {
  isolationFrame(0)
  store().patch({ alerts: SCENARIOS.healthy.alerts })
  const frames = Math.round((ISOLATION_STEP.rampS * 1000) / ISOLATION_STEP.frameMs)
  const lead = ISOLATION_STEP.leadS * 1000
  for (let i = 1; i <= frames; i++) schedule(() => isolationFrame(i / frames), lead + i * ISOLATION_STEP.frameMs)
  schedule(
    () => {
      store().setThreatLevel('isolation', critical.threats.isolation.level)
      // only the brain changes; the other regions keep their objects
      store().patch({ alerts: critical.alerts, regions: { ...store().regions, brain: critical.regions.brain } })
    },
    lead + (ISOLATION_STEP.rampS + ISOLATION_STEP.alertAfterS) * 1000,
  )
}

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
    run: (schedule) => {
      store().setThreatLevel('isolation', 0.5)
      store().patch({ inShelter: true })
      runIsolationStep(schedule) // about 6 s; the next step waits for it
    },
  },
  {
    at: 18,
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
    at: 25,
    caption: 'Earth is not answering',
    focus: 'distance',
    run: () => {
      store().setThreatLevel('distance', critical.threats.distance.level)
      store().patch({ earthLink: false, commDelaySec: critical.commDelaySec })
    },
  },
  {
    at: 31,
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
    at: 35,
    caption: 'Landing: 1 g',
    layer: 'skeleton',
    run: () => store().patch({ gravityField: GRAVITY_FIELDS.earth }),
  },
  {
    at: 43,
    caption: 'How the threats feed each other',
    focus: null,
    layer: 'body',
    run: () => store().patch({ threatLinks: critical.threatLinks }),
  },
]

// Dev deep link, e.g. ?preset=critical&focus=isolation&layer=skeleton (handy for screenshots).
const params = new URLSearchParams(location.search)
const START_PRESET = SCENARIO_BUTTONS.find((id) => id === params.get('preset'))
const START_FOCUS = (Object.keys(SCENARIOS.healthy.threats) as ThreatId[]).find((id) => id === params.get('focus')) ?? null
const START_LAYER: Layer = params.get('layer') === 'skeleton' ? 'skeleton' : 'body'
if (START_PRESET) store().setScenario(START_PRESET)

function useDemo() {
  const [running, setRunning] = useState(false)
  const [view, setView] = useState<DemoView>({ focus: START_FOCUS, layer: START_LAYER, caption: '' })
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

  const schedule = useCallback<Schedule>((fn, ms) => {
    timers.current.push(setTimeout(fn, ms))
  }, [])

  // The isolation step on its own: healthy values, isolation in focus, then the ramp.
  const startIsolation = useCallback(() => {
    clear()
    setRunning(true)
    store().setScenario('healthy')
    setView({ focus: 'isolation', layer: 'body', caption: DEMO_LABEL.isolationCaption })
    runIsolationStep(schedule)
    const total = ISOLATION_STEP.leadS + ISOLATION_STEP.rampS + ISOLATION_STEP.alertAfterS
    schedule(() => setRunning(false), total * 1000) // step over, view stays
  }, [schedule])

  const start = useCallback(() => {
    clear()
    setRunning(true)
    for (const step of DEMO) {
      timers.current.push(
        setTimeout(() => {
          step.run?.(schedule)
          setView((v) => ({
            focus: step.focus === undefined ? v.focus : step.focus,
            layer: step.layer ?? v.layer,
            caption: `${step.at} s · ${step.caption}`,
          }))
          if (step === DEMO[DEMO.length - 1]) setRunning(false) // last step: demo over, view stays
        }, step.at * 1000),
      )
    }
  }, [schedule])

  useEffect(() => clear, [])
  return { running, view, setView, start, startIsolation, stop }
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
