import { useMemo } from 'react'
import { Html, Line } from '@react-three/drei'
import { useHealthStore } from './store'
import { STATUS_HEX } from './colors'
import { REGION_LABEL } from './labels'
import { overlayStyles as s } from './overlayStyles'
import { REGIONS, type RegionDef } from './regions'

// Permanent callouts for warning/critical regions: a thin line from the organ
// to a label (name + score) at a fixed spot left or right of the body.

const noRaycast = () => null // the line must not catch hover or clicks

function Callout({ def }: { def: RegionDef }) {
  // Re-renders only when this region's status or score changes.
  const status = useHealthStore((st) => st.regions[def.id].status)
  const score = useHealthStore((st) => st.regions[def.id].score)
  const points = useMemo(() => [def.callout.anchor, def.callout.label], [def])

  if (status === 'ok') return null
  const color = STATUS_HEX[status]
  const side = def.callout.label[0] < 0 ? s.calloutLeft : s.calloutRight

  return (
    <group name={`${def.id}_callout`}>
      {/* depthTest off: the line stays visible through the translucent shell */}
      <Line points={points} color={color} lineWidth={1} depthTest={false} transparent opacity={0.8} raycast={noRaycast} />
      <Html position={def.callout.label} style={{ pointerEvents: 'none' }}>
        <div style={{ ...s.callout, ...side, border: `1px solid ${color}` }}>
          {REGION_LABEL[def.id]}
          <span style={{ ...s.calloutScore, color }}>{Math.round(score)}</span>
        </div>
      </Html>
    </group>
  )
}

export function Callouts() {
  return (
    <group name="callouts">
      {REGIONS.map((def) => (
        <Callout key={def.id} def={def} />
      ))}
    </group>
  )
}
