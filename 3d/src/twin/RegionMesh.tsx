import { useMemo, useRef } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { Select } from '@react-three/postprocessing'
import { MeshStandardMaterial, type Group, type Mesh } from 'three'
import { useHealthStore } from './store'
import { STATUS_COLOR } from './colors'
import { HIDDEN_IN_SKELETON, LAYERS, REGION, type Layer } from './config'
import { REGION_LABEL } from './labels'
import { useFadeOpacity } from './hooks/useFadeOpacity'
import { useChainGlow } from './hooks/useChainGlow'
import { useHeartbeat } from './hooks/useHeartbeat'
import { useHover } from './hooks/useHover'
import { useStatusColor } from './hooks/useStatusColor'
import { useSansGlow } from './hooks/useSansGlow'
import { useMuscleMass } from './hooks/useMuscleMass'
import { SHIMMER_COLOR, useRadiationShimmer } from './hooks/useRadiationShimmer'
import type { RegionDef } from './regions'
import type { RegionId } from '../contract/types'

// One health region: behavior only (color, pulse, chain, heartbeat, bloom, hover, click). Shapes come from regions.ts.
// focus: regions highlighted by a threat in the strip (null = none). Regions outside it dim.
export function RegionMesh({ def, layer, focus }: { def: RegionDef; layer: Layer; focus: RegionId[] | null }) {
  const status = useHealthStore((s) => s.regions[def.id].status)
  const isSelected = useHealthStore((s) => s.selectedRegion === def.id)
  // Another region is selected: this one dims so the selected one stands out.
  const otherSelected = useHealthStore((s) => s.selectedRegion !== null && s.selectedRegion !== def.id)
  const inFocus = focus?.includes(def.id) ?? false
  const outOfThreat = focus !== null && !inFocus
  const selectRegion = useHealthStore((s) => s.selectRegion)
  // Only the body layer is interactive: in skeleton mode organs cannot be hovered or clicked.
  const interactive = layer === 'body'
  const { hovered, onPointerOver, onPointerOut } = useHover(interactive)

  // One material for all parts of this region, created once.
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: STATUS_COLOR.ok.clone(),
        emissive: STATUS_COLOR.ok.clone(),
        emissiveIntensity: REGION.emissive.base.ok,
        roughness: REGION.roughness,
        transparent: false, // useFadeOpacity turns it on when organs are dimmed
        opacity: LAYERS.body.organs,
      }),
    [],
  )
  const hidden = layer === 'skeleton' && HIDDEN_IN_SKELETON.includes(def.id)
  useFadeOpacity(material, hidden ? 0 : LAYERS[layer].organs)

  const glow = hovered
    ? REGION.emissive.hover
    : isSelected || inFocus
      ? REGION.emissive.selected
      : REGION.emissive.base[status]
  // Must run before useStatusColor so its value is fresh in the same frame.
  const chainGlow = useChainGlow(def.id)
  const shimmer = useRadiationShimmer(def.id)
  const sansGlow = useSansGlow(def.id, layer)
  // Selection dim wins (darker) over the threat dim.
  const brightness = otherSelected ? REGION.dimmedBrightness : outOfThreat ? REGION.threatDimmedBrightness : 1
  useStatusColor(material, status, glow, [chainGlow, sansGlow], brightness, { color: SHIMMER_COLOR, amount: shimmer })

  // Wrapper group of every part, used by the heartbeat.
  const partRefs = useRef<(Group | null)[]>([])
  useHeartbeat(partRefs, def.heartbeat === true)
  // Leg muscle meshes (thighs, calves): thinner with lower muscleMass.
  const thinRefs = useRef<(Mesh | null)[]>([])
  useMuscleMass(thinRefs, def.parts.some((p) => p.thin))

  // Bloom only unhealthy organs, and only in body mode (in skeleton mode organs are dimmed).
  const bloom = status !== 'ok' && layer === 'body'

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation() // do not also select an organ behind this one
    selectRegion(def.id)
  }

  return (
    <group
      name={def.id}
      onPointerOver={interactive ? onPointerOver : undefined}
      onPointerOut={interactive ? onPointerOut : undefined}
      onClick={interactive ? onClick : undefined}
    >
      <Select enabled={bloom}>
        {def.parts.map((part, i) => (
          // The wrapper group sits at the part's center, so scaling it (heartbeat) keeps the part in place.
          <group
            key={i}
            position={part.position}
            ref={(g) => {
              partRefs.current[i] = g
            }}
          >
            <mesh
              geometry={part.geometry}
              material={material}
              rotation={part.rotation}
              scale={part.scale}
              ref={(m) => {
                if (part.thin) thinRefs.current[i] = m
              }}
            />
          </group>
        ))}
      </Select>
      {hovered && (
        <Html position={def.labelPosition} center style={{ pointerEvents: 'none' }}>
          <div
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              background: 'rgba(10, 14, 24, 0.85)',
              color: '#fff',
              font: '13px system-ui, sans-serif',
              whiteSpace: 'nowrap',
            }}
          >
            {REGION_LABEL[def.id]}
          </div>
        </Html>
      )}
    </group>
  )
}
