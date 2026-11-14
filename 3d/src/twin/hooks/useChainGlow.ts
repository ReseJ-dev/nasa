import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { RegionId } from '../../contract/types'
import { useHealthStore } from '../store'
import { CHAIN, REGION } from '../config'

// Extra emissive glow for a region that is part of the cause chain.
// The organ at position i lights up i * CHAIN.stepDelay seconds after the chain starts.
// When the content of `chain` changes (or it becomes empty) the timing restarts.
// Returns a ref with the current boost; read it in useFrame, no setState per frame.
export function useChainGlow(id: RegionId) {
  const chain = useHealthStore((s) => s.chain)
  const index = chain.indexOf(id) // -1 = not in the chain

  const boost = useRef(0)
  const startTime = useRef<number | null>(null) // clock time when the chain started

  // Restart only when the chain content changes, not when the store
  // hands out a new array with the same organs.
  const chainKey = chain.join(',')
  useEffect(() => {
    startTime.current = null
  }, [chainKey])

  useFrame((state, delta) => {
    const now = state.clock.elapsedTime
    if (startTime.current === null) startTime.current = now

    if (index < 0) {
      // Not in the chain: fade any leftover glow out smoothly.
      boost.current *= Math.exp(-delta * REGION.lerpSpeed)
      return
    }

    const t = now - startTime.current - index * CHAIN.stepDelay // time since this organ's turn
    if (t < 0) {
      boost.current = 0
      return
    }
    const rise = Math.min(t / CHAIN.rise, 1)
    const flash = CHAIN.flash * Math.exp(-t / CHAIN.flashDecay)
    boost.current = rise * (CHAIN.hold + flash)
  })

  return boost
}
