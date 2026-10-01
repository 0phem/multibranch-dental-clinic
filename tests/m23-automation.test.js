import test from 'node:test'
import assert from 'node:assert/strict'
import { MODULES, INITIAL_AUTOMATIONS, INITIAL_WORKFLOW_LOG } from '../src/data.js'
import { automationSnapshot } from '../src/orchestration.js'
import * as automationApi from '../src/automation-api.js'

test('Module 23 metadata is marked implemented with backend authority note', () => {
  const m23 = MODULES.find(m => m.no === 23)
  assert.ok(m23, 'Module 23 must exist in MODULES registry')
  assert.equal(m23.implemented, true)
  assert.equal(m23.coverage, 'implemented')
  assert.ok(m23.coverageNote.includes('workflow rules'))
  assert.deepEqual(m23.roles, ['owner'])
})

test('INITIAL_AUTOMATIONS provides the 6 protected rules', () => {
  assert.equal(INITIAL_AUTOMATIONS.length, 6)
  const triggers = INITIAL_AUTOMATIONS.map(r => r.triggerEvent)
  assert.ok(triggers.includes('appointment.lifecycle.changed'))
  assert.ok(triggers.includes('hmo.pending.timer.updated'))
  assert.ok(triggers.includes('patientflow.capacity.updated'))
  assert.ok(triggers.includes('clinical.treatment.completed'))
  assert.ok(triggers.includes('communication.message.received'))
  assert.ok(triggers.includes('access.user.changed'))
})

test('automationSnapshot calculates stats deterministically without mutating state', () => {
  const fakeState = {
    automations: structuredClone(INITIAL_AUTOMATIONS),
    workflowLog: structuredClone(INITIAL_WORKFLOW_LOG),
  }
  const before = structuredClone(fakeState)

  const snapshot = automationSnapshot(fakeState)

  assert.equal(snapshot.rules.length, 6)
  assert.ok(typeof snapshot.success === 'number')
  assert.ok(Array.isArray(snapshot.failed))
  assert.ok(Array.isArray(snapshot.warnings))

  // Pure function verification
  assert.deepEqual(fakeState, before)
})

test('automation-api exports all necessary communication functions', () => {
  assert.equal(typeof automationApi.fetchAutomationSnapshot, 'function')
  assert.equal(typeof automationApi.fetchAutomationRules, 'function')
  assert.equal(typeof automationApi.fetchAutomationActions, 'function')
  assert.equal(typeof automationApi.dispatchAutomationRule, 'function')
  assert.equal(typeof automationApi.downloadAutomationCsv, 'function')
})
