import './resolve-ts.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'

globalThis.location ??= { search: '' }
const { useHealthStore } = await import('../src/twin/store.ts')
const { loadPreset } = await import('../src/ui/presetState.ts')

// Same comparison as useIsCustom, without React.
const key = (s) => JSON.stringify([s.day, s.inputs, s.exercise, s.environment, s.earthLink ?? true])
let loaded = key(useHealthStore.getState())
const load = (id) => { loadPreset(id); loaded = key(useHealthStore.getState()) }
const custom = () => key(useHealthStore.getState()) !== loaded

test('a loaded preset is not Custom; any input change makes it Custom; reloading clears it', () => {
  const changes = {
    day: (s) => s.setDay(12),
    checkIn: (s) => s.setInputs({ vitals: { mood: 2 } }),
    exercise: (s) => s.setExercise({ aerobic: 0, resistance: 0 }),
    environment: (s) => s.setEnvironment('mars_surface'),
    earthLink: (s) => s.setEarthLink(!(s.earthLink ?? true)),
  }
  for (const id of ['healthy', 'day60', 'critical']) {
    for (const [name, change] of Object.entries(changes)) {
      load(id)
      assert.equal(custom(), false, `${id} loaded`)
      change(useHealthStore.getState())
      assert.equal(custom(), true, `${id} after ${name}`)
    }
  }
  load('healthy')
  useHealthStore.getState().selectRegion('heart') // looking is not changing
  assert.equal(custom(), false)
  useHealthStore.getState().setDay(5)
  useHealthStore.getState().setDay(0) // back to the preset's own value
  assert.equal(custom(), false)
})
