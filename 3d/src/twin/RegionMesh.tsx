import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { Select } from '@react-three/postprocessing'
import { MeshStandardMaterial, type Group, type Mesh } from 'three'
import { useHealthStore } from './store'
import { STATUS_COLOR, STATUS_HEX } from './colors'
import { EFFECTS, HIDDEN_IN_SKELETON, LAYERS, REGION, type Layer } from './config'
import { NO_DATA_LABEL, REGION_LABEL, STATUS_LABEL, sceneLabel } from './labels'
import { overlayStyles as overlay } from './overlayStyles'
import { useFadeOpacity } from './hooks/useFadeOpacity'
import { useChainGlow } from './hooks/useChainGlow'
import { useHeartbeat } from './hooks/useHeartbeat'
import { useHover } from './hooks/useHover'
import { useStatusColor } from './hooks/useStatusColor'
import { useSansGlow } from './hooks/useSansGlow'
import { useIsolationGlow } from './hooks/useIsolationGlow'
import { useMuscleMass } from './hooks/useMuscleMass'
import { SHIMMER_COLOR, useRadiationShimmer } from './hooks/useRadiationShimmer'
import type { RegionDef } from './regions'
import type { RegionId } from '../contract/types'

// Organ material: the usual lit material plus a soft edge. The middle of the organ is shaded
// darker and the outline lighter (fresnel), so an organ reads as a soft volume inside the body,
// not as a flat-colored lump with a hard edge. The status color and glow are untouched:
// useStatusColor still drives `color`, `emissive` and `emissiveIntensity`.
function createOrganMaterial() {
  const material = new MeshStandardMaterial({
    color: STATUS_COLOR.ok.clone(),
    emissive: STATUS_COLOR.ok.clone(),
    emissiveIntensity: REGION.emissive.base.ok,
    roughness: REGION.roughness,
    transparent: false, // useFadeOpacity turns it on when organs are dimmed
    opacity: LAYERS.body.organs,
  })
  const e = REGION.edge
  // Outline glow of the selected organ (0 = off), in the emissive (status) color.
  const rim = { value: 0 }
  material.userData.rim = rim
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRim = rim
    shader.fragmentShader = 'uniform float uRim;\n' + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `// 0 where the surface faces the camera, 1 at the organ's outline
      float organEdge = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), ${e.power.toFixed(2)});
      outgoingLight = (totalDiffuse + totalSpecular) * mix(${e.litCenter.toFixed(2)}, ${e.litEdge.toFixed(2)}, organEdge)
        + totalEmissiveRadiance * mix(${e.glowCenter.toFixed(2)}, ${e.glowEdge.toFixed(2)}, organEdge)
        + emissive * uRim * pow(organEdge, 1.6);
      #include <opaque_fragment>`,
    )
  }
  return material
}

// One health region: behavior only (color, pulse, chain, heartbeat, bloom, hover, click). Shapes come from regions.ts.
// focus: regions highlighted by a threat in the strip (null = none). Regions outside it dim.
export function RegionMesh({ def, layer, focus }: { def: RegionDef; layer: Layer; focus: RegionId[] | null }) {
  const status = useHealthStore((s) => s.regions[def.id].status)
  const score = useHealthStore((s) => s.regions[def.id].score)
  const noData = useHealthStore((s) => s.regions[def.id].noData ?? false)
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
  const material = useMemo(createOrganMaterial, [])
  const hidden = layer === 'skeleton' && HIDDEN_IN_SKELETON.includes(def.id)
  // Another region selected: this one fades to REGION.dimmedOpacity, so the selected one stands out.
  useFadeOpacity(material, hidden ? 0 : otherSelected ? Math.min(REGION.dimmedOpacity, LAYERS[layer].organs) : LAYERS[layer].organs)
  // Selected: a clear outline glow in its status color (eased in and out).
  const rimGoal = useRef(0)
  useLayoutEffect(() => {
    rimGoal.current = isSelected ? REGION.selectedRim : 0
  }, [isSelected])
  useFrame((_, delta) => {
    const rim = material.userData.rim as { value: number }
    rim.value += (rimGoal.current - rim.value) * (1 - Math.exp(-delta * REGION.lerpSpeed))
  })

  const glow = hovered
    ? REGION.emissive.hover
    : isSelected || inFocus
      ? REGION.emissive.selected
      : REGION.emissive.base[status]
  // Must run before useStatusColor so its value is fresh in the same frame.
  const chainGlow = useChainGlow(def.id)
  const shimmer = useRadiationShimmer(def.id)
  const sansGlow = useSansGlow(def.id, layer)
  const isolationGlow = useIsolationGlow(def.id)
  // Selection dim wins (darker) over the threat dim.
  const brightness = otherSelected ? REGION.dimmedBrightness : outOfThreat ? REGION.threatDimmedBrightness : 1
  useStatusColor(material, status, glow, [chainGlow, sansGlow, isolationGlow], brightness, { color: SHIMMER_COLOR, amount: shimmer })

  // Wrapper group of every part, used by the heartbeat.
  const partRefs = useRef<(Group | null)[]>([])
  useHeartbeat(partRefs, def.heartbeat === true)
  // Leg muscle meshes (thighs, calves): thinner with lower muscleMass.
  const thinRefs = useRef<(Mesh | null)[]>([])
  useMuscleMass(thinRefs, EFFECTS.muscleMass && def.parts.some((p) => p.thin))

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
          {/* Hover: a small tooltip only (name, status, score); the panel opens on click. */}
          <div style={{ ...overlay.callout, border: `1px solid ${STATUS_HEX[status]}` }}>
            {sceneLabel(REGION_LABEL[def.id])}
            <span style={{ color: STATUS_HEX[status] }}>{noData ? NO_DATA_LABEL : STATUS_LABEL[status]}</span>
            {!noData && <span style={{ ...overlay.calloutScore, color: STATUS_HEX[status] }}>{Math.round(score)}</span>}
          </div>
        </Html>
      )}
    </group>
  )
}
