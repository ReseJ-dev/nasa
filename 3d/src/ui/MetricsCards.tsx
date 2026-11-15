import type { Metric } from '../contract/types'
import { NO_DATA_LABEL } from '../twin/labels'
import { useHealthStore } from '../twin/store'
import { formatLevel } from '../sim'
import { GRAVITY_THREAT_DAYS } from '../sim/constants'
import { Co2Value } from './Co2Value'

// Body metrics, environment and future measurements cards (Control room).

const vitals = ['heart_rate', 'sleep_hours', 'reaction_ms', 'glucose', 'bone_loss_pct', 'muscle_loss_pct', 'vision_score']
const names: Record<string, string> = {
  heart_rate: 'Heart rate',
  sleep_hours: 'Sleep',
  reaction_ms: 'Reaction time',
  glucose: 'Glucose',
  bone_loss_pct: 'Bone density loss',
  muscle_loss_pct: 'Muscle mass loss',
  vision_score: 'Visual acuity',
  radiation_msv: 'Accumulated radiation dose',
}
const format = new Intl.NumberFormat('en', { maximumFractionDigits: 2 })

function MetricValue({ metric, label }: { metric?: Metric; label: string }) {
  return (
    <div className="health-metric">
      <dt>{label}</dt>
      <dd>{metric ? <>{format.format(metric.value)} <small>{metric.unit}</small></> : <small>{NO_DATA_LABEL}</small>}</dd>
    </div>
  )
}

// A 0..1 index or threat level, in the one format the threats strip uses (whole percent).
function LevelValue({ label, level, note }: { label: string; level: number | undefined; note?: string }) {
  return (
    <div className="health-metric">
      <dt>{label}</dt>
      <dd>{level === undefined ? <small>{NO_DATA_LABEL}</small> : formatLevel(level)}</dd>
      {note && <dd className="health-metric-note">{note}</dd>}
    </div>
  )
}

export function HealthMetrics() {
  const metrics = useHealthStore(state => state.metrics)
  const microgravity = useHealthStore(state => state.inputs.microgravity)
  // Threat levels come from the same store field as the threats strip, in the same format.
  const gravityThreat = useHealthStore(state => state.threats?.gravity.level)
  const isolationThreat = useHealthStore(state => state.threats?.isolation.level)
  const day = useHealthStore(state => state.day)
  const metric = (id: string) => metrics.find(item => item.id === id)
  return (
    <>
      <section className="health-card" aria-labelledby="health-vitals">
        <h2 id="health-vitals">Body metrics</h2>
        <dl className="health-grid">{vitals.map(id => <MetricValue key={id} label={names[id]} metric={metric(id)} />)}</dl>
      </section>
      <section className="health-card" aria-labelledby="health-environment">
        <h2 id="health-environment">Environment</h2>
        <dl className="health-grid">
          <Co2Value metric={metric('co2_ppm')} />
          <MetricValue label={names.radiation_msv} metric={metric('radiation_msv')} />
          <LevelValue label="Microgravity index" level={microgravity} note="exposure now" />
          <LevelValue label="Gravity threat level" level={gravityThreat} note={`index × ${Math.min(day, GRAVITY_THREAT_DAYS)} / ${GRAVITY_THREAT_DAYS} days`} />
          <LevelValue label="Isolation threat level" level={isolationThreat} />
        </dl>
      </section>
      <section className="health-card" aria-labelledby="health-future">
        <h2 id="health-future">Future measurements</h2>
        <dl className="health-grid">{['SpO₂', 'Cortisol'].map(label => <MetricValue key={label} label={label} />)}</dl>
      </section>
    </>
  )
}
