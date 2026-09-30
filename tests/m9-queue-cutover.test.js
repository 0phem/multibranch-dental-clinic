import test, { beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as data from '../src/data.js'
import { setClockSource } from '../src/clock.js'
import * as queueApi from '../src/queue-api.js'
import { __resetCsrfCacheForTests, onSessionInvalidated } from '../src/api-client.js'
import { buildServerProjection } from '../src/appointment-projection.js'
import { patientQueueView } from '../src/patient-view.js'
import { isActiveQueue, sessionForRole } from '../src/contracts.js'
import * as logic from '../src/logic.js'
import { serverId } from './support/server-appointments.js'
import { row, world } from './support/mock-server-world.js'

// M9 cutover: Laravel/PostgreSQL is the ONLY queue authority. The queue is anchored to the server Visit; the browser
// holds an in-memory projection only and changes it only through named server commands. Server rules themselves are
// covered by backend/tests/Feature/Queue.

beforeEach(() => setClockSource(() => new Date('2026-09-19T02:08:00Z')))
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const queueRow = (fields = {}) => ({
  id: serverId(7000), status: 'Waiting', priority: 'Normal', priority_reason: null, queue_number: 3, position: 2, revision: 1, clinic_date: '2026-09-19', closed_at: null,
  branch: { id: 'b1', name: 'Branch A' }, dentist: { id: 'd1', name: 'Miguel Reyes' },
  visit: { id: serverId(4000), status: 'Checked In', source: 'appointment', revision: 1, arrived_at: '2026-09-19T10:05:00+08:00' },
  patient: { id: serverId(500), code: 'PAT-0500', name: 'Server Patient' }, service: { id: 'svc1', name: 'Dental Consultation' },
  appointment: { id: serverId(900), code: 'APT-2026-000900', status: 'Checked In', start_time: '11:00' }, ...fields,
})

// ---- mocked fetch ---------------------------------------------------------------------------------------------
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

// ================================================================================================================
// QUEUE CLIENT
// ================================================================================================================
test('mapQueueEntry keeps the real server status; a Served entry displays the Visit phase', () => {
  const waiting = queueApi.mapQueueEntry(queueRow(), id => (id === serverId(500) ? 'p1' : id))
  assert.deepEqual([waiting.id, waiting.queueEntryId, waiting.visitId, waiting.patientId, waiting.appointmentId], [serverId(7000), serverId(7000), serverId(4000), 'p1', serverId(900)])
  assert.deepEqual([waiting.status, waiting.displayStatus, waiting.queueNumber, waiting.position, waiting.checkedIn, waiting.server], ['Waiting', 'Waiting', 3, 2, '10:05', true])
  const served = queueApi.mapQueueEntry(queueRow({ status: 'Served', position: null, visit: { ...queueRow().visit, status: 'In Treatment' } }))
  assert.deepEqual([served.status, served.displayStatus, served.position], ['Served', 'In Treatment', null])
  assert.equal(isActiveQueue(served), false, 'Served closes the queue entry')
})

test('the queue list is today’s server queue; commands send Idempotency-Key + expected_revision and no client status', async () => {
  mockFetch(path => (path.startsWith('/api/queue?') ? json(200, { data: [queueRow()] }) : json(200, { data: queueRow({ status: 'Called', revision: 2 }) })))
  const list = await queueApi.loadQueue('2026-09-19')
  assert.equal(list.ok, true); assert.equal(list.rows.length, 1)
  const entry = queueApi.mapQueueEntry(queueRow())
  await queueApi.transitionQueue(entry, 'call', 'call-1')
  await queueApi.setQueuePriority(entry, 'Urgent', 'Front desk request', 'prio-1')
  const [get, call, priority] = apiCalls()
  assert.equal(get.path, '/api/queue?date=2026-09-19')
  assert.deepEqual([call.method, call.path, call.body, call.headers['Idempotency-Key']], ['POST', `/api/queue/${serverId(7000)}/call`, { expected_revision: 1 }, 'call-1'])
  assert.deepEqual([priority.path, priority.body, priority.headers['Idempotency-Key']], [`/api/queue/${serverId(7000)}/priority`, { expected_revision: 1, priority: 'Urgent', reason: 'Front desk request' }, 'prio-1'])
  for (const c of [call, priority]) assert.equal('status' in c.body || 'position' in c.body || 'queue_number' in c.body, false)
})

test('a Patient reads only /api/queue/mine; 401 and 409 keep the shared failure shape', async () => {
  mockFetch(path => (path === '/api/queue/mine' ? json(401, { message: 'Unauthenticated.' }) : json(409, { message: 'changed', code: 'stale_revision' })))
  const seen = []; unsubscribe = onSessionInvalidated(() => seen.push(1))
  const mine = await queueApi.loadMyQueue()
  assert.equal(mine.kind, 'unauthenticated'); assert.equal(seen.length, 1)
  const stale = await queueApi.transitionQueue(queueApi.mapQueueEntry(queueRow()), 'away', 'k')
  assert.deepEqual([stale.kind, stale.code], ['conflict', 'stale_revision'])
  assert.match(stale.message, /queue entry changed/, 'queue wording, not appointment wording')
  assert.equal(apiCalls()[0].path, '/api/queue/mine', 'no Patient id is ever sent')
})

// ================================================================================================================
// PROJECTION / STORE
// ================================================================================================================
test('the server queue is an in-memory projection; nothing about the queue is persisted or generated in React', () => {
  const projection = buildServerProjection({ queueRows: [queueRow()] })
  assert.equal(projection.queue[0].id, serverId(7000))
  assert.equal(projection.readModelPatients[0].name, 'Server Patient')
  const store = read('src/store.jsx')
  assert.doesNotMatch(store, /usePersist\('queue'/)
  assert.doesNotMatch(store, /INITIAL_QUEUE/)
  assert.equal('INITIAL_QUEUE' in data, false)
  assert.match(store, /const \{appointments:_ignored,visits:_ignoredVisits,queue:_ignoredQueue,myQueue:_ignoredMyQueue,treatments:_ignoredTreatments,hmo:_ignoredHmo,claimDecisions:_ignoredClaimDecisions,\.\.\.patch\}=rawPatch/)
  assert.equal('recalcQueue' in logic, false, 'no browser position authority')
  const workflow = read('src/workflow.js')
  assert.doesNotMatch(workflow, /queueNumber|queueId:`DQ|state\.queue=|admitVisit|updateQueue|recalcQueue/, 'no React queue numbers, ids, writes or commands')
  assert.doesNotMatch(read('src/appointment-flow.js'), /admitVisit|retryAdmit/)
})

// ================================================================================================================
// SERVER-FIRST QUEUE COMMANDS (real appointment-flow.js over the mocked server)
// ================================================================================================================
test('queue commands are server commands followed by a refresh; stale revisions refresh and fail cleanly', async () => {
  const w = world(); const a = w.seed(row())
  await w.flow.checkIn(a.id, 'arrive')
  const entry = w.state.queue[0]
  const called = await w.flow.queueCommand(entry, 'call', 'call-1')
  assert.equal(called.ok, true, called.message)
  assert.deepEqual(w.log.slice(-2).map(x => x[0]), ['queue.call', 'refresh'])
  assert.equal(w.state.queue[0].status, 'Called')
  const stale = await w.flow.queueCommand(entry, 'away', 'away-1') // the revision this client saw is now old
  assert.equal(stale.ok, false); assert.equal(stale.code, 'stale_revision')
  assert.deepEqual(w.log.slice(-2).map(x => x[0]), ['queue.away', 'refresh'])
  const priority = await w.flow.queuePriority(w.state.queue[0], 'Urgent', 'Front desk request', 'prio-1')
  assert.equal(priority.ok, true, priority.message)
  assert.deepEqual([w.state.queue[0].priority, w.state.queue[0].priorityReason], ['Urgent', 'Front desk request'])
  assert.equal(w.patches.length, 0, 'queue commands never write locally')
})

test('the M5 start Serves the server queue entry; the server Treatment carries the server queue id and Visit id', async () => {
  const w = world(); const a = w.seed(row())
  await w.flow.checkIn(a.id, 'arrive')
  const entry = w.state.queue[0]
  w.role('dentist')
  const tooEarly = await w.treat({ queueEntryId: entry.id }, 'In Treatment')
  assert.equal(tooEarly.ok, false, 'a Waiting entry cannot start treatment'); assert.equal(tooEarly.code, 'queue_not_ready', 'the server refuses it')
  assert.equal(w.state.visits[0].status, 'Checked In')
  await w.flow.queueCommand(entry, 'call', 'call-1')
  const started = await w.treat({ queueEntryId: entry.id }, 'In Treatment')
  assert.equal(started.ok, true, started.message)
  assert.deepEqual([w.state.queue[0].status, w.state.queue[0].displayStatus, w.state.visits[0].status, w.state.appointments[0].status], ['Served', 'In Treatment', 'In Treatment', 'In Treatment'])
  assert.deepEqual([w.state.treatments[0].queueEntryId, w.state.treatments[0].visitId], [entry.id, entry.visitId])
  const completed = await w.treat({ queueEntryId: entry.id, procedure: 'Consultation', procedures: [{ serviceId: 'svc1', quantity: 1 }] }, 'Completed')
  assert.equal(completed.ok, true, completed.message)
  assert.deepEqual([w.state.queue[0].status, w.state.queue[0].displayStatus], ['Served', 'Completed'], 'the queue stays Served; the Visit owns Completed')
  assert.equal(w.log.filter(x => x[0] === 'treatment.start').length, 2, 'one refused attempt, one successful start — completion never repeats it')
})

// ================================================================================================================
// PATIENT OWN QUEUE
// ================================================================================================================
test('the Patient view shows only their own server queue state, with no wait estimate', () => {
  const state = { ...buildServerProjection({}), patients: structuredClone(data.INITIAL_PATIENTS), persons: structuredClone(data.INITIAL_PERSONS), users: structuredClone(data.INITIAL_USERS),
    branches: structuredClone(data.INITIAL_BRANCHES), dentists: structuredClone(data.INITIAL_DENTISTS), staff: structuredClone(data.INITIAL_STAFF), services: [], appointments: [], treatments: [], queue: [],
    myQueue: { phase: 'waiting', queue_status: 'Waiting', queue_number: 4, position: 2, clinic_date: '2026-09-19', arrived_at: '2026-09-19T10:05:00+08:00', branch: { name: 'Branch A' }, dentist: { name: 'Miguel Reyes' }, service: { name: 'Dental Consultation' }, appointment: { start_time: '11:00' } } }
  const session = sessionForRole('patient', state)
  const view = patientQueueView(state, session)
  assert.deepEqual([view.phase, view.position, view.queueNumber, view.waitMinutes, view.dentist, view.checkedIn], ['waiting', 2, 4, null, 'Miguel Reyes', '10:05'])
  const checkedIn = patientQueueView({ ...state, myQueue: { ...state.myQueue, phase: 'checked-in', queue_status: null, queue_number: null, position: null } }, session)
  assert.deepEqual([checkedIn.phase, checkedIn.position, checkedIn.queueNumber], ['checked-in', null, null])
  assert.equal(patientQueueView({ ...state, myQueue: null }, session).phase, 'none')
})

// ================================================================================================================
// UI CONTRACT / REFRESH
// ================================================================================================================
test('queue screens use server commands, the non-diagnostic priority label, and a visible-only 30-second refresh', () => {
  const page = read('src/pages/PatientFlow.jsx')
  assert.match(page, /flow\.queueCommand\(entry,name,key\)/)
  assert.match(page, /flow\.queuePriority\(entry,'Urgent',reason\.trim\(\),key\)/)
  assert.match(page, /Urgent queue priority/)
  assert.doesNotMatch(page, /Emergency priority|actions\.updateQueue|Add to queue|retryAdmit/)
  assert.match(page, /useVisibleRefresh\(flow\?\.refresh,\{active:role!=='patient'\}\)/)
  assert.match(read('src/pages/PatientVisits.jsx'), /useVisibleRefresh\(store\.appointmentFlow\?\.refresh,\{active:!!store\.session\}\)/)
  const hook = read('src/use-visible-refresh.js')
  assert.match(hook, /QUEUE_REFRESH_MS = 30000/)
  assert.match(hook, /document\.visibilityState !== 'hidden'/)
  assert.match(hook, /clearInterval\(timer\)/)
  assert.doesNotMatch(hook, /WebSocket|EventSource/)
})
