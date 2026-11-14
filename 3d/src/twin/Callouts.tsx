import { useLayoutEffect, useMemo } from 'react'
import { Html } from '@react-three/drei'
import { BufferGeometry, Line, LineBasicMaterial, Vector3 } from 'three'
import type { Status } from '../contract/types'
import { useHealthStore } from './store'
import { STATUS_HEX } from './colors'
import { REGION_LABEL } from './labels'
import { ISOLATION } from './config'
import { useFocusedThreat } from './hooks/useFocusedThreat'
import { overlayStyles as s } from './overlayStyles'
import { REGIONS, type RegionDef } from './regions'

// Permanent callouts for warning/critical regions: a thin line from the organ
// to a label (name + score) at a fixed spot left or right of the body.
// Performance: every callout stays mounted and is only shown/hidden, so a scenario
// or layer change creates no new materials, geometries or Html roots.

// Line geometries and materials, created once at module load.
const LINE_GEOMETRY = new Map(
  REGIONS.map((def) => [
    def.id,
    new BufferGeometry().setFromPoints([new Vector3(...def.callout.anchor), new Vector3(...def.callout.label)]),
  ]),
)
const lineMaterial = (status: Status) =>
  // depthTest off: the line stays visible through the translucent shell
  new LineBasicMaterial({ color: STATUS_HEX[status], transparent: true, opacity: 0.8, depthTest: false })
const LINE_MATERIAL: Record<Status, LineBasicMaterial> = {
  ok: lineMaterial('ok'), // never drawn (ok callouts are hidden), keeps the record complete
  warning: lineMaterial('warning'),
  critical: lineMaterial('critical'),
}

const noRaycast = () => null // the line must not catch hover or clicks

function Callout({ def, visible }: { def: RegionDef; visible: boolean }) {
  // Re-renders only when this region's status or score changes.
  const status = useHealthStore((st) => st.regions[def.id].status)
  const score = useHealthStore((st) => st.regions[def.id].score)

  // One Line object per callout, created once on mount.
  const line = useMemo(() => {
    const l = new Line(LINE_GEOMETRY.get(def.id), LINE_MATERIAL.ok)
    l.raycast = noRaycast
    return l
  }, [def.id])

  // One accent at a time: while a threat is focused, callouts of regions outside it step back
  // (label at 20 %, line hidden), so the focused threat's own labels have room.
  const focused = useFocusedThreat()
  const dimmed = useHealthStore((st) => focused !== null && !(st.threats?.[focused].regions.includes(def.id) ?? true))

  const shown = visible && status !== 'ok'
  useLayoutEffect(() => {
    line.material = LINE_MATERIAL[status]
    line.visible = shown && !dimmed
  }, [line, status, shown, dimmed])

  const color = STATUS_HEX[status]
  const side = def.callout.label[0] < 0 ? s.calloutLeft : s.calloutRight

  return (
    <group name={`${def.id}_callout`}>
      <primitive object={line} />
      <Html
        position={def.callout.label}
        style={{
          pointerEvents: 'none',
          display: shown ? 'block' : 'none',
          opacity: dimmed ? ISOLATION.dimmedCallout : 1,
          transition: 'opacity 0.4s ease',
        }}
      >
        <div style={{ ...s.callout, ...side, border: `1px solid ${color}` }}>
          {REGION_LABEL[def.id]}
          <span style={{ ...s.calloutScore, color }}>{Math.round(score)}</span>
        </div>
      </Html>
    </group>
  )
}

// visible = false in skeleton mode: callouts are hidden, not unmounted.
export function Callouts({ visible }: { visible: boolean }) {
  return (
    <group name="callouts">
      {/* Workaround: the first <Html> mounted in the scene never renders its content (seen with
          drei 10 + React 19, dev and production), which left the brain callout empty.
          This empty one takes that slot. */}
      <Html style={{ display: 'none' }} />
      {REGIONS.map((def) => (
        <Callout key={def.id} def={def} visible={visible} />
      ))}
    </group>
  )
}
