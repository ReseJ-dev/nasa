import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer, Stars, Stats } from '@react-three/drei'
import { EffectComposer, Selection, SelectiveBloom } from '@react-three/postprocessing'
import { CanvasTexture, SRGBColorSpace, type AmbientLight, type DirectionalLight } from 'three'
import { Body } from './Body'
import { RegionMesh } from './RegionMesh'
import { Skeleton } from './Skeleton'
import { Hint, Legend } from './Overlay'
import { Callouts } from './Callouts'
import { CameraRig } from './CameraRig'
import { ThreatStrip } from './ThreatStrip'
import { FocusLinesSvg, FocusLineTracker } from './FocusLines'
import { useSceneStore } from './sceneStore'
import { useFocusedThreat } from './hooks/useFocusedThreat'
import { RadiationTracks } from './RadiationTracks'
import { FlareFlash, Shelter, useSolarFlareWatcher } from './SolarFlare'
import { Habitat } from './Habitat'
import { CabinFlow } from './CabinFlow'
import { CircadianRing } from './CircadianRing'
import { OfflineTag, OfflineTint } from './Offline'
import { GravityArrow } from './GravityArrow'
import { ChainLinks } from './ChainLinks'
import type { ThreatId } from '../contract/types'
import { LAYER_LABEL } from './labels'
import { REGIONS } from './regions'
import { useHealthStore } from './store'
import { BLOOM, CAMERA, EFFECTS, RENDER, SCENE, type Layer } from './config'

// Dark vertical gradient for the scene background, created once at module load.
function createBackground() {
  const canvas = document.createElement('canvas')
  canvas.width = 2
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
  gradient.addColorStop(0, SCENE.backgroundTop)
  gradient.addColorStop(1, SCENE.backgroundBottom)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}
const BACKGROUND = createBackground()

// Soft studio light for reflections, built only from Lightformers (no presets, no downloads).
// Rendered once into a small env map, so it costs nothing per frame.
function StudioEnvironment() {
  return (
    <Environment resolution={SCENE.environmentResolution}>
      {/* wide soft panel above */}
      <Lightformer
        form="rect"
        intensity={1.5}
        color="#dfefff"
        position={[0, 5, 1]}
        rotation-x={Math.PI / 2}
        scale={[8, 4, 1]}
      />
      {/* cool cyan panels behind on both sides: rim reflections on the silhouette */}
      <Lightformer
        form="rect"
        intensity={2}
        color="#4fe3ff"
        position={[-4, 1.5, -3]}
        rotation-y={Math.PI / 4}
        scale={[2, 6, 1]}
      />
      <Lightformer
        form="rect"
        intensity={1.2}
        color="#4fe3ff"
        position={[4, 1.5, -3]}
        rotation-y={-Math.PI / 4}
        scale={[2, 6, 1]}
      />
      {/* small warm key in front-right, matches the key light */}
      <Lightformer form="ring" intensity={1} color="#fff4e6" position={[3, 3, 4]} scale={1.5} />
    </Environment>
  )
}

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
// onThreatClick (optional): called with the threat id on every click in the threats strip,
// e.g. to open a threat panel.
// focusedThreat (optional): pass it to control the pinned threat from outside (null = none);
// clicks then only call onThreatClick. Without it, a click pins / unpins and Esc clears.
export function BodyScene({
  showFps = false,
  layer: layerProp,
  onLayerChange,
  onThreatClick,
  focusedThreat,
}: {
  showFps?: boolean
  layer?: Layer
  onLayerChange?(layer: Layer): void
  onThreatClick?(threatId: ThreatId): void
  focusedThreat?: ThreatId | null
}) {
  const selectRegion = useHealthStore((s) => s.selectRegion)
  const [ownLayer, setOwnLayer] = useState<Layer>('body') // used only when `layer` is not passed
  const layer = layerProp ?? ownLayer
  // Threat focus lives in the twin's own scene store (not the shared health store,
  // never selectRegion). Hover previews, click pins, click again or Esc clears.
  const controlled = focusedThreat !== undefined
  const setPinnedThreat = useSceneStore((s) => s.setPinnedThreat)
  const setHoverThreat = useSceneStore((s) => s.setHoverThreat)
  useLayoutEffect(() => {
    if (controlled) setPinnedThreat(focusedThreat)
  }, [controlled, focusedThreat, setPinnedThreat])
  const onThreatToggle = (id: ThreatId) => {
    if (!controlled) {
      const pinned = useSceneStore.getState().pinnedThreat
      setPinnedThreat(pinned === id ? null : id)
    }
    onThreatClick?.(id)
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setHoverThreat(null)
      if (!controlled) setPinnedThreat(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [controlled, setHoverThreat, setPinnedThreat])
  const focused = useFocusedThreat()
  useSolarFlareWatcher() // flare effects start only on the transition to 'solar_flare'
  // Same array object until the scenario changes, so organs re-render only on real changes.
  const focus = useHealthStore((s) => (focused ? (s.threats?.[focused].regions ?? null) : null))
  // Shared between the HTML overlay and the Canvas for the focus lines (no React state per frame).
  const container = useRef<HTMLDivElement>(null)
  const iconRefs = useRef<Partial<Record<ThreatId, HTMLElement | null>>>({})
  const focusLines = useRef<(SVGLineElement | null)[]>([])
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
    <div ref={container} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: CAMERA.position, fov: CAMERA.fov }}
        dpr={RENDER.dpr}
        shadows={false} // no shadow maps: nothing in the scene casts shadows
        gl={{ antialias: false, stencil: true }} // EffectComposer does the anti-aliasing; stencil for the shell
        onPointerMissed={clearSelection} // click on empty space clears selection
        onPointerDown={hintVisible ? hideHint : undefined}
        onWheel={hintVisible ? hideHint : undefined}
      >
        <primitive attach="background" object={BACKGROUND} />
        <Stars
          radius={SCENE.stars.radius}
          depth={SCENE.stars.depth}
          count={SCENE.stars.count}
          factor={SCENE.stars.factor}
          speed={SCENE.stars.speed}
          saturation={0}
          fade
        />
        <StudioEnvironment />
        <ambientLight ref={ambient} intensity={SCENE.ambientIntensity} />
        <directionalLight ref={keyLight} position={SCENE.keyLight.position} intensity={SCENE.keyLight.intensity} />
        <directionalLight
          ref={rimLight}
          position={SCENE.rimLight.position}
          intensity={SCENE.rimLight.intensity}
          color={SCENE.rimLight.color}
        />
        {/* Selection collects the organs marked with <Select enabled> in RegionMesh. */}
        <Selection>
          {REGIONS.map((def) => (
            <RegionMesh key={def.id} def={def} layer={layer} focus={focus} />
          ))}
          <Skeleton layer={layer} />
          <Body layer={layer} />
          {/* stencilBuffer: the shell draws each pixel only once (see Body.tsx) */}
          <EffectComposer multisampling={RENDER.multisampling} stencilBuffer>
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
        <Callouts visible={layer === 'body'} />
        <ChainLinks visible={layer === 'body'} />
        {/* Threat effects, each behind its own flag in config.ts (EFFECTS). */}
        {(EFFECTS.habitatModule || EFFECTS.cabinFog || EFFECTS.cabinSensors) && <Habitat layer={layer} />}
        {EFFECTS.cabinFlow && <CabinFlow layer={layer} />}
        {EFFECTS.circadianRing && <CircadianRing layer={layer} />}
        {EFFECTS.offline && <OfflineTag />}
        {EFFECTS.gravityArrow && <GravityArrow />}
        {EFFECTS.radiationTracks && <RadiationTracks layer={layer} />}
        {EFFECTS.shelter && <Shelter layer={layer} />}
        {showFps && <Stats />}
        <CameraRig />
        <FocusLineTracker lines={focusLines} iconRefs={iconRefs} container={container} />
      </Canvas>
      <LayerSwitch layer={layer} onChange={changeLayer} />
      {EFFECTS.offline && <OfflineTint />}
      {EFFECTS.solarFlare && <FlareFlash />}
      <FocusLinesSvg lines={focusLines} />
      <ThreatStrip iconRefs={iconRefs} onToggle={onThreatToggle} />
      <Legend layer={layer} />
      <Hint visible={hintVisible} />
    </div>
  )
}
