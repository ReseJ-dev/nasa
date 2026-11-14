import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Sprite,
  SpriteMaterial,
} from 'three'
import { useHealthStore } from './store'
import { useSceneStore } from './sceneStore'
import { useThreatEffect } from './hooks/useThreatEffect'
import { BODY_PROFILE, RADIATION_TRACKS as T, SHELTER, SOLAR_FLARE } from './config'
import { DOT_TEXTURE } from './textures'

// Radiation tracks: thin long violet lines from the Sun side (-x) through the body,
// one InstancedMesh (one draw call). Count and speed from radiationLevel x useThreatEffect,
// x3 during a solar flare burst. Where a track enters the body shell a short spark flashes
// (pooled). In the shelter the tracks stop at the shelter wall and spark there instead.
// All per-track data lives in typed arrays; updated in useFrame, no React state.

const random = (r: [number, number]) => r[0] + Math.random() * (r[1] - r[0])

// Alpha along the track: transparent tail -> bright head (u = 0..1 along x on the side faces).
function createTrailTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 1
  const ctx = canvas.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 64, 0)
  g.addColorStop(0, 'rgba(255,255,255,0)')
  g.addColorStop(1, 'rgba(255,255,255,1)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 1)
  return new CanvasTexture(canvas)
}
const TRAIL = createTrailTexture()

// Where a track at (y, z) enters the body (x of the shell on the Sun side), or null if it misses.
function entryX(y: number, z: number) {
  for (const band of BODY_PROFILE) {
    if (y >= band.y[0] && y < band.y[1]) return Math.abs(z) < band.halfDepth ? -band.halfWidth : null
  }
  return null
}

function createTracks() {
  // Unit box from x = 0 (tail) to x = 1 (head); scaled per instance to the track length.
  const geometry = new BoxGeometry(1, T.thickness, T.thickness).translate(0.5, 0, 0)
  const material = new MeshBasicMaterial({
    color: T.color,
    alphaMap: TRAIL,
    transparent: true,
    opacity: T.opacity,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  })
  const mesh = new InstancedMesh(geometry, material, T.capacity)
  mesh.count = 0
  mesh.frustumCulled = false
  mesh.raycast = () => null
  return mesh
}

function createSparks() {
  const group = new Group()
  for (let i = 0; i < T.sparks.max; i++) {
    const sprite = new Sprite(
      new SpriteMaterial({
        map: DOT_TEXTURE,
        color: T.sparks.color,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      }),
    )
    sprite.raycast = () => null
    sprite.visible = false
    sprite.userData.age = 0
    group.add(sprite)
  }
  return group
}

export function RadiationTracks() {
  const level = useHealthStore((st) => st.radiationLevel ?? 0)
  const inShelter = useHealthStore((st) => st.inShelter ?? false)
  const effect = useThreatEffect('radiation')
  const burst = useSceneStore((st) => st.flareBurst)

  const goal = useRef({ level: 0, burst: 1, shelter: 0 })
  useLayoutEffect(() => {
    goal.current = { level: level * effect, burst: burst ? SOLAR_FLARE.burstFactor : 1, shelter: inShelter ? 1 : 0 }
  }, [level, effect, burst, inShelter])

  const tracks = useMemo(createTracks, [])
  const sparks = useMemo(createSparks, [])
  // Per track: tail x, y, z, length, and whether it already sparked.
  const data = useMemo(() => {
    const n = T.capacity
    const d = { x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n), len: new Float32Array(n), hit: new Uint8Array(n) }
    for (let i = 0; i < n; i++) {
      d.len[i] = random(T.length)
      d.x[i] = random([-T.span - d.len[i], T.span]) // spread out from the start
      d.y[i] = random(T.yRange)
      d.z[i] = random(T.zRange)
    }
    return d
  }, [])
  const smooth = useRef({ level: 0, burst: 1, shelter: 0 })
  const m = useMemo(() => new Matrix4(), [])

  const respawn = (i: number) => {
    data.len[i] = random(T.length)
    data.x[i] = -T.span - data.len[i]
    data.y[i] = random(T.yRange)
    data.z[i] = random(T.zRange)
    data.hit[i] = 0
  }
  const spark = (x: number, y: number, z: number) => {
    const free = sparks.children.find((c) => !c.visible) as Sprite | undefined
    if (!free) return // pool full: skip
    free.position.set(x, y, z)
    free.userData.age = 0
    free.visible = true
  }

  useFrame((_, delta) => {
    const g = goal.current
    const sm = smooth.current
    const k = 1 - Math.exp(-delta * T.lerpSpeed)
    sm.level += (g.level - sm.level) * k
    sm.burst += (g.burst - sm.burst) * k * 3 // the burst comes in fast
    sm.shelter += (g.shelter - sm.shelter) * k
    const lvl = sm.level < 0.01 ? 0 : sm.level

    const count = Math.min(T.capacity, Math.round(lvl * T.maxCount * sm.burst))
    tracks.count = count
    tracks.visible = count > 0
    const speed = T.minSpeed + (T.maxSpeed - T.minSpeed) * lvl
    const sheltered = sm.shelter > 0.5
    const wall = -SHELTER.radius

    for (let i = 0; i < count; i++) {
      data.x[i] += speed * delta
      const tail = data.x[i]
      let head = tail + data.len[i]
      if (sheltered) {
        // stopped by the shelter: the part past the wall is absorbed
        if (!data.hit[i] && head >= wall) {
          data.hit[i] = 1
          spark(wall, data.y[i], data.z[i])
        }
        if (tail >= wall) {
          respawn(i)
          continue
        }
        head = Math.min(head, wall)
      } else if (!data.hit[i]) {
        const entry = entryX(data.y[i], data.z[i])
        if (entry !== null && head >= entry) {
          data.hit[i] = 1
          spark(entry, data.y[i], data.z[i])
        }
      }
      if (tail > T.span) respawn(i)
      m.makeScale(Math.max(head - tail, 0.001), 1, 1).setPosition(tail, data.y[i], data.z[i])
      tracks.setMatrixAt(i, m)
    }
    if (count > 0) tracks.instanceMatrix.needsUpdate = true

    for (const child of sparks.children) {
      const sprite = child as Sprite
      if (!sprite.visible) continue
      sprite.userData.age += delta
      const t = sprite.userData.age / T.sparks.life
      if (t >= 1) {
        sprite.visible = false
        continue
      }
      sprite.material.opacity = 1 - t
      sprite.scale.setScalar(T.sparks.size * (1 + t))
    }
  })

  return (
    <>
      <primitive object={tracks} />
      <primitive object={sparks} />
    </>
  )
}
