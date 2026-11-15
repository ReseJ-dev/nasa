import type { ReactNode } from 'react'
import type { Metric, RegionId } from '../contract/types'
import { STATUS_HEX } from '../twin/colors'
import { NO_DATA_LABEL, REGION_LABEL, STATUS_LABEL } from '../twin/labels'
import { useHealthStore, type ScenarioId } from '../twin/store'
import { formatLevel } from '../sim'
import { GRAVITY_THREAT_DAYS } from '../sim/constants'
import { AlertsBadge, CriticalBanner, useAlertItems } from './AlertsPanel'
import { CheckInPanel } from './CheckInPanel'
import { ControlBar, EarthLinkToggle, MAX_DAY } from './ControlBar'
import { ZonePanel } from './ZonePanel'
import '../twin/theme'
import './healthDashboard.css'
import { SoundControls } from './SoundControls'

const scenarios: Record<ScenarioId, string> = { healthy: 'Healthy', day60: 'Day 60', critical: 'Critical' }
const systems = ['heart', 'brain', 'bones', 'muscles', 'eyes', 'immune', 'lungs', 'metabolism'] satisfies RegionId[]
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
      <dd>{metric ? <>{format.format(metric.value)} <small>{metric.unit}</small></> : <small>{NO_DATA_LABEL}</small>}</dd>
    </div>
  )
}

// A 0..1 index or threat level, in the one format the threats strip uses (whole percent).
function LevelValue({ label, level, note }: { label: string; level: number | undefined; note?: string }) {
  return (
    <div className="health-metric">
      <dt>{label}</dt>
      <dd>{level === undefined ? <small>{NO_DATA_LABEL}</small> : <>{formatLevel(level)}{note && <> <small>{note}</small></>}</>}</dd>
    </div>
  )
}

function MissionHeader() {
  const day = useHealthStore(state => state.day)
  const scenario = useHealthStore(state => state.scenario)
  const setScenario = useHealthStore(state => state.setScenario)
  const flare = useHealthStore(state => state.activeEvent === 'solar_flare')
  const level = useAlertItems()[0]?.level ?? 'ok'
  return (
    <header className="health-header" data-level={level}>
      <div className="health-brand">
        <div className="health-title">
          <h1>Astronaut Health Monitor</h1>
          <p>Demonstration model · simulated values</p>
        </div>
        <SoundControls />
      </div>
      <div className="health-presets" role="group" aria-label="Mission scenario">
        {Object.entries(scenarios).map(([id, label]) => (
          <button key={id} type="button" data-scenario={id} aria-pressed={scenario === id} onClick={() => setScenario(id as ScenarioId)}>{label}</button>
        ))}
      </div>
      <div className="health-telemetry">
        <dl className="health-chip"><dt>Mission day</dt><dd>{day} <small>/ {MAX_DAY}</small></dd></dl>
        <dl className="health-chip" data-alert={flare}><dt>Solar flare</dt><dd>{flare ? 'Active' : 'None'}</dd></dl>
        <EarthLinkToggle />
        <AlertsBadge />
      </div>
    </header>
  )
}

function HealthMetrics() {
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
          <MetricValue label={names.co2_ppm} metric={metric('co2_ppm')} />
          <MetricValue label={names.radiation_msv} metric={metric('radiation_msv')} />
          <LevelValue label="Microgravity index" level={microgravity} note="exposure now" />
          <LevelValue label="Gravity threat level" level={gravityThreat} note={`index × day ${day} / ${GRAVITY_THREAT_DAYS}`} />
          <LevelValue label="Isolation threat level" level={isolationThreat} />
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
  return (
    <aside className="health-column">
      <section className="health-card" aria-labelledby="health-systems">
        <h2 id="health-systems">Body systems <small className="health-h2-note">score / 100</small></h2>
        <ul className="health-systems">
          {systems.map(id => {
            const { status, score, noData } = regions[id]
            return (
              <li key={id}>
                <button type="button" data-status={status} aria-pressed={selected === id} onClick={() => select(id)}>
                  <i aria-hidden="true" style={{ background: STATUS_HEX[status] }} />
                  <span>{REGION_LABEL[id]}</span>
                  <em>{noData ? NO_DATA_LABEL : STATUS_LABEL[status]}</em>
                  <strong>{noData ? '–' : score}</strong>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
      <ZonePanel />
    </aside>
  )
}

export function HealthDashboard({ children }: { children: ReactNode }) {
  return (
    <main className="health-dashboard">
      <MissionHeader />
      <div className="health-layout">
        <section className="health-scene" aria-label="Interactive astronaut model">
          {children}
          <CriticalBanner />
        </section>
        <div className="health-column health-data">
          <CheckInPanel />
          <HealthMetrics />
        </div>
        <HealthSystems />
      </div>
      <ControlBar />
    </main>
  )
}
