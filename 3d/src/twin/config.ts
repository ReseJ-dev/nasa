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
  opacity: 0.25,
  roughness: 0.35,
  clearcoat: 0.6,
  clearcoatRoughness: 0.3,
}

// Heartbeat: the heart mesh scales in a "lub-dub, pause" rhythm.
export const HEART = {
  metricId: 'heart_rate', // Metric.id in the store
  defaultBpm: 70, // used when the metric is missing
  amplitude: 0.14, // extra scale at the strongest beat (0.14 = +14%)
  // Beat shape inside one cycle (0..1 of the cycle):
  lub: { at: 0.05, width: 0.045, strength: 1 }, // first, strong contraction
  dub: { at: 0.24, width: 0.045, strength: 0.55 }, // second, weaker one; the rest is a pause
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
