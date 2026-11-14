import { useLayoutEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import {
  BoxGeometry,
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
import { BONE_DENSITY, LAYERS, SKELETON, type Layer } from './config'
import { boneDensityColor } from './colors'
import { useHealthStore } from './mockStore'
import { useFadeOpacity } from './hooks/useFadeOpacity'

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
  const geo = mergeGeometries(parts)
  parts.forEach((p) => p.dispose())
  if (groupPosition) place(geo, groupPosition, groupRotation)
  return geo
}

function skull() {
  return merge([
    place(new SphereGeometry(0.1, 24, 16), [0, 1.685, -0.005], [0, 0, 0], [1, 1.05, 1.1]), // cranium
    place(new BoxGeometry(0.09, 0.035, 0.07), [0, 1.575, 0.045]), // jaw
  ])
}

function spine() {
  const vertebrae: BufferGeometry[] = []
  for (let y = 0.97; y <= 1.56; y += 0.034) {
    // slight S-curve: the neck and lower back lean a little forward
    const z = -0.075 + 0.012 * Math.cos(((y - 0.97) / 0.59) * Math.PI * 2)
    vertebrae.push(place(new CylinderGeometry(0.024, 0.024, 0.024, 10), [0, y, z]))
  }
  return merge(vertebrae)
}

function ribs() {
  const parts: BufferGeometry[] = []
  const gap = 0.35 // half-angle of the open front, radians
  for (let i = 0; i < 6; i++) {
    const y = 1.42 - i * 0.055
    const r = 0.12 + Math.sin(((i + 1) / 7) * Math.PI) * 0.03 // wider in the middle of the rib cage
    // Torus arc lying flat, rotated so the gap faces forward (+z).
    parts.push(
      place(new TorusGeometry(r, 0.008, 6, 28, Math.PI * 2 - gap * 2), [0, y, -0.01], [Math.PI / 2, 0, Math.PI / 2 + gap], [1.05, 0.62, 1]),
    )
  }
  parts.push(place(new BoxGeometry(0.025, 0.22, 0.012), [0, 1.3, 0.075])) // sternum
  // collarbones
  parts.push(place(new CapsuleGeometry(0.01, 0.15, 4, 8), [-0.1, 1.46, 0.03], [0, 0, Math.PI / 2]))
  parts.push(place(new CapsuleGeometry(0.01, 0.15, 4, 8), [0.1, 1.46, 0.03], [0, 0, Math.PI / 2]))
  return merge(parts)
}

// side: +1 = astronaut's left (+x), -1 = right. Matches the arm groups in Body.tsx.
function arm(side: number) {
  return merge(
    [
      place(new CapsuleGeometry(0.018, 0.24, 4, 10), [0, -0.16, 0]), // humerus
      place(new CapsuleGeometry(0.011, 0.22, 4, 8), [-0.012, -0.45, 0]), // radius
      place(new CapsuleGeometry(0.011, 0.22, 4, 8), [0.012, -0.45, 0]), // ulna
      place(new BoxGeometry(0.045, 0.075, 0.018), [0, -0.63, 0]), // hand
    ],
    [side * 0.24, 1.45, 0],
    [0, 0, side * 0.12],
  )
}

function pelvis() {
  return merge([
    place(new SphereGeometry(0.07, 16, 12), [-0.075, 0.96, -0.02], [0, -0.5, 0], [1, 0.9, 0.35]), // right iliac wing
    place(new SphereGeometry(0.07, 16, 12), [0.075, 0.96, -0.02], [0, 0.5, 0], [1, 0.9, 0.35]), // left iliac wing
    place(new TorusGeometry(0.065, 0.018, 8, 20), [0, 0.88, 0], [Math.PI / 2, 0, 0], [1.2, 0.9, 1]), // pelvic ring
  ])
}

// side: +1 = astronaut's left (+x), -1 = right. Matches the leg groups in Body.tsx.
function leg(side: number) {
  return merge(
    [
      place(new CapsuleGeometry(0.022, 0.36, 4, 10), [0, -0.22, 0]), // femur
      place(new SphereGeometry(0.02, 10, 8), [0, -0.43, 0.04]), // kneecap
      place(new CapsuleGeometry(0.018, 0.34, 4, 10), [0, -0.62, 0]), // tibia
      place(new CapsuleGeometry(0.01, 0.32, 4, 8), [side * 0.024, -0.62, -0.01]), // fibula
      place(new BoxGeometry(0.055, 0.025, 0.15), [0, -0.875, 0.04]), // foot
    ],
    [side * 0.09, 0.9, 0],
  )
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
  arm_left: [0.5, 1.05, 0],
  arm_right: [-0.5, 1.05, 0],
  pelvis: [0.3, 0.92, 0],
  leg_left: [0.3, 0.45, 0],
  leg_right: [-0.3, 0.45, 0],
}

// One bone part: own material, color follows its density, fades with the layer.
function BoneMesh({ part, layer }: { part: BonePart; layer: Layer }) {
  const density = useHealthStore((s) => s.boneDensity[part])

  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: SKELETON.color,
        roughness: SKELETON.roughness,
        transparent: true,
        opacity: LAYERS.body.skeleton,
      }),
    [],
  )
  useFadeOpacity(material, LAYERS[layer].skeleton)

  // Target color, updated only when density changes (no objects created per frame).
  const target = useMemo(() => new Color(SKELETON.color), [])
  useLayoutEffect(() => {
    boneDensityColor(density, target)
  }, [density, target])

  useFrame((_, delta) => {
    material.color.lerp(target, 1 - Math.exp(-delta * BONE_DENSITY.lerpSpeed))
  })

  return <mesh name={part} geometry={BONE_GEOMETRY[part]} material={material} />
}

function FractureLabel({ part }: { part: BonePart }) {
  return (
    <Html position={LABEL_POSITION[part]} center style={{ pointerEvents: 'none' }}>
      <div
        style={{
          padding: '3px 8px',
          borderRadius: 4,
          background: 'rgba(120, 16, 10, 0.85)',
          border: '1px solid #ff3b30',
          color: '#fff',
          font: '13px system-ui, sans-serif',
          whiteSpace: 'nowrap',
        }}
      >
        {BONE_DENSITY.fractureLabel}
      </div>
    </Html>
  )
}

export function Skeleton({ layer }: { layer: Layer }) {
  const boneDensity = useHealthStore((s) => s.boneDensity)

  // Weakest part = lowest density. Only labeled if it is below normal.
  let weakest: BonePart = BONE_PARTS[0]
  for (const part of BONE_PARTS) if (boneDensity[part] < boneDensity[weakest]) weakest = part
  const showLabel = layer === 'skeleton' && boneDensity[weakest] < 1

  return (
    <group name="skeleton">
      {BONE_PARTS.map((part) => (
        <BoneMesh key={part} part={part} layer={layer} />
      ))}
      {showLabel && <FractureLabel part={weakest} />}
    </group>
  )
}
