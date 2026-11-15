import { useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { AlertMetric, Status } from '../contract/types'
import { useHealthStore } from './store'
import { useSceneStore } from './sceneStore'
import { useFocusedThreat } from './hooks/useFocusedThreat'
import { CIRCADIAN, ISOLATION as I, THREAT_LEVEL, type Layer } from './config'

// Shared presentation state of the isolation visuals (ring, impulse, bars, labels).
// One driver (useIsolationStageDriver) advances it every frame; the elements only read it
// in their own useFrame. Plain mutable object: no React state, no re-renders.
// Every value is an eased strength 0..1, except `outline`, which is the ring outline opacity.
export const stage = {
  outline: 0, // the thin ring outline
  ring: 0, // arcs, ticks and the "Sleep rhythm" label: only while isolation is Warning / Critical or focused
  impulse: 0,
  bars: 0,
  labels: 0, // labels of the ring, the impulse and the mood dots (body mode only)
  barLabel: 0, // label of the activity bars (also in skeleton mode)
}

type Channel = Exclude<keyof typeof stage, 'outline'>
// Fade-in order. Labels come last; the bar label shares their slot.
const ORDER: { channel: Channel; slot: number; inSkeleton: boolean }[] = [
  { channel: 'ring', slot: 0, inSkeleton: false },
  { channel: 'impulse', slot: 1, inSkeleton: false },
  { channel: 'bars', slot: 2, inSkeleton: true },
  { channel: 'labels', slot: 3, inSkeleton: false },
  { channel: 'barLabel', slot: 3, inSkeleton: true },
]

const ease = (p: number) => p * p * (3 - 2 * p) // ease in and out

// Frame-rate independent smoothing factor.
export const smoothK = (delta: number, speed: number) => 1 - Math.exp(-delta * speed)

// True while the isolation threat has the focus (hover preview, pin, or demo mode).
export function useIsolationFocus() {
  const focused = useFocusedThreat() === 'isolation'
  const demo = useSceneStore((s) => s.demo)
  return focused || demo
}

// Status of one isolation alert from the store ('ok' = no alert). The engine decides; we display.
export function useAlertStatus(metric: AlertMetric): Status {
  return useHealthStore(
    (s) => s.alerts?.find((a) => a.hazard === 'isolation' && a.metric === metric)?.status ?? 'ok',
  )
}

export function useAnyIsolationAlert() {
  return useHealthStore((s) => s.alerts?.some((a) => a.hazard === 'isolation') ?? false)
}

// True while the isolation threat level is Warning or Critical (same thresholds as the strip ring).
export function useIsolationWarning() {
  return useHealthStore((s) => (s.threats?.isolation.level ?? 0) >= THREAT_LEVEL.warnAt)
}

// Call once (IsolationStage in BodyScene), before the elements, so they read fresh values.
export function useIsolationStageDriver(layer: Layer) {
  const focus = useIsolationFocus()
  const warning = useIsolationWarning()
  const otherFocused = useFocusedThreat() !== null && !focus
  const target = useRef({ focus, warning, body: layer === 'body', otherFocused })
  useLayoutEffect(() => {
    target.current = { focus, warning, body: layer === 'body', otherFocused }
  }, [focus, warning, layer, otherFocused])

  const since = useRef(0) // seconds since isolation got the focus
  const progress = useRef<Record<Channel, number>>({ ring: 0, impulse: 0, bars: 0, labels: 0, barLabel: 0 })

  useFrame((_, delta) => {
    const { focus, warning, body, otherFocused } = target.current
    since.current = focus ? since.current + delta : 0
    for (const { channel, slot, inSkeleton } of ORDER) {
      // The sleep ring also stays on while isolation is Warning / Critical; the rest needs the focus.
      const want = (focus || (channel === 'ring' && warning)) && (body || inSkeleton)
      let p = progress.current[channel]
      if (!want) p = Math.max(0, p - delta / I.fadeOut)
      else if (since.current >= slot * I.stagger) p = Math.min(1, p + delta / I.fadeIn)
      progress.current[channel] = p
      stage[channel] = ease(p)
    }
    // Hidden unless isolation is Warning / Critical or focused. One accent at a time: the outline
    // drops to 20 % while another threat is focused.
    const rest = warning ? CIRCADIAN.outlineRest * (otherFocused ? 0.2 : 1) : 0
    const goal = !body ? 0 : focus ? CIRCADIAN.outlineFocused : rest
    stage.outline += (goal - stage.outline) * smoothK(delta, I.colorLerp)
  })
}

// Mounted once in BodyScene, before the isolation elements.
export function IsolationStage({ layer }: { layer: Layer }) {
  useIsolationStageDriver(layer)
  return null
}

// ---- DOM helpers for labels driven from useFrame (no React state per frame) ----------------
export function setOpacity(el: HTMLElement | null, value: number) {
  if (!el) return
  const text = value < 0.005 ? '0' : value.toFixed(2)
  if (el.style.opacity === text) return
  el.style.opacity = text
  el.style.visibility = text === '0' ? 'hidden' : 'visible'
}

export function setText(el: HTMLElement | null, text: string) {
  if (el && el.textContent !== text) el.textContent = text
}
