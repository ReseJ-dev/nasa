import { create } from 'zustand'
import type { Baseline, HealthState, RegionId, SimEnvironment, ThreatId } from '../contract/types'
import { ENVIRONMENTS } from '../sim/constants'
import { initializeHealthStore, type HealthStore, type ScenarioId } from '../../../src/store/useHealthStore'
import { PERSONAL_BASELINE } from '../../../src/data/baseline'
import { distanceThreatLevel, gravityThreatLevel, isolationAlerts, microgravityIndex } from '../sim'
import { SCENARIOS } from './mockStore'

export type { ScenarioId }

interface TwinStore extends HealthStore {
  // Environment chosen in the control bar; null = the scenario's own values.
  environment: SimEnvironment | null
  // Sets gravity, radiation dose rate and comm delay defaults of that environment through the
  // shared store inputs (microgravity, radiationMsv) and the link fields. Never writes regions.
  setEnvironment(id: SimEnvironment): void
  setEarthLink(online: boolean): void
  // Reaction test result: the mean goes to the shared store inputs (vitals.reactionMs),
  // the lapse count to reactionLapses (display only, not an engine input).
  submitReactionTest(meanMs: number, lapses: number): void
  // Alert picked in the alerts list: the 3D scene focuses on its regions (others dim).
  // Cleared when the selection moves to a region outside it, or is cleared.
  highlightAlertId: string | null
  highlightRegions: RegionId[] | null
  setHighlightAlert(id: string | null, regions?: RegionId[]): void
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
    // only once a mood was checked in; otherwise the scene preset keeps its own value
    ...(value('mood') !== undefined ? { mood: value('mood') } : {}),
  }
}

// The crew follows the exercise plan unless the user switches it off: "With exercise" is the
// default after every scenario load, "Without exercise" is the what-if. The scenario presets
// themselves do not depend on it; it applies from the first change of day, inputs or exercise.
const DEFAULT_EXERCISE = { aerobic: 1, resistance: 1 }

// Cumulative dose of an environment by mission day (the engine takes the cumulative dose in mSv).
const doseAt = (id: SimEnvironment, day: number) => ENVIRONMENTS[id].doseMsvPerDay * day

// Threat levels that follow the state, with the one definition of each (src/sim/threats.ts):
// gravity = microgravity index (inputs.microgravity) x mission day, distance = comm delay,
// radiation = the store's radiationLevel. Applied on every scenario load and after every user
// change, so the strip, the metrics panel and the alerts always read the same numbers.
// Isolation and environment keep the level of the scene preset.
type ThreatInputs = Pick<TwinStore, 'threats' | 'radiationLevel' | 'inputs' | 'day' | 'commDelaySec'>
function threatLevels(state: ThreatInputs): Pick<TwinStore, 'threats'> | Record<string, never> {
  if (!state.threats) return {}
  const level = {
    radiation: state.radiationLevel ?? state.threats.radiation.level,
    gravity: gravityThreatLevel(state.inputs.microgravity ?? 0, state.day),
    distance: distanceThreatLevel(state.commDelaySec ?? 0),
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

// Isolation alerts recomputed from the live values (sleep, reaction, mood, activity) after a
// user change, with the reference sim rule (src/sim/isolation.ts). The twin only displays them.
function liveAlerts(state: TwinStore): Partial<TwinStore> {
  const b = state.baseline
  if (!b?.sleepHours || !b.reactionMs || b.activityMin === undefined) return {}
  return {
    alerts: isolationAlerts({
      sleepHours: state.sleepHours ?? b.sleepHours,
      sleepShiftHours: state.sleepShiftHours ?? 0,
      reactionMs: state.reactionMs ?? b.reactionMs,
      mood: state.mood ?? PERSONAL_BASELINE.mood,
      activityMin: state.activityMin ?? b.activityMin,
      baseline: { sleepHours: b.sleepHours, reactionMs: b.reactionMs, mood: PERSONAL_BASELINE.mood, activityMin: b.activityMin },
    }),
  }
}

// Everything that follows the live inputs after a user change (not on a scenario load).
const live = (state: TwinStore): Partial<TwinStore> => ({ ...threatLevels(state), ...liveAlerts(state) })

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

  const loaded = { ...scenePreset('healthy'), ...health }
  return {
    ...loaded,
    ...threatLevels(loaded),
    ...sceneMetrics(health),
    exercise: DEFAULT_EXERCISE,
    baseline: mergeBaseline(health.baseline, 'healthy'),
    environment: null,
    highlightAlertId: null,
    highlightRegions: null,
    setHighlightAlert: (id, regions) =>
      set({ highlightAlertId: id, highlightRegions: id && regions?.length ? regions : null }),
    selectRegion: (id) => {
      health.selectRegion(id)
      const { highlightRegions } = get()
      if (highlightRegions && (id === null || !highlightRegions.includes(id))) {
        set({ highlightAlertId: null, highlightRegions: null })
      }
    },
    setScenario: (id) => {
      health.setScenario(id)
      set(state => ({ ...scenePreset(id), ...sceneMetrics(state), environment: null, exercise: DEFAULT_EXERCISE }))
      set(threatLevels)
    },
    setDay: (day) => {
      const env = get().environment
      if (env) health.setInputs({ radiationMsv: doseAt(env, Math.max(day, 0)) })
      health.setDay(day)
      set(live)
    },
    setInputs: (patch) => {
      health.setInputs(patch)
      set(live)
    },
    setExercise: (patch) => {
      health.setExercise(patch)
      set(live)
    },
    setEnvironment: (id) => {
      const env = ENVIRONMENTS[id]
      health.setInputs({ microgravity: microgravityIndex(env.gravityField), radiationMsv: doseAt(id, get().day) })
      set({ environment: id, gravityField: env.gravityField, commDelaySec: env.commDelaySec })
      set(live)
    },
    setEarthLink: (online) => set({ earthLink: online }),
    submitReactionTest: (meanMs, lapses) => {
      health.setInputs({ vitals: { ...get().inputs.vitals, reactionMs: meanMs } })
      set({ reactionLapses: lapses })
      set(live)
    },
    patch: (partial) => set(partial),
    setGravityField: (gravityField) => set({ gravityField }),
    setThreatLevel: (id, level) => set(state => {
      if (!state.threats || state.threats[id].level === level) return state
      return { threats: { ...state.threats, [id]: { ...state.threats[id], level } } }
    }),
  }
})
