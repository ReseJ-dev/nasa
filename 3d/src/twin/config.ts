// All tunable numbers of the 3D scene in one place.
import type { RegionId, Status } from '../contract/types'

type Vec3 = [number, number, number]

// Camera controls. The camera moves on its own only on a selection change (see CameraRig.tsx).
export const CAMERA = {
  position: [0, 0.9, 3.2] as Vec3, // start in front of the body, at chest height
  fov: 45, // vertical field of view, degrees
  target: [0, 0.9, 0] as Vec3, // orbit center = vertical middle of the body
  fitPadding: 0.15, // space around a selected region when the camera fits to it
  smoothTime: 0.4, // seconds-ish for camera moves (higher = slower)
  minDistance: 1.5, // closest zoom
  maxDistance: 5, // farthest zoom
  minPolarAngle: Math.PI * 0.25, // cannot look from straight above
  maxPolarAngle: Math.PI * 0.75, // cannot look from straight below
}

// Rendering quality vs speed
export const RENDER = {
  dpr: [1, 1.5] as [number, number], // pixel ratio range: caps 4K/Retina screens at 1.5x
  multisampling: 4, // anti-aliasing samples in the post-processing pass (default 8 is heavy)
}

// Scene background and lights
export const SCENE = {
  // Vertical background gradient, top -> bottom.
  backgroundTop: '#0b1830',
  backgroundBottom: '#020309',
  ambientIntensity: 0.25, // lower than before: the environment adds soft light
  keyLight: { position: [3, 5, 4] as Vec3, intensity: 1.1 }, // main light, front-right-top
  rimLight: { position: [-3, 2, -4] as Vec3, intensity: 0.9, color: '#7fdcff' }, // back light, cyan outline
  // Few faint stars, so they stay cheap and do not compete with the body.
  stars: { radius: 40, depth: 20, count: 600, factor: 2, speed: 0.3 },
  environmentResolution: 64, // env map size; rendered once, built only from Lightformers
}

// Translucent body shell with a fresnel look: almost clear in the center,
// glowing cyan on the silhouette edges.
export const BODY_SHELL = {
  color: '#2a5a78', // base tint seen in the center
  roughness: 0.4,
  rimColor: '#4fe3ff', // cyan edge glow
  rimPower: 2.2, // higher = thinner edge
  rimIntensity: 1.6, // brightness of the edge glow
  // Opacity multipliers on top of the layer opacity (LAYERS.*.shell), result clamped to 1.
  centerAlpha: 0.35,
  edgeAlpha: 3.5,
  renderOrder: 10, // drawn after organs and bones (see Body.tsx: stencil, front-to-back)
}

// Skeleton (neutral, before density colors)
export const SKELETON = {
  color: '#ece8df', // bone white
  roughness: 0.6,
}

// Bloom glow, applied only to warning/critical regions in body mode.
export const BLOOM = {
  intensity: 0.8, // moderate glow strength
  luminanceThreshold: 0.05, // almost everything on a selected organ glows
  luminanceSmoothing: 0.3,
  radius: 0.6, // glow spread (0..1)
}

// Bone color by density (0..1, 1 = normal). Display only: the engine decides the values.
// 1 -> bone white, warnAt -> yellow, criticalAt and below -> red; smooth blend in between.
export const BONE_DENSITY = {
  warnAt: 0.93,
  criticalAt: 0.8,
  lerpSpeed: 4, // how fast bone color follows a density change
}

// The fracture label shows only if the weakest part's density is below this.
// Temporary display value: the real threshold will come from the engine later.
export const FRACTURE_LABEL_THRESHOLD = 0.9

// View layers: "body" (organs) and "skeleton". Opacity of each layer in each mode.
export type Layer = 'body' | 'skeleton'
export const LAYERS: Record<Layer, { shell: number; skeleton: number; organs: number }> = {
  body: { shell: 0.25, skeleton: 0, organs: 1 }, // skeleton hidden
  skeleton: { shell: 0.06, skeleton: 0.9, organs: 0.08 }, // shell almost gone, organs faint, only bones in focus
}
// In skeleton mode these regions are hidden completely (they overlap the bones);
// the other organs fade to LAYERS.skeleton.organs and cannot be hovered or clicked.
export const HIDDEN_IN_SKELETON: RegionId[] = ['muscles', 'bones']
export const LAYER_FADE_SPEED = 4 // how fast layers fade (higher = faster, ~0.7 s at 4)

// Heartbeat: the heart mesh scales in a "lub-dub, pause" rhythm.
export const HEART = {
  metricId: 'heart_rate', // Metric.id in the store
  defaultBpm: 70, // used when the metric is missing
  amplitude: 0.14, // extra scale at the strongest beat (0.14 = +14%)
  // Beat shape inside one cycle (0..1 of the cycle):
  lub: { at: 0.05, width: 0.045, strength: 1 }, // first, strong contraction
  dub: { at: 0.24, width: 0.045, strength: 0.55 }, // second, weaker one; the rest is a pause
}

// Cause chain: organs from `chain` light up one after another.
export const CHAIN = {
  stepDelay: 0.4, // seconds between two organs in the chain
  rise: 0.15, // seconds for an organ to fully light up
  flash: 1.2, // extra emissive right when an organ lights up, then fades
  flashDecay: 0.35, // seconds for the flash to fade (time constant)
  hold: 0.35, // extra emissive that stays while the organ is in the chain
}

// Organ material and animation
export const REGION = {
  roughness: 0.5,
  // How fast color and glow follow their target (higher = faster, ~0.5 s at 6).
  lerpSpeed: 6,
  dimmedBrightness: 0.15, // color/glow of non-selected organs while a region is selected
  // Emissive glow strength in each state. Base glow depends on the status:
  // ok organs stay dim, warning/critical stand out.
  emissive: {
    base: { ok: 0.04, warning: 0.35, critical: 0.5 } as Record<Status, number>,
    selected: 0.5,
    hover: 0.9,
  },
  // Emissive pulse for unhealthy regions, added on top of the glow above.
  // hz = pulses per second, amplitude = extra emissive at the peak.
  pulse: {
    ok: { hz: 0, amplitude: 0 },
    warning: { hz: 0.7, amplitude: 0.35 },
    critical: { hz: 1.6, amplitude: 0.9 },
  },
}

// Five threats strip: level (0..1) -> color, same palette as the organs.
// Below warnAt = ok color, from warnAt = warning, from criticalAt = critical.
export const THREAT_LEVEL = {
  warnAt: 0.4,
  criticalAt: 0.7,
}

// Optional radiation particles flowing through the body. Count and speed follow threats.radiation.level.
export const RADIATION_PARTICLES = {
  enabled: true, // false = no particles at all
  maxCount: 300, // at level 1
  minSpeed: 0.15, // units per second at level 0
  maxSpeed: 0.9, // units per second at level 1
  color: '#e4d8ff', // violet-white
  size: 0.018,
  opacity: 0.8,
  // Box the particles fly through: they enter at x = -span and leave at x = +span.
  span: 1.1,
  yRange: [0.05, 1.85] as [number, number],
  zRange: [-0.25, 0.25] as [number, number],
}
