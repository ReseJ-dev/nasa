import { useState } from 'react'
import type { ThreeEvent } from '@react-three/fiber'

// Hover state for a 3D object + pointer cursor while hovered.
// State changes only on enter/leave events, not every frame.
export function useHover() {
  const [hovered, setHovered] = useState(false)

  const onPointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation() // only the front-most object gets hover
    setHovered(true)
    document.body.style.cursor = 'pointer'
  }
  const onPointerOut = () => {
    setHovered(false)
    document.body.style.cursor = 'auto'
  }

  return { hovered, onPointerOver, onPointerOut }
}
