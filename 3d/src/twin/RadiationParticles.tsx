import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Group,
  Points,
  PointsMaterial,
  Sprite,
  SpriteMaterial,
} from 'three'
import { useHealthStore } from './store'
import { BODY_VOLUMES, RADIATION_PARTICLES as P, THREAT_ACTIVE_THRESHOLD } from './config'

// Radiation: particles flying through the body from the Sun side (-x), plus "hits":
// tiny violet sparks at random points inside the body. Driven by radiationLevel,
// nothing below THREAT_ACTIVE_THRESHOLD. Everything is created once and moved in
// useFrame through buffer attributes / object fields: no React state per frame.

const random = (range: [number, number]) => range[0] + Math.random() * (range[1] - range[0])

// Soft round dot, used for both particles and sparks (created once at module load).
function createDotTexture() {
  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.6)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new CanvasTexture(canvas)
}
const DOT = createDotTexture()

// Effective radiation 0..1 for the visuals: 0 below the threshold, else the level itself.
export function radiationIntensity(level: number) {
  return level >= THREAT_ACTIVE_THRESHOLD ? level : 0
}

function createParticles() {
  const positions = new Float32Array(P.maxCount * 3)
  for (let i = 0; i < P.maxCount; i++) {
    positions[i * 3] = random([-P.span, P.span]) // spread from the start, no "wave" on load
    positions[i * 3 + 1] = random(P.yRange)
    positions[i * 3 + 2] = random(P.zRange)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setDrawRange(0, 0)
  const points = new Points(
    geometry,
    new PointsMaterial({
      color: P.color,
      size: P.size,
      map: DOT,
      transparent: true,
      opacity: P.opacity,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  )
  points.raycast = () => null // never catches hover or clicks
  points.frustumCulled = false // points move; the bounding sphere is never recomputed
  points.visible = false
  return points
}

// Pool of P.sparks.max sprites, each with its own material (own opacity).
function createSparks() {
  const group = new Group()
  for (let i = 0; i < P.sparks.max; i++) {
    const sprite = new Sprite(
      new SpriteMaterial({
        map: DOT,
        color: P.sparks.color,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        depthTest: false, // a hit inside the body stays visible through the organs
      }),
    )
    sprite.raycast = () => null
    sprite.visible = false
    sprite.userData.age = 0
    group.add(sprite)
  }
  return group
}

function spawnSpark(sprite: Sprite) {
  const [min, max] = BODY_VOLUMES[Math.floor(Math.random() * BODY_VOLUMES.length)]
  sprite.position.set(random([min[0], max[0]]), random([min[1], max[1]]), random([min[2], max[2]]))
  sprite.userData.age = 0
  sprite.visible = true
}

export function RadiationParticles() {
  // Re-renders only when the number changes; read through a ref in useFrame.
  const target = useHealthStore((s) => radiationIntensity(s.radiationLevel ?? 0))
  const targetRef = useRef(target)
  useLayoutEffect(() => {
    targetRef.current = target
  }, [target])

  const points = useMemo(createParticles, [])
  const sparks = useMemo(createSparks, [])
  const smooth = useRef(0) // lerped intensity
  const sparkBudget = useRef(0) // fractional sparks waiting to spawn

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-delta * P.lerpSpeed)
    smooth.current += (targetRef.current - smooth.current) * k
    const lvl = smooth.current < 0.01 ? 0 : smooth.current

    // Particles
    const count = Math.round(lvl * P.maxCount)
    points.geometry.setDrawRange(0, count)
    points.visible = count > 0
    if (count > 0) {
      const speed = P.minSpeed + (P.maxSpeed - P.minSpeed) * lvl
      const attr = points.geometry.getAttribute('position') as BufferAttribute
      const pos = attr.array as Float32Array
      for (let i = 0; i < count; i++) {
        pos[i * 3] += speed * delta
        if (pos[i * 3] > P.span) {
          // left the box: respawn on the Sun side at a new height and depth
          pos[i * 3] = -P.span
          pos[i * 3 + 1] = random(P.yRange)
          pos[i * 3 + 2] = random(P.zRange)
        }
      }
      attr.needsUpdate = true
    }

    // Sparks: age the live ones, then spawn new ones at a rate set by the level.
    for (const child of sparks.children) {
      const sprite = child as Sprite
      if (!sprite.visible) continue
      sprite.userData.age += delta
      const t = sprite.userData.age / P.sparks.life
      if (t >= 1) {
        sprite.visible = false
        continue
      }
      sprite.material.opacity = 1 - t
      sprite.scale.setScalar(P.sparks.size * (1 + t)) // grows a little while fading
    }
    sparkBudget.current += lvl * P.sparks.maxRate * delta
    while (sparkBudget.current >= 1) {
      sparkBudget.current -= 1
      const free = sparks.children.find((c) => !c.visible) as Sprite | undefined
      if (!free) break // all P.sparks.max in use: skip this one
      spawnSpark(free)
    }
    if (lvl === 0) sparkBudget.current = 0
  })

  return (
    <>
      <primitive object={points} />
      <primitive object={sparks} />
    </>
  )
}
