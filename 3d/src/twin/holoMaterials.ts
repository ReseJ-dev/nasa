import { AdditiveBlending, Color, MeshBasicMaterial, ShaderMaterial, type Object3D } from 'three'
import { ISOLATION } from './config'

// Materials of the hologram lines (isolation visuals): thin additive tubes, brighter on the
// tube's silhouette (fresnel), no depth write. Created once by their owners.

const vertex = /* glsl */ `
  varying float vU;
  varying vec3 vNormalV;
  varying vec3 vViewDir;
  void main() {
    vU = uv.x; // position along the tube, 0..1
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormalV = normalize(normalMatrix * normal);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`

const rim = /* glsl */ `
  float rim = 0.7 + 0.5 * pow(1.0 - abs(dot(normalize(vNormalV), normalize(vViewDir))), 2.0);
`

// Arc on a torus: only the part from uStart, uLength long, is drawn (both as fractions of the
// circle, in clock direction). Soft ends. A torus rotated +90 deg about X has uv.x = 0.25 at its front.
const arcFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uStart;
  uniform float uLength;
  varying float vU;
  varying vec3 vNormalV;
  varying vec3 vViewDir;
  void main() {
    float h = fract(vU - 0.25 - uStart);
    float soft = 0.006;
    float a = uLength >= 0.999 ? 1.0 : smoothstep(0.0, soft, h) * smoothstep(0.0, soft, uLength - h);
    ${rim}
    gl_FragColor = vec4(uColor * rim, uOpacity * a);
  }
`

// Tube with a travelling pulse: a faint path (uBase) plus a bright head at uHead with a tail behind it.
const pulseFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uBase;
  uniform float uPulse;
  uniform float uHead;
  uniform float uTail;
  varying float vU;
  varying vec3 vNormalV;
  varying vec3 vViewDir;
  void main() {
    float d = uHead - vU;
    float trail = smoothstep(-0.012, 0.0, d) * exp(-max(d, 0.0) / uTail);
    ${rim}
    gl_FragColor = vec4(uColor * rim * (1.0 + trail), uBase + uPulse * trail);
  }
`

const common = { vertexShader: vertex, transparent: true, depthWrite: false, blending: AdditiveBlending }

export function createArcMaterial(color: string, start = 0, length = 1) {
  return new ShaderMaterial({
    ...common,
    fragmentShader: arcFragment,
    uniforms: {
      uColor: { value: new Color(color) },
      uOpacity: { value: 0 },
      uStart: { value: start },
      uLength: { value: length },
    },
  })
}

export function createPulseMaterial(color: string, tail: number) {
  return new ShaderMaterial({
    ...common,
    fragmentShader: pulseFragment,
    uniforms: {
      uColor: { value: new Color(color) },
      uBase: { value: 0 },
      uPulse: { value: 0 },
      uHead: { value: 0 },
      uTail: { value: tail },
    },
  })
}

// Plain additive line material (ticks, bars, floor ring).
export function createLineMaterial(color: string = ISOLATION.line) {
  return new MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending })
}

const noRaycast = () => null
// Decorative objects: never catch hover or clicks, drawn after the body shell, hidden until faded in.
export function decorative<T extends Object3D>(object: T): T {
  object.raycast = noRaycast
  object.renderOrder = ISOLATION.renderOrder
  object.visible = false
  return object
}
