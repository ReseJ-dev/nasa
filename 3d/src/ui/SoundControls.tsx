import { useSound } from './sound'
import './soundControls.css'

// Sound on/off and volume (Control room and the dev panel). State is shared: ui/sound.ts.
export function SoundControls() {
  const { enabled, volume, setEnabled, setVolume } = useSound()
  return (
    <div className="sound-controls">
      <button type="button" aria-pressed={enabled} onClick={() => setEnabled(!enabled)}>
        Sound {enabled ? 'on' : 'off'}
      </button>
      <label>
        <input
          type="range"
          aria-label="Volume"
          title="Volume"
          min="0"
          max="100"
          value={Math.round(volume * 100)}
          onChange={(event) => setVolume(event.currentTarget.valueAsNumber / 100)}
        />
        <span>{Math.round(volume * 100)}%</span>
      </label>
    </div>
  )
}
