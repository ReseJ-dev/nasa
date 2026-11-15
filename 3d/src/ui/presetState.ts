import { create } from 'zustand'
import { useHealthStore, type ScenarioId } from '../twin/store'

// Which preset is loaded, and whether the user has changed its inputs since.
// The app store has no such flag, so the UI keeps a snapshot of the inputs taken right after a
// preset loads; "Custom" = the current inputs differ from that snapshot. Nothing is computed.

type AppState = ReturnType<typeof useHealthStore.getState>

// Everything the Control room can change: mission day, engine inputs (incl. the check-in),
// exercise, environment and the Earth link.
const inputsKey = (s: AppState) =>
  JSON.stringify([s.day, s.inputs, s.exercise, s.environment, s.earthLink ?? true])

const usePresetStore = create(() => ({ loadedKey: inputsKey(useHealthStore.getState()) }))

/** Loads a preset and remembers its inputs. Use this instead of store.setScenario in the UI. */
export function loadPreset(id: ScenarioId) {
  useHealthStore.getState().setScenario(id)
  usePresetStore.setState({ loadedKey: inputsKey(useHealthStore.getState()) })
}

/** True when the inputs differ from the loaded preset. */
export function useIsCustom(): boolean {
  const loadedKey = usePresetStore((s) => s.loadedKey)
  return useHealthStore((s) => inputsKey(s) !== loadedKey)
}
