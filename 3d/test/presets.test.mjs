import './resolve-ts.mjs'
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

// The app's own store (shared engine store + scene presets), exactly as the dashboard uses it.
const { useHealthStore } = await import('../src/twin/store.ts')
const { buildAlerts } = await import('../src/ui/alerts.ts')
const { gravityThreatLevel, distanceThreatLevel, formatLevel, microgravityIndex } = await import('../../src/engine/index.ts')
const { CHECKIN_METRIC, checkInDefault } = await import('../src/ui/checkIn.ts')
const { THREAT_LEVEL } = await import('../src/twin/config.ts')

const { getState, getInitialState, setState } = useHealthStore
beforeEach(() => setState(getInitialState(), true))

const REGIONS = ['heart', 'brain', 'bones', 'muscles', 'eyes', 'immune', 'lungs', 'metabolism']
const statuses = () => Object.fromEntries(REGIONS.map((id) => [id, getState().regions[id].status]))
const alerts = () => {
  const { regions, alerts, threats, earthLink } = getState()
  return buildAlerts({ regions, alerts, threats, earthLink: earthLink ?? true })
}
const metric = (id) => getState().metrics.find((m) => m.id === id)?.value
const allOk = Object.fromEntries(REGIONS.map((id) => [id, 'ok']))

function assertHealthy(label) {
  assert.deepEqual(statuses(), allOk, `${label}: every region is normal`)
  assert.deepEqual(alerts(), [], `${label}: no alerts`)
  for (const [id, threat] of Object.entries(getState().threats)) {
    assert.ok(threat.level < THREAT_LEVEL.warnAt, `${label}: ${id} threat is low (${threat.level})`)
  }
  for (const region of Object.values(getState().regions)) {
    assert.ok(Number.isFinite(region.score) && region.score >= 80, `${label}: ${region.id} score ${region.score}`)
  }
}

// The strip and the metrics panel read these same fields; they must follow the one definition.
function assertThreatsAgree(label) {
  const { threats, inputs, day, commDelaySec, radiationLevel } = getState()
  assert.equal(threats.gravity.level, gravityThreatLevel(inputs.microgravity, day), `${label}: gravity`)
  assert.equal(threats.distance.level, distanceThreatLevel(commDelaySec), `${label}: distance`)
  assert.equal(threats.radiation.level, radiationLevel, `${label}: radiation`)
  for (const threat of Object.values(threats)) assert.ok(threat.level >= 0 && threat.level <= 1)
}

test('Healthy preset: all regions normal, zero alerts, low threat levels', () => {
  assertHealthy('initial state')
  assert.equal(getState().day, 0)
  getState().setScenario('critical')
  getState().setScenario('healthy')
  assertHealthy('after switching back')
})

test('Healthy preset stays healthy after neutral user actions', () => {
  const actions = {
    'exercise off': (s) => s.setExercise({ aerobic: 0, resistance: 0 }),
    'day 1': (s) => s.setDay(1),
    'day back to 0': (s) => { s.setDay(30); s.setDay(0) },
    'station': (s) => s.setEnvironment('station'),
    'check-in with the shown defaults': (s) =>
      s.setInputs({ vitals: Object.fromEntries(['systolic', 'diastolic', 'heartRate', 'glucose', 'bodyTempC', 'mood'].map((k) => [k, checkInDefault(k, s)])) }),
    'empty check-in': (s) => s.setInputs({ vitals: { systolic: undefined, diastolic: NaN, bodyTempC: 0 } }),
    'lost sensors': (s) => s.setInputs({ co2Ppm: undefined, sleepHours: undefined, radiationMsv: NaN }),
  }
  for (const [label, act] of Object.entries(actions)) {
    setState(getInitialState(), true)
    act(getState())
    assertHealthy(label)
    assertThreatsAgree(label)
  }
})

test('Day 60 preset: only brain is a warning and the user sees four warnings', () => {
  getState().setScenario('day60')
  assert.equal(getState().day, 60)
  assert.deepEqual(statuses(), { ...allOk, brain: 'warning' })
  const list = alerts()
  assert.equal(list.length, 4)
  assert.ok(list.every((a) => a.level === 'warning'))
  assert.deepEqual(list.filter((a) => a.id.startsWith('region_')).map((a) => a.regionId), ['brain'])
  assert.equal(getState().threats.gravity.level, 0.5)
})

const criticalStatuses = {
  ...allOk, brain: 'critical', immune: 'critical', lungs: 'critical', bones: 'warning', eyes: 'warning',
}

test('Critical preset preserves the crisis and exposes the eight current alerts', () => {
  getState().setScenario('critical')
  assert.equal(getState().day, 180)
  assert.equal(getState().activeEvent, 'solar_flare')
  assert.equal(getState().inShelter, true)
  assert.equal(getState().exercise.resistance, 0.6)
  assert.deepEqual(getState().chain, ['lungs', 'brain'])
  assert.deepEqual(statuses(), criticalStatuses)
  const list = alerts()
  assert.equal(list[0].level, 'critical')
  assert.deepEqual(list.map(a => a.id).sort(), [
    'isolation_activity', 'isolation_mood', 'isolation_sleep',
    'region_bones', 'region_brain', 'region_eyes', 'region_immune', 'region_lungs',
  ])
  assert.equal(getState().threats.gravity.level, 1)
  assert.ok(getState().threats.radiation.level >= THREAT_LEVEL.criticalAt)
})

test('Critical reaches six visible alerts with the proposed mood and activity inputs', () => {
  getState().setScenario('critical')
  // Proposed companion edit: the scene preset owns activityMin and the initial
  // scene mood. Exercise completion and isolation activity minutes are separate.
  getState().patch({ mood: 4, activityMin: 115 })
  getState().setInputs({ vitals: { ...getState().inputs.vitals, mood: 4 } })
  assert.deepEqual(statuses(), criticalStatuses)
  assert.equal(alerts().length, 6)
  assert.deepEqual(alerts().filter(a => a.id.startsWith('isolation_')).map(a => a.id), ['isolation_sleep'])
})

test('no preset has a region score of 0 or NaN', () => {
  for (const id of ['healthy', 'day60', 'critical']) {
    getState().setScenario(id)
    for (const region of Object.values(getState().regions)) {
      assert.ok(Number.isFinite(region.score) && region.score > 0, `${id}: ${region.id} score ${region.score}`)
    }
  }
})

test('threat levels agree with the metrics in every preset and after every control', () => {
  for (const id of ['healthy', 'day60', 'critical']) {
    getState().setScenario(id)
    assertThreatsAgree(`${id} loaded`)
    getState().setDay(90)
    assertThreatsAgree(`${id} day 90`)
    assert.equal(getState().threats.gravity.level, 0.75)
    getState().setEnvironment('mars_surface')
    assertThreatsAgree(`${id} on Mars`)
    assert.equal(getState().inputs.microgravity, microgravityIndex(getState().gravityField))
    assert.equal(formatLevel(getState().inputs.microgravity), '62%')
    assert.equal(formatLevel(getState().threats.gravity.level), '47%') // 0.62 x 90 / 120
  }
  // Day 0 in weightlessness: the index is 100%, the accumulated threat is still 0%.
  getState().setScenario('healthy')
  assert.equal(formatLevel(getState().inputs.microgravity), '100%')
  assert.equal(formatLevel(getState().threats.gravity.level), '0%')
})

test('the first check-in with the displayed values keeps metrics, scores and alerts', () => {
  for (const id of ['healthy', 'day60', 'critical']) {
    getState().setScenario(id)
    const state = getState()
    const values = Object.fromEntries(Object.keys(CHECKIN_METRIC).map(key => {
      const precision = key === 'sleepHours' ? 2 : ['glucose', 'bodyTempC'].includes(key) ? 1 : 0
      return [key, Number(checkInDefault(key, state).toFixed(precision))]
    }))
    for (const [key, metricId] of Object.entries(CHECKIN_METRIC)) assert.equal(metric(metricId), values[key], id)
    const initialAlerts = alerts()
    const { sleepHours, ...vitals } = values
    state.setInputs({ sleepHours, vitals: { ...state.inputs.vitals, ...vitals } })
    assert.deepEqual(getState().metrics, state.metrics, id)
    assert.deepEqual(statuses(), Object.fromEntries(Object.values(state.regions).map(r => [r.id, r.status])), id)
    for (const region of Object.values(state.regions)) assert.equal(getState().regions[region.id].score, region.score, id)
    assert.deepEqual(alerts(), initialAlerts, id)
  }
  assert.equal(checkInDefault('sleepHours', getInitialState()), 7.5)
})

test('a genuinely changed first check-in updates the metric, status and visible alert', () => {
  const state = getState()
  state.setInputs({ vitals: { ...state.inputs.vitals, glucose: 8.5 } })
  assert.equal(metric('glucose'), 8.5)
  assert.equal(getState().regions.metabolism.status, 'critical')
  assert.ok(alerts().some(a => a.id === 'region_metabolism' && a.level === 'critical'))
})

test('the reported screen is a real reading, not missing data', () => {
  getState().setInputs({ sleepHours: 6.25, vitals: { systolic: 118, diastolic: 140 } })
  assert.deepEqual([getState().regions.heart.status, getState().regions.heart.score], ['critical', 0])
  assert.deepEqual([getState().regions.immune.status, getState().regions.immune.score], ['critical', 4])
  assert.equal(alerts().length, 4)
  assert.equal(metric('heart_rate'), 64)
  getState().setScenario('healthy') // loading the preset clears the check-in
  assertHealthy('preset reloaded')
})

test('exercise, day and environment preserve the scene data and update the same store used by demo', () => {
  getState().setScenario('critical')
  getState().selectRegion('brain')
  const initial = getState()
  getState().setExercise({ aerobic: 0, resistance: 0 })
  const withoutExercise = getState()
  assert.ok(withoutExercise.boneDensity.pelvis < initial.boneDensity.pelvis)
  assert.ok(withoutExercise.muscleMass < initial.muscleMass)
  assert.ok(metric('heart_rate') > initial.metrics.find(m => m.id === 'heart_rate').value)
  assert.equal(withoutExercise.chain, initial.chain)
  getState().setDay(90)
  getState().setEnvironment('mars_surface')
  const current = getState()
  assert.equal(current.selectedRegion, 'brain')
  assert.equal(current.history, initial.history)
  assert.equal(current.inShelter, true)
  assert.equal(current.activeEvent, 'solar_flare')
  assert.equal(current.baseline, initial.baseline)
  assert.ok(current.inputs.baseline.systolic > 0)
  assert.ok(current.alerts.some(alert => alert.metric === 'sleep'))
  assert.equal(current.regions.brain.escalation, 'crew')
  assert.equal(current.regions.bones.source, 'forecast')
  assert.equal(current.gravityField, 0.38)
  getState().setEarthLink(true)
  assert.equal(getState().regions.brain.escalation, 'ground')
  getState().patch({ inShelter: false })
  getState().setThreatLevel('isolation', 0.9)
  assert.equal(getState().inShelter, false)
  assert.equal(getState().threats.isolation.level, 0.9)
})

test('cabin CO₂ is shown in mmHg against the 2.5 and 3 mmHg limits, ppm is secondary', async () => {
  const { co2Display } = await import('../src/ui/co2.ts')
  const { computeState } = await import('../../src/engine/index.ts')
  assert.deepEqual(co2Display(2500), { mmHg: '1.9', ppm: '2,500 ppm', status: 'ok' })
  assert.equal(co2Display(3200).status, 'ok') // 2.4 mmHg
  assert.equal(co2Display(3300).status, 'warning') // 2.5 mmHg
  assert.equal(co2Display(3950).status, 'critical') // 3.0 mmHg
  // the lungs region uses the same limits
  const lungs = (co2Ppm) => computeState(0, { co2Ppm, sleepHours: 8, radiationMsv: 0, microgravity: 1, isolation: 0 }, { aerobic: 1, resistance: 1 }).regions.lungs.status
  for (const ppm of [2500, 3200, 3300, 3900, 3950, 6800]) assert.equal(lungs(ppm), co2Display(ppm).status, `${ppm} ppm`)
  // presets: the panel and the lungs region agree
  for (const id of ['healthy', 'day60', 'critical']) {
    getState().setScenario(id)
    assert.equal(co2Display(metric('co2_ppm')).status, getState().regions.lungs.status, id)
  }
})
