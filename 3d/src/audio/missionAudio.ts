import { useHealthStore } from '../twin/store'
import { THREAT_LEVEL } from '../twin/config'
import { CUE_PRIORITY, transitionCue, type Cue } from './cues'

export const DEFAULT_VOLUME = 0.25

const SOUNDS: Record<Cue, { file: string; gain: number }> = {
  scenario: { file: 'scenario.ogg', gain: 0.45 },
  warning: { file: 'warning.ogg', gain: 0.65 },
  critical: { file: 'critical.wav', gain: 0.72 },
  flare: { file: 'solar-flare.ogg', gain: 0.8 },
}

const threatStatus = (level: number) =>
  level >= THREAT_LEVEL.criticalAt ? 'critical' : level >= THREAT_LEVEL.warnAt ? 'warning' : 'ok'

export function createMissionAudio() {
  // Reuse one media element so it can be unlocked by the Sound button click.
  const player = new Audio()
  let enabled = false
  let volume = DEFAULT_VOLUME
  let playing: Cue | undefined
  let pending: Cue | undefined
  let playbackId = 0

  function play(cue: Cue) {
    if (!enabled || volume === 0) return
    if (playing && CUE_PRIORITY[playing] > CUE_PRIORITY[cue]) return

    const id = ++playbackId
    const { file, gain } = SOUNDS[cue]
    player.pause()
    player.src = `${import.meta.env.BASE_URL}sounds/${file}`
    player.volume = volume * gain
    playing = cue
    const finish = () => {
      if (id === playbackId) playing = undefined
    }
    player.onended = finish
    player.onerror = finish
    void player.play().catch(finish)
  }

  const unsubscribe = useHealthStore.subscribe((next, previous) => {
    if (!enabled || volume === 0) return
    const cue = transitionCue(previous, next, threatStatus)
    if (!cue) return
    if (!pending) {
      queueMicrotask(() => {
        const sound = pending
        pending = undefined
        if (sound) play(sound)
      })
    }
    // One scenario action can publish several synchronous store updates.
    if (!pending || CUE_PRIORITY[cue] > CUE_PRIORITY[pending]) pending = cue
  })

  function stop() {
    ++playbackId
    pending = undefined
    playing = undefined
    player.pause()
  }

  return {
    setEnabled(value: boolean) {
      enabled = value
      if (value) play('scenario')
      else stop()
    },
    setVolume(value: number) {
      volume = value
      if (value === 0) stop()
      else if (playing) player.volume = volume * SOUNDS[playing].gain
    },
    dispose() {
      enabled = false
      stop()
      unsubscribe()
    },
  }
}
