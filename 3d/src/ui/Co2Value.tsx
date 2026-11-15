import type { Metric } from '../contract/types'
import { NO_DATA_LABEL } from '../twin/labels'
import { CO2_LABEL, CO2_LIMITS_TEXT, co2Display } from './co2'

// Cabin CO₂ as partial pressure, colored against the NASA limits; ppm is secondary text.
export function Co2Value({ metric }: { metric?: Metric }) {
  const co2 = metric && co2Display(metric.value)
  return (
    <div className="health-metric health-co2" data-status={co2?.status}>
      <dt>{CO2_LABEL}</dt>
      <dd>{co2 ? <>{co2.mmHg} <small>mmHg</small></> : <small>{NO_DATA_LABEL}</small>}</dd>
      {co2 && <dd className="health-metric-note">{co2.ppm} · {CO2_LIMITS_TEXT}</dd>}
    </div>
  )
}
