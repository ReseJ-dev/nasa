import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Line,
  LineBasicMaterial,
  Points,
  PointsMaterial,
  Vector3,
} from 'three'
import { useThreatEffect } from './hooks/useThreatEffect'
import { CABIN_FLOW as C, HABITAT, type Layer } from './config'
import { DOT_TEXTURE } from './textures'

// Stale cabin air flowing from the fog into the nose and down to the lungs:
// looping pulses along a fixed curve. Visually it starts the chain lungs -> brain -> eyes.
// Environment threat: full when focused / demo, faint otherwise, off when inactive.
// Hidden in skeleton mode. Created once; dots move in useFrame via a buffer attribute.

const CURVE = new CatmullRomCurve3(C.path.map((p) => new Vector3(...p)))
const tmp = new Vector3()

export function CabinFlow({ layer }: { layer: Layer }) {
  const effect = useThreatEffect('environment')
  const target = layer === 'body' ? effect : 0
  const targetRef = useRef(target)
  useLayoutEffect(() => {
    targetRef.current = target
  }, [target])

  const { line, dots } = useMemo(() => {
    const l = new Line(
      new BufferGeometry().setFromPoints(CURVE.getPoints(64)),
      new LineBasicMaterial({ color: C.color, transparent: true, opacity: 0, depthWrite: false }),
    )
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(C.pulses * 3), 3))
    const d = new Points(
      geometry,
      new PointsMaterial({
        color: C.color,
        size: C.size,
        map: DOT_TEXTURE,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    )
    for (const o of [l, d]) {
      o.raycast = () => null
      o.visible = false
      o.frustumCulled = false
    }
    return { line: l, dots: d }
  }, [])

  const strength = useRef(0)
  const time = useRef(0)

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-delta * HABITAT.lerpSpeed)
    strength.current += (targetRef.current - strength.current) * k
    const on = strength.current > 0.005
    line.visible = dots.visible = on
    if (!on) return
    ;(line.material as LineBasicMaterial).opacity = C.lineOpacity * strength.current
    ;(dots.material as PointsMaterial).opacity = strength.current

    time.current += delta
    const attr = dots.geometry.getAttribute('position') as BufferAttribute
    for (let i = 0; i < C.pulses; i++) {
      const t = (time.current / C.loopSeconds + i / C.pulses) % 1
      CURVE.getPointAt(t, tmp)
      attr.setXYZ(i, tmp.x, tmp.y, tmp.z)
    }
    attr.needsUpdate = true
  })

  return (
    <>
      <primitive object={line} />
      <primitive object={dots} />
    </>
  )
}
