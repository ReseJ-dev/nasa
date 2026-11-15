import { DISTANCE_DELAY_FULL_SEC, GRAVITY_THREAT_DAYS } from './constants'

// The ONE definition of the microgravity index and of the threat levels that follow live inputs.
// The reference sim (simulate.ts), the app store (twin/store.ts), the threats strip and the
// metrics panel all read these, so the same number is shown everywhere, on the same 0..1 scale.

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(Math.max(v, 0), 1) : 0)

/** Exposure right now: 1 = weightless (0 g), 0 = Earth gravity (1 g). */
export const microgravityIndex = (gravityField: number) => clamp01(1 - gravityField)

/**
 * Gravity threat level: the microgravity index accumulated over the mission.
 * 0 on day 0 whatever the index is; reaches the index itself after GRAVITY_THREAT_DAYS.
 */
export const gravityThreatLevel = (microgravity: number, day: number) =>
  clamp01(clamp01(microgravity) * (day / GRAVITY_THREAT_DAYS))

/** Distance threat level from the one-way signal delay to Earth. */
export const distanceThreatLevel = (commDelaySec: number) => clamp01(commDelaySec / DISTANCE_DELAY_FULL_SEC)

/** One format for every 0..1 index and threat level: whole percent. */
export const formatLevel = (level: number) => `${Math.round(clamp01(level) * 100)}%`
