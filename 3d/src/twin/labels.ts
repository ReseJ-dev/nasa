import type { Status } from '../contract/types'

// All user-facing text of the overlay in one place.
export const STATUS_LABEL: Record<Status, string> = {
  ok: 'Норма',
  warning: 'Внимание',
  critical: 'Критично',
}

export const DENSITY_LABEL = {
  normal: 'норма',
  low: 'низкая плотность',
}

export const HINT = 'Вращай, приближай, кликни на орган'
