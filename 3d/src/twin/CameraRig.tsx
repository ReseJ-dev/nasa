import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { CameraControls, CameraControlsImpl } from '@react-three/drei'
import { Box3 } from 'three'
import { useHealthStore } from './store'
import { CAMERA } from './config'

const { ACTION } = CameraControlsImpl

// Camera: rotate with the mouse, zoom with the wheel, never pans.
// It moves on its own only after a selection change:
// region selected -> smooth fit to that region, selection cleared -> smooth return to the full body.
export function CameraRig() {
  const controls = useRef<CameraControlsImpl>(null)
  const scene = useThree((s) => s.scene)
  const selected = useHealthStore((s) => s.selectedRegion)
  const box = useMemo(() => new Box3(), []) // reused for every fit

  // Setup once: limits, no panning, start at the full-body view (no animation).
  useLayoutEffect(() => {
    const c = controls.current
    if (!c) return
    c.mouseButtons.right = ACTION.NONE // right drag would pan
    c.mouseButtons.middle = ACTION.DOLLY
    c.touches.two = ACTION.TOUCH_DOLLY // pinch zooms, no two-finger pan
    c.touches.three = ACTION.NONE
    c.setLookAt(...CAMERA.position, ...CAMERA.target, false)
  }, [])

  // React to selection changes only.
  useEffect(() => {
    const c = controls.current
    if (!c) return
    const region = selected ? scene.getObjectByName(selected) : undefined
    if (region) {
      box.setFromObject(region)
      const p = CAMERA.fitPadding
      c.fitToBox(box, true, { paddingTop: p, paddingBottom: p, paddingLeft: p, paddingRight: p })
    } else {
      c.setLookAt(...CAMERA.position, ...CAMERA.target, true)
    }
  }, [selected, scene, box])

  return (
    <CameraControls
      ref={controls}
      makeDefault
      minDistance={CAMERA.minDistance}
      maxDistance={CAMERA.maxDistance}
      minPolarAngle={CAMERA.minPolarAngle}
      maxPolarAngle={CAMERA.maxPolarAngle}
      smoothTime={CAMERA.smoothTime}
    />
  )
}
