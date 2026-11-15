import { useHealthStore } from './twin/store'

// Solar flare on demand (Control room button): starts on top of whatever the app shows now,
// without loading a preset. Everything else follows from the store inputs through the engine:
// the dose raises the radiation threat and worsens the immune system; the shelter isolates the
// crew. Only scripted inputs move here; nothing is computed.

export const FLARE = {
  // Extra dose of this flare, demo value (project estimate). NASA designs for at most 250 mSv
  // per solar particle event (NASA-STD-3001 Vol 1 [V1 4031]); this is well below it.
  doseMsv: 100,
  rampS: 4, // the dose counts up over this time
  shelterAfterS: 2, // crew reaches the shelter
  shelterIsolation: 0.5, // isolation index while the crew sits in the small shelter (demo value)
}

const store = () => useHealthStore.getState()
let timers: ReturnType<typeof setTimeout>[] = []
let before: { isolation: number | undefined } | null = null

export function startSolarFlare() {
  stopTimers()
  const s = store()
  before = { isolation: s.inputs.isolation }
  const startDose = s.inputs.radiationMsv ?? 0
  // flash, alarm sound and track burst start on this transition (useSolarFlareWatcher)
  s.patch({ activeEvent: 'solar_flare' })
  const steps = 10
  for (let i = 1; i <= steps; i++) {
    timers.push(setTimeout(() => store().setInputs({ radiationMsv: startDose + (FLARE.doseMsv * i) / steps }), (FLARE.rampS * 1000 * i) / steps))
  }
  timers.push(
    setTimeout(() => {
      store().patch({ inShelter: true })
      store().setInputs({ isolation: Math.max(store().inputs.isolation ?? 0, FLARE.shelterIsolation) })
    }, FLARE.shelterAfterS * 1000),
  )
}

// End of the flare: the crew leaves the shelter; the dose received stays (it is cumulative).
export function endSolarFlare() {
  stopTimers()
  store().patch({ activeEvent: 'none', inShelter: false })
  if (before) store().setInputs({ isolation: before.isolation })
  before = null
}

function stopTimers() {
  timers.forEach(clearTimeout)
  timers = []
}
