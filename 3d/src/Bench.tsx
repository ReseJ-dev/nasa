import { useEffect, useState } from 'react'
import type { ThreatId } from './contract/types'
import { BodyScene } from './twin'
import type { Layer } from './twin/config'
import { useHealthStore, type ScenarioId } from './twin/store'

// DEV TOOL, not part of the twin: FPS benchmark. Open the page with ?bench.
// Steps through scenario x layer x focus, waits for the scene to settle, counts frames with
// requestAnimationFrame (the same loop the scene renders in), then POSTs the results to
// /__bench, which the Vite server (vite.config.ts) writes to bench-result.json.

interface Case {
  scenario: ScenarioId
  layer: Layer
  focus: ThreatId | null
}

const FOCUS: Record<ScenarioId, ThreatId[]> = {
  healthy: ['radiation'],
  day60: ['gravity'],
  critical: ['radiation', 'environment', 'isolation'],
}
const CASES: Case[] = (['healthy', 'day60', 'critical'] as ScenarioId[]).flatMap((scenario) =>
  (['body', 'skeleton'] as Layer[]).flatMap((layer) =>
    [null, ...FOCUS[scenario]].map((focus) => ({ scenario, layer, focus })),
  ),
)
const SETTLE_MS = 2500 // fades, flare burst
const MEASURE_MS = 3000

function measure(ms: number): Promise<{ fps: number; worstFrameMs: number }> {
  return new Promise((resolve) => {
    let frames = 0
    let worst = 0
    let last = performance.now()
    const start = last
    const tick = (now: number) => {
      frames++
      worst = Math.max(worst, now - last)
      last = now
      if (now - start < ms) requestAnimationFrame(tick)
      else resolve({ fps: (frames * 1000) / (now - start), worstFrameMs: worst })
    }
    requestAnimationFrame(tick)
  })
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function Bench() {
  const [i, setI] = useState(0)
  const c = CASES[Math.min(i, CASES.length - 1)]
  const setScenario = useHealthStore((s) => s.setScenario)

  useEffect(() => {
    let cancelled = false
    const results: (Case & { fps: number; worstFrameMs: number })[] = []
    ;(async () => {
      for (let n = 0; n < CASES.length && !cancelled; n++) {
        setScenario(CASES[n].scenario)
        setI(n)
        await wait(SETTLE_MS)
        results.push({ ...CASES[n], ...(await measure(MEASURE_MS)) })
      }
      if (cancelled) return
      await fetch('/__bench', {
        method: 'POST',
        body: JSON.stringify({
          viewport: [innerWidth, innerHeight],
          devicePixelRatio,
          userAgent: navigator.userAgent,
          results,
        }),
      })
      document.title = 'bench done'
    })()
    return () => {
      cancelled = true
    }
  }, [setScenario])

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <BodyScene showFps layer={c.layer} focusedThreat={c.focus} />
      <div style={{ position: 'absolute', bottom: 16, left: 16, color: '#fff', font: '14px monospace' }}>
        bench {Math.min(i + 1, CASES.length)}/{CASES.length}: {c.scenario} / {c.layer} / focus {c.focus ?? 'none'}
      </div>
    </div>
  )
}
