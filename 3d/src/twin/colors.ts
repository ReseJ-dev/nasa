import { Color } from 'three'
import type { Status } from '../contract/types'

// Status palette. ok is neutral (not green) on purpose.
export const STATUS_HEX: Record<Status, string> = {
  ok: '#8fa3b8',
  warning: '#f5c242',
  critical: '#ff3b30',
}

// Ready-made Color objects, created once, used as lerp targets in useFrame.
export const STATUS_COLOR: Record<Status, Color> = {
  ok: new Color(STATUS_HEX.ok),
  warning: new Color(STATUS_HEX.warning),
  critical: new Color(STATUS_HEX.critical),
}
