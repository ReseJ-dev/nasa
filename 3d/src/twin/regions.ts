import {
  BufferGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three'
import type { RegionId } from '../contract/types'

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
  callout: { anchor: Vec3; label: Vec3 }
  parts: RegionPart[]
  heartbeat?: boolean // true = parts scale with heart_rate (see useHeartbeat)
}

export const REGIONS: RegionDef[] = [
  {
    id: 'brain',
    labelPosition: [0, 1.82, 0],
    callout: { anchor: [0, 1.69, 0], label: [-0.6, 1.8, 0] },
    parts: [{ geometry: new SphereGeometry(0.085, 24, 16), position: [0, 1.69, -0.005], scale: [1, 0.85, 1.1] }],
  },
  {
    id: 'eyes',
    labelPosition: [0, 1.66, 0.2],
    callout: { anchor: [0.04, 1.655, 0.1], label: [0.6, 1.66, 0] },
    parts: [
      { geometry: new SphereGeometry(0.018, 12, 8), position: [-0.04, 1.655, 0.1] },
      { geometry: new SphereGeometry(0.018, 12, 8), position: [0.04, 1.655, 0.1] },
    ],
  },
  {
    id: 'lungs',
    labelPosition: [-0.28, 1.4, 0],
    callout: { anchor: [-0.085, 1.32, 0], label: [-0.6, 1.42, 0] },
    parts: [
      { geometry: new SphereGeometry(0.08, 20, 16), position: [-0.085, 1.32, 0], scale: [1, 1.5, 0.9] },
      { geometry: new SphereGeometry(0.08, 20, 16), position: [0.085, 1.32, 0], scale: [1, 1.5, 0.9] },
    ],
  },
  {
    id: 'heart',
    labelPosition: [0.25, 1.28, 0.1],
    callout: { anchor: [0.025, 1.26, 0.06], label: [0.6, 1.3, 0] },
    heartbeat: true,
    parts: [{ geometry: new SphereGeometry(0.05, 20, 16), position: [0.025, 1.26, 0.06], scale: [1, 1.15, 0.9] }],
  },
  {
    id: 'immune',
    labelPosition: [-0.3, 1.05, 0],
    callout: { anchor: [-0.12, 1.06, -0.02], label: [-0.6, 1.04, 0] },
    parts: [
      // thymus
      { geometry: new SphereGeometry(0.03, 12, 10), position: [0, 1.42, 0.05] },
      // spleen
      { geometry: new SphereGeometry(0.04, 16, 12), position: [-0.12, 1.06, -0.02], scale: [0.8, 1.3, 0.8] },
    ],
  },
  {
    // Liver under the ribs on the astronaut's right (viewer's left, -x) plus a small pancreas.
    // Liver sits in front of the spleen (z) and below the lungs, so the shapes do not overlap.
    // Callout on the left, between the lungs (1.42) and immune (1.04) labels.
    id: 'metabolism',
    labelPosition: [-0.3, 1.2, 0.1],
    callout: { anchor: [-0.1, 1.15, 0.06], label: [-0.6, 1.23, 0] },
    parts: [
      // liver: wide, flat wedge-like ellipsoid
      {
        geometry: new SphereGeometry(0.06, 20, 14),
        position: [-0.07, 1.15, 0.05],
        rotation: [0, 0, -0.2],
        scale: [1.6, 0.7, 0.9],
      },
      // pancreas: thin horizontal capsule behind the stomach, toward the left side
      {
        geometry: new CapsuleGeometry(0.018, 0.1, 4, 10),
        position: [0.03, 1.05, 0],
        rotation: [0, 0, Math.PI / 2 - 0.15],
      },
    ],
  },
  {
    id: 'bones',
    labelPosition: [0.3, 0.95, 0],
    callout: { anchor: [0, 0.92, -0.01], label: [0.6, 0.94, 0] },
    parts: [
      // spine
      { geometry: new CylinderGeometry(0.02, 0.02, 0.62, 10), position: [0, 1.2, -0.08] },
      // pelvis ring
      {
        geometry: new TorusGeometry(0.1, 0.022, 10, 24),
        position: [0, 0.92, -0.01],
        rotation: [Math.PI / 2, 0, 0],
        scale: [1.2, 0.8, 1],
      },
    ],
  },
  {
    id: 'muscles',
    labelPosition: [0.3, 0.65, 0],
    callout: { anchor: [0.09, 0.68, 0], label: [0.6, 0.62, 0] },
    parts: [
      // thighs
      { geometry: new CapsuleGeometry(0.055, 0.24, 6, 12), position: [-0.09, 0.68, 0], thin: true },
      { geometry: new CapsuleGeometry(0.055, 0.24, 6, 12), position: [0.09, 0.68, 0], thin: true },
      // calves (a bit behind the shin)
      { geometry: new CapsuleGeometry(0.04, 0.2, 6, 12), position: [-0.09, 0.3, -0.012], thin: true },
      { geometry: new CapsuleGeometry(0.04, 0.2, 6, 12), position: [0.09, 0.3, -0.012], thin: true },
      // upper arms
      { geometry: new CapsuleGeometry(0.033, 0.2, 6, 12), position: [-0.26, 1.29, 0], rotation: [0, 0, -0.12] },
      { geometry: new CapsuleGeometry(0.033, 0.2, 6, 12), position: [0.26, 1.29, 0], rotation: [0, 0, 0.12] },
    ],
  },
]
