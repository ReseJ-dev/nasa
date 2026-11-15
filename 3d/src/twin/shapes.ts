import { LatheGeometry, SphereGeometry, Vector2, Vector3 } from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Shape helpers shared by the organs (regions.ts) and the skeleton. Call them only at module
// load, never during render.

type Vec3 = [number, number, number]

// Smooth organ shape: a sphere stretched to `radii`, optionally reshaped by `deform`
// (called for every point of the unit sphere, x/y/z in -1..1), then moved to `offset`.
export function blob(radii: Vec3, deform?: (p: Vector3) => void, offset: Vec3 = [0, 0, 0], detail = 1) {
  const sphere = new SphereGeometry(1, 28 * detail, 20 * detail)
  sphere.deleteAttribute('uv')
  sphere.deleteAttribute('normal')
  const pos = sphere.getAttribute('position')
  const p = new Vector3()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    deform?.(p)
    pos.setXYZ(i, p.x * radii[0] + offset[0], p.y * radii[1] + offset[1], p.z * radii[2] + offset[2])
  }
  // Join the sphere's seam so the recomputed normals are smooth across it.
  const geo = mergeVertices(sphere)
  sphere.dispose()
  geo.computeVertexNormals()
  return geo
}

// Capsule that tapers: radius rTop at the upper end, rBottom at the lower end.
// `length` is the straight part between the two round caps; centered at the origin.
export function taperedCapsule(rTop: number, rBottom: number, length: number) {
  const points: Vector2[] = []
  const steps = 8
  for (let i = 0; i <= steps; i++) {
    const a = (-Math.PI / 2) * (1 - i / steps) // bottom cap, from the pole up
    points.push(new Vector2(Math.cos(a) * rBottom, -length / 2 + Math.sin(a) * rBottom))
  }
  for (let i = 0; i <= steps; i++) {
    const a = (Math.PI / 2) * (i / steps) // top cap, up to the pole
    points.push(new Vector2(Math.cos(a) * rTop, length / 2 + Math.sin(a) * rTop))
  }
  return new LatheGeometry(points, 20)
}
