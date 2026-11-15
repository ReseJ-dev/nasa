import { useEffect, useMemo, useRef, useState } from 'react'
import { STATUS_HEX } from '../twin/colors'
import { STATUS_LABEL, THREAT_LABEL } from '../twin/labels'
import { useHealthStore } from '../twin/store'
import { buildAlerts, type AlertItem } from './alerts'

// Alerts: a counter badge in the top bar that opens a drawer with the list, plus a 4 s banner
// and a red vignette flash whenever a new critical alert appears.
// Clicking an alert highlights it in 3D (focus on its regions) and opens its zone panel.

const TEXT = {
  alerts: 'Alerts',
  clear: 'All normal',
  none: 'No active alerts. Keep up the daily check-in.',
  cause: 'Cause',
  forecast: 'forecast',
  unverified: 'not yet verified',
  close: 'Close alerts',
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

function useOpenAlert() {
  const setHighlight = useHealthStore((s) => s.setHighlightAlert)
  const select = useHealthStore((s) => s.selectRegion)
  return (item: AlertItem) => {
    setHighlight(item.id, item.regions) // first, so the selection below keeps it
    select(item.regionId)
  }
}

function sourceTitle(item: AlertItem) {
  return `Rule source: ${item.source}${item.verified ? '' : ` (${TEXT.unverified})`}`
}

export function AlertsBadge() {
  const items = useAlertItems()
  const [open, setOpen] = useState(false)
  const highlight = useHealthStore((s) => s.highlightAlertId)
  const openAlert = useOpenAlert()
  const worst = items[0]?.level
  const drawer = useRef<HTMLDivElement>(null)

  // Esc or a click outside closes the drawer.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: PointerEvent) => {
      if (!drawer.current?.parentElement?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  return (
    <div className="alerts">
      <button
        type="button"
        className="alerts-badge"
        data-level={worst ?? 'ok'}
        aria-expanded={open}
        aria-controls="alerts-drawer"
        onClick={() => setOpen((o) => !o)}
      >
        <small>{TEXT.alerts}</small>
        <span>
          {worst && <i aria-hidden="true" style={{ background: STATUS_HEX[worst] }} />}
          <b>{items.length}</b>
          {worst ? STATUS_LABEL[worst] : TEXT.clear}
        </span>
      </button>
      {open && (
        <div ref={drawer} id="alerts-drawer" className="alerts-drawer" role="dialog" aria-label={TEXT.alerts}>
          <header>
            <h2>
              {TEXT.alerts} <small>{items.length}</small>
            </h2>
            <button type="button" onClick={() => setOpen(false)} aria-label={TEXT.close}>×</button>
          </header>
          {items.length === 0 ? (
            <p>{TEXT.none}</p>
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="alert-item"
                    data-level={item.level}
                    aria-current={highlight === item.id}
                    title={sourceTitle(item)}
                    style={{ borderLeftColor: STATUS_HEX[item.level] }}
                    onClick={() => {
                      openAlert(item)
                      setOpen(false)
                    }}
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
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
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
  useEffect(() => () => clearTimeout(timer.current), [])

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
