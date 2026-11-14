import { useMemo } from 'react'
import {
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
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
import { LAYERS, SKELETON, type Layer } from './config'
import { useFadeOpacity } from './hooks/useFadeOpacity'

// Skeleton built from primitives, one mesh per BonePart (mesh name = BonePart).
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

export function Skeleton({ layer }: { layer: Layer }) {
  // One neutral material for now; density colors come later.
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

  return (
    <group name="skeleton">
      {BONE_PARTS.map((part) => (
        <mesh key={part} name={part} geometry={BONE_GEOMETRY[part]} material={material} />
      ))}
    </group>
  )
}
