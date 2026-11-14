import { useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Object3D } from 'three'
import { useHealthStore } from '../mockStore'
import { HEART } from '../config'

// A smooth bump around `at` (Gaussian), 1 at the center, ~0 far away.
function bump(p: number, b: { at: number; width: number; strength: number }) {
  const x = (p - b.at) / b.width
  return b.strength * Math.exp(-x * x)
}

// Scales the given objects in a "lub-dub, pause" rhythm at heart_rate bpm.
// Does nothing when `enabled` is false. Only touches objects in useFrame, no setState.
export function useHeartbeat(targets: RefObject<(Object3D | null)[]>, enabled: boolean) {
  // Re-renders only when the heart rate number changes, not every frame.
  const bpm = useHealthStore(
    (s) => s.metrics.find((m) => m.id === HEART.metricId)?.value ?? HEART.defaultBpm,
  )
  const phase = useRef(0) // position inside the current beat, 0..1

  useFrame((_, delta) => {
    if (!enabled) return
    phase.current = (phase.current + (delta * bpm) / 60) % 1
    const p = phase.current
    const s = 1 + HEART.amplitude * (bump(p, HEART.lub) + bump(p, HEART.dub))
    for (const obj of targets.current) obj?.scale.setScalar(s)
  })
}
