import { useMemo, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import type { RegionId, ThreatId } from '../contract/types'
import { useHealthStore } from './store'
import { useFocusedThreat } from './hooks/useFocusedThreat'
import { THREAT_COLOR, THREAT_STRIP as S } from './config'
import { overlayStyles as s } from './overlayStyles'
import { REGIONS } from './regions'

// Thin lines from the focused threat's icon (HTML strip) toward its regions (3D scene).
// FocusLinesSvg: the HTML part, a full-size SVG with one <line> per region, drawn over the
// threats row and the canvas (the lines start in the row and end in the 3D stage).
// FocusLineTracker: inside the Canvas; every frame it projects the regions to the screen
// and writes the line ends straight into the SVG elements (no React state per frame).

const ANCHOR = new Map(REGIONS.map((d) => [d.id, d.callout.anchor]))
const MAX_LINES = REGIONS.length

export type LineRefs = RefObject<(SVGLineElement | null)[]>

export function FocusLinesSvg({ lines }: { lines: LineRefs }) {
  return (
    <svg style={s.focusLines} aria-hidden>
      {Array.from({ length: MAX_LINES }, (_, i) => (
        <line
          key={i}
          ref={(el) => {
            lines.current[i] = el
          }}
          strokeWidth={1}
          strokeLinecap="round"
          opacity={S.focusLineOpacity}
          visibility="hidden"
        />
      ))}
    </svg>
  )
}

const NONE: RegionId[] = []

export function FocusLineTracker({
  lines,
  iconRefs,
  container,
  stage,
}: {
  lines: LineRefs
  iconRefs: RefObject<Partial<Record<ThreatId, HTMLElement | null>>>
  container: RefObject<HTMLDivElement | null> // the SVG's box: threats row + 3D stage
  stage: RefObject<HTMLDivElement | null> // the 3D stage inside it (the canvas)
}) {
  const focused = useFocusedThreat()
  const regions = useHealthStore((st) => (focused ? (st.threats?.[focused].regions ?? NONE) : NONE))
  const v = useMemo(() => new Vector3(), [])

  useFrame(({ camera, size }) => {
    const els = lines.current
    const icon = focused ? iconRefs.current[focused] : null
    const box = container.current
    const canvas = stage.current
    for (let i = 0; i < MAX_LINES; i++) {
      const el = els[i]
      if (!el) continue
      const anchor = icon && box && canvas ? ANCHOR.get(regions[i]) : undefined
      if (!anchor || !icon || !box || !canvas) {
        el.setAttribute('visibility', 'hidden')
        continue
      }
      // Line start: bottom center of the icon ring, in container pixels.
      const c = box.getBoundingClientRect()
      const r = icon.getBoundingClientRect()
      const x1 = r.left + r.width / 2 - c.left
      const y1 = r.bottom - c.top
      // Line end: the region projected to the screen, stopped a bit short of it.
      v.set(anchor[0], anchor[1], anchor[2]).project(camera)
      const k = canvas.getBoundingClientRect()
      const x2 = k.left - c.left + ((v.x + 1) / 2) * size.width
      const y2 = k.top - c.top + ((1 - v.y) / 2) * size.height
      el.setAttribute('x1', String(x1))
      el.setAttribute('y1', String(y1))
      el.setAttribute('x2', String(x1 + (x2 - x1) * S.focusLineReach))
      el.setAttribute('y2', String(y1 + (y2 - y1) * S.focusLineReach))
      el.setAttribute('stroke', THREAT_COLOR[focused!])
      el.setAttribute('visibility', 'visible')
    }
  })

  return null
}
