import { useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color } from 'three'
import type { RegionId } from '../../contract/types'
import { useHealthStore } from '../store'
import { RADIATION_PARTICLES as P, REGION } from '../config'
import { radiationIntensity } from '../RadiationParticles'

export const SHIMMER_COLOR = new Color(P.shimmer.color)

// Violet shimmer for the immune region while radiation is active (level >= threshold).
// Returns a ref with how far the emissive color should move toward SHIMMER_COLOR (0..1);
// always 0 for other regions or when RADIATION_PARTICLES.enabled is false.
// Must be called before useStatusColor, which reads the ref in the same frame.
export function useRadiationShimmer(id: RegionId) {
  const applies = P.enabled && id === 'immune'
  // Other regions select a constant, so they never re-render on radiation changes.
  const active = useHealthStore((s) => applies && radiationIntensity(s.radiationLevel ?? 0) > 0)
  const activeRef = useRef(active)
  useLayoutEffect(() => {
    activeRef.current = active
  }, [active])

  const amount = useRef(0)
  const strength = useRef(0) // fades the whole shimmer in/out
  const phase = useRef(0)

  useFrame((_, delta) => {
    if (!applies) return
    const k = 1 - Math.exp(-delta * REGION.lerpSpeed)
    strength.current += ((activeRef.current ? 1 : 0) - strength.current) * k
    phase.current += delta * P.shimmer.hz * Math.PI * 2
    amount.current = strength.current * (P.shimmer.amount + P.shimmer.wobble * Math.sin(phase.current))
  })

  return amount
}
