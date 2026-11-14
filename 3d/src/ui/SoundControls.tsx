import { useEffect, useRef, useState } from 'react'
import { createMissionAudio, DEFAULT_VOLUME } from '../audio/missionAudio'
import './soundControls.css'

export function SoundControls() {
  const audio = useRef<ReturnType<typeof createMissionAudio> | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [volume, setVolume] = useState(DEFAULT_VOLUME)

  useEffect(() => {
    const controller = createMissionAudio()
    audio.current = controller
    return () => {
      controller.dispose()
      audio.current = null
    }
  }, [])

  return (
    <div className="sound-controls">
      <button type="button" aria-pressed={enabled} onClick={() => {
        audio.current?.setEnabled(!enabled)
        setEnabled(!enabled)
      }}>
        Sound {enabled ? 'on' : 'off'}
      </button>
      <label>
        Volume <span>{Math.round(volume * 100)}%</span>
        <input type="range" min="0" max="100" value={Math.round(volume * 100)} onChange={event => {
          const value = event.currentTarget.valueAsNumber / 100
          audio.current?.setVolume(value)
          setVolume(value)
        }} />
      </label>
    </div>
  )
}
