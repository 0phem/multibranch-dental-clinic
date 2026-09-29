import test, { beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as data from '../src/data.js'
import { setClockSource } from '../src/clock.js'
import { persistableCollection, inScope } from '../src/contracts.js'
import * as api from '../src/appointments-api.js'
import { __resetCsrfCacheForTests } from '../src/api-client.js'
import { buildServerProjection, classifyLegacy, flagLegacy, liveRecords, patientKeyResolver, publicPatientIdFor, splitLegacy } from '../src/appointment-projection.js'
import { serverId } from './support/server-appointments.js'
import { row, world } from './support/mock-server-world.js'

// M6 React cutover: Laravel/PostgreSQL is the only appointment authority. These tests exercise the real frontend client,
// read projection and server-first command flow against a mocked HTTP layer / mocked server.

beforeEach(() => setClockSource(() => new Date('2026-09-19T02:08:00Z')))
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

// ---- a server row as GET /api/appointments returns it: `row` from tests/support/mock-server-world.js ------------

// ---- mocked fetch ---------------------------------------------------------------------------------------------
let calls = []
let oldFetch
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
function mockFetch(handler) {
  oldFetch = globalThis.fetch
  calls = []
  globalThis.fetch = async (url, options = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '')
    calls.push({ path, options })
    if (path === '/sanctum/csrf-cookie') return new Response(null, { status: 204 })
    return handler(path, options)
  }
}
afterEach(() => { if (oldFetch) globalThis.fetch = oldFetch; oldFetch = null; __resetCsrfCacheForTests() })

// ================================================================================================================
// API CLIENT
// ================================================================================================================
test('the list loader pages through a bounded range and never asks for "everything"', async () => {
  mockFetch(path => {
    const page = Number(new URL(`http://x${path}`).searchParams.get('page'))
    return json(200, { data: [row({ id: serverId(page), code: `APT-2026-00000${page}` })], meta: { current_page: page, last_page: 3 } })
  })
  const result = await api.loadAppointments('2026-09-19')
  assert.equal(result.ok, true)
  assert.equal(result.rows.length, 3)
  assert.equal(result.truncated, false)
  const first = new URL(`http://x${calls[0].path}`).searchParams
  assert.equal(first.get('from'), '2026-06-21'); assert.equal(first.get('to'), '2026-12-21'); assert.equal(first.get('per_page'), '100')
})

test('409 conflicts and 422 schedule refusals keep their machine-readable codes and alternatives', async () => {
  mockFetch(path => (path.includes('/cancel')
    ? json(409, { message: 'stale', code: 'stale_revision' })
    : json(422, { message: 'The requested time cannot be booked.', code: 'schedule_invalid', errors: { schedule: ['No overlapping dentist appointment'] }, failed_checks: ['overlap'], alternatives: ['12:00', '13:00'] })))
  const created = await api.createAppointment({ branchId: 'b1', serviceId: 'svc1', date: '2026-09-20', start: '11:00' }, 'key-1')
  assert.deepEqual([created.ok, created.kind, created.code], [false, 'validation', 'schedule_invalid'])
  assert.deepEqual(created.failedChecks, ['overlap']); assert.deepEqual(created.alternatives, ['12:00', '13:00'])
  assert.match(created.message, /No overlapping dentist appointment/)
  const cancelled = await api.cancelAppointment({ id: serverId(1), revision: 3 }, 'key-2')
  assert.deepEqual([cancelled.ok, cancelled.kind, cancelled.code], [false, 'conflict', 'stale_revision'])
  assert.match(cancelled.message, /changed since you opened it/)
})

test('a lost race reads as "That time was just taken"', () => {
  assert.equal(api.normalizeFailure({ kind: 'conflict', code: 'schedule_conflict' }).message, 'That time was just taken. Choose another time.')
})

test('commands send the Idempotency-Key and the server revision; Patients never send a Patient or Dentist id', async () => {
  mockFetch(() => json(201, { data: row() }))
  await api.createAppointment({ branchId: 'b1', serviceId: 'svc1', date: '2026-09-20', start: '11:00' }, 'confirm-attempt-1')
  const create = calls.find(c => c.path === '/api/appointments')
  assert.equal(create.options.headers['Idempotency-Key'], 'confirm-attempt-1')
  assert.deepEqual(JSON.parse(create.options.body), { branch_ref: 'b1', service_ref: 'svc1', date: '2026-09-20', start_time: '11:00' })

  await api.createAppointment({ branchId: 'b1', serviceId: 'svc1', date: '2026-09-20', start: '11:30', patientPublicId: serverId(500), dentistId: 'd2' }, 'staff-1')
  assert.deepEqual(JSON.parse(calls.filter(c => c.path === '/api/appointments').at(-1).options.body), { branch_ref: 'b1', service_ref: 'svc1', date: '2026-09-20', start_time: '11:30', patient_id: serverId(500), dentist_ref: 'd2' })

  await api.transitionAppointment({ id: serverId(7), revision: 4 }, 'check-in', 'k-3')
  const transition = calls.find(c => c.path === `/api/appointments/${serverId(7)}/check-in`)
  assert.deepEqual(JSON.parse(transition.options.body), { expected_revision: 4 })
  assert.equal(transition.options.headers['Idempotency-Key'], 'k-3')
})

test('mapAppointment exposes the server code and public ids; React never generates an appointment number', () => {
  const mapped = api.mapAppointment(row())
  assert.equal(mapped.appointmentNo, 'APT-2026-000900')
  assert.equal(mapped.patientPublicId, serverId(500))
  assert.deepEqual([mapped.branchId, mapped.serviceId, mapped.dentistId, mapped.start, mapped.duration, mapped.revision, mapped.server], ['b1', 'svc1', 'd1', '11:00', 30, 1, true])
  for (const path of ['src/workflow.js', 'src/pages/Scheduling.jsx', 'src/pages/PatientBook.jsx', 'src/appointment-flow.js', 'src/store.jsx'])
    assert.doesNotMatch(read(path), /`APT-\$\{/, `${path} builds no appointment number`)
})

// ================================================================================================================
// READ PROJECTION + PATIENT IDENTITY
// ================================================================================================================
test('a Patient\'s own server appointments map to their session Patient; others keep the server public id', () => {
  const session = { role: 'patient', patientId: 'p1', patientPublicId: serverId(500) }
  const key = patientKeyResolver({ session, users: [], patients: [] })
  assert.equal(key(serverId(500)), 'p1')
  assert.equal(key(serverId(501)), serverId(501))
  // A bridged local projection is reused only through the server-provided backendPatientId link — never by email.
  const linked = patientKeyResolver({ session: null, users: [{ id: 'u-x', backendPatientId: serverId(502), login: 'same@example.test' }], patients: [{ id: 'p-local', userId: 'u-x' }] })
  assert.equal(linked(serverId(502)), 'p-local')
  assert.equal(linked(serverId(503)), serverId(503))
})

test('server Patients without a local projection become read-model Patients that are never persisted', () => {
  const projection = buildServerProjection({ rows: [row()], directory: [{ id: serverId(600), patientCode: 'PAT-0600', name: 'Directory Patient' }] })
  assert.deepEqual(projection.readModelPatients.map(p => [p.id, p.patientCode, p.serverProjection]), [[serverId(500), 'PAT-0500', true], [serverId(600), 'PAT-0600', true]])
  assert.equal(projection.appointments[0].patientId, serverId(500))
  const stored = persistableCollection('patients', [{ id: 'p1', personId: 'per-p1' }, ...projection.readModelPatients])
  assert.deepEqual(stored.map(p => p.id), ['p1'])
  assert.equal(publicPatientIdFor(serverId(600), { patients: projection.readModelPatients }), serverId(600))
  assert.equal(publicPatientIdFor('p2', { patients: [{ id: 'p2' }], users: [] }), null, 'a legacy-only local Patient has no server identity')
})

test('Staff branch reach follows server authorization scopes (multi-branch, empty, and fixture fallback)', () => {
  const record = b => ({ branchId: b })
  const base = { role: 'staff', active: true, branchId: 'b1' }
  assert.equal(inScope(record('b2'), { ...base, branchScopes: ['b1', 'b2'] }), true)
  assert.equal(inScope(record('b3'), { ...base, branchScopes: ['b1', 'b2'] }), false)
  assert.equal(inScope(record('b1'), { ...base, branchScopes: [] }), false, 'no server scope means no branch, whatever the work assignment')
  assert.equal(inScope(record('b1'), base), true, 'fixture sessions without server scopes keep the local rule')
})

// ================================================================================================================
// LEGACY HISTORY (D5)
// ================================================================================================================
test('pre-cutover records are legacy history: out of live queue/check-ins, flagged elsewhere, excluded from live KPIs', () => {
  assert.equal(api.isServerId(serverId(1)), true)
  assert.equal(api.isLegacyAppointmentRef('a1'), true)
  assert.equal(api.isLegacyAppointmentRef(null), false, 'a walk-in has no appointment and is not legacy')
  const queue = splitLegacy(data.INITIAL_QUEUE)
  assert.ok(queue.legacy.length > 0, 'seeded queue entries referencing former demo appointments are legacy')
  assert.ok(queue.live.every(q => !q.appointmentId), 'only walk-ins stay live')
  const invoices = flagLegacy([{ id: 'i1', appointmentId: 'a1', status: 'Paid', total: 500 }, { id: 'i2', appointmentId: serverId(2), status: 'Paid', total: 700 }])
  assert.deepEqual(liveRecords(invoices).map(i => i.id), ['i2'])
  assert.equal(persistableCollection('invoices', invoices)[0].legacyAppointment, undefined, 'the derived flag is never stored')
  assert.match(read('src/pages/Dashboards.jsx'), /liveRecords\(state\.invoices\)/)
  assert.match(read('src/pages/Admin.jsx'), /liveRecords\(state\.invoices\)/)
})

test('legacy classification follows links: invoices, prescriptions, follow-ups and HMO of legacy treatments are legacy too', () => {
  const c = classifyLegacy({ queue: structuredClone(data.INITIAL_QUEUE), treatments: structuredClone(data.INITIAL_TREATMENTS), invoices: structuredClone(data.INITIAL_INVOICES),
    prescriptions: structuredClone(data.INITIAL_PRESCRIPTIONS), followups: structuredClone(data.INITIAL_FOLLOWUPS), hmo: structuredClone(data.INITIAL_HMO) })
  assert.ok(c.treatments.every(t => t.legacyAppointment), 'every seeded treatment belongs to the former demo appointments')
  for (const key of ['invoices', 'prescriptions', 'followups']) {
    const linked = c[key].filter(r => r.treatmentId)
    assert.ok(linked.length > 0 && linked.every(r => r.legacyAppointment), key)
  }
  const paidLive = liveRecords(c.invoices).filter(i => i.status === 'Paid')
  assert.deepEqual(paidLive, [], 'no legacy paid invoice reaches live revenue')
  // A live record linked to a server appointment is untouched.
  const live = classifyLegacy({ treatments: [{ id: 't-live', appointmentId: serverId(3) }], invoices: [{ id: 'i-live', treatmentId: 't-live' }] })
  assert.equal(live.invoices[0].legacyAppointment, undefined)
})

test('old browser appointment data is not uploaded, read or cleared', () => {
  const store = read('src/store.jsx')
  assert.doesNotMatch(store, /usePersist\('appointments'/)
  assert.doesNotMatch(store, /INITIAL_APPOINTMENTS/)
  assert.equal('INITIAL_APPOINTMENTS' in data, false)
  assert.doesNotMatch(store, /localStorage\.removeItem/)
  // The only appointment/Visit writes are server commands: the store strips any local `appointments`/`visits` patch.
  assert.match(store, /const \{appointments:_ignored,visits:_ignoredVisits,\.\.\.patch\}=rawPatch/)
  for (const path of ['src/workflow.js', 'src/hmo.js', 'src/communication.js', 'src/phase2.js', 'src/booking-drafts.js'])
    assert.doesNotMatch(read(path), /state\.appointments=/, `${path} never writes appointments`)
})

// ================================================================================================================
// SERVER-FIRST FLOWS (real appointment-flow.js with a mocked server — tests/support/mock-server-world.js)
// ================================================================================================================
test('Check-In opens the server Visit first (atomically with the appointment), then the local queue entry', async () => {
  const w = world(); const a = w.seed(row())
  const result = await w.flow.checkIn(a.id, 'arrive-1')
  assert.equal(result.ok, true, result.message)
  assert.deepEqual(w.log.map(x => x[0]), ['check-in', 'refresh'])
  assert.equal(w.state.appointments[0].status, 'Checked In')
  const visit = w.state.visits[0]
  assert.equal(visit.appointmentId, a.id)
  assert.equal(w.state.queue[0].visitId, visit.id, 'the queue references the server Visit public id')
  assert.equal(w.state.queue[0].appointmentId, a.id, 'the appointment id stays only as derived compatibility data')
  assert.equal(w.state.queue[0].arrivedAt, visit.arrivedAt, 'arrival time comes from the server Visit')
  assert.equal('checkIns' in w.state, false, 'no browser check-in collection exists')
})

test('a Check-In whose local queue step would fail never reaches the server', async () => {
  const w = world(); const a = w.seed(row({ branch: { id: 'b2', name: 'Branch B' }, dentist: { id: 'd3', name: 'Dr' } }))
  const result = await w.flow.checkIn(a.id, 'k') // outside the Staff member's branch
  assert.equal(result.ok, false)
  assert.deepEqual(w.log, [], 'no server command was sent')
})

test('a tomorrow appointment is refused before any server command', async () => {
  const w = world(); const a = w.seed(row({ date: '2026-09-20', starts_at: '2026-09-20T11:00:00+08:00' }))
  const result = await w.flow.checkIn(a.id, 'k')
  assert.equal(result.ok, false)
  assert.deepEqual(w.log, [])
  assert.deepEqual([w.state.visits.length, w.state.queue.length], [0, 0])
})

test('a server refusal (already checked in from another browser) refreshes and creates no local queue record', async () => {
  const w = world(); const a = w.seed(row())
  // Another Staff session checked the patient in; this browser's projection has not refreshed yet.
  w.visits.set(serverId(899999), { id: serverId(899999), source: 'appointment', status: 'Checked In', revision: 1, arrived_at: '2026-09-19T10:05:00+08:00', clinic_date: '2026-09-19',
    patient: w.server.get(a.id).patient, branch: { id: 'b1', name: '' }, dentist: { id: 'd1', name: '' }, service: null, appointment: { id: a.id, code: a.appointmentNo, status: 'Checked In', revision: 2 } })
  const result = await w.flow.checkIn(a.id, 'k')
  assert.equal(result.ok, false); assert.equal(result.code, 'visit_exists')
  assert.deepEqual(w.log.map(x => x[0]), ['check-in', 'refresh'])
  assert.equal(w.state.queue.length, 0, 'the other browser owns that queue entry; nothing is created here')
  assert.equal(w.state.visits.length, 1, 'the refreshed projection now shows the existing Visit')
})

test('treatment start/completion run the Visit command first and cascade to the appointment; context resolves by public id', async () => {
  const w = world(); const a = w.seed(row())
  await w.flow.checkIn(a.id, 'k')
  const q = w.state.queue[0]
  w.role('dentist'); assert.equal(w.actions.updateQueue(q.id, 'Called').ok, true)
  const started = await w.flow.treatment({ queueEntryId: q.id }, 'In Treatment')
  assert.equal(started.ok, true, started.message)
  const completed = await w.flow.treatment({ queueEntryId: q.id, procedure: 'Consultation', procedures: [{ serviceId: 'svc1', quantity: 1 }] }, 'Completed')
  assert.equal(completed.ok, true, completed.message)
  assert.deepEqual(w.log.filter(x => x[0] !== 'refresh').map(x => x[0]), ['check-in', 'start-treatment', 'complete'])
  assert.equal(w.state.visits[0].status, 'Completed')
  assert.equal(w.state.appointments[0].status, 'Completed')
  assert.equal(w.state.treatments[0].appointmentId, a.id)
  assert.equal(w.state.treatments[0].visitId, q.visitId, 'the treatment carries the Visit from its exact queue entry')
  assert.equal(w.state.invoices[0].appointmentId, a.id, 'billing keeps the exact server appointment link')
  assert.equal(w.state.invoices[0].visitId, q.visitId)
})

test('No-show is a pre-arrival appointment command; a checked-in visit cannot be marked No-show', async () => {
  const w = world(); const a = w.seed(row())
  const noShow = await w.flow.noShow(w.state.appointments[0], 'n-1')
  assert.equal(noShow.ok, true, noShow.message)
  assert.equal(w.state.appointments[0].status, 'No-show')
  assert.deepEqual([w.state.visits.length, w.state.queue.length], [0, 0], 'no Visit is created')

  const w2 = world(); const b = w2.seed(row())
  await w2.flow.checkIn(b.id, 'k')
  const refused = await w2.flow.noShow(w2.state.appointments[0], 'n-2')
  assert.equal(refused.ok, false)
  const local = w2.actions.updateQueue(w2.state.queue[0].id, 'No-show')
  assert.equal(local.ok, false); assert.match(local.message, /can’t be marked No-show/)
  assert.equal(w2.state.queue[0].status, 'Waiting')
})

test('a stale reschedule refreshes and asks the user to review; nothing is silently retried', async () => {
  const w = world(); const a = w.seed(row())
  w.server.set(a.id, { ...w.server.get(a.id), revision: 2 }) // another user changed it
  const result = await w.flow.reschedule(a, { date: '2026-09-21', start: '10:00' }, 'k')
  assert.equal(result.ok, false); assert.equal(result.code, 'stale_revision')
  assert.deepEqual(w.log.map(x => x[0]), ['reschedule', 'refresh'])
  assert.equal(w.state.appointments[0].revision, 2, 'the projection now shows the newer server revision')
})

test('follow-up booking creates a server appointment and stores only its public id on the follow-up', async () => {
  const w = world(); const a = w.seed(row())
  await w.flow.checkIn(a.id, 'k')
  const q = w.state.queue[0]
  w.role('dentist'); w.actions.updateQueue(q.id, 'Called')
  await w.flow.treatment({ queueEntryId: q.id }, 'In Treatment')
  await w.flow.treatment({ queueEntryId: q.id, procedure: 'Consultation', procedures: [{ serviceId: 'svc1', quantity: 1 }], followupRequired: true }, 'Completed')
  const followup = w.state.followups[0]
  w.role('staff')
  const before = w.state.appointments.length
  const booked = await w.flow.create({ branchId: 'b1', serviceId: 'svc1', date: '2026-09-26', start: '10:00', patientPublicId: serverId(500), dentistId: 'd1' }, { key: 'f-1', followupId: followup.id })
  assert.equal(booked.ok, true, booked.message); assert.equal(booked.warning, '')
  assert.equal(w.state.appointments.length, before + 1, 'the only new appointment is the server one')
  assert.equal(w.state.followups[0].appointmentId, booked.record.id)
  assert.equal(w.state.followups[0].status, 'Scheduled')
})

test('cancellation runs on the server first and is refused once the patient has checked in', async () => {
  const w = world(); const a = w.seed(row())
  const result = await w.flow.cancel(w.state.appointments[0], 'c-1')
  assert.equal(result.ok, true, result.message)
  assert.equal(w.state.appointments[0].status, 'Cancelled')

  const w2 = world(); const b = w2.seed(row())
  await w2.flow.checkIn(b.id, 'k')
  const refused = await w2.flow.cancel(w2.state.appointments[0], 'c-2')
  assert.equal(refused.ok, false); assert.equal(refused.code, 'appointment_admitted')
  assert.equal(w2.state.queue[0].status, 'Waiting', 'the admitted encounter is untouched')
})
