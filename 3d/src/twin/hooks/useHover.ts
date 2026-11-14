import { useEffect, useState } from 'react'
import type { ThreeEvent } from '@react-three/fiber'

// Hover state for a 3D object + pointer cursor while hovered.
// State changes only on enter/leave events, not every frame.
// enabled = false: the object stops reacting; a hover in progress is cleared.
export function useHover(enabled = true) {
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    if (enabled || !hovered) return
    setHovered(false) // no pointer-out arrives once handlers are removed
    document.body.style.cursor = 'auto'
  }, [enabled, hovered])

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
