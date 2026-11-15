import type {
  BonePart,
  ChainLink,
  Escalation,
  HealthState,
  Metric,
  RegionId,
  RegionState,
  SimInputs,
  Source,
  Status,
  ThreatId,
  ThreatState,
  Vitals,
} from '../../3d/src/contract/types'
import * as C from './constants.ts'
import { distanceThreatLevel, gravityThreatLevel, microgravityIndex } from './threats.ts'
import { ADVICE } from './advice.ts'

// Reference simulation: SimInputs -> the computed part of HealthState.
// Pure function, no React, no store. Statuses come from the deviation from the
// personal pre-flight baseline (constants.ts), not from a fixed table.

export type SimOutput = Pick<HealthState, 'regions' | 'metrics' | 'boneDensity' | 'chain'> &
  Required<
    Pick<
      HealthState,
      | 'boneSource'
      | 'chainLinks'
      | 'threats'
      | 'radiationLevel'
      | 'commDelaySec'
      | 'earthLink'
      | 'gravityField'
      | 'fluidShift'
      | 'muscleMass'
      | 'co2Level'
      | 'cabinTempC'
      | 'noiseDb'
      | 'sleepHours'
      | 'missionDay'
    >
  >

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1)
const bounded = (value: number | undefined, max: number) =>
  typeof value === 'number' && !Number.isNaN(value) ? Math.max(0, Math.min(max, value)) : NaN

export function statusOf(deviation: number): Status {
  if (deviation >= C.CRITICAL_AT) return 'critical'
  if (deviation >= C.WARN_AT) return 'warning'
  return 'ok'
}

// Deviation of one vital from its baseline, in tolerance units (0 = at baseline).
export function vitalDeviation(key: keyof Vitals, value: number, baseline: number) {
  const { unit, direction } = C.TOLERANCE[key]
  const d = (value - baseline) / unit
  if (direction === 'up') return Math.max(d, 0)
  if (direction === 'down') return Math.max(-d, 0)
  return Math.abs(d)
}

// One cause of a region's deviation; the largest one decides the status and the first advice.
interface Cause {
  key: string // advice key in C.ADVICE
  deviation: number
}

const VITAL_METRIC: Record<keyof Vitals, string> = {
  systolic: 'systolic',
  diastolic: 'diastolic',
  heartRate: 'heart_rate',
  glucose: 'glucose',
  bodyTempC: 'body_temp',
  sleepHours: 'sleep_hours',
  mood: 'mood',
  reactionMs: 'reaction_ms',
}

function escalationOf(status: Status, earthLink: boolean): Escalation {
  if (status === 'ok') return 'self'
  if (status === 'warning') return 'crew'
  return earthLink ? 'ground' : 'crew' // no Earth: the crew handles it (autonomous protocol)
}

function region(
  id: RegionId,
  causes: Cause[],
  metrics: string[],
  source: Source,
  earthLink: boolean,
): RegionState {
  // A cause without a usable number is "no data": left out, never scored as 0 or NaN.
  const sorted = causes.filter((c) => Number.isFinite(c.deviation)).sort((a, b) => b.deviation - a.deviation)
  if (sorted.length === 0) {
    return { id, status: 'ok', score: 100, metrics: [], advice: [], source, escalation: 'self', noData: true }
  }
  const deviation = sorted[0].deviation
  const status = statusOf(deviation)
  const advice: string[] = []
  if (status !== 'ok') {
    // every warning/critical region gets at least one concrete action, top cause first
    for (const c of sorted) if (c.deviation >= C.WARN_AT && C.ADVICE[c.key]) advice.push(C.ADVICE[c.key])
    if (advice.length === 0 && sorted[0]) advice.push(C.ADVICE[sorted[0].key])
  }
  if (status === 'critical' && !earthLink) advice.push(C.AUTONOMOUS_ADVICE) // escalation 'ground' -> 'crew'
  const [guidance, reference] = ADVICE[id]
  advice.push(`${guidance} NASA HRP: ${reference}. Not medical advice.`)
  return {
    id,
    status,
    score: Math.round(Math.min(Math.max(100 - deviation * C.SCORE_PER_UNIT, 0), 100)),
    metrics,
    advice,
    source,
    escalation: escalationOf(status, earthLink),
  }
}

type LiveInputs = Omit<Partial<SimInputs>, 'environment' | 'missionDay' | 'baseline'> &
  Pick<SimInputs, 'environment' | 'missionDay' | 'baseline'>

interface MissionOptions {
  aerobic: number
  resistance: number
  co2Ppm?: number
  cumulativeDoseMsv?: number
  isolation?: number
  fluidShift?: number
}

export function simulate(raw: LiveInputs, options?: MissionOptions): SimOutput {
  const input = {
    ...raw,
    ...Object.fromEntries((Object.keys(C.TOLERANCE) as (keyof Vitals)[]).map(key => {
      const value = raw[key]
      return [key, typeof value === 'number' && Number.isFinite(value) && (value > 0 || key === 'sleepHours' && value === 0) ? value : NaN]
    })),
  } as LiveInputs & Vitals
  const env = C.ENVIRONMENTS[input.environment]
  const gravityField = input.gravityField ?? env.gravityField
  const dose = bounded(options?.cumulativeDoseMsv, Number.MAX_VALUE)
  const radiationLevel = options
    ? (Number.isFinite(dose) ? clamp01(dose / C.CUMULATIVE_RADIATION_SCALE_MSV) : 0)
    : input.radiationLevel ?? clamp01(env.doseMsvPerDay / C.RADIATION_SCALE_MSV_DAY)
  const commDelaySec = input.commDelaySec ?? env.commDelaySec
  const earthLink = input.earthLink ?? true
  const days = bounded(input.missionDay, Number.MAX_VALUE) || 0
  const months = days / C.DAYS_PER_MONTH
  const microgravity = microgravityIndex(gravityField) // 1 in 0 g, 0 on Earth
  const resistance = bounded(options?.resistance, 1) || 0
  const aerobic = bounded(options?.aerobic, 1) || 0
  const unloadedMonths = months * microgravity

  // ---- Forecasts (no in-flight measurement) ----
  const boneDensity = Object.fromEntries(
    (Object.keys(C.BONE_LOSS_PER_MONTH) as BonePart[]).map((p) => [
      p,
      clamp01(1 - C.BONE_LOSS_PER_MONTH[p] * unloadedMonths * (1 - 0.65 * resistance)),
    ]),
  ) as Record<BonePart, number>
  const boneSource = Object.fromEntries(
    (Object.keys(boneDensity) as BonePart[]).map((p) => [p, days > 0 ? 'forecast' : 'measured']),
  ) as Record<BonePart, Source> // in flight bones are always a forecast; day 0 = pre-flight scan
  const muscleMass = clamp01(1 - C.MUSCLE_LOSS_PER_MONTH * unloadedMonths * (1 - 0.7 * resistance))
  const fluidOverride = options?.fluidShift
  const fluidShift = typeof fluidOverride === 'number' && Number.isFinite(fluidOverride) ? clamp01(fluidOverride)
    : clamp01((days === 0 && options ? 0 : C.FLUID_SHIFT_START + days * C.FLUID_SHIFT_PER_DAY) * microgravity)
  const ppm = bounded(options?.co2Ppm, 1_000_000)
  const co2Level = options ? clamp01((ppm - 2500) / 4500) : input.co2Level ?? NaN
  const mmHg = C.ppmToMmHg(ppm)
  const { warn, critical } = C.CO2_LIMITS_MMHG
  const co2Dev = options
    ? mmHg < warn ? 0 : mmHg < critical ? 1 + (mmHg - warn) / (critical - warn) : 2 + (mmHg - critical) / 2
    : co2Level / C.CO2_UNIT
  const known = (v: number) => (Number.isFinite(v) ? v : 0)
  const measured = { heart: Number.isFinite(input.heartRate), reaction: Number.isFinite(input.reactionMs), glucose: Number.isFinite(input.glucose) }
  const deconditioning = clamp01(unloadedMonths / 6) * (1 - 0.65 * aerobic)
  const sleepDeficit = known(clamp01((8 - input.sleepHours) / 6))
  const isolation = bounded(options?.isolation, 1) || 0
  if (options) {
    if (!measured.heart) input.heartRate = Math.round(64 + 30 * deconditioning)
    if (!measured.reaction) input.reactionMs = Math.round(255 + 180 * clamp01(0.5 * sleepDeficit + 0.25 * isolation + 0.25 * known(co2Level)))
    if (!measured.glucose) input.glucose = 5 + 3 * clamp01(0.5 * deconditioning + 0.5 * sleepDeficit)
  }

  // ---- Regions ----
  const vitalCauses = (id: RegionId): Cause[] =>
    Object.entries(C.REGION_INPUTS[id] ?? {}).map(([key, weight]) => {
      const k = key as keyof Vitals
      return { key: k, deviation: weight! * vitalDeviation(k, input[k], input.baseline[k]) }
    })
  const vitalMetrics = (id: RegionId) => Object.keys(C.REGION_INPUTS[id] ?? {}).map((k) => VITAL_METRIC[k as keyof Vitals])
  const co2Metric = options ? 'co2_ppm' : 'co2'
  const radiationMetric = options ? 'radiation_msv' : 'radiation'
  const minBone = Math.min(...Object.values(boneDensity))
  const r = (id: RegionId, causes: Cause[], metrics: string[], source: Source) =>
    region(id, causes, metrics, source, earthLink)

  const regions: Record<RegionId, RegionState> = {
    heart: r('heart', vitalCauses('heart'), vitalMetrics('heart'), measured.heart ? 'measured' : 'forecast'),
    immune: r(
      'immune',
      [...vitalCauses('immune'), { key: 'radiation', deviation: options && !Number.isFinite(dose) ? NaN : radiationLevel / C.RADIATION_UNIT }],
      [...vitalMetrics('immune'), radiationMetric],
      'measured',
    ),
    metabolism: r('metabolism', vitalCauses('metabolism'), vitalMetrics('metabolism'), measured.glucose ? 'measured' : 'forecast'),
    brain: r(
      'brain',
      [...vitalCauses('brain'), { key: 'co2', deviation: (options ? co2Level / C.CO2_UNIT : co2Dev) * C.CO2_BRAIN_WEIGHT }],
      [...vitalMetrics('brain'), co2Metric],
      measured.reaction || Number.isFinite(input.sleepHours) || Number.isFinite(input.mood) ? 'measured' : 'forecast',
    ),
    lungs: r('lungs', [{ key: 'co2', deviation: co2Dev }], [co2Metric], 'measured'),
    eyes: r(
      'eyes',
      [{ key: 'eyes', deviation: Math.max(fluidShift - C.EYES_FLUID_FROM, 0) / C.EYES_UNIT }],
      ['vision_score', 'fluid_shift'],
      days > 0 ? 'forecast' : 'measured',
    ),
    bones: r('bones', [{ key: 'bones', deviation: (1 - minBone) / C.BONE_UNIT }], ['bone_loss_pct', 'bone_density'], days > 0 ? 'forecast' : 'measured'),
    muscles: r(
      'muscles',
      [{ key: 'muscles', deviation: (1 - muscleMass) / C.MUSCLE_UNIT }],
      ['muscle_loss_pct', 'muscle_mass'],
      days > 0 ? 'forecast' : 'measured',
    ),
  }

  // ---- Cause chains (both ends not ok) ----
  const bad = (id: RegionId) => regions[id].status !== 'ok'
  let chain: RegionId[] = []
  if (bad('lungs') && co2Level / C.CO2_UNIT * C.CO2_BRAIN_WEIGHT >= C.WARN_AT) chain = ['lungs', 'brain']
  else if (bad('eyes')) chain = ['brain', 'eyes']
  else if (bad('muscles') && bad('bones')) chain = ['muscles', 'bones']
  const chainLinks: ChainLink[] = []
  for (let i = 0; i + 1 < chain.length; i++) {
    const label = C.CHAIN_LABELS[`${chain[i]}>${chain[i + 1]}`]
    if (label) chainLinks.push({ from: chain[i], to: chain[i + 1], label })
  }

  // ---- Threats ----
  const moodDev = known(vitalDeviation('mood', input.mood, input.baseline.mood))
  const sleepDev = known(vitalDeviation('sleepHours', input.sleepHours, input.baseline.sleepHours))
  const levels: Record<ThreatId, number> = {
    radiation: radiationLevel,
    isolation: Math.max(isolation, clamp01((days / C.ISOLATION_DAYS) * 0.6 + moodDev * 0.15 + sleepDev * 0.1)),
    gravity: gravityThreatLevel(microgravity, days),
    distance: distanceThreatLevel(commDelaySec),
    environment: clamp01(known(co2Level)),
  }
  const threats = Object.fromEntries(
    (Object.keys(levels) as ThreatId[]).map((id) => [id, { level: levels[id], regions: C.THREAT_REGIONS[id] }]),
  ) as Record<ThreatId, ThreatState>

  // ---- Metrics (also feeds the 3D heartbeat via heart_rate) ----
  const m = (id: string, label: string, value: number, unit: string): Metric => ({ id, label, value, unit })
  const metrics: Metric[] = [
    m('heart_rate', 'Heart rate', input.heartRate, 'bpm'),
    m('systolic', 'Systolic pressure', input.systolic, 'mmHg'),
    m('diastolic', 'Diastolic pressure', input.diastolic, 'mmHg'),
    m('glucose', 'Glucose', input.glucose, 'mmol/L'),
    m('body_temp', 'Body temperature', input.bodyTempC, '°C'),
    m('sleep_hours', 'Sleep', input.sleepHours, 'h'),
    m('mood', 'Mood', input.mood, '/5'),
    m('reaction_ms', 'Reaction time', input.reactionMs, 'ms'),
    m('co2', 'Cabin CO2', Math.round(co2Level * 100), '%'),
    m('co2_ppm', 'Cabin CO₂', ppm, 'ppm'),
    m('radiation_msv', 'Cumulative dose (demo)', dose, 'mSv'),
    m('radiation', 'Radiation', Math.round(radiationLevel * 100), '%'),
    m('fluid_shift', 'Fluid shift (forecast)', Math.round(fluidShift * 100), '%'),
    m('bone_density', 'Lowest bone density (forecast)', Math.round(minBone * 100), '%'),
    m('muscle_mass', 'Muscle mass (forecast)', Math.round(muscleMass * 100), '%'),
    m('bone_loss_pct', 'Weight-bearing bone density loss (forecast)', 100 * (1 - (boneDensity.spine + boneDensity.pelvis + boneDensity.leg_left + boneDensity.leg_right) / 4), '%'),
    m('muscle_loss_pct', 'Muscle loss (forecast)', (1 - muscleMass) * 100, '%'),
    m('vision_score', 'Visual acuity (forecast)', 1 - 0.35 * fluidShift, ''),
  ].filter((metric) => Number.isFinite(metric.value)) // a missing input has no metric
  const available = new Set(metrics.map(metric => metric.id))
  for (const region of Object.values(regions)) region.metrics = region.metrics.filter(id => available.has(id))

  return {
    regions,
    metrics,
    boneDensity,
    boneSource,
    chain,
    chainLinks,
    threats,
    radiationLevel,
    commDelaySec,
    earthLink,
    gravityField,
    fluidShift,
    muscleMass,
    co2Level: known(co2Level),
    cabinTempC: input.cabinTempC ?? 0,
    noiseDb: input.noiseDb ?? 0,
    sleepHours: input.sleepHours,
    missionDay: days,
  }
}
