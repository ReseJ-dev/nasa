import type { Alert, AlertMetric, Escalation, Metric, RegionId, RegionState, Status } from '../contract/types'
import { STATUS_HEX } from '../twin/colors'
import { REGION_LABEL, STATUS_LABEL, THREAT_LABEL } from '../twin/labels'
import { useHealthStore } from '../twin/store'
import { DISCLAIMER, ZONE_INFO } from '../../../src/data/zoneInfo'

// Zone panel: everything about the selected region, top to bottom:
// name + status, measured/forecast badge, score + metrics, why, how, cause, what to do,
// who to involve, source + disclaimer. Blocks without data are not rendered.
// Reads the store live (every input change re-renders); writes only selectRegion(null).

const NO_METRICS: Metric[] = []
const NO_ALERTS: Alert[] = []

// Isolation alerts carry a metric, not a region: the region they belong to.
const ALERT_REGION: Record<AlertMetric, RegionId> = {
  sleep: 'brain',
  reaction: 'brain',
  mood: 'brain',
  activity: 'muscles',
}
const ALERT_CAUSE: Record<AlertMetric, string> = {
  sleep: 'sleep is short or shifted from your normal schedule',
  reaction: 'reaction test is slower than your normal',
  mood: 'mood is lower than your normal',
  activity: 'exercise is below your normal',
}

const ESCALATION_LABEL: Record<Escalation, string> = {
  self: 'Handle yourself',
  crew: 'Tell the crew',
  ground: 'Request Earth doctor',
}
const AUTONOMOUS_LABEL = 'Autonomous protocol: tell a crew member'

const SOURCE_LABEL = { measured: 'measured', forecast: 'forecast' }
const TEXT = {
  close: 'Close',
  score: 'Score',
  why: 'Why it matters',
  how: 'How to measure',
  cause: 'Cause',
  actions: 'What to do now',
  nothing: 'Nothing needed',
  who: 'Who to involve',
  source: 'Source',
  unverified: 'not yet verified',
  empty: 'Select a system here or on the astronaut to see its metrics and guidance.',
  details: 'System details',
}

const format = new Intl.NumberFormat('en', { maximumFractionDigits: 2 })

// Who acts: the engine's value when it has one, otherwise the zone info rule for this status.
function escalationFor(engine: Escalation | undefined, status: Status, id: RegionId): Escalation {
  if (engine) return engine
  return status === 'ok' ? 'self' : ZONE_INFO[id].escalation[status].who
}

export function ZonePanel() {
  const selected = useHealthStore((s) => s.selectedRegion)
  const region = useHealthStore((s) => (s.selectedRegion ? s.regions[s.selectedRegion] : undefined))
  const metrics = useHealthStore((s) => s.metrics ?? NO_METRICS)
  const alerts = useHealthStore((s) => s.alerts ?? NO_ALERTS)
  const earthLink = useHealthStore((s) => s.earthLink ?? true)
  const select = useHealthStore((s) => s.selectRegion)
  return (
    <ZoneDetails
      region={selected ? region : undefined}
      metrics={metrics}
      alerts={alerts}
      earthLink={earthLink}
      onClose={() => select(null)}
    />
  )
}

// Pure view of the panel (no store access), so it can be rendered and checked on its own.
export function ZoneDetails({
  region,
  metrics,
  alerts,
  earthLink,
  onClose,
}: {
  region: RegionState | undefined
  metrics: Metric[]
  alerts: Alert[]
  earthLink: boolean
  onClose(): void
}) {
  if (!region) {
    return (
      <section className="health-card health-detail" aria-labelledby="zone-title">
        <h2 id="zone-title">{TEXT.details}</h2>
        <p>{TEXT.empty}</p>
      </section>
    )
  }

  const selected = region.id
  const zone = ZONE_INFO[selected]
  const { status } = region
  const color = STATUS_HEX[status]
  const source = region.source ?? zone.measurement
  const regionMetrics = region.metrics
    .map((id) => metrics.find((m) => m.id === id))
    .filter((m): m is Metric => m !== undefined)
  const regionAlerts = alerts.filter((a) => ALERT_REGION[a.metric] === selected)
  const actions = status === 'ok' ? [] : zone.actions[status]
  const who = escalationFor(region.escalation, status, selected)
  // No Earth: anything that would go to the ground goes to the crew instead.
  const autonomous = !earthLink && (who === 'ground' || status === 'critical')
  const whoText = status === 'ok' ? undefined : autonomous ? zone.escalation.autonomous : zone.escalation[status].text

  return (
    <section className="health-card health-detail zone-panel" aria-labelledby="zone-title" aria-live="polite">
      <header className="zone-head">
        <i aria-hidden="true" style={{ background: color }} />
        <h2 id="zone-title">{REGION_LABEL[selected]}</h2>
        <span className="zone-status" style={{ color }}>{STATUS_LABEL[status]}</span>
        <button type="button" className="zone-close" onClick={onClose} aria-label={TEXT.close}>×</button>
      </header>

      <div className="zone-badges">
        <span className="zone-badge" data-source={source}>{SOURCE_LABEL[source]}</span>
      </div>

      <dl className="health-grid zone-metrics">
        <div className="health-metric">
          <dt>{TEXT.score}</dt>
          <dd style={{ color }}>{region.score} <small>/ 100</small></dd>
        </div>
        {regionMetrics.map((m) => (
          <div key={m.id} className="health-metric">
            <dt>{m.label}</dt>
            <dd>{format.format(m.value)} {m.unit && <small>{m.unit}</small>}</dd>
          </div>
        ))}
      </dl>

      {zone.why && (
        <div className="zone-block">
          <h3>{TEXT.why}</h3>
          <p>{zone.why}</p>
        </div>
      )}

      {zone.how.length > 0 && (
        <div className="zone-block">
          <h3>{TEXT.how}</h3>
          <ul>{zone.how.map((line) => <li key={line}>{line}</li>)}</ul>
        </div>
      )}

      {(zone.hazards.length > 0 || regionAlerts.length > 0) && (
        <div className="zone-block">
          <h3>{TEXT.cause}</h3>
          <ul>
            {regionAlerts.map((a) => (
              <li key={a.id} className="zone-alert" style={{ borderColor: STATUS_HEX[a.status] }}>
                <strong style={{ color: STATUS_HEX[a.status] }}>{STATUS_LABEL[a.status]}</strong>{' '}
                {THREAT_LABEL[a.hazard]}: {ALERT_CAUSE[a.metric]}.
              </li>
            ))}
            {zone.hazards.map((h) => (
              <li key={h.hazard}>
                <strong>{THREAT_LABEL[h.hazard]}:</strong> {h.effect}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="zone-block">
        <h3>{TEXT.actions}</h3>
        {actions.length > 0 ? (
          <ol>{actions.map((line) => <li key={line}>{line}</li>)}</ol>
        ) : (
          <p>{TEXT.nothing}</p>
        )}
      </div>

      <div className="zone-block">
        <h3>{TEXT.who}</h3>
        <span className="zone-escalation" data-level={autonomous ? 'autonomous' : who}>
          {autonomous ? AUTONOMOUS_LABEL : ESCALATION_LABEL[who]}
        </span>
        {whoText && <p>{whoText}</p>}
      </div>

      <footer className="zone-foot">
        {zone.source && (
          <p>
            {TEXT.source}: {zone.source}
            {!zone.verified && ` (${TEXT.unverified})`}
          </p>
        )}
        <p className="zone-disclaimer">{DISCLAIMER}</p>
      </footer>
    </section>
  )
}
