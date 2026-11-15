import type { BonePart, RegionId, SimEnvironment, ThreatId, Vitals } from '../../3d/src/contract/types'

// Constants of the reference simulation. Each value has a source, or a TODO when it is a
// placeholder that participant 3 (engine / science content) must confirm.
// Statuses come from the DEVIATION FROM THE PERSONAL PRE-FLIGHT BASELINE, not from fixed tables.

// ---- Environment defaults -------------------------------------------------------------
// radiationLevel is a 0..1 display scale: level = dose rate (mSv/day) / RADIATION_SCALE_MSV_DAY.
export const RADIATION_SCALE_MSV_DAY = 5 // TODO: agree the 0..1 scale with participant 3
export const CUMULATIVE_RADIATION_SCALE_MSV = 250 // demo normalization for accumulated dose

export const ENVIRONMENTS: Record<SimEnvironment, { gravityField: number; doseMsvPerDay: number; commDelaySec: number }> =
  {
    // ISS: ~0.5 mSv/day (NASA, ISS radiation environment); comm delay < 1 s (TDRS relay).
    station: { gravityField: 0, doseMsvPerDay: 0.5, commDelaySec: 1 },
    // Cruise to Mars: 1.84 mSv/day GCR (Zeitlin et al., Science 2013, MSL RAD);
    // one-way light time to Mars 3..22 min, mid-cruise value taken. TODO: delay by mission day.
    transit: { gravityField: 0, doseMsvPerDay: 1.84, commDelaySec: 300 },
    // Mars surface: 0.64 mSv/day (Hassler et al., Science 2014, MSL RAD); 0.38 g;
    // one-way delay ~12.5 min on average (light time).
    mars_surface: { gravityField: 0.38, doseMsvPerDay: 0.64, commDelaySec: 750 },
  }

// ---- Deviation from baseline -----------------------------------------------------------
// For each measured value: how far from the personal baseline counts as ONE unit of deviation.
// A region's deviation is the largest weighted deviation of its inputs.
// status: deviation < WARN_AT -> ok, < CRITICAL_AT -> warning, otherwise critical.
export const WARN_AT = 1
export const CRITICAL_AT = 2
// score = 100 - deviation * SCORE_PER_UNIT (clamped to 0..100)
export const SCORE_PER_UNIT = 30

// 'both' = any change counts, 'up' / 'down' = only a rise / only a drop counts.
export const TOLERANCE: Record<keyof Vitals, { unit: number; direction: 'both' | 'up' | 'down' }> = {
  systolic: { unit: 15, direction: 'both' }, // TODO: clinical source; AHA stages step ~10-20 mmHg
  diastolic: { unit: 10, direction: 'both' }, // TODO: clinical source
  heartRate: { unit: 20, direction: 'both' }, // TODO: resting HR change that needs attention
  glucose: { unit: 1.5, direction: 'both' }, // mmol/L. TODO: fasting vs random glucose
  bodyTempC: { unit: 0.5, direction: 'both' }, // TODO: 37.5 °C+ is commonly used as low-grade fever
  sleepHours: { unit: 1.5, direction: 'down' }, // TODO: NASA sleep target for crew (>= 7 h?)
  mood: { unit: 1, direction: 'down' }, // 1..5 self-report. TODO: validated scale (e.g. POMS)
  reactionMs: { unit: 50, direction: 'up' }, // TODO: PVT-B norms (Basner et al.)
}

// Which inputs feed which region, with weights (1 = full).
// Blood pressure and temperature -> heart and immune; glucose -> metabolism;
// mood, sleep and reaction -> brain (task rules). Cabin CO2 -> lungs (and brain, weaker).
export const REGION_INPUTS: Partial<Record<RegionId, Partial<Record<keyof Vitals, number>>>> = {
  heart: { systolic: 1, diastolic: 1, heartRate: 1, bodyTempC: 0.6 },
  immune: { bodyTempC: 1, systolic: 0.5, diastolic: 0.5 },
  metabolism: { glucose: 1 },
  brain: { mood: 1, sleepHours: 1, reactionMs: 1 },
}

// Cabin CO₂ is shown as partial pressure (ppCO2, mmHg); ppm is the secondary unit.
// ppm -> mmHg assumes a sea-level cabin (760 mmHg total), as on the ISS.
export const CABIN_PRESSURE_MMHG = 760
export const ppmToMmHg = (ppm: number) => (ppm * CABIN_PRESSURE_MMHG) / 1_000_000
// NASA limits for cabin CO₂ (user-provided reference values, NASA OCHMO CO2 brief; not yet verified):
// from 2.5 mmHg warning, from 3 mmHg critical.
export const CO2_LIMITS_MMHG = { warn: 2.5, critical: 3 }

// Cabin and radiation (not personal vitals): deviation = value / unit.
export const CO2_UNIT = 0.35 // co2Level per deviation unit. TODO: map to ppm / NASA SMAC CO2 limits
export const CO2_BRAIN_WEIGHT = 0.7 // CO2 -> headache, attention (TODO: source)
export const RADIATION_UNIT = 0.4 // radiationLevel per deviation unit for the immune region. TODO

// ---- Forecasts (no in-flight measurement) ---------------------------------------------
// Bone mineral density loss per month in microgravity without full countermeasures:
// 1-1.5 %/month, largest at hip, pelvis and spine (LeBlanc et al., J Musculoskelet Neuronal
// Interact 2000; Lang et al., JBMR 2004). Per part below; scaled by (1 - gravityField).
// TODO: partial gravity (Mars) is unknown; linear scaling is an assumption.
export const BONE_LOSS_PER_MONTH: Record<BonePart, number> = {
  pelvis: 0.016,
  leg_left: 0.015,
  leg_right: 0.015,
  spine: 0.011,
  ribs: 0.005,
  arm_left: 0.004,
  arm_right: 0.004,
  skull: 0, // skull tends to keep or gain density (LeBlanc 2000)
}
export const BONE_UNIT = 0.05 // density drop per deviation unit for the bones region. TODO

// Muscle mass: ~1.5 %/month with ISS exercise (TODO: source, e.g. Gopalakrishnan et al. 2010).
export const MUSCLE_LOSS_PER_MONTH = 0.015
export const MUSCLE_UNIT = 0.06 // mass drop per deviation unit. TODO

// Fluid shift toward the head: immediate on entering 0 g, SANS risk grows with mission length
// (Mader et al., Ophthalmology 2011). TODO: real model.
export const FLUID_SHIFT_START = 0.1
export const FLUID_SHIFT_PER_DAY = 1 / 300
export const EYES_FLUID_FROM = 0.1 // fluid shift above which the eyes deviate
export const EYES_UNIT = 0.4 // fluid shift per deviation unit. TODO

export const DAYS_PER_MONTH = 30.4

// ---- Threat levels (0..1) ---------------------------------------------------------------
export const GRAVITY_THREAT_DAYS = 120 // days in 0 g to reach full gravity threat. TODO
export const ISOLATION_DAYS = 500 // days for the mission-length part of isolation to reach 0.6. TODO
export const DISTANCE_DELAY_FULL_SEC = 800 // comm delay with full distance threat. TODO

export const THREAT_REGIONS: Record<ThreatId, RegionId[]> = {
  radiation: ['immune', 'brain', 'eyes'], // DNA damage, CNS effects, cataracts
  isolation: ['brain'], // sleep, mood, attention
  gravity: ['bones', 'muscles', 'eyes', 'heart'], // bone/muscle loss, fluid shift, deconditioning
  distance: ['brain', 'heart'], // no evacuation, delayed help
  environment: ['lungs', 'brain', 'immune'], // CO2, noise, microbes
}

// ---- Escalation ----------------------------------------------------------------------
// ok -> 'self', warning -> 'crew', critical -> 'ground'. Without Earth: 'ground' -> 'crew'.
export const AUTONOMOUS_ADVICE = 'Autonomous protocol: follow the onboard checklist and log every step; no ground call.'

// ---- Advice: one concrete action per cause -----------------------------------------------
// TODO: participant 3 to review with the science content.
export const ADVICE: Record<string, string> = {
  systolic: 'Re-measure blood pressure after 5 min seated rest; if still high, report to the crew medical officer.',
  diastolic: 'Re-measure blood pressure after 5 min seated rest; limit salt at the next meal.',
  heartRate: 'Rest 10 min and re-measure heart rate; skip intense exercise until it is back to baseline.',
  bodyTempC: 'Measure temperature again in 1 h; drink 500 ml of water; report a fever to the crew medical officer.',
  glucose: 'Re-check glucose before the next meal; keep meal times regular today.',
  sleepHours: 'Plan an 8 h sleep window tonight; no screens 1 h before sleep.',
  mood: 'Schedule a private call or message with family; tell a crewmate how you feel.',
  reactionMs: 'Repeat the reaction test after a 20 min break; postpone critical tasks until it improves.',
  co2: 'Check the CO₂ scrubber and move to a better ventilated module; limit exertion.',
  radiation: 'Stay in the shelter until the radiation alert ends; wear your dosimeter.',
  bones: 'Do the full resistive exercise session today (ARED, 2.5 h total exercise).',
  muscles: 'Add a lower-body resistance set today; check protein intake.',
  eyes: 'Do the weekly vision check today; report blurred vision or headache.',
}

// Cause labels for the chain (cause -> effect), shown between organs in 3D.
export const CHAIN_LABELS: Partial<Record<`${RegionId}>${RegionId}`, string>> = {
  'lungs>brain': 'CO₂ ↑',
  'brain>eyes': 'Headward fluid shift (SANS hypothesis)',
  'muscles>bones': 'less load',
}

// ---- Isolation alerts --------------------------------------------------------------------
// Same deviation scale as the regions (WARN_AT / CRITICAL_AT). Sleep, reaction and mood use TOLERANCE.
export const SLEEP_SHIFT_UNIT = 1.5 // hours of circadian shift per deviation unit. TODO: source
// Exercise: share of the personal baseline lost per deviation unit (ISS plan: ~2.5 h/day incl. setup).
export const ACTIVITY_DROP_UNIT = 0.25 // TODO: confirm with participant 3
