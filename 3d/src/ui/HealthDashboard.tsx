import type { ReactNode } from 'react'
import type { Metric, RegionId } from '../contract/types'
import { STATUS_HEX } from '../twin/colors'
import { REGION_LABEL, STATUS_LABEL } from '../twin/labels'
import { useHealthStore, type ScenarioId } from '../twin/store'
import './healthDashboard.css'

const scenarios: Record<ScenarioId, string> = { healthy: 'Healthy', day60: 'Day 60', critical: 'Critical' }
const systems = ['heart', 'brain', 'bones', 'muscles', 'eyes', 'immune', 'lungs'] satisfies RegionId[]
const vitals = ['heart_rate', 'sleep_hours', 'reaction_ms', 'bone_loss_pct', 'muscle_loss_pct', 'vision_score']
const names: Record<string, string> = {
  heart_rate: 'Heart rate',
  sleep_hours: 'Sleep',
  reaction_ms: 'Reaction time',
  bone_loss_pct: 'Bone density loss',
  muscle_loss_pct: 'Muscle mass loss',
  vision_score: 'Visual acuity',
  co2_ppm: 'Cabin CO₂',
  radiation_msv: 'Accumulated radiation dose',
}
const format = new Intl.NumberFormat('en', { maximumFractionDigits: 2 })

function MetricValue({ metric, label }: { metric?: Metric; label: string }) {
  return (
    <div className="health-metric">
      <dt>{label}</dt>
      <dd>{metric ? <>{format.format(metric.value)} <small>{metric.unit}</small></> : <small>No data</small>}</dd>
    </div>
  )
}

function MissionHeader() {
  const day = useHealthStore(state => state.day)
  const scenario = useHealthStore(state => state.scenario)
  const link = useHealthStore(state => state.earthLink)
  const delay = useHealthStore(state => state.commDelaySec)
  const flare = useHealthStore(state => state.activeEvent === 'solar_flare')
  return (
    <header className="health-header">
      <div className="health-title">
        <h1>Astronaut Health Monitor</h1>
        <p>Demonstration model · simulated values</p>
      </div>
      <dl className="health-telemetry">
        <div><dt>Mission Day</dt><dd>{day} <small>/ 180</small></dd></div>
        <div><dt>Scenario</dt><dd>{scenarios[scenario]}</dd></div>
        <div><dt>Earth link</dt><dd data-alert={!link}>{link ? 'Connected' : 'Offline'}{link && delay !== undefined && <small> · {delay} s one-way</small>}</dd></div>
        <div><dt>Solar flare</dt><dd data-alert={flare}>{flare ? 'Active' : 'None'}</dd></div>
      </dl>
    </header>
  )
}

function MissionControls() {
  const day = useHealthStore(state => state.day)
  const scenario = useHealthStore(state => state.scenario)
  const setDay = useHealthStore(state => state.setDay)
  const setScenario = useHealthStore(state => state.setScenario)
  return (
    <section className="health-card health-controls" aria-labelledby="mission-controls">
      <h2 id="mission-controls">Mission controls</h2>
      <div className="health-presets" role="group" aria-label="Mission scenario">
        {Object.entries(scenarios).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={scenario === id} onClick={() => setScenario(id as ScenarioId)}>{label}</button>
        ))}
      </div>
      <label htmlFor="mission-day">Mission day <strong>{day}</strong></label>
      <input id="mission-day" type="range" min="0" max="180" step="1" value={day} onChange={event => setDay(event.currentTarget.valueAsNumber)} />
      <div className="health-range-ends" aria-hidden="true"><span>0</span><span>180</span></div>
      <p>Changing the day recalculates health with fixed mission inputs. Environment and dose do not advance automatically.</p>
    </section>
  )
}

function HealthMetrics() {
  const metrics = useHealthStore(state => state.metrics)
  const microgravity = useHealthStore(state => state.inputs.microgravity)
  const isolation = useHealthStore(state => state.inputs.isolation)
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
          <MetricValue label={names.co2_ppm} metric={metric('co2_ppm')} />
          <MetricValue label={names.radiation_msv} metric={metric('radiation_msv')} />
          <div className="health-metric"><dt>Microgravity index</dt><dd>{format.format(microgravity)} <small>/ 1</small></dd></div>
          <div className="health-metric"><dt>Isolation index</dt><dd>{format.format(isolation)} <small>/ 1</small></dd></div>
        </dl>
      </section>
      <section className="health-card" aria-labelledby="health-future">
        <h2 id="health-future">Future measurements</h2>
        <dl className="health-grid">{['SpO₂', 'Glucose', 'Cortisol'].map(label => <MetricValue key={label} label={label} />)}</dl>
      </section>
    </>
  )
}

function HealthSystems() {
  const regions = useHealthStore(state => state.regions)
  const selected = useHealthStore(state => state.selectedRegion)
  const select = useHealthStore(state => state.selectRegion)
  const metrics = useHealthStore(state => state.metrics)
  const region = selected ? regions[selected] : undefined
  return (
    <aside className="health-column">
      <section className="health-card" aria-labelledby="health-systems">
        <h2 id="health-systems">Body systems</h2>
        <ul className="health-systems">
          {systems.map(id => {
            const { status, score } = regions[id]
            return (
              <li key={id}>
                <button type="button" aria-pressed={selected === id} onClick={() => select(id)}>
                  <i aria-hidden="true" style={{ background: STATUS_HEX[status] }} />
                  <span>{REGION_LABEL[id]}<small>{STATUS_LABEL[status]}</small></span>
                  <strong>{score}<small> / 100</small></strong>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
      <section className="health-card health-detail" aria-labelledby="health-detail">
        <h2 id="health-detail">{region ? REGION_LABEL[region.id] : 'System details'}</h2>
        {region ? (
          <>
            <dl className="health-grid">
              {region.metrics.map(id => <MetricValue key={id} label={names[id] ?? id} metric={id === 'glucose' ? undefined : metrics.find(metric => metric.id === id)} />)}
            </dl>
            {region.advice.length > 0 && <ul>{region.advice.map(advice => <li key={advice}>{advice}</li>)}</ul>}
          </>
        ) : <p>Select a system here or on the astronaut to see its metrics and guidance.</p>}
      </section>
    </aside>
  )
}

export function HealthDashboard({ children }: { children: ReactNode }) {
  return (
    <main className="health-dashboard">
      <MissionHeader />
      <div className="health-layout">
        <section className="health-scene" aria-label="Interactive astronaut model">{children}</section>
        <div className="health-column health-data">
          <MissionControls />
          <HealthMetrics />
        </div>
        <HealthSystems />
      </div>
    </main>
  )
}
