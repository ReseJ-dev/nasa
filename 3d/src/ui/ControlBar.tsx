import { useMemo, useState } from 'react'
import type { BonePart, RegionId, SimEnvironment, Status } from '../contract/types'
import { STATUS_HEX } from '../twin/colors'
import { FRACTURE_LABEL_THRESHOLD } from '../twin/config'
import { REGION_LABEL, STATUS_LABEL } from '../twin/labels'
import { useHealthStore } from '../twin/store'
import { computeState, type Exercise } from '../../../src/engine/index'

// Mission controls (day, exercise, environment; shown in the Control room) and the +30 / +90 day
// forecast table (shown in the Forecast drawer).
// Writes only shared store inputs (setDay, setExercise, setEnvironment); never regions.
// The forecast calls the engine on a copy of the inputs and shows the result; nothing is stored.

export const MAX_DAY = 180

const WITH_EXERCISE: Exercise = { aerobic: 1, resistance: 1 }
const NO_EXERCISE: Exercise = { aerobic: 0, resistance: 0 }

const ENVIRONMENT_LABEL: Record<SimEnvironment, string> = {
  station: 'Station',
  transit: 'Transit',
  mars_surface: 'Mars surface',
}
const ENVIRONMENT_IDS = Object.keys(ENVIRONMENT_LABEL) as SimEnvironment[]

const BONE_LABEL: Record<BonePart, string> = {
  skull: 'Skull',
  spine: 'Spine',
  ribs: 'Ribs',
  arm_left: 'Left arm',
  arm_right: 'Right arm',
  pelvis: 'Pelvis',
  leg_left: 'Left leg',
  leg_right: 'Right leg',
}

const FORECAST_REGIONS: RegionId[] = ['bones', 'muscles', 'eyes']
const HORIZONS = [30, 90] as const
type Horizon = (typeof HORIZONS)[number]

const TEXT = {
  day: 'Mission day',
  exercise: { on: 'With exercise', off: 'Without exercise' },
  exerciseTitle: 'Exercise plan',
  environment: 'Environment',
  scenarioEnvironment: 'Scenario default',
  forecast: 'Forecast',
  days: (n: number) => `+${n} days`,
  fracture: 'Fracture risk',
  atRisk: 'at risk at landing',
  noRisk: 'no high risk',
  note: 'model estimate, not a medical prediction',
}

function StatusCell({ status, text }: { status: Status; text: string }) {
  return (
    <td>
      <i aria-hidden="true" style={{ background: STATUS_HEX[status] }} />
      <b style={{ color: status === 'ok' ? undefined : STATUS_HEX[status] }}>{STATUS_LABEL[status]}</b>{' '}
      <small>{text}</small>
    </td>
  )
}

function weakestBone(density: Record<BonePart, number>): BonePart {
  let weakest: BonePart = 'pelvis'
  for (const part of Object.keys(density) as BonePart[]) if (density[part] < density[weakest]) weakest = part
  return weakest
}

export function Forecast() {
  const [horizon, setHorizon] = useState<Horizon>(30)
  const day = useHealthStore((s) => s.day)
  const inputs = useHealthStore((s) => s.inputs)
  // Both variants side by side, recomputed only when the day, inputs or horizon change.
  const [withEx, withoutEx] = useMemo(
    () => [WITH_EXERCISE, NO_EXERCISE].map((ex) => computeState(day + horizon, inputs, ex)),
    [day, inputs, horizon],
  )

  const fracture = (state: typeof withEx) => {
    const part = weakestBone(state.boneDensity)
    const density = state.boneDensity[part]
    const atRisk = density < FRACTURE_LABEL_THRESHOLD
    return {
      status: (atRisk ? 'critical' : 'ok') as Status,
      text: `${BONE_LABEL[part]} ${Math.round(density * 100)}% · ${atRisk ? TEXT.atRisk : TEXT.noRisk}`,
    }
  }

  return (
    <section className="control-forecast" aria-labelledby="forecast-title">
      <div className="control-forecast-head">
        <h2 id="forecast-title">{TEXT.forecast}</h2>
        <div className="control-segment" role="group" aria-label={TEXT.forecast}>
          {HORIZONS.map((h) => (
            <button key={h} type="button" aria-pressed={horizon === h} onClick={() => setHorizon(h)}>
              {TEXT.days(h)}
            </button>
          ))}
        </div>
        <small>
          Day {day + horizon} · {TEXT.note}
        </small>
      </div>
      {/* One row per variant, one column per system: three short rows keep the bar low. */}
      <table>
        <thead>
          <tr>
            <th scope="col" />
            {FORECAST_REGIONS.map((id) => (
              <th key={id} scope="col">{REGION_LABEL[id]}</th>
            ))}
            <th scope="col">{TEXT.fracture}</th>
          </tr>
        </thead>
        <tbody>
          {([[TEXT.exercise.on, withEx], [TEXT.exercise.off, withoutEx]] as const).map(([label, state]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              {FORECAST_REGIONS.map((id) => (
                <StatusCell key={id} status={state.regions[id].status} text={`${state.regions[id].score}`} />
              ))}
              <StatusCell {...fracture(state)} />
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

// Mission day, exercise plan and environment (Control room).
export function MissionControls() {
  const day = useHealthStore((s) => s.day)
  const setDay = useHealthStore((s) => s.setDay)
  const exercising = useHealthStore((s) => s.exercise.aerobic > 0 || s.exercise.resistance > 0)
  const setExercise = useHealthStore((s) => s.setExercise)
  const environment = useHealthStore((s) => s.environment)
  const setEnvironment = useHealthStore((s) => s.setEnvironment)

  return (
      <div className="control-inputs" role="group" aria-label="Mission controls">
        <label className="control-day">
          <span>
            {TEXT.day} <strong>{day}</strong> / {MAX_DAY}
          </span>
          <input
            type="range"
            min="0"
            max={MAX_DAY}
            step="1"
            value={Math.min(day, MAX_DAY)}
            onChange={(e) => setDay(e.currentTarget.valueAsNumber)}
          />
        </label>
        <div className="control-exercise">
          <span>{TEXT.exerciseTitle}</span>
          <div className="control-segment" role="group" aria-label={TEXT.exerciseTitle}>
            <button type="button" aria-pressed={exercising} onClick={() => setExercise(WITH_EXERCISE)}>
              {TEXT.exercise.on}
            </button>
            <button type="button" data-whatif="true" aria-pressed={!exercising} onClick={() => setExercise(NO_EXERCISE)}>
              {TEXT.exercise.off}
            </button>
          </div>
        </div>
        <label className="control-environment">
          <span>{TEXT.environment}</span>
          <select
            value={environment ?? ''}
            onChange={(e) => setEnvironment(e.currentTarget.value as SimEnvironment)}
          >
            {environment === null && (
              <option value="" disabled>
                {TEXT.scenarioEnvironment}
              </option>
            )}
            {ENVIRONMENT_IDS.map((id) => (
              <option key={id} value={id}>
                {ENVIRONMENT_LABEL[id]}
              </option>
            ))}
          </select>
        </label>
      </div>
  )
}

// Top-bar toggle for the Earth link (earthLink in the store).
export function EarthLinkToggle() {
  const online = useHealthStore((s) => s.earthLink ?? true)
  const delay = useHealthStore((s) => s.commDelaySec ?? 0)
  const setEarthLink = useHealthStore((s) => s.setEarthLink)
  const reply = delay * 2 // there and back
  const replyText = reply < 60 ? `${Math.round(reply)} s` : `${Math.round(reply / 60)} min`
  return (
    <button
      type="button"
      className="earth-toggle"
      data-online={online}
      aria-pressed={online}
      onClick={() => setEarthLink(!online)}
    >
      <small>Earth link</small>
      <span>{online ? `Online · reply in ${replyText}` : 'Offline · autonomous'}</span>
    </button>
  )
}
