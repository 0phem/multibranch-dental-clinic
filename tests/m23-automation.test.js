import test from 'node:test'
import assert from 'node:assert/strict'
import { MODULES, INITIAL_AUTOMATIONS, INITIAL_WORKFLOW_LOG } from '../src/data.js'
import { automationSnapshot } from '../src/orchestration.js'
import * as automationApi from '../src/automation-api.js'

test('Module 23 metadata states its real coverage: partial, evaluation-only, not implemented', () => {
  const m23 = MODULES.find(m => m.no === 23)
  assert.ok(m23, 'Module 23 must exist in MODULES registry')
  // Same precedent as M12/M13/M19/M26: real server code exists but the canonical module (execution of approved handoffs) does not.
  assert.equal(m23.implemented, false)
  assert.equal(m23.coverage, 'partial')
  assert.equal(m23.no, 23)
  assert.equal(m23.name, 'Workflow Automation & Exception Management')
  assert.equal(m23.owner, 'Delos Santos, Joevan')
  assert.deepEqual(m23.roles, ['owner'])
  assert.ok(m23.coverageNote.includes('workflow rules'))
  assert.match(m23.coverageNote, /evaluated and recorded only/)
  assert.match(m23.coverageNote, /no business action is executed/)
  assert.doesNotMatch(m23.coverageNote, /automated actions|Backend-authoritative/)
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

import { readFileSync } from 'node:fs'

const adminSource = readFileSync(new URL('../src/pages/Admin.jsx', import.meta.url), 'utf8')
const page = adminSource.slice(adminSource.indexOf('export function AutomationPage'), adminSource.indexOf('export function EngagementPage'))

test('Automation Monitor shows "No data" instead of a fabricated 100% and never labels evaluations as executed actions', () => {
  assert.ok(!/state\.workflowLog\.length \? Math\.round\(\(monitor\.success \/ state\.workflowLog\.length\) \* 100\) : 100/.test(page), 'no 100 default')
  assert.match(page, /rate === null \? 'No data'/)
  assert.ok(!page.includes('Successful recorded actions'))
  assert.ok(!page.includes('Approved workflow rules'))
  assert.match(page, /nothing is executed/)
  assert.match(page, /Proposed action \(not performed by this module\)/)
  assert.match(page, /Evaluation only — no business action was performed/)
})

test('Automation Monitor in a clinic-server session has an explicit unavailable state and no local demo records', () => {
  assert.match(page, /isServerSession && loadError/)
  assert.match(page, /Try again/)
  assert.match(page, /const showLocal = !isServerSession/)
  assert.match(page, /Offline demo preview — local example records, not clinic data/)
})

test('Manual evaluation never sends clinical flags and takes an Owner-typed observation only for R2 and R3', () => {
  assert.ok(!/followup_required|prescription_required/.test(page), 'the page cannot send a clinical flag')
  assert.match(page, /pending_hours/)
  assert.match(page, /estimated_wait_minutes/)
  assert.match(page, /Threshold values shown are unconfirmed demonstration values, not clinic policy/)
})

test('Automation Monitor exceptions come from the server record only in a clinic-server session', () => {
  assert.match(page, /const exceptionsList = serverData \? \(serverData\.recent_exceptions \|\| \[\]\) : \(showLocal \? \[\.\.\.monitor\.failed, \.\.\.monitor\.warnings\] : \[\]\)/)
  assert.ok(!/serverData\?\.recent_exceptions && serverData\.recent_exceptions\.length > 0\)\s*\?/.test(page), 'no fallback from empty server exceptions to local demo entries')
})

test('Automation Monitor header actions are rendered through the PageHeader aside slot', () => {
  const header = page.slice(page.indexOf('kicker="System orchestration"'), page.indexOf('<div className="stats-grid">'))
  assert.match(header, /aside=\{<div/)
  assert.ok(!/\baction=\{/.test(header), 'PageHeader has no `action` prop, so Refresh and Export would never render')
})

test('Automation Monitor labels legacy stored descriptions as proposed actions and states that repeated runs are separate', () => {
  assert.match(page, /summary_kind === 'legacy_proposed_description'/)
  assert.match(page, /Legacy description of a proposed action \(nothing was executed\)/)
  assert.match(page, /this older wording is a proposed action, not evidence that anything was done/)
  assert.match(page, /Each run records a separate evaluation; a repeated run is not de-duplicated\./)
})

test('Automation Monitor requires a whole-number observation within the server limits before it can run R2/R3', () => {
  assert.match(page, /max: 8760/)
  assert.match(page, /max: 1440/)
  assert.match(page, /const observationValid = !observationField \|\| \(\/\^\\d\{1,5\}\$\/\.test\(observation\) && Number\(observation\) <= observationField\.max\)/)
  assert.match(page, /disabled=\{runningRule \|\| !observationValid\}/)
  assert.match(page, /if \(!observationValid\) return/)
  assert.ok(!page.includes("observation === '' ? null"), 'a blank observation is never sent as null')
})
