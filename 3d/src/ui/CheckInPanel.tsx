import { useCallback, useState, type FormEvent } from 'react'
import { useHealthStore } from '../twin/store'
import { checkInDefault, pressurePairValid, type CheckInKey } from './checkIn'
import { ReactionTest, type ReactionResult } from './ReactionTest'

// Left panel "Today": the daily check-in form, the reaction test and today's checklist.
// Submit writes the values to the shared store inputs (vitals + sleepHours); the engine
// recomputes the regions and the twin follows. Never writes regions.

type FieldKey = CheckInKey

interface Field {
  key: FieldKey
  label: string
  unit: string
  min: number // input limits: values outside are rejected as typos, not medical thresholds
  max: number
  step: number
}

const FIELDS: Field[] = [
  { key: 'systolic', label: 'Systolic', unit: 'mmHg', min: 70, max: 220, step: 1 },
  { key: 'diastolic', label: 'Diastolic', unit: 'mmHg', min: 40, max: 140, step: 1 },
  { key: 'heartRate', label: 'Pulse', unit: 'bpm', min: 30, max: 220, step: 1 },
  { key: 'glucose', label: 'Glucose', unit: 'mmol/L', min: 2, max: 30, step: 0.1 },
  { key: 'bodyTempC', label: 'Temperature', unit: '°C', min: 34, max: 42, step: 0.1 },
  { key: 'sleepHours', label: 'Sleep', unit: 'h', min: 0, max: 16, step: 0.25 },
  { key: 'mood', label: 'Mood', unit: '1–5', min: 1, max: 5, step: 1 },
]
// Full names for error messages (the form labels are short to fit two fields per row).
const FULL_LABEL: Partial<Record<FieldKey, string>> = {
  systolic: 'Systolic pressure',
  diastolic: 'Diastolic pressure',
  glucose: 'Blood glucose',
  bodyTempC: 'Body temperature',
  sleepHours: 'Sleep last night',
}
const MOODS = [1, 2, 3, 4, 5]
const MOOD_HINT: Record<number, string> = { 1: 'very low', 2: 'low', 3: 'okay', 4: 'good', 5: 'great' }

type Checklist = { pressure: boolean; sleep: boolean; reaction: boolean }
const CHECKLIST: { key: keyof Checklist; label: string }[] = [
  { key: 'pressure', label: 'Blood pressure' },
  { key: 'sleep', label: 'Sleep log' },
  { key: 'reaction', label: 'Reaction test' },
]
const EMPTY_CHECKS: Checklist = { pressure: false, sleep: false, reaction: false }

const TEXT = {
  title: 'Today',
  subtitle: (day: number) => `Check-in · day ${day}`,
  useLast: 'Use last value',
  noChange: 'Change at least one value, then submit.',
  submit: 'Submit check-in',
  saved: 'Check-in saved. The twin and statuses are updated.',
  pressurePair: 'Enter both systolic and diastolic pressure.',
  pressureOrder: 'Systolic pressure must be higher than diastolic. Check both values.',
  range: (f: Field) => `${FULL_LABEL[f.key] ?? f.label}: enter ${f.min}–${f.max} ${f.unit === '1–5' ? '' : f.unit}`.trim(),
  reaction: 'Reaction test (30 s)',
  lastReaction: (ms: number, lapses: number) => `Last result: ${ms} ms, ${lapses} lapse${lapses === 1 ? '' : 's'}`,
  checklist: "Today's checklist",
}

// As many decimals as the field's step: 5.6 mmol/L, 36.6 °C, 7.25 h, 118 mmHg.
const format = (v: number, step: number) =>
  step >= 1 ? String(Math.round(v)) : String(Number(v.toFixed(step < 0.1 || (step * 10) % 1 !== 0 ? 2 : 1)))

export function CheckInPanel() {
  const day = useHealthStore((s) => s.day)
  const scenario = useHealthStore((s) => s.scenario)
  const inputs = useHealthStore((s) => s.inputs)
  const metrics = useHealthStore((s) => s.metrics)
  const sceneMood = useHealthStore((s) => s.mood)
  const reactionMs = useHealthStore((s) => s.inputs.vitals?.reactionMs)
  const lapses = useHealthStore((s) => s.reactionLapses ?? 0)
  const setInputs = useHealthStore((s) => s.setInputs)
  const submitReactionTest = useHealthStore((s) => s.submitReactionTest)

  const [values, setValues] = useState<Partial<Record<FieldKey, string>>>({})
  const [errors, setErrors] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  // Checklist of the current day; a new day (or scenario) starts unticked.
  const dayKey = `${scenario}:${day}`
  const [checks, setChecks] = useState<{ dayKey: string; items: Checklist }>({ dayKey, items: EMPTY_CHECKS })
  const today = checks.dayKey === dayKey ? checks.items : EMPTY_CHECKS
  const tick = (patch: Partial<Checklist>) => setChecks({ dayKey, items: { ...today, ...patch } })

  // Last value: the last check-in, else the current value in the store, else the pre-flight baseline.
  // Same source as the metrics panel (ui/checkIn.ts).
  const lastValue = (f: Field): number => checkInDefault(f.key, { inputs, metrics, mood: sceneMood })
  const setValue = (key: FieldKey, value: string) => {
    setSaved(false)
    setValues((v) => ({ ...v, [key]: value }))
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const problems: string[] = []
    const parsed: Partial<Record<FieldKey, number>> = {}
    for (const f of FIELDS) {
      const raw = values[f.key]?.trim()
      if (!raw) continue
      const n = Number(raw)
      if (!Number.isFinite(n) || n < f.min || n > f.max) problems.push(TEXT.range(f))
      else parsed[f.key] = n
    }
    // Every field shows its last value, so an untouched half of the pressure pair uses that value.
    if ((parsed.systolic !== undefined) !== (parsed.diastolic !== undefined)) {
      for (const f of FIELDS) {
        if ((f.key === 'systolic' || f.key === 'diastolic') && parsed[f.key] === undefined && !values[f.key]?.trim()) {
          parsed[f.key] = Number(format(lastValue(f), f.step))
        }
      }
    }
    const pressure = parsed.systolic !== undefined && parsed.diastolic !== undefined
    if ((parsed.systolic !== undefined) !== (parsed.diastolic !== undefined)) problems.push(TEXT.pressurePair)
    else if (pressure && !pressurePairValid(parsed.systolic!, parsed.diastolic!)) problems.push(TEXT.pressureOrder)
    if (problems.length === 0 && Object.keys(parsed).length === 0) problems.push(TEXT.noChange)
    setErrors(problems)
    if (problems.length) return

    const { sleepHours, ...vitals } = parsed
    setInputs({
      vitals: { ...inputs.vitals, ...vitals },
      ...(sleepHours !== undefined ? { sleepHours } : {}),
    })
    tick({ ...(pressure ? { pressure: true } : {}), ...(sleepHours !== undefined ? { sleep: true } : {}) })
    setValues({}) // the submitted values are now the last values: no field is marked as changed
    setSaved(true)
  }

  const onReaction = useCallback(
    (r: ReactionResult) => {
      submitReactionTest(r.meanMs, r.lapses)
      setChecks((c) => ({ dayKey, items: { ...(c.dayKey === dayKey ? c.items : EMPTY_CHECKS), reaction: true } }))
    },
    [submitReactionTest, dayKey],
  )
  const closeTest = useCallback(() => setTesting(false), [])

  return (
    <section className="health-card checkin" aria-labelledby="checkin-title">
      <div className="checkin-head">
        <h2 id="checkin-title">{TEXT.title}</h2>
        <small>{TEXT.subtitle(day)}</small>
      </div>

      <ul className="checkin-list" aria-label={TEXT.checklist}>
        {CHECKLIST.map((item) => (
          <li key={item.key} data-done={today[item.key]}>
            <span aria-hidden="true">{today[item.key] ? '✓' : ''}</span>
            {item.label}
          </li>
        ))}
      </ul>

      <form onSubmit={submit} noValidate>
        {FIELDS.map((f) => {
          // Every field shows a real value: what was typed, else the last value.
          const last = format(lastValue(f), f.step)
          const shown = values[f.key] ?? last
          const changed = values[f.key] !== undefined && values[f.key] !== last
          const id = `checkin-${f.key}`
          return (
            <div key={f.key} className="checkin-field" data-changed={changed} data-wide={f.key === 'mood'}>
              <label htmlFor={id}>
                {f.label} <small>{f.unit}</small>
              </label>
              <div className="checkin-row">
                {f.key === 'mood' ? (
                  <div className="control-segment" role="group" aria-label={f.label} id={id}>
                    {MOODS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        title={MOOD_HINT[m]}
                        aria-pressed={shown === String(m)}
                        onClick={() => setValue('mood', String(m))}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    id={id}
                    type="number"
                    inputMode="decimal"
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={shown}
                    onChange={(e) => setValue(f.key, e.currentTarget.value)}
                  />
                )}
                {changed && (
                  <button
                    type="button"
                    className="checkin-last"
                    aria-label={`${TEXT.useLast}: ${f.label}`}
                    title={`${TEXT.useLast}: ${last} ${f.unit === '1–5' ? '' : f.unit}`}
                    onClick={() => setValue(f.key, last)}
                  >
                    ↺
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {errors.length > 0 && (
          <ul className="checkin-errors" role="alert">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}
        <button type="submit" className="checkin-submit">{TEXT.submit}</button>
        {saved && <p role="status">{TEXT.saved}</p>}
      </form>

      <div className="checkin-reaction">
        <button type="button" onClick={() => setTesting(true)}>{TEXT.reaction}</button>
        {reactionMs !== undefined && <small>{TEXT.lastReaction(reactionMs, lapses)}</small>}
      </div>

      {testing && <ReactionTest onResult={onReaction} onClose={closeTest} />}
    </section>
  )
}
