import { useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useHealthStore } from './store'
import { STATUS_HEX } from './colors'
import { CIRCADIAN, ISOLATION as I, MOOD } from './config'
import { ISOLATION_LABEL as L } from './labels'
import { setOpacity, smoothK, stage, useAlertStatus } from './isolationStage'
import { overlayStyles as s } from './overlayStyles'

// Mood (isolation): a tiny 5-dot indicator next to the circadian ring, filled up to `mood` (1..5).
// Text-like label only: it never touches the body. Dots are restyled from useFrame only when
// the rounded value or the alert status changes.

const DOTS = Array.from({ length: MOOD.dots }, (_, i) => i)
const FILL = '#e6eeff'

export function MoodDots() {
  const mood = useHealthStore((st) => st.mood ?? 0)
  const status = useAlertStatus('mood')
  const goal = useRef({ mood, status })
  useLayoutEffect(() => {
    goal.current = { mood, status }
  }, [mood, status])

  const shown = useRef(mood)
  const drawn = useRef('')
  const label = useRef<HTMLDivElement>(null)
  const dots = useRef<(HTMLSpanElement | null)[]>([])

  useFrame((_, delta) => {
    setOpacity(label.current, stage.labels)
    const g = goal.current
    shown.current += (g.mood - shown.current) * smoothK(delta, I.valueLerp)
    const filled = Math.round(shown.current)
    const key = `${filled}${g.status}`
    if (key === drawn.current) return
    drawn.current = key
    const color = g.status === 'ok' ? FILL : STATUS_HEX[g.status]
    dots.current.forEach((dot, i) => {
      if (!dot) return
      dot.style.background = i < filled ? color : 'transparent'
      dot.style.borderColor = i < filled ? color : ''
    })
  })

  return (
    <Html position={CIRCADIAN.moodLabel} style={{ pointerEvents: 'none' }}>
      <div ref={label} style={{ ...s.holo, ...s.holoRight }}>
        <span style={s.holoCaption}>{L.mood}</span>
        <span style={s.moodDots}>
          {DOTS.map((i) => (
            <span
              key={i}
              ref={(el) => {
                dots.current[i] = el
              }}
              style={{ ...s.moodDot, width: MOOD.dotSize, height: MOOD.dotSize }}
            />
          ))}
        </span>
      </div>
    </Html>
  )
}
