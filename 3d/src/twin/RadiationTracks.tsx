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
  Ray,
  Sphere,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three'
import { useHealthStore } from './store'
import { useSceneStore } from './sceneStore'
import { useThreatEffect } from './hooks/useThreatEffect'
import { BODY_PROFILE, EFFECTS, RADIATION_TRACKS as T, SHELTER, SOLAR_FLARE, type Layer } from './config'
import { DOT_TEXTURE } from './textures'

// Radiation tracks: narrow angled streaks from the Sun side (-x) through the body,
// one InstancedMesh (one draw call). Count and speed from radiationLevel x useThreatEffect,
// x3 during a solar flare burst. Where a track enters the body shell a short spark flashes
// (pooled). In the shelter the tracks stop at the shelter wall and spark there instead.
// All per-track data lives in typed arrays; updated in useFrame, no React state.

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

const [shieldX, shieldY, shieldZ] = SHELTER.center
const shieldHalfLength = SHELTER.length / 2
const lowerCap = new Sphere(new Vector3(shieldX, shieldY - shieldHalfLength, shieldZ), SHELTER.radius)
const upperCap = new Sphere(new Vector3(shieldX, shieldY + shieldHalfLength, shieldZ), SHELTER.radius)

function shieldEntry(ray: Ray, point: Vector3): number {
  const { origin, direction } = ray
  const x = origin.x - shieldX
  const z = origin.z - shieldZ
  const a = direction.x ** 2 + direction.z ** 2
  const b = x * direction.x + z * direction.z
  const c = x ** 2 + z ** 2 - SHELTER.radius ** 2
  const d = b ** 2 - a * c
  let distance = Infinity
  if (d >= 0) {
    for (const t of [(-b - Math.sqrt(d)) / a, (-b + Math.sqrt(d)) / a]) {
      if (t >= 0 && Math.abs(origin.y + t * direction.y - shieldY) <= shieldHalfLength) distance = Math.min(distance, t)
    }
  }
  for (const cap of [lowerCap, upperCap]) {
    if (ray.intersectSphere(cap, point)) distance = Math.min(distance, point.distanceTo(origin))
  }
  return origin.x + distance * direction.x
}

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
    map: TRAIL,
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

// Hidden in skeleton mode.
export function RadiationTracks({ layer, still = false }: { layer: Layer; still?: boolean }) {
  const level = useHealthStore((st) => st.radiationLevel ?? 0)
  const inShelter = useHealthStore((st) => st.inShelter ?? false)
  const effect = useThreatEffect('radiation')
  const burst = useSceneStore((st) => st.flareBurst)
  const seed = useRef(512)
  const nextRandom = () => {
    if (!still) return Math.random()
    seed.current = (Math.imul(seed.current, 1664525) + 1013904223) >>> 0
    return seed.current / 4294967296
  }
  const random = (r: [number, number]) => r[0] + nextRandom() * (r[1] - r[0])

  const goal = useRef({ level: 0, burst: 1, shelter: 0 })
  useLayoutEffect(() => {
    goal.current = {
      level: layer === 'body' ? level * (still ? 1 : effect) : 0,
      burst: burst && EFFECTS.solarFlare ? SOLAR_FLARE.burstFactor : 1,
      shelter: inShelter && EFFECTS.shelter ? 1 : 0,
    }
  }, [level, effect, burst, inShelter, layer, still])

  const tracks = useMemo(createTracks, [])
  const sparks = useMemo(createSparks, [])
  // y/z are the intercepts at x=0, dy/dz are the slopes.
  const data = useMemo(() => {
    seed.current = 512
    const n = T.capacity
    const d = {
      x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n),
      dy: new Float32Array(n), dz: new Float32Array(n), wall: new Float32Array(n),
      len: new Float32Array(n), hit: new Uint8Array(n),
    }
    for (let i = 0; i < n; i++) {
      resetTrack(d, i)
      d.x[i] = random([-T.span - d.len[i], T.span]) // spread out from the start
    }
    return d
  }, [])
  const smooth = useRef({ level: 0, burst: 1, shelter: 0 })
  const m = useMemo(() => new Matrix4(), [])
  const direction = useMemo(() => new Vector3(), [])

  function resetTrack(track: typeof data, i: number) {
    track.len[i] = random(T.length)
    track.x[i] = -T.span - track.len[i]
    track.y[i] = random(T.yRange)
    track.z[i] = random(T.zRange)
    track.dy[i] = random([0.15, 0.7]) * (nextRandom() < 0.5 ? -1 : 1)
    track.dz[i] = random([-0.33, 0.33])
    track.hit[i] = 0
    if (nextRandom() < 0.9) {
      const x = track.x[i]
      const ray = new Ray(
        new Vector3(x, track.y[i] + x * track.dy[i], track.z[i] + x * track.dz[i]),
        new Vector3(1, track.dy[i], track.dz[i]).normalize(),
      )
      track.wall[i] = shieldEntry(ray, new Vector3())
    } else track.wall[i] = Infinity
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

    for (let i = 0; i < count; i++) {
      data.x[i] += speed * delta
      const tail = data.x[i]
      let head = tail + data.len[i]
      const y = (x: number) => data.y[i] + data.dy[i] * x
      const z = (x: number) => data.z[i] + data.dz[i] * x
      const wall = data.wall[i]
      if (sheltered && Number.isFinite(wall)) {
        // stopped by the shelter: the part past the wall is absorbed
        if (!data.hit[i] && head >= wall) {
          data.hit[i] = 1
          spark(wall, y(wall), z(wall))
        }
        if (tail >= wall) {
          resetTrack(data, i)
          tracks.setMatrixAt(i, m.makeScale(0, 0, 0))
          continue
        }
        head = Math.min(head, wall)
      } else if (!data.hit[i]) {
        const entry = entryX(y(head), z(head))
        if (entry !== null && head >= entry) {
          data.hit[i] = 1
          spark(entry, y(entry), z(entry))
        }
      }
      if (tail > T.span) resetTrack(data, i)
      const span = Math.max(head - tail, 0.001)
      direction.set(span, data.dy[i] * span, data.dz[i] * span)
      m.set(
        direction.x, 0, 0, tail,
        direction.y, 1, 0, y(tail),
        direction.z, 0, 1, z(tail),
        0, 0, 0, 1,
      )
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
