import { create } from 'zustand'
import type { ThreatId } from '../contract/types'

// View state local to the 3D twin. NOT the shared health store: the engine and UI
// never write here, and nothing here is health data.
// - hoverThreat: threat under the mouse in the strip (preview)
// - pinnedThreat: threat pinned by a click (or controlled via BodyScene's focusedThreat prop)
// - demo: true = every active threat effect at full strength (for the demo run)
interface SceneState {
  hoverThreat: ThreatId | null
  pinnedThreat: ThreatId | null
  demo: boolean
  setHoverThreat(id: ThreatId | null): void
  setPinnedThreat(id: ThreatId | null): void
  setDemo(on: boolean): void
}

export const useSceneStore = create<SceneState>()((set) => ({
  hoverThreat: null,
  pinnedThreat: null,
  demo: false,
  setHoverThreat: (id) => set({ hoverThreat: id }),
  setPinnedThreat: (id) => set({ pinnedThreat: id }),
  setDemo: (on) => set({ demo: on }),
}))
