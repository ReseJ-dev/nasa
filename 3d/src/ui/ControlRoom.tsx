import { useHealthStore, type ScenarioId } from '../twin/store'
import { CheckInPanel } from './CheckInPanel'
import { EarthLinkToggle, MissionControls } from './ControlBar'
import { HealthMetrics } from './MetricsCards'
import { loadPreset } from './presetState'
import { SoundControls } from './SoundControls'

// Control room: everything for driving the demo, hidden in presentation mode (key C or
// ?mode=control). In a real mission the sensors do this; here the presenter does.

const SCENARIOS: Record<ScenarioId, string> = { healthy: 'Healthy', day60: 'Day 60', critical: 'Critical' }

const TEXT = {
  title: 'Control room',
  note: 'Demo controls. In a mission this data comes from sensors.',
  close: 'Close control room (C)',
  scenario: 'Scenario',
  mission: 'Mission',
  link: 'Earth link and sound',
  checkIn: 'Daily check-in',
  checkInNote: 'Manual items that sensors cannot capture: mood, reaction test, glucose, blood pressure.',
  closeCheckIn: 'Close check-in',
}

function Presets() {
  const scenario = useHealthStore((s) => s.scenario)
  return (
    <div className="health-presets" role="group" aria-label="Mission scenario">
      {Object.entries(SCENARIOS).map(([id, label]) => (
        <button key={id} type="button" data-scenario={id} aria-pressed={scenario === id} onClick={() => loadPreset(id as ScenarioId)}>
          {label}
        </button>
      ))}
    </div>
  )
}

// The check-in form and the 30 s reaction test, in a modal.
function CheckInModal({ onClose }: { onClose(): void }) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={TEXT.checkIn} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog">
        <header>
          <p>{TEXT.checkInNote}</p>
          <button type="button" className="zone-close" onClick={onClose} aria-label={TEXT.closeCheckIn}>×</button>
        </header>
        <CheckInPanel />
      </div>
    </div>
  )
}

export function ControlRoom({
  onClose,
  checkInOpen,
  onCheckIn,
}: {
  onClose(): void
  checkInOpen: boolean
  onCheckIn(open: boolean): void
}) {
  return (
    <>
      <aside className="control-room" aria-label={TEXT.title}>
        <header>
          <div>
            <h2>{TEXT.title}</h2>
            <p>{TEXT.note}</p>
          </div>
          <button type="button" className="zone-close" onClick={onClose} aria-label={TEXT.close} title={TEXT.close}>×</button>
        </header>
        <section className="health-card" aria-labelledby="cr-scenario">
          <h3 id="cr-scenario">{TEXT.scenario}</h3>
          <Presets />
        </section>
        <section className="health-card" aria-labelledby="cr-mission">
          <h3 id="cr-mission">{TEXT.mission}</h3>
          <MissionControls />
        </section>
        <section className="health-card" aria-labelledby="cr-link">
          <h3 id="cr-link">{TEXT.link}</h3>
          <div className="control-row">
            <EarthLinkToggle />
            <SoundControls />
          </div>
        </section>
        <button type="button" className="checkin-submit control-checkin" onClick={() => onCheckIn(true)}>{TEXT.checkIn}</button>
        <HealthMetrics />
      </aside>
      {checkInOpen && <CheckInModal onClose={() => onCheckIn(false)} />}
    </>
  )
}
