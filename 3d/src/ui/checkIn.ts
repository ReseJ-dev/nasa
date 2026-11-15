import type { Metric, Vitals } from '../contract/types'
import { PERSONAL_BASELINE } from '../../../src/data/baseline'
import type { MissionInputs } from '../../../src/engine/index'

// Pure rules of the daily check-in form (no React), so they can be tested on their own.

export type CheckInKey = Exclude<keyof Vitals, 'reactionMs'>

// Store metric that carries the current value of a check-in field (the metrics panel shows the same one).
export const CHECKIN_METRIC: Record<CheckInKey, string> = {
  systolic: 'systolic',
  diastolic: 'diastolic',
  heartRate: 'heart_rate',
  glucose: 'glucose',
  bodyTempC: 'body_temp',
  sleepHours: 'sleep_hours',
  mood: 'mood',
}

/**
 * Value a check-in field shows before the user types: the last check-in, else the current value
 * in the store (the one the metrics panel shows), else the personal pre-flight baseline.
 */
export function checkInDefault(
  key: CheckInKey,
  state: { inputs: Readonly<MissionInputs>; metrics: Metric[]; mood?: number },
): number {
  const usable = (v: number | undefined) => (v !== undefined && Number.isFinite(v) ? v : undefined)
  const checked = key === 'sleepHours' ? state.inputs.sleepHours : state.inputs.vitals?.[key]
  const metric = state.metrics.find((m) => m.id === CHECKIN_METRIC[key])?.value
  return usable(checked) ?? usable(metric) ?? (key === 'mood' ? usable(state.mood) : undefined) ?? PERSONAL_BASELINE[key]
}

/** A pressure pair is a typo unless systolic is above diastolic (e.g. 118/140 is not a reading). */
export const pressurePairValid = (systolic: number, diastolic: number) => systolic > diastolic
