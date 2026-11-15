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

// Permanent callouts: a thin line from the organ to a label (name + score) at a fixed spot left
// or right of the body. Shown for every critical region and for the CALLOUTS.maxWarnings
// highest-priority warnings (lowest score); the other warnings show a label on hover (RegionMesh).
// Performance: every callout stays mounted and is only shown/hidden, so a scenario
// or layer change creates no new materials, geometries or Html roots.

// Line geometries and materials, created once at module load.
const LINE_GEOMETRY = new Map(
  REGIONS.map((def) => [
    def.id,
    new BufferGeometry().setFromPoints([
      new Vector3(...(def.callout.lineStart ?? def.callout.anchor)),
      new Vector3(...def.callout.label),
    ]),
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

// Ids of the regions with a permanent callout, as one string (a stable selector result).
function pinnedCallouts(regions: Record<RegionId, RegionState>): string {
  const all = Object.values(regions)
  const warnings = all
    .filter((r) => r.status === 'warning')
    .sort((a, b) => a.score - b.score)
    .slice(0, CALLOUTS.maxWarnings)
  return [...all.filter((r) => r.status === 'critical'), ...warnings].map((r) => r.id).join(',')
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
      (st.highlightRegions?.includes(def.id) ?? false) ||
      pinnedCallouts(st.regions).split(',').includes(def.id),
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
