import { useLayoutEffect, useMemo } from 'react'
import { Html } from '@react-three/drei'
import { BufferGeometry, Line, LineBasicMaterial, Vector3 } from 'three'
import type { RegionId, RegionState, Status } from '../contract/types'
import { useHealthStore } from './store'
import { STATUS_HEX } from './colors'
import { CALLOUTS } from './config'
import { REGION_LABEL, sceneLabel } from './labels'
import { useFocusedThreat } from './hooks/useFocusedThreat'
import { overlayStyles as s } from './overlayStyles'
import { REGIONS, type RegionDef } from './regions'

// Permanent callouts run sideways out of the silhouette before bending to their labels.
// Performance: every callout stays mounted and is only shown/hidden, so a scenario
// or layer change creates no new materials, geometries or Html roots.

// Line geometries and materials, created once at module load.
const LINE_GEOMETRY = new Map(REGIONS.map(({ id, callout }) => {
  const anchor = new Vector3(...callout.anchor)
  const label = new Vector3(...callout.label)
  const exitY = id === 'lungs' ? 1.158 : anchor.y
  const elbow = new Vector3(label.x * 0.74, exitY, anchor.z)
  const points = id === 'lungs'
    ? [anchor, new Vector3(-0.16, exitY, anchor.z), elbow, label]
    : [anchor, elbow, label]
  return [id, new BufferGeometry().setFromPoints(points)] as const
}))
const lineMaterial = (status: Status) =>
  // depthTest off: the line stays visible through the translucent shell
  new LineBasicMaterial({ color: STATUS_HEX[status], transparent: true, opacity: 0.8, depthTest: false })
const LINE_MATERIAL: Record<Status, LineBasicMaterial> = {
  ok: lineMaterial('ok'), // never drawn (ok callouts are hidden), keeps the record complete
  warning: lineMaterial('warning'),
  critical: lineMaterial('critical'),
}

const noRaycast = () => null // the line must not catch hover or clicks

// Ids of the regions with a permanent callout, as one string (a stable selector result).
function pinnedCallouts(regions: Record<RegionId, RegionState>, eligible?: RegionId[]): string {
  return Object.values(regions)
    .filter(r => r.status !== 'ok' && (!eligible || eligible.includes(r.id)))
    .sort((a, b) => Number(b.status === 'critical') - Number(a.status === 'critical') || a.score - b.score)
    .slice(0, CALLOUTS.maxVisible)
    .map(r => r.id)
    .join(',')
}

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

  // One accent at a time: while a threat is focused or a region is selected, the callouts of
  // the other regions are hidden (label and line), so the accent's own labels have room and
  // nothing floats over dimmed organs.
  const focused = useFocusedThreat()
  const outOfThreat = useHealthStore(
    (st) => st.highlightRegions === null && focused !== null && !(st.threats?.[focused].regions.includes(def.id) ?? true),
  )
  const outOfAlert = useHealthStore((st) => st.highlightRegions !== null && !st.highlightRegions.includes(def.id))
  const otherSelected = useHealthStore((st) => st.selectedRegion !== null && st.selectedRegion !== def.id)

  // A selected or highlighted region always keeps its callout, whatever its priority.
  const pinned = useHealthStore(
    (st) =>
      st.selectedRegion === def.id ||
      pinnedCallouts(st.regions, st.highlightRegions ?? (focused ? st.threats?.[focused].regions : undefined)).split(',').includes(def.id),
  )

  const shown = visible && status !== 'ok' && pinned && !outOfThreat && !outOfAlert && !otherSelected
  useLayoutEffect(() => {
    line.material = LINE_MATERIAL[status]
    line.visible = shown
  }, [line, status, shown])

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
        }}
      >
        <div style={{ ...s.callout, ...side, border: `1px solid ${color}` }}>
          {sceneLabel(REGION_LABEL[def.id])}
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
