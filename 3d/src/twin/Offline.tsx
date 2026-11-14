import { Html } from '@react-three/drei'
import { useHealthStore } from './store'
import { OFFLINE } from './config'
import { EARTH_LABEL } from './labels'
import { overlayStyles as s } from './overlayStyles'

// Distance from Earth as a simple state: nothing extra while the link works.
// earthLink = false: a small "Autonomous mode" tag above the head (inside the Canvas)
// and a slightly colder frame (HTML overlay over the canvas, faded in over OFFLINE.tintSeconds).

export function OfflineTag() {
  const offline = useHealthStore((st) => st.earthLink === false)
  if (!offline) return null
  return (
    <Html position={OFFLINE.labelPosition} center style={{ pointerEvents: 'none' }}>
      <div style={s.autonomyLabel}>{EARTH_LABEL.autonomous}</div>
    </Html>
  )
}

export function OfflineTint() {
  const offline = useHealthStore((st) => st.earthLink === false)
  return (
    <div
      style={{
        ...s.coldTint,
        background: OFFLINE.coldTint,
        opacity: offline ? 1 : 0,
        transition: `opacity ${OFFLINE.tintSeconds}s linear`,
      }}
    />
  )
}
