import { useLayoutEffect, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Object3D } from 'three'
import { useHealthStore } from '../store'
import { MUSCLE_MASS as M } from '../config'

// Thins the given muscle meshes in x and z (not in length) as muscleMass drops.
// Does nothing when `enabled` is false. Lerped in useFrame, no setState per frame.
export function useMuscleMass(targets: RefObject<(Object3D | null)[]>, enabled: boolean) {
  // Disabled regions select a constant, so they never re-render on muscle changes.
  const mass = useHealthStore((s) => (enabled ? (s.muscleMass ?? 1) : 1))
  const goal = useRef(1)
  useLayoutEffect(() => {
    goal.current = Math.max(M.minThickness, 1 - (1 - mass) * M.thinning)
  }, [mass])

  const thickness = useRef(1)
  useFrame((_, delta) => {
    if (!enabled) return
    thickness.current += (goal.current - thickness.current) * (1 - Math.exp(-delta * M.lerpSpeed))
    for (const obj of targets.current) obj?.scale.set(thickness.current, 1, thickness.current)
  })
}
