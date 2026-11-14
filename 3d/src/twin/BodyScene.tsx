import { useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stats } from '@react-three/drei'
import { EffectComposer, Selection, SelectiveBloom } from '@react-three/postprocessing'
import type { AmbientLight, DirectionalLight } from 'three'
import { Body } from './Body'
import { RegionMesh } from './RegionMesh'
import { Skeleton } from './Skeleton'
import { Hint, Legend } from './Overlay'
import { Callouts } from './Callouts'
import { REGIONS } from './regions'
import { useHealthStore } from './store'
import { BLOOM, CAMERA, RENDER, SCENE, type Layer } from './config'

const LAYER_LABEL: Record<Layer, string> = { body: 'Body', skeleton: 'Skeleton' }

// "Body / Skeleton" switch shown over the top-right corner of the scene.
function LayerSwitch({ layer, onChange }: { layer: Layer; onChange(l: Layer): void }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        display: 'flex',
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.25)',
        font: '14px system-ui, sans-serif',
      }}
    >
      {(Object.keys(LAYER_LABEL) as Layer[]).map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          style={{
            padding: '6px 14px',
            border: 'none',
            cursor: 'pointer',
            color: '#fff',
            background: l === layer ? 'rgba(79, 163, 255, 0.6)' : 'rgba(10, 14, 24, 0.8)',
          }}
        >
          {LAYER_LABEL[l]}
        </button>
      ))}
    </div>
  )
}

// The only export for teammate 2. Fills its parent container completely
// (Canvas follows the container size automatically, also on window resize).
// showFps: dev-only FPS counter in the top-left corner.
// layer / onLayerChange (optional): pass `layer` to control the Body/Skeleton view
// from outside; without it BodyScene keeps its own layer state.
// onLayerChange is called on every button click in both cases.
export function BodyScene({
  showFps = false,
  layer: layerProp,
  onLayerChange,
}: {
  showFps?: boolean
  layer?: Layer
  onLayerChange?(layer: Layer): void
}) {
  const selectRegion = useHealthStore((s) => s.selectRegion)
  const [ownLayer, setOwnLayer] = useState<Layer>('body') // used only when `layer` is not passed
  const layer = layerProp ?? ownLayer
  // Hint disappears after the first pointer interaction with the canvas (set once).
  const [hintVisible, setHintVisible] = useState(true)
  const hideHint = () => setHintVisible(false)
  const changeLayer = (l: Layer) => {
    if (layerProp === undefined) setOwnLayer(l)
    onLayerChange?.(l)
  }
  // SelectiveBloom re-lights the selected organs, so it needs the scene lights.
  const ambient = useRef<AmbientLight>(null)
  const keyLight = useRef<DirectionalLight>(null)
  const rimLight = useRef<DirectionalLight>(null)
  // Same array on every render, so SelectiveBloom does not re-attach lights.
  const bloomLights = useMemo(() => [ambient, keyLight, rimLight], [])
  const clearSelection = useMemo(() => () => selectRegion(null), [selectRegion])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: CAMERA.position, fov: CAMERA.fov }}
        dpr={RENDER.dpr}
        gl={{ antialias: false }} // EffectComposer does the anti-aliasing (multisampling)
        onPointerMissed={clearSelection} // click on empty space clears selection
        onPointerDown={hintVisible ? hideHint : undefined}
        onWheel={hintVisible ? hideHint : undefined}
      >
        <color attach="background" args={[SCENE.background]} />
        <ambientLight ref={ambient} intensity={SCENE.ambientIntensity} />
        <directionalLight ref={keyLight} position={SCENE.keyLight.position} intensity={SCENE.keyLight.intensity} />
        <directionalLight ref={rimLight} position={SCENE.rimLight.position} intensity={SCENE.rimLight.intensity} />
        {/* Selection collects the organs marked with <Select enabled> in RegionMesh. */}
        <Selection>
          {REGIONS.map((def) => (
            <RegionMesh key={def.id} def={def} layer={layer} />
          ))}
          <Skeleton layer={layer} />
          <Body layer={layer} />
          <EffectComposer multisampling={RENDER.multisampling}>
            <SelectiveBloom
              lights={bloomLights}
              intensity={BLOOM.intensity}
              luminanceThreshold={BLOOM.luminanceThreshold}
              luminanceSmoothing={BLOOM.luminanceSmoothing}
              radius={BLOOM.radius}
              mipmapBlur
            />
          </EffectComposer>
        </Selection>
        {layer === 'body' && <Callouts />}
        {showFps && <Stats />}
        <OrbitControls
          target={CAMERA.target}
          enablePan={false}
          minDistance={CAMERA.minDistance}
          maxDistance={CAMERA.maxDistance}
          minPolarAngle={CAMERA.minPolarAngle}
          maxPolarAngle={CAMERA.maxPolarAngle}
        />
      </Canvas>
      <LayerSwitch layer={layer} onChange={changeLayer} />
      <Legend layer={layer} />
      <Hint visible={hintVisible} />
    </div>
  )
}
