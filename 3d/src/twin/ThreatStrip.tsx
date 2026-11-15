import type { ReactNode, RefObject } from 'react'
import type { Status, ThreatId, ThreatLink } from '../contract/types'
import { useHealthStore } from './store'
import { useSceneStore } from './sceneStore'
import { useFocusedThreat } from './hooks/useFocusedThreat'
import { STATUS_HEX } from './colors'
import { THREAT_COLOR, THREAT_LEVEL, THREAT_STRIP as S, isDelayedEarth } from './config'
import { EARTH_LABEL, STRIP_SOURCE, STRIP_VALUE, THREAT_LABEL, THREAT_STRIP_LABEL } from './labels'
import { overlayStyles as s } from './overlayStyles'
import { ppmToMmHg } from '../../../src/engine/constants'

// Five threats strip: its own row above the 3D stage (never over the astronaut).
// Each threat: its icon inside a ring filled by level (ring color = status thresholds),
// then its name, one real value with its unit and the limit it is compared with.
// Values are read from the store as they are; nothing is computed here except unit conversion. Arcs above the row show threatLinks (thickness = strength).
// Hover previews the focus, click pins / unpins (handled by BodyScene). Never calls selectRegion.

export const THREAT_IDS: ThreatId[] = ['radiation', 'isolation', 'gravity', 'distance', 'environment']
const NO_LINKS: ThreatLink[] = []

function levelStatus(level: number): Status {
  if (level >= THREAT_LEVEL.criticalAt) return 'critical'
  if (level >= THREAT_LEVEL.warnAt) return 'warning'
  return 'ok'
}

// Radiation trefoil: three wedges around a small dot.
function wedge(centerDeg: number) {
  const r1 = 3
  const r2 = 8.5
  const a0 = ((centerDeg - 30) * Math.PI) / 180
  const a1 = ((centerDeg + 30) * Math.PI) / 180
  const p = (r: number, a: number) => `${(10 + r * Math.cos(a)).toFixed(2)} ${(10 + r * Math.sin(a)).toFixed(2)}`
  return `M${p(r1, a0)} L${p(r2, a0)} A${r2} ${r2} 0 0 1 ${p(r2, a1)} L${p(r1, a1)} A${r1} ${r1} 0 0 0 ${p(r1, a0)}Z`
}
const TREFOIL = [-90, 30, 150].map(wedge).join(' ')

// Simple 20x20 line icons drawn in the current color.
const ICON: Record<ThreatId, ReactNode> = {
  radiation: (
    <>
      <path d={TREFOIL} fill="currentColor" stroke="none" />
      <circle cx="10" cy="10" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  isolation: (
    // a person inside a closed box
    <>
      <rect x="2.5" y="2.5" width="15" height="15" rx="2" />
      <circle cx="10" cy="7.5" r="2" />
      <path d="M6.5 15c0-2.2 1.6-3.8 3.5-3.8s3.5 1.6 3.5 3.8" />
    </>
  ),
  gravity: (
    // a planet with an orbit ring, floating
    <>
      <circle cx="10" cy="10" r="4" />
      <ellipse cx="10" cy="10" rx="8.5" ry="3" transform="rotate(-20 10 10)" />
    </>
  ),
  distance: (
    // Earth, a dashed line, a small ship far away
    <>
      <circle cx="4.5" cy="15.5" r="2.8" />
      <path d="M7 13 L13.5 6.5" strokeDasharray="1.6 1.6" />
      <circle cx="15.5" cy="4.5" r="1.6" fill="currentColor" />
    </>
  ),
  environment: (
    // CO2 molecule: O = C = O
    <>
      <circle cx="3.8" cy="10" r="2.3" />
      <circle cx="10" cy="10" r="2.8" />
      <circle cx="16.2" cy="10" r="2.3" />
      <path d="M6.1 9h1.2M6.1 11h1.2M12.8 9h1.2M12.8 11h1.2" />
    </>
  ),
}

// Icon (identity color) inside a ring filled by level (status color).
function ThreatRing({ id, level }: { id: ThreatId; level: number }) {
  const size = S.ring
  const r = (size - S.ringWidth) / 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-strong)" strokeWidth={S.ringWidth} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={STATUS_HEX[levelStatus(level)]}
        strokeWidth={S.ringWidth}
        strokeLinecap="round"
        strokeDasharray={`${c * Math.min(Math.max(level, 0), 1)} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} // fill starts at 12 o'clock
      />
      <g
        transform={`translate(${size / 2 - 10} ${size / 2 - 10})`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        color={THREAT_COLOR[id]}
      >
        {ICON[id]}
      </g>
    </svg>
  )
}

// Arcs above the row for threatLinks. The SVG stretches with the row: x is in slots
// (0..5, one per threat), y in pixels; the stroke keeps its pixel width.
function LinkArcs({ focused }: { focused: ThreatId | null }) {
  const links = useHealthStore((st) => st.threatLinks ?? NO_LINKS)
  const y = S.arcSpace // top of the row content
  const cx = (id: ThreatId) => THREAT_IDS.indexOf(id) + 0.5
  return (
    <svg
      height={S.arcSpace}
      viewBox={`0 0 ${THREAT_IDS.length} ${S.arcSpace}`}
      preserveAspectRatio="none"
      style={s.threatArcs}
      aria-hidden
    >
      {links.map((l) => {
        const x1 = cx(l.from)
        const x2 = cx(l.to)
        const lift = Math.min(S.arcSpace - 2, 4 + Math.abs(x2 - x1) * 3) // longer link = higher arc
        const lit = focused === l.from || focused === l.to
        return (
          <path
            key={`${l.from}-${l.to}`}
            d={`M${x1} ${y} Q${(x1 + x2) / 2} ${y - lift * 2} ${x2} ${y}`}
            fill="none"
            stroke="var(--text-2)"
            strokeWidth={0.75 + l.strength * 2.5}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            opacity={lit ? S.linkOpacityFocused : S.linkOpacity}
          />
        )
      })}
    </svg>
  )
}

interface StripValue {
  value: string
  limit: string
}

// The real value behind each threat, straight from the store (undefined = no data).
function useStripValues(): Record<ThreatId, StripValue> {
  const metric = (id: string) => (st: { metrics: { id: string; value: number }[] }) =>
    st.metrics.find((m) => m.id === id)?.value
  const dose = useHealthStore(metric('radiation_msv'))
  const sleep = useHealthStore((st) => st.sleepHours)
  const boneLoss = useHealthStore(metric('bone_loss_pct'))
  const co2Ppm = useHealthStore(metric('co2_ppm'))
  const link = useHealthStore((st) => st.earthLink ?? true)
  const delay = useHealthStore((st) => st.commDelaySec ?? 0)
  const known = (v: number | undefined): v is number => typeof v === 'number' && Number.isFinite(v)
  const or = (v: number | undefined, text: (v: number) => string) => (known(v) ? text(v) : STRIP_VALUE.noData)
  return {
    radiation: { value: or(dose, STRIP_VALUE.radiation), limit: STRIP_VALUE.radiationLimit },
    isolation: { value: or(sleep, STRIP_VALUE.isolation), limit: STRIP_VALUE.isolationLimit },
    gravity: { value: or(boneLoss, STRIP_VALUE.gravity), limit: STRIP_VALUE.gravityLimit },
    distance: {
      value: link ? EARTH_LABEL.replyIn(delay * 2) : EARTH_LABEL.noLink, // reply = there and back
      // no link, or a one-way delay above 5 min: the crew acts on its own
      limit: !link || isDelayedEarth(delay) ? EARTH_LABEL.autonomous : STRIP_VALUE.oneWay(delay),
    },
    environment: {
      value: or(co2Ppm, (ppm) => STRIP_VALUE.environment(ppmToMmHg(ppm))),
      limit: STRIP_VALUE.environmentLimit,
    },
  }
}

export function ThreatStrip({
  iconRefs,
  onToggle,
  compact = false,
  showPhysicalDose = false,
}: {
  iconRefs: RefObject<Partial<Record<ThreatId, HTMLElement | null>>> // ring elements, for the focus lines
  onToggle(id: ThreatId): void
  compact?: boolean // narrow centered row without the panel chrome
  showPhysicalDose?: boolean
}) {
  // New objects only on scenario change, so this re-renders rarely.
  const threats = useHealthStore((st) => st.threats)
  const selected = useHealthStore((st) => st.selectedRegion)
  const setHover = useSceneStore((st) => st.setHoverThreat)
  const focused = useFocusedThreat()
  const values = useStripValues()
  const link = useHealthStore((st) => st.earthLink ?? true)
  if (!threats) return null

  return (
    <div style={{ ...s.threats, ...(compact ? s.threatsCompact : null), paddingTop: S.arcSpace }} onMouseLeave={() => setHover(null)}>
      <LinkArcs focused={focused} />
      {THREAT_IDS.map((id) => {
        const { level, regions } = threats[id]
        const status = levelStatus(level)
        const ofSelected = selected !== null && regions.includes(selected) // reverse highlight
        const { value, limit } = values[id]
        const physicalDose = showPhysicalDose && id === 'radiation'
        const displayValue = physicalDose ? value + ' · ' + status : value
        return (
          <button
            key={id}
            title={`${THREAT_LABEL[id]}: ${value} · ${limit}\n${STRIP_SOURCE[id]}`}
            aria-pressed={focused === id}
            style={{
              ...s.threat,
              ...(ofSelected ? s.threatOfSelected : null),
              ...(focused === id ? { ...s.threatFocused, boxShadow: `inset 0 0 0 1px ${THREAT_COLOR[id]}` } : null),
            }}
            onMouseEnter={() => setHover(id)}
            onClick={() => onToggle(id)}
          >
            <span
              ref={(el) => {
                iconRefs.current[id] = el
              }}
              style={{ display: 'flex', flex: 'none' }}
            >
              <ThreatRing id={id} level={level} />
            </span>
            <span style={s.threatText}>
              <span style={s.threatName}>{THREAT_STRIP_LABEL[id]}</span>
              <span
                style={{
                  ...s.threatLevel,
                  ...(status !== 'ok' ? { color: STATUS_HEX[status], fontWeight: 700 } : null),
                  ...(id === 'distance' && !link ? s.threatNoLink : null),
                }}
              >
                {displayValue}
              </span>
              {!physicalDose && <span style={s.threatLimit}>{limit}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
