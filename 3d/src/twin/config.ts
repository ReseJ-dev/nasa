// All tunable numbers of the 3D scene in one place.
import type { RegionId, Status, ThreatId } from '../contract/types'

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

// Cause labels between chain organs (from chainLinks).
export const CHAIN_LABEL = {
  zOffset: 0.25, // in front of the body, so the label does not sit inside the organs
  fadeMs: 400, // fade-in time when the label's organ lights up
}

// Habitat module around the body (isolation + closed environment threats).
// Every part is scaled by useThreatEffect: full when its threat is focused (or demo), faint otherwise.
export const HABITAT = {
  // Wireframe module (isolation): rings and ribs, one LineSegments object.
  yBottom: 0.02,
  yTop: 2.05,
  rings: 5,
  ribs: 12,
  segments: 64, // per ring
  radiusMax: 0.95, // at the active threshold
  radiusMin: 0.55, // at isolation level 1: the walls close in
  colorLow: '#5f7396', // dull blue (THREAT_COLOR.isolation)
  colorHigh: '#26314a', // darker, colder at high isolation
  maxOpacity: 0.35,
  lerpSpeed: 2,
}

// Fog inside the module (environment), driven by co2Level.
export const CABIN_FOG = {
  radius: 0.92, // fraction of the module radius
  lowColor: '#8a8f96', // just above the threshold (neutral grey)
  // high values blend toward THREAT_COLOR.environment (grey-orange)
  minOpacity: 0.06, // at the threshold
  maxOpacity: 0.3, // at co2Level = 1
  noiseScale: 3.5, // size of the fog blobs (higher = smaller)
  driftSpeed: 0.25,
  lerpSpeed: 2,
}

// Flow of stale air from the fog into the nose and lungs: the start of the chain lungs -> brain -> eyes.
export const CABIN_FLOW = {
  path: [
    [-0.62, 1.25, 0.45],
    [-0.3, 1.58, 0.35],
    [0, 1.63, 0.16], // nose
    [-0.04, 1.47, 0.07],
    [-0.085, 1.32, 0], // lungs
  ] as Vec3[],
  pulses: 7, // moving dots on the path
  loopSeconds: 2.6, // one dot travels the whole path in this time
  size: 0.035,
  color: '#ffb27a',
  lineOpacity: 0.25, // the faint path itself
}

// Cabin sensors on the module wall (environment). angle: around the body, 0 = in front,
// negative = the viewer's left. Low on the wall, below the left-side callouts.
export const SENSORS = {
  co2: { angle: -1.0, y: 0.8, warnAt: 0.4, criticalAt: 0.7 }, // co2Level 0..1, shown in %
  temp: { angle: -1.0, y: 0.55, warnAt: 25, criticalAt: 27 }, // °C
  noise: { angle: -1.0, y: 0.3, warnAt: 60, criticalAt: 65 }, // dB
}

// Circadian ring near the brain (isolation): 24 h circle with the sleep sector.
export const CIRCADIAN = {
  position: [0.34, 1.98, 0] as Vec3,
  size: 64, // px
  normalBedtime: 23, // hour the sleep sector starts when sleepShiftHours = 0
  // status: warning if sleep < warnSleep or shift > warnShift; critical if sleep < critSleep or shift >= critShift
  warnSleep: 6,
  warnShift: 2,
  critSleep: 5,
  critShift: 3,
}

// Organ material and animation
export const REGION = {
  roughness: 0.5,
  // How fast color and glow follow their target (higher = faster, ~0.5 s at 6).
  lerpSpeed: 6,
  dimmedBrightness: 0.15, // color/glow of non-selected organs while a region is selected
  threatDimmedBrightness: 0.2, // organs outside the highlighted threat's regions
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

// A threat counts as active from this level (0..1).
export const THREAT_ACTIVE_THRESHOLD = 0.3

// Strength of an active threat's 3D effect while it is NOT focused (and no demo): a faint background.
export const THREAT_BACKGROUND_EMPHASIS = 0.3

// Threats strip layout (px) and its lines.
export const THREAT_STRIP = {
  slot: 96, // width per threat
  ring: 44, // icon ring diameter
  ringWidth: 3,
  arcSpace: 30, // room above the rings for the threat-link arcs
  linkOpacity: 0.22, // threat-link arcs at rest
  linkOpacityFocused: 0.85, // when one end is the focused threat
  focusLineOpacity: 0.55, // lines from the focused icon toward its regions
  focusLineReach: 0.92, // lines stop at this fraction of the way, so they do not cover the organ
}

// Identity color per threat. Deliberately different from the status colors
// (ok grey, warning yellow, critical red), so a threat is never read as a status.
export const THREAT_COLOR: Record<ThreatId, string> = {
  radiation: '#a66cff', // violet
  isolation: '#5f7396', // dull blue
  gravity: '#a8eef7', // light cyan
  distance: '#3a6dff', // blue
  environment: '#b8927a', // grey-orange
}

// Radiation visuals: particles, hits (sparks) and the immune shimmer. Driven by radiationLevel.
// Nothing is shown below THREAT_ACTIVE_THRESHOLD. enabled = false switches all of it off.
export const RADIATION_PARTICLES = {
  enabled: true,
  lerpSpeed: 1.5, // how fast count and speed follow radiationLevel
  // Particles: they come from the Sun side (the astronaut's right, -x) and fly to +x.
  maxCount: 300, // at radiationLevel = 1
  minSpeed: 0.3, // units per second at the threshold
  maxSpeed: 1.2, // units per second at radiationLevel = 1
  color: '#e4d8ff', // violet-white
  size: 0.022,
  opacity: 0.85,
  span: 1.1, // enter at x = -span, leave at x = +span
  yRange: [0.05, 1.85] as [number, number],
  zRange: [-0.25, 0.25] as [number, number],
  // Hits: tiny violet sparks at random points inside the body shell.
  sparks: {
    max: 5, // pooled, never more at once
    maxRate: 6, // sparks per second at radiationLevel = 1
    life: 0.3, // seconds to fade out
    size: 0.05,
    color: '#b57bff',
  },
  // Immune region: slight violet shimmer on top of its status color.
  shimmer: {
    color: '#a66cff',
    amount: 0.35, // how far the emissive color moves toward violet (0..1)
    wobble: 0.15, // shimmer depth around `amount`
    hz: 2.2,
  },
}

// Rough volumes inside the body shell (same units as Body.tsx), for random hit points.
// [min corner, max corner] boxes; each box is picked with the same chance.
export const BODY_VOLUMES: [Vec3, Vec3][] = [
  [[-0.06, 1.58, -0.06], [0.06, 1.76, 0.06]], // head
  [[-0.15, 1.0, -0.08], [0.15, 1.42, 0.08]], // torso
  [[-0.14, 0.86, -0.08], [0.14, 0.98, 0.08]], // pelvis
  [[-0.13, 0.15, -0.04], [-0.05, 0.82, 0.04]], // right leg
  [[0.05, 0.15, -0.04], [0.13, 0.82, 0.04]], // left leg
  [[-0.32, 0.9, -0.03], [-0.25, 1.38, 0.03]], // right arm
  [[0.25, 0.9, -0.03], [0.32, 1.38, 0.03]], // left arm
]
