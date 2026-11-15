import { useEffect, useState } from 'react'
import { DEMO_LABEL, useDemo } from '../demo'
import type { RegionId } from '../contract/types'
import { BodyScene } from '../twin'
import { STATUS_HEX } from '../twin/colors'
import { NO_DATA_LABEL, REGION_LABEL, STATUS_LABEL } from '../twin/labels'
import { useHealthStore } from '../twin/store'
import { CriticalBanner, useAlertItems } from './AlertsPanel'
import { Forecast, MAX_DAY } from './ControlBar'
import { ControlRoom } from './ControlRoom'
import { useSound } from './sound'
import { StatusNow } from './StatusNow'
import { ZonePanel } from './ZonePanel'
import '../twin/theme'
import './healthDashboard.css'

// Presentation screen (default): only the result. The twin is the hero, the right column says
// what matters now. Sensors feed the data, so nothing here is an input; everything for driving
// the demo lives in the Control room.

const systems = ['heart', 'brain', 'bones', 'muscles', 'eyes', 'immune', 'lungs', 'metabolism'] satisfies RegionId[]

const TEXT = {
  title: 'Astronaut Health Monitor',
  subtitle: 'Digital twin · demonstration model',
  day: 'Mission day',
  link: 'Earth link',
  online: (reply: string) => `Online · reply in ${reply}`,
  offline: 'Offline · autonomous',
  flare: 'Solar flare',
  flareActive: 'Active',
  alerts: 'Alerts',
  clear: 'All normal',
  critical: 'critical',
  warning: 'warning',
  forecast: 'Forecast',
  closeForecast: 'Close forecast',
  systems: 'Body systems',
  soundOn: 'Sound on (click to mute)',
  soundOff: 'Sound muted (click to unmute)',
}

// Tiny speaker icon: the only sound control in presentation mode (the slider is in the Control room).
function SoundIcon() {
  const enabled = useSound((s) => s.enabled)
  const setEnabled = useSound((s) => s.setEnabled)
  const label = enabled ? TEXT.soundOn : TEXT.soundOff
  return (
    <button type="button" className="sound-icon" aria-pressed={enabled} aria-label={label} title={label} onClick={() => setEnabled(!enabled)}>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 7.5h3l4-3.5v12l-4-3.5H3z" fill="currentColor" stroke="none" />
        {enabled ? <path d="M13 7a4.2 4.2 0 0 1 0 6M15.3 4.8a7.4 7.4 0 0 1 0 10.4" /> : <path d="M13 7.5l5 5M18 7.5l-5 5" />}
      </svg>
    </button>
  )
}

// Read-only chips: mission day, Earth link, solar flare (only while active), alert counts.
function TopBar({ forecastOpen, onForecast }: { forecastOpen: boolean; onForecast(): void }) {
  // missionDay is the day the scene shows (the scripted demo moves it); same as `day` otherwise.
  const day = useHealthStore((s) => s.missionDay ?? s.day)
  const flare = useHealthStore((s) => s.activeEvent === 'solar_flare')
  const online = useHealthStore((s) => s.earthLink ?? true)
  const reply = useHealthStore((s) => (s.commDelaySec ?? 0) * 2) // there and back
  const items = useAlertItems()
  const critical = items.filter((i) => i.level === 'critical').length
  const warning = items.length - critical
  const level = items[0]?.level ?? 'ok'
  const replyText = reply < 60 ? `${Math.round(reply)} s` : `${Math.round(reply / 60)} min`
  return (
    <header className="health-header" data-level={level}>
      <div className="health-title">
        <h1>{TEXT.title}</h1>
        <p>{TEXT.subtitle}</p>
      </div>
      <div className="health-telemetry">
        <dl className="health-chip">
          <dt>{TEXT.day}</dt>
          <dd>{day} <small>/ {MAX_DAY}</small></dd>
        </dl>
        {flare && (
          <dl className="health-chip" data-alert="true">
            <dt>{TEXT.flare}</dt>
            <dd>{TEXT.flareActive}</dd>
          </dl>
        )}
        <dl className="health-chip" data-online={online}>
          <dt>{TEXT.link}</dt>
          <dd>{online ? TEXT.online(replyText) : TEXT.offline}</dd>
        </dl>
        <dl className="health-chip alert-summary" data-level={level}>
          <dt>{TEXT.alerts}</dt>
          <dd>
            {items.length === 0 && TEXT.clear}
            {critical > 0 && <span data-level="critical"><i aria-hidden="true" />{critical} {TEXT.critical}</span>}
            {warning > 0 && <span data-level="warning"><i aria-hidden="true" />{warning} {TEXT.warning}</span>}
          </dd>
        </dl>
        <button type="button" className="top-button" aria-pressed={forecastOpen} onClick={onForecast}>
          {TEXT.forecast}
        </button>
        <SoundIcon />
      </div>
    </header>
  )
}

// Compact system list: two columns of status dot, name and score. Click opens the zone panel.
function SystemList() {
  const regions = useHealthStore((s) => s.regions)
  const selected = useHealthStore((s) => s.selectedRegion)
  const select = useHealthStore((s) => s.selectRegion)
  return (
    <section className="health-card system-card" aria-labelledby="health-systems">
      <h2 id="health-systems">{TEXT.systems} <small className="health-h2-note">score / 100</small></h2>
      <ul className="health-systems">
        {systems.map((id) => {
          const { status, score, noData } = regions[id]
          return (
            <li key={id}>
              <button
                type="button"
                data-status={status}
                aria-pressed={selected === id}
                title={`${REGION_LABEL[id]}: ${noData ? NO_DATA_LABEL : STATUS_LABEL[status]}`}
                onClick={() => select(selected === id ? null : id)}
              >
                <i aria-hidden="true" style={{ background: STATUS_HEX[status] }} />
                <span>{REGION_LABEL[id]}</span>
                <strong>{noData ? '–' : score}</strong>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// Forecast drawer: the forecast table (with / without exercise), closed by default.
function ForecastDrawer({ onClose }: { onClose(): void }) {
  return (
    <div className="forecast-drawer" role="dialog" aria-label={TEXT.forecast}>
      <Forecast />
      <button type="button" className="zone-close" onClick={onClose} aria-label={TEXT.closeForecast}>×</button>
    </div>
  )
}

// ?mode=control opens the Control room at start; ?mode=present (or nothing) keeps it hidden.
const START_IN_CONTROL = new URLSearchParams(location.search).get('mode') === 'control'

const typing = (e: KeyboardEvent) =>
  e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement

export function HealthDashboard() {
  const selected = useHealthStore((s) => s.selectedRegion)
  const [forecastOpen, setForecastOpen] = useState(false)
  const [controlOpen, setControlOpen] = useState(START_IN_CONTROL)
  const [checkInOpen, setCheckInOpen] = useState(false)

  // The scripted demo drives the layer and the focused threat, so both are controlled here.
  const demo = useDemo()
  const { start, startIsolation, stop, setView } = demo
  const { layer, focus, caption } = demo.view

  // Browsers allow audio only after a user gesture: the first key press or click unmutes.
  useEffect(() => {
    const unlock = (e: Event) => {
      // a first click on a sound control is that control's own decision
      if (e.target instanceof Element && e.target.closest('.sound-icon, .sound-controls')) return
      useSound.getState().setEnabled(true)
    }
    const options = { once: true, capture: true }
    window.addEventListener('keydown', unlock, options)
    window.addEventListener('pointerdown', unlock, options)
    return () => {
      window.removeEventListener('keydown', unlock, options)
      window.removeEventListener('pointerdown', unlock, options)
    }
  }, [])

  // Keys: C Control room, D demo, I isolation step, Esc stops the demo and resets to Healthy.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e) || e.ctrlKey || e.metaKey || e.altKey || checkInOpen) return
      const key = e.key.toLowerCase()
      if (key === 'c') setControlOpen((o) => !o)
      else if (key === 'd') start()
      else if (key === 'i') startIsolation()
      else if (key === 'escape') {
        stop()
        useHealthStore.getState().selectRegion(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [checkInOpen, start, startIsolation, stop])

  return (
    <main className="health-dashboard" data-control={controlOpen}>
      <TopBar forecastOpen={forecastOpen} onForecast={() => setForecastOpen((o) => !o)} />
      <div className="health-layout">
        <section className="health-scene" aria-label="Interactive astronaut model">
          <BodyScene
            compact
            layer={layer}
            onLayerChange={(l) => setView((v) => ({ ...v, layer: l }))}
            focusedThreat={focus}
            onThreatClick={(id) => setView((v) => ({ ...v, focus: v.focus === id ? null : id }))}
          />
          {caption && <p className="demo-caption" role="status">{caption}</p>}
          {forecastOpen && <ForecastDrawer onClose={() => setForecastOpen(false)} />}
        </section>
        <aside className="health-column">
          {/* New critical alert: first thing in the right column, right under the top bar.
              It is in the column's flow, so it can never cover the threats strip or the twin. */}
          <CriticalBanner />
          <SystemList />
          {/* A selected region replaces "Status now" with its zone panel; closing it returns. */}
          {selected ? <ZonePanel /> : <StatusNow />}
        </aside>
        {controlOpen && (
          <ControlRoom
            onClose={() => setControlOpen(false)}
            checkInOpen={checkInOpen}
            onCheckIn={setCheckInOpen}
            demo={{ running: demo.running, start, startIsolation, stop, label: DEMO_LABEL }}
          />
        )}
      </div>
    </main>
  )
}
