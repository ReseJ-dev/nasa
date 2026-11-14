import { useLayoutEffect, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, type MeshStandardMaterial } from 'three'
import type { Status } from '../../contract/types'
import { STATUS_COLOR } from '../colors'
import { REGION } from '../config'

// Every frame, smoothly moves the material's color and glow toward
// the status color and the requested glow strength, and adds a sine pulse
// for warning/critical. `extraGlow` (optional) refs are added on top, e.g. the chain and SANS glow.
// `brightness` (0..1) scales color and glow, e.g. to dim organs that are not selected.
// `tint` (optional) moves only the emissive color toward tint.color by tint.amount, e.g. the radiation shimmer.
// No setState per frame.
const goal = new Color() // scratch colors, reused every frame
const emissiveGoal = new Color()

export function useStatusColor(
  material: MeshStandardMaterial,
  status: Status,
  glow: number,
  extraGlow: RefObject<number>[] = [],
  brightness = 1,
  tint?: { color: Color; amount: RefObject<number> },
) {
  // Latest targets, read inside useFrame without re-subscribing.
  const target = useRef({ status, glow, brightness })
  useLayoutEffect(() => {
    target.current = { status, glow, brightness }
  }, [status, glow, brightness])

  // Smoothed values, so a status change fades the pulse in/out instead of jumping.
  const smooth = useRef({ glow, amplitude: 0, hz: 0, phase: 0, brightness })

  useFrame((_, delta) => {
    const { status, glow, brightness } = target.current
    const k = 1 - Math.exp(-delta * REGION.lerpSpeed) // same smoothness at any FPS
    goal.copy(STATUS_COLOR[status]).multiplyScalar(brightness)
    material.color.lerp(goal, k)
    emissiveGoal.copy(goal)
    const tintAmount = tint?.amount.current ?? 0
    if (tintAmount > 0) emissiveGoal.lerp(tint!.color, tintAmount)
    material.emissive.lerp(emissiveGoal, k)

    const pulse = REGION.pulse[status]
    const s = smooth.current
    s.glow += (glow - s.glow) * k
    s.amplitude += (pulse.amplitude - s.amplitude) * k
    s.hz += (pulse.hz - s.hz) * k
    s.brightness += (brightness - s.brightness) * k

    // Advance the phase frame by frame: changing hz then never makes the wave jump.
    s.phase += delta * s.hz * Math.PI * 2
    // wave goes 0..1 and back, so the glow never drops below the base value
    const wave = 0.5 + 0.5 * Math.sin(s.phase)
    let extra = 0
    for (const g of extraGlow) extra += g.current ?? 0
    material.emissiveIntensity = (s.glow + s.amplitude * wave + extra) * s.brightness
  })
}
