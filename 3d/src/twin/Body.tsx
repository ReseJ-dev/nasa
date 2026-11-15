import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  Color,
  FrontSide,
  type Group,
  type Mesh,
  MeshStandardMaterial,
  NotEqualStencilFunc,
  ReplaceStencilOp,
} from 'three'
import { ACTIVITY, BODY_SHELL, EFFECTS, FLUID_SHIFT, LAYERS, type Layer } from './config'
import { SHELL_GEOMETRY, SHELL_PARTS } from './bodyShape'
import { useAlertStatus } from './isolationStage'
import { useHealthStore } from './store'
import { useThreatEffect } from './hooks/useThreatEffect'
import { useFadeOpacity } from './hooks/useFadeOpacity'

// Translucent body shell: one smooth blended surface (geometry in bodyShape.ts). No organs here.
// Units are roughly meters: feet at y = 0, top of head at y ≈ 1.8.
//
// Look: fresnel. A standard material with a small shader patch (onBeforeCompile):
// facing the camera = almost clear, grazing the silhouette = opaque cyan glow.
// material.opacity still scales everything, so useFadeOpacity and the layer fade work as before.
//
// Overlaps: an arm in front of the torso must not add a second glowing layer.
// Each shell pixel is drawn only once (stencil), front-most part first (custom sort),
// so the surface behind is skipped. No depth is written: SelectiveBloom compares
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
  // Fluid shift strength, lerped by Body in useFrame (shared with the compiled shader).
  const fluid = { value: 0 }
  material.userData.fluid = fluid
  // Rim glow strength, lowered by Body while the activity alert is on (hypokinesis).
  const rim = { value: BODY_SHELL.rimIntensity }
  material.userData.rim = rim
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFluid = fluid
    shader.uniforms.uFluidColor = { value: new Color(FLUID_SHIFT.headColor) }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n        varying float vFluidY;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vFluidY = (modelMatrix * vec4(transformed, 1.0)).y; // world height`,
      )
    shader.uniforms.uRimColor = { value: new Color(BODY_SHELL.rimColor) }
    shader.uniforms.uRimPower = { value: BODY_SHELL.rimPower }
    shader.uniforms.uRimIntensity = rim
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
        uniform float uEdgeAlpha;
        uniform float uFluid;
        uniform vec3 uFluidColor;
        varying float vFluidY;`,
      )
      .replace(
        '#include <opaque_fragment>',
        `// 0 where the surface faces the camera, 1 at the silhouette edge
        float fresnel = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), uRimPower);
        outgoingLight = mix(outgoingLight, uRimColor * uRimIntensity, fresnel);
        diffuseColor.a = clamp(diffuseColor.a * mix(uCenterAlpha, uEdgeAlpha, fresnel), 0.0, 1.0);
        // fluid shift: tint grows from the feet to the head
        float fluidH = smoothstep(${FLUID_SHIFT.feetY.toFixed(2)}, ${FLUID_SHIFT.headY.toFixed(2)}, vFluidY);
        float fluidK = uFluid * fluidH * ${FLUID_SHIFT.strength.toFixed(2)};
        outgoingLight = mix(outgoingLight, uFluidColor * (0.6 + fresnel), fluidK);
        diffuseColor.a = clamp(diffuseColor.a + fluidK * 0.12, 0.0, 1.0);
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
  return a.id - b.id // ties: earlier part wins
}

export function Body({ layer }: { layer: Layer }) {
  // One shared material for every body part, created once (not on every render).
  const material = useMemo(createShellMaterial, [])
  useFadeOpacity(material, LAYERS[layer].shell)

  // Fluid shift tint: body mode only, scaled by the gravity threat's strength.
  const fluidShift = useHealthStore((s) => s.fluidShift ?? 0)
  const gravityEffect = useThreatEffect('gravity')
  const fluidGoal = useRef(0)
  useLayoutEffect(() => {
    fluidGoal.current = EFFECTS.fluidShift && layer === 'body' ? fluidShift * gravityEffect : 0
  }, [layer, fluidShift, gravityEffect])
  // Hypokinesis: the shell glows a little less while the engine reports an activity alert.
  const lowActivity = useAlertStatus('activity') !== 'ok'
  const rimGoal = useRef(BODY_SHELL.rimIntensity)
  useLayoutEffect(() => {
    rimGoal.current = BODY_SHELL.rimIntensity * (EFFECTS.hypokinesis && lowActivity ? ACTIVITY.shellGlowDrop : 1)
  }, [lowActivity])
  const rimBase = useRef(BODY_SHELL.rimIntensity)
  useFrame(({ clock }, delta) => {
    const k = 1 - Math.exp(-delta * FLUID_SHIFT.lerpSpeed)
    const u = material.userData.fluid as { value: number }
    u.value += (fluidGoal.current - u.value) * k
    // Edge glow: follows its goal, with the slow breathing wave on top.
    rimBase.current += (rimGoal.current - rimBase.current) * k
    const breath = Math.sin((clock.elapsedTime / BODY_SHELL.breathSeconds) * Math.PI * 2)
    const rim = material.userData.rim as { value: number }
    rim.value = rimBase.current * (1 + BODY_SHELL.breathAmount * breath)
  })

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
      {/* One smooth surface, cut into parts only for the draw order (see bodyShape.ts). */}
      {SHELL_PARTS.map((id) => (
        <mesh key={id} geometry={SHELL_GEOMETRY[id]} material={material} />
      ))}
    </group>
  )
}
