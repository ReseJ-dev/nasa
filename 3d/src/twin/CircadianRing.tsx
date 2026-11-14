import { Html } from '@react-three/drei'
import type { Status } from '../contract/types'
import { useHealthStore } from './store'
import { useThreatEffect } from './hooks/useThreatEffect'
import { STATUS_HEX } from './colors'
import { CIRCADIAN as C, type Layer } from './config'
import { CIRCADIAN_LABEL } from './labels'
import { overlayStyles as s } from './overlayStyles'

// Circadian ring near the brain (isolation threat): a 24-hour circle (midnight at the top)
// with the sleep sector. Sector length = sleepHours, start = normal bedtime + sleepShiftHours.
// Yellow / red when sleep is short or the rhythm has shifted (thresholds in config.ts).
// Full when isolation is focused / demo, faint otherwise, hidden when inactive or in skeleton mode.

function sleepStatus(sleep: number, shift: number): Status {
  if (sleep < C.critSleep || Math.abs(shift) >= C.critShift) return 'critical'
  if (sleep < C.warnSleep || Math.abs(shift) > C.warnShift) return 'warning'
  return 'ok'
}

// Point on the clock face for an hour (0 h at the top, clockwise).
function clock(hour: number, r: number, c: number) {
  const a = (hour / 24) * Math.PI * 2 - Math.PI / 2
  return [c + r * Math.cos(a), c + r * Math.sin(a)] as const
}

export function CircadianRing({ layer }: { layer: Layer }) {
  const sleep = useHealthStore((st) => st.sleepHours ?? 8)
  const shift = useHealthStore((st) => st.sleepShiftHours ?? 0)
  const effect = useThreatEffect('isolation')
  const opacity = layer === 'body' ? effect : 0

  const size = C.size
  const c = size / 2
  const r = size / 2 - 6
  const start = C.normalBedtime + shift
  const end = start + Math.min(Math.max(sleep, 0), 23.9)
  const [x0, y0] = clock(start, r, c)
  const [x1, y1] = clock(end, r, c)
  const large = end - start > 12 ? 1 : 0
  const color = STATUS_HEX[sleepStatus(sleep, shift)]

  return (
    <Html
      position={C.position}
      center
      style={{ pointerEvents: 'none', opacity, transition: 'opacity 0.5s', display: opacity > 0 ? 'block' : 'none' }}
    >
      <div style={s.circadian}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
          <circle cx={c} cy={c} r={r} fill="rgba(10,14,24,0.7)" stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
          {/* hour ticks at 0, 6, 12, 18 */}
          {[0, 6, 12, 18].map((h) => {
            const [ax, ay] = clock(h, r - 3, c)
            const [bx, by] = clock(h, r + 3, c)
            return <line key={h} x1={ax} y1={ay} x2={bx} y2={by} stroke="rgba(255,255,255,0.5)" strokeWidth={1} />
          })}
          {/* sleep sector */}
          <path
            d={`M${x0} ${y0} A${r} ${r} 0 ${large} 1 ${x1} ${y1}`}
            fill="none"
            stroke={color}
            strokeWidth={5}
            strokeLinecap="round"
          />
          <text x={c} y={c + 4} textAnchor="middle" fill="#fff" fontSize={12} fontWeight={600}>
            {sleep} {CIRCADIAN_LABEL.hours}
          </text>
        </svg>
        <span>
          {CIRCADIAN_LABEL.sleep}
          {shift ? ` · ${CIRCADIAN_LABEL.shift} ${shift > 0 ? '+' : ''}${shift} ${CIRCADIAN_LABEL.hours}` : ''}
        </span>
      </div>
    </Html>
  )
}
