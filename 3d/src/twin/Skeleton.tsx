import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import {
  BufferGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  Euler,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { BonePart } from '../contract/types'
import { BONE_DENSITY, FRACTURE_LABEL_THRESHOLD, LANDING, LAYERS, SKELETON, type Layer } from './config'
import { boneDensityColor, STATUS_HEX } from './colors'
import { FRACTURE_LABEL } from './labels'
import { overlayStyles as overlay } from './overlayStyles'
import { FONT } from './theme'
import { useHealthStore } from './store'
import { useFadeOpacity } from './hooks/useFadeOpacity'
import { useSceneStore } from './sceneStore'
import { BODY } from './bodyShape'
import { blob } from './shapes'

// Skeleton built from primitives, one mesh per BonePart (mesh name = BonePart).
// Each part is colored by boneDensity from the store; the weakest part gets a fracture-risk label.
// Same units as Body.tsx: feet at y = 0. The astronaut faces +z (the camera),
// so their LEFT side is at +x (the viewer's right).

type Vec3 = [number, number, number]

// Moves/rotates/scales a primitive into place (once, at module load).
function place(geo: BufferGeometry, position: Vec3, rotation: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1]) {
  const m = new Matrix4().compose(
    new Vector3(...position),
    new Quaternion().setFromEuler(new Euler(...rotation)),
    new Vector3(...scale),
  )
  return geo.applyMatrix4(m)
}

// Joins many primitives into one geometry, so each bone part is a single mesh.
function merge(parts: BufferGeometry[], groupPosition?: Vec3, groupRotation?: Vec3) {
  parts.forEach((p) => p.deleteAttribute('uv')) // not used; smooth shapes from shapes.ts have none
  const geo = mergeGeometries(parts)
  parts.forEach((p) => p.dispose())
  if (groupPosition) place(geo, groupPosition, groupRotation)
  return geo
}

// A long bone from `a` to `b`: a shaft that tapers from radius ra to rb, with a round knob at each end.
const UP = new Vector3(0, 1, 0)
function bone(a: Vec3, b: Vec3, ra: number, rb: number, knob = 1.35) {
  const from = new Vector3(...a)
  const to = new Vector3(...b)
  const length = from.distanceTo(to)
  const m = new Matrix4().compose(
    from.clone().add(to).multiplyScalar(0.5),
    new Quaternion().setFromUnitVectors(UP, to.clone().sub(from).normalize()),
    new Vector3(1, 1, 1),
  )
  // CylinderGeometry: radiusTop is at +y, which is `b` after the rotation.
  const shaft = new CylinderGeometry(rb, ra, length, 12).applyMatrix4(m)
  return [shaft, place(new SphereGeometry(ra * knob, 12, 10), a), place(new SphereGeometry(rb * knob, 12, 10), b)]
}

const mirror = (p: Vec3, side: number): Vec3 => [p[0] * side, p[1], p[2]]

// Skull: one smooth shape. The lower half narrows to the chin and leans forward (the face);
// the eye sockets and the nose opening are pressed in, so the light draws them.
function skull() {
  const dent = (p: Vector3, x: number, y: number, radius: number, depth: number) => {
    if (p.z <= 0) return
    const d = Math.hypot(p.x - x, p.y - y) / radius
    if (d < 1) p.z -= depth * (1 - d * d) ** 2
  }
  return blob(
    [0.072, 0.1, 0.088],
    (p) => {
      const low = Math.max(-p.y, 0)
      const narrow = 1 - 0.32 * low ** 1.4
      p.x *= narrow
      p.z = p.z * (1 - 0.3 * low) + 0.16 * low // the face sits in front of the neck
      dent(p, -0.36, -0.1, 0.25, 0.3) // eye sockets
      dent(p, 0.36, -0.1, 0.25, 0.3)
      dent(p, 0, -0.38, 0.12, 0.22) // nose
    },
    [0, 1.69, -0.006],
    2,
  )
}

// Depth (z) of the spine at a height: follows the back of the body shell, with a slight S curve.
function spineZ(y: number) {
  const t = (y - 0.93) / 0.67 // 0 at the pelvis, 1 at the skull
  return -0.05 - 0.03 * Math.sin(Math.min(t, 0.78) * Math.PI * 1.28) + (t > 0.78 ? (t - 0.78) * 0.2 : 0)
}

function spine() {
  const vertebrae: BufferGeometry[] = []
  for (let y = 0.94; y <= 1.6; y += 0.03) {
    const r = 0.021 - 0.009 * ((y - 0.94) / 0.66) // thick lumbar vertebrae, thin neck ones
    vertebrae.push(place(new CylinderGeometry(r, r, 0.02, 12), [0, y, spineZ(y)]))
  }
  return merge(vertebrae)
}

function ribs() {
  const parts: BufferGeometry[] = []
  const gap = 0.35 // half-angle of the open front, radians
  for (let i = 0; i < 7; i++) {
    const y = 1.43 - i * 0.045
    // Rib cage outline: follows the chest of the body shell, a little inside it.
    const r = 0.14 * Math.sqrt(Math.max(1 - ((y - 1.28) / 0.21) ** 2, 0.2))
    // Torus arc lying flat, rotated so the gap faces forward (+z).
    parts.push(
      place(new TorusGeometry(r, 0.007, 8, 32, Math.PI * 2 - gap * 2), [0, y, -0.012], [Math.PI / 2, 0, Math.PI / 2 + gap], [1, 0.62, 1]),
    )
  }
  parts.push(place(new CapsuleGeometry(0.012, 0.19, 6, 12), [0, 1.32, 0.066], [0, 0, 0], [1, 1, 0.5])) // sternum
  // collarbones: from the top of the sternum to the shoulders
  for (const side of [-1, 1]) parts.push(...bone([side * 0.015, 1.436, 0.05], [side * 0.188, 1.464, -0.008], 0.009, 0.008, 1.2))
  return merge(parts)
}

// side: +1 = astronaut's left (+x), -1 = right. Same landmarks as the body shell (bodyShape.ts).
function arm(side: number) {
  const [wx, wy, wz] = BODY.wrist
  const dx = Math.sin(BODY.armAngle)
  const dy = -Math.cos(BODY.armAngle)
  const palmEnd: Vec3 = [wx + dx * 0.075, wy + dy * 0.075, wz + 0.01]
  const parts = [
    ...bone(BODY.shoulder, BODY.elbow, 0.016, 0.013, 1.5), // humerus
    ...bone([BODY.elbow[0] - 0.011, BODY.elbow[1], BODY.elbow[2]], [wx - 0.009, wy, wz], 0.009, 0.008, 1.15), // radius
    ...bone([BODY.elbow[0] + 0.011, BODY.elbow[1], BODY.elbow[2]], [wx + 0.009, wy, wz], 0.009, 0.007, 1.15), // ulna
    ...bone([wx, wy - 0.012, wz], palmEnd, 0.013, 0.011, 1.1), // palm
  ]
  // fingers: the palm faces the thigh, so they fan out front to back
  for (const z of [-0.016, -0.005, 0.006, 0.017])
    parts.push(...bone([palmEnd[0], palmEnd[1], palmEnd[2] + z * 0.6], [palmEnd[0] + dx * 0.075, palmEnd[1] + dy * 0.075, palmEnd[2] + z + 0.008], 0.0048, 0.004, 1.1))
  const geo = merge(parts)
  if (side < 0) geo.scale(-1, 1, 1) // mirror for the right arm
  return side < 0 ? flipFaces(geo) : geo
}

// After a mirror the triangles face inward; swap two corners of each to turn them back.
function flipFaces(geo: BufferGeometry) {
  const index = geo.getIndex()
  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i)
      index.setX(i, index.getX(i + 1))
      index.setX(i + 1, a)
    }
  }
  return geo
}

function pelvis() {
  const parts: BufferGeometry[] = []
  for (const side of [-1, 1]) {
    // hip blade: a thin plate, wide at the top, narrowing down to the hip socket
    const blade = blob([0.066, 0.06, 0.012], (p) => {
      p.x *= 0.5 + 0.5 * (0.5 + p.y * 0.5)
    })
    parts.push(place(blade.toNonIndexed(), [side * 0.088, 0.975, -0.028], [0.12, side * -0.6, side * -0.38]))
    blade.dispose()
    // lower branch: from the hip socket down to the middle, closing the ring at the front
    parts.push(...bone([side * 0.078, 0.925, -0.005], [side * 0.012, 0.868, 0.035], 0.012, 0.011, 1.1).map((g) => g.toNonIndexed()))
  }
  // sacrum: a wedge between the blades, at the back
  parts.push(place(new CylinderGeometry(0.04, 0.012, 0.11, 12), [0, 0.965, -0.058], [0.2, 0, 0], [1, 1, 0.45]).toNonIndexed())
  return merge(parts)
}

// side: +1 = astronaut's left (+x), -1 = right. Same landmarks as the body shell (bodyShape.ts).
function leg(side: number) {
  const hip = mirror(BODY.hip, side)
  const knee = mirror(BODY.knee, side)
  const ankle = mirror(BODY.ankle, side)
  return merge([
    place(new SphereGeometry(0.024, 14, 10), [side * 0.07, 0.925, -0.005]), // femoral head, in the hip socket
    ...bone([side * 0.07, 0.925, -0.005], [hip[0] + side * 0.022, hip[1] + 0.005, 0], 0.014, 0.016, 1.2), // femoral neck
    ...bone([hip[0] + side * 0.022, hip[1] + 0.005, 0], knee, 0.019, 0.018, 1.45), // femur
    place(new SphereGeometry(0.019, 12, 10), [knee[0], knee[1] + 0.005, knee[2] + 0.04], [0, 0, 0], [1, 1.15, 0.6]), // kneecap
    ...bone([knee[0], knee[1] - 0.03, knee[2]], ankle, 0.019, 0.013, 1.35), // tibia
    ...bone([knee[0] + side * 0.027, knee[1] - 0.045, knee[2] - 0.012], [ankle[0] + side * 0.02, ankle[1] + 0.01, ankle[2] - 0.004], 0.007, 0.006, 1.3), // fibula
    place(new SphereGeometry(0.024, 12, 10), [ankle[0], 0.04, -0.03]), // heel
    ...bone([ankle[0], 0.045, -0.015], [ankle[0] + side * 0.005, 0.022, 0.085], 0.02, 0.014, 1.1), // foot
    ...bone([ankle[0] + side * 0.005, 0.022, 0.085], [ankle[0] + side * 0.007, 0.014, 0.13], 0.011, 0.008, 1.1), // toes
  ])
}

// Created once at module load.
const BONE_GEOMETRY: Record<BonePart, BufferGeometry> = {
  skull: skull(),
  spine: spine(),
  ribs: ribs(),
  arm_left: arm(1),
  arm_right: arm(-1),
  pelvis: pelvis(),
  leg_left: leg(1),
  leg_right: leg(-1),
}

const BONE_PARTS = Object.keys(BONE_GEOMETRY) as BonePart[]

// Where the "fracture risk" label appears for each part (outside the body, to the side).
const LABEL_POSITION: Record<BonePart, Vec3> = {
  skull: [0.25, 1.75, 0],
  spine: [0.25, 1.2, -0.08],
  ribs: [0.3, 1.32, 0],
  arm_left: [0.55, 1.05, 0],
  arm_right: [-0.55, 1.05, 0],
  pelvis: [0.3, 0.92, 0],
  leg_left: [0.3, 0.45, 0],
  leg_right: [-0.3, 0.45, 0],
}

// One bone part: own material, color follows its density, fades with the layer.
// landing = true: this is the weakest part during the landing moment: it shows through the
// shell even in body mode and flashes red.
function BoneMesh({ part, layer, landing }: { part: BonePart; layer: Layer; landing: boolean }) {
  const density = useHealthStore((s) => s.boneDensity[part])

  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: SKELETON.color,
        roughness: SKELETON.roughness,
        transparent: true,
        opacity: LAYERS.body.skeleton,
        emissive: STATUS_HEX.critical,
        emissiveIntensity: 0,
      }),
    [],
  )
  useFadeOpacity(material, landing ? Math.max(LANDING.boneOpacity, LAYERS[layer].skeleton) : LAYERS[layer].skeleton)
  const landingRef = useRef(landing)
  const flashTime = useRef(0)
  useLayoutEffect(() => {
    landingRef.current = landing
    flashTime.current = 0
  }, [landing])

  // Target color, updated only when density changes (no objects created per frame).
  const target = useMemo(() => new Color(SKELETON.color), [])
  useLayoutEffect(() => {
    boneDensityColor(density, target)
  }, [density, target])

  useFrame((_, delta) => {
    material.color.lerp(target, 1 - Math.exp(-delta * BONE_DENSITY.lerpSpeed))
    if (landingRef.current) {
      // red flash pulses that fade out over the landing moment
      flashTime.current += delta
      const fade = Math.max(0, 1 - flashTime.current / LANDING.seconds)
      material.emissiveIntensity =
        LANDING.flashIntensity * fade * (0.5 + 0.5 * Math.cos(flashTime.current * LANDING.flashHz * Math.PI * 2))
    } else if (material.emissiveIntensity > 0) {
      material.emissiveIntensity = Math.max(0, material.emissiveIntensity - delta * 3)
    }
  })

  return <mesh name={part} geometry={BONE_GEOMETRY[part]} material={material} />
}

function FractureLabel({ part }: { part: BonePart }) {
  return (
    <Html position={LABEL_POSITION[part]} center style={{ pointerEvents: 'none' }}>
      <div
        style={{ ...overlay.hoverLabel, color: '#fff', font: FONT.captionBold, background: 'rgba(120, 16, 10, 0.9)', border: '1px solid var(--st-critical)' }}
      >
        {FRACTURE_LABEL}
      </div>
    </Html>
  )
}

// Part that gets the fracture label: the one with the lowest density,
// and only if that density is below FRACTURE_LABEL_THRESHOLD; otherwise null.
// TODO: the real threshold will come from the engine later.
function weakestPart(density: Record<BonePart, number>): BonePart | null {
  let weakest: BonePart = BONE_PARTS[0]
  for (const part of BONE_PARTS) if (density[part] < density[weakest]) weakest = part
  return density[weakest] < FRACTURE_LABEL_THRESHOLD ? weakest : null
}

export function Skeleton({ layer }: { layer: Layer }) {
  // Selects just a name, so Skeleton re-renders only when the weakest part changes
  // (each BoneMesh subscribes to its own density).
  const weakest = useHealthStore((s) => weakestPart(s.boneDensity))
  // Landing moment: the label shows even in body mode.
  const landing = useSceneStore((s) => s.landing)
  const showLabel = (layer === 'skeleton' || landing) && weakest !== null

  return (
    <group name="skeleton">
      {BONE_PARTS.map((part) => (
        <BoneMesh key={part} part={part} layer={layer} landing={landing && part === weakest} />
      ))}
      {showLabel && <FractureLabel part={weakest} />}
    </group>
  )
}
