// All tunable numbers of the 3D scene in one place.

type Vec3 = [number, number, number]

// Camera and orbit controls
export const CAMERA = {
  position: [0, 0.9, 3.2] as Vec3, // start in front of the body, at chest height
  fov: 45, // vertical field of view, degrees
  target: [0, 0.9, 0] as Vec3, // orbit center = vertical middle of the body
  minDistance: 1.5, // closest zoom
  maxDistance: 5, // farthest zoom
  minPolarAngle: Math.PI * 0.25, // cannot look from straight above
  maxPolarAngle: Math.PI * 0.75, // cannot look from straight below
}

// Scene background and lights
export const SCENE = {
  background: '#05070d',
  ambientIntensity: 0.5,
  keyLight: { position: [3, 5, 4] as Vec3, intensity: 1.2 }, // main light, front-right-top
  rimLight: { position: [-3, 2, -4] as Vec3, intensity: 0.5 }, // back light, outlines the shell
}

// Translucent body shell
export const BODY_SHELL = {
  color: '#9fc4e8',
  roughness: 0.35,
  clearcoat: 0.6,
  clearcoatRoughness: 0.3,
}

// Skeleton (neutral, before density colors)
export const SKELETON = {
  color: '#ece8df', // bone white
  roughness: 0.6,
}

// Bone color by density (0..1, 1 = normal). Display only: the engine decides the values.
// 1 -> bone white, warnAt -> yellow, criticalAt and below -> red; smooth blend in between.
export const BONE_DENSITY = {
  warnAt: 0.93,
  criticalAt: 0.8,
  lerpSpeed: 4, // how fast bone color follows a density change
  fractureLabel: 'Fracture risk at landing', // shown at the weakest bone part
}

// View layers: "body" (organs) and "skeleton". Opacity of each layer in each mode.
export type Layer = 'body' | 'skeleton'
export const LAYERS: Record<Layer, { shell: number; skeleton: number; organs: number }> = {
  body: { shell: 0.25, skeleton: 0, organs: 1 }, // skeleton hidden
  skeleton: { shell: 0.06, skeleton: 0.9, organs: 0.12 }, // shell almost gone, organs dimmed
}
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
  // Emissive glow strength in each state.
  emissive: {
    base: 0.15,
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
