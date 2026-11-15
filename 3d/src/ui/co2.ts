import type { Status } from '../contract/types'
import { CO2_LIMITS_MMHG, ppmToMmHg } from '../../../src/engine/constants'

// Cabin CO₂ for display: partial pressure in mmHg first, ppm as secondary text, and the status
// against the NASA limits (same limits as the engine's lungs region and the lungs chart).

export const CO2_LABEL = 'Cabin CO₂ (ppCO₂)'
export const CO2_LIMITS_TEXT = `NASA limits ${CO2_LIMITS_MMHG.warn} / ${CO2_LIMITS_MMHG.critical} mmHg`

const ppmFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 0 })

export function co2Display(ppm: number): { mmHg: string; ppm: string; status: Status } {
  const mmHg = ppmToMmHg(ppm)
  return {
    mmHg: mmHg.toFixed(1),
    ppm: `${ppmFormat.format(ppm)} ppm`,
    status: mmHg >= CO2_LIMITS_MMHG.critical ? 'critical' : mmHg >= CO2_LIMITS_MMHG.warn ? 'warning' : 'ok',
  }
}
