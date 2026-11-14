import type { RegionId, Status } from '../contract/types'

// All user-facing text of the overlay in one place.
export const REGION_LABEL: Record<RegionId, string> = {
  brain: 'Мозг',
  eyes: 'Глаза',
  lungs: 'Лёгкие',
  heart: 'Сердце',
  immune: 'Иммунитет',
  bones: 'Кости',
  muscles: 'Мышцы',
}

export const STATUS_LABEL: Record<Status, string> = {
  ok: 'Норма',
  warning: 'Внимание',
  critical: 'Критично',
}

export const DENSITY_LABEL = {
  normal: 'норма',
  low: 'низкая плотность',
}

export const LAYER_LABEL = {
  body: 'Тело',
  skeleton: 'Скелет',
}

export const FRACTURE_LABEL = 'Риск перелома при посадке' // shown at the weakest bone part

// Temporary dev test panel in App.tsx (mock scenarios).
export const DEV_PANEL = {
  selectedRegion: 'Выбранная зона',
  none: 'нет',
  scenario: { healthy: 'Здоров', day60: 'День 60', critical: 'Кризис' },
}

export const HINT = 'Вращай, приближай, кликни на орган'
