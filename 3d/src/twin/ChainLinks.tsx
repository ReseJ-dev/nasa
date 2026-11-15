import { useCallback, useMemo } from 'react'
import { Html } from '@react-three/drei'
import type { ChainLink } from '../contract/types'
import { useHealthStore } from './store'
import { CHAIN, CHAIN_LABEL } from './config'
import { CHAIN_LABELS } from '../../../src/engine/constants'
import { sceneLabel } from './labels'
import { overlayStyles as s } from './overlayStyles'
import { REGIONS } from './regions'

// Cause labels between chain organs, from `chainLinks` in the store.
// Each label sits between its two organs (a bit in front of the body) and fades in
// when its `to` organ lights up in the chain animation. Body mode only.

const ANCHOR = new Map(REGIONS.map((d) => [d.id, d.callout.anchor]))
const NONE: ChainLink[] = []

function LinkLabel({ link, delay }: { link: ChainLink; delay: number }) {
  const position = useMemo(() => {
    const a = ANCHOR.get(link.from)!
    const b = ANCHOR.get(link.to)!
    const y = (a[1] + b[1]) / 2
    // Both organs in the head (brain -> eyes): the label goes above the head, not over the face.
    const lifted = y > CHAIN_LABEL.headFrom ? CHAIN_LABEL.aboveHead : y
    return [(a[0] + b[0]) / 2, lifted, Math.max(a[2], b[2]) + CHAIN_LABEL.zOffset] as [number, number, number]
  }, [link])

  // Fade in once, in sync with the chain glow (no React state per frame). A ref callback, not an
  // effect: drei's <Html> mounts its content later, in its own root, so an effect here ran before
  // the element existed and the label stayed at opacity 0.
  const fadeIn = useCallback(
    (el: HTMLDivElement | null) => {
      el?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: CHAIN_LABEL.fadeMs, delay: delay * 1000, fill: 'both' })
    },
    [delay],
  )

  return (
    <Html position={position} center style={{ pointerEvents: 'none' }}>
      <div ref={fadeIn} style={s.chainLabel}>
        {/* Short cause label of this organ pair; the store's own text only as a fallback. */}
        {sceneLabel(CHAIN_LABELS[`${link.from}>${link.to}`] ?? link.label)}
      </div>
    </Html>
  )
}

export function ChainLinks({ visible }: { visible: boolean }) {
  const chain = useHealthStore((st) => st.chain)
  const links = useHealthStore((st) => st.chainLinks ?? NONE)
  // Same restart rule as useChainGlow: new content -> labels remount and fade in again.
  const chainKey = chain.join(',')

  if (!visible) return null
  return (
    <group name="chain_links" key={chainKey}>
      {links.map((link) => {
        const step = Math.max(chain.indexOf(link.to), 0)
        return <LinkLabel key={`${link.from}-${link.to}`} link={link} delay={step * CHAIN.stepDelay} />
      })}
    </group>
  )
}
