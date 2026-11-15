import { useCallback, useState, type FormEvent } from 'react'
import type { Vitals } from '../contract/types'
import { useHealthStore } from '../twin/store'
import { PERSONAL_BASELINE } from '../../../src/data/baseline'
import { ReactionTest, type ReactionResult } from './ReactionTest'

// Left panel "Today": the daily check-in form, the reaction test and today's checklist.
// Submit writes the values to the shared store inputs (vitals + sleepHours); the engine
// recomputes the regions and the twin follows. Never writes regions.

type FieldKey = Exclude<keyof Vitals, 'reactionMs'>

interface Field {
  key: FieldKey
  label: string
  unit: string
  min: number // input limits: values outside are rejected as typos, not medical thresholds
  max: number
  step: number
  metricId?: string // store metric to fall back to for "Use last value"
}

const FIELDS: Field[] = [
  { key: 'systolic', label: 'Systolic pressure', unit: 'mmHg', min: 70, max: 220, step: 1, metricId: 'systolic' },
  { key: 'diastolic', label: 'Diastolic pressure', unit: 'mmHg', min: 40, max: 140, step: 1, metricId: 'diastolic' },
  { key: 'heartRate', label: 'Pulse', unit: 'bpm', min: 30, max: 220, step: 1, metricId: 'heart_rate' },
  { key: 'glucose', label: 'Blood glucose', unit: 'mmol/L', min: 2, max: 30, step: 0.1, metricId: 'glucose' },
  { key: 'bodyTempC', label: 'Body temperature', unit: '°C', min: 34, max: 42, step: 0.1, metricId: 'body_temp' },
  { key: 'sleepHours', label: 'Sleep last night', unit: 'h', min: 0, max: 16, step: 0.25, metricId: 'sleep_hours' },
  { key: 'mood', label: 'Mood', unit: '1–5', min: 1, max: 5, step: 1, metricId: 'mood' },
]
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
  subtitle: (day: number) => `Daily check-in · mission day ${day}`,
  useLast: 'Use last value',
  submit: 'Submit check-in',
  saved: 'Check-in saved. The twin and statuses are updated.',
  empty: 'Fill in at least one value.',
  pressurePair: 'Enter both systolic and diastolic pressure.',
  range: (f: Field) => `${f.label}: enter ${f.min}–${f.max} ${f.unit === '1–5' ? '' : f.unit}`.trim(),
  reaction: 'Reaction test (30 s)',
  lastReaction: (ms: number, lapses: number) => `Last result: ${ms} ms, ${lapses} lapse${lapses === 1 ? '' : 's'}`,
  checklist: "Today's checklist",
}

const format = (v: number, step: number) => (step < 1 ? String(Number(v.toFixed(2))) : String(Math.round(v)))

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
  const lastValue = (f: Field): number => {
    if (f.key === 'sleepHours') return inputs.sleepHours
    const checked = inputs.vitals?.[f.key]
    if (checked !== undefined) return checked
    const metric = f.metricId ? metrics.find((m) => m.id === f.metricId)?.value : undefined
    return metric ?? (f.key === 'mood' ? sceneMood : undefined) ?? PERSONAL_BASELINE[f.key]
  }
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
    const pressure = parsed.systolic !== undefined && parsed.diastolic !== undefined
    if ((parsed.systolic !== undefined) !== (parsed.diastolic !== undefined)) problems.push(TEXT.pressurePair)
    if (problems.length === 0 && Object.keys(parsed).length === 0) problems.push(TEXT.empty)
    setErrors(problems)
    if (problems.length) return

    const { sleepHours, ...vitals } = parsed
    setInputs({
      vitals: { ...inputs.vitals, ...vitals },
      ...(sleepHours !== undefined ? { sleepHours } : {}),
    })
    tick({ ...(pressure ? { pressure: true } : {}), ...(sleepHours !== undefined ? { sleep: true } : {}) })
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
      <h2 id="checkin-title">{TEXT.title}</h2>
      <p className="checkin-sub">{TEXT.subtitle(day)}</p>

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
          const last = lastValue(f)
          const id = `checkin-${f.key}`
          return (
            <div key={f.key} className="checkin-field">
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
                        aria-pressed={values.mood === String(m)}
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
                    placeholder={format(last, f.step)}
                    value={values[f.key] ?? ''}
                    onChange={(e) => setValue(f.key, e.currentTarget.value)}
                  />
                )}
                <button
                  type="button"
                  className="checkin-last"
                  title={`${TEXT.useLast}: ${format(last, f.step)} ${f.unit === '1–5' ? '' : f.unit}`}
                  onClick={() => setValue(f.key, format(last, f.step))}
                >
                  {TEXT.useLast}
                </button>
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
