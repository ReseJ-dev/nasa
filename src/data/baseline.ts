import type { Vitals } from '../../3d/src/contract/types'

/**
 * Personal pre-flight baseline of the demo crew member (synthetic values, not a real person).
 * Daily check-in values are compared with these, not with fixed population tables.
 * Same values as PRE_FLIGHT in 3d/src/twin/mockStore.ts (the scene presets); keep them in sync.
 */
export const PERSONAL_BASELINE: Vitals = {
  systolic: 118,
  diastolic: 76,
  heartRate: 62,
  glucose: 5.0,
  bodyTempC: 36.6,
  sleepHours: 8,
  mood: 4,
  reactionMs: 255,
}
