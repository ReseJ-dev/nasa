// Shared contract between 3D (twin/), UI (ui/) and engine (engine/, data/).
// Base part is agreed. BonePart, boneDensity and chain are PROPOSED: confirm with teammate 3.
// Metric shape is not defined in the agreed contract yet: confirm with teammate 3.

export type Status = 'ok' | 'warning' | 'critical'

// 'metabolism' is PROPOSED (glucose), to agree with participant 3.
export type RegionId = 'heart' | 'brain' | 'bones' | 'muscles' | 'eyes' | 'immune' | 'lungs' | 'metabolism'

// Proposed, to agree with participant 3: where a value comes from, and who acts on it.
export type Source = 'measured' | 'forecast'
export type Escalation = 'self' | 'crew' | 'ground' // 'ground' needs Earth; offline it becomes 'crew'

export interface RegionState {
  id: RegionId
  status: Status
  score: number // 0..100, 100 = perfect
  metrics: string[] // ids of related metrics (Metric.id)
  advice: string[]
  source?: Source // proposed: measured now, or forecast by the model
  escalation?: Escalation // proposed: who should act
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

// Proposed, to agree with participant 3: the five threats from the task.
export type ThreatId = 'radiation' | 'isolation' | 'gravity' | 'distance' | 'environment'

// Proposed, to agree with participant 3: level 0..1 (1 = worst) and the regions it affects.
export interface ThreatState {
  level: number
  regions: RegionId[]
}

// Proposed, to agree with participant 3: one threat making another worse, strength 0..1.
export interface ThreatLink {
  from: ThreatId
  to: ThreatId
  strength: number
}

// Proposed, to agree with participant 3: inputs of the simulation (src/sim).
export type SimEnvironment = 'station' | 'transit' | 'mars_surface'

// Measured values, also used for the pre-flight baseline.
export interface Vitals {
  systolic: number // mmHg
  diastolic: number // mmHg
  heartRate: number // bpm
  glucose: number // mmol/L
  bodyTempC: number // °C
  sleepHours: number // last night
  mood: number // 1..5, 5 = best
  reactionMs: number // reaction test, ms
}

export interface SimInputs extends Vitals {
  environment: SimEnvironment // sets gravity, radiation and comm delay defaults
  missionDay: number
  baseline: Vitals // pre-flight values of the same fields
  // Optional overrides of the environment defaults
  gravityField?: number
  radiationLevel?: number
  commDelaySec?: number
  earthLink?: boolean
  // Cabin
  co2Level: number // 0..1
  cabinTempC: number
  noiseDb: number
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
  inShelter?: boolean // crew is in the radiation shelter
  fluidShift?: number // 0..1, how much body fluid moved toward the head
  muscleMass?: number // 0..1, 1 = norm
  co2Level?: number // 0..1, cabin CO2
  // Proposed, to agree with participant 3 (optional until agreed):
  threatLinks?: ThreatLink[] // how threats feed each other
  missionDay?: number // days since launch
  gravityField?: number // local gravity in g (0 = microgravity, 1 = Earth)
  cabinTempC?: number // cabin temperature, °C
  noiseDb?: number // cabin noise, dB
  sleepHours?: number // sleep in the last night, hours
  sleepShiftHours?: number // circadian shift from the normal schedule, hours
  chainLinks?: ChainLink[] // cause labels between neighbouring chain organs
  baseline?: Baseline // day-0 region statuses and bone density
  threats?: Record<ThreatId, ThreatState> // the five threats, level and affected regions
  boneSource?: Record<BonePart, Source> // proposed: bones are always 'forecast' in flight
  selectRegion(id: RegionId | null): void
}
