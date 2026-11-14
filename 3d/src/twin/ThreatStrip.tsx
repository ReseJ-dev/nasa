import type { ReactNode } from 'react'
import type { Status, ThreatId } from '../contract/types'
import { useHealthStore } from './store'
import { STATUS_HEX } from './colors'
import { THREAT_LEVEL } from './config'
import { THREAT_LABEL } from './labels'
import { overlayStyles as s } from './overlayStyles'

// Five threats strip (HTML over the canvas, top-left): icon, name, level in %.
// Hover or click a threat to highlight its regions in the scene; click again to clear.
// Local view state only: it never calls selectRegion.

export const THREAT_IDS: ThreatId[] = ['radiation', 'isolation', 'gravity', 'distance', 'environment']

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

// Simple 20x20 line icons drawn in the current text color.
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

function Icon({ id }: { id: ThreatId }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      {ICON[id]}
    </svg>
  )
}

export function ThreatStrip({
  top,
  active,
  onHover,
  onToggle,
}: {
  top: number
  active: ThreatId | null // highlighted threat (hovered or clicked)
  onHover(id: ThreatId | null): void
  onToggle(id: ThreatId): void
}) {
  // New object only on scenario change, so this re-renders rarely.
  const threats = useHealthStore((st) => st.threats)
  if (!threats) return null

  return (
    <div style={{ ...s.threats, top }} onMouseLeave={() => onHover(null)}>
      {THREAT_IDS.map((id) => {
        const level = threats[id].level
        const color = STATUS_HEX[levelStatus(level)]
        return (
          <button
            key={id}
            style={{ ...s.threat, ...(active === id ? s.threatActive : null) }}
            onMouseEnter={() => onHover(id)}
            onClick={() => onToggle(id)}
          >
            <span style={{ color, display: 'flex' }}>
              <Icon id={id} />
            </span>
            <span style={s.threatName}>{THREAT_LABEL[id]}</span>
            <span style={{ ...s.threatLevel, color }}>{Math.round(level * 100)}%</span>
          </button>
        )
      })}
    </div>
  )
}
