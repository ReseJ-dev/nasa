import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import {
  BufferGeometry,
  Color,
  CylinderGeometry,
  FrontSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  ShaderMaterial,
  Vector3,
} from 'three'
import type { Status } from '../contract/types'
import { useHealthStore } from './store'
import { useThreatEffect } from './hooks/useThreatEffect'
import { STATUS_HEX } from './colors'
import { CABIN_FOG as F, EFFECTS, HABITAT as H, SENSORS, THREAT_ACTIVE_THRESHOLD, THREAT_COLOR, THREAT_LABEL_EMPHASIS, type Layer } from './config'
import { SENSOR_LABEL } from './labels'
import { overlayStyles as s } from './overlayStyles'

// Habitat module around the body.
// - Isolation: wireframe cylinder (rings + ribs). Its radius shrinks and its color gets
//   darker/colder as threats.isolation.level grows.
// - Environment: fog inside the module (co2Level) and three cabin sensors on the wall.
// Each part is scaled by useThreatEffect (full when focused / demo, faint otherwise, off when
// the threat is inactive). Hidden in skeleton mode. Created once; lerped in useFrame.

const noRaycast = () => null
const height = H.yTop - H.yBottom

// 0..1 above the active threshold (0 at the threshold or below).
const aboveThreshold = (level: number) =>
  Math.max(0, (level - THREAT_ACTIVE_THRESHOLD) / (1 - THREAT_ACTIVE_THRESHOLD))

// Rings and ribs of a unit-radius cylinder, as one LineSegments geometry.
function createModuleGeometry() {
  const pts: Vector3[] = []
  for (let r = 0; r < H.rings; r++) {
    const y = H.yBottom + (height * r) / (H.rings - 1)
    for (let i = 0; i < H.segments; i++) {
      const a0 = (i / H.segments) * Math.PI * 2
      const a1 = ((i + 1) / H.segments) * Math.PI * 2
      pts.push(new Vector3(Math.sin(a0), y, Math.cos(a0)), new Vector3(Math.sin(a1), y, Math.cos(a1)))
    }
  }
  for (let i = 0; i < H.ribs; i++) {
    const a = (i / H.ribs) * Math.PI * 2
    pts.push(new Vector3(Math.sin(a), H.yBottom, Math.cos(a)), new Vector3(Math.sin(a), H.yTop, Math.cos(a)))
  }
  return new BufferGeometry().setFromPoints(pts)
}

const fogVertex = /* glsl */ `
  varying vec3 vNormalV;
  varying vec3 vViewDir;
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mv = viewMatrix * world;
    vNormalV = normalize(normalMatrix * normal);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`

const fogFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uNoiseScale;
  varying vec3 vNormalV;
  varying vec3 vViewDir;
  varying vec3 vWorld;

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
    // soft at the cylinder's left/right silhouette, denser where it faces the camera
    float facing = clamp(dot(vNormalV, vViewDir), 0.0, 1.0);
    // two noise layers drifting slowly upward and sideways
    vec3 p = vWorld * uNoiseScale + vec3(uTime * 0.4, -uTime, 0.0);
    float n = 0.6 * noise(p) + 0.4 * noise(p * 2.3 + 5.1);
    float alpha = uOpacity * pow(facing, 0.8) * smoothstep(0.3, 0.9, n);
    gl_FragColor = vec4(uColor, alpha);
  }
`

function createFog() {
  const material = new ShaderMaterial({
    vertexShader: fogVertex,
    fragmentShader: fogFragment,
    uniforms: {
      uColor: { value: new Color(F.lowColor) },
      uOpacity: { value: 0 },
      uTime: { value: 0 },
      uNoiseScale: { value: F.noiseScale },
    },
    transparent: true,
    depthWrite: false,
    side: FrontSide,
  })
  const mesh = new Mesh(new CylinderGeometry(F.radius, F.radius, height, 48, 1, true), material)
  mesh.position.y = H.yBottom + height / 2
  mesh.raycast = noRaycast
  mesh.visible = false
  return mesh
}

function sensorStatus(value: number, t: { warnAt: number; criticalAt: number }): Status {
  if (value >= t.criticalAt) return 'critical'
  if (value >= t.warnAt) return 'warning'
  return 'ok'
}

// One sensor chip on the module wall (inside the scaled group, so it follows the radius).
function Sensor({ angle, y, text, status, opacity }: { angle: number; y: number; text: string; status: Status; opacity: number }) {
  return (
    <Html
      position={[Math.sin(angle), y, Math.cos(angle)]}
      center
      style={{ pointerEvents: 'none', opacity, transition: 'opacity 0.5s', display: opacity > 0 ? 'block' : 'none' }}
    >
      <div style={{ ...s.sensor, borderColor: STATUS_HEX[status], color: STATUS_HEX[status] }}>{text}</div>
    </Html>
  )
}

const lowFog = new Color(F.lowColor)
const highFog = new Color(THREAT_COLOR.environment)
const lowModule = new Color(H.colorLow)
const highModule = new Color(H.colorHigh)

export function Habitat({ layer }: { layer: Layer }) {
  const isolation = useHealthStore((st) => st.threats?.isolation.level ?? 0)
  const co2 = useHealthStore((st) => st.co2Level ?? 0)
  const temp = useHealthStore((st) => st.cabinTempC ?? 0)
  const noise = useHealthStore((st) => st.noiseDb ?? 0)
  const body = layer === 'body'
  // Hooks always run; skeleton mode just zeroes the result.
  const isoEffect = useThreatEffect('isolation')
  const envEffect = useThreatEffect('environment')
  const isoEmphasis = body ? isoEffect : 0
  const envEmphasis = body ? envEffect : 0

  // Goals for useFrame, updated only when inputs change.
  const goal = useRef({ radius: H.radiusMax, iso: 0, moduleOpacity: 0, fogOpacity: 0, fogT: 0 })
  useLayoutEffect(() => {
    const iso = aboveThreshold(isolation)
    const fogT = aboveThreshold(co2)
    goal.current = {
      radius: H.radiusMax + (H.radiusMin - H.radiusMax) * iso,
      iso,
      moduleOpacity: EFFECTS.habitatModule ? H.maxOpacity * isoEmphasis : 0,
      fogOpacity: EFFECTS.cabinFog ? (F.minOpacity + (F.maxOpacity - F.minOpacity) * fogT) * envEmphasis : 0,
      fogT,
    }
  }, [isolation, co2, isoEmphasis, envEmphasis])

  const group = useMemo(() => new Group(), [])
  const lines = useMemo(() => {
    const l = new LineSegments(
      createModuleGeometry(),
      new LineBasicMaterial({ color: H.colorLow, transparent: true, opacity: 0, depthWrite: false }),
    )
    l.raycast = noRaycast
    l.visible = false
    return l
  }, [])
  const fog = useMemo(createFog, [])
  const tint = useMemo(() => new Color(), [])
  const smoothRadius = useRef(H.radiusMax)

  useFrame((_, delta) => {
    const g = goal.current
    const k = 1 - Math.exp(-delta * H.lerpSpeed)
    smoothRadius.current += (g.radius - smoothRadius.current) * k
    group.scale.set(smoothRadius.current, 1, smoothRadius.current)

    const lm = lines.material as LineBasicMaterial
    lm.opacity += (g.moduleOpacity - lm.opacity) * k
    lm.color.lerp(tint.copy(lowModule).lerp(highModule, g.iso), k)
    lines.visible = lm.opacity > 0.005

    const u = (fog.material as ShaderMaterial).uniforms
    u.uOpacity.value += (g.fogOpacity - u.uOpacity.value) * k
    u.uColor.value.lerp(tint.copy(lowFog).lerp(highFog, g.fogT), k)
    fog.visible = u.uOpacity.value > 0.005
    if (fog.visible) u.uTime.value += delta * F.driftSpeed
  })

  // Sensors: text chips, shown only while the environment threat is focused (or demo).
  const sensorOpacity = EFFECTS.cabinSensors && envEmphasis >= THREAT_LABEL_EMPHASIS ? 1 : 0
  return (
    <primitive object={group}>
      <primitive object={lines} />
      <primitive object={fog} />
      <Sensor
        {...SENSORS.co2}
        text={`${SENSOR_LABEL.co2} ${Math.round(co2 * 100)}%`}
        status={sensorStatus(co2, SENSORS.co2)}
        opacity={sensorOpacity}
      />
      <Sensor
        {...SENSORS.temp}
        text={`${Math.round(temp)} ${SENSOR_LABEL.temp}`}
        status={sensorStatus(temp, SENSORS.temp)}
        opacity={sensorOpacity}
      />
      <Sensor
        {...SENSORS.noise}
        text={`${SENSOR_LABEL.noise} ${Math.round(noise)} ${SENSOR_LABEL.noiseUnit}`}
        status={sensorStatus(noise, SENSORS.noise)}
        opacity={sensorOpacity}
      />
    </primitive>
  )
}
