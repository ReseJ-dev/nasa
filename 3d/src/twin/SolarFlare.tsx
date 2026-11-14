import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { CapsuleGeometry, Color, Mesh, ShaderMaterial } from 'three'
import { useHealthStore } from './store'
import { useSceneStore } from './sceneStore'
import { SHELTER as S, SOLAR_FLARE } from './config'
import { RADIATION_LABEL } from './labels'
import { overlayStyles as st } from './overlayStyles'

// Solar flare and shelter.
// useSolarFlareWatcher: starts the flare effects only on the transition of activeEvent to 'solar_flare'.
// FlareFlash: 0.5 s white-yellow flash over the whole frame (HTML overlay, outside the Canvas).
// Shelter: translucent violet capsule with fresnel edges around the body while inShelter is true
// (the radiation tracks stop at its wall, see RadiationTracks). Created once, faded in useFrame.

export function useSolarFlareWatcher() {
  const event = useHealthStore((s) => s.activeEvent ?? 'none')
  const triggerFlare = useSceneStore((s) => s.triggerFlare)
  const prev = useRef(event)
  useEffect(() => {
    if (prev.current !== 'solar_flare' && event === 'solar_flare') triggerFlare()
    prev.current = event
  }, [event, triggerFlare])
}

export function FlareFlash() {
  const flareId = useSceneStore((s) => s.flareId)
  const el = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (flareId === 0) return // no flare yet
    el.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: SOLAR_FLARE.flashMs, easing: 'ease-out' })
  }, [flareId])
  return <div ref={el} style={{ ...st.flareFlash, background: SOLAR_FLARE.flashColor }} />
}

const vertex = /* glsl */ `
  varying vec3 vNormalV;
  varying vec3 vViewDir;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormalV = normalize(normalMatrix * normal);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`
const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uRimPower;
  varying vec3 vNormalV;
  varying vec3 vViewDir;
  void main() {
    float rim = pow(1.0 - abs(dot(normalize(vNormalV), normalize(vViewDir))), uRimPower);
    gl_FragColor = vec4(uColor, uOpacity * (0.08 + rim));
  }
`

export function Shelter() {
  const inShelter = useHealthStore((s) => s.inShelter ?? false)
  const goal = useRef(0)
  useLayoutEffect(() => {
    goal.current = inShelter ? S.opacity : 0
  }, [inShelter])

  const mesh = useMemo(() => {
    const m = new Mesh(
      new CapsuleGeometry(S.radius, S.length, 12, 32),
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {
          uColor: { value: new Color(S.color) },
          uOpacity: { value: 0 },
          uRimPower: { value: S.rimPower },
        },
        transparent: true,
        depthWrite: false,
      }),
    )
    m.position.set(...S.center)
    m.raycast = () => null
    m.visible = false
    return m
  }, [])

  useFrame((_, delta) => {
    const u = mesh.material.uniforms.uOpacity
    u.value += (goal.current - u.value) * (1 - Math.exp(-delta * S.lerpSpeed))
    mesh.visible = u.value > 0.005
  })

  return (
    <>
      <primitive object={mesh} />
      {inShelter && (
        <Html position={S.labelPosition} center style={{ pointerEvents: 'none' }}>
          <div style={st.shelterLabel}>{RADIATION_LABEL.shelter}</div>
        </Html>
      )}
    </>
  )
}
