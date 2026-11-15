import { useCallback, useEffect, useRef, useState } from 'react'
import type { ThreatId } from './contract/types'
import { SCENARIOS } from './twin/mockStore'
import { useHealthStore } from './twin/store'
import { GRAVITY_FIELDS, type Layer } from './twin/config'
import { loadPreset } from './ui/presetState'

// Scripted demo (key D) and the isolation step (key I), shared by the presentation screen
// and the dev page. Only scripted values move here; nothing is computed.

export const DEMO_LABEL = {
  button: 'Demo',
  stop: 'Stop demo (Esc)',
  hotkey: 'D',
  isolation: 'Isolation step',
  isolationHotkey: 'I',
  isolationCaption: 'Isolation: sleep, alertness and activity break down',
}

const store = () => useHealthStore.getState()

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
      ...day, // keeps the other tracked fields (reaction, mood, CO2) of the target day
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
  { at: 0, caption: 'Healthy crew, day 0', focus: null, layer: 'body', run: () => loadPreset('healthy') },
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

export function useDemo(initial: Partial<DemoView> = {}) {
  const [running, setRunning] = useState(false)
  const [view, setView] = useState<DemoView>({ focus: null, layer: 'body', caption: '', ...initial })
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const clear = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  const stop = useCallback(() => {
    clear()
    setRunning(false)
    loadPreset('healthy')
    setView({ focus: null, layer: 'body', caption: '' })
  }, [])

  const schedule = useCallback<Schedule>((fn, ms) => {
    timers.current.push(setTimeout(fn, ms))
  }, [])

  // The isolation step on its own: healthy values, isolation in focus, then the ramp.
  const startIsolation = useCallback(() => {
    clear()
    setRunning(true)
    loadPreset('healthy')
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
