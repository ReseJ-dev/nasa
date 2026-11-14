import type { ReactNode, RefObject } from 'react'
import type { Status, ThreatId, ThreatLink } from '../contract/types'
import { useHealthStore } from './store'
import { useSceneStore } from './sceneStore'
import { useFocusedThreat } from './hooks/useFocusedThreat'
import { STATUS_HEX } from './colors'
import { EFFECTS, THREAT_COLOR, THREAT_LEVEL, THREAT_STRIP as S } from './config'
import { RADIATION_LABEL, THREAT_LABEL } from './labels'
import { overlayStyles as s } from './overlayStyles'

// Five threats strip (HTML over the canvas, top center).
// Each threat: its icon inside a ring filled by level (ring color = status thresholds),
// name and level in %. Arcs above the rings show threatLinks (thickness = strength).
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
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={S.ringWidth} />
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

// Arcs between icon rings for threatLinks, in strip coordinates.
function LinkArcs({ focused }: { focused: ThreatId | null }) {
  const links = useHealthStore((st) => st.threatLinks ?? NO_LINKS)
  const width = THREAT_IDS.length * S.slot
  const y = S.arcSpace // top of the rings
  const cx = (id: ThreatId) => THREAT_IDS.indexOf(id) * S.slot + S.slot / 2
  return (
    <svg width={width} height={S.arcSpace} style={s.threatArcs} aria-hidden>
      {links.map((l) => {
        const x1 = cx(l.from)
        const x2 = cx(l.to)
        const lift = Math.min(S.arcSpace - 4, 8 + (Math.abs(x2 - x1) / S.slot) * 5) // longer link = higher arc
        const lit = focused === l.from || focused === l.to
        return (
          <path
            key={`${l.from}-${l.to}`}
            d={`M${x1} ${y} Q${(x1 + x2) / 2} ${y - lift * 2} ${x2} ${y}`}
            fill="none"
            stroke="#cfe6ff"
            strokeWidth={0.75 + l.strength * 2.5}
            strokeLinecap="round"
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
}: {
  iconRefs: RefObject<Partial<Record<ThreatId, HTMLElement | null>>> // ring elements, for the focus lines
  onToggle(id: ThreatId): void
}) {
  // New objects only on scenario change, so this re-renders rarely.
  const threats = useHealthStore((st) => st.threats)
  const selected = useHealthStore((st) => st.selectedRegion)
  const setHover = useSceneStore((st) => st.setHoverThreat)
  const focused = useFocusedThreat()
  // Dose counter next to the radiation icon while a solar flare is on.
  const flare = useHealthStore((st) => st.activeEvent === 'solar_flare')
  const dose = useHealthStore((st) => st.radiationLevel ?? 0)
  if (!threats) return null

  return (
    <div style={{ ...s.threats, paddingTop: S.arcSpace }} onMouseLeave={() => setHover(null)}>
      <LinkArcs focused={focused} />
      {THREAT_IDS.map((id) => {
        const { level, regions } = threats[id]
        const ofSelected = selected !== null && regions.includes(selected) // reverse highlight
        return (
          <button
            key={id}
            title={`${THREAT_LABEL[id]}: ${Math.round(level * 100)}%`}
            style={{
              ...s.threat,
              width: S.slot,
              ...(ofSelected ? s.threatOfSelected : null),
              ...(focused === id ? s.threatFocused : null),
            }}
            onMouseEnter={() => setHover(id)}
            onClick={() => onToggle(id)}
          >
            <span
              ref={(el) => {
                iconRefs.current[id] = el
              }}
              style={{ display: 'flex' }}
            >
              <ThreatRing id={id} level={level} />
            </span>
            <span>{THREAT_LABEL[id]}</span>
            <span style={s.threatLevel}>{Math.round(level * 100)}%</span>
            {id === 'radiation' && flare && EFFECTS.solarFlare && <span style={s.doseBadge}>{RADIATION_LABEL.dose(dose)}</span>}
          </button>
        )
      })}
    </div>
  )
}
