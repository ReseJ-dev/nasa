import './resolve-ts.mjs'
import assert from 'node:assert/strict'
import { test } from 'node:test'

const { computeState } = await import('../../src/engine/index.ts')
const { simulate } = await import('../../src/engine/index.ts')
const { SCENARIOS } = await import('../src/twin/mockStore.ts')
const { PERSONAL_BASELINE } = await import('../../src/data/baseline.ts')
const { checkInDefault, pressurePairValid } = await import('../src/ui/checkIn.ts')

const exercise = { aerobic: 1, resistance: 1 }
const full = { co2Ppm: 2500, sleepHours: 7.5, radiationMsv: 1, microgravity: 1, isolation: 0, fluidShift: 0.1 }

// Missing data must never look like a bad reading: no score of 0, no NaN, no warning or critical.
function assertNoFalseAlarm(regions, label) {
  for (const region of Object.values(regions)) {
    assert.ok(Number.isFinite(region.score), `${label}: ${region.id} score is ${region.score}`)
    assert.notEqual(region.score, 0, `${label}: ${region.id} score is 0`)
    assert.equal(region.status, 'ok', `${label}: ${region.id} is ${region.status}`)
  }
}

test('engine: a missing input is "no data", never a score of 0 or a critical status', () => {
  const missing = [undefined, null, NaN]
  for (const key of ['co2Ppm', 'sleepHours', 'radiationMsv', 'microgravity', 'isolation', 'fluidShift']) {
    for (const value of missing) {
      const state = computeState(0, { ...full, [key]: value }, exercise)
      assertNoFalseAlarm(state.regions, `${key}=${value}`)
      for (const metric of state.metrics) assert.ok(Number.isFinite(metric.value), `${key}=${value}: ${metric.id}`)
    }
  }
  assertNoFalseAlarm(computeState(0, {}, exercise).regions, 'no inputs at all')
})

test('engine: a missing input has no metric, and a region left without inputs says so', () => {
  const state = computeState(0, { ...full, co2Ppm: undefined, sleepHours: NaN }, exercise)
  const ids = state.metrics.map((m) => m.id)
  assert.equal(ids.includes('co2_ppm'), false)
  assert.equal(ids.includes('sleep_hours'), false) // not "0 h"
  assert.equal(state.regions.lungs.noData, true)
  assert.deepEqual(state.regions.lungs.metrics, [])
  assert.equal(state.regions.brain.noData, undefined) // still has the reaction model
  // the same inputs with the values present are scored as before
  assert.equal(computeState(0, { ...full, sleepHours: 0 }, exercise).regions.brain.status, 'critical')
})

test('engine: empty or broken check-in fields are ignored, real readings still count', () => {
  for (const value of [undefined, null, NaN, 0, -5, Infinity]) {
    const vitals = { systolic: value, diastolic: value, heartRate: value, glucose: value, bodyTempC: value, mood: value, reactionMs: value }
    const state = computeState(0, { ...full, vitals }, exercise)
    assertNoFalseAlarm(state.regions, `vitals=${value}`)
    assert.equal(state.metrics.some((m) => m.id === 'systolic'), false)
  }
  // a baseline with holes does not turn a normal reading into an alarm either
  const holes = computeState(0, { ...full, vitals: { systolic: 118, diastolic: 76 }, baseline: {} }, exercise)
  assertNoFalseAlarm(holes.regions, 'empty baseline')

  // The reported screen: a real diastolic reading of 140 against a baseline of 76 is a true alarm.
  const high = computeState(0, { ...full, sleepHours: 6.25, vitals: { systolic: 118, diastolic: 140 } }, exercise)
  assert.deepEqual([high.regions.heart.status, high.regions.heart.score], ['critical', 0])
  assert.deepEqual([high.regions.immune.status, high.regions.immune.score], ['critical', 4])
  // ...and the region now lists the reading that caused it
  assert.ok(high.regions.immune.metrics.includes('diastolic'))
})

test('reference sim: missing vitals give no NaN score and no alarm', () => {
  const inputs = {
    ...PERSONAL_BASELINE, environment: 'station', missionDay: 0, baseline: PERSONAL_BASELINE,
    co2Level: 0.1, cabinTempC: 22, noiseDb: 55,
  }
  for (const key of Object.keys(PERSONAL_BASELINE)) {
    for (const value of [undefined, NaN]) {
      const out = simulate({ ...inputs, [key]: value })
      assertNoFalseAlarm(out.regions, `sim ${key}=${value}`)
      for (const metric of out.metrics) assert.ok(Number.isFinite(metric.value))
      for (const threat of Object.values(out.threats)) assert.ok(Number.isFinite(threat.level))
    }
  }
  const out = simulate({ ...inputs, glucose: undefined, co2Level: NaN })
  assert.equal(out.regions.metabolism.noData, true)
  assert.equal(out.regions.lungs.noData, true)
  for (const preset of Object.values(SCENARIOS)) {
    for (const region of Object.values(preset.regions)) assert.ok(Number.isFinite(region.score) && !region.noData)
  }
})

test('check-in: defaults fall back to the store value, then the personal baseline; 118/140 is rejected', () => {
  const state = { inputs: full, metrics: [{ id: 'heart_rate', label: '', value: 64, unit: 'bpm' }] }
  assert.equal(checkInDefault('heartRate', state), 64)
  assert.equal(checkInDefault('sleepHours', state), 7.5)
  assert.equal(checkInDefault('systolic', state), PERSONAL_BASELINE.systolic)
  assert.equal(checkInDefault('sleepHours', { ...state, inputs: { ...full, sleepHours: undefined } }), PERSONAL_BASELINE.sleepHours)
  assert.equal(checkInDefault('diastolic', { ...state, inputs: { ...full, vitals: { diastolic: 80 } } }), 80)
  assert.equal(pressurePairValid(118, 76), true)
  assert.equal(pressurePairValid(118, 140), false)
  assert.equal(pressurePairValid(120, 120), false)
})
