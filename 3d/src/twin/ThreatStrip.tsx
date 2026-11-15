import type { ReactNode, RefObject } from 'react'
import type { Status, ThreatId, ThreatLink } from '../contract/types'
import { useHealthStore } from './store'
import { useSceneStore } from './sceneStore'
import { useFocusedThreat } from './hooks/useFocusedThreat'
import { STATUS_HEX } from './colors'
import { EFFECTS, THREAT_COLOR, THREAT_LEVEL, THREAT_STRIP as S } from './config'
import { EARTH_LABEL, RADIATION_LABEL, THREAT_LABEL, THREAT_STRIP_LABEL } from './labels'
import { overlayStyles as s } from './overlayStyles'
import { formatLevel } from '../../../src/engine'
import { delayedEarth } from '../missionDisplay'

// Five threats strip: its own row above the 3D stage (never over the astronaut).
// Each threat: its icon inside a ring filled by level (ring color = status thresholds),
// name and level in % next to it. Arcs above the row show threatLinks (thickness = strength).
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
  // Dose counter next to the radiation level while a solar flare is on.
  const flare = useHealthStore((st) => st.activeEvent === 'solar_flare')
  const dose = useHealthStore((st) => st.radiationLevel ?? 0)
  const doseMsv = useHealthStore(st => st.metrics.find(metric => metric.id === 'radiation_msv')?.value)
  // Distance shows the link state and delay instead of a level.
  const link = useHealthStore((st) => st.earthLink ?? true)
  const delay = useHealthStore((st) => st.commDelaySec ?? 0)
  const distanceText = delayedEarth(delay) ? 'Autonomous mode' : link ? EARTH_LABEL.replyIn(delay * 2) : EARTH_LABEL.noLink
  if (!threats) return null

  return (
    <div style={{ ...s.threats, ...(compact ? s.threatsCompact : null), paddingTop: S.arcSpace }} onMouseLeave={() => setHover(null)}>
      <LinkArcs focused={focused} />
      {THREAT_IDS.map((id) => {
        const { level, regions } = threats[id]
        const status = levelStatus(level)
        const ofSelected = selected !== null && regions.includes(selected) // reverse highlight
        const physicalDose = id === 'radiation' && showPhysicalDose && doseMsv !== undefined
        return (
          <button
            key={id}
            title={`${THREAT_LABEL[id]}: ${physicalDose ? `${doseMsv} mSv accumulated · ${status}` : id === 'distance' ? distanceText : formatLevel(level)}`}
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
                  ...(id === 'distance' ? (
                    delayedEarth(delay) ? { ...s.threatNoLink, whiteSpace: 'normal', fontSize: 12 }
                      : link ? { color: 'var(--text-2)', fontWeight: 400 } : s.threatNoLink
                  ) : null),
                }}
              >
                {physicalDose ? `${doseMsv} mSv · ${status}` : id === 'distance' ? distanceText : formatLevel(level)}
                {!physicalDose && id === 'radiation' && flare && EFFECTS.solarFlare && (
                  <span style={s.doseBadge}>{RADIATION_LABEL.dose(dose)}</span>
                )}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
