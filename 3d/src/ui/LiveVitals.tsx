import { useHealthStore } from '../twin/store'
import { ppmToMmHg } from '../../../src/engine/constants'
import { checkInDefault, type CheckInKey } from './checkIn'

// Live vitals (Control room): sliders that write straight into the shared store inputs on every
// move, the same inputs the check-in writes. The engine recomputes at once, so regions, alerts,
// the threats strip, the heartbeat and the charts follow live. Demo control only; no rules here.

type VitalKey = Exclude<CheckInKey, 'sleepHours'> | 'reactionMs'

interface Slider {
  key: VitalKey | 'sleepHours' | 'co2Ppm' | 'radiationMsv'
  label: string
  unit: string
  min: number
  max: number
  step: number
  show?(v: number): string
}

const SLIDERS: Slider[] = [
  { key: 'heartRate', label: 'Pulse', unit: 'bpm', min: 40, max: 180, step: 1 },
  { key: 'systolic', label: 'Systolic', unit: 'mmHg', min: 80, max: 200, step: 1 },
  { key: 'diastolic', label: 'Diastolic', unit: 'mmHg', min: 40, max: 130, step: 1 },
  { key: 'bodyTempC', label: 'Temperature', unit: '°C', min: 35, max: 40.5, step: 0.1, show: (v) => v.toFixed(1) },
  { key: 'glucose', label: 'Glucose', unit: 'mmol/L', min: 3, max: 15, step: 0.1, show: (v) => v.toFixed(1) },
  { key: 'sleepHours', label: 'Sleep', unit: 'h', min: 0, max: 10, step: 0.25, show: (v) => v.toFixed(2).replace(/0$/, '') },
  { key: 'mood', label: 'Mood', unit: '/ 5', min: 1, max: 5, step: 1 },
  { key: 'reactionMs', label: 'Reaction', unit: 'ms', min: 200, max: 600, step: 5 },
  { key: 'co2Ppm', label: 'Cabin CO₂', unit: 'mmHg', min: 400, max: 9000, step: 100, show: (v) => ppmToMmHg(v).toFixed(1) },
  { key: 'radiationMsv', label: 'Dose', unit: 'mSv', min: 0, max: 600, step: 5 },
]

const TEXT = {
  title: 'Live vitals',
  note: 'Drag a slider: the twin, alerts and threats update at once.',
}

export function LiveVitals() {
  const state = useHealthStore()
  const { inputs, setInputs } = state

  const value = (s: Slider): number => {
    if (s.key === 'co2Ppm') return inputs.co2Ppm ?? 2500
    if (s.key === 'radiationMsv') return inputs.radiationMsv ?? 0
    if (s.key === 'reactionMs') return inputs.vitals?.reactionMs ?? state.reactionMs ?? 260
    return checkInDefault(s.key, state)
  }

  const set = (s: Slider, v: number) => {
    if (s.key === 'co2Ppm') return setInputs({ co2Ppm: v })
    if (s.key === 'radiationMsv') return setInputs({ radiationMsv: v })
    if (s.key === 'sleepHours') return setInputs({ sleepHours: v })
    const vitals = { ...inputs.vitals, [s.key]: v }
    // keep the pressure pair valid: systolic stays above diastolic
    if (s.key === 'systolic' && vitals.diastolic !== undefined && v <= vitals.diastolic) vitals.diastolic = v - 1
    if (s.key === 'diastolic' && vitals.systolic !== undefined && v >= vitals.systolic) vitals.systolic = v + 1
    setInputs({ vitals })
  }

  return (
    <section className="health-card live-vitals" aria-labelledby="cr-live">
      <h3 id="cr-live">{TEXT.title}</h3>
      <p className="preset-note">{TEXT.note}</p>
      {SLIDERS.map((s) => {
        const v = value(s)
        return (
          <label key={s.key} className="live-vital">
            <span>{s.label}</span>
            <input type="range" min={s.min} max={s.max} step={s.step} value={v} onChange={(e) => set(s, Number(e.target.value))} />
            <b>
              {s.show ? s.show(v) : Math.round(v)} <small>{s.unit}</small>
            </b>
          </label>
        )
      })}
    </section>
  )
}
