export const DELAYED_EARTH_TEXT = 'Follow on-board protocol; Earth informed with delay'
export const SPE_LIMIT_LABEL = 'NASA design limit for one solar particle event'

export const delayedEarth = (oneWaySeconds: number | undefined) => (oneWaySeconds ?? 0) > 300
