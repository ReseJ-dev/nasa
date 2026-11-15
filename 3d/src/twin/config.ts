// All tunable numbers of the 3D scene in one place.
import type { RegionId, Status, ThreatId } from '../contract/types'

type Vec3 = [number, number, number]

// Camera controls. The camera moves on its own only on a selection change (see CameraRig.tsx).
export const CAMERA = {
  // Start in front of the body, at mid height. At this distance the figure (1.8 units tall)
  // fills about 90 % of the canvas height (the twin is the hero of the presentation screen).
  position: [0, 0.93, 2.52] as Vec3,
  fov: 45, // vertical field of view, degrees
  target: [0, 0.93, 0] as Vec3, // orbit center = vertical middle of the body
  fitPadding: 0.5, // space around a selected region when the camera fits to it: the organ in its body context
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
  // Breathing: the edge glow slowly swells and fades, always on. One calm cycle every
  // `breathSeconds`; far slower than the warning (0.7 Hz) and critical (1.6 Hz) pulses.
  breathSeconds: 5,
  breathAmount: 0.22, // +/- share of rimIntensity
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
  headFrom: 1.6, // a label whose midpoint is above this height is inside the head...
  aboveHead: 1.76, // ...and is lifted here: it is drawn in front of the body, so on screen this lands just above the head
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

// ---- Isolation and confinement visuals -------------------------------------------------
// One designed set: circadian ring (sleep, light), reaction impulse (alertness), activity bars,
// mood dots. Everything is thin additive lines in the hologram style, no panels.
// Display only: statuses come from `alerts` in the store, never from thresholds here.
export const ISOLATION = {
  line: '#8fa6d0', // the dull isolation blue, lifted so 2 px lines keep contrast on the dark background
  renderOrder: 11, // after the body shell, so the lines stay crisp on top of it
  minLine: 0.0035, // tube radius of the thinnest lines: about 2.5 px wide at the default camera, 1080p
  // Staged fade-in when isolation gets the focus: ring -> impulse -> bars -> labels.
  fadeIn: 0.6, // seconds for one element
  stagger: 0.2, // seconds between two elements
  fadeOut: 0.4,
  valueLerp: 3.5, // how fast shown values follow the store (arc length, rotation, bars, numbers)
  colorLerp: 4,
  // Camera while isolation is pinned: it rises a little and looks slightly down, so the ring
  // reads as a circle and the floor bars open up, with the whole figure still in frame
  // (ring at the head, readout at the hand, bars on the floor). For a head-and-shoulders
  // framing use position [0, 1.72, 1.75] and target [0, 1.6, 0] (the hand and the bars leave the frame).
  camera: { position: [0, 1.42, 2.86] as Vec3, target: [0, 0.94, 0] as Vec3 },
}

// Circadian ring around the head: a 24-hour clock seen from above, clockwise.
export const CIRCADIAN = {
  center: [0, 1.7, 0] as Vec3,
  radius: 0.27,
  tilt: 0.6, // radians toward the camera (front edge down), so the ring reads as a circle
  frontHour: 3, // hour at the front of the ring: the middle of a normal night
  normalBedtime: 23, // the sleep arc starts here when sleepShiftHours = 0
  lightStartHour: 9, // the bright-light arc starts here; length = brightLightMin
  outlineRest: 0.45, // outline opacity when isolation is not focused (the only visible part then)
  outlineFocused: 0.9,
  sleepTube: 0.011, // tube radius of the sleep arc
  lightTube: 0.007,
  ghostTube: 0.005,
  ghostOffset: 0.03, // the norm arc sits on a slightly larger radius, behind the sleep arc
  ghostOpacity: 0.4,
  sleepColor: '#5b7cff', // soft blue while there is no sleep alert
  lightColor: '#ffc977', // warm light
  tick: { length: 0.036, longLength: 0.06, width: 0.007 }, // every 3 h; 0 h and 12 h are longer
  linkOpacity: 0.55, // line from the sleep arc to the brain while an isolation alert is active
  sleepLabel: [0.4, 1.75, 0] as Vec3, // right of the ring: below the threats strip, above the eyes callout
  moodLabel: [-0.34, 1.62, 0] as Vec3, // left of the ring: below the brain callout line, above the lungs callout
}

// Reaction impulse: light seen -> button pressed (NASA Reaction Self-Test), along the body.
export const IMPULSE = {
  // eyes -> brain -> brainstem -> shoulder -> elbow -> hand (the astronaut's left arm, viewer's right)
  path: [
    [0.04, 1.655, 0.1],
    [0, 1.7, -0.01],
    [0, 1.56, -0.02],
    [0.09, 1.46, 0],
    [0.235, 1.43, 0],
    [0.275, 1.14, 0],
    [0.315, 0.83, 0.01],
  ] as Vec3[],
  period: 3, // seconds between two impulses
  baseTravel: 0.85, // seconds eyes -> hand at the baseline reaction time; scales with reactionMs / baseline
  maxTravel: 2.4,
  tail: 0.16, // length of the glowing tail, as a fraction of the path
  pathOpacity: 0.22, // the faint path itself
  headSize: 0.075,
  color: '#d6e4ff',
  lapsesFull: 10, // reactionLapses at which 2 of 3 impulses fade out halfway
  maxLapseShare: 0.67,
  lapseAt: [0.4, 0.62] as [number, number], // a lapsed impulse fades between these path fractions
  press: { seconds: 0.5, size: 0.24 }, // flash at the hand when the impulse arrives
  label: [0.45, 0.79, 0] as Vec3, // right of the hand, between the bones and muscles callouts
}

// Activity: last 7 days as thin bars on a floor ring under the feet.
export const ACTIVITY = {
  ringRadius: 0.5,
  z: 0.48, // the row of bars stands at the front of the floor ring
  spacing: 0.075,
  barWidth: 0.034,
  barDepth: 0.008,
  normHeight: 0.12, // bar height at the personal baseline
  maxRatio: 1.2, // bars are capped at 120 % of the baseline
  pastOpacity: 0.5,
  todayOpacity: 1,
  ringOpacity: 0.35,
  normOpacity: 0.4, // thin line at the baseline height
  label: [0.34, 0.07, 0.48] as Vec3,
  shellGlowDrop: 0.6, // body shell rim glow multiplier while the activity alert is on (hypokinesis)
}

export const MOOD = { dots: 5, dotSize: 9 }

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
    base: { ok: 0.1, warning: 0.35, critical: 0.5 } as Record<Status, number>,
    selected: 0.5,
    hover: 0.9,
  },
  // Emissive pulse for unhealthy regions, added on top of the glow above.
  // hz = pulses per second, amplitude = extra emissive at the peak.
  pulse: {
    ok: { hz: 0.2, amplitude: 0.1 }, // faint ambient pulse in step with the shell's breathing: alive, calm
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

// One switch per threat effect: false = the effect is not mounted at all.
// Rule for all of them (see useThreatEffect): hidden below THREAT_ACTIVE_THRESHOLD,
// full strength only for the focused threat (or demo), faint background otherwise.
export const EFFECTS = {
  radiationTracks: true, // tracks + hit sparks
  radiationShimmer: true, // violet shimmer on immune and brain
  solarFlare: true, // flash + track burst + dose badge
  shelter: true, // shelter capsule
  habitatModule: true, // wireframe module (isolation)
  cabinFog: true, // fog inside the module (environment)
  cabinSensors: true, // CO2 / temperature / noise chips (environment)
  cabinFlow: true, // air flow into the nose and lungs (environment)
  circadianRing: true, // 24 h sleep ring around the head (isolation)
  reactionImpulse: true, // eyes -> hand pulse (isolation)
  activityBars: true, // 7-day bars on the floor ring (isolation)
  moodDots: true, // 5-dot mood indicator (isolation)
  hypokinesis: true, // dimmer shell glow while the activity alert is on (isolation)
  offline: true, // 'Autonomous mode' tag + colder frame when earthLink is false (distance)
  gravityArrow: true, // g arrow + landing moment (gravity)
  fluidShift: true, // shell tint feet -> head (gravity)
  sansGlow: true, // eyes glow at high fluid shift (gravity)
  muscleMass: true, // thinner leg muscles (gravity)
}

// A threat counts as active from this level (0..1).
export const THREAT_ACTIVE_THRESHOLD = 0.3

// Strength of an active threat's 3D effect while it is NOT focused (and no demo): a faint background.
export const THREAT_BACKGROUND_EMPHASIS = 0.3
// Text labels of a threat effect (cabin sensors, g label) show only from this emphasis up, i.e.
// when their threat is focused or in demo: faint text is unreadable and reads as clutter.
export const THREAT_LABEL_EMPHASIS = 0.99
// The same while ANOTHER threat is focused: one accent at a time.
export const THREAT_DIMMED_EMPHASIS = 0.2

// Threats row layout (px) and its lines.
// Permanent callouts in 3D: every critical region, plus at most this many warnings (the lowest
// scores first). The other warnings show their label on hover only.
export const CALLOUTS = { maxWarnings: 2 }

export const THREAT_STRIP = {
  ring: 38, // icon ring diameter
  ringWidth: 3,
  arcSpace: 14, // room above the row content for the threat-link arcs
  linkOpacity: 0.3, // threat-link arcs at rest
  linkOpacityFocused: 0.9, // when one end is the focused threat
  focusLineOpacity: 0.55, // lines from the focused icon toward its regions
  focusLineReach: 0.92, // lines stop at this fraction of the way, so they do not cover the organ
}

// Identity color per threat. Deliberately different from the status colors
// (ok grey, warning yellow, critical red), so a threat is never read as a status.
export const THREAT_COLOR: Record<ThreatId, string> = {
  radiation: '#a66cff', // violet
  isolation: '#8fa6d0', // dull blue, light enough for icons and text on the dark panels
  gravity: '#a8eef7', // light cyan
  distance: '#6b93ff', // blue
  environment: '#b8927a', // grey-orange
}

// Radiation tracks (radiation threat), driven by radiationLevel and useThreatEffect('radiation').
// Thin long violet lines flying from the Sun side (-x, the astronaut's right) through the body.
export const RADIATION_TRACKS = {
  capacity: 135, // instances in the one InstancedMesh (room for the x3 flare burst)
  maxCount: 45, // visible tracks at radiationLevel = 1, focused
  minSpeed: 1.6, // units per second at low levels
  maxSpeed: 3.2, // at radiationLevel = 1
  length: [0.35, 0.7] as [number, number], // random track length
  thickness: 0.006,
  color: '#b98bff',
  opacity: 0.75,
  span: 1.3, // tracks enter at x = -span and leave at x = +span
  yRange: [0.05, 1.85] as [number, number],
  zRange: [-0.12, 0.12] as [number, number],
  lerpSpeed: 1.5,
  // Hits: a short spark where a track enters the body shell (or the shelter wall).
  sparks: { max: 5, life: 0.3, size: 0.05, color: '#c79bff' },
  // Immune and brain regions: slight violet shimmer on top of their status color.
  shimmer: { regions: ['immune', 'brain'] as RegionId[], color: '#a66cff', amount: 0.35, wobble: 0.15, hz: 2.2 },
}

// Rough body outline for track hits: for a height band, the half width (x) and half depth (z)
// of the body shell. A track at (y, z) enters the body at x = -halfWidth if |z| < halfDepth.
export const BODY_PROFILE: { y: [number, number]; halfWidth: number; halfDepth: number }[] = [
  { y: [1.52, 1.8], halfWidth: 0.12, halfDepth: 0.12 }, // head
  { y: [1.44, 1.52], halfWidth: 0.055, halfDepth: 0.055 }, // neck
  { y: [0.98, 1.44], halfWidth: 0.3, halfDepth: 0.11 }, // torso + arms
  { y: [0.85, 0.98], halfWidth: 0.19, halfDepth: 0.12 }, // pelvis
  { y: [0.05, 0.85], halfWidth: 0.16, halfDepth: 0.07 }, // legs
]

// Solar flare: on the transition of activeEvent to 'solar_flare'.
export const SOLAR_FLARE = {
  flashMs: 500, // full-frame white-yellow flash
  flashColor: 'rgba(255, 246, 214, 0.9)',
  burstSeconds: 2, // track density x burstFactor for this long
  burstFactor: 3,
}

// Shelter (inShelter): translucent capsule around the body; tracks stop at its wall.
export const SHELTER = {
  center: [0, 0.95, 0] as Vec3,
  radius: 0.48, // also the wall the tracks stop at (x = -radius)
  length: 1.1, // straight part of the capsule
  color: '#a66cff',
  rimPower: 2.5,
  opacity: 0.5, // at the silhouette edge
  labelPosition: [0.48, 0.12, 0] as Vec3,
  lerpSpeed: 2,
}

// Distance from Earth, as a simple state (no Earth in 3D). When earthLink is false:
// a small "Autonomous mode" tag above the head and a slightly colder frame.
export const OFFLINE = {
  labelPosition: [0, 1.88, 0.1] as Vec3, // just above the head, below the threats strip
  coldTint: '#d2ddff', // multiplied over the canvas; white would be no change
  tintSeconds: 1, // fade in / out
}

// Gravity threat.
// Preset gravity fields in g (gravityField in the store is a number).
export const GRAVITY_FIELDS = { zero: 0, moon: 0.16, mars: 0.38, earth: 1 }

// Vertical g arrow next to the body (viewer's left, between the arm and the left callouts).
export const GRAVITY_ARROW = {
  position: [-0.45, 1.02, 0.1] as Vec3, // top of the arrow; the label sits just above it
  lengthPerG: 0.65, // arrow length at 1 g
  minLength: 0.1, // shortest visible arrow (any field > 0)
  shaftRadius: 0.012,
  headRadius: 0.035,
  headLength: 0.07,
  color: '#a8eef7', // THREAT_COLOR.gravity
  lerpSpeed: 4,
  dropHeight: 0.35, // landing: the arrow falls into place from this much higher
  dropSeconds: 0.6,
}

// Landing moment (gravityField from 0 to Mars or Earth): the weakest bone shows through
// the shell and flashes, and its fracture-risk label shows even in body mode.
export const LANDING = {
  seconds: 4,
  boneOpacity: 0.9, // weakest bone opacity during the landing moment (body mode)
  flashHz: 2.5,
  flashIntensity: 1.2, // red emissive at the flash peak
}

// Fluid shift (microgravity): vertical tint in the body shell, feet -> head, by fluidShift.
export const FLUID_SHIFT = {
  headColor: '#ff7aa8', // fluid gathers in the head: warm, puffy
  feetY: 0.1,
  headY: 1.8,
  strength: 0.55, // max blend toward headColor at the head with fluidShift = 1
  lerpSpeed: 2,
  // SANS: faint glow at the eyes region from this fluidShift up.
  eyesFrom: 0.6,
  eyesGlow: 0.6, // extra emissive at fluidShift = 1
}

// Muscle mass: thigh and calf parts get thinner (x and z) as muscleMass drops.
export const MUSCLE_MASS = {
  thinning: 1.5, // thickness = 1 - (1 - muscleMass) * thinning, e.g. 0.8 -> 0.7
  minThickness: 0.4,
  lerpSpeed: 2,
}
