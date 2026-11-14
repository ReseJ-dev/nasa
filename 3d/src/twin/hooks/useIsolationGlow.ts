import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { RegionId } from '../../contract/types'
import { CHAIN, REGION } from '../config'
import { useAnyIsolationAlert } from '../isolationStage'

// Brain only: while any isolation alert is active the brain glows like an organ of the
// cause chain (same flash, then a steady extra glow; see CHAIN in config.ts).
// Returns a ref with the extra emissive, 0 for other regions. Read it in useFrame.
// Must be called before useStatusColor, which reads the ref in the same frame.
export function useIsolationGlow(id: RegionId) {
  const applies = id === 'brain'
  const active = useAnyIsolationAlert() && applies
  const boost = useRef(0)
  const since = useRef(-1) // seconds since the alert appeared, -1 = no alert

  useFrame((_, delta) => {
    if (!applies) return
    if (!active) {
      since.current = -1
      boost.current *= Math.exp(-delta * REGION.lerpSpeed) // fade out smoothly
      return
    }
    since.current = since.current < 0 ? 0 : since.current + delta
    const t = since.current
    boost.current = Math.min(t / CHAIN.rise, 1) * (CHAIN.hold + CHAIN.flash * Math.exp(-t / CHAIN.flashDecay))
  })

  return boost
}
