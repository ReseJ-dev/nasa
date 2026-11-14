import { useMemo } from 'react'
import { MeshPhysicalMaterial, FrontSide } from 'three'
import { BODY_SHELL, LAYERS, type Layer } from './config'
import { useFadeOpacity } from './hooks/useFadeOpacity'

// Translucent body shell built from primitives. No organs here.
// Units are roughly meters: feet at y = 0, top of head at y ≈ 1.8.
export function Body({ layer }: { layer: Layer }) {
  // One shared material for every body part, created once (not on every render).
  const material = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: BODY_SHELL.color,
        transparent: true,
        opacity: LAYERS.body.shell,
        roughness: BODY_SHELL.roughness,
        metalness: 0,
        clearcoat: BODY_SHELL.clearcoat,
        clearcoatRoughness: BODY_SHELL.clearcoatRoughness,
        side: FrontSide,
        depthWrite: false, // lets organs inside stay visible through the shell
      }),
    [],
  )
  useFadeOpacity(material, LAYERS[layer].shell)

  return (
    <group name="body">
      {/* Head */}
      <mesh position={[0, 1.66, 0]} scale={[1, 1.15, 1.05]} material={material}>
        <sphereGeometry args={[0.12, 32, 24]} />
      </mesh>

      {/* Neck */}
      <mesh position={[0, 1.5, 0]} material={material}>
        <cylinderGeometry args={[0.05, 0.055, 0.12, 20]} />
      </mesh>

      {/* Torso (chest + belly), flattened front-to-back */}
      <mesh position={[0, 1.22, 0]} scale={[1.15, 1, 0.65]} material={material}>
        <capsuleGeometry args={[0.17, 0.4, 8, 24]} />
      </mesh>

      {/* Pelvis */}
      <mesh position={[0, 0.92, 0]} scale={[1.1, 0.7, 0.75]} material={material}>
        <sphereGeometry args={[0.17, 32, 20]} />
      </mesh>

      {/* Arms: each group pivots at the shoulder */}
      {[-1, 1].map((side) => (
        <group key={`arm${side}`} position={[side * 0.24, 1.45, 0]} rotation={[0, 0, side * 0.12]}>
          <mesh position={[0, -0.16, 0]} material={material}>
            <capsuleGeometry args={[0.045, 0.26, 6, 16]} />
          </mesh>
          <mesh position={[0, -0.45, 0]} material={material}>
            <capsuleGeometry args={[0.04, 0.24, 6, 16]} />
          </mesh>
          <mesh position={[0, -0.63, 0]} scale={[0.8, 1.2, 0.5]} material={material}>
            <sphereGeometry args={[0.05, 16, 12]} />
          </mesh>
        </group>
      ))}

      {/* Legs: each group pivots at the hip */}
      {[-1, 1].map((side) => (
        <group key={`leg${side}`} position={[side * 0.09, 0.9, 0]}>
          <mesh position={[0, -0.22, 0]} material={material}>
            <capsuleGeometry args={[0.07, 0.32, 6, 16]} />
          </mesh>
          <mesh position={[0, -0.62, 0]} material={material}>
            <capsuleGeometry args={[0.055, 0.32, 6, 16]} />
          </mesh>
          <mesh position={[0, -0.86, 0.05]} rotation={[Math.PI / 2, 0, 0]} material={material}>
            <capsuleGeometry args={[0.04, 0.12, 6, 12]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
