import { useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { MeshStandardMaterial } from 'three'
import type { Status } from '../../contract/types'
import { STATUS_COLOR } from '../colors'
import { REGION } from '../config'

// Every frame, smoothly moves the material's color and glow toward
// the status color and the requested glow strength. No setState per frame.
export function useStatusColor(material: MeshStandardMaterial, status: Status, glow: number) {
  // Latest targets, read inside useFrame without re-subscribing.
  const target = useRef({ status, glow })
  useLayoutEffect(() => {
    target.current = { status, glow }
  }, [status, glow])

  useFrame((_, delta) => {
    const { status, glow } = target.current
    const k = 1 - Math.exp(-delta * REGION.lerpSpeed) // same smoothness at any FPS
    const goal = STATUS_COLOR[status]
    material.color.lerp(goal, k)
    material.emissive.lerp(goal, k)
    material.emissiveIntensity += (glow - material.emissiveIntensity) * k
  })
}
