import { Color } from 'three'
import type { Status } from '../contract/types'
import { BONE_DENSITY, NORMAL_HEX, SKELETON } from './config'

// Status palette. ok is a soft cyan (not green), the same color as the body glow.
export const STATUS_HEX: Record<Status, string> = {
  ok: NORMAL_HEX,
  warning: '#f5c242',
  critical: '#ff3b30',
}

// Ready-made Color objects, created once, used as lerp targets in useFrame.
export const STATUS_COLOR: Record<Status, Color> = {
  ok: new Color(STATUS_HEX.ok),
  warning: new Color(STATUS_HEX.warning),
  critical: new Color(STATUS_HEX.critical),
}

const BONE_NORMAL = new Color(SKELETON.color)

// Writes the bone color for a density into `out` (no new objects created).
// 1 = bone white, BONE_DENSITY.warnAt = yellow, BONE_DENSITY.criticalAt or lower = red.
export function boneDensityColor(density: number, out: Color): Color {
  const { warnAt, criticalAt } = BONE_DENSITY
  if (density >= warnAt) {
    const t = Math.min((1 - density) / (1 - warnAt), 1)
    return out.copy(BONE_NORMAL).lerp(STATUS_COLOR.warning, Math.max(t, 0))
  }
  const t = Math.min((warnAt - density) / (warnAt - criticalAt), 1)
  return out.copy(STATUS_COLOR.warning).lerp(STATUS_COLOR.critical, t)
}
