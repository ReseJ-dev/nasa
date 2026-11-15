import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Environment, Lightformer, Stars, Stats } from '@react-three/drei'
import { EffectComposer, Selection, SelectiveBloom, Vignette } from '@react-three/postprocessing'
import { AdditiveBlending, CanvasTexture, SRGBColorSpace, type AmbientLight, type DirectionalLight } from 'three'
import { Body } from './Body'
import { BODY } from './bodyShape'
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
import { IsolationStage } from './isolationStage'
import { ReactionImpulse } from './ReactionImpulse'
import { ActivityBars } from './ActivityBars'
import { MoodDots } from './MoodDots'
import { OfflineTag, OfflineTint } from './Offline'
import { GravityArrow } from './GravityArrow'
import { ChainLinks } from './ChainLinks'
import { FluidShiftLabel } from './FluidShift'
import type { ThreatId } from '../contract/types'
import { LAYER_LABEL } from './labels'
import { REGIONS } from './regions'
import { useHealthStore } from './store'
import { BLOOM, CAMERA, EFFECTS, RENDER, SCENE, SKELETON_ONLY, type Layer } from './config'
import { overlayStyles as st } from './overlayStyles'
import './theme'

function StillFrame({ onReady }: { onReady(): void }) {
  const advance = useThree(state => state.advance)
  useEffect(() => {
    let frame = 0
    let request = 0
    const draw = () => {
      advance(++frame / 24, false)
      if (frame < 52) request = requestAnimationFrame(draw)
      else onReady()
    }
    request = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(request)
  }, [advance, onReady])
  return null
}

// Scene backdrop, drawn once at module load: a dark vertical gradient with a soft halo behind
// the torso. A little noise is mixed in, so the dark gradient shows no visible steps (banding).
function createBackground() {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createLinearGradient(0, 0, 0, size)
  gradient.addColorStop(0, SCENE.backgroundTop)
  gradient.addColorStop(1, SCENE.backgroundBottom)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const h = SCENE.halo
  const halo = ctx.createRadialGradient(h.x * size, h.y * size, 0, h.x * size, h.y * size, h.radius * size)
  halo.addColorStop(0, `rgba(${h.color}, ${h.alpha})`)
  halo.addColorStop(0.5, `rgba(${h.color}, ${h.alpha * 0.35})`)
  halo.addColorStop(1, `rgba(${h.color}, 0)`)
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, size, size)
  const image = ctx.getImageData(0, 0, size, size)
  for (let i = 0; i < image.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 2.4
    image.data[i] += n
    image.data[i + 1] += n
    image.data[i + 2] += n
  }
  ctx.putImageData(image, 0, 0)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}
const BACKGROUND = createBackground()

// Floor glow under the body: a soft round light that fades out, with darker spots right under
// the feet (reads as a contact shadow). One small texture, drawn once at module load.
function createGroundTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const c = size / 2
  const glow = ctx.createRadialGradient(c, c, 0, c, c, c)
  glow.addColorStop(0, `rgba(${SCENE.ground.color}, 0.55)`)
  glow.addColorStop(0.25, `rgba(${SCENE.ground.color}, 0.3)`)
  glow.addColorStop(0.6, `rgba(${SCENE.ground.color}, 0.07)`)
  glow.addColorStop(1, `rgba(${SCENE.ground.color}, 0)`)
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, size, size)
  // Cut the glow under each foot. Texture x = scene x, texture y = scene z (front is down).
  const perMeter = size / SCENE.ground.size
  ctx.globalCompositeOperation = 'destination-out'
  for (const side of [-1, 1]) {
    const x = c + side * BODY.ankle[0] * perMeter
    const y = c + 0.04 * perMeter
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(1, 1.9) // feet are longer than wide
    const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.085 * perMeter)
    shadow.addColorStop(0, 'rgba(0, 0, 0, 0.9)')
    shadow.addColorStop(0.6, 'rgba(0, 0, 0, 0.5)')
    shadow.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = shadow
    ctx.fillRect(-size, -size, size * 2, size * 2)
    ctx.restore()
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}
const GROUND_TEXTURE = createGroundTexture()
const noRaycast = () => null // decoration: never catches hover or clicks
// Organ meshes drawn in the scene; the bones region is drawn only by the Skeleton layer.
const ORGANS = REGIONS.filter((def) => !SKELETON_ONLY.includes(def.id))

function GroundGlow() {
  return (
    <mesh position={[0, SCENE.ground.y, 0]} rotation-x={-Math.PI / 2} raycast={noRaycast} renderOrder={-1}>
      <planeGeometry args={[SCENE.ground.size, SCENE.ground.size]} />
      <meshBasicMaterial
        map={GROUND_TEXTURE}
        transparent
        opacity={SCENE.ground.opacity}
        blending={AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

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

// "Body / Skeleton" switch shown over the top-right corner of the stage.
function LayerSwitch({ layer, onChange }: { layer: Layer; onChange(l: Layer): void }) {
  return (
    <div style={st.layerSwitch} role="group">
      {(Object.keys(LAYER_LABEL) as Layer[]).map((l) => (
        <button
          key={l}
          aria-pressed={l === layer}
          onClick={() => onChange(l)}
          style={{ ...st.layerButton, ...(l === layer ? st.layerButtonActive : null) }}
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
// compact: the threats strip as a narrow centered row of rings without a panel (presentation).
export function BodyScene({
  showFps = false,
  compact = false,
  still = false,
  layer: layerProp,
  onLayerChange,
  onThreatClick,
  focusedThreat,
}: {
  showFps?: boolean
  compact?: boolean
  still?: boolean
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
  // A highlighted alert (from the alerts list) wins over the threat focus.
  const focus = useHealthStore((s) => s.highlightRegions ?? (focused ? (s.threats?.[focused].regions ?? null) : null))
  // Shared between the HTML overlay and the Canvas for the focus lines (no React state per frame).
  const container = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const finishStill = useMemo(() => () => stage.current?.setAttribute('data-frame', 'frozen'), [])
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
  const fillLight = useRef<DirectionalLight>(null)
  const rimLight = useRef<DirectionalLight>(null)
  // Same array on every render, so SelectiveBloom does not re-attach lights.
  const bloomLights = useMemo(() => [ambient, keyLight, fillLight, rimLight], [])
  const clearSelection = useMemo(() => () => selectRegion(null), [selectRegion])

  return (
    <div ref={container} style={st.root}>
      {/* Threats: their own row, so nothing covers the astronaut. */}
      <ThreatStrip iconRefs={iconRefs} onToggle={onThreatToggle} compact={compact} showPhysicalDose={still} />
      <div ref={stage} style={st.stage}>
        <Canvas
          frameloop={still ? 'never' : 'always'}
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
          <directionalLight
            ref={keyLight}
            position={SCENE.keyLight.position}
            intensity={SCENE.keyLight.intensity}
            color={SCENE.keyLight.color}
          />
          <directionalLight
            ref={fillLight}
            position={SCENE.fillLight.position}
            intensity={SCENE.fillLight.intensity}
            color={SCENE.fillLight.color}
          />
          <directionalLight
            ref={rimLight}
            position={SCENE.rimLight.position}
            intensity={SCENE.rimLight.intensity}
            color={SCENE.rimLight.color}
          />
          {/* Selection collects the organs marked with <Select enabled> in RegionMesh. */}
          <Selection>
            {ORGANS.map((def) => (
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
              <Vignette offset={SCENE.vignette.offset} darkness={SCENE.vignette.darkness} />
            </EffectComposer>
          </Selection>
          <GroundGlow />
          <Callouts visible={layer === 'body'} />
          <ChainLinks visible={layer === 'body'} />
          <FluidShiftLabel visible={layer === 'body'} />
          {/* Threat effects, each behind its own flag in config.ts (EFFECTS). */}
          {(EFFECTS.habitatModule || EFFECTS.cabinFog || EFFECTS.cabinSensors) && <Habitat layer={layer} />}
          {EFFECTS.cabinFlow && <CabinFlow layer={layer} />}
          {/* Isolation visuals: the stage driver first, then the elements that read it. */}
          <IsolationStage layer={layer} />
          {EFFECTS.circadianRing && <CircadianRing />}
          {EFFECTS.reactionImpulse && <ReactionImpulse />}
          {EFFECTS.activityBars && <ActivityBars />}
          {EFFECTS.moodDots && <MoodDots />}
          {EFFECTS.offline && <OfflineTag />}
          {EFFECTS.gravityArrow && <GravityArrow />}
          {EFFECTS.radiationTracks && <RadiationTracks layer={layer} still={still} />}
          {EFFECTS.shelter && <Shelter layer={layer} />}
          {showFps && <Stats />}
          <CameraRig />
          <FocusLineTracker lines={focusLines} iconRefs={iconRefs} container={container} stage={stage} />
          {still && <StillFrame onReady={finishStill} />}
        </Canvas>
        {!still && <LayerSwitch layer={layer} onChange={changeLayer} />}
        {EFFECTS.offline && <OfflineTint />}
        {still && <div className="slide-flare-glow" aria-hidden="true" />}
        {!still && EFFECTS.solarFlare && <FlareFlash />}
        <Legend layer={layer} />
        {!still && <Hint visible={hintVisible} />}
      </div>
      <FocusLinesSvg lines={focusLines} />
    </div>
  )
}
