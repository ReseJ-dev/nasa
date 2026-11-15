import { STATUS_HEX } from '../twin/colors'
import { STATUS_LABEL, THREAT_LABEL } from '../twin/labels'
import { useHealthStore } from '../twin/store'
import { ZONE_INFO } from '../../../src/data/zoneInfo'
import { AlertCard, sourceTitle, useStatusNowItems, useOpenAlert } from './AlertsPanel'
import type { AlertItem } from './alerts'
import type { SlideScene } from '../slideScene'
import { ESCALATION_LABEL, escalationFor, escalationView } from './ZonePanel'
import { isDelayedEarth } from '../twin/config'

// "Status now": the one thing that matters right now. The highest-priority alert with its cause,
// the concrete action and who to involve; the other alerts stay collapsed under "N more".
// Shows what the engine decided (ui/alerts.ts); no rules here.

const TEXT = {
  title: 'Status now',
  clear: 'All systems normal',
  clearNote: 'No action needed. Sensors keep watching; the twin updates on its own.',
  cause: 'Cause',
  action: 'What to do now',
  who: 'Who to involve',
  forecast: 'forecast',
  details: 'Open details',
  more: (n: number) => `${n} more alert${n === 1 ? '' : 's'}`,
}

// Who acts on this alert: the region's own escalation for a region alert, the zone rule for
// an indicator alert. Without Earth, anything for the ground becomes the autonomous protocol.
function useEscalation(item: AlertItem | undefined) {
  const region = useHealthStore((s) => (item ? s.regions[item.regionId] : undefined))
  const earthLink = useHealthStore((s) => s.earthLink ?? true)
  const delayed = useHealthStore((s) => isDelayedEarth(s.commDelaySec))
  if (!item || !region) return undefined
  if (item.escalationNote) return { level: 'autonomous', label: item.escalationNote }
  if (item.id === 'event_solar_flare') return { level: 'crew', label: ESCALATION_LABEL.crew }
  const zone = ZONE_INFO[item.regionId]
  const who = item.id.startsWith('region_')
    ? escalationFor(region.escalation, item.level, item.regionId)
    : zone.escalation[item.level].who
  return escalationView(who, item.level, zone, earthLink, delayed)
}

export function StatusNow({ slide }: { slide?: SlideScene }) {
  const items = useStatusNowItems()
  const openAlert = useOpenAlert()
  const top = items[0]
  const rest = items.slice(1)
  const escalation = useEscalation(top)

  if (!top) {
    return (
      <section className="health-card status-now" data-level="ok" aria-labelledby="status-title">
        <h2 id="status-title">{TEXT.title}</h2>
        <p className="status-clear">
          <i aria-hidden="true" />
          {TEXT.clear}
        </p>
        <p>{TEXT.clearNote}</p>
      </section>
    )
  }

  const color = STATUS_HEX[top.level]
  return (
    <section className="health-card status-now" data-level={top.level} aria-labelledby="status-title" aria-live="polite">
      <h2 id="status-title">{TEXT.title}</h2>
      <div className="status-top" style={{ borderLeftColor: color }} title={sourceTitle(top)}>
        <span className="status-level">
          <strong className="zone-status" data-status={top.level}>{STATUS_LABEL[top.level]}</strong>
          {top.forecast && <span className="zone-badge" data-source="forecast">{TEXT.forecast}</span>}
        </span>
        <p className="status-message">{slide === 'shelter' ? 'In shelter · dose rate reduced' : slide === 'flare' ? 'Solar particle event in progress' : top.message}</p>
        <p className="status-cause">
          {TEXT.cause}: <b>{THREAT_LABEL[top.hazard]}</b>
        </p>
        <h3>{TEXT.action}</h3>
        <p className="status-action">{top.action}</p>
        {escalation && (
          <>
            <h3>{TEXT.who}</h3>
            <span className="zone-escalation" data-level={escalation.level}>{escalation.label}</span>
          </>
        )}
        {!slide && <button type="button" className="status-open" onClick={() => openAlert(top)}>{TEXT.details}</button>}
      </div>
      {!slide && rest.length > 0 && (
        <details className="status-more">
          <summary>{TEXT.more(rest.length)}</summary>
          <ul>
            {rest.map((item) => (
              <li key={item.id}><AlertCard item={item} /></li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
