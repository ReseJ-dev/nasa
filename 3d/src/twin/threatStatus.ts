import type { RegionId, RegionState, Status, ThreatId } from '../contract/types'
import { THREAT_LEVEL } from './config'

// Status color of a threat in the strip (and the sound cue). Display only; the engine decides.
// Most threats: their level against THREAT_LEVEL. Gravity: its level is time in weightlessness,
// which grows the same with or without exercise, so it would turn red while exercise keeps the
// bones and muscles normal. Gravity therefore shows the worst status of the regions it harms
// most (bones, muscles), which the engine computes with the exercise plan.
const GRAVITY_REGIONS: RegionId[] = ['bones', 'muscles']
const RANK: Record<Status, number> = { ok: 0, warning: 1, critical: 2 }

export const levelStatus = (level: number): Status =>
  level >= THREAT_LEVEL.criticalAt ? 'critical' : level >= THREAT_LEVEL.warnAt ? 'warning' : 'ok'

export function threatStatus(id: ThreatId, level: number, regions: Partial<Record<RegionId, RegionState>> | undefined): Status {
  if (id !== 'gravity' || !regions) return levelStatus(level)
  return GRAVITY_REGIONS.map((r) => regions[r]?.status ?? 'ok').reduce((a, b) => (RANK[b] > RANK[a] ? b : a), 'ok' as Status)
}
