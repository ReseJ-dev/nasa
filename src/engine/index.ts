import type { BonePart, ChainLink, HealthState, Metric, RegionId, RegionState, Vitals } from '../../3d/src/contract/types'
import { REGION_INPUTS, TOLERANCE } from '../../3d/src/sim/constants.ts'
import { PERSONAL_BASELINE } from '../data/baseline.ts'
import { ADVICE } from './advice.ts'

/** Values from the daily check-in and the reaction test. Sleep is the separate `sleepHours` input. */
export type CheckIn = Partial<Omit<Vitals, 'sleepHours'>>

export interface MissionInputs {
  co2Ppm: number
  sleepHours: number
  /** Cumulative dose, supplied by the caller in mSv. */
  radiationMsv: number
  /** Average unloading from mission start, 0 = Earth-like load, 1 = microgravity. */
  microgravity: number
  /** Current isolation index, from 0 to 1. */
  isolation: number
  /** Optional headward fluid shift index, from 0 to 1. */
  fluidShift?: number
  /** Optional measured values (daily check-in, reaction test). Missing fields keep the demo model. */
  vitals?: CheckIn
  /** Optional personal pre-flight values; defaults to the demo crew member (src/data/baseline.ts). */
  baseline?: Vitals
}

export interface Exercise {
  /** Average fractions of the demo training plan completed since mission start, from 0 to 1. */
  aerobic: number
  resistance: number
}

export type ComputedHealthState =
  Pick<HealthState, 'regions' | 'metrics' | 'boneDensity' | 'chain'> &
  Required<Pick<HealthState, 'radiationLevel' | 'fluidShift' | 'chainLinks'>>

// Relative density loss per 30 days of full unloading without exercise.
// NASA reports ~1–1.5%/month in weight-bearing bones during four-to-six-month missions.
const MONTHLY_BONE_LOSS = {
  skull: 0.0005,
  spine: 0.0125,
  ribs: 0.003,
  arm_left: 0.0025,
  arm_right: 0.0025,
  pelvis: 0.015,
  leg_left: 0.013,
  leg_right: 0.013,
} satisfies Record<BonePart, number>

function clamp(value: number, max = 1): number {
  return Number.isNaN(value) ? 0 : Math.max(0, Math.min(max, value))
}

function metric(id: string, label: string, value: number, unit: string): Metric {
  return { id, label, value, unit }
}

// Deviation of a measured value from the personal baseline, in tolerance units
// (same scale as the reference sim: 3d/src/sim/constants.ts, TOLERANCE).
function deviation(key: keyof Vitals, value: number, baseline: number): number {
  if (!Number.isFinite(value)) return 0
  const { unit, direction } = TOLERANCE[key]
  const d = (value - baseline) / unit
  return direction === 'up' ? Math.max(d, 0) : direction === 'down' ? Math.max(-d, 0) : Math.abs(d)
}

// Penalty from the largest weighted deviation of the region's measured inputs.
// Piecewise so the statuses match the reference sim: under 1 unit ok, 1..2 warning, 2+ critical
// (score 80 and 50 are the status boundaries in region()).
function vitalsPenalty(id: RegionId, vitals: CheckIn, baseline: Vitals): number {
  let worst = 0
  for (const [key, weight] of Object.entries(REGION_INPUTS[id] ?? {})) {
    const value = vitals[key as keyof CheckIn]
    if (value === undefined) continue
    worst = Math.max(worst, (weight ?? 0) * deviation(key as keyof Vitals, value, baseline[key as keyof Vitals]))
  }
  if (worst < 1) return worst * 20
  if (worst < 2) return 21 + (worst - 1) * 29
  return Math.min(51 + (worst - 2) * 25, 100)
}

function region(id: RegionId, penalty: number, ...metrics: Metric[]): RegionState {
  const score = Math.round(100 - clamp(penalty, 100))
  const [guidance, source] = ADVICE[id]
  return {
    id,
    // Status boundaries classify demo scores for the visualization.
    status: score >= 80 ? 'ok' : score >= 50 ? 'warning' : 'critical',
    score,
    metrics: metrics.map(({ id: metricId }) => metricId),
    advice: [`${guidance} Источник NASA HRP и материалы NASA: ${source}. Не медицинская рекомендация.`],
  }
}

function displayLink(co2Stress: number, fluidShift: number): ChainLink[] {
  // One link fits the current display contract. Choose the larger demo signal,
  // with CO₂ first on ties. A shared region does not connect the two mechanisms.
  if (Math.max(co2Stress, fluidShift) < 0.25) return []
  if (co2Stress >= fluidShift) {
    return [{ from: 'lungs', to: 'brain', label: 'Повышенный CO₂ в кабине связан с риском головной боли' }]
  }
  return [{ from: 'brain', to: 'eyes', label: 'Сдвиг жидкостей к голове — исследуемая гипотеза SANS' }]
}

/** Computes a demo snapshot at elapsed mission day 0 or later. */
export function computeState(day: number, inputs: Readonly<MissionInputs>, exercise: Readonly<Exercise>): ComputedHealthState {
  const days = clamp(day, Number.MAX_VALUE)
  const unloading = clamp(inputs.microgravity)
  const unloadedMonths = days / 30 * unloading
  const resistance = clamp(exercise.resistance)
  const aerobic = clamp(exercise.aerobic)
  const co2 = metric('co2_ppm', 'Cabin CO₂', clamp(inputs.co2Ppm, 1_000_000), 'ppm')
  const sleep = metric('sleep_hours', 'Sleep', clamp(inputs.sleepHours, 24), 'h')
  const dose = metric('radiation_msv', 'Cumulative dose (demo)', clamp(inputs.radiationMsv, Number.MAX_VALUE), 'mSv')

  // These scales and exercise effects tune the demo presentation. The NASA
  // sources support the direction of effects, while the model supplies the magnitudes.
  const co2Stress = clamp((co2.value - 2500) / 4500)
  const sleepDeficit = clamp((8 - sleep.value) / 6)
  const isolation = clamp(inputs.isolation)
  const radiationLevel = clamp(dose.value / 250)
  const fluidShift = clamp(inputs.fluidShift ?? unloading * (1 - Math.exp(-days / 45)))
  const deconditioning = clamp(unloadedMonths / 6) * (1 - 0.65 * aerobic)
  const cognitiveStress = clamp(0.5 * sleepDeficit + 0.25 * isolation + 0.25 * co2Stress)

  const boneExposure = unloadedMonths * (1 - 0.65 * resistance)
  const boneDensity = Object.fromEntries(
    Object.entries(MONTHLY_BONE_LOSS).map(([part, rate]) => [part, clamp(1 - rate * boneExposure)]),
  ) as Record<BonePart, number>
  const loadBearingDensity = (boneDensity.spine + boneDensity.pelvis + boneDensity.leg_left + boneDensity.leg_right) / 4
  const boneLoss = metric('bone_loss_pct', 'Weight-bearing bone density loss (demo)', (1 - loadBearingDensity) * 100, '%')
  const muscleLoss = metric('muscle_loss_pct', 'Muscle loss (demo)', 100 * clamp(0.03 * unloadedMonths * (1 - 0.7 * resistance)), '%')
  const heartRate = metric('heart_rate', 'Heart rate (demo)', Math.round(64 + 30 * deconditioning), 'bpm')
  const reaction = metric('reaction_ms', 'Reaction time (demo)', Math.round(260 + 180 * cognitiveStress), 'ms')
  const vision = metric('vision_score', 'Visual acuity (demo)', 1 - 0.35 * fluidShift, '')
  const glucoseModel = metric('glucose', 'Glucose (demo)', 5 + 3 * clamp(0.5 * deconditioning + 0.5 * sleepDeficit), 'mmol/L')

  // Measured check-in values replace the demo model where given and add their own penalty.
  const vitals = inputs.vitals ?? {}
  const baseline = inputs.baseline ?? PERSONAL_BASELINE
  const measured = (model: Metric, value: number | undefined, label: string, max: number): Metric =>
    value === undefined || !Number.isFinite(value) ? model : metric(model.id, label, clamp(value, max), model.unit)
  const pulse = measured(heartRate, vitals.heartRate, 'Heart rate', 300)
  const reactionTime = measured(reaction, vitals.reactionMs, 'Reaction time', 10_000)
  const glucose = measured(glucoseModel, vitals.glucose, 'Glucose', 50)
  const optional = (id: string, label: string, value: number | undefined, unit: string, max: number) =>
    value === undefined || !Number.isFinite(value) ? [] : [metric(id, label, clamp(value, max), unit)]
  const systolic = optional('systolic', 'Systolic pressure', vitals.systolic, 'mmHg', 300)
  const diastolic = optional('diastolic', 'Diastolic pressure', vitals.diastolic, 'mmHg', 200)
  const bodyTemp = optional('body_temp', 'Body temperature', vitals.bodyTempC, '°C', 45)
  const mood = optional('mood', 'Mood', vitals.mood, '/5', 5)
  const vp = (id: RegionId) => vitalsPenalty(id, vitals, baseline)

  const chainLinks = displayLink(co2Stress, fluidShift)
  const link = chainLinks[0]
  return {
    regions: {
      heart: region('heart', Math.max(60 * deconditioning, vp('heart')), pulse, ...systolic, ...diastolic, ...bodyTemp),
      brain: region('brain', Math.max(80 * cognitiveStress + 15 * fluidShift, vp('brain')), sleep, reactionTime, co2, ...mood),
      bones: region('bones', 7 * boneLoss.value, boneLoss),
      muscles: region('muscles', 4 * muscleLoss.value, muscleLoss),
      eyes: region('eyes', 60 * fluidShift, vision),
      immune: region('immune', Math.max(60 * radiationLevel, vp('immune')), dose, ...bodyTemp),
      lungs: region('lungs', 75 * co2Stress, co2),
      // A measured glucose replaces the modelled one, so only the measurement counts then.
      metabolism: region('metabolism', glucose === glucoseModel ? 40 * clamp(glucoseModel.value - 5, 3) / 3 : vp('metabolism'), glucose),
    },
    metrics: [pulse, sleep, reactionTime, co2, dose, boneLoss, muscleLoss, vision, glucose, ...systolic, ...diastolic, ...bodyTemp, ...mood],
    boneDensity,
    radiationLevel,
    fluidShift,
    chain: link ? [link.from, link.to] : [],
    chainLinks,
  }
}
