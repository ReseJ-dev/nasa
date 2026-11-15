import { useMemo } from 'react'
import type { BonePart, DayRecord, RegionId } from '../contract/types'
import { STATUS_HEX } from '../twin/colors'
import { useHealthStore } from '../twin/store'
import { computeState, type Exercise } from '../../../src/engine/index'
import { PERSONAL_BASELINE } from '../../../src/data/baseline'
import { MAX_DAY } from './ControlBar'

// Mini charts for the zone panel, plain inline SVG (no chart library).
// Measured values: solid line with dots. Forecasts: dashed line. Personal baseline: dashed grey.
// Every chart marks the current mission day. Display only: values come from the store / engine.

type Point = [number, number]

interface Series {
  label: string
  points: Point[]
  color: string
  dashed?: boolean // dashed = forecast
  dots?: boolean
}
interface RefLine {
  y: number
  label: string
  color: string
  dashed?: boolean
  faint?: boolean
}

// NASA schedules 8.5 h of sleep per day for ISS crew (user-provided reference; not yet verified).
const NASA_SLEEP_SCHEDULE_H = 8.5
// CO2 lines in mmHg (user-provided reference values, NASA OCHMO CO2 brief; not yet verified).
const CO2_LINES_MMHG = [
  { y: 2.5, color: STATUS_HEX.warning },
  { y: 3, color: STATUS_HEX.critical },
]
// ppm -> partial pressure, assuming a sea-level cabin (760 mmHg total), as on the ISS.
const CABIN_PRESSURE_MMHG = 760
const ppmToMmHg = (ppm: number) => (ppm * CABIN_PRESSURE_MMHG) / 1_000_000

const COLOR = {
  measured: '#73d6e8',
  baseline: '#8a9bb0',
  withExercise: '#73d6e8',
  withoutExercise: '#ff8a80',
  marker: '#eef5ff',
}

const W = 300
const H = 112
const PAD = { left: 36, right: 10, top: 10, bottom: 20 }

function MiniChart({
  title,
  unit,
  series,
  refs = [],
  x,
  y,
  marker,
  formatY = (v) => String(Math.round(v)),
  xLabel,
}: {
  title: string
  unit: string
  series: Series[]
  refs?: RefLine[]
  x: [number, number]
  y?: [number, number] // fixed y range; otherwise from the data and reference lines
  marker: number // current mission day
  formatY?(v: number): string
  xLabel(day: number): string
}) {
  const yRange = useMemo<[number, number]>(() => {
    if (y) return y
    const values = [...series.flatMap((s) => s.points.map((p) => p[1])), ...refs.map((r) => r.y)]
    if (values.length === 0) return [0, 1]
    const lo = Math.min(...values)
    const hi = Math.max(...values)
    const pad = (hi - lo || Math.abs(hi) || 1) * 0.12
    return [lo - pad, hi + pad]
  }, [y, series, refs])

  const sx = (v: number) => PAD.left + ((v - x[0]) / (x[1] - x[0] || 1)) * (W - PAD.left - PAD.right)
  const sy = (v: number) => PAD.top + (1 - (v - yRange[0]) / (yRange[1] - yRange[0] || 1)) * (H - PAD.top - PAD.bottom)
  const path = (pts: Point[]) => pts.map(([a, b], i) => `${i ? 'L' : 'M'}${sx(a).toFixed(1)} ${sy(b).toFixed(1)}`).join(' ')
  const plotBottom = H - PAD.bottom

  const summary = `${title}, ${unit}. ` + series.map((s) => {
    const last = s.points.at(-1)
    return last ? `${s.label}: ${formatY(last[1])}` : ''
  }).filter(Boolean).join('; ')

  return (
    <figure className="mini-chart">
      <figcaption>
        {title} <small>{unit}</small>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
        {/* y axis: min and max */}
        {[yRange[0], yRange[1]].map((v, i) => (
          <text key={i} x={PAD.left - 5} y={sy(v) + 3} textAnchor="end" className="mini-chart-axis">
            {formatY(v)}
          </text>
        ))}
        <line x1={PAD.left} x2={W - PAD.right} y1={plotBottom} y2={plotBottom} className="mini-chart-base" />
        {/* x axis: first and last day */}
        <text x={sx(x[0])} y={H - 5} className="mini-chart-axis">{xLabel(x[0])}</text>
        <text x={sx(x[1])} y={H - 5} textAnchor="end" className="mini-chart-axis">{xLabel(x[1])}</text>

        {refs.map((r) => (
          <g key={r.label} opacity={r.faint ? 0.45 : 0.9}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={sy(r.y)}
              y2={sy(r.y)}
              stroke={r.color}
              strokeWidth={1}
              strokeDasharray={r.dashed ? '4 3' : undefined}
            />
            {/* left end: the right end is where the "today" marker sits */}
            <text x={PAD.left + 3} y={sy(r.y) - 3} className="mini-chart-ref" fill={r.color}>
              {r.label}
            </text>
          </g>
        ))}

        {/* current day marker */}
        {marker >= x[0] && marker <= x[1] && (
          <g>
            <line x1={sx(marker)} x2={sx(marker)} y1={PAD.top} y2={plotBottom} stroke={COLOR.marker} strokeOpacity={0.35} />
            <text x={sx(marker)} y={PAD.top - 2} textAnchor={sx(marker) > W - 60 ? 'end' : 'middle'} className="mini-chart-ref" fill={COLOR.marker}>
              today
            </text>
          </g>
        )}

        {series.map((s) => (
          <g key={s.label}>
            {s.points.length > 1 && (
              <path
                d={path(s.points)}
                fill="none"
                stroke={s.color}
                strokeWidth={1.8}
                strokeDasharray={s.dashed ? '5 4' : undefined}
                strokeLinejoin="round"
              />
            )}
            {(s.dots || s.points.length === 1) &&
              s.points.map(([a, b], i) => (
                <circle
                  key={i}
                  cx={sx(a)}
                  cy={sy(b)}
                  r={i === s.points.length - 1 ? 3.2 : 2.2}
                  fill={s.dashed ? 'none' : s.color}
                  stroke={s.color}
                />
              ))}
          </g>
        ))}
      </svg>
      <ul className="mini-chart-legend">
        {series.map((s) => (
          <li key={s.label}>
            <svg width="18" height="6" aria-hidden="true">
              <line x1="0" x2="18" y1="3" y2="3" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? '4 3' : undefined} />
            </svg>
            {s.label}
          </li>
        ))}
        {refs.map((r) => (
          <li key={r.label} style={{ opacity: r.faint ? 0.7 : 1 }}>
            <svg width="18" height="6" aria-hidden="true">
              <line x1="0" x2="18" y1="3" y2="3" stroke={r.color} strokeWidth="1" strokeDasharray={r.dashed ? '4 3' : undefined} />
            </svg>
            {r.label}
          </li>
        ))}
      </ul>
    </figure>
  )
}

const NO_HISTORY: DayRecord[] = []
const dayLabel = (d: number) => `day ${Math.round(d)}`

// The last 7 days of one tracked value; the last point (today) is the live store value,
// so a new check-in or reaction test moves it at once.
function week(history: DayRecord[], day: number, pick: (r: DayRecord) => number | undefined, today: number | undefined): Point[] {
  const days = history.slice(-7)
  const points: Point[] = []
  days.forEach((r, i) => {
    const isToday = i === days.length - 1
    const v = isToday && today !== undefined ? today : pick(r)
    if (v !== undefined && Number.isFinite(v)) points.push([day - (days.length - 1 - i), v])
  })
  return points
}

function BrainCharts() {
  const day = useHealthStore((s) => s.day)
  const history = useHealthStore((s) => s.history ?? NO_HISTORY)
  const baseline = useHealthStore((s) => s.baseline)
  const sleep = useHealthStore((s) => s.sleepHours)
  const reaction = useHealthStore((s) => s.reactionMs)
  const mood = useHealthStore((s) => s.mood)
  const x: [number, number] = [day - 6, day]
  const base = (label: string, y: number): RefLine => ({ y, label: `Your baseline ${label}`, color: COLOR.baseline, dashed: true })

  const sleepPts = week(history, day, (r) => r.sleepHours, sleep)
  const reactionPts = week(history, day, (r) => r.reactionMs, reaction)
  const moodPts = week(history, day, (r) => r.mood, mood)
  const sleepBase = baseline?.sleepHours ?? PERSONAL_BASELINE.sleepHours
  const reactionBase = baseline?.reactionMs ?? PERSONAL_BASELINE.reactionMs

  return (
    <>
      {sleepPts.length > 0 && (
        <MiniChart
          title="Sleep"
          unit="h · last 7 days"
          x={x}
          marker={day}
          xLabel={dayLabel}
          formatY={(v) => v.toFixed(1)}
          series={[{ label: 'Sleep (measured)', points: sleepPts, color: COLOR.measured, dots: true }]}
          refs={[
            base(`${sleepBase} h`, sleepBase),
            { y: NASA_SLEEP_SCHEDULE_H, label: `NASA schedule ${NASA_SLEEP_SCHEDULE_H} h`, color: COLOR.measured, faint: true },
          ]}
        />
      )}
      {reactionPts.length > 0 && (
        <MiniChart
          title="Reaction time"
          unit="ms · last 7 days"
          x={x}
          marker={day}
          xLabel={dayLabel}
          series={[{ label: 'Reaction test (measured)', points: reactionPts, color: COLOR.measured, dots: true }]}
          refs={[base(`${reactionBase} ms`, reactionBase)]}
        />
      )}
      {moodPts.length > 0 && (
        <MiniChart
          title="Mood"
          unit="1–5 · last 7 days"
          x={x}
          y={[1, 5]}
          marker={day}
          xLabel={dayLabel}
          series={[{ label: 'Mood (self-report)', points: moodPts, color: COLOR.measured, dots: true }]}
          refs={[base(`${PERSONAL_BASELINE.mood}`, PERSONAL_BASELINE.mood)]}
        />
      )}
    </>
  )
}

const WITH_EXERCISE: Exercise = { aerobic: 1, resistance: 1 }
const NO_EXERCISE: Exercise = { aerobic: 0, resistance: 0 }
const LOAD_BEARING: BonePart[] = ['pelvis', 'spine', 'leg_left', 'leg_right']
const STEPS = 30

function BoneChart() {
  const day = useHealthStore((s) => s.day)
  const inputs = useHealthStore((s) => s.inputs)
  // Forecast over the mission and 90 days past today, from the engine, both exercise variants.
  const end = Math.max(MAX_DAY, day + 90)
  const curves = useMemo(() => {
    const weakest = (d: number, ex: Exercise) => {
      const density = computeState(d, inputs, ex).boneDensity
      return Math.min(...LOAD_BEARING.map((p) => density[p])) * 100
    }
    const days = Array.from({ length: STEPS + 1 }, (_, i) => (end * i) / STEPS)
    return {
      with: days.map((d): Point => [d, weakest(d, WITH_EXERCISE)]),
      without: days.map((d): Point => [d, weakest(d, NO_EXERCISE)]),
      preflight: [[0, weakest(0, NO_EXERCISE)]] as Point[],
    }
  }, [inputs, end])

  return (
    <MiniChart
      title="Bone density forecast"
      unit="% of pre-flight · weakest load-bearing bone"
      x={[0, end]}
      marker={day}
      xLabel={dayLabel}
      formatY={(v) => v.toFixed(0)}
      series={[
        { label: 'Pre-flight scan (measured)', points: curves.preflight, color: COLOR.marker },
        { label: 'With exercise (forecast)', points: curves.with, color: COLOR.withExercise, dashed: true },
        { label: 'Without exercise (forecast)', points: curves.without, color: COLOR.withoutExercise, dashed: true },
      ]}
    />
  )
}

function LungChart() {
  const day = useHealthStore((s) => s.day)
  const history = useHealthStore((s) => s.history ?? NO_HISTORY)
  const co2Ppm = useHealthStore((s) => s.inputs.co2Ppm)
  const points = week(history, day, (r) => (r.co2Ppm === undefined ? undefined : ppmToMmHg(r.co2Ppm)), ppmToMmHg(co2Ppm))
  return (
    <MiniChart
      title="Cabin CO₂"
      unit="mmHg · last 7 days"
      x={[day - 6, day]}
      marker={day}
      xLabel={dayLabel}
      formatY={(v) => v.toFixed(1)}
      series={[{ label: 'Cabin CO₂ (measured)', points, color: COLOR.measured, dots: true }]}
      refs={CO2_LINES_MMHG.map((l) => ({ ...l, label: `${l.y} mmHg`, dashed: true }))}
    />
  )
}

const CHARTS: Partial<Record<RegionId, () => React.JSX.Element>> = {
  brain: BrainCharts,
  bones: BoneChart,
  lungs: LungChart,
}

// "Trends" block of the zone panel; nothing at all for regions without charts.
export function ZoneCharts({ regionId }: { regionId: RegionId }) {
  const Charts = CHARTS[regionId]
  if (!Charts) return null
  return (
    <div className="zone-block">
      <h3>Trends</h3>
      <p className="mini-chart-key">Solid = measured · dashed = forecast or your baseline</p>
      <div className="mini-charts">
        <Charts />
      </div>
    </div>
  )
}
