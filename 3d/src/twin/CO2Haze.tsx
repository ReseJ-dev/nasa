import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, FrontSide, Mesh, ShaderMaterial, SphereGeometry } from 'three'
import { useHealthStore } from './store'
import { useThreatEffect } from './hooks/useThreatEffect'
import { CO2_HAZE as H, THREAT_ACTIVE_THRESHOLD, THREAT_COLOR, type Layer } from './config'

// Closed-environment threat: a soft, slowly drifting haze around the head.
// One sphere with a small noise shader, created once. co2Level sets opacity and tint:
// invisible below THREAT_ACTIVE_THRESHOLD, denser and more grey-orange as it rises.
// Scaled by useThreatEffect('environment'): faint unless focused or in demo.
// Visible in body mode only. Values are lerped in useFrame, no setState per frame.

const vertexShader = /* glsl */ `
  varying vec3 vNormalV;
  varying vec3 vViewDir;
  varying vec3 vLocal;
  void main() {
    vLocal = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormalV = normalize(normalMatrix * normal);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uNoiseScale;
  varying vec3 vNormalV;
  varying vec3 vViewDir;
  varying vec3 vLocal;

  // cheap 3D value noise
  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }

  void main() {
    // 1 where the sphere faces the camera, 0 at its silhouette: soft round edges
    float facing = clamp(dot(vNormalV, vViewDir), 0.0, 1.0);
    float body = pow(facing, 1.5);
    // two noise layers drifting slowly upward, like warm air
    vec3 p = vLocal * uNoiseScale + vec3(0.0, -uTime, uTime * 0.3);
    float n = 0.6 * noise(p) + 0.4 * noise(p * 2.1 + 3.7);
    float alpha = uOpacity * body * smoothstep(0.25, 0.85, n);
    gl_FragColor = vec4(uColor, alpha);
  }
`

const lowColor = new Color(H.lowColor)
const highColor = new Color(THREAT_COLOR.environment)

export function CO2Haze({ layer }: { layer: Layer }) {
  // Re-renders only when the number changes.
  const co2 = useHealthStore((s) => s.co2Level ?? 0)
  // 0 = environment threat not active, faint when not focused, 1 when focused or in demo.
  const emphasis = useThreatEffect('environment')

  // Goal values for useFrame, updated only when inputs change.
  const goal = useRef({ opacity: 0, t: 0 })
  useLayoutEffect(() => {
    const active = layer === 'body' && co2 >= THREAT_ACTIVE_THRESHOLD
    const t = active ? (co2 - THREAT_ACTIVE_THRESHOLD) / (1 - THREAT_ACTIVE_THRESHOLD) : 0 // 0..1 above the threshold
    const opacity = active ? (H.minOpacity + (H.maxOpacity - H.minOpacity) * t) * emphasis : 0
    goal.current = { opacity, t }
  }, [co2, layer, emphasis])

  const mesh = useMemo(() => {
    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uColor: { value: lowColor.clone() },
        uOpacity: { value: 0 },
        uTime: { value: 0 },
        uNoiseScale: { value: H.noiseScale },
      },
      transparent: true,
      depthWrite: false,
      side: FrontSide,
    })
    const m = new Mesh(new SphereGeometry(H.radius, 32, 24), material)
    m.position.set(...H.center)
    m.raycast = () => null // never catches hover or clicks
    m.visible = false
    return m
  }, [])

  const tint = useMemo(() => new Color(), [])
  useFrame((_, delta) => {
    const u = (mesh.material as ShaderMaterial).uniforms
    const k = 1 - Math.exp(-delta * H.lerpSpeed)
    u.uOpacity.value += (goal.current.opacity - u.uOpacity.value) * k
    tint.copy(lowColor).lerp(highColor, goal.current.t)
    u.uColor.value.lerp(tint, k)
    mesh.visible = u.uOpacity.value > 0.005
    if (mesh.visible) u.uTime.value += delta * H.driftSpeed
  })

  return <primitive object={mesh} />
}
