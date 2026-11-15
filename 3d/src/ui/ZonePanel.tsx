import type { Alert, Escalation, Metric, RegionId, RegionState, Status } from '../contract/types'
import { useMemo, type CSSProperties, type ReactNode } from 'react'
import { STATUS_HEX } from '../twin/colors'
import { NO_DATA_LABEL, REGION_LABEL, SOURCES_NOTE, STATUS_LABEL, THREAT_LABEL } from '../twin/labels'
import { useHealthStore } from '../twin/store'
import { isDelayedEarth } from '../twin/config'
import { EARTH_LABEL } from '../twin/labels'
import { DISCLAIMER, ZONE_INFO } from '../../../src/data/zoneInfo'
import { ALERT_REGION, METRIC_ALERT, autonomousAction } from './alerts'
import { ZoneCharts } from './ZoneCharts'
import { Co2Value } from './Co2Value'

// Zone panel: everything about the selected region, top to bottom:
// name + status, measured/forecast badge, score + metrics, why, how, cause, what to do,
// who to involve, source + disclaimer. Blocks without data are not rendered.
// Reads the store live (every input change re-renders); writes only selectRegion(null).

const NO_METRICS: Metric[] = []
const NO_MEASURED: ReadonlySet<string> = new Set()

// Model outputs with no in-flight measurement: always a forecast.
const FORECAST_METRICS = new Set(['bone_density', 'bone_loss_pct', 'muscle_mass', 'muscle_loss_pct', 'fluid_shift', 'vision_score'])
// Vitals the engine fills with a model value until the user measures them (check-in, reaction test).
const MODELLED_VITALS: Record<string, 'heartRate' | 'glucose' | 'reactionMs'> = {
  heart_rate: 'heartRate',
  glucose: 'glucose',
  reaction_ms: 'reactionMs',
}
// Same quantity shown twice: the second one is hidden when the first is there.
const DUPLICATE_OF: Record<string, string> = {
  bone_density: 'bone_loss_pct', // lowest density = 100 % minus the loss, already shown
  muscle_mass: 'muscle_loss_pct', // muscle mass = 100 % minus the loss, already shown
}
export function metricSource(id: string, measuredVitals: ReadonlySet<string>): 'measured' | 'forecast' {
  if (FORECAST_METRICS.has(id)) return 'forecast'
  if (id in MODELLED_VITALS) return measuredVitals.has(id) ? 'measured' : 'forecast'
  return 'measured'
}
// The source is shown as a badge, so the "(forecast)" suffix of the engine label is dropped.
const metricLabel = (label: string) => label.replace(/\s*\(forecast\)$/, '')
const NO_ALERTS: Alert[] = []

export const ESCALATION_LABEL: Record<Escalation, string> = {
  self: 'Handle yourself',
  crew: 'Tell the crew',
  ground: 'Request Earth doctor',
}
export const AUTONOMOUS_LABEL = 'Autonomous protocol: tell a crew member'

// Who to involve, as shown. Earth link down: the autonomous protocol. Earth reachable but more
// than 5 min away one way: a step for the ground becomes the on-board protocol, Earth gets the log.
export function escalationView(
  who: Escalation,
  status: Status,
  zone: (typeof ZONE_INFO)[RegionId],
  earthLink: boolean,
  delayed: boolean,
): { level: string; label: string; text: string | undefined } {
  if (!earthLink && (who === 'ground' || status === 'critical')) {
    return { level: 'autonomous', label: AUTONOMOUS_LABEL, text: zone.escalation.autonomous }
  }
  if (delayed && who === 'ground') {
    return { level: 'autonomous', label: EARTH_LABEL.delayedEscalation, text: EARTH_LABEL.delayedText }
  }
  return { level: who, label: ESCALATION_LABEL[who], text: status === 'ok' ? undefined : zone.escalation[status].text }
}

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
  empty: 'Select a system in the list or on the astronaut to see its metrics, trends and what to do.',
  details: 'System details',
}

const format = new Intl.NumberFormat('en', { maximumFractionDigits: 2 })

// Who acts: the engine's value when it has one, otherwise the zone info rule for this status.
export function escalationFor(engine: Escalation | undefined, status: Status, id: RegionId): Escalation {
  if (engine) return engine
  return status === 'ok' ? 'self' : ZONE_INFO[id].escalation[status].who
}

export function ZonePanel() {
  const selected = useHealthStore((s) => s.selectedRegion)
  const region = useHealthStore((s) => (s.selectedRegion ? s.regions[s.selectedRegion] : undefined))
  const metrics = useHealthStore((s) => s.metrics ?? NO_METRICS)
  const alerts = useHealthStore((s) => s.alerts ?? NO_ALERTS)
  const earthLink = useHealthStore((s) => s.earthLink ?? true)
  const vitals = useHealthStore((s) => s.inputs.vitals)
  // Modelled vitals the user has actually measured (check-in, reaction test).
  const measuredVitals = useMemo(
    () => new Set(Object.entries(MODELLED_VITALS).filter(([, key]) => Number.isFinite(vitals?.[key])).map(([id]) => id)),
    [vitals],
  )
  const delayed = useHealthStore((s) => isDelayedEarth(s.commDelaySec))
  const select = useHealthStore((s) => s.selectRegion)
  return (
    <ZoneDetails
      region={selected ? region : undefined}
      metrics={metrics}
      alerts={alerts}
      earthLink={earthLink}
      delayed={delayed}
      measuredVitals={measuredVitals}
      onClose={() => select(null)}
      charts={selected ? <ZoneCharts regionId={selected} /> : null}
    />
  )
}

// Pure view of the panel (no store access), so it can be rendered and checked on its own.
export function ZoneDetails({
  region,
  metrics,
  alerts,
  earthLink,
  delayed = false,
  measuredVitals = NO_MEASURED,
  onClose,
  charts,
}: {
  region: RegionState | undefined
  metrics: Metric[]
  alerts: Alert[]
  earthLink: boolean
  delayed?: boolean // one-way delay to Earth above 5 min
  measuredVitals?: ReadonlySet<string> // modelled vitals the user has measured
  onClose(): void
  charts?: ReactNode // trend charts (store-driven), placed after the metrics
}) {
  if (!region) {
    return (
      <section className="health-card health-detail zone-empty" aria-labelledby="zone-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <circle cx="12" cy="5" r="2.5" />
          <path d="M12 8v8M7 10.5h10M12 16l-3 5M12 16l3 5" strokeLinecap="round" />
        </svg>
        <h2 id="zone-title">{TEXT.details}</h2>
        <p>{TEXT.empty}</p>
      </section>
    )
  }

  const selected = region.id
  const zone = ZONE_INFO[selected]
  const { status } = region
  const color = STATUS_HEX[status]
  const regionMetrics = region.metrics
    .filter((id) => !(DUPLICATE_OF[id] && region.metrics.includes(DUPLICATE_OF[id])))
    .map((id) => metrics.find((m) => m.id === id))
    .filter((m): m is Metric => m !== undefined)
  const regionAlerts = alerts.filter((a) => ALERT_REGION[a.metric] === selected)
  // No Earth link: every action shows its autonomous version.
  const actions = status === 'ok' ? [] : zone.actions[status].map((line) => (earthLink ? line : autonomousAction(line)))
  const who = escalationFor(region.escalation, status, selected)
  // No Earth (or Earth too far to answer in time): the ground step becomes the on-board protocol.
  const escalation = escalationView(who, status, zone, earthLink, delayed)

  return (
    <section className="health-card health-detail zone-panel" data-status={status} style={{ '--zone-color': color } as CSSProperties} aria-labelledby="zone-title" aria-live="polite">
      <header className="zone-head">
        <i aria-hidden="true" style={{ background: color }} />
        <h2 id="zone-title">{REGION_LABEL[selected]}</h2>
        <span className="zone-status" data-status={status}>{region.noData ? NO_DATA_LABEL : STATUS_LABEL[status]}</span>
        <button type="button" className="zone-close" onClick={onClose} aria-label={TEXT.close}>×</button>
      </header>

      <dl className="health-grid zone-metrics">
        <div className="health-metric">
          <dt>{TEXT.score}</dt>
          <dd style={{ color }}>{region.noData ? <small>{NO_DATA_LABEL}</small> : <>{region.score} <small>/ 100</small></>}</dd>
        </div>
        {regionMetrics.map((m) => m.id === 'co2_ppm' ? <Co2Value key={m.id} metric={m} badge /> : (
          <div key={m.id} className="health-metric">
            <dt>
              {metricLabel(m.label)}{' '}
              <span className="zone-badge" data-source={metricSource(m.id, measuredVitals)}>{SOURCE_LABEL[metricSource(m.id, measuredVitals)]}</span>
            </dt>
            <dd>{format.format(m.value)} {m.unit && <small>{m.unit}</small>}</dd>
          </div>
        ))}
      </dl>

      {charts}

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
                {THREAT_LABEL[a.hazard]}: {METRIC_ALERT[a.metric].cause}.
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
        <span className="zone-escalation" data-level={escalation.level}>
          {escalation.label}
        </span>
        {escalation.text && <p>{escalation.text}</p>}
      </div>

      <footer className="zone-foot">
        {zone.source && (
          <p>
            {TEXT.source}: {zone.source}
            {!zone.verified && ` (${TEXT.unverified})`}
          </p>
        )}
        <p>{SOURCES_NOTE}</p>
        <p className="zone-disclaimer">{DISCLAIMER}</p>
      </footer>
    </section>
  )
}
