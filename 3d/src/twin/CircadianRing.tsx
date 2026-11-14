import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, TorusGeometry, Vector3, type ShaderMaterial } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useHealthStore } from './store'
import { STATUS_COLOR, STATUS_HEX } from './colors'
import { CIRCADIAN as C, ISOLATION as I } from './config'
import { formatHours, formatShift, ISOLATION_LABEL as L } from './labels'
import { createArcMaterial, createLineMaterial, decorative } from './holoMaterials'
import { setOpacity, setText, smoothK, stage, useAlertStatus, useAnyIsolationAlert } from './isolationStage'
import { overlayStyles as s } from './overlayStyles'
import { REGIONS } from './regions'

// Circadian ring around the head (isolation): a 24-hour clock seen from above, tilted toward
// the camera. Thin outline, ticks every 3 h, the sleep arc (length = sleepHours, rotated by
// sleepShiftHours), a warm bright-light arc, and a faint norm arc behind the sleep arc.
// Not focused: only the outline. Focused: everything fades in (see isolationStage.ts).
// The arc turns yellow / red with the sleep alert; a thin line ties it to the brain while
// any isolation alert is active. Created once; all motion in useFrame.

const TAU = Math.PI * 2
const SEGMENTS = 160
// Hour -> fraction of the circle from the front of the ring, clockwise seen from above.
const hourFraction = (hour: number) => (((hour - C.frontHour) / 24) % 1 + 1) % 1

const BRAIN = new Vector3(...REGIONS.find((r) => r.id === 'brain')!.callout.anchor)
const BRAIN_RADIUS = 0.085
const UP = new Vector3(0, 1, 0)
const OK_SLEEP = new Color(C.sleepColor)

function createTicks() {
  const parts = []
  for (let hour = 0; hour < 24; hour += 3) {
    const a = hourFraction(hour) * TAU
    const length = hour % 12 === 0 ? C.tick.longLength : C.tick.length
    const box = new BoxGeometry(C.tick.width, C.tick.width, length)
    const r = C.radius + length / 2 - 0.008 // ticks point outward from the outline
    box.rotateY(-a)
    box.translate(-r * Math.sin(a), 0, r * Math.cos(a))
    parts.push(box)
  }
  const merged = mergeGeometries(parts)
  parts.forEach((p) => p.dispose())
  return merged
}

function createRing() {
  const torus = (radius: number, tube: number, material: ShaderMaterial) => {
    const mesh = decorative(new Mesh(new TorusGeometry(radius, tube, 8, SEGMENTS), material))
    mesh.rotation.x = Math.PI / 2 // lay the torus flat; its uv.x = 0.25 is now at the front (+z)
    return mesh
  }
  const outline = torus(C.radius, I.minLine, createArcMaterial(I.line))
  const ghost = torus(C.radius + C.ghostOffset, C.ghostTube, createArcMaterial(I.line, hourFraction(C.normalBedtime), 0))
  const sleep = torus(C.radius, C.sleepTube, createArcMaterial(C.sleepColor))
  const light = torus(C.radius, C.lightTube, createArcMaterial(C.lightColor, hourFraction(C.lightStartHour), 0))
  const ticks = decorative(new Mesh(createTicks(), createLineMaterial()))
  const group = new Group()
  group.position.set(...C.center)
  group.rotation.x = C.tilt // front edge down: the camera sees the ring as a circle
  group.add(outline, ghost, sleep, light, ticks)
  // Line from the middle of the sleep arc to the brain (a unit cylinder, placed every frame).
  const link = decorative(new Mesh(new CylinderGeometry(I.minLine, I.minLine, 1, 6), createLineMaterial()))
  return { group, outline, ghost, sleep, light, ticks, link }
}

const uniforms = (mesh: Mesh) => (mesh.material as ShaderMaterial).uniforms

export function CircadianRing() {
  const sleepHours = useHealthStore((st) => st.sleepHours ?? 8)
  const shiftHours = useHealthStore((st) => st.sleepShiftHours ?? 0)
  const lightMin = useHealthStore((st) => st.brightLightMin ?? 0)
  const normHours = useHealthStore((st) => st.baseline?.sleepHours ?? 8)
  const status = useAlertStatus('sleep')
  const anyAlert = useAnyIsolationAlert()

  const ring = useMemo(createRing, [])
  const goal = useRef({ sleepHours, shiftHours, lightMin, normHours, status, anyAlert })
  useLayoutEffect(() => {
    goal.current = { sleepHours, shiftHours, lightMin, normHours, status, anyAlert }
  }, [sleepHours, shiftHours, lightMin, normHours, status, anyAlert])
  // Shown values follow the store smoothly: presets and the demo never make the arcs jump.
  const shown = useRef({ sleepHours, shiftHours, lightMin, link: 0 })

  const label = useRef<HTMLDivElement>(null)
  const value = useRef<HTMLSpanElement>(null)
  const caption = useRef<HTMLSpanElement>(null)
  const scratch = useMemo(() => ({ from: new Vector3(), to: new Vector3(), dir: new Vector3() }), [])

  useFrame((_, delta) => {
    const g = goal.current
    const v = shown.current
    const k = smoothK(delta, I.valueLerp)
    v.sleepHours += (g.sleepHours - v.sleepHours) * k
    v.shiftHours += (g.shiftHours - v.shiftHours) * k
    v.lightMin += (g.lightMin - v.lightMin) * k

    // Outline: always there in body mode. The rest only with the focus.
    const outline = uniforms(ring.outline)
    outline.uOpacity.value = stage.outline
    ring.outline.visible = stage.outline > 0.005
    const on = stage.ring > 0.005
    ring.ghost.visible = ring.sleep.visible = ring.light.visible = ring.ticks.visible = on

    if (on) {
      const sleep = uniforms(ring.sleep)
      sleep.uStart.value = hourFraction(C.normalBedtime + v.shiftHours)
      sleep.uLength.value = Math.min(Math.max(v.sleepHours, 0), 23.9) / 24
      sleep.uOpacity.value = stage.ring
      sleep.uColor.value.lerp(g.status === 'ok' ? OK_SLEEP : STATUS_COLOR[g.status], smoothK(delta, I.colorLerp))
      const ghost = uniforms(ring.ghost)
      ghost.uLength.value = g.normHours / 24
      ghost.uOpacity.value = C.ghostOpacity * stage.ring
      const light = uniforms(ring.light)
      light.uLength.value = Math.min(v.lightMin / 60, 12) / 24
      light.uOpacity.value = 0.9 * stage.ring
      ;(ring.ticks.material as { opacity: number }).opacity = 0.8 * stage.ring
    }

    // Link to the brain: from the middle of the sleep arc, while any isolation alert is active.
    v.link += ((g.anyAlert ? 1 : 0) - v.link) * smoothK(delta, I.colorLerp)
    const linkOpacity = C.linkOpacity * v.link * stage.ring
    ring.link.visible = linkOpacity > 0.005
    if (ring.link.visible) {
      const a = hourFraction(C.normalBedtime + v.shiftHours + v.sleepHours / 2) * TAU
      const { from, to, dir } = scratch
      from.set(-C.radius * Math.sin(a), 0, C.radius * Math.cos(a)).applyEuler(ring.group.rotation).add(ring.group.position)
      dir.copy(BRAIN).sub(from)
      const length = dir.length() - BRAIN_RADIUS // stop at the brain surface
      dir.normalize()
      to.copy(from).addScaledVector(dir, length)
      ring.link.position.copy(from).add(to).multiplyScalar(0.5)
      ring.link.quaternion.setFromUnitVectors(UP, dir)
      ring.link.scale.y = length
      ;(ring.link.material as { opacity: number }).opacity = linkOpacity
    }

    setOpacity(label.current, stage.labels)
    if (stage.labels > 0.005) {
      const shift = Math.abs(v.shiftHours) >= 0.05 ? ` · ${L.shift} ${formatShift(v.shiftHours)}` : ''
      setText(value.current, `${formatHours(v.sleepHours)}${shift}`)
      setText(caption.current, `${L.sleep} · ${L.norm} ${formatHours(g.normHours)}`)
    }
  })

  return (
    <>
      <primitive object={ring.group} />
      <primitive object={ring.link} />
      <Html position={C.sleepLabel} style={{ pointerEvents: 'none' }}>
        <div ref={label} style={{ ...s.holo, ...s.holoLeft }}>
          <span ref={caption} style={s.holoCaption} />
          <span ref={value} style={{ ...s.holoValue, ...(status !== 'ok' ? { color: STATUS_HEX[status] } : null) }} />
        </div>
      </Html>
    </>
  )
}
