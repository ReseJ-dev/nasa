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
}
