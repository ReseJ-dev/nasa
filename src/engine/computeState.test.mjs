import assert from 'node:assert/strict'
import { test } from 'node:test'
import { computeState } from './index.ts'

const nominal = Object.freeze({
  co2Ppm: 2500, sleepHours: 8, radiationMsv: 0, microgravity: 1, isolation: 0,
})
const noExercise = Object.freeze({ aerobic: 0, resistance: 0 })
const fullExercise = Object.freeze({ aerobic: 1, resistance: 1 })
const metricValue = (state, id) => state.metrics.find((metric) => metric.id === id).value

test('day zero has eight intact bone regions and no accumulated unloading loss', () => {
  const state = computeState(0, nominal, noExercise)
  assert.deepEqual(Object.values(state.boneDensity), Array(8).fill(1))
  assert.equal(metricValue(state, 'muscle_loss_pct'), 0)
  assert.equal(state.fluidShift, 0)
  assert.deepEqual(state.chain, [])
  assert.ok(Object.values(state.regions).every(({ status, score }) => status === 'ok' && score >= 70))
  assert.equal('selectedRegion' in state, false)
  assert.equal('selectRegion' in state, false)
})

test('microgravity reduces load-bearing bone density by about 1–1.6% per month', () => {
  const month = computeState(30, nominal, noExercise)
  const later = computeState(180, nominal, noExercise)
  for (const part of ['pelvis', 'spine', 'leg_left', 'leg_right']) {
    assert.ok(month.boneDensity[part] >= 0.984 && month.boneDensity[part] <= 0.99)
    assert.ok(month.boneDensity[part] < month.boneDensity.skull)
    assert.ok(later.boneDensity[part] < month.boneDensity[part])
  }
  const earthLoad = computeState(180, { ...nominal, microgravity: 0 }, noExercise)
  assert.equal(metricValue(earthLoad, 'bone_loss_pct'), 0)
  assert.equal(metricValue(earthLoad, 'muscle_loss_pct'), 0)
  assert.equal(earthLoad.fluidShift, 0)
})

test('resistance training reduces bone and muscle loss and aerobic training helps the heart', () => {
  const sedentary = computeState(180, nominal, noExercise)
  const trained = computeState(180, nominal, fullExercise)
  for (const part of Object.keys(trained.boneDensity)) {
    if (part === 'skull') {
      assert.equal(trained.boneDensity[part], sedentary.boneDensity[part])
      continue
    }
    assert.ok(trained.boneDensity[part] > sedentary.boneDensity[part])
  }
  for (const id of ['bone_loss_pct', 'muscle_loss_pct']) {
    assert.ok(metricValue(trained, id) < metricValue(sedentary, id))
  }
  for (const id of ['heart', 'bones', 'muscles']) {
    assert.ok(trained.regions[id].score > sedentary.regions[id].score)
  }
  assert.deepEqual(trained.regions.lungs, sedentary.regions.lungs)
})

test('CO₂ and the SANS hypothesis have independent display chains', () => {
  const highCo2 = { ...nominal, co2Ppm: 7000, fluidShift: 0 }
  const co2 = computeState(60, highCo2, noExercise)
  const sans = computeState(60, { ...nominal, fluidShift: 1 }, noExercise)
  const both = computeState(60, { ...highCo2, fluidShift: 1 }, noExercise)
  assert.deepEqual(co2.chain, ['lungs', 'brain'])
  assert.deepEqual(sans.chain, ['brain', 'eyes'])
  assert.deepEqual(both.chain, co2.chain)
  for (const state of [co2, sans, both]) {
    assert.deepEqual(state.chainLinks.map(({ from, to }) => [from, to]), [state.chain])
  }
  assert.equal(co2.regions.lungs.status, 'critical')
  assert.equal(co2.regions.eyes.status, 'ok')
  assert.equal(sans.regions.lungs.status, 'ok')
  assert.deepEqual(both.regions.eyes, sans.regions.eyes)
})

test('sleep loss, isolation and radiation affect their intended regions', () => {
  const base = computeState(0, nominal, noExercise)
  const sleepLoss = computeState(0, { ...nominal, sleepHours: 2 }, noExercise)
  const isolated = computeState(0, { ...nominal, isolation: 1 }, noExercise)
  const exposed = computeState(0, { ...nominal, radiationMsv: 125 }, noExercise)
  for (const state of [sleepLoss, isolated]) {
    assert.ok(state.regions.brain.score < base.regions.brain.score)
    assert.ok(metricValue(state, 'reaction_ms') > metricValue(base, 'reaction_ms'))
    assert.deepEqual(state.chain, [])
  }
  assert.equal(exposed.radiationLevel, 0.5)
  assert.equal(exposed.regions.immune.status, 'warning')
  assert.deepEqual(exposed.regions.brain, base.regions.brain)
  assert.deepEqual(exposed.chain, [])
})

test('results are deterministic and bounded even with extreme inputs', () => {
  const cases = [
    [Infinity, { co2Ppm: Infinity, sleepHours: -10, radiationMsv: Infinity, microgravity: 5, isolation: 5 }],
    [NaN, { co2Ppm: NaN, sleepHours: Infinity, radiationMsv: -1, microgravity: -1, isolation: NaN, fluidShift: NaN }],
  ]
  for (const [day, inputs] of cases) {
    const state = computeState(day, Object.freeze(inputs), noExercise)
    assert.deepEqual(state, computeState(day, inputs, noExercise))
    assert.deepEqual(Object.keys(state.regions).sort(), ['bones', 'brain', 'eyes', 'heart', 'immune', 'lungs', 'metabolism', 'muscles'])
    const metricIds = new Set(state.metrics.map(({ id }) => id))
    assert.equal(metricIds.size, state.metrics.length)
    for (const { value } of state.metrics) assert.ok(Number.isFinite(value) && value >= 0)
    for (const value of [...Object.values(state.boneDensity), state.fluidShift, state.radiationLevel]) {
      assert.ok(value >= 0 && value <= 1)
    }
    for (const [id, region] of Object.entries(state.regions)) {
      assert.equal(region.id, id)
      assert.ok(region.score >= 0 && region.score <= 100)
      // A region whose only input is missing (lungs without a CO₂ reading) is "no data", not a zero.
      assert.ok(region.noData ? region.metrics.length === 0 && region.status === 'ok' : region.metrics.length > 0)
      assert.ok(region.metrics.every((metricId) => metricIds.has(metricId)))
      if (!region.noData) assert.match(region.advice.at(-1), /NASA HRP.*https:\/\/.*Не медицинская рекомендация/)
    }
  }
})
