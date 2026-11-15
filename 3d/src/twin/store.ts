import { create } from 'zustand'
import type { Baseline, HealthState, RegionId, SimEnvironment, ThreatId } from '../contract/types'
import { ENVIRONMENTS } from '../../../src/engine/constants'
import { initializeHealthStore, type HealthStore, type ScenarioId } from '../../../src/store/useHealthStore'
import { PERSONAL_BASELINE } from '../../../src/data/baseline'
import { isolationAlerts, microgravityIndex } from '../../../src/engine'
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
  // demo only
  patch(partial: Partial<HealthState>): void
  setGravityField(gravityField: number): void
  // demo only
  setThreatLevel(id: ThreatId, level: number): void
}

// Keep the scene's presentation presets alongside the shared engine state.
function scenePreset(id: ScenarioId) {
  const preset = SCENARIOS[id]
  return {
    history: preset.history,
    threatLinks: preset.threatLinks,
    inShelter: preset.inShelter,
    cabinTempC: preset.cabinTempC,
    noiseDb: preset.noiseDb,
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
    // only once a mood was checked in; otherwise the scene preset keeps its own value
    ...(value('mood') !== undefined ? { mood: value('mood') } : {}),
  }
}

// Cumulative dose of an environment by mission day (the engine takes the cumulative dose in mSv).
const doseAt = (id: SimEnvironment, day: number) => ENVIRONMENTS[id].doseMsvPerDay * day

// Isolation alerts use current tracking values and the pre-flight baseline.
function liveAlerts(state: Pick<TwinStore, 'baseline' | 'sleepHours' | 'sleepShiftHours' | 'reactionMs' | 'mood' | 'activityMin'>): Partial<TwinStore> {
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

  const loaded = {
    ...health,
    ...scenePreset('healthy'),
    ...sceneMetrics(health),
    baseline: mergeBaseline(health.baseline, 'healthy'),
  }
  return {
    ...loaded,
    ...liveAlerts(loaded),
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
      set({ ...scenePreset(id), environment: null })
      set(liveAlerts)
    },
    setDay: (day) => {
      const env = get().environment
      if (env) health.setInputs({ radiationMsv: doseAt(env, Math.max(day, 0)) })
      health.setDay(day)
      set(liveAlerts)
    },
    setInputs: (patch) => {
      health.setInputs(patch)
      set(liveAlerts)
    },
    setExercise: (patch) => {
      health.setExercise(patch)
      set(liveAlerts)
    },
    setEnvironment: (id) => {
      const env = ENVIRONMENTS[id]
      set({ environment: id, commDelaySec: env.commDelaySec })
      health.setInputs({ microgravity: microgravityIndex(env.gravityField), radiationMsv: doseAt(id, get().day) })
      health.recalculate()
      set(liveAlerts)
    },
    setEarthLink: (online) => {
      set({ earthLink: online })
      health.recalculate()
    },
    submitReactionTest: (meanMs, lapses) => {
      health.setInputs({ vitals: { ...get().inputs.vitals, reactionMs: meanMs } })
      set({ reactionLapses: lapses })
      set(liveAlerts)
    },
    patch: (partial) => set(partial),
    setGravityField: (gravityField) => set({ gravityField }),
    setThreatLevel: (id, level) => set(state => {
      if (!state.threats || state.threats[id].level === level) return state
      return { threats: { ...state.threats, [id]: { ...state.threats[id], level } } }
    }),
  }
})
