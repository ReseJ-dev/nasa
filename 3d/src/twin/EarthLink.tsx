import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, Hud, Line, OrthographicCamera } from '@react-three/drei'
import {
  Color,
  type Camera,
  Group,
  Mesh,
  MeshBasicMaterial,
  MultiplyBlending,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
  type Texture,
  TextureLoader,
  Vector3,
} from 'three'
import type { Line2 } from 'three-stdlib'
import { useHealthStore } from './store'
import { useThreatEffect } from './hooks/useThreatEffect'
import { EARTH_LINK as E } from './config'
import { EARTH_LABEL } from './labels'
import { overlayStyles as s } from './overlayStyles'

// Distance from Earth threat.
// A small Earth in the top-right corner, drawn in a drei <Hud> (its own scene and pixel camera,
// rendered after the main frame), so it never covers the body. A dashed line runs from Earth
// to the body with a packet travelling along it (travel time from commDelaySec).
// earthLink = false: the line breaks in the middle and turns red, Earth dims, a label
// "Autonomous mode" appears above the body (fixed screen spot under the threats strip) and the whole frame gets slightly colder.
// Strength: full when the distance threat is focused (or demo) or the link is down; faint otherwise.
// Everything is created once and updated in useFrame (no React state per frame).

const UNIT_LINE: [number, number, number][] = [
  [0, 0, 0],
  [1, 0, 0],
]

const earthVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const earthFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uHasMap;
  uniform vec3 uOcean;
  uniform vec3 uLand;
  uniform vec3 uAtmosphere;
  uniform float uBrightness;
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec2 vUv;
  void main() {
    // plain fallback: ocean with a few soft "continents" from the uv
    float land = smoothstep(0.55, 0.6, 0.5 + 0.5 * sin(vUv.x * 18.0) * sin(vUv.y * 9.0 + 1.3));
    vec3 base = mix(mix(uOcean, uLand, land * 0.7), texture2D(uMap, vUv).rgb, uHasMap);
    vec3 n = normalize(vNormal);
    float light = clamp(dot(n, normalize(vec3(-0.6, 0.5, 0.6))), 0.0, 1.0) * 0.85 + 0.15;
    float rim = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.5); // ortho camera looks along -z
    vec3 color = base * light + uAtmosphere * rim * 1.2;
    gl_FragColor = vec4(color * uBrightness, uOpacity);
  }
`

function createEarth() {
  const material = new ShaderMaterial({
    vertexShader: earthVertex,
    fragmentShader: earthFragment,
    uniforms: {
      uMap: { value: null as Texture | null },
      uHasMap: { value: 0 },
      uOcean: { value: new Color(E.oceanColor) },
      uLand: { value: new Color(E.landColor) },
      uAtmosphere: { value: new Color(E.atmosphereColor) },
      uBrightness: { value: 1 },
      uOpacity: { value: 0 },
    },
    transparent: true,
  })
  const mesh = new Mesh(new SphereGeometry(1, 32, 24), material)
  mesh.rotation.set(0.35, -0.6, 0) // tilt, so the "continents" are not straight bands
  mesh.raycast = () => null
  return mesh
}

// Places a unit line (0,0)->(1,0) between two screen points and keeps dashes in pixels.
function placeSegment(group: Group, line: Line2 | null, ax: number, ay: number, bx: number, by: number, offset: number) {
  const dx = bx - ax
  const dy = by - ay
  const len = Math.max(Math.hypot(dx, dy), 0.001)
  group.position.set(ax, ay, 0)
  group.rotation.z = Math.atan2(dy, dx)
  group.scale.set(len, 1, 1)
  if (line) {
    const m = line.material
    m.dashSize = E.dashSize / len
    m.gapSize = E.gapSize / len
    m.dashOffset = -offset / len
  }
}

function EarthHudScene({ mainCamera }: { mainCamera: Camera }) {
  const size = useThree((st) => st.size)
  const missionDay = useHealthStore((st) => st.missionDay ?? 0)
  const delay = useHealthStore((st) => st.commDelaySec ?? 0)
  const link = useHealthStore((st) => st.earthLink ?? true)
  // Threat rule (useThreatEffect): hidden below the threshold, faint unless focused / demo.
  // A lost link always shows at full strength.
  const effect = useThreatEffect('distance')
  const strength = !link ? 1 : effect

  // Goals for useFrame, updated only when inputs change.
  const goal = useRef({ far: 0, strength, broken: 0, travel: 1 })
  useLayoutEffect(() => {
    goal.current = {
      far: Math.min(missionDay / E.dayFar, 1),
      strength,
      broken: link ? 0 : 1,
      travel: Math.min(Math.max(delay * E.packetSecondsPerSec, E.packetMinSeconds), E.packetMaxSeconds),
    }
  }, [missionDay, delay, link, strength])

  const earth = useMemo(createEarth, [])
  // Optional texture from public/; on any error the plain blue Earth stays.
  useEffect(() => {
    new TextureLoader().load(
      E.texture,
      (tex) => {
        const u = earth.material.uniforms
        u.uMap.value = tex
        u.uHasMap.value = 1
      },
      undefined,
      () => {}, // missing file: keep the fallback
    )
  }, [earth])

  const packet = useMemo(() => {
    const m = new Mesh(
      new SphereGeometry(1, 12, 8),
      new MeshBasicMaterial({ color: '#ffffff', transparent: true, toneMapped: false }),
    )
    m.raycast = () => null
    return m
  }, [])
  const tint = useMemo(() => {
    const m = new Mesh(
      new PlaneGeometry(1, 1),
      new MeshBasicMaterial({
        color: '#ffffff',
        blending: MultiplyBlending,
        premultipliedAlpha: true, // required by MultiplyBlending
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    )
    m.renderOrder = -1 // first in the Hud: tints the main frame, not the Earth
    m.raycast = () => null
    m.visible = false
    return m
  }, [])

  const segA = useRef<Group>(null)
  const segB = useRef<Group>(null)
  const lineA = useRef<Line2>(null)
  const lineB = useRef<Line2>(null)
  const label = useRef<Group>(null)
  const labelEl = useRef<HTMLDivElement>(null)
  const autonomy = useRef<Group>(null)

  const smooth = useRef({ far: 0, strength: 0, broken: 0, packet: 0, offset: 0 })
  const v = useMemo(() => new Vector3(), [])
  const lineColor = useMemo(() => new Color(), [])
  const okColor = useMemo(() => new Color(E.color), [])
  const redColor = useMemo(() => new Color(E.brokenColor), [])
  const white = useMemo(() => new Color('#ffffff'), [])
  const cold = useMemo(() => new Color(E.coldTint), [])

  useFrame((_, delta) => {
    const g = goal.current
    const sm = smooth.current
    const k = 1 - Math.exp(-delta * E.lerpSpeed)
    sm.far += (g.far - sm.far) * k
    sm.strength += (g.strength - sm.strength) * k
    sm.broken += (g.broken - sm.broken) * k

    // Earth: size and corner offset by mission day (pixel coordinates, origin at the center).
    const r = E.radiusNear + (E.radiusFar - E.radiusNear) * sm.far
    const ox = E.offsetNear[0] + (E.offsetFar[0] - E.offsetNear[0]) * sm.far
    const oy = E.offsetNear[1] + (E.offsetFar[1] - E.offsetNear[1]) * sm.far
    const ex = size.width / 2 - ox
    const ey = size.height / 2 - oy
    earth.position.set(ex, ey, 0)
    earth.scale.setScalar(r)
    const eu = earth.material.uniforms
    eu.uBrightness.value = 1 + (E.dimBrightness - 1) * sm.broken
    eu.uOpacity.value = sm.strength
    const shown = sm.strength > 0.01
    earth.visible = shown
    if (segA.current) segA.current.visible = shown
    if (segB.current) segB.current.visible = shown
    if (label.current) label.current.visible = shown
    label.current?.position.set(ex, ey - r - 14, 0)
    autonomy.current?.position.set(0, size.height / 2 - E.autonomyLabelTop, 0)
    if (labelEl.current) {
      labelEl.current.style.opacity = String(sm.strength)
      labelEl.current.style.display = shown ? 'block' : 'none'
    }

    // Body end of the line: the shoulder projected with the main camera, in pixels.
    v.set(...E.bodyPoint).project(mainCamera)
    const bx = (v.x * size.width) / 2
    const by = (v.y * size.height) / 2
    // Start at the Earth's edge, not its center.
    const dx = bx - ex
    const dy = by - ey
    const len = Math.max(Math.hypot(dx, dy), 0.001)
    const sx = ex + (dx / len) * (r + 4)
    const sy = ey + (dy / len) * (r + 4)

    // Two segments with a gap in the middle that opens when the link is down.
    const half = (E.breakGap / 2) * sm.broken
    const mx = (a: number, b: number, t: number) => a + (b - a) * t
    sm.offset += delta * E.dashSpeed
    if (segA.current) placeSegment(segA.current, lineA.current, sx, sy, mx(sx, bx, 0.5 - half), mx(sy, by, 0.5 - half), sm.offset)
    if (segB.current) placeSegment(segB.current, lineB.current, mx(sx, bx, 0.5 + half), mx(sy, by, 0.5 + half), bx, by, sm.offset)
    lineColor.copy(okColor).lerp(redColor, sm.broken)
    for (const l of [lineA.current, lineB.current]) {
      if (!l) continue
      l.material.color.copy(lineColor)
      l.material.opacity = sm.strength
    }

    // Packet: Earth -> body, only while the link works.
    sm.packet = (sm.packet + delta / g.travel) % 1
    packet.position.set(mx(sx, bx, sm.packet), mx(sy, by, sm.packet), 1)
    packet.scale.setScalar(E.packetRadius)
    packet.material.opacity = sm.strength * (1 - sm.broken)
    packet.visible = shown && packet.material.opacity > 0.01

    // Colder frame while the link is down.
    tint.scale.set(size.width, size.height, 1)
    tint.material.color.copy(white).lerp(cold, sm.broken)
    tint.visible = sm.broken > 0.01
  })

  return (
    <>
      <OrthographicCamera makeDefault position={[0, 0, 100]} near={0.1} far={1000} />
      <primitive object={tint} />
      <group ref={segA}>
        <Line ref={lineA} points={UNIT_LINE} lineWidth={E.lineWidth} dashed transparent color={E.color} />
      </group>
      <group ref={segB}>
        <Line ref={lineB} points={UNIT_LINE} lineWidth={E.lineWidth} dashed transparent color={E.color} />
      </group>
      <primitive object={earth} />
      <primitive object={packet} />
      <group ref={label}>
        <Html center style={{ pointerEvents: 'none' }}>
          <div ref={labelEl} style={{ ...s.earthLabel, color: link ? '#cfe6ff' : E.brokenColor }}>
            {EARTH_LABEL.replyIn(delay * 2)}
          </div>
        </Html>
      </group>
      {!link && (
        <group ref={autonomy}>
          <Html center style={{ pointerEvents: 'none' }}>
            <div style={s.autonomyLabel}>{EARTH_LABEL.autonomous}</div>
          </Html>
        </group>
      )}
    </>
  )
}

export function EarthLink() {
  const mainCamera = useThree((st) => st.camera)
  return (
    // renderPriority 2: drawn after the EffectComposer (priority 1), without re-rendering the main scene
    <Hud renderPriority={2}>
      <EarthHudScene mainCamera={mainCamera} />
    </Hud>
  )
}
