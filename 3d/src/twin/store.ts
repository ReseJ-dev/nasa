import { create } from 'zustand'
import type { HealthState, ThreatId } from '../contract/types'
import { initializeHealthStore, type HealthStore, type ScenarioId } from '../../../src/store/useHealthStore'
import { SCENARIOS } from './mockStore'

export type { ScenarioId }

interface TwinStore extends HealthStore {
  patch(partial: Partial<HealthState>): void
  setGravityField(gravityField: number): void
  setThreatLevel(id: ThreatId, level: number): void
}

// Keep the scene's presentation presets alongside the shared engine state.
function scenePreset(id: ScenarioId) {
  const preset = SCENARIOS[id]
  return {
    alerts: preset.alerts,
    history: preset.history,
    threatLinks: preset.threatLinks,
    threats: preset.threats,
    inShelter: preset.inShelter,
    gravityField: preset.gravityField,
    cabinTempC: preset.cabinTempC,
    noiseDb: preset.noiseDb,
    co2Level: preset.co2Level,
    sleepShiftHours: preset.sleepShiftHours,
    brightLightMin: preset.brightLightMin,
    reactionLapses: preset.reactionLapses,
    mood: preset.mood,
    activityMin: preset.activityMin,
  }
}

function sceneMetrics(state: Pick<HealthStore, 'metrics' | 'day'>) {
  const value = (id: string) => state.metrics.find(metric => metric.id === id)?.value
  return {
    missionDay: state.day,
    sleepHours: value('sleep_hours'),
    reactionMs: value('reaction_ms'),
    muscleMass: 1 - (value('muscle_loss_pct') ?? 0) / 100,
  }
}

export const useHealthStore = create<TwinStore>()((set) => {
  const health = initializeHealthStore(update => set(state => {
    const changes = update(state)
    if (changes === state) return state
    return {
      ...changes,
      ...(changes.metrics || changes.day !== undefined ? sceneMetrics({ ...state, ...changes }) : {}),
    }
  }))

  return {
    ...scenePreset('healthy'),
    ...health,
    ...sceneMetrics(health),
    setScenario: (id) => {
      health.setScenario(id)
      set(state => ({ ...scenePreset(id), ...sceneMetrics(state) }))
    },
    patch: (partial) => set(partial),
    setGravityField: (gravityField) => set({ gravityField }),
    setThreatLevel: (id, level) => set(state => {
      if (!state.threats || state.threats[id].level === level) return state
      return { threats: { ...state.threats, [id]: { ...state.threats[id], level } } }
    }),
  }
})
