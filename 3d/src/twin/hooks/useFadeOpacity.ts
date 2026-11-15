import { useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Material } from 'three'
import { LAYER_FADE_SPEED } from '../config'

// Every frame, smoothly moves the material's opacity toward `target`.
// A fully faded material is hidden (not drawn at all), which also saves FPS.
// Switches `transparent` on only while the material is see-through. No setState per frame.
export function useFadeOpacity(material: Material, target: number) {
  const goal = useRef(target)
  useLayoutEffect(() => {
    goal.current = target
  }, [target])

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-delta * LAYER_FADE_SPEED)
    material.opacity += (goal.current - material.opacity) * k
    material.visible = material.opacity > 0.01
    // Fully opaque objects are drawn as opaque, so the shell keeps tinting the
    // organs in body mode exactly as before.
    const transparent = material.opacity < 0.995
    if (transparent !== material.transparent) {
      material.transparent = transparent
      // three.js compiles opaque materials with alpha forced to 1; without a recompile on the
      // switch (twice per layer change) the organs would stay solid in skeleton mode.
      material.needsUpdate = true
    }
  })
}
