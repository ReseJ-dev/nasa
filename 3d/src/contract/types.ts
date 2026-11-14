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

// Proposed, to agree with participant 3: a cause label between two organs of the chain.
export interface ChainLink {
  from: RegionId
  to: RegionId
  label: string
}

// Proposed, to agree with participant 3: day-0 state, for comparison.
export interface Baseline {
  statuses: Record<RegionId, Status>
  boneDensity: Record<BonePart, number>
}

export interface HealthState {
  regions: Record<RegionId, RegionState>
  selectedRegion: RegionId | null
  metrics: Metric[] // includes heart_rate
  boneDensity: Record<BonePart, number> // proposed: 0..1, 1 = normal
  chain: RegionId[] // proposed: cause chain, e.g. ['lungs', 'brain', 'eyes']
  // Proposed, to agree with participant 3 (optional until agreed):
  radiationLevel?: number // 0..1
  commDelaySec?: number // one-way signal delay to Earth, seconds
  earthLink?: boolean // false = no connection to Earth
  activeEvent?: 'none' | 'solar_flare'
  fluidShift?: number // 0..1, how much body fluid moved toward the head
  chainLinks?: ChainLink[] // cause labels between neighbouring chain organs
  baseline?: Baseline // day-0 region statuses and bone density
  selectRegion(id: RegionId | null): void
}
