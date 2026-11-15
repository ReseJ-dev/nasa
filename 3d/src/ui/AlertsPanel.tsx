import { useEffect, useMemo, useRef, useState } from 'react'
import { STATUS_HEX } from '../twin/colors'
import { STATUS_LABEL, THREAT_LABEL } from '../twin/labels'
import { useHealthStore } from '../twin/store'
import { buildAlerts, type AlertItem } from './alerts'

// Alerts: the alert card used by the "Status now" list, plus a 4 s banner and a red vignette
// flash whenever a new critical alert appears.
// Clicking an alert highlights it in 3D (focus on its regions) and opens its zone panel.

const TEXT = {
  cause: 'Cause',
  forecast: 'forecast',
  unverified: 'not yet verified',
  more: (n: number) => `+${n} more`,
}
const BANNER_MS = 4000

// The list, recomputed only when its inputs change.
export function useAlertItems(): AlertItem[] {
  const regions = useHealthStore((s) => s.regions)
  const alerts = useHealthStore((s) => s.alerts)
  const threats = useHealthStore((s) => s.threats)
  const earthLink = useHealthStore((s) => s.earthLink ?? true)
  return useMemo(() => buildAlerts({ regions, alerts, threats, earthLink }), [regions, alerts, threats, earthLink])
}

export function useOpenAlert() {
  const setHighlight = useHealthStore((s) => s.setHighlightAlert)
  const select = useHealthStore((s) => s.selectRegion)
  return (item: AlertItem) => {
    setHighlight(item.id, item.regions) // first, so the selection below keeps it
    select(item.regionId)
  }
}

export function sourceTitle(item: AlertItem) {
  return `Rule source: ${item.source}${item.verified ? '' : ` (${TEXT.unverified})`}`
}

// One alert as a card: level, message, cause hazard and the concrete action. Click opens its zone.
export function AlertCard({ item }: { item: AlertItem }) {
  const highlight = useHealthStore((s) => s.highlightAlertId)
  const openAlert = useOpenAlert()
  return (
    <button
      type="button"
      className="alert-item"
      data-level={item.level}
      aria-current={highlight === item.id}
      title={sourceTitle(item)}
      style={{ borderLeftColor: STATUS_HEX[item.level] }}
      onClick={() => openAlert(item)}
    >
      <span className="alert-top">
        <strong style={{ color: STATUS_HEX[item.level] }}>{STATUS_LABEL[item.level]}</strong>
        {item.forecast && <span className="zone-badge" data-source="forecast">{TEXT.forecast}</span>}
      </span>
      <span className="alert-message">{item.message}</span>
      <small>
        {TEXT.cause}: {THREAT_LABEL[item.hazard]}
      </small>
      <span className="alert-action">{item.action}</span>
    </button>
  )
}

// Banner (4 s) and red vignette flash for each new critical alert.
export function CriticalBanner() {
  const items = useAlertItems()
  const openAlert = useOpenAlert()
  const seen = useRef<Set<string>>(new Set())
  const [banner, setBanner] = useState<{ item: AlertItem; more: number; key: number } | null>(null)

  // Own timer ref: a later list change must not cancel the hide of a banner already shown.
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    const critical = items.filter((i) => i.level === 'critical')
    const fresh = critical.filter((i) => !seen.current.has(i.id))
    seen.current = new Set(critical.map((i) => i.id)) // an alert that clears and comes back flashes again
    if (fresh.length === 0) return
    setBanner({ item: fresh[0], more: fresh.length - 1, key: Date.now() })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setBanner(null), BANNER_MS)
  }, [items])
  // On unmount forget what was seen too: a remount (React StrictMode) then shows the banner
  // again with a fresh timer instead of leaving it on screen without one.
  useEffect(
    () => () => {
      clearTimeout(timer.current)
      seen.current = new Set()
    },
    [],
  )

  if (!banner) return null
  const { item, more } = banner
  return (
    <>
      <div key={banner.key} className="critical-vignette" aria-hidden="true" />
      <div className="critical-banner" role="alert">
        <button type="button" onClick={() => openAlert(item)} title={sourceTitle(item)}>
          <strong>{STATUS_LABEL.critical}</strong>
          <span>
            {item.message} · {TEXT.cause}: {THREAT_LABEL[item.hazard]}
            {more > 0 && <small> · {TEXT.more(more)}</small>}
          </span>
          <span className="alert-action">{item.action}</span>
        </button>
      </div>
    </>
  )
}
