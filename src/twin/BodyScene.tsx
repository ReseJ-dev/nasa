import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { Mesh } from 'three'

// Временный куб для проверки, что сцена работает. Позже заменим на тело.
function SpinningCube() {
  const ref = useRef<Mesh>(null)

  // useFrame вызывается каждый кадр: поворачиваем куб без setState.
  useFrame((_, delta) => {
    if (!ref.current) return
    ref.current.rotation.x += delta * 0.5
    ref.current.rotation.y += delta * 0.8
  })

  return (
    <mesh ref={ref}>
      <boxGeometry args={[1.5, 1.5, 1.5]} />
      <meshStandardMaterial color="#4fa3ff" />
    </mesh>
  )
}

// Единственный экспорт для участника 2. Заполняет родительский контейнер целиком.
export function BodyScene() {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
        <color attach="background" args={['#05070d']} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[3, 5, 4]} intensity={1.2} />
        <SpinningCube />
        <OrbitControls enablePan={false} minDistance={2} maxDistance={10} />
      </Canvas>
    </div>
  )
}
