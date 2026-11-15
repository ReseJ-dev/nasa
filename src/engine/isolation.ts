import type { Alert, AlertMetric, Vitals } from '../../3d/src/contract/types'
import * as C from './constants.ts'
import { statusOf, vitalDeviation } from './simulate.ts'

// Isolation and confinement: which self-tracked values are off the personal baseline.
// Pure function, same deviation scale as the regions. The 3D twin only displays the result.

export interface IsolationInputs {
  sleepHours: number
  sleepShiftHours: number
  reactionMs: number
  mood: number
  activityMin: number
  baseline: Pick<Vitals, 'sleepHours' | 'reactionMs' | 'mood'> & { activityMin: number }
}

export function isolationAlerts(input: IsolationInputs): Alert[] {
  const b = input.baseline
  const deviation: Record<AlertMetric, number> = {
    // short sleep or a shifted rhythm, whichever is worse
    sleep: Math.max(
      vitalDeviation('sleepHours', input.sleepHours, b.sleepHours),
      Math.abs(input.sleepShiftHours) / C.SLEEP_SHIFT_UNIT,
    ),
    reaction: vitalDeviation('reactionMs', input.reactionMs, b.reactionMs),
    activity: b.activityMin > 0 ? Math.max(1 - input.activityMin / b.activityMin, 0) / C.ACTIVITY_DROP_UNIT : 0,
    mood: vitalDeviation('mood', input.mood, b.mood),
  }
  const alerts: Alert[] = []
  for (const metric of Object.keys(deviation) as AlertMetric[]) {
    const status = statusOf(deviation[metric])
    if (status !== 'ok') alerts.push({ id: `isolation_${metric}`, hazard: 'isolation', metric, status })
  }
  return alerts
}
