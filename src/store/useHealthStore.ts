// The app's lockfile and dependencies live in 3d/. Use its Zustand ESM entry.
import { create } from '../../3d/node_modules/zustand/esm/index.mjs'
import type { HealthState } from '../../3d/src/contract/types'
import { SCENARIOS, type ScenarioData, type ScenarioId } from '../data/scenarios.ts'
import { computeState, type Exercise, type MissionInputs } from '../engine/index.ts'

export type { ScenarioId } from '../data/scenarios.ts'

interface MissionSettings {
  day: number
  inputs: Readonly<MissionInputs>
  exercise: Readonly<Exercise>
}

export interface HealthStore extends Omit<HealthState, keyof ScenarioData>, ScenarioData, MissionSettings {
  scenario: ScenarioId
  setScenario(id: ScenarioId): void
  setDay(day: number): void
  setInputs(patch: Partial<MissionInputs>): void
  setExercise(patch: Partial<Exercise>): void
}

const SCENARIO_DAY: Record<ScenarioId, number> = { healthy: 0, day60: 60, critical: 180 }

function scenarioSettings(id: ScenarioId): MissionSettings {
  const { metrics, fluidShift } = SCENARIOS[id]
  const readMetric = (metricId: string) => metrics.find((metric) => metric.id === metricId)!.value
  return {
    day: SCENARIO_DAY[id],
    inputs: {
      co2Ppm: readMetric('co2_ppm'),
      sleepHours: readMetric('sleep_hours'),
      radiationMsv: readMetric('radiation_msv'),
      microgravity: 1,
      isolation: 0,
      fluidShift,
    },
    // The scenarios don't specify isolation or completed exercise.
    exercise: { aerobic: 0, resistance: 0 },
  }
}

// Reconcile the plain objects and ordered arrays returned by the engine and fixtures.
// New branches are copied so the store never takes ownership of fixture objects.
function reuseValue(previous: unknown, next: unknown): unknown {
  if (Object.is(previous, next)) return previous
  if (Array.isArray(next)) {
    const old = Array.isArray(previous) ? previous : []
    const values = next.map((value, index) => reuseValue(old[index], value))
    return Array.isArray(previous) && old.length === values.length &&
      values.every((value, index) => Object.is(value, old[index])) ? previous : values
  }
  if (next === null || typeof next !== 'object') return next

  const old = previous !== null && typeof previous === 'object' && !Array.isArray(previous)
    ? previous as Record<string, unknown> : {}
  const entries = Object.entries(next).map(([key, value]) => [key, reuseValue(old[key], value)] as const)
  return Object.keys(old).length === entries.length &&
    entries.every(([key, value]) => Object.hasOwn(old, key) && Object.is(old[key], value))
    ? old : Object.fromEntries(entries)
}

function changedFields<T extends object>(state: T, next: Partial<T>): Partial<T> {
  return Object.fromEntries(Object.entries(next).flatMap(([key, value]) => {
    const previous = state[key as keyof T]
    const updated = reuseValue(previous, value)
    return Object.is(previous, updated) ? [] : [[key, updated]]
  })) as Partial<T>
}

export const useHealthStore = create<HealthStore>()((set) => {
  function updateMission(patch: (state: HealthStore) => Partial<MissionSettings>) {
    set((state) => {
      const next = patch(state)
      const settings = changedFields<MissionSettings>(state, next)
      if (Object.keys(settings).length === 0) return state

      const day = settings.day ?? state.day
      const inputs = settings.inputs ?? state.inputs
      const exercise = settings.exercise ?? state.exercise
      return { ...settings, ...changedFields<HealthStore>(state, computeState(day, inputs, exercise)) }
    })
  }

  return {
    ...structuredClone(SCENARIOS.healthy),
    ...scenarioSettings('healthy'),
    scenario: 'healthy',
    selectedRegion: null,
    selectRegion: (id) => set((state) => state.selectedRegion === id ? state : { selectedRegion: id }),
    setScenario: (id) => set((state) => {
      const changes = changedFields<HealthStore>(state, {
        ...SCENARIOS[id],
        ...scenarioSettings(id),
        scenario: id,
      })
      return Object.keys(changes).length > 0 ? changes : state
    }),
    setDay: (day) => updateMission(() => ({
      day: Number.isFinite(day) ? Math.max(0, day) : 0,
    })),
    setInputs: (patch) => updateMission((state) => ({ inputs: { ...state.inputs, ...patch } })),
    setExercise: (patch) => updateMission((state) => ({ exercise: { ...state.exercise, ...patch } })),
  }
})
