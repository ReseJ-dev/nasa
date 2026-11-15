// Presentation presets for the 3D scene and scripted demo.
// Scenario data is produced by the reference simulation (src/sim) from SimInputs presets;
// only events (flare, shelter, sleep shift, threat links) are set by hand here.
import type { Baseline, BonePart, HealthState, RegionId, SimInputs, Status, Vitals } from '../contract/types'
import { isolationAlerts, simulate, type SimOutput } from '../sim'

export type ScenarioId = 'healthy' | 'day60' | 'critical'

type Events = Required<Pick<HealthState, 'activeEvent' | 'inShelter' | 'sleepShiftHours' | 'threatLinks'>>
// Isolation self-tracking that the simulation inputs do not carry (set by hand per preset).
type Tracking = Required<Pick<HealthState, 'brightLightMin' | 'reactionLapses' | 'activityMin' | 'history'>>
type ScenarioData = SimOutput &
  Events &
  Tracking &
  Required<Pick<HealthState, 'reactionMs' | 'mood' | 'alerts'>>

// Pre-flight exercise, minutes per day (ISS plan: about 2.5 h including setup).
const PRE_FLIGHT_ACTIVITY_MIN = 150
// Last 7 days, oldest first; the last entry is today (same values as the preset's own fields).
// Synthetic demo self-tracking, hand-made to end at each preset's own values.
const week = (sleep: number[], activity: number[], reaction: number[], mood: number[], co2: number[]) =>
  activity.map((activityMin, i) => ({ sleepHours: sleep[i], activityMin, reactionMs: reaction[i], mood: mood[i], co2Ppm: co2[i] }))

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

const PRESETS: Record<ScenarioId, { inputs: SimInputs; events: Events; tracking: Tracking }> = {
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
    tracking: {
      brightLightMin: 120,
      reactionLapses: 0,
      activityMin: 150,
      history: week(
        [8, 7.8, 8.1, 8, 7.9, 8.2, 8],
        [148, 152, 145, 150, 155, 147, 150],
        [252, 258, 254, 256, 251, 257, 255],
        [4, 4, 5, 4, 4, 4, 4],
        [2450, 2550, 2500, 2480, 2520, 2490, 2500],
      ),
    },
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
    tracking: {
      brightLightMin: 60,
      reactionLapses: 2,
      activityMin: 110,
      history: week(
        [7.4, 7.2, 7, 6.9, 6.8, 6.6, 6.5],
        [145, 140, 132, 128, 120, 114, 110],
        [282, 288, 292, 297, 301, 306, 310],
        [4, 4, 3, 3, 3, 3, 3],
        [2900, 2950, 3000, 3050, 3100, 3150, 3200],
      ),
    },
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
    // Two days in the shelter: exercise collapses, almost no bright light.
    tracking: {
      brightLightMin: 20,
      reactionLapses: 5,
      activityMin: 40,
      history: week(
        [6.8, 6.6, 6.5, 6.2, 6, 5.4, 5],
        [142, 138, 130, 124, 118, 45, 40],
        [318, 326, 335, 346, 360, 395, 420],
        [3, 3, 3, 3, 2, 2, 2],
        [3300, 3400, 3500, 3700, 4000, 6200, 6800], // last two days in the shelter
      ),
    },
  },
}

function scenario(id: ScenarioId): ScenarioData {
  const { inputs, events, tracking } = PRESETS[id]
  return {
    ...simulate(inputs),
    ...events,
    ...tracking,
    reactionMs: inputs.reactionMs,
    mood: inputs.mood,
    alerts: isolationAlerts({
      sleepHours: inputs.sleepHours,
      sleepShiftHours: events.sleepShiftHours,
      reactionMs: inputs.reactionMs,
      mood: inputs.mood,
      activityMin: tracking.activityMin,
      baseline: { ...PRE_FLIGHT, activityMin: PRE_FLIGHT_ACTIVITY_MIN },
    }),
  }
}
const healthy = scenario('healthy')
const day60 = scenario('day60')
const critical = scenario('critical')

// Day-0 state, shared by every scenario for comparison.
const baseline: Baseline = {
  statuses: Object.fromEntries(
    Object.values(healthy.regions).map((r) => [r.id, r.status]),
  ) as Record<RegionId, Status>,
  boneDensity: { ...healthy.boneDensity },
  sleepHours: PRE_FLIGHT.sleepHours,
  reactionMs: PRE_FLIGHT.reactionMs,
  activityMin: PRE_FLIGHT_ACTIVITY_MIN,
}

export const SCENARIOS: Record<ScenarioId, ScenarioData & Pick<HealthState, 'baseline'>> = {
  healthy: { ...healthy, baseline },
  day60: { ...day60, baseline },
  critical: { ...critical, baseline },
}

// Keeps the compiler checking that every BonePart is covered above.
export const BONE_PARTS: BonePart[] = Object.keys(healthy.boneDensity) as BonePart[]
