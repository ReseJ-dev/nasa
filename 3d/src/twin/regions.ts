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
}

export interface RegionDef {
  id: RegionId
  label: string
  labelPosition: Vec3 // where the hover label appears
  parts: RegionPart[]
}

export const REGIONS: RegionDef[] = [
  {
    id: 'brain',
    label: 'Brain',
    labelPosition: [0, 1.82, 0],
    parts: [{ geometry: new SphereGeometry(0.085, 24, 16), position: [0, 1.69, -0.005], scale: [1, 0.85, 1.1] }],
  },
  {
    id: 'eyes',
    label: 'Eyes',
    labelPosition: [0, 1.66, 0.2],
    parts: [
      { geometry: new SphereGeometry(0.018, 12, 8), position: [-0.04, 1.655, 0.1] },
      { geometry: new SphereGeometry(0.018, 12, 8), position: [0.04, 1.655, 0.1] },
    ],
  },
  {
    id: 'lungs',
    label: 'Lungs',
    labelPosition: [-0.28, 1.4, 0],
    parts: [
      { geometry: new SphereGeometry(0.08, 20, 16), position: [-0.085, 1.32, 0], scale: [1, 1.5, 0.9] },
      { geometry: new SphereGeometry(0.08, 20, 16), position: [0.085, 1.32, 0], scale: [1, 1.5, 0.9] },
    ],
  },
  {
    id: 'heart',
    label: 'Heart',
    labelPosition: [0.25, 1.28, 0.1],
    parts: [{ geometry: new SphereGeometry(0.05, 20, 16), position: [0.025, 1.26, 0.06], scale: [1, 1.15, 0.9] }],
  },
  {
    id: 'immune',
    label: 'Immune system',
    labelPosition: [-0.3, 1.05, 0],
    parts: [
      // thymus
      { geometry: new SphereGeometry(0.03, 12, 10), position: [0, 1.42, 0.05] },
      // spleen
      { geometry: new SphereGeometry(0.04, 16, 12), position: [-0.12, 1.06, -0.02], scale: [0.8, 1.3, 0.8] },
    ],
  },
  {
    id: 'bones',
    label: 'Bones',
    labelPosition: [0.3, 0.95, 0],
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
    label: 'Muscles',
    labelPosition: [0.3, 0.65, 0],
    parts: [
      // thighs
      { geometry: new CapsuleGeometry(0.055, 0.24, 6, 12), position: [-0.09, 0.68, 0] },
      { geometry: new CapsuleGeometry(0.055, 0.24, 6, 12), position: [0.09, 0.68, 0] },
      // upper arms
      { geometry: new CapsuleGeometry(0.033, 0.2, 6, 12), position: [-0.26, 1.29, 0], rotation: [0, 0, -0.12] },
      { geometry: new CapsuleGeometry(0.033, 0.2, 6, 12), position: [0.26, 1.29, 0], rotation: [0, 0, 0.12] },
    ],
  },
]
