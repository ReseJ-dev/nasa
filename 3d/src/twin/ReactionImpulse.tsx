import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { AdditiveBlending, CatmullRomCurve3, Color, Mesh, Sprite, SpriteMaterial, TubeGeometry, Vector3, type ShaderMaterial } from 'three'
import { useHealthStore } from './store'
import { STATUS_COLOR, STATUS_HEX } from './colors'
import { IMPULSE as P, ISOLATION as I } from './config'
import { formatChange, formatMs, ISOLATION_LABEL as L } from './labels'
import { createPulseMaterial, decorative } from './holoMaterials'
import { setOpacity, setText, smoothK, stage, useAlertStatus } from './isolationStage'
import { overlayStyles as s } from './overlayStyles'
import { DOT_TEXTURE } from './textures'

// Reaction impulse (isolation): like the NASA Reaction Self-Test, light seen -> button pressed.
// Every IMPULSE.period seconds one pulse travels eyes -> brain -> arm -> hand along a smooth
// curve. Travel time scales with reactionMs against the personal baseline (slower reaction =
// slower pulse). Lapses: a share of the pulses fades out halfway and never reaches the hand.
// A pulse that arrives ends with a short flash at the hand. Readout next to the hand.
// Created once; everything moves in useFrame.

const CURVE = new CatmullRomCurve3(P.path.map((p) => new Vector3(...p)))
const BASE_COLOR = new Color(P.color)
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}

function createImpulse() {
  const material = createPulseMaterial(P.color, P.tail)
  material.depthTest = false // the path runs inside the body: show it through the organs
  const path = decorative(new Mesh(new TubeGeometry(CURVE, 120, I.minLine, 6), material))
  const sprite = () => {
    const m = new SpriteMaterial({
      map: DOT_TEXTURE,
      color: P.color,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    })
    return decorative(new Sprite(m))
  }
  const head = sprite() // the travelling pulse
  const press = sprite() // flash at the hand on arrival
  press.position.copy(CURVE.getPointAt(1))
  return { path, head, press }
}

export function ReactionImpulse() {
  const reactionMs = useHealthStore((st) => st.reactionMs ?? 0)
  const lapses = useHealthStore((st) => st.reactionLapses ?? 0)
  const baseline = useHealthStore((st) => st.baseline?.reactionMs ?? 0)
  const status = useAlertStatus('reaction')

  const impulse = useMemo(createImpulse, [])
  const goal = useRef({ reactionMs, lapses, baseline, status })
  useLayoutEffect(() => {
    goal.current = { reactionMs, lapses, baseline, status }
  }, [reactionMs, lapses, baseline, status])

  const shownMs = useRef(reactionMs)
  // One cycle: clock runs 0..period; the pulse starts at 0. `debt` spreads lapses evenly.
  const cycle = useRef({ clock: 0, lapse: false, debt: 0, wasOn: false })
  const color = useMemo(() => new Color(P.color), [])
  const label = useRef<HTMLDivElement>(null)
  const value = useRef<HTMLSpanElement>(null)

  useFrame((_, delta) => {
    const g = goal.current
    shownMs.current += (g.reactionMs - shownMs.current) * smoothK(delta, I.valueLerp)

    setOpacity(label.current, stage.labels)
    if (stage.labels > 0.005) {
      const change = g.baseline > 0 ? ` · ${formatChange(shownMs.current, g.baseline)}` : ''
      setText(value.current, `${formatMs(shownMs.current)}${change}`)
    }

    const strength = stage.impulse
    const on = strength > 0.005
    const c = cycle.current
    impulse.path.visible = on
    if (!on) {
      impulse.head.visible = impulse.press.visible = false
      c.wasOn = false
      return
    }
    if (!c.wasOn) {
      // just faded in: the first pulse leaves almost at once
      c.wasOn = true
      c.clock = P.period - 0.3
      c.debt = 0
    }

    c.clock += delta
    if (c.clock >= P.period) {
      c.clock -= P.period
      c.debt += Math.min(g.lapses / P.lapsesFull, 1) * P.maxLapseShare
      c.lapse = c.debt >= 1
      if (c.lapse) c.debt -= 1
    }

    const ratio = g.baseline > 0 ? shownMs.current / g.baseline : 1
    const travel = Math.min(Math.max(P.baseTravel * ratio, 0.4), P.maxTravel)
    const p = c.clock / travel
    let headAt = 1
    let pulse = 0
    let pressT = -1 // 0..1 while the arrival flash plays
    if (p <= 1) {
      headAt = 0.5 - 0.5 * Math.cos(Math.PI * p) // ease in and out along the path
      pulse = Math.min(p / 0.08, 1)
      if (c.lapse) pulse *= 1 - smoothstep(P.lapseAt[0], P.lapseAt[1], headAt)
    } else if (!c.lapse) {
      const after = c.clock - travel
      pulse = Math.exp(-after / 0.2) // the tail drains into the hand
      if (after < P.press.seconds) pressT = after / P.press.seconds
    }

    color.lerp(g.status === 'ok' ? BASE_COLOR : STATUS_COLOR[g.status], smoothK(delta, I.colorLerp))
    const u = (impulse.path.material as ShaderMaterial).uniforms
    u.uColor.value.copy(color)
    u.uBase.value = P.pathOpacity * strength
    u.uPulse.value = pulse * strength
    u.uHead.value = headAt

    const head = impulse.head
    head.visible = pulse > 0.01 && p <= 1
    if (head.visible) {
      CURVE.getPointAt(headAt, head.position)
      // a short flare at the eyes ("light seen"), then a steady dot
      head.scale.setScalar(P.headSize * (1 + 0.9 * Math.exp(-p / 0.12)))
      head.material.color.copy(color)
      head.material.opacity = pulse * strength
    }
    const press = impulse.press
    press.visible = pressT >= 0
    if (press.visible) {
      const out = 1 - (1 - pressT) * (1 - pressT) // ease out
      press.scale.setScalar(P.headSize + (P.press.size - P.headSize) * out)
      press.material.color.copy(color)
      press.material.opacity = (1 - pressT) * strength
    }
  })

  return (
    <>
      <primitive object={impulse.path} />
      <primitive object={impulse.head} />
      <primitive object={impulse.press} />
      <Html position={P.label} style={{ pointerEvents: 'none' }}>
        <div ref={label} style={{ ...s.holo, ...s.holoLeft }}>
          <span style={s.holoCaption}>{L.reaction}</span>
          <span ref={value} style={{ ...s.holoValue, ...(status !== 'ok' ? { color: STATUS_HEX[status] } : null) }} />
        </div>
      </Html>
    </>
  )
}
