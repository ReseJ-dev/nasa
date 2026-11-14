// TEMPORARY mock store for developing the 3D scene alone.
// Will be replaced by the real store from the engine. Do not import it outside twin/.
import { create } from 'zustand'
import type {
  Baseline,
  BonePart,
  HealthState,
  Metric,
  RegionId,
  RegionState,
  Status,
  ThreatId,
  ThreatState,
} from '../contract/types'

export type ScenarioId = 'healthy' | 'day60' | 'critical'

type ScenarioData = Pick<HealthState, 'regions' | 'metrics' | 'boneDensity' | 'chain'> &
  Required<
    Pick<
      HealthState,
      | 'radiationLevel'
      | 'activeEvent'
      | 'inShelter'
      | 'commDelaySec'
      | 'earthLink'
      | 'fluidShift'
      | 'muscleMass'
      | 'co2Level'
      | 'chainLinks'
      | 'threats'
      | 'threatLinks'
      | 'missionDay'
      | 'gravityField'
      | 'cabinTempC'
      | 'noiseDb'
      | 'sleepHours'
      | 'sleepShiftHours'
    >
  >

// Small helper to keep scenario tables short.
function region(
  id: RegionId,
  status: Status,
  score: number,
  metrics: string[],
  advice: string[],
): RegionState {
  return { id, status, score, metrics, advice }
}

function metric(id: string, label: string, value: number, unit: string): Metric {
  return { id, label, value, unit }
}

// Default regions each threat affects; a scenario can override them.
const THREAT_REGIONS: Record<ThreatId, RegionId[]> = {
  radiation: ['immune', 'brain', 'eyes'], // DNA damage, CNS effects, cataracts
  isolation: ['brain'], // sleep, mood, attention
  gravity: ['bones', 'muscles', 'eyes', 'heart'], // bone/muscle loss, fluid shift, deconditioning
  distance: ['brain', 'heart'], // no evacuation, delayed help: stress and autonomy
  environment: ['lungs', 'brain', 'immune'], // CO2, noise, microbes in a closed cabin
}

function threats(
  levels: Record<ThreatId, number>,
  regions: Partial<Record<ThreatId, RegionId[]>> = {},
): Record<ThreatId, ThreatState> {
  return Object.fromEntries(
    (Object.keys(levels) as ThreatId[]).map((id) => [
      id,
      { level: levels[id], regions: regions[id] ?? THREAT_REGIONS[id] },
    ]),
  ) as Record<ThreatId, ThreatState>
}

// Day 1 of the mission: everything normal.
const healthy: ScenarioData = {
  regions: {
    heart: region('heart', 'ok', 94, ['heart_rate'], ['Keep up daily cardio.']),
    brain: region('brain', 'ok', 92, ['sleep_hours', 'reaction_ms'], ['Keep a regular sleep schedule.']),
    bones: region('bones', 'ok', 96, ['bone_loss_pct'], ['Resistance exercise 2.5 h per day.']),
    muscles: region('muscles', 'ok', 93, ['muscle_loss_pct'], ['Continue the exercise program.']),
    eyes: region('eyes', 'ok', 95, ['vision_score'], ['Weekly vision check.']),
    immune: region('immune', 'ok', 90, ['radiation_msv'], ['Wear your dosimeter.']),
    lungs: region('lungs', 'ok', 95, ['co2_ppm'], ['CO2 level is normal.']),
  },
  metrics: [
    metric('heart_rate', 'Heart rate', 64, 'bpm'),
    metric('sleep_hours', 'Sleep', 7.5, 'h'),
    metric('reaction_ms', 'Reaction time', 260, 'ms'),
    metric('co2_ppm', 'Cabin CO2', 2500, 'ppm'),
    metric('radiation_msv', 'Radiation dose', 1, 'mSv'),
    metric('bone_loss_pct', 'Bone mass loss', 0, '%'),
    metric('muscle_loss_pct', 'Muscle mass loss', 0, '%'),
    metric('vision_score', 'Visual acuity', 1.0, ''),
  ],
  boneDensity: {
    skull: 1, spine: 1, ribs: 1, arm_left: 1, arm_right: 1, pelvis: 1, leg_left: 1, leg_right: 1,
  },
  chain: [],
  radiationLevel: 0.1,
  activeEvent: 'none',
  inShelter: false,
  commDelaySec: 2,
  earthLink: true,
  fluidShift: 0.1,
  muscleMass: 1,
  co2Level: 0.1,
  threatLinks: [],
  missionDay: 0,
  gravityField: 0,
  cabinTempC: 22,
  noiseDb: 55,
  sleepHours: 8,
  sleepShiftHours: 0,
  chainLinks: [],
  threats: threats({ radiation: 0.1, isolation: 0.1, gravity: 0.1, distance: 0.1, environment: 0.1 }),
}

// Day 60: microgravity starts to show in bones, muscles and eyes.
const day60: ScenarioData = {
  regions: {
    heart: region('heart', 'ok', 86, ['heart_rate'], ['Keep up daily cardio.']),
    brain: region('brain', 'ok', 82, ['sleep_hours', 'reaction_ms'], ['Limit screen time before sleep.']),
    bones: region('bones', 'warning', 68, ['bone_loss_pct'], [
      'Bone loss in hips and spine. Add heavy squats and deadlifts on the resistance device.',
      'Check vitamin D and calcium intake.',
    ]),
    muscles: region('muscles', 'warning', 64, ['muscle_loss_pct'], [
      'Leg and back muscles are weakening. Increase resistance training.',
    ]),
    eyes: region('eyes', 'warning', 72, ['vision_score'], [
      'Mild vision change from fluid shift toward the head. Report to the flight surgeon.',
    ]),
    immune: region('immune', 'ok', 84, ['radiation_msv'], ['Wear your dosimeter.']),
    lungs: region('lungs', 'ok', 88, ['co2_ppm'], ['CO2 level is acceptable.']),
  },
  metrics: [
    metric('heart_rate', 'Heart rate', 70, 'bpm'),
    metric('sleep_hours', 'Sleep', 6.6, 'h'),
    metric('reaction_ms', 'Reaction time', 285, 'ms'),
    metric('co2_ppm', 'Cabin CO2', 3200, 'ppm'),
    metric('radiation_msv', 'Radiation dose', 40, 'mSv'),
    metric('bone_loss_pct', 'Bone mass loss', 2.5, '%'),
    metric('muscle_loss_pct', 'Muscle mass loss', 6, '%'),
    metric('vision_score', 'Visual acuity', 0.9, ''),
  ],
  boneDensity: {
    skull: 0.99, spine: 0.95, ribs: 0.98, arm_left: 0.98, arm_right: 0.98,
    pelvis: 0.93, leg_left: 0.94, leg_right: 0.95,
  },
  chain: ['muscles', 'bones'],
  radiationLevel: 0.15,
  activeEvent: 'none',
  inShelter: false,
  commDelaySec: 300,
  earthLink: true,
  fluidShift: 0.45,
  muscleMass: 0.9,
  co2Level: 0.15,
  threatLinks: [],
  missionDay: 60,
  gravityField: 0,
  cabinTempC: 23,
  noiseDb: 60,
  sleepHours: 6.5,
  sleepShiftHours: 1.5,
  chainLinks: [{ from: 'muscles', to: 'bones', label: 'less load' }],
  threats: threats(
    { radiation: 0.15, isolation: 0.35, gravity: 0.5, distance: 0.2, environment: 0.15 },
    { gravity: ['bones', 'muscles', 'eyes'], isolation: ['brain'] },
  ),
}

// Day 180, demo scenario: solar flare, crew in the shelter, CO2 rises, sleep drops.
const critical: ScenarioData = {
  regions: {
    heart: region('heart', 'warning', 61, ['heart_rate'], [
      'Heart rate is elevated from stress. Do a 5-minute breathing exercise.',
    ]),
    brain: region('brain', 'critical', 38, ['sleep_hours', 'reaction_ms'], [
      'Headache and slow reactions from high CO2 and poor sleep. Avoid critical tasks.',
      'Sleep at least 7 h after leaving the shelter.',
    ]),
    bones: region('bones', 'critical', 41, ['bone_loss_pct'], [
      'High fracture risk at landing, especially hips. Maximize resistance exercise.',
    ]),
    muscles: region('muscles', 'warning', 55, ['muscle_loss_pct'], [
      'Do bodyweight exercises inside the shelter.',
    ]),
    eyes: region('eyes', 'warning', 58, ['vision_score', 'reaction_ms'], [
      'Attention and visual focus are reduced. Double-check readings.',
    ]),
    immune: region('immune', 'critical', 35, ['radiation_msv'], [
      'High radiation dose from the solar flare. Stay in the shelter until the alert ends.',
    ]),
    lungs: region('lungs', 'critical', 32, ['co2_ppm'], [
      'CO2 is too high in the shelter. Check the CO2 scrubber and air circulation.',
    ]),
  },
  metrics: [
    metric('heart_rate', 'Heart rate', 98, 'bpm'),
    metric('sleep_hours', 'Sleep', 4.2, 'h'),
    metric('reaction_ms', 'Reaction time', 390, 'ms'),
    metric('co2_ppm', 'Cabin CO2', 6800, 'ppm'),
    metric('radiation_msv', 'Radiation dose', 210, 'mSv'),
    metric('bone_loss_pct', 'Bone mass loss', 7.5, '%'),
    metric('muscle_loss_pct', 'Muscle mass loss', 14, '%'),
    metric('vision_score', 'Visual acuity', 0.8, ''),
  ],
  boneDensity: {
    skull: 0.97, spine: 0.86, ribs: 0.92, arm_left: 0.93, arm_right: 0.93,
    pelvis: 0.79, leg_left: 0.82, leg_right: 0.83,
  },
  chain: ['lungs', 'brain', 'eyes'],
  radiationLevel: 0.8,
  activeEvent: 'solar_flare',
  inShelter: true,
  commDelaySec: 720,
  earthLink: false,
  fluidShift: 0.7,
  muscleMass: 0.8,
  co2Level: 0.75,
  threatLinks: [
    { from: 'radiation', to: 'isolation', strength: 0.6 }, // shelter time cuts crew contact
    { from: 'isolation', to: 'environment', strength: 0.7 }, // closed shelter: CO2, heat, noise
    { from: 'environment', to: 'gravity', strength: 0.3 }, // less exercise in the shelter
  ],
  missionDay: 180,
  gravityField: 0,
  cabinTempC: 27,
  noiseDb: 68,
  sleepHours: 5,
  sleepShiftHours: 3,
  chainLinks: [
    { from: 'lungs', to: 'brain', label: 'CO₂ ↑' },
    { from: 'brain', to: 'eyes', label: 'intracranial pressure' },
  ],
  threats: threats(
    { radiation: 0.8, isolation: 0.55, gravity: 0.6, distance: 0.9, environment: 0.7 },
    {
      radiation: ['immune', 'brain'],
      environment: ['lungs', 'brain', 'eyes'],
      gravity: ['bones', 'muscles', 'eyes'],
      isolation: ['brain'],
    },
  ),
}

// Day-0 state, shared by every scenario for comparison.
const baseline: Baseline = {
  statuses: Object.fromEntries(
    Object.values(healthy.regions).map((r) => [r.id, r.status]),
  ) as Record<RegionId, Status>,
  boneDensity: { ...healthy.boneDensity },
}

export const SCENARIOS: Record<ScenarioId, ScenarioData & Pick<HealthState, 'baseline'>> = {
  healthy: { ...healthy, baseline },
  day60: { ...day60, baseline },
  critical: { ...critical, baseline },
}

// Keeps the compiler checking that every BonePart is covered above.
export const BONE_PARTS: BonePart[] = Object.keys(healthy.boneDensity) as BonePart[]

interface MockState extends HealthState {
  scenario: ScenarioId
  setScenario(id: ScenarioId): void
  setGravityField(g: number): void // dev panel only
  // Dev demo: write only the fields whose value actually changed (same references stay,
  // so unchanged arrays like `chain` never trigger re-renders).
  patch(partial: Partial<HealthState>): void
  // Dev demo: change one threat's level; the other threats keep their objects.
  setThreatLevel(id: ThreatId, level: number): void
}

export const useHealthStore = create<MockState>()((set) => ({
  ...SCENARIOS.healthy,
  scenario: 'healthy',
  selectedRegion: null,
  selectRegion: (id) => set({ selectedRegion: id }),
  setScenario: (id) => set({ ...SCENARIOS[id], scenario: id }),
  setGravityField: (g) => set({ gravityField: g }),
  patch: (partial) =>
    set((st) => {
      const changed: Partial<HealthState> = {}
      for (const key of Object.keys(partial) as (keyof HealthState)[]) {
        if (!Object.is(st[key], partial[key])) Object.assign(changed, { [key]: partial[key] })
      }
      return changed
    }),
  setThreatLevel: (id, level) =>
    set((st) => {
      if (!st.threats || st.threats[id].level === level) return {}
      return { threats: { ...st.threats, [id]: { ...st.threats[id], level } } }
    }),
}))
