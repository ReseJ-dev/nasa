import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Body } from './Body'
import { RegionMesh } from './RegionMesh'
import { REGIONS } from './regions'
import { useHealthStore } from './mockStore'
import { CAMERA, SCENE } from './config'

// The only export for teammate 2. Fills its parent container completely.
export function BodyScene() {
  const selectRegion = useHealthStore((s) => s.selectRegion)

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: CAMERA.position, fov: CAMERA.fov }}
        onPointerMissed={() => selectRegion(null)} // click on empty space clears selection
      >
        <color attach="background" args={[SCENE.background]} />
        <ambientLight intensity={SCENE.ambientIntensity} />
        <directionalLight position={SCENE.keyLight.position} intensity={SCENE.keyLight.intensity} />
        <directionalLight position={SCENE.rimLight.position} intensity={SCENE.rimLight.intensity} />
        {REGIONS.map((def) => (
          <RegionMesh key={def.id} def={def} />
        ))}
        <Body />
        <OrbitControls
          target={CAMERA.target}
          enablePan={false}
          minDistance={CAMERA.minDistance}
          maxDistance={CAMERA.maxDistance}
          minPolarAngle={CAMERA.minPolarAngle}
          maxPolarAngle={CAMERA.maxPolarAngle}
        />
      </Canvas>
    </div>
  )
}
