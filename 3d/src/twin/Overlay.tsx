import type { Status } from '../contract/types'
import { STATUS_HEX } from './colors'
import { SKELETON, type Layer } from './config'
import { DENSITY_LABEL, HINT, STATUS_LABEL } from './labels'
import { overlayStyles as s } from './overlayStyles'

// HTML drawn on top of the canvas (not inside the 3D scene).

const STATUSES: Status[] = ['ok', 'warning', 'critical']

// Same colors as the bones: bone white -> yellow -> red as density drops.
const DENSITY_GRADIENT = `linear-gradient(to right, ${SKELETON.color}, ${STATUS_HEX.warning}, ${STATUS_HEX.critical})`

// Bottom-right legend: status colors in body mode, density scale in skeleton mode.
export function Legend({ layer }: { layer: Layer }) {
  if (layer === 'skeleton') {
    return (
      <div style={s.legend}>
        <div style={s.scale}>
          <div style={{ ...s.scaleBar, background: DENSITY_GRADIENT }} />
          <div style={s.scaleLabels}>
            <span>{DENSITY_LABEL.normal}</span>
            <span>{DENSITY_LABEL.low}</span>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div style={s.legend}>
      {STATUSES.map((status) => (
        <div key={status} style={s.legendItem}>
          <span style={{ ...s.dot, background: STATUS_HEX[status] }} />
          {STATUS_LABEL[status]}
        </div>
      ))}
    </div>
  )
}

// Bottom-center one-line hint; fades out once `visible` becomes false.
export function Hint({ visible }: { visible: boolean }) {
  return <div style={{ ...s.hint, opacity: visible ? 1 : 0 }}>{HINT}</div>
}
