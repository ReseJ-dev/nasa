// Presentation presets for the 3D scene and scripted demo.
// Scenario data is produced by the shared engine from SimInputs presets;
// only events (flare, shelter, sleep shift, threat links) are set by hand here.
import type { Baseline, BonePart, HealthState, RegionId, SimInputs, Status } from '../contract/types'
import { isolationAlerts, simulate, type SimOutput } from '../../../src/engine'
import { PERSONAL_BASELINE as PRE_FLIGHT } from '../../../src/data/baseline'
import { CRITICAL_TELEMETRY as CRITICAL } from '../../../src/data/scenarios'

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
// Last 7 days, oldest first; the last entry is today: the same sleep, reaction, mood, activity and
// CO2 the store shows for that preset (test/presets.test.mjs checks it, so the charts do not jump).
// Synthetic demo self-tracking, hand-made to end at each preset's own values.
const week = (sleep: number[], activity: number[], reaction: number[], mood: number[], co2: number[]) =>
  activity.map((activityMin, i) => ({ sleepHours: sleep[i], activityMin, reactionMs: reaction[i], mood: mood[i], co2Ppm: co2[i] }))

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
        [7.9, 7.8, 8, 7.7, 7.8, 7.6, 7.5],
        [148, 152, 145, 150, 155, 147, 150],
        [252, 258, 254, 256, 259, 261, 263],
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
      mood: 4,
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
        [7.4, 7.2, 7, 6.9, 6.8, 6.7, 6.6],
        [145, 140, 132, 128, 120, 114, 110],
        [262, 266, 270, 273, 277, 280, 283],
        [4, 4, 4, 3, 4, 4, 4],
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
      sleepHours: CRITICAL.sleepHours, // calibrated telemetry (src/data/scenarios.ts)
      mood: 4,
      reactionMs: CRITICAL.reactionMs,
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
      sleepShiftHours: CRITICAL.sleepShiftHours,
      threatLinks: [
        { from: 'radiation', to: 'isolation', strength: 0.6 }, // shelter time cuts crew contact
        { from: 'isolation', to: 'environment', strength: 0.7 }, // closed shelter: CO2, heat, noise
        { from: 'environment', to: 'gravity', strength: 0.3 }, // less exercise in the shelter
      ],
    },
    // Two days in the shelter: exercise reduced, almost no bright light, mood holds.
    // The last day (today) is the calibrated Critical telemetry, so the charts do not jump.
    tracking: {
      brightLightMin: 20,
      reactionLapses: 5,
      activityMin: 115,
      history: week(
        [7.2, 7, 6.9, 6.7, 6.5, 6.2, CRITICAL.sleepHours],
        [148, 145, 140, 136, 130, 120, 115],
        [270, 274, 278, 282, 287, 294, CRITICAL.reactionMs],
        [4, 4, 4, 4, 3, 4, 4],
        [3300, 3400, 3500, 3700, 4000, 6400, CRITICAL.co2Ppm], // last two days in the shelter
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
