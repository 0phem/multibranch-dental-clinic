import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import * as hmoApi from '../src/hmo-api.js'
import { __resetCsrfCacheForTests, onSessionInvalidated } from '../src/api-client.js'
import { buildServerProjection, classifyLegacy, liveRecords } from '../src/appointment-projection.js'
import { persistableCollection } from '../src/contracts.js'
import * as data from '../src/data.js'

// Minimal M12: memberships, Visit-anchored cases, lifecycle and the financial gate are server-authoritative
// (backend/tests/Feature/Hmo). These tests cover the real client, the in-memory projection and the removed browser authority.

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const caseRow = (fields = {}) => ({
  id: '01jhmo0000000000000000000a', status: 'Pending', revision: 5, submission_cycle: 1, provider_name: 'Insurer One', member_number: 'M-000123',
  visit: { id: '01jvisit000000000000000000a', clinic_date: '2026-09-19', status: 'Completed' }, patient: { id: '01jpatient00000000000000000', code: 'PAT-0500', name: 'Server Patient' },
  branch: { id: 'b1', name: 'Branch A' }, dentist: { id: 'd1', name: 'Miguel Reyes' }, appointment: { id: '01jappt0000000000000000000a', code: 'APT-2026-000900' },
  submitted_at: '2026-09-19T09:00:00+08:00', follow_up_due_at: '2026-09-19T21:00:00+08:00', escalated_at: null, final_at: null, approved_amount: null, created_at: '2026-09-19T08:00:00+08:00',
  requirements: [{ rule: 'hmo-card', label: 'HMO Card', state: 'Validated', document_label: 'Card', validated_at: '2026-09-19T08:30:00+08:00' }],
  events: [
    { kind: 'submission', submission_cycle: 1, to_status: 'Pending', method: 'Portal', note: 'sent', occurred_at: '2026-09-19T09:00:00+08:00', actor: { role: 'staff', name: 'Alyssa Cruz' } },
    { kind: 'contact', submission_cycle: 1, to_status: 'Pending', method: 'Phone', note: 'left message', next_action: 'call back', occurred_at: '2026-09-19T22:00:00+08:00', actor: { role: 'staff', name: 'Alyssa Cruz' } },
  ],
  ...fields,
})

let calls = []
let oldFetch
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
function mockFetch(handler) {
  oldFetch = globalThis.fetch
  calls = []
  globalThis.fetch = async (url, options = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '')
    calls.push({ path, method: (options.method || 'GET').toUpperCase(), headers: options.headers || {}, body: options.body ? JSON.parse(options.body) : null })
    if (path === '/sanctum/csrf-cookie') return new Response(null, { status: 204 })
    return handler(path, options)
  }
}
let unsubscribe = null
afterEach(() => { if (oldFetch) globalThis.fetch = oldFetch; oldFetch = null; unsubscribe?.(); unsubscribe = null; __resetCsrfCacheForTests() })
const apiCalls = () => calls.filter(c => c.path !== '/sanctum/csrf-cookie')

test('server cases map to a read model with history-derived responses and contacts, public ids only', () => {
  const h = hmoApi.mapHmoCase(caseRow(), id => (id === '01jpatient00000000000000000' ? 'p1' : id))
  assert.deepEqual([h.id, h.server, h.patientId, h.visitId, h.status, h.revision, h.submissionCycle, h.providerName, h.memberId], ['01jhmo0000000000000000000a', true, 'p1', '01jvisit000000000000000000a', 'Pending', 5, 1, 'Insurer One', 'M-000123'])
  assert.equal(h.requirements[0].state, 'Validated locally')
  assert.deepEqual(h.contacts.map(c => [c.method, c.nextAction]), [['Phone', 'call back']])
  assert.equal(h.followUpDueAt, '2026-09-19T21:00:00+08:00')
  assert.equal(h.summaryOnly, false)
  const { events, member_number, ...dentistView } = caseRow()
  assert.equal(hmoApi.mapHmoCase(dentistView).summaryOnly, true)
})

test('the Patient subset carries no notes, contacts, recorders or history', () => {
  const p = hmoApi.mapPatientHmoCase({ id: 'c', status: 'Approved', provider_name: 'Insurer One', member_number: '••••0123', visit_date: '2026-09-19', appointment: { id: 'a', code: 'APT-1' }, branch: { name: 'Branch A' }, requirements: [], submitted_at: null, final_at: '2026-09-19T11:00:00+08:00', approved_amount: '1200.00' }, 'p1')
  assert.deepEqual([p.patientSubset, p.patientId, p.approvedAmount, p.memberId], [true, 'p1', '1200.00', '••••0123'])
  assert.deepEqual([p.responses, p.contacts, p.events], [[], [], []])
})

test('commands send named requests with an Idempotency-Key and expected_revision; amounts stay decimal text', async () => {
  mockFetch(() => json(200, { data: caseRow() }))
  const h = hmoApi.mapHmoCase(caseRow())
  await hmoApi.openCase('01jvisit000000000000000000a', 'open-1')
  await hmoApi.recordSelfPay('01jvisit000000000000000000a', 'Patient pays directly', 'sp-1')
  await hmoApi.validateRequirement(h, 'valid-id', 'ID copy', 'req-1')
  await hmoApi.submitCase(h, { method: 'Portal', note: 'sent' }, 'sub-1')
  await hmoApi.recordContact(h, { method: 'Phone', note: 'n', nextAction: 'x' }, 'con-1')
  await hmoApi.escalateCase(h, 'esc-1')
  await hmoApi.recordResponse(h, { outcome: 'Approved', method: 'Email', note: 'LOA', providerReference: ' LOA-7 ', approvedAmount: ' 1200.00 ' }, 'res-1')
  await hmoApi.recordResponse(h, { outcome: 'Returned', method: 'Email', note: 'fix', returnedRequirements: ['valid-id'], approvedAmount: '99' }, 'res-2')
  await hmoApi.withdrawCase(h, 'No claim', 'wd-1')
  const c = apiCalls()
  assert.deepEqual(c.map(x => [x.method, x.path, x.headers['Idempotency-Key']]), [
    ['POST', '/api/visits/01jvisit000000000000000000a/hmo-case', 'open-1'],
    ['POST', '/api/visits/01jvisit000000000000000000a/hmo/self-pay', 'sp-1'],
    ['POST', '/api/hmo-cases/01jhmo0000000000000000000a/requirements/valid-id', 'req-1'],
    ['POST', '/api/hmo-cases/01jhmo0000000000000000000a/submit', 'sub-1'],
    ['POST', '/api/hmo-cases/01jhmo0000000000000000000a/contact', 'con-1'],
    ['POST', '/api/hmo-cases/01jhmo0000000000000000000a/escalate', 'esc-1'],
    ['POST', '/api/hmo-cases/01jhmo0000000000000000000a/response', 'res-1'],
    ['POST', '/api/hmo-cases/01jhmo0000000000000000000a/response', 'res-2'],
    ['POST', '/api/hmo-cases/01jhmo0000000000000000000a/withdraw', 'wd-1'],
  ])
  for (const call of c.slice(2)) assert.equal(call.body.expected_revision, 5)
  assert.deepEqual(c[6].body, { expected_revision: 5, submission_cycle: 1, outcome: 'Approved', method: 'Email', note: 'LOA', provider_reference: 'LOA-7', approved_amount: '1200.00' })
  assert.deepEqual(c[7].body, { expected_revision: 5, submission_cycle: 1, outcome: 'Returned', method: 'Email', note: 'fix', returned_requirements: ['valid-id'] }, 'no amount on a return')
  assert.deepEqual(c[1].body, { reason: 'Patient pays directly' })
  for (const call of c) for (const field of ['status', 'patient_id', 'final_at', 'source']) assert.equal(field in (call.body || {}), false, field)
})

test('membership changes go through a server Visit context (no Patient id sent) with an expected active id; Patients read only /mine', async () => {
  mockFetch(path => (path.includes('/mine') ? json(200, { data: [] }) : json(200, { data: { patient: { id: '01jpatient00000000000000000' }, active: null, history: [] } })))
  await hmoApi.setMembership('01jvisit0000000000000000000', { providerName: 'Insurer One', memberNumber: 'M-1', expectedActiveId: null }, 'm-1')
  await hmoApi.endMembership('01jvisit0000000000000000000', '01jmember00000000000000000a', 'm-2')
  await hmoApi.loadMyHmoCases()
  const [set, end, mine] = apiCalls()
  assert.deepEqual([set.path, set.body], ['/api/visits/01jvisit0000000000000000000/hmo-membership', { provider_name: 'Insurer One', member_number: 'M-1', expected_active_id: null }])
  assert.deepEqual([end.path, end.body], ['/api/visits/01jvisit0000000000000000000/hmo-membership/end', { expected_active_id: '01jmember00000000000000000a' }])
  assert.equal(mine.path, '/api/hmo-cases/mine', 'no Patient id parameter is ever sent')
})

test('M12 refusals keep their codes with HMO wording; a 401 reaches the shared session path', async () => {
  mockFetch(path => (path.endsWith('/submit') ? json(409, { message: 'changed', code: 'stale_revision' }) : path.endsWith('/hmo-case') ? json(409, { message: 'exists', code: 'hmo_case_exists' }) : json(401, { message: 'Unauthenticated.' })))
  const seen = []; unsubscribe = onSessionInvalidated(() => seen.push(1))
  const stale = await hmoApi.submitCase(hmoApi.mapHmoCase(caseRow()), { method: 'Portal', note: 'x' }, 'k')
  assert.deepEqual([stale.kind, stale.code], ['conflict', 'stale_revision']); assert.match(stale.message, /HMO case changed/)
  assert.match((await hmoApi.openCase('v', 'k2')).message, /already has an HMO case or a self-pay decision/)
  const expired = await hmoApi.loadHmoCases('2026-09-19')
  assert.equal(expired.kind, 'unauthenticated'); assert.equal(seen.length, 1)
})

test('server cases are an in-memory projection; browser HMO records are read-only history, never live', () => {
  const projection = buildServerProjection({ hmoRows: [caseRow()], claimDecisionRows: [{ visit: { id: 'v2', clinic_date: '2026-09-19' }, patient: { id: 'x', name: 'Other' }, branch: { id: 'b1', name: 'Branch A' } }] })
  assert.equal(projection.hmo[0].server, true)
  assert.equal(projection.claimDecisions[0].visitId, 'v2')
  assert.equal(persistableCollection('hmo', projection.hmo).length, 0, 'server cases are never stored')
  const { hmo } = classifyLegacy({ hmo: structuredClone(data.INITIAL_HMO) })
  assert.ok(hmo.every(h => h.legacy && h.legacyAppointment && h.preServer && h.server === false))
  assert.equal(liveRecords(hmo).length, 0, 'browser HMO history never feeds live views or KPIs')
  const store = read('src/store.jsx')
  assert.doesNotMatch(store, /usePersist\('hmo'/)
  assert.match(store, /hmo:_ignoredHmo,claimDecisions:_ignoredClaimDecisions,\.\.\.patch\}=rawPatch/)
  assert.doesNotMatch(store, /evaluateHmoTimers/, 'no browser HMO follow-up timer')
})

test('no browser HMO authority remains', () => {
  assert.equal(existsSync(new URL('../src/hmo.js', import.meta.url)), false, 'local HMO commands and the treatment handoff are deleted')
  const workflow = read('src/workflow.js')
  assert.doesNotMatch(workflow, /hmoActions|prepareHmoCase|createHmoCase|state\.hmo=/)
  assert.doesNotMatch(read('src/administration.js'), /'hmo','hmoMember'/, 'the browser Patient record no longer edits HMO membership')
  for (const path of ['src/phase2.js', 'src/communication.js', 'src/loyalty.js', 'src/booking-drafts.js']) assert.doesNotMatch(read(path), /state\.hmo\s*=/, path)
  // The server gate decides whether money may be taken; the browser holds no gate or settlement hold.
  for (const path of ['src/phase2.js', 'src/workflow.js', 'src/pages/FinanceCommunication.jsx']) assert.doesNotMatch(read(path), /blocks_payment|HmoFinancialGate|hmoGate/, path)
  assert.doesNotMatch(read('src/pages/Hmo.jsx'), /type="file"|localStorage/, 'no document upload and no browser storage in the HMO workspace')
})

test('a Withdrawn (self-pay) case needs no action even though its requirements were never checked', async () => {
  const { getHmoAttention, hmoCasesForView } = await import('../src/hmo-presentation.js')
  const now = { timestamp: '2026-09-30T12:00:00+08:00' }
  const withdrawn = { id: 'c1', server: true, status: 'Withdrawn', submissionCycle: 0, requirements: [{ state: 'Missing' }, { state: 'Missing' }] }
  const open = { ...withdrawn, id: 'c2', status: 'Missing Requirements' }
  assert.deepEqual(getHmoAttention(withdrawn, now), { label: 'Withdrawn — self-pay', needsAction: false, followUp: false, elapsed: null })
  assert.deepEqual(hmoCasesForView([withdrawn, open], 'action', now).map(h => h.id), ['c2'])
})
