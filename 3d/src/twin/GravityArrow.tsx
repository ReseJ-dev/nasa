import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial } from 'three'
import { useHealthStore } from './store'
import { useSceneStore } from './sceneStore'
import { GRAVITY_ARROW as A, GRAVITY_FIELDS } from './config'
import { formatG } from './labels'
import { useThreatEffect } from './hooks/useThreatEffect'
import { overlayStyles as s } from './overlayStyles'

// Gravity threat: a vertical g arrow next to the body, pointing down.
// Length from gravityField (no arrow at 0 g); the label always shows the field ("0 g", "0.38 g").
// Landing moment: gravityField goes from 0 to Mars or Earth -> the arrow drops into place
// and the scene store's landing flag starts (weakest bone flash + fracture label, see Skeleton).
// Created once; length, drop and fade are animated in useFrame.

const isLanding = (prev: number, next: number) =>
  prev === GRAVITY_FIELDS.zero && (next === GRAVITY_FIELDS.mars || next === GRAVITY_FIELDS.earth)

export function GravityArrow() {
  const g = useHealthStore((st) => st.gravityField ?? 0)
  const triggerLanding = useSceneStore((st) => st.triggerLanding)
  // Threat rule: hidden below the threshold, faint unless focused / demo; full during a landing.
  const landing = useSceneStore((st) => st.landing)
  const effect = useThreatEffect('gravity')
  const strength = landing ? 1 : effect
  const strengthRef = useRef(strength)
  useLayoutEffect(() => {
    strengthRef.current = strength
  }, [strength])

  const goal = useRef(0) // arrow length goal
  const drop = useRef(1) // 0 = start of the drop animation, 1 = settled
  const prev = useRef(g)
  useLayoutEffect(() => {
    goal.current = g > 0 ? Math.max(A.minLength, g * A.lengthPerG) : 0
  }, [g])
  useEffect(() => {
    if (isLanding(prev.current, g)) {
      drop.current = 0
      triggerLanding()
    }
    prev.current = g
  }, [g, triggerLanding])

  const { group, shaft, head, material } = useMemo(() => {
    const mat = new MeshBasicMaterial({ color: A.color, transparent: true, opacity: 0, toneMapped: false })
    const sh = new Mesh(new CylinderGeometry(A.shaftRadius, A.shaftRadius, 1, 10), mat)
    const hd = new Mesh(new ConeGeometry(A.headRadius, A.headLength, 16), mat)
    hd.rotation.x = Math.PI // cone points down
    const grp = new Group()
    grp.add(sh, hd)
    grp.position.set(...A.position)
    for (const m of [sh, hd]) m.raycast = () => null
    grp.visible = false
    return { group: grp, shaft: sh, head: hd, material: mat }
  }, [])

  const length = useRef(0)
  useFrame((_, delta) => {
    const k = 1 - Math.exp(-delta * A.lerpSpeed)
    length.current += (goal.current - length.current) * k
    const len = length.current
    group.visible = len > 0.01 && strengthRef.current > 0.01
    if (!group.visible) return

    // Drop animation: fall from dropHeight with an ease-out, fade in at the same time.
    drop.current = Math.min(drop.current + delta / A.dropSeconds, 1)
    const t = drop.current
    const ease = 1 - (1 - t) * (1 - t) * (1 - t)
    group.position.y = A.position[1] + A.dropHeight * (1 - ease)
    material.opacity = 0.9 * ease * strengthRef.current

    // Shaft from the top down, head at the bottom end.
    const shaftLen = Math.max(len - A.headLength, 0.001)
    shaft.scale.y = shaftLen
    shaft.position.y = -shaftLen / 2
    head.position.y = -shaftLen - A.headLength / 2
  })

  return (
    <>
      <primitive object={group} />
      <Html
        position={[A.position[0], A.position[1] + 0.06, A.position[2]]}
        center
        style={{ pointerEvents: 'none', opacity: strength, display: strength > 0 ? 'block' : 'none' }}
      >
        <div style={s.gravityLabel}>{formatG(g)}</div>
      </Html>
    </>
  )
}
