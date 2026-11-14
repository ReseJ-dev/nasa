import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Body } from './Body'
import { RegionMesh } from './RegionMesh'
import { Skeleton } from './Skeleton'
import { REGIONS } from './regions'
import { useHealthStore } from './mockStore'
import { CAMERA, SCENE, type Layer } from './config'

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

// The only export for teammate 2. Fills its parent container completely.
export function BodyScene() {
  const selectRegion = useHealthStore((s) => s.selectRegion)
  const [layer, setLayer] = useState<Layer>('body') // changes only on button click

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: CAMERA.position, fov: CAMERA.fov }}
        onPointerMissed={() => selectRegion(null)} // click on empty space clears selection
      >
        <color attach="background" args={[SCENE.background]} />
        <ambientLight intensity={SCENE.ambientIntensity} />
        <directionalLight position={SCENE.keyLight.position} intensity={SCENE.keyLight.intensity} />
        <directionalLight position={SCENE.rimLight.position} intensity={SCENE.rimLight.intensity} />
        {REGIONS.map((def) => (
          <RegionMesh key={def.id} def={def} layer={layer} />
        ))}
        <Skeleton layer={layer} />
        <Body layer={layer} />
        <OrbitControls
          target={CAMERA.target}
          enablePan={false}
          minDistance={CAMERA.minDistance}
          maxDistance={CAMERA.maxDistance}
          minPolarAngle={CAMERA.minPolarAngle}
          maxPolarAngle={CAMERA.maxPolarAngle}
        />
      </Canvas>
      <LayerSwitch layer={layer} onChange={setLayer} />
    </div>
  )
}
