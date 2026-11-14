import { useLayoutEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import {
  Color,
  FrontSide,
  type Group,
  type Mesh,
  MeshStandardMaterial,
  NotEqualStencilFunc,
  ReplaceStencilOp,
} from 'three'
import { BODY_SHELL, LAYERS, type Layer } from './config'
import { useFadeOpacity } from './hooks/useFadeOpacity'

// Translucent body shell built from primitives. No organs here.
// Units are roughly meters: feet at y = 0, top of head at y ≈ 1.8.
//
// Look: fresnel. A standard material with a small shader patch (onBeforeCompile):
// facing the camera = almost clear, grazing the silhouette = opaque cyan glow.
// material.opacity still scales everything, so useFadeOpacity and the layer fade work as before.
//
// Seams: primitives overlap, and the edge of one part inside another would glow as a line.
// Each shell pixel is drawn only once (stencil), front-most part first (custom sort),
// so hidden inner edges are skipped. No depth is written: SelectiveBloom compares
// organ depth with scene depth, and a depth-writing shell would switch their bloom off.

function createShellMaterial() {
  const material = new MeshStandardMaterial({
    color: BODY_SHELL.color,
    roughness: BODY_SHELL.roughness,
    metalness: 0,
    transparent: true,
    opacity: LAYERS.body.shell,
    side: FrontSide,
    depthWrite: false, // organs inside stay visible and keep their bloom
    // Stencil: draw a pixel only if no shell part has drawn it yet this frame.
    stencilWrite: true,
    stencilRef: 1,
    stencilFunc: NotEqualStencilFunc,
    stencilZPass: ReplaceStencilOp,
  })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = { value: new Color(BODY_SHELL.rimColor) }
    shader.uniforms.uRimPower = { value: BODY_SHELL.rimPower }
    shader.uniforms.uRimIntensity = { value: BODY_SHELL.rimIntensity }
    shader.uniforms.uCenterAlpha = { value: BODY_SHELL.centerAlpha }
    shader.uniforms.uEdgeAlpha = { value: BODY_SHELL.edgeAlpha }
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uRimColor;
        uniform float uRimPower;
        uniform float uRimIntensity;
        uniform float uCenterAlpha;
        uniform float uEdgeAlpha;`,
      )
      .replace(
        '#include <opaque_fragment>',
        `// 0 where the surface faces the camera, 1 at the silhouette edge
        float fresnel = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), uRimPower);
        outgoingLight = mix(outgoingLight, uRimColor * uRimIntensity, fresnel);
        diffuseColor.a = clamp(diffuseColor.a * mix(uCenterAlpha, uEdgeAlpha, fresnel), 0.0, 1.0);
        #include <opaque_fragment>`,
      )
  }
  return material
}

// Transparent objects are normally drawn back to front. For the shell (and only the shell)
// draw front to back, so with the stencil the front-most part wins each pixel.
// Everything else keeps three.js's default order (same rules as its reversePainterSortStable).
type RenderItem = {
  id: number
  groupOrder: number
  renderOrder: number
  z: number
}
function transparentSort(a: RenderItem, b: RenderItem) {
  if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder
  if (a.renderOrder !== b.renderOrder) return a.renderOrder - b.renderOrder
  if (a.z !== b.z) return a.renderOrder === BODY_SHELL.renderOrder ? a.z - b.z : b.z - a.z
  return a.id - b.id // ties (e.g. front view): earlier part wins, torso before the limbs
}

export function Body({ layer }: { layer: Layer }) {
  // One shared material for every body part, created once (not on every render).
  const material = useMemo(createShellMaterial, [])
  useFadeOpacity(material, LAYERS[layer].shell)

  const gl = useThree((s) => s.gl)
  useLayoutEffect(() => {
    gl.setTransparentSort(transparentSort)
    return () => gl.setTransparentSort(null) // back to the default sort
  }, [gl])

  // Shell parts are drawn after organs and bones (they are transparent too when dimmed).
  const group = useRef<Group>(null)
  useLayoutEffect(() => {
    group.current?.traverse((o) => {
      if ((o as Mesh).isMesh) o.renderOrder = BODY_SHELL.renderOrder
    })
  }, [])

  return (
    <group name="body" ref={group}>
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
