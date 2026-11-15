import { BufferAttribute, BufferGeometry } from 'three'

// Body shell geometry, built once at module load (no asset files, nothing downloaded).
//
// The body is described as a set of soft shapes (ellipsoids and tapered capsules) that are
// blended into ONE smooth surface, so there are no seams where an arm meets the torso.
// How: a distance field (for any point: how far is the skin?) is sampled on a grid, and the
// skin surface is extracted from it ("surface nets"). Normals come from the field itself,
// so shading is smooth everywhere.
//
// The surface is then cut into a few meshes (head, torso, arms, legs): the shell material
// draws the nearest part first (see Body.tsx), so an arm in front of the torso stays visible.
// The cuts are invisible: both sides share the same surface and normals.
//
// Units as everywhere in the twin: meters, feet at y = 0, the astronaut faces +z,
// their left side is +x. Only the +x half is described; the other half is its mirror.

type Vec3 = [number, number, number]

// ---- Landmarks (shared with Skeleton.tsx and regions.ts, so bones and organs fit inside) ----

const ARM_ANGLE = 0.23 // radians away from the body: a relaxed pose, arms clear of the hips
const ARM_DIR: Vec3 = [Math.sin(ARM_ANGLE), -Math.cos(ARM_ANGLE), 0]
const along = (from: Vec3, d: number, z = 0): Vec3 => [from[0] + ARM_DIR[0] * d, from[1] + ARM_DIR[1] * d, from[2] + z]

const SHOULDER: Vec3 = [0.218, 1.425, -0.005]
export const BODY = {
  armAngle: ARM_ANGLE,
  shoulder: SHOULDER,
  upperArm: 0.29, // shoulder -> elbow
  forearm: 0.26, // elbow -> wrist
  hand: 0.17, // wrist -> fingertips
  elbow: along(SHOULDER, 0.29, -0.005),
  wrist: along(SHOULDER, 0.55, 0.025),
  fingertips: along(SHOULDER, 0.72, 0.045),
  hip: [0.095, 0.9, 0] as Vec3,
  knee: [0.097, 0.495, 0.008] as Vec3,
  ankle: [0.099, 0.085, -0.012] as Vec3,
  headCenter: [0, 1.685, 0] as Vec3,
}

// ---- Soft shapes ---------------------------------------------------------------------------

const Part = { Head: 0, Torso: 1, Arm: 2, Leg: 3 } as const
type Part = (typeof Part)[keyof typeof Part]

interface Ellipsoid {
  kind: 'ellipsoid'
  part: Part
  c: Vec3
  r: Vec3
}
interface Cone {
  kind: 'cone'
  part: Part
  a: Vec3
  b: Vec3
  r1: number
  r2: number
}
type Shape = Ellipsoid | Cone

const ellipsoid = (part: Part, c: Vec3, r: Vec3): Shape => ({ kind: 'ellipsoid', part, c, r })
// Tapered capsule: radius r1 at a, r2 at b.
const cone = (part: Part, a: Vec3, r1: number, b: Vec3, r2: number): Shape => ({ kind: 'cone', part, a, b, r1, r2 })

const B = BODY
const SHAPES: Shape[] = [
  // head: skull + jaw
  ellipsoid(Part.Head, B.headCenter, [0.086, 0.112, 0.098]),
  ellipsoid(Part.Head, [0, 1.612, 0.022], [0.063, 0.074, 0.07]),
  // neck and the slope from the neck to the shoulders
  cone(Part.Torso, [0, 1.6, -0.012], 0.05, [0, 1.47, -0.02], 0.058),
  cone(Part.Torso, [0, 1.525, -0.03], 0.04, [0.165, 1.455, -0.015], 0.046),
  // shoulder girdle: fills the dip between the neck slope, the chest and the shoulders
  ellipsoid(Part.Torso, [0, 1.405, -0.008], [0.19, 0.075, 0.092]),
  // chest, waist, hips
  ellipsoid(Part.Torso, [0, 1.3, 0], [0.166, 0.2, 0.115]),
  ellipsoid(Part.Torso, [0, 1.09, 0], [0.153, 0.2, 0.1]),
  ellipsoid(Part.Torso, [0, 0.94, -0.008], [0.176, 0.13, 0.112]),
  // arm: shoulder cap, upper arm, forearm, hand (a flat mitten, palm toward the thigh)
  ellipsoid(Part.Arm, [0.206, 1.418, -0.005], [0.062, 0.06, 0.062]),
  cone(Part.Arm, B.shoulder, 0.054, B.elbow, 0.04),
  cone(Part.Arm, B.elbow, 0.043, B.wrist, 0.027),
  ellipsoid(Part.Arm, along(B.shoulder, 0.635, 0.035), [0.024, 0.09, 0.042]),
  // leg: thigh, shin, calf muscle, foot
  cone(Part.Leg, B.hip, 0.083, B.knee, 0.054),
  cone(Part.Leg, B.knee, 0.052, B.ankle, 0.034),
  ellipsoid(Part.Leg, [0.099, 0.35, -0.022], [0.05, 0.12, 0.052]),
  cone(Part.Leg, [0.099, 0.046, -0.022], 0.04, [0.105, 0.032, 0.125], 0.027),
]

const BLEND = 0.035 // how softly two shapes melt into each other (meters)

function ellipsoidDistance(s: Ellipsoid, x: number, y: number, z: number) {
  const px = (x - s.c[0]) / s.r[0]
  const py = (y - s.c[1]) / s.r[1]
  const pz = (z - s.c[2]) / s.r[2]
  const k0 = Math.hypot(px, py, pz)
  const k1 = Math.hypot(px / s.r[0], py / s.r[1], pz / s.r[2])
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(s.r[0], s.r[1], s.r[2])
}

function coneDistance(s: Cone, x: number, y: number, z: number) {
  const bax = s.b[0] - s.a[0]
  const bay = s.b[1] - s.a[1]
  const baz = s.b[2] - s.a[2]
  const l2 = bax * bax + bay * bay + baz * baz
  const rr = s.r1 - s.r2
  const a2 = l2 - rr * rr
  const il2 = 1 / l2
  const pax = x - s.a[0]
  const pay = y - s.a[1]
  const paz = z - s.a[2]
  const h = pax * bax + pay * bay + paz * baz
  const zz = h - l2
  const qx = pax * l2 - bax * h
  const qy = pay * l2 - bay * h
  const qz = paz * l2 - baz * h
  const x2 = qx * qx + qy * qy + qz * qz
  const y2 = h * h * l2
  const z2 = zz * zz * l2
  const k = Math.sign(rr) * rr * rr * x2
  if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - s.r2
  if (Math.sign(h) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - s.r1
  return (Math.sqrt(x2 * a2 * il2) + h * rr) * il2 - s.r1
}

const shapeDistance = (s: Shape, x: number, y: number, z: number) =>
  s.kind === 'ellipsoid' ? ellipsoidDistance(s, x, y, z) : coneDistance(s, x, y, z)

// Distance to the skin: negative inside the body. Mirrored in x.
function skin(x: number, y: number, z: number) {
  const ax = Math.abs(x)
  let d = 1e9
  for (const s of SHAPES) {
    const ds = shapeDistance(s, ax, y, z)
    const h = Math.max(BLEND - Math.abs(d - ds), 0) / BLEND
    d = Math.min(d, ds) - h * h * BLEND * 0.25 // smooth union
  }
  return Math.max(d, -y) // flat soles on the floor
}

// Which part a surface point belongs to (the nearest shape's part).
function partAt(x: number, y: number, z: number): Part {
  const ax = Math.abs(x)
  let best = 1e9
  let part: Part = Part.Torso
  for (const s of SHAPES) {
    const ds = shapeDistance(s, ax, y, z)
    if (ds < best) {
      best = ds
      part = s.part
    }
  }
  return part
}

// ---- Surface extraction ("surface nets") ----------------------------------------------------

export type ShellPartId = 'head' | 'torso' | 'arm_left' | 'arm_right' | 'leg_left' | 'leg_right'
const SHELL_PART_IDS: ShellPartId[] = ['head', 'torso', 'arm_left', 'arm_right', 'leg_left', 'leg_right']

const CELL = 0.009 // grid step: about 4.5 px at the default camera on a 1080p screen
const MIN: Vec3 = [-0.432, -0.018, -0.171]
const SIZE = [97, 204, 43] // grid points per axis (x count is odd: one plane sits exactly on x = 0)

function buildShell(): Record<ShellPartId, BufferGeometry> {
  const [nx, ny, nz] = SIZE
  const at = (i: number, j: number, k: number) => i + nx * (j + ny * k)

  // 1. Sample the field (only x >= 0, then mirror).
  const field = new Float32Array(nx * ny * nz)
  const mid = (nx - 1) / 2
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = mid; i < nx; i++) {
        const v = skin(MIN[0] + i * CELL, MIN[1] + j * CELL, MIN[2] + k * CELL)
        field[at(i, j, k)] = v
        field[at(nx - 1 - i, j, k)] = v
      }

  // 2. One vertex in every grid cell the surface passes through: the average of the points
  //    where the surface crosses the cell's edges.
  const cx = nx - 1
  const cy = ny - 1
  const cz = nz - 1
  const cellAt = (i: number, j: number, k: number) => i + cx * (j + cy * k)
  const cellVertex = new Int32Array(cx * cy * cz).fill(-1)
  const positions: number[] = []
  const corner = new Float32Array(8)
  // The 12 edges of a cell as pairs of corner numbers (corner bits: 1 = +x, 2 = +y, 4 = +z).
  const EDGES = [0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7]
  for (let k = 0; k < cz; k++)
    for (let j = 0; j < cy; j++)
      for (let i = 0; i < cx; i++) {
        let inside = 0
        for (let c = 0; c < 8; c++) {
          corner[c] = field[at(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1))]
          if (corner[c] < 0) inside++
        }
        if (inside === 0 || inside === 8) continue
        let sx = 0
        let sy = 0
        let sz = 0
        let n = 0
        for (let e = 0; e < 24; e += 2) {
          const a = EDGES[e]
          const b = EDGES[e + 1]
          if (corner[a] < 0 === corner[b] < 0) continue
          const t = corner[a] / (corner[a] - corner[b])
          sx += (a & 1) + t * ((b & 1) - (a & 1))
          sy += ((a >> 1) & 1) + t * (((b >> 1) & 1) - ((a >> 1) & 1))
          sz += ((a >> 2) & 1) + t * (((b >> 2) & 1) - ((a >> 2) & 1))
          n++
        }
        cellVertex[cellAt(i, j, k)] = positions.length / 3
        positions.push(MIN[0] + (i + sx / n) * CELL, MIN[1] + (j + sy / n) * CELL, MIN[2] + (k + sz / n) * CELL)
      }

  // 3. Normals: the direction in which the distance grows fastest.
  const vertexCount = positions.length / 3
  const normals = new Float32Array(vertexCount * 3)
  const e = CELL * 0.5
  for (let v = 0; v < vertexCount; v++) {
    const x = positions[v * 3]
    const y = positions[v * 3 + 1]
    const z = positions[v * 3 + 2]
    const gx = skin(x + e, y, z) - skin(x - e, y, z)
    const gy = skin(x, y + e, z) - skin(x, y - e, z)
    const gz = skin(x, y, z + e) - skin(x, y, z - e)
    const l = Math.hypot(gx, gy, gz) || 1
    normals[v * 3] = gx / l
    normals[v * 3 + 1] = gy / l
    normals[v * 3 + 2] = gz / l
  }

  // 4. One quad for every grid edge the surface crosses, joining the 4 cells around that edge.
  const indices: Record<ShellPartId, number[]> = {
    head: [],
    torso: [],
    arm_left: [],
    arm_right: [],
    leg_left: [],
    leg_right: [],
  }
  const quad = (a: number, b: number, c: number, d: number) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return
    // Winding: the face must look the same way as the surface normal (outward).
    const ux = positions[b * 3] - positions[a * 3]
    const uy = positions[b * 3 + 1] - positions[a * 3 + 1]
    const uz = positions[b * 3 + 2] - positions[a * 3 + 2]
    const wx = positions[d * 3] - positions[a * 3]
    const wy = positions[d * 3 + 1] - positions[a * 3 + 1]
    const wz = positions[d * 3 + 2] - positions[a * 3 + 2]
    const facing =
      (uy * wz - uz * wy) * normals[a * 3] + (uz * wx - ux * wz) * normals[a * 3 + 1] + (ux * wy - uy * wx) * normals[a * 3 + 2]
    const flip = facing < 0
    const mx = (positions[a * 3] + positions[c * 3]) / 2
    const my = (positions[a * 3 + 1] + positions[c * 3 + 1]) / 2
    const mz = (positions[a * 3 + 2] + positions[c * 3 + 2]) / 2
    const part = partAt(mx, my, mz)
    const left = mx >= 0 // the astronaut's left side is +x
    const id: ShellPartId =
      part === Part.Head ? 'head' : part === Part.Torso ? 'torso' : part === Part.Arm ? (left ? 'arm_left' : 'arm_right') : left ? 'leg_left' : 'leg_right'
    if (flip) indices[id].push(a, d, c, a, c, b)
    else indices[id].push(a, b, c, a, c, d)
  }
  // Top-down, so inside one part the higher surface is listed (and drawn) first.
  for (let j = cy - 1; j >= 1; j--)
    for (let k = 1; k < cz; k++)
      for (let i = 1; i < cx; i++) {
        const inside = field[at(i, j, k)] < 0
        // edge along x
        if (inside !== field[at(i + 1, j, k)] < 0)
          quad(cellVertex[cellAt(i, j - 1, k - 1)], cellVertex[cellAt(i, j, k - 1)], cellVertex[cellAt(i, j, k)], cellVertex[cellAt(i, j - 1, k)])
        // edge along y
        if (inside !== field[at(i, j + 1, k)] < 0)
          quad(cellVertex[cellAt(i - 1, j, k - 1)], cellVertex[cellAt(i - 1, j, k)], cellVertex[cellAt(i, j, k)], cellVertex[cellAt(i, j, k - 1)])
        // edge along z
        if (inside !== field[at(i, j, k + 1)] < 0)
          quad(cellVertex[cellAt(i - 1, j - 1, k)], cellVertex[cellAt(i, j - 1, k)], cellVertex[cellAt(i, j, k)], cellVertex[cellAt(i - 1, j, k)])
      }

  // 5. One geometry per part, with only the vertices that part uses.
  const result = {} as Record<ShellPartId, BufferGeometry>
  for (const id of SHELL_PART_IDS) {
    const remap = new Map<number, number>()
    const pos: number[] = []
    const nor: number[] = []
    const idx = indices[id].map((v) => {
      let nv = remap.get(v)
      if (nv === undefined) {
        nv = remap.size
        remap.set(v, nv)
        pos.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2])
        nor.push(normals[v * 3], normals[v * 3 + 1], normals[v * 3 + 2])
      }
      return nv
    })
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
    geo.setAttribute('normal', new BufferAttribute(new Float32Array(nor), 3))
    geo.setIndex(idx)
    geo.computeBoundingSphere()
    result[id] = geo
  }
  return result
}

export const SHELL_GEOMETRY = buildShell()
export const SHELL_PARTS = SHELL_PART_IDS
