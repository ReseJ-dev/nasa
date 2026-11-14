import { useLayoutEffect, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import type { MeshStandardMaterial } from 'three'
import type { Status } from '../../contract/types'
import { STATUS_COLOR } from '../colors'
import { REGION } from '../config'

// Every frame, smoothly moves the material's color and glow toward
// the status color and the requested glow strength, and adds a sine pulse
// for warning/critical. `extraGlow` (optional) is added on top, e.g. the chain glow.
// No setState per frame.
export function useStatusColor(
  material: MeshStandardMaterial,
  status: Status,
  glow: number,
  extraGlow?: RefObject<number>,
) {
  // Latest targets, read inside useFrame without re-subscribing.
  const target = useRef({ status, glow })
  useLayoutEffect(() => {
    target.current = { status, glow }
  }, [status, glow])

  // Smoothed values, so a status change fades the pulse in/out instead of jumping.
  const smooth = useRef({ glow, amplitude: 0, hz: 0, phase: 0 })

  useFrame((_, delta) => {
    const { status, glow } = target.current
    const k = 1 - Math.exp(-delta * REGION.lerpSpeed) // same smoothness at any FPS
    const goal = STATUS_COLOR[status]
    material.color.lerp(goal, k)
    material.emissive.lerp(goal, k)

    const pulse = REGION.pulse[status]
    const s = smooth.current
    s.glow += (glow - s.glow) * k
    s.amplitude += (pulse.amplitude - s.amplitude) * k
    s.hz += (pulse.hz - s.hz) * k

    // Advance the phase frame by frame: changing hz then never makes the wave jump.
    s.phase += delta * s.hz * Math.PI * 2
    // wave goes 0..1 and back, so the glow never drops below the base value
    const wave = 0.5 + 0.5 * Math.sin(s.phase)
    material.emissiveIntensity = s.glow + s.amplitude * wave + (extraGlow?.current ?? 0)
  })
}
