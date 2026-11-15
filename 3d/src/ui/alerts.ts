import type { Alert, AlertMetric, RegionId, RegionState, Status, ThreatId, ThreatState } from '../contract/types'
import { REGION_LABEL, STATUS_LABEL } from '../twin/labels'
import { ZONE_INFO } from '../../../src/data/zoneInfo'

// One list of alerts for the UI, built from what the engine already decided:
// - every region with a warning/critical status (engine regions),
// - every indicator alert in the store (isolation self-tracking: sleep, reaction, mood, activity).
// No thresholds here: levels come from the store; text comes from zoneInfo and the table below.

export type AlertLevel = Exclude<Status, 'ok'>

export interface AlertItem {
  id: string
  level: AlertLevel
  regionId: RegionId // zone panel to open
  regions: RegionId[] // regions to focus in 3D
  message: string
  hazard: ThreatId // shown as "Cause: <hazard>"
  action: string // already the autonomous version when Earth is not reachable
  source: string // rule source, shown on hover
  verified: boolean
  forecast: boolean
}

// Isolation indicator alerts carry a metric, not a region: the region they belong to.
export const ALERT_REGION: Record<AlertMetric, RegionId> = {
  sleep: 'brain',
  reaction: 'brain',
  mood: 'brain',
  activity: 'muscles',
}

export const METRIC_ALERT: Record<AlertMetric, { message: string; cause: string; action: string; source: string }> = {
  sleep: {
    message: 'Sleep is short or shifted from your normal schedule',
    cause: 'sleep is short or shifted from your normal schedule',
    action: 'Plan a full sleep window tonight and avoid screens before bed.',
    source: 'NASA HRP: inadequate sleep',
  },
  reaction: {
    message: 'Reaction test is slower than your normal',
    cause: 'reaction test is slower than your normal',
    action: 'Repeat the reaction test after a break and postpone critical tasks.',
    source: 'NASA HRP: behavioral conditions; inadequate sleep',
  },
  mood: {
    message: 'Mood is lower than your normal',
    cause: 'mood is lower than your normal',
    action: 'Talk to a crewmate about how you feel.',
    source: 'NASA HRP: behavioral conditions',
  },
  activity: {
    message: 'Exercise is below your normal',
    cause: 'exercise is below your normal',
    action: 'Do the planned exercise session today.',
    source: 'NASA HRP: reduced cardiorespiratory and musculoskeletal fitness',
  },
}

// Same action, adapted for no contact with Earth.
export const autonomousAction = (action: string) =>
  `Autonomous protocol: ${action} Tell a crew member and log it for Earth.`

const LEVEL_ORDER: Record<AlertLevel, number> = { critical: 0, warning: 1 }

export function buildAlerts({
  regions,
  alerts,
  threats,
  earthLink,
}: {
  regions: Record<RegionId, RegionState>
  alerts: Alert[] | undefined
  threats: Record<ThreatId, ThreatState> | undefined
  earthLink: boolean
}): AlertItem[] {
  const adapt = (action: string) => (earthLink ? action : autonomousAction(action))
  const items: AlertItem[] = []

  for (const region of Object.values(regions)) {
    if (region.status === 'ok') continue
    const zone = ZONE_INFO[region.id]
    // Cause: the region's hazard that is strongest right now.
    const hazard = [...zone.hazards].sort((a, b) => (threats?.[b.hazard].level ?? 0) - (threats?.[a.hazard].level ?? 0))[0]
      ?.hazard
    if (!hazard) continue
    items.push({
      id: `region_${region.id}`,
      level: region.status,
      regionId: region.id,
      regions: [region.id],
      message: `${REGION_LABEL[region.id]}: ${STATUS_LABEL[region.status].toLowerCase()} · score ${region.score}`,
      hazard,
      action: adapt(zone.actions[region.status][0]),
      source: zone.source,
      verified: zone.verified,
      forecast: (region.source ?? zone.measurement) === 'forecast',
    })
  }

  for (const alert of alerts ?? []) {
    const info = METRIC_ALERT[alert.metric]
    const regionId = ALERT_REGION[alert.metric]
    items.push({
      id: alert.id,
      level: alert.status,
      regionId,
      regions: [regionId],
      message: info.message,
      hazard: alert.hazard,
      action: adapt(info.action),
      source: info.source,
      verified: false,
      forecast: false, // self-tracked today
    })
  }

  // Critical first; inside a level, measured indicators before region summaries, then by name.
  return items.sort(
    (a, b) =>
      LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] ||
      Number(a.id.startsWith('region_')) - Number(b.id.startsWith('region_')) ||
      a.message.localeCompare(b.message),
  )
}
