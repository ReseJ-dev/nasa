import type { HealthState, RegionId, RegionState, Status, ThreatId } from '../contract/types'
import type { ScenarioId } from '../twin/store'

export type Cue = 'scenario' | 'warning' | 'critical' | 'flare'

type SoundState = Pick<HealthState, 'regions' | 'alerts' | 'threats' | 'activeEvent' | 'earthLink'> & {
  scenario: ScenarioId
}

export const CUE_PRIORITY: Record<Cue, number> = {
  scenario: 0,
  warning: 1,
  critical: 2,
  flare: 3,
}

export function transitionCue(
  previous: SoundState,
  next: SoundState,
  threatStatus: (id: ThreatId, level: number, regions: Partial<Record<RegionId, RegionState>> | undefined) => Status,
): Cue | undefined {
  if (previous.activeEvent !== 'solar_flare' && next.activeEvent === 'solar_flare') return 'flare'

  const transitions: Status[] = []
  for (const region of Object.values(next.regions)) {
    if (previous.regions[region.id]?.status !== region.status) transitions.push(region.status)
  }
  if (next.alerts !== previous.alerts) {
    const oldAlerts = new Map(previous.alerts?.map(alert => [alert.id, alert.status]))
    for (const alert of next.alerts ?? []) {
      if (oldAlerts.get(alert.id) !== alert.status) transitions.push(alert.status)
    }
  }
  if (next.threats && next.threats !== previous.threats) {
    for (const id of Object.keys(next.threats) as (keyof typeof next.threats)[]) {
      const status = threatStatus(id, next.threats[id].level, next.regions)
      const previousStatus = threatStatus(id, previous.threats?.[id].level ?? 0, previous.regions)
      if (previousStatus !== status) transitions.push(status)
    }
  }
  if (previous.earthLink !== false && next.earthLink === false) transitions.push('critical')
  if (transitions.includes('critical')) return 'critical'
  if (transitions.includes('warning')) return 'warning'
  if (previous.scenario !== next.scenario) return 'scenario'
  return undefined
}
