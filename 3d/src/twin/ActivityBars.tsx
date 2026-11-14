import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { BoxGeometry, Color, Group, Mesh, TorusGeometry, type MeshBasicMaterial } from 'three'
import type { DayRecord } from '../contract/types'
import { useHealthStore } from './store'
import { STATUS_COLOR, STATUS_HEX } from './colors'
import { ACTIVITY as A, ISOLATION as I } from './config'
import { formatChange, formatMinutes, ISOLATION_LABEL as L } from './labels'
import { createLineMaterial, decorative } from './holoMaterials'
import { setOpacity, setText, smoothK, stage, useAlertStatus } from './isolationStage'
import { overlayStyles as s } from './overlayStyles'

// Activity (isolation): the last 7 days as thin bars standing on a floor ring under the feet.
// Height = that day's exercise against the personal baseline (thin line = baseline).
// Today's bar is brighter and takes the color of the activity alert. Also shown in skeleton mode.
// Created once; heights and colors lerp in useFrame.

const DAYS = 7
const NO_HISTORY: DayRecord[] = []
const LINE = new Color(I.line)

function createBars() {
  const group = decorative(new Group())
  const past = createLineMaterial()
  const today = createLineMaterial()
  const guide = createLineMaterial()
  const unit = new BoxGeometry(A.barWidth, 1, A.barDepth).translate(0, 0.5, 0) // grows up from the floor
  const bars = Array.from({ length: DAYS }, (_, i) => {
    const bar = decorative(new Mesh(unit, i === DAYS - 1 ? today : past))
    bar.position.set((i - (DAYS - 1) / 2) * A.spacing, 0, A.z)
    bar.visible = true // the group decides
    return bar
  })
  const ring = decorative(new Mesh(new TorusGeometry(A.ringRadius, I.minLine, 6, 128), guide))
  ring.rotation.x = Math.PI / 2
  ring.position.y = I.minLine
  const norm = decorative(
    new Mesh(new BoxGeometry((DAYS - 1) * A.spacing + A.barWidth + 0.05, I.minLine * 2, I.minLine * 2), guide),
  )
  norm.position.set(0, A.normHeight, A.z)
  ring.visible = norm.visible = true
  group.add(ring, norm, ...bars)
  return { group, bars, past, today, guide }
}

export function ActivityBars() {
  const history = useHealthStore((st) => st.history ?? NO_HISTORY)
  const baseline = useHealthStore((st) => st.baseline?.activityMin ?? 0)
  const status = useAlertStatus('activity')

  const view = useMemo(createBars, [])
  // Goal per bar as a share of the baseline; the newest day is always the last bar.
  const goal = useRef({ ratios: new Array<number>(DAYS).fill(0), todayMin: 0, baseline, status })
  useLayoutEffect(() => {
    const days = history.slice(-DAYS)
    const g = goal.current
    for (let i = 0; i < DAYS; i++) {
      const day = days[i - (DAYS - days.length)]
      g.ratios[i] = day && baseline > 0 ? Math.min(Math.max(day.activityMin / baseline, 0), A.maxRatio) : 0
    }
    g.todayMin = days[days.length - 1]?.activityMin ?? 0
    g.baseline = baseline
    g.status = status
  }, [history, baseline, status])

  const shown = useRef({ ratios: new Array<number>(DAYS).fill(0), todayMin: 0 })
  const label = useRef<HTMLDivElement>(null)
  const value = useRef<HTMLSpanElement>(null)

  useFrame((_, delta) => {
    const g = goal.current
    const v = shown.current
    const k = smoothK(delta, I.valueLerp)
    v.todayMin += (g.todayMin - v.todayMin) * k
    for (let i = 0; i < DAYS; i++) v.ratios[i] += (g.ratios[i] - v.ratios[i]) * k

    setOpacity(label.current, stage.barLabel)
    if (stage.barLabel > 0.005) {
      const change = g.baseline > 0 ? ` · ${formatChange(v.todayMin, g.baseline)}` : ''
      setText(value.current, `${formatMinutes(v.todayMin)}${change}`)
    }

    const strength = stage.bars
    view.group.visible = strength > 0.005
    if (!view.group.visible) return
    // bars rise from the floor while fading in
    for (let i = 0; i < DAYS; i++) view.bars[i].scale.y = Math.max(v.ratios[i] * A.normHeight * strength, 0.003)
    view.past.opacity = A.pastOpacity * strength
    view.today.opacity = A.todayOpacity * strength
    view.today.color.lerp(g.status === 'ok' ? LINE : STATUS_COLOR[g.status], smoothK(delta, I.colorLerp))
    ;(view.guide as MeshBasicMaterial).opacity = A.normOpacity * strength
  })

  return (
    <>
      <primitive object={view.group} />
      <Html position={A.label} style={{ pointerEvents: 'none' }}>
        <div ref={label} style={{ ...s.holo, ...s.holoLeft }}>
          <span style={s.holoCaption}>
            {L.activity} · {L.days}
          </span>
          <span ref={value} style={{ ...s.holoValue, ...(status !== 'ok' ? { color: STATUS_HEX[status] } : null) }} />
        </div>
      </Html>
    </>
  )
}
