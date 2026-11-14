import { useMemo } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { MeshStandardMaterial } from 'three'
import { useHealthStore } from './mockStore'
import { STATUS_COLOR } from './colors'
import { REGION } from './config'
import { useHover } from './hooks/useHover'
import { useStatusColor } from './hooks/useStatusColor'
import type { RegionDef } from './regions'

// One health region: behavior only (color, hover, click). Shapes come from regions.ts.
export function RegionMesh({ def }: { def: RegionDef }) {
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
      }),
    [],
  )

  const glow = hovered ? REGION.emissive.hover : isSelected ? REGION.emissive.selected : REGION.emissive.base
  useStatusColor(material, status, glow)

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation() // do not also select an organ behind this one
    selectRegion(def.id)
  }

  return (
    <group name={def.id} onPointerOver={onPointerOver} onPointerOut={onPointerOut} onClick={onClick}>
      {def.parts.map((part, i) => (
        <mesh
          key={i}
          geometry={part.geometry}
          material={material}
          position={part.position}
          rotation={part.rotation}
          scale={part.scale}
        />
      ))}
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
