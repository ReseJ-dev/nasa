import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, PointsMaterial } from 'three'
import { useHealthStore } from './store'
import { RADIATION_PARTICLES as P } from './config'

// Optional radiation particles: one Points object, at most P.maxCount points,
// flowing through the body from the astronaut's right side (-x) to the left (+x).
// threats.radiation.level sets how many are drawn and how fast they fly.
// Display only. Positions are moved in useFrame, no setState per frame.

const random = (range: [number, number]) => range[0] + Math.random() * (range[1] - range[0])

export function RadiationParticles() {
  // Re-renders only when the level number changes.
  const level = useHealthStore((st) => st.threats?.radiation.level ?? 0)
  const levelRef = useRef(level)
  useLayoutEffect(() => {
    levelRef.current = level
  }, [level])

  // Geometry, material and the Points object, created once.
  const points = useMemo(() => {
    const positions = new Float32Array(P.maxCount * 3)
    for (let i = 0; i < P.maxCount; i++) {
      positions[i * 3] = random([-P.span, P.span]) // spread out from the start, no "wave" on load
      positions[i * 3 + 1] = random(P.yRange)
      positions[i * 3 + 2] = random(P.zRange)
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    const material = new PointsMaterial({
      color: P.color,
      size: P.size,
      transparent: true,
      opacity: P.opacity,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    const p = new Points(geometry, material)
    p.raycast = () => null // never catches hover or clicks
    p.frustumCulled = false // points move; the bounding sphere is never recomputed
    return p
  }, [])

  useFrame((_, delta) => {
    const lvl = levelRef.current
    const count = Math.round(lvl * P.maxCount)
    const geometry = points.geometry
    geometry.setDrawRange(0, count)
    points.visible = count > 0
    if (count === 0) return

    const speed = P.minSpeed + (P.maxSpeed - P.minSpeed) * lvl
    const attr = geometry.getAttribute('position') as BufferAttribute
    const pos = attr.array as Float32Array
    for (let i = 0; i < count; i++) {
      pos[i * 3] += speed * delta
      if (pos[i * 3] > P.span) {
        // left the box: re-enter on the other side at a new height and depth
        pos[i * 3] = -P.span
        pos[i * 3 + 1] = random(P.yRange)
        pos[i * 3 + 2] = random(P.zRange)
      }
    }
    attr.needsUpdate = true
  })

  return <primitive object={points} />
}
