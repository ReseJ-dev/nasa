import './theme.css'
import { STATUS_HEX } from './colors'
import { THREAT_COLOR } from './config'

// Design system entry point. theme.css holds the tokens (surfaces, text, spacing, radii, type).
// The status and hazard colors are also used by three.js, so they stay in colors.ts / config.ts
// and are published here as CSS variables: --st-ok, --st-warning, --st-critical, --hz-<threat>.
// Runs once at module load.
const root = document.documentElement.style
for (const [status, hex] of Object.entries(STATUS_HEX)) root.setProperty(`--st-${status}`, hex)
for (const [threat, hex] of Object.entries(THREAT_COLOR)) root.setProperty(`--hz-${threat}`, hex)

// Font shorthands for inline styles of the labels drawn over the 3D scene.
export const FONT = {
  caption: 'var(--fs-caption) var(--font)',
  captionBold: '600 var(--fs-caption) var(--font)',
  body: 'var(--fs-body) var(--font)',
  value: '600 var(--fs-number) var(--font)',
}
