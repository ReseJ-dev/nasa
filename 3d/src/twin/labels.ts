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
}

export const STATUS_LABEL: Record<Status, string> = {
  ok: 'Normal',
  warning: 'Warning',
  critical: 'Critical',
}

export const DENSITY_LABEL = {
  normal: 'normal',
  low: 'low density',
}

export const LAYER_LABEL = {
  body: 'Body',
  skeleton: 'Skeleton',
}

export const FRACTURE_LABEL = 'Fracture risk at landing' // shown at the weakest bone part

// Temporary dev test panel in App.tsx (mock scenarios).
export const DEV_PANEL = {
  selectedRegion: 'Selected region',
  none: 'none',
  scenario: { healthy: 'Healthy', day60: 'Day 60', critical: 'Crisis' },
}

export const THREAT_LABEL: Record<ThreatId, string> = {
  radiation: 'Radiation',
  isolation: 'Isolation',
  gravity: 'Gravity',
  distance: 'Distance from Earth',
  environment: 'Environment',
}

export const SENSOR_LABEL = {
  co2: 'CO₂',
  temp: '°C',
  noise: 'Noise',
  noiseUnit: 'dB',
}

export const CIRCADIAN_LABEL = {
  sleep: 'Sleep',
  hours: 'h',
  shift: 'shift',
}

export const HINT = 'Rotate, zoom, click an organ'
