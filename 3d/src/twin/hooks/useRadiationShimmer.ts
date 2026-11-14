import { useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color } from 'three'
import type { RegionId } from '../../contract/types'
import { RADIATION_PARTICLES as P, REGION } from '../config'
import { useThreatEffect } from './useThreatEffect'

export const SHIMMER_COLOR = new Color(P.shimmer.color)

// Violet shimmer for the immune region while the radiation threat is active
// (full when focused or in demo, faint otherwise: see useThreatEffect).
// Returns a ref with how far the emissive color should move toward SHIMMER_COLOR (0..1);
// always 0 for other regions or when RADIATION_PARTICLES.enabled is false.
// Must be called before useStatusColor, which reads the ref in the same frame.
export function useRadiationShimmer(id: RegionId) {
  const applies = P.enabled && id === 'immune'
  const emphasis = useThreatEffect('radiation')
  const target = applies ? emphasis : 0
  const targetRef = useRef(target)
  useLayoutEffect(() => {
    targetRef.current = target
  }, [target])

  const amount = useRef(0)
  const strength = useRef(0) // fades the whole shimmer in/out
  const phase = useRef(0)

  useFrame((_, delta) => {
    if (!applies) return
    const k = 1 - Math.exp(-delta * REGION.lerpSpeed)
    strength.current += (targetRef.current - strength.current) * k
    phase.current += delta * P.shimmer.hz * Math.PI * 2
    amount.current = strength.current * (P.shimmer.amount + P.shimmer.wobble * Math.sin(phase.current))
  })

  return amount
}
