import { useCallback, useEffect, useRef, useState } from 'react'

// 30-second reaction test (shortened PVT-B style; PVT-B itself is 3 min with a 355 ms lapse cut-off,
// Basner et al. 2011. The 30 s length and the 500 ms cut-off are project estimates, see SOURCES.md). A signal appears after a random 1–4 s wait;
// the user clicks the area or presses Space as fast as possible. Responses slower than
// LAPSE_MS, and signals left without a response, count as lapses. Early presses are false starts.
// Timing uses performance.now(); the signal time is taken in the next animation frame, when the
// browser is about to paint it.

const TEST_MS = 30_000
const WAIT_MS: [number, number] = [1000, 4000]
const LAPSE_MS = 500
const MISS_MS = 2000 // a signal without a response disappears after this and counts as a lapse

export interface ReactionResult {
  meanMs: number
  lapses: number
  responses: number
  falseStarts: number
}

const TEXT = {
  title: 'Reaction test',
  label: 'Shortened PVT-B style test (Basner et al. 2011); test length and lapse cut-off are project estimates',
  intro:
    'For 30 seconds, a signal appears at random moments. Click the box or press Space as soon as you see it. Do not press before it appears.',
  start: 'Start test',
  wait: 'Wait for the signal…',
  now: 'Now!',
  early: 'Too early: wait for the signal',
  left: (s: number) => `${s} s left`,
  last: (ms: number) => `${Math.round(ms)} ms`,
  result: 'Result',
  mean: 'Mean reaction time',
  lapses: `Lapses (slower than ${LAPSE_MS} ms)`,
  responses: 'Responses',
  falseStarts: 'False starts',
  saved: 'Saved to today’s check-in.',
  noData: 'No responses recorded, nothing was saved.',
  again: 'Repeat test',
  close: 'Close',
  cancel: 'Cancel (Esc)',
}

type Phase = 'intro' | 'running' | 'done'
const randomWait = () => WAIT_MS[0] + Math.random() * (WAIT_MS[1] - WAIT_MS[0])

export function ReactionTest({ onResult, onClose }: { onResult(r: ReactionResult): void; onClose(): void }) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [signal, setSignal] = useState(false)
  const [message, setMessage] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(TEST_MS / 1000)
  const [result, setResult] = useState<ReactionResult | null>(null)

  // Mutable test data, not React state: it changes between frames.
  const run = useRef({ start: 0, shownAt: 0, times: [] as number[], lapses: 0, falseStarts: 0 })
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const frame = useRef(0)
  const area = useRef<HTMLDivElement>(null)

  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    cancelAnimationFrame(frame.current)
  }
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms))

  const finish = useCallback(() => {
    clearTimers()
    setSignal(false)
    const { times, lapses, falseStarts } = run.current
    const r: ReactionResult = {
      meanMs: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
      lapses,
      responses: times.length,
      falseStarts,
    }
    setResult(r)
    setPhase('done')
    if (r.responses > 0) onResult(r)
  }, [onResult])

  // Schedules the next signal, or ends the test when the time is up.
  const next = useCallback(function scheduleNext() {
    const wait = randomWait()
    if (performance.now() - run.current.start + wait >= TEST_MS) {
      later(finish, Math.max(TEST_MS - (performance.now() - run.current.start), 0))
      return
    }
    later(() => {
      setSignal(true)
      frame.current = requestAnimationFrame(() => {
        run.current.shownAt = performance.now()
      })
      // no response: the signal goes away and counts as a lapse
      later(() => {
        run.current.lapses++
        run.current.shownAt = 0
        setSignal(false)
        setMessage('')
        scheduleNext()
      }, MISS_MS)
    }, wait)
  }, [finish])

  const start = () => {
    clearTimers()
    run.current = { start: performance.now(), shownAt: 0, times: [], lapses: 0, falseStarts: 0 }
    setResult(null)
    setMessage('')
    setSignal(false)
    setSecondsLeft(TEST_MS / 1000)
    setPhase('running')
    next()
  }

  const respond = useCallback(() => {
    if (phase !== 'running') return
    const now = performance.now()
    const { shownAt } = run.current
    if (!signal || shownAt === 0) {
      // pressed before the signal: restart the wait
      run.current.falseStarts++
      clearTimers()
      setSignal(false)
      setMessage(TEXT.early)
      next()
      return
    }
    const rt = now - shownAt
    run.current.times.push(rt)
    if (rt > LAPSE_MS) run.current.lapses++
    run.current.shownAt = 0
    clearTimers()
    setSignal(false)
    setMessage(TEXT.last(rt))
    next()
  }, [phase, signal, next])

  // Space responds while running; Esc cancels at any time.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearTimers()
        onClose()
        return
      }
      if (phase === 'running' && (e.code === 'Space' || e.key === ' ')) {
        e.preventDefault()
        if (!e.repeat) respond()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, respond, onClose])

  // Countdown display (once per second is enough).
  useEffect(() => {
    if (phase !== 'running') return
    area.current?.focus()
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((TEST_MS - (performance.now() - run.current.start)) / 1000))
      setSecondsLeft(left)
    }, 250)
    return () => clearInterval(id)
  }, [phase])

  useEffect(() => clearTimers, [])

  return (
    <div className="reaction-overlay" role="dialog" aria-modal="true" aria-labelledby="reaction-title">
      <div className="reaction-dialog">
        <header>
          <h2 id="reaction-title">{TEXT.title}</h2>
          <p>{TEXT.label}</p>
        </header>

        {phase === 'intro' && (
          <>
            <p>{TEXT.intro}</p>
            <div className="reaction-actions">
              <button type="button" className="reaction-primary" onClick={start} autoFocus>{TEXT.start}</button>
              <button type="button" onClick={onClose}>{TEXT.close}</button>
            </div>
          </>
        )}

        {phase === 'running' && (
          <>
            <div
              ref={area}
              tabIndex={0}
              className="reaction-area"
              data-signal={signal}
              onPointerDown={(e) => {
                e.preventDefault()
                respond()
              }}
            >
              <span className="reaction-dot" aria-hidden="true" />
              <strong aria-live="assertive">{signal ? TEXT.now : TEXT.wait}</strong>
              <small>{message}</small>
            </div>
            <div className="reaction-actions">
              <span>{TEXT.left(secondsLeft)}</span>
              <button type="button" onClick={() => { clearTimers(); onClose() }}>{TEXT.cancel}</button>
            </div>
          </>
        )}

        {phase === 'done' && result && (
          <>
            <h3>{TEXT.result}</h3>
            <dl className="health-grid">
              <div className="health-metric"><dt>{TEXT.mean}</dt><dd>{result.responses ? `${result.meanMs}` : '—'} <small>ms</small></dd></div>
              <div className="health-metric"><dt>{TEXT.lapses}</dt><dd>{result.lapses}</dd></div>
              <div className="health-metric"><dt>{TEXT.responses}</dt><dd>{result.responses}</dd></div>
              <div className="health-metric"><dt>{TEXT.falseStarts}</dt><dd>{result.falseStarts}</dd></div>
            </dl>
            <p>{result.responses > 0 ? TEXT.saved : TEXT.noData}</p>
            <div className="reaction-actions">
              <button type="button" className="reaction-primary" onClick={start}>{TEXT.again}</button>
              <button type="button" onClick={onClose} autoFocus>{TEXT.close}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
