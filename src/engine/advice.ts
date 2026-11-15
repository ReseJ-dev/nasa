import type { RegionId } from '../../3d/src/contract/types'

const hrpRisks = 'https://www.nasa.gov/hrp/risks/'

export const ADVICE: Record<RegionId, readonly [string, string]> = {
  heart: ['Keep up aerobic exercise while tracking how the heart adapts to microgravity.', hrpRisks],
  brain: ['Track sleep and workload during long isolation. High CO₂ is linked to headache risk.', 'https://www.nasa.gov/hrp/hazard-isolation-and-confinement/ and https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/'],
  bones: ['Keep up resistance exercise and track weight-bearing bone density in microgravity.', 'https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/'],
  muscles: ['Keep up resistance exercise to maintain muscle in microgravity.', hrpRisks],
  eyes: ['Track vision changes. Headward fluid shift is studied as a possible cause of SANS.', 'https://humanresearchroadmap.nasa.gov/Gaps/gap.aspx?i=675'],
  immune: ['Track radiation dose as one possible factor in immune risk. Judging immunity needs separate data.', 'https://humanresearchroadmap.nasa.gov/gaps/gap.aspx?i=818'],
  lungs: ['Track cabin CO₂ and the CO₂ removal system. The score reflects the effect of cabin air on breathing.', 'https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/'],
  metabolism: ['Track glucose together with meals, sleep and exercise.', hrpRisks],
}
