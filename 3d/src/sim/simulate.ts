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
} from '../contract/types'
import * as C from './constants'

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
  const sorted = [...causes].sort((a, b) => b.deviation - a.deviation)
  const deviation = sorted[0]?.deviation ?? 0
  const status = statusOf(deviation)
  const advice: string[] = []
  if (status !== 'ok') {
    // every warning/critical region gets at least one concrete action, top cause first
    for (const c of sorted) if (c.deviation >= C.WARN_AT && C.ADVICE[c.key]) advice.push(C.ADVICE[c.key])
    if (advice.length === 0 && sorted[0]) advice.push(C.ADVICE[sorted[0].key])
  }
  if (status === 'critical' && !earthLink) advice.push(C.AUTONOMOUS_ADVICE) // escalation 'ground' -> 'crew'
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

export function simulate(input: SimInputs): SimOutput {
  const env = C.ENVIRONMENTS[input.environment]
  const gravityField = input.gravityField ?? env.gravityField
  const radiationLevel = input.radiationLevel ?? clamp01(env.doseMsvPerDay / C.RADIATION_SCALE_MSV_DAY)
  const commDelaySec = input.commDelaySec ?? env.commDelaySec
  const earthLink = input.earthLink ?? true
  const days = input.missionDay
  const months = days / C.DAYS_PER_MONTH
  const microgravity = 1 - gravityField // 1 in 0 g, 0 on Earth

  // ---- Forecasts (no in-flight measurement) ----
  const boneDensity = Object.fromEntries(
    (Object.keys(C.BONE_LOSS_PER_MONTH) as BonePart[]).map((p) => [
      p,
      clamp01(1 - C.BONE_LOSS_PER_MONTH[p] * months * microgravity),
    ]),
  ) as Record<BonePart, number>
  const boneSource = Object.fromEntries(
    (Object.keys(boneDensity) as BonePart[]).map((p) => [p, days > 0 ? 'forecast' : 'measured']),
  ) as Record<BonePart, Source> // in flight bones are always a forecast; day 0 = pre-flight scan
  const muscleMass = clamp01(1 - C.MUSCLE_LOSS_PER_MONTH * months * microgravity)
  const fluidShift = clamp01((C.FLUID_SHIFT_START + days * C.FLUID_SHIFT_PER_DAY) * microgravity)

  // ---- Regions ----
  const vitalCauses = (id: RegionId): Cause[] =>
    Object.entries(C.REGION_INPUTS[id] ?? {}).map(([key, weight]) => {
      const k = key as keyof Vitals
      return { key: k, deviation: weight! * vitalDeviation(k, input[k], input.baseline[k]) }
    })
  const vitalMetrics = (id: RegionId) => Object.keys(C.REGION_INPUTS[id] ?? {}).map((k) => VITAL_METRIC[k as keyof Vitals])
  const co2Dev = input.co2Level / C.CO2_UNIT
  const minBone = Math.min(...Object.values(boneDensity))
  const r = (id: RegionId, causes: Cause[], metrics: string[], source: Source) =>
    region(id, causes, metrics, source, earthLink)

  const regions: Record<RegionId, RegionState> = {
    heart: r('heart', vitalCauses('heart'), vitalMetrics('heart'), 'measured'),
    immune: r(
      'immune',
      [...vitalCauses('immune'), { key: 'radiation', deviation: radiationLevel / C.RADIATION_UNIT }],
      [...vitalMetrics('immune'), 'radiation'],
      'measured',
    ),
    metabolism: r('metabolism', vitalCauses('metabolism'), vitalMetrics('metabolism'), 'measured'),
    brain: r(
      'brain',
      [...vitalCauses('brain'), { key: 'co2', deviation: co2Dev * C.CO2_BRAIN_WEIGHT }],
      [...vitalMetrics('brain'), 'co2'],
      'measured',
    ),
    lungs: r('lungs', [{ key: 'co2', deviation: co2Dev }], ['co2'], 'measured'),
    eyes: r(
      'eyes',
      [{ key: 'eyes', deviation: Math.max(fluidShift - C.EYES_FLUID_FROM, 0) / C.EYES_UNIT }],
      ['fluid_shift'],
      days > 0 ? 'forecast' : 'measured',
    ),
    bones: r('bones', [{ key: 'bones', deviation: (1 - minBone) / C.BONE_UNIT }], ['bone_density'], days > 0 ? 'forecast' : 'measured'),
    muscles: r(
      'muscles',
      [{ key: 'muscles', deviation: (1 - muscleMass) / C.MUSCLE_UNIT }],
      ['muscle_mass'],
      days > 0 ? 'forecast' : 'measured',
    ),
  }

  // ---- Cause chains (both ends not ok) ----
  const bad = (id: RegionId) => regions[id].status !== 'ok'
  let chain: RegionId[] = []
  if (bad('lungs') && bad('brain')) chain = bad('eyes') ? ['lungs', 'brain', 'eyes'] : ['lungs', 'brain']
  else if (bad('muscles') && bad('bones')) chain = ['muscles', 'bones']
  const chainLinks: ChainLink[] = []
  for (let i = 0; i + 1 < chain.length; i++) {
    const label = C.CHAIN_LABELS[`${chain[i]}>${chain[i + 1]}`]
    if (label) chainLinks.push({ from: chain[i], to: chain[i + 1], label })
  }

  // ---- Threats ----
  const moodDev = vitalDeviation('mood', input.mood, input.baseline.mood)
  const sleepDev = vitalDeviation('sleepHours', input.sleepHours, input.baseline.sleepHours)
  const levels: Record<ThreatId, number> = {
    radiation: radiationLevel,
    isolation: clamp01((days / C.ISOLATION_DAYS) * 0.6 + moodDev * 0.15 + sleepDev * 0.1),
    gravity: clamp01(microgravity * (days / C.GRAVITY_THREAT_DAYS)),
    distance: clamp01(commDelaySec / C.DISTANCE_DELAY_FULL_SEC),
    environment: clamp01(input.co2Level),
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
    m('co2', 'Cabin CO2', Math.round(input.co2Level * 100), '%'),
    m('radiation', 'Radiation', Math.round(radiationLevel * 100), '%'),
    m('fluid_shift', 'Fluid shift (forecast)', Math.round(fluidShift * 100), '%'),
    m('bone_density', 'Lowest bone density (forecast)', Math.round(minBone * 100), '%'),
    m('muscle_mass', 'Muscle mass (forecast)', Math.round(muscleMass * 100), '%'),
  ]

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
    co2Level: input.co2Level,
    cabinTempC: input.cabinTempC,
    noiseDb: input.noiseDb,
    sleepHours: input.sleepHours,
    missionDay: days,
  }
}
