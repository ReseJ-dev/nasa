import type { SimInputs, Vitals } from '../../3d/src/contract/types'
import { PERSONAL_BASELINE } from '../data/baseline.ts'
import { simulate } from './simulate.ts'

export { simulate, type SimOutput } from './simulate.ts'
export { isolationAlerts } from './isolation.ts'
export { distanceThreatLevel, formatLevel, gravityThreatLevel, microgravityIndex } from './threats.ts'

/** Values from the daily check-in and the reaction test. Sleep is the separate `sleepHours` input. */
export type CheckIn = Partial<Omit<Vitals, 'sleepHours'>>

// A missing input (undefined, null, NaN) means "no data": it is left out of the scoring and of the
// metrics list. It is never read as 0, so it can never produce a low score or a critical status.
export interface MissionInputs {
  co2Ppm?: number
  sleepHours?: number
  /** Cumulative dose, supplied by the caller in mSv. */
  radiationMsv?: number
  /** Average unloading from mission start, 0 = Earth-like load, 1 = microgravity. */
  microgravity?: number
  /** Current isolation index, from 0 to 1. */
  isolation?: number
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

export type ComputedHealthState = ReturnType<typeof simulate>

type MissionContext = Partial<Pick<SimInputs, 'environment' | 'earthLink' | 'commDelaySec' | 'cabinTempC' | 'noiseDb'>>

export function missionSimulation(
  day: number,
  inputs: Readonly<MissionInputs>,
  exercise: Readonly<Exercise>,
  context: MissionContext = {},
) {
  const vitals = inputs.vitals
  return {
    input: {
      systolic: vitals?.systolic,
      diastolic: vitals?.diastolic,
      heartRate: vitals?.heartRate,
      glucose: vitals?.glucose,
      bodyTempC: vitals?.bodyTempC,
      mood: vitals?.mood,
      reactionMs: vitals?.reactionMs,
      sleepHours: inputs.sleepHours,
      baseline: inputs.baseline ?? PERSONAL_BASELINE,
      gravityField: 1 - Math.max(0, Math.min(1, inputs.microgravity || 0)),
      missionDay: day,
      environment: context.environment ?? 'station',
      earthLink: context.earthLink,
      commDelaySec: context.commDelaySec,
      cabinTempC: context.cabinTempC,
      noiseDb: context.noiseDb,
    },
    options: {
      ...exercise,
      co2Ppm: inputs.co2Ppm,
      cumulativeDoseMsv: inputs.radiationMsv,
      isolation: inputs.isolation,
      fluidShift: inputs.fluidShift,
    },
  }
}

/** Compatibility entry point for forecasts and charts. */
export function computeState(day: number, inputs: Readonly<MissionInputs>, exercise: Readonly<Exercise>) {
  const { input, options } = missionSimulation(day, inputs, exercise)
  return simulate(input, options)
}
