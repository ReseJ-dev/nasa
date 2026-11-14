// Shared contract between 3D (twin/), UI (ui/) and engine (engine/, data/).
// Base part is agreed. BonePart, boneDensity and chain are PROPOSED: confirm with teammate 3.
// Metric shape is not defined in the agreed contract yet: confirm with teammate 3.

export type Status = 'ok' | 'warning' | 'critical'

export type RegionId = 'heart' | 'brain' | 'bones' | 'muscles' | 'eyes' | 'immune' | 'lungs'

export interface RegionState {
  id: RegionId
  status: Status
  score: number // 0..100, 100 = perfect
  metrics: string[] // ids of related metrics (Metric.id)
  advice: string[]
}

export interface Metric {
  id: string // e.g. 'heart_rate'
  label: string
  value: number
  unit: string
}

// Proposed addition
export type BonePart =
  | 'skull'
  | 'spine'
  | 'ribs'
  | 'arm_left'
  | 'arm_right'
  | 'pelvis'
  | 'leg_left'
  | 'leg_right'

export interface HealthState {
  regions: Record<RegionId, RegionState>
  selectedRegion: RegionId | null
  metrics: Metric[] // includes heart_rate
  boneDensity: Record<BonePart, number> // proposed: 0..1, 1 = normal
  chain: RegionId[] // proposed: cause chain, e.g. ['lungs', 'brain', 'eyes']
  selectRegion(id: RegionId | null): void
}
