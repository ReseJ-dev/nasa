import { useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { RegionId } from '../../contract/types'
import { useHealthStore } from '../store'
import { FLUID_SHIFT as F, type Layer } from '../config'
import { useThreatEffect } from './useThreatEffect'

// SANS (spaceflight-associated neuro-ocular syndrome): a faint extra glow at the eyes region
// when fluidShift is high. Returns a ref with the extra emissive; 0 for other regions.
// Body mode only, scaled by the gravity threat's strength. Lerped in useFrame.
// Must be called before useStatusColor, which reads the ref in the same frame.
export function useSansGlow(id: RegionId, layer: Layer) {
  const applies = id === 'eyes'
  const fluid = useHealthStore((s) => (applies ? (s.fluidShift ?? 0) : 0))
  const effect = useThreatEffect('gravity')
  const target = applies && layer === 'body' && fluid >= F.eyesFrom ? F.eyesGlow * fluid * effect : 0
  const goal = useRef(target)
  useLayoutEffect(() => {
    goal.current = target
  }, [target])

  const glow = useRef(0)
  useFrame((_, delta) => {
    if (!applies) return
    glow.current += (goal.current - glow.current) * (1 - Math.exp(-delta * F.lerpSpeed))
  })
  return glow
}
