import { useHealthStore } from '../twin/store'
import { MAX_DAY } from './ControlBar'

// Slim read-only mission timeline under the body: day 0 to MAX_DAY, the current day, and markers
// for what the store already knows. The store has no start day for the solar flare or the Earth
// link cut, only whether they are on now, so those markers sit at the current day ("now").
// Check-ins are the self-tracking days in `history` (last 7 days, the last one is today).

const TEXT = {
  title: 'Mission timeline',
  day: (d: number) => `Day ${d}`,
  flare: 'Solar flare · now',
  linkOff: 'Earth link off · now',
  checkIns: (n: number) => `Check-ins · last ${n} day${n === 1 ? '' : 's'}`,
}
const TICKS = [0, 30, 60, 90, 120, 150, 180]

const pct = (day: number) => `${(Math.min(Math.max(day, 0), MAX_DAY) / MAX_DAY) * 100}%`

export function MissionTimeline() {
  const day = useHealthStore((s) => s.missionDay ?? s.day)
  const flare = useHealthStore((s) => s.activeEvent === 'solar_flare')
  const linkOff = useHealthStore((s) => s.earthLink === false)
  const historyDays = useHealthStore((s) => s.history?.length ?? 0)
  // history: oldest first, the last entry is today; days before launch are not drawn
  const checkIns = Array.from({ length: historyDays }, (_, i) => day - (historyDays - 1 - i)).filter((d) => d >= 0)

  return (
    <section className="mission-timeline" aria-label={TEXT.title}>
      <span className="timeline-title">{TEXT.title}</span>
      <div className="timeline-track-wrap">
        <div className="timeline-track">
          <div className="timeline-done" style={{ width: pct(day) }} />
          {checkIns.map((d) => (
            <i key={d} className="timeline-checkin" style={{ left: pct(d) }} aria-hidden="true" />
          ))}
          {flare && <i className="timeline-event" data-event="flare" style={{ left: pct(day) }} aria-hidden="true" />}
          {linkOff && <i className="timeline-event" data-event="link" style={{ left: pct(day) }} aria-hidden="true" />}
          <span className="timeline-now" data-align={day > MAX_DAY * 0.85 ? 'end' : day < MAX_DAY * 0.15 ? 'start' : 'middle'} style={{ left: pct(day) }}>
            <b>{TEXT.day(day)}</b>
          </span>
        </div>
        <div className="timeline-ticks" aria-hidden="true">
          {TICKS.map((t) => (
            <span key={t} style={{ left: pct(t) }}>{t}</span>
          ))}
        </div>
      </div>
      <ul className="timeline-legend">
        {checkIns.length > 0 && <li data-event="checkin"><i aria-hidden="true" />{TEXT.checkIns(checkIns.length)}</li>}
        {flare && <li data-event="flare"><i aria-hidden="true" />{TEXT.flare}</li>}
        {linkOff && <li data-event="link"><i aria-hidden="true" />{TEXT.linkOff}</li>}
      </ul>
    </section>
  )
}
