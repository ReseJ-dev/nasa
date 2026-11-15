import { create } from 'zustand'
import type { Baseline, HealthState, SimEnvironment, ThreatId } from '../contract/types'
import { DISTANCE_DELAY_FULL_SEC, ENVIRONMENTS, GRAVITY_THREAT_DAYS } from '../sim/constants'
import { initializeHealthStore, type HealthStore, type ScenarioId } from '../../../src/store/useHealthStore'
import { SCENARIOS } from './mockStore'

export type { ScenarioId }

interface TwinStore extends HealthStore {
  // Environment chosen in the control bar; null = the scenario's own values.
  environment: SimEnvironment | null
  // Sets gravity, radiation dose rate and comm delay defaults of that environment through the
  // shared store inputs (microgravity, radiationMsv) and the link fields. Never writes regions.
  setEnvironment(id: SimEnvironment): void
  setEarthLink(online: boolean): void
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

// Field-by-field baseline merge: the shared store's value wins only where it defines the field;
// everything else (sleepHours, reactionMs, activityMin, ...) comes from the scene preset.
function mergeBaseline(shared: Baseline | undefined, id: ScenarioId): Baseline {
  const merged = { ...SCENARIOS[id].baseline } as Baseline // every scene preset has a baseline
  if (shared) {
    for (const [key, value] of Object.entries(shared)) {
      if (value !== undefined) (merged as unknown as Record<string, unknown>)[key] = value
    }
  }
  return merged
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

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1)

// Cumulative dose of an environment by mission day (the engine takes the cumulative dose in mSv).
const doseAt = (id: SimEnvironment, day: number) => ENVIRONMENTS[id].doseMsvPerDay * day

// Threat levels that follow the live inputs (same formulas as the reference sim, src/sim).
// Only used after a user change of day / inputs / environment, not on a scenario load, so the
// hand-made scenario presets keep their own levels.
function liveThreats(state: TwinStore): Partial<TwinStore> {
  if (!state.threats) return {}
  const level = {
    radiation: state.radiationLevel ?? state.threats.radiation.level,
    gravity: clamp01(state.inputs.microgravity * (state.day / GRAVITY_THREAT_DAYS)),
    distance: clamp01((state.commDelaySec ?? 0) / DISTANCE_DELAY_FULL_SEC),
  }
  const t = state.threats
  if (t.radiation.level === level.radiation && t.gravity.level === level.gravity && t.distance.level === level.distance) {
    return {}
  }
  return {
    threats: {
      ...t,
      radiation: { ...t.radiation, level: level.radiation },
      gravity: { ...t.gravity, level: level.gravity },
      distance: { ...t.distance, level: level.distance },
    },
  }
}

export const useHealthStore = create<TwinStore>()((set, get) => {
  const health = initializeHealthStore(update => set(state => {
    const changes = update(state)
    if (changes === state) return state
    return {
      ...changes,
      ...(changes.baseline ? { baseline: mergeBaseline(changes.baseline, changes.scenario ?? state.scenario) } : {}),
      ...(changes.metrics || changes.day !== undefined ? sceneMetrics({ ...state, ...changes }) : {}),
    }
  }))

  return {
    ...scenePreset('healthy'),
    ...health,
    ...sceneMetrics(health),
    baseline: mergeBaseline(health.baseline, 'healthy'),
    environment: null,
    setScenario: (id) => {
      health.setScenario(id)
      set(state => ({ ...scenePreset(id), ...sceneMetrics(state), environment: null }))
    },
    setDay: (day) => {
      const env = get().environment
      if (env) health.setInputs({ radiationMsv: doseAt(env, Math.max(day, 0)) })
      health.setDay(day)
      set(liveThreats)
    },
    setInputs: (patch) => {
      health.setInputs(patch)
      set(liveThreats)
    },
    setExercise: (patch) => {
      health.setExercise(patch)
      set(liveThreats)
    },
    setEnvironment: (id) => {
      const env = ENVIRONMENTS[id]
      health.setInputs({ microgravity: 1 - env.gravityField, radiationMsv: doseAt(id, get().day) })
      set({ environment: id, gravityField: env.gravityField, commDelaySec: env.commDelaySec })
      set(liveThreats)
    },
    setEarthLink: (online) => set({ earthLink: online }),
    patch: (partial) => set(partial),
    setGravityField: (gravityField) => set({ gravityField }),
    setThreatLevel: (id, level) => set(state => {
      if (!state.threats || state.threats[id].level === level) return state
      return { threats: { ...state.threats, [id]: { ...state.threats[id], level } } }
    }),
  }
})
