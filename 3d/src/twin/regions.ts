import { BufferGeometry, CapsuleGeometry, CatmullRomCurve3, SphereGeometry, TorusGeometry, TubeGeometry, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { RegionId } from '../contract/types'
import { BODY } from './bodyShape'
import { blob, taperedCapsule } from './shapes'

// Organ shapes and positions inside the body (same units as Body.tsx: feet at y = 0).
// Geometries are created once here, at module load, and shared by RegionMesh.

type Vec3 = [number, number, number]

export interface RegionPart {
  geometry: BufferGeometry
  position: Vec3
  rotation?: Vec3
  scale?: Vec3
  thin?: boolean // leg muscle: gets thinner (x, z) with muscleMass
}

export interface RegionDef {
  id: RegionId
  labelPosition: Vec3 // where the hover label appears (text: REGION_LABEL in labels.ts)
  // Permanent callout for warning/critical: a line from `anchor` (on the organ)
  // to `label` (left or right of the body). Fixed per region so labels never overlap.
  // `lineStart` (optional): where the line starts instead of `anchor`. Used for the head organs,
  // whose line would otherwise cross the head and the circadian ring: their line is a short
  // pointer that starts just outside the ring.
  callout: { anchor: Vec3; label: Vec3; lineStart?: Vec3 }
  parts: RegionPart[]
  heartbeat?: boolean // true = parts scale with heart_rate (see useHeartbeat)
}

// ---- Organ shapes (built once at module load) ----

function merged(parts: BufferGeometry[]) {
  const geo = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)))
  parts.forEach((g) => g.dispose())
  return geo
}

// Brain: two hemispheres with a groove between them, cerebellum at the back, brainstem below.
const BRAIN = merged([
  blob([0.036, 0.056, 0.076], undefined, [-0.033, 0, 0]),
  blob([0.036, 0.056, 0.076], undefined, [0.033, 0, 0]),
  blob([0.046, 0.024, 0.03], undefined, [0, -0.046, -0.044]),
  blob([0.014, 0.036, 0.014], undefined, [0, -0.07, -0.014]),
])
// Lung: narrow at the top, wide at the base.
const LUNG = blob([0.06, 0.115, 0.068], (p) => {
  const taper = 0.66 + 0.34 * (0.5 - p.y * 0.5)
  p.x *= taper
  p.z *= taper
})
// Heart: wide at the top, pointed at the bottom.
const HEART = blob([0.047, 0.056, 0.042], (p) => {
  const taper = 0.55 + 0.45 * (0.5 + p.y * 0.5)
  p.x *= taper
  p.z *= taper
})
// Liver: thick on the astronaut's right (-x), thin wedge toward the middle.
const LIVER = blob([0.078, 0.04, 0.046], (p) => {
  p.y *= 0.5 + 0.5 * (0.5 - p.x * 0.5)
})
// Spine: a thin tube along the back, following its natural S curve.
const SPINE = new TubeGeometry(
  new CatmullRomCurve3([
    new Vector3(0, 0.9, -0.05),
    new Vector3(0, 1.08, -0.058),
    new Vector3(0, 1.3, -0.074),
    new Vector3(0, 1.44, -0.052),
    new Vector3(0, 1.52, -0.03),
  ]),
  32,
  0.016,
  10,
)
const THIGH = taperedCapsule(0.06, 0.038, 0.24)
const CALF = taperedCapsule(0.04, 0.024, 0.17)
const UPPER_ARM = taperedCapsule(0.036, 0.027, 0.17)
const EYE = new SphereGeometry(0.016, 16, 12)

// Middle of the upper arm (the arm hangs at BODY.armAngle from the shoulder).
const ARM_X = BODY.shoulder[0] + Math.sin(BODY.armAngle) * 0.15
const ARM_Y = BODY.shoulder[1] - Math.cos(BODY.armAngle) * 0.15
const THIGH_Y = (BODY.hip[1] + BODY.knee[1]) / 2 + 0.005

export const REGIONS: RegionDef[] = [
  {
    id: 'brain',
    labelPosition: [0, 1.82, 0],
    callout: { anchor: [0, 1.705, 0], label: [-0.6, 1.8, 0], lineStart: [-0.31, 1.745, 0] },
    parts: [{ geometry: BRAIN, position: [0, 1.708, -0.004] }],
  },
  {
    id: 'eyes',
    labelPosition: [0, 1.66, 0.2],
    callout: { anchor: [0.033, 1.668, 0.082], label: [0.6, 1.66, 0], lineStart: [0.31, 1.66, 0] },
    parts: [
      { geometry: EYE, position: [-0.033, 1.668, 0.082] },
      { geometry: EYE, position: [0.033, 1.668, 0.082] },
    ],
  },
  {
    id: 'lungs',
    labelPosition: [-0.28, 1.4, 0],
    callout: { anchor: [-0.08, 1.315, 0], label: [-0.6, 1.42, 0] },
    parts: [
      { geometry: LUNG, position: [-0.08, 1.315, -0.008] },
      { geometry: LUNG, position: [0.08, 1.315, -0.008] },
    ],
  },
  {
    id: 'heart',
    labelPosition: [0.25, 1.28, 0.1],
    callout: { anchor: [0.022, 1.262, 0.042], label: [0.6, 1.3, 0] },
    heartbeat: true,
    // tilted so the tip points down and to the astronaut's left
    parts: [{ geometry: HEART, position: [0.022, 1.262, 0.042], rotation: [0, 0, 0.4] }],
  },
  {
    id: 'immune',
    labelPosition: [-0.3, 1.05, 0],
    callout: { anchor: [-0.1, 1.1, -0.025], label: [-0.6, 1.04, 0] },
    parts: [
      // thymus
      { geometry: new SphereGeometry(0.024, 16, 12), position: [0, 1.405, 0.035], scale: [1.2, 1, 0.7] },
      // spleen
      { geometry: new SphereGeometry(0.034, 20, 14), position: [-0.1, 1.1, -0.025], scale: [0.8, 1.3, 0.8] },
    ],
  },
  {
    // Liver under the ribs on the astronaut's right (viewer's left, -x) plus a small pancreas.
    // Liver sits in front of the spleen (z) and below the lungs, so the shapes do not overlap.
    // Callout on the left, between the lungs (1.42) and immune (1.04) labels.
    id: 'metabolism',
    labelPosition: [-0.3, 1.2, 0.1],
    callout: { anchor: [-0.075, 1.172, 0.04], label: [-0.6, 1.23, 0] },
    parts: [
      { geometry: LIVER, position: [-0.045, 1.172, 0.036], rotation: [0, 0, -0.15] },
      // pancreas: thin horizontal capsule behind the stomach, toward the left side
      {
        geometry: new CapsuleGeometry(0.016, 0.09, 6, 12),
        position: [0.035, 1.075, 0.005],
        rotation: [0, 0, Math.PI / 2 - 0.15],
      },
    ],
  },
  {
    id: 'bones',
    labelPosition: [0.3, 0.95, 0],
    callout: { anchor: [0, 0.93, -0.01], label: [0.6, 0.94, 0] },
    parts: [
      // spine (the tube is built in body coordinates already)
      { geometry: SPINE, position: [0, 0, 0] },
      // pelvis ring
      {
        geometry: new TorusGeometry(0.095, 0.02, 12, 32),
        position: [0, 0.93, -0.01],
        rotation: [Math.PI / 2 - 0.4, 0, 0], // tipped forward, so it reads as a ring from the front
        scale: [1.25, 0.78, 1],
      },
    ],
  },
  {
    id: 'muscles',
    labelPosition: [0.3, 0.65, 0],
    callout: { anchor: [BODY.hip[0], THIGH_Y, 0], label: [0.6, 0.62, 0] },
    parts: [
      // thighs
      { geometry: THIGH, position: [-BODY.hip[0], THIGH_Y, 0.002], thin: true },
      { geometry: THIGH, position: [BODY.hip[0], THIGH_Y, 0.002], thin: true },
      // calves (a bit behind the shin)
      { geometry: CALF, position: [-0.099, 0.335, -0.022], thin: true },
      { geometry: CALF, position: [0.099, 0.335, -0.022], thin: true },
      // upper arms
      { geometry: UPPER_ARM, position: [-ARM_X, ARM_Y, -0.007], rotation: [0, 0, -BODY.armAngle] },
      { geometry: UPPER_ARM, position: [ARM_X, ARM_Y, -0.007], rotation: [0, 0, BODY.armAngle] },
    ],
  },
]
