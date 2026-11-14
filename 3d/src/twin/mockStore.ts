// TEMPORARY mock store for developing the 3D scene alone.
// Will be replaced by the real store from the engine. Do not import it outside twin/.
// Scenario data is produced by the reference simulation (src/sim) from SimInputs presets;
// only events (flare, shelter, sleep shift, threat links) are set by hand here.
import { create } from 'zustand'
import type { Baseline, BonePart, HealthState, RegionId, SimInputs, Status, ThreatId, Vitals } from '../contract/types'
import { simulate, type SimOutput } from '../sim'

export type ScenarioId = 'healthy' | 'day60' | 'critical'

type ScenarioData = SimOutput &
  Required<Pick<HealthState, 'activeEvent' | 'inShelter' | 'sleepShiftHours' | 'threatLinks'>>

// Pre-flight values of the same crew member, shared by every preset.
const PRE_FLIGHT: Vitals = {
  systolic: 118,
  diastolic: 76,
  heartRate: 62,
  glucose: 5.0,
  bodyTempC: 36.6,
  sleepHours: 8,
  mood: 4,
  reactionMs: 255,
}

const PRESETS: Record<ScenarioId, { inputs: SimInputs; events: Omit<ScenarioData, keyof SimOutput> }> = {
  // Day 0 on the station: everything at baseline.
  healthy: {
    inputs: {
      ...PRE_FLIGHT,
      heartRate: 64,
      environment: 'station',
      missionDay: 0,
      baseline: PRE_FLIGHT,
      co2Level: 0.1,
      cabinTempC: 22,
      noiseDb: 55,
    },
    events: { activeEvent: 'none', inShelter: false, sleepShiftHours: 0, threatLinks: [] },
  },
  // Day 60 in transit: less sleep, slower reactions, first bone and muscle loss.
  day60: {
    inputs: {
      systolic: 126,
      diastolic: 82,
      heartRate: 72,
      glucose: 5.6,
      bodyTempC: 36.8,
      sleepHours: 6.5,
      mood: 3,
      reactionMs: 310,
      environment: 'transit',
      missionDay: 60,
      baseline: PRE_FLIGHT,
      co2Level: 0.15,
      cabinTempC: 23,
      noiseDb: 60,
    },
    events: { activeEvent: 'none', inShelter: false, sleepShiftHours: 1.5, threatLinks: [] },
  },
  // Day 180, demo scenario: solar flare, crew in the shelter, CO2 rises, sleep drops, no Earth link.
  critical: {
    inputs: {
      systolic: 146,
      diastolic: 94,
      heartRate: 98,
      glucose: 7.8,
      bodyTempC: 37.6,
      sleepHours: 5,
      mood: 2,
      reactionMs: 420,
      environment: 'transit',
      missionDay: 180,
      baseline: PRE_FLIGHT,
      radiationLevel: 0.8, // solar flare on top of the cruise background
      commDelaySec: 720,
      earthLink: false,
      co2Level: 0.75,
      cabinTempC: 27,
      noiseDb: 68,
    },
    events: {
      activeEvent: 'solar_flare',
      inShelter: true,
      sleepShiftHours: 3,
      threatLinks: [
        { from: 'radiation', to: 'isolation', strength: 0.6 }, // shelter time cuts crew contact
        { from: 'isolation', to: 'environment', strength: 0.7 }, // closed shelter: CO2, heat, noise
        { from: 'environment', to: 'gravity', strength: 0.3 }, // less exercise in the shelter
      ],
    },
  },
}

const scenario = (id: ScenarioId): ScenarioData => ({ ...simulate(PRESETS[id].inputs), ...PRESETS[id].events })
const healthy = scenario('healthy')
const day60 = scenario('day60')
const critical = scenario('critical')

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
