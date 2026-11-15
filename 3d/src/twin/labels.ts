import type { RegionId, Status, ThreatId } from '../contract/types'

// All user-facing text of the overlay in one place.
export const REGION_LABEL: Record<RegionId, string> = {
  brain: 'Brain',
  eyes: 'Eyes',
  lungs: 'Lungs',
  heart: 'Heart',
  immune: 'Immune system',
  bones: 'Bones',
  muscles: 'Muscles',
  metabolism: 'Metabolism',
}

export const STATUS_LABEL: Record<Status, string> = {
  ok: 'Normal',
  warning: 'Warning',
  critical: 'Critical',
}

// Shown instead of a score or a value when the engine has no input for it.
export const NO_DATA_LABEL = 'No data'

// Labels drawn over the 3D scene stay short: at most this many characters.
export const SCENE_LABEL_MAX = 25
export const sceneLabel = (text: string) =>
  text.length <= SCENE_LABEL_MAX ? text : `${text.slice(0, SCENE_LABEL_MAX - 1).trimEnd()}…`

export const DENSITY_LABEL = {
  normal: 'normal',
  low: 'low density',
}

export const LAYER_LABEL = {
  body: 'Body',
  skeleton: 'Skeleton',
}

// Fluid shift (microgravity) gets its own label near the head, apart from the CO2 cause chain.
export const FLUID_SHIFT_LABEL = 'Headward fluid shift'
// The cause chain between organs (lungs -> brain -> eyes) has no verified source attached in
// the code: every chain label carries this note and its tooltip says so.
export const CHAIN_MODEL_LABEL = 'project model'
export const CHAIN_MODEL_TOOLTIP = 'Project model: the link between these organs is our assumption, not a verified source.'

export const FRACTURE_LABEL = 'Fracture risk at landing' // shown at the weakest bone part

// Temporary dev test panel in App.tsx (mock scenarios).
export const DEV_PANEL = {
  selectedRegion: 'Selected region',
  none: 'none',
  scenario: { healthy: 'Healthy', day60: 'Day 60', critical: 'Crisis' },
  earthLink: 'Earth link',
  environment: { station: 'Station', transit: 'Transit', mars_surface: 'Mars' },
  gravity: { zero: '0 g', moon: 'Moon', mars: 'Mars', earth: 'Earth' },
}

export const THREAT_LABEL: Record<ThreatId, string> = {
  radiation: 'Radiation',
  isolation: 'Isolation',
  gravity: 'Gravity',
  distance: 'Distance from Earth',
  environment: 'Environment',
}

// Short names for the threats row (two lines next to a ring; the full names stay in THREAT_LABEL).
export const THREAT_STRIP_LABEL: Record<ThreatId, string> = { ...THREAT_LABEL, distance: 'Earth distance' }

export const SENSOR_LABEL = {
  co2: 'CO₂',
  temp: '°C',
  noise: 'Noise',
  noiseUnit: 'dB',
}

// Isolation visuals (circadian ring, reaction impulse, activity bars, mood).
// Captions are short words; values always carry their unit.
export const ISOLATION_LABEL = {
  sleep: 'Sleep',
  sleepRhythm: 'Sleep rhythm',
  shift: 'shift',
  norm: 'norm',
  reaction: 'Reaction',
  activity: 'Activity',
  days: '7 days',
  mood: 'Mood',
}
const signed = (v: number, digits = 0) => {
  const r = Number(v.toFixed(digits))
  return r > 0 ? `+${r}` : r < 0 ? `\u2212${Math.abs(r)}` : '\u00b10'
}
export const formatHours = (h: number) => `${h.toFixed(1)} h` // "5.2 h"
export const formatShift = (h: number) => `${signed(h, 1)} h` // "+3 h"
export const formatMs = (ms: number) => `${Math.round(ms)} ms` // "412 ms"
// Shown wherever the app shows thresholds (metrics panel, zone panel).
export const SOURCES_NOTE =
  'Thresholds are drawn from NASA-STD-3001 where marked; others are project estimates. Not a medical device.'

export const formatMinutes = (min: number) => `${Math.round(min)} min`
// Change against the personal baseline: "+31%", "−73%", "±0%".
export const formatChange = (value: number, baseline: number) =>
  baseline > 0 ? `${signed(((value - baseline) / baseline) * 100)}%` : ''

export const EARTH_LABEL = {
  // reply = signal there and back (2 x commDelaySec)
  replyIn: (seconds: number) =>
    seconds < 60 ? `Reply in ${Math.round(seconds)} s` : `Reply in ${Math.round(seconds / 60)} min`,
  autonomous: 'Autonomous mode',
  // Escalation to the ground while Earth answers too late (one-way delay above 5 min).
  delayedEscalation: 'Follow on-board protocol; Earth informed with delay',
  delayedText:
    'Earth answers too late to guide you now: follow the onboard checklist with the crew medical officer, log every step and send the log to the flight surgeon on Earth.',
  noLink: 'No link',
}

// Gravity label next to the g arrow: 0 -> "0 g", 0.16 -> "0.16 g", 1 -> "1 g".
export const formatG = (g: number) => `${Number(g.toFixed(2))} g`

export const RADIATION_LABEL = {
  shelter: 'Shelter',
}

// Threats strip: one real value with its unit, the limit it is compared with, and a source
// tooltip (wording from SOURCES.md; "project estimate" where SOURCES.md says so).
const oneDecimal = (v: number) => v.toFixed(1)
export const STRIP_VALUE = {
  radiation: (msv: number) => `${Math.round(msv)} mSv`,
  radiationLimit: 'career limit 600',
  isolation: (h: number) => `Sleep ${oneDecimal(h)} h`,
  isolationLimit: 'target 8.5',
  gravity: (pct: number) => `Bone loss ${oneDecimal(pct)}%`,
  gravityLimit: 'since day 0',
  environment: (mmHg: number) => `CO₂ ${oneDecimal(mmHg)} mmHg`,
  environmentLimit: 'limit 3',
  oneWay: (seconds: number) =>
    seconds < 60 ? `one-way ${Math.round(seconds)} s` : `one-way ${Math.round(seconds / 60)} min`,
  noData: 'No data',
}
export const STRIP_SOURCE = {
  radiation:
    'Cumulative dose (demo model). Career limit 600 mSv: NASA-STD-3001 Vol 1 Rev C [V1 4030]. ' +
    'Ring color uses a display scale full at 250 mSv: project estimate.',
  isolation:
    'Sleep last night. Target 8.5 h: NASA protected sleep time (Barger et al. 2014), ' +
    'not a measured sleep duration.',
  gravity:
    'Weight-bearing bone density loss since day 0 (forecast). NASA HRP: 1–1.5% per month in ' +
    'weight-bearing bones; the per-bone split is a project estimate.',
  distance:
    'Reply = signal to Earth and back. NASA HRP: up to 20 min one way at Mars. ' +
    'The delay of this scenario is a project estimate. Above 5 min one way the crew works autonomously.',
  environment:
    'Cabin CO₂ partial pressure (sea-level cabin assumed: project estimate). Limit 3 mmHg: ' +
    'NASA-STD-3001 Vol 2 Rev F [V2 6004], a 1-hour average; the app uses a daily mean.',
}

export const HINT = 'Rotate, zoom, click an organ'
