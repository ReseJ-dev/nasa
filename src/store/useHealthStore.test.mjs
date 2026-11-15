import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { beforeEach, test } from 'node:test'
import { SCENARIOS } from '../data/scenarios.ts'
import { missionSimulation, simulate } from '../engine/index.ts'
import { initializeHealthStore } from './useHealthStore.ts'

const requireFromApp = createRequire(new URL('../../3d/package.json', import.meta.url))
const { create } = requireFromApp('zustand')
const useHealthStore = create(initializeHealthStore)
const { getState, getInitialState, setState, subscribe } = useHealthStore

beforeEach(() => setState(getInitialState(), true))

function verifyComputation(state) {
  const { input, options } = missionSimulation(state.day, state.inputs, state.exercise, state)
  const computed = simulate(input, options)
  for (const [key, value] of Object.entries(computed)) assert.deepEqual(state[key], value)
  return state
}

test('scenario selection computes all three presets and preserves selection', () => {
  getState().selectRegion('brain')
  for (const [id, day] of [['day60', 60], ['critical', 180], ['healthy', 0]]) {
    getState().setScenario(id)
    const state = getState()
    assert.equal(state.scenario, id)
    assert.equal(state.day, day)
    assert.equal(state.selectedRegion, 'brain')
    verifyComputation(state)
    const preset = SCENARIOS[id]
    for (const key of ['activeEvent', 'baseline', 'commDelaySec', 'earthLink']) assert.deepEqual(state[key], preset[key])
    for (const key of ['co2_ppm', 'sleep_hours', 'radiation_msv']) {
      assert.equal(state.metrics.find(m => m.id === key).value, preset.metrics.find(m => m.id === key).value)
    }
  }
  assert.notEqual(getState().baseline, SCENARIOS.healthy.baseline)
  assert.notEqual(getState().regions.brain.advice, SCENARIOS.healthy.regions.brain.advice)
})

test('day, environment and exercise updates use the engine and keep scenario metadata', () => {
  const original = structuredClone(SCENARIOS.critical)
  getState().setScenario('critical')
  getState().setExercise({ aerobic: 0, resistance: 0 })
  const baseline = getState().baseline
  const inputs = Object.freeze({ co2Ppm: 4800, sleepHours: 7 })
  const exercise = Object.freeze({ resistance: 0.8 })
  getState().setDay(90)
  const afterDay = verifyComputation(getState())
  assert.equal(afterDay.day, 90)
  getState().setInputs(inputs)
  assert.equal(verifyComputation(getState()).inputs.co2Ppm, 4800)
  getState().setExercise(exercise)
  const computed = verifyComputation(getState())
  assert.equal(computed.exercise.resistance, 0.8)
  assert.ok(computed.boneDensity.pelvis > afterDay.boneDensity.pelvis)
  assert.equal(computed.commDelaySec, original.commDelaySec)
  assert.equal(computed.earthLink, original.earthLink)
  assert.equal(computed.activeEvent, original.activeEvent)
  assert.equal(computed.baseline, baseline)
  assert.deepEqual(SCENARIOS.critical, original)

  getState().setScenario('critical')
  verifyComputation(getState())
  assert.equal(getState().inputs.co2Ppm, 6800)
  assert.equal(getState().exercise.resistance, 0.6)
})

test('selection changes only selectedRegion and repeated selection is a no-op', () => {
  const before = getState()
  let updates = 0
  const unsubscribe = subscribe(() => updates++)
  try {
    before.selectRegion('heart')
    const after = getState()
    for (const key of Object.keys(before)) {
      if (key !== 'selectedRegion') assert.equal(after[key], before[key], key)
    }
    assert.equal(after.selectedRegion, 'heart')
    after.selectRegion('heart')
    assert.equal(getState(), after)
    assert.equal(updates, 1)
    after.selectRegion(null)
    assert.equal(getState().selectedRegion, null)
  } finally {
    unsubscribe()
  }
})

test('unchanged parts reuse references across calculations and scenario reloads', () => {
  getState().setScenario('critical')
  const fixture = getState()
  fixture.setDay(181)
  const before = getState()
  assert.equal(before.chain, fixture.chain)
  assert.equal(before.chainLinks, fixture.chainLinks)

  before.setInputs({ sleepHours: 7 })
  const after = getState()
  assert.equal(after.chain, before.chain)
  assert.equal(after.chainLinks, before.chainLinks)
  assert.equal(after.boneDensity, before.boneDensity)
  assert.equal(after.exercise, before.exercise)
  assert.equal(after.baseline, before.baseline)
  assert.equal(after.regions.heart, before.regions.heart)
  assert.equal(after.regions.lungs, before.regions.lungs)
  assert.notEqual(after.regions.brain, before.regions.brain)
  assert.equal(after.regions.brain.metrics, before.regions.brain.metrics)
  assert.equal(after.metrics.find(m => m.id === 'co2_ppm'), before.metrics.find(m => m.id === 'co2_ppm'))
  after.setInputs({ sleepHours: 7 })
  after.setExercise({})
  after.setDay(181)
  assert.equal(getState(), after)

  after.setInputs({ co2Ppm: 2500 })
  assert.notEqual(getState().chain, after.chain)
  assert.deepEqual(getState().chain, ['brain', 'eyes'])
  after.setScenario('day60')
  const restored = getState()
  restored.setScenario('day60')
  assert.equal(getState(), restored)
})
