import { useMemo, useRef } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { Select } from '@react-three/postprocessing'
import { MeshStandardMaterial, type Group } from 'three'
import { useHealthStore } from './mockStore'
import { STATUS_COLOR } from './colors'
import { LAYERS, REGION, type Layer } from './config'
import { useFadeOpacity } from './hooks/useFadeOpacity'
import { useChainGlow } from './hooks/useChainGlow'
import { useHeartbeat } from './hooks/useHeartbeat'
import { useHover } from './hooks/useHover'
import { useStatusColor } from './hooks/useStatusColor'
import type { RegionDef } from './regions'

// One health region: behavior only (color, pulse, chain, heartbeat, bloom, hover, click). Shapes come from regions.ts.
export function RegionMesh({ def, layer }: { def: RegionDef; layer: Layer }) {
  const status = useHealthStore((s) => s.regions[def.id].status)
  const isSelected = useHealthStore((s) => s.selectedRegion === def.id)
  const selectRegion = useHealthStore((s) => s.selectRegion)
  const { hovered, onPointerOver, onPointerOut } = useHover()

  // One material for all parts of this region, created once.
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: STATUS_COLOR.ok.clone(),
        emissive: STATUS_COLOR.ok.clone(),
        emissiveIntensity: REGION.emissive.base,
        roughness: REGION.roughness,
        transparent: false, // useFadeOpacity turns it on when organs are dimmed
        opacity: LAYERS.body.organs,
      }),
    [],
  )
  useFadeOpacity(material, LAYERS[layer].organs)

  const glow = hovered ? REGION.emissive.hover : isSelected ? REGION.emissive.selected : REGION.emissive.base
  // Must run before useStatusColor so its value is fresh in the same frame.
  const chainGlow = useChainGlow(def.id)
  useStatusColor(material, status, glow, chainGlow)

  // Wrapper group of every part, used by the heartbeat.
  const partRefs = useRef<(Group | null)[]>([])
  useHeartbeat(partRefs, def.heartbeat === true)

  // Bloom only unhealthy organs, and only in body mode (in skeleton mode organs are dimmed).
  const bloom = status !== 'ok' && layer === 'body'

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation() // do not also select an organ behind this one
    selectRegion(def.id)
  }

  return (
    <group name={def.id} onPointerOver={onPointerOver} onPointerOut={onPointerOut} onClick={onClick}>
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
            <mesh geometry={part.geometry} material={material} rotation={part.rotation} scale={part.scale} />
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
            {def.label}
          </div>
        </Html>
      )}
    </group>
  )
}
