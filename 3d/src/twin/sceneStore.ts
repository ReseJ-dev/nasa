import { create } from 'zustand'
import type { ThreatId } from '../contract/types'
import { LANDING } from './config'

// View state local to the 3D twin. NOT the shared health store: the engine and UI
// never write here, and nothing here is health data.
// - hoverThreat: threat under the mouse in the strip (preview)
// - pinnedThreat: threat pinned by a click (or controlled via BodyScene's focusedThreat prop)
// - demo: true = every active threat effect at full strength (for the demo run)
// - landing: true for LANDING.seconds after gravityField goes from 0 to Mars or Earth
interface SceneState {
  hoverThreat: ThreatId | null
  pinnedThreat: ThreatId | null
  demo: boolean
  setHoverThreat(id: ThreatId | null): void
  setPinnedThreat(id: ThreatId | null): void
  setDemo(on: boolean): void
  landing: boolean
  triggerLanding(): void
}

let landingTimer: ReturnType<typeof setTimeout> | undefined

export const useSceneStore = create<SceneState>()((set) => ({
  hoverThreat: null,
  pinnedThreat: null,
  demo: false,
  setHoverThreat: (id) => set({ hoverThreat: id }),
  setPinnedThreat: (id) => set({ pinnedThreat: id }),
  setDemo: (on) => set({ demo: on }),
  landing: false,
  triggerLanding: () => {
    clearTimeout(landingTimer) // a new landing restarts the timer
    set({ landing: true })
    landingTimer = setTimeout(() => set({ landing: false }), LANDING.seconds * 1000)
  },
}))
