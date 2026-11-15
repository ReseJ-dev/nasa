import { create } from 'zustand'
import { createMissionAudio, DEFAULT_VOLUME } from '../audio/missionAudio'

// One sound controller for the whole app: the top-bar icon and the Control room slider drive the
// same state. Created on first use (a browser plays audio only after a user gesture anyway).

let audio: ReturnType<typeof createMissionAudio> | undefined
const controller = () => (audio ??= createMissionAudio())

interface SoundState {
  enabled: boolean
  volume: number // 0..1
  setEnabled(enabled: boolean): void
  setVolume(volume: number): void
}

export const useSound = create<SoundState>()((set) => ({
  enabled: false,
  volume: DEFAULT_VOLUME,
  setEnabled: (enabled) => {
    controller().setEnabled(enabled)
    set({ enabled })
  },
  setVolume: (volume) => {
    controller().setVolume(volume)
    set({ volume })
  },
}))
