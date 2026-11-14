/**
 * NASA HRP-grounded synthetic demo fixtures — NOT observations or a clinical tool.
 * Reference: https://www.nasa.gov/hrp/risks/
 *            https://www.nasa.gov/hrp/hazards/
 *            https://www.nasa.gov/hrp/ongoing-hrp-research/
 *            https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/
 *            https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/
 *
 * Scaled scores, radiationLevel and fluidShift are illustrative visualization
 * indices, NOT validated medical thresholds. Bone changes follow ~1–1.5%
 * loss/month in weight-bearing areas (spine, hips, femurs), without assuming
 * that every individual loses bone at this rate. Solar flare and isolation
 * are *separate* hazards. CO2 -> brain is not evidence of CO2 -> SANS.
 */
import type {
  Baseline, BonePart, HealthState, Metric, RegionId, RegionState, Status,
} from '../../3d/src/contract/types'

export type ScenarioId = 'healthy' | 'day60' | 'critical'

/** Same scenario data fields as 3d/src/twin/mockStore.ts; no store methods. */
export type ScenarioData =
  Pick<HealthState, 'regions' | 'metrics' | 'boneDensity' | 'chain'> &
  Required<Pick<HealthState,
    'radiationLevel' | 'commDelaySec' | 'earthLink' | 'activeEvent' |
    'fluidShift' | 'chainLinks' | 'baseline'
  >>

export const BONE_PARTS: BonePart[] = [
  'skull', 'spine', 'ribs', 'arm_left', 'arm_right',
  'pelvis', 'leg_left', 'leg_right',
]

const REGION_IDS: RegionId[] = [
  'heart', 'brain', 'bones', 'muscles', 'eyes', 'immune', 'lungs',
]

const METRIC_IDS: Record<RegionId, string[]> = {
  heart: ['heart_rate'],
  brain: ['sleep_hours', 'reaction_ms', 'co2_ppm'],
  bones: ['bone_loss_pct'],
  muscles: ['muscle_loss_pct'],
  eyes: ['vision_score'],
  immune: ['radiation_msv'],
  lungs: ['co2_ppm'],
}

// Guidance applies to hazards/research, not clinical advice for a specific person.
const NASA_ADVICE: Record<RegionId, string> = {
  heart: 'По данным NASA HRP рекомендуются регулярные аэробные тренировки для поддержания сердечно-сосудистой формы.',
  brain: 'По данным NASA HRP исследуется влияние недосыпа, изоляции и повышенного CO₂ на самочувствие и работоспособность; важны мониторинг среды и режим сна.',
  bones: 'По данным NASA HRP рекомендуются упражнения с сопротивлением и наблюдение за потерей плотности нагружаемых костей.',
  muscles: 'По данным NASA HRP рекомендуются упражнения с сопротивлением для снижения потери мышечной силы в невесомости.',
  eyes: 'По данным NASA HRP исследуется связь сдвига жидкостей к голове с SANS; при изменениях зрения применяется медицинский мониторинг.',
  immune: 'По данным NASA HRP исследуются изменения иммунной системы под влиянием факторов полёта; доза радиации сама по себе не доказывает нарушение иммунитета.',
  lungs: 'По данным NASA HRP рекомендуется контроль и удаление CO₂ из воздуха; высокий CO₂ означает риск среды, а не доказанное поражение лёгких.',
}

type RegionFlags = Record<RegionId, readonly [Status, number]>

function makeRegions(flags: RegionFlags): Record<RegionId, RegionState> {
  return Object.fromEntries(REGION_IDS.map((id) => [
    id,
    {
      id,
      status: flags[id][0],
      score: flags[id][1],
      metrics: METRIC_IDS[id],
      advice: [NASA_ADVICE[id] + ' Не медицинская рекомендация.'],
    } satisfies RegionState,
  ])) as Record<RegionId, RegionState>
}

function makeMetrics(values: {
  heartRate: number
  sleepHours: number
  reactionMs: number
  co2Ppm: number
  radiationMsv: number
  boneLossPct: number
  muscleLossPct: number
  visionScore: number
}): Metric[] {
  return [
    { id: 'heart_rate', label: 'Heart rate', value: values.heartRate, unit: 'bpm' },
    { id: 'sleep_hours', label: 'Sleep', value: values.sleepHours, unit: 'h' },
    { id: 'reaction_ms', label: 'Reaction time', value: values.reactionMs, unit: 'ms' },
    { id: 'co2_ppm', label: 'Cabin CO₂', value: values.co2Ppm, unit: 'ppm' },
    { id: 'radiation_msv', label: 'Cumulative dose (demo)', value: values.radiationMsv, unit: 'mSv' },
    { id: 'bone_loss_pct', label: 'Weight-bearing bone loss (demo)', value: values.boneLossPct, unit: '%' },
    { id: 'muscle_loss_pct', label: 'Muscle loss (demo)', value: values.muscleLossPct, unit: '%' },
    { id: 'vision_score', label: 'Visual acuity (demo)', value: values.visionScore, unit: '' },
  ]
}

const healthy: Omit<ScenarioData, 'baseline'> = {
  regions: makeRegions({
    heart: ['ok', 94], brain: ['ok', 92], bones: ['ok', 96],
    muscles: ['ok', 93], eyes: ['ok', 95], immune: ['ok', 90], lungs: ['ok', 95],
  }),
  metrics: makeMetrics({
    heartRate: 64, sleepHours: 7.5, reactionMs: 260, co2Ppm: 2500,
    radiationMsv: 1, boneLossPct: 0, muscleLossPct: 0, visionScore: 1,
  }),
  boneDensity: {
    skull: 1, spine: 1, ribs: 1, arm_left: 1, arm_right: 1,
    pelvis: 1, leg_left: 1, leg_right: 1,
  },
  chain: [],
  radiationLevel: 0.1,
  commDelaySec: 2,
  earthLink: true,
  activeEvent: 'none',
  fluidShift: 0.1,
  chainLinks: [],
}

// Day 60, approximately 2 months: ~2–3% bone loss in weight-bearing sites.
const day60: Omit<ScenarioData, 'baseline'> = {
  regions: makeRegions({
    heart: ['ok', 86], brain: ['ok', 82], bones: ['warning', 68],
    muscles: ['warning', 64], eyes: ['warning', 72],
    immune: ['ok', 84], lungs: ['ok', 88],
  }),
  metrics: makeMetrics({
    heartRate: 70, sleepHours: 6.6, reactionMs: 285, co2Ppm: 3200,
    radiationMsv: 40, boneLossPct: 2.5, muscleLossPct: 6, visionScore: 0.9,
  }),
  boneDensity: {
    skull: 1, spine: 0.975, ribs: 0.995, arm_left: 0.995, arm_right: 0.995,
    pelvis: 0.972, leg_left: 0.976, leg_right: 0.976,
  },
  // Headward fluid shift is one studied SANS hypothesis, not a diagnosis.
  chain: ['brain', 'eyes'],
  radiationLevel: 0.35,
  commDelaySec: 240,
  earthLink: true,
  activeEvent: 'none',
  fluidShift: 0.5,
  chainLinks: [{
    from: 'brain', to: 'eyes',
    label: 'сдвиг жидкостей к голове — гипотеза SANS',
  }],
}

// Day 180, approximately 6 months: 6–9% bone loss in weight-bearing sites.
// Simultaneous solar flare, elevated CO2 and short sleep; NOT a medical case.
const critical: Omit<ScenarioData, 'baseline'> = {
  regions: makeRegions({
    heart: ['warning', 61], brain: ['critical', 38],
    bones: ['critical', 41], muscles: ['warning', 55],
    eyes: ['warning', 58], immune: ['warning', 52],
    lungs: ['critical', 32],
  }),
  metrics: makeMetrics({
    heartRate: 98, sleepHours: 4.2, reactionMs: 390, co2Ppm: 6800,
    radiationMsv: 210, boneLossPct: 7.5, muscleLossPct: 14, visionScore: 0.8,
  }),
  boneDensity: {
    skull: 0.995, spine: 0.925, ribs: 0.98, arm_left: 0.98, arm_right: 0.98,
    pelvis: 0.91, leg_left: 0.93, leg_right: 0.93,
  },
  // Elevated CO2 is associated with headaches; it does not cause SANS here.
  chain: ['lungs', 'brain'],
  radiationLevel: 0.8,
  commDelaySec: 720,
  earthLink: false,
  activeEvent: 'solar_flare',
  fluidShift: 0.7,
  chainLinks: [{
    from: 'lungs', to: 'brain',
    label: 'повышенный CO₂ — риск головной боли',
  }],
}

// All fixtures share the same stable baseline and stable chain references.
// A future store should reuse unchanged chain arrays to avoid replay in 3D.
const baseline: Baseline = {
  statuses: {
    heart: 'ok', brain: 'ok', bones: 'ok', muscles: 'ok',
    eyes: 'ok', immune: 'ok', lungs: 'ok',
  },
  boneDensity: { ...healthy.boneDensity },
}

export const SCENARIOS: Record<ScenarioId, ScenarioData> = {
  healthy: { ...healthy, baseline },
  day60: { ...day60, baseline },
  critical: { ...critical, baseline },
}
