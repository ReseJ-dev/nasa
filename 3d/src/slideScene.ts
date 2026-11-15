import { useHealthStore } from './twin/store'

export type SlideScene = 'flare' | 'shelter'

export function loadSlideScene(scene: SlideScene) {
  const store = useHealthStore.getState()
  store.setScenario('healthy')
  store.setDay(120)
  // Isolate the solar event for the slide. Both frames show the same accumulated dose.
  store.setInputs({ microgravity: 0, isolation: 0, sleepHours: 8, radiationMsv: 210 })
  store.setEarthLink(true)
  store.patch({ activeEvent: 'solar_flare', inShelter: scene === 'shelter' })
}
