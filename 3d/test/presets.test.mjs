import './resolve-ts.mjs'
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

// The app's own store (shared engine store + scene presets), exactly as the dashboard uses it.
const { useHealthStore } = await import('../src/twin/store.ts')
const { buildAlerts } = await import('../src/ui/alerts.ts')
const { gravityThreatLevel, distanceThreatLevel, formatLevel, microgravityIndex } = await import('../src/sim/index.ts')
const { checkInDefault } = await import('../src/ui/checkIn.ts')
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

test('Day 60 preset: bones, muscles and eyes are warnings, the rest normal', () => {
  getState().setScenario('day60')
  assert.equal(getState().day, 60)
  assert.deepEqual(statuses(), { ...allOk, bones: 'warning', muscles: 'warning', eyes: 'warning' })
  const list = alerts()
  assert.ok(list.length > 0 && list.every((a) => a.level === 'warning'))
  assert.deepEqual(list.filter((a) => a.id.startsWith('region_')).map((a) => a.regionId).sort(), ['bones', 'eyes', 'muscles'])
  assert.equal(getState().threats.gravity.level, 0.5)
})

test('Critical preset: brain, bones and lungs are critical, the rest warnings', () => {
  getState().setScenario('critical')
  assert.equal(getState().day, 180)
  assert.deepEqual(statuses(), {
    heart: 'warning', brain: 'critical', bones: 'critical', muscles: 'warning',
    eyes: 'warning', immune: 'warning', lungs: 'critical', metabolism: 'warning',
  })
  const list = alerts()
  assert.equal(list[0].level, 'critical')
  assert.equal(list.filter((a) => a.id.startsWith('region_')).length, 8)
  assert.equal(getState().threats.gravity.level, 1)
  assert.ok(getState().threats.radiation.level >= THREAT_LEVEL.criticalAt)
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

test('check-in defaults are the values the metrics panel shows', () => {
  for (const id of ['healthy', 'day60', 'critical']) {
    getState().setScenario(id)
    const state = getState()
    assert.equal(checkInDefault('heartRate', state), metric('heart_rate'), id)
    assert.equal(checkInDefault('sleepHours', state), metric('sleep_hours'), id)
    assert.equal(checkInDefault('glucose', state), metric('glucose'), id)
  }
  assert.equal(checkInDefault('sleepHours', getInitialState()), 7.5)
})

test('the reported screen is a real reading, not missing data', () => {
  getState().setInputs({ sleepHours: 6.25, vitals: { systolic: 118, diastolic: 140 } })
  assert.deepEqual([getState().regions.heart.status, getState().regions.heart.score], ['critical', 0])
  assert.deepEqual([getState().regions.immune.status, getState().regions.immune.score], ['critical', 19])
  assert.equal(alerts().length, 3)
  assert.equal(metric('heart_rate'), 64)
  getState().setScenario('healthy') // loading the preset clears the check-in
  assertHealthy('preset reloaded')
})
