import test, { beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as data from '../src/data.js'
import { setClockSource } from '../src/clock.js'
import { normalizeClinicState, sessionForRole } from '../src/contracts.js'
import { createWorkflowActions } from '../src/workflow.js'
import * as api from '../src/appointments-api.js'
import { __resetCsrfCacheForTests, onSessionInvalidated, sessionStillValid } from '../src/api-client.js'
import { createAppointmentFlow } from '../src/appointment-flow.js'
import { patientAttention } from '../src/patient-view.js'
import { serverId } from './support/server-appointments.js'

// M6 cutover final hardening: the transitional follow-up rule (Dentist recommends, clinic Staff schedule), the shared
// expired-session path for M6 calls, and the bounded appointment window never presented as all-time data.

beforeEach(() => setClockSource(() => new Date('2026-09-19T02:08:00Z')))
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const row = (fields = {}) => ({
  id: fields.id || serverId(900), code: fields.code || 'APT-2026-000900', status: 'Confirmed', source: 'front_desk', assignment_method: 'auto', revision: 1,
  date: '2026-09-19', start_time: '11:00', end_time: '11:30', starts_at: '2026-09-19T11:00:00+08:00', ends_at: '2026-09-19T11:30:00+08:00', duration_minutes: 30,
  patient: { id: serverId(500), code: 'PAT-0500', name: 'Server Patient' }, branch: { id: 'b1', name: 'Branch A' }, service: { id: 'svc1', name: 'Dental Consultation' },
  dentist: { id: 'd1', name: 'Dr. Miguel Reyes' }, notes: null, ...fields,
})

// ---- follow-up world: real workflow actions + real appointment-flow.js against a tiny mocked server -------------------
const seedKeys = { persons: 'PERSONS', services: 'SERVICES', branchServices: 'BRANCH_SERVICES', dentistServiceAssignments: 'DENTIST_SERVICE_ASSIGNMENTS', branches: 'BRANCHES', dentists: 'DENTISTS', staff: 'STAFF', patients: 'PATIENTS', users: 'USERS' }
function world() {
  const seeds = Object.fromEntries(Object.entries(seedKeys).map(([k, v]) => [k, structuredClone(data[`INITIAL_${v}`])]))
  let state = normalizeClinicState({ ...seeds, appointments: [], queue: [], checkIns: [], treatments: [], invoices: [], followups: [], prescriptions: [], notifications: [], hmo: [], conversations: [], inquiries: [], workflowLog: [], audit: [], bookingDrafts: [] })
  let session = sessionForRole('staff', state)
  const patches = []
  const actions = createWorkflowActions({ getState: () => state, getSession: () => session, commit: patch => { patches.push(patch); state = normalizeClinicState({ ...state, ...patch }) } })
  const server = new Map()
  const log = []
  let createResult = null
  const project = () => { state = normalizeClinicState({ ...state, appointments: [...server.values()].map(r => api.mapAppointment(r, id => (id === serverId(500) ? 'p1' : id))) }) }
  const accept = (id, changes) => { const current = server.get(id); const next = { ...current, ...changes, revision: current.revision + 1 }; server.set(id, next); return { ok: true, row: next } }
  const mock = {
    commandKey: () => `k-${log.length}`,
    async createAppointment(form, key) {
      log.push(['create', key])
      if (createResult) return createResult
      const r = row({ id: serverId(700 + server.size), code: `APT-2026-00070${server.size}`, date: form.date, start_time: form.start, dentist: { id: form.dentistId || 'd1', name: 'Dr' } })
      server.set(r.id, r); return { ok: true, row: r }
    },
    async transitionAppointment(a, name) { log.push([name]); const to = { 'check-in': 'Checked In', 'no-show': 'No-show', 'start-treatment': 'In Treatment', complete: 'Completed' }[name]; return accept(a.id, { status: to }) },
  }
  const flow = createAppointmentFlow({ getState: () => state, getSession: () => session, getActions: () => actions, refresh: async () => { log.push(['refresh']); project(); return { ok: true } }, api: mock })
  return {
    flow, actions, log, server, patches,
    get state() { return state },
    set state(next) { state = next },
    role(r) { session = sessionForRole(r, state) },
    failCreateWith(result) { createResult = result },
    seed(r) { server.set(r.id, r); project(); return state.appointments.find(a => a.id === r.id) },
  }
}

// A completed encounter whose Dentist indicated a required follow-up (the real server-first path).
async function openFollowup() {
  const w = world(); const a = w.seed(row())
  await w.flow.checkIn(a.id)
  const q = w.state.queue[0]
  w.role('dentist'); w.actions.updateQueue(q.id, 'Called')
  await w.flow.treatment({ queueEntryId: q.id }, 'In Treatment')
  const done = await w.flow.treatment({ queueEntryId: q.id, procedure: 'Consultation', procedures: [{ serviceId: 'svc1', quantity: 1 }], followupRequired: true, followupDate: '2026-09-26' }, 'Completed')
  assert.equal(done.ok, true, done.message)
  const followup = w.state.followups[0]
  assert.equal(followup.status, 'Open')
  w.log.length = 0
  return { w, followup }
}
const followupForm = { branchId: 'b1', serviceId: 'svc1', date: '2026-09-26', start: '10:00', patientPublicId: serverId(500), dentistId: 'd1' }

// ================================================================================================================
// FOLLOW-UP (transitional M6/M20 rule)
// ================================================================================================================
test('Staff schedule the follow-up as a server appointment; only its public id is stored locally', async () => {
  const { w, followup } = await openFollowup()
  w.role('staff')
  const booked = await w.flow.create(followupForm, { key: 'f-1', followupId: followup.id })
  assert.equal(booked.ok, true, booked.message)
  assert.deepEqual(w.log.map(x => x[0]), ['create', 'refresh'])
  const stored = w.state.followups[0]
  assert.equal(stored.appointmentId, booked.record.id)
  assert.equal(api.isServerId(stored.appointmentId), true, 'the follow-up keeps the server public id')
  assert.equal(stored.status, 'Scheduled')
  assert.equal(w.patches.some(p => 'appointments' in p), false, 'no local appointment record is ever committed')
  assert.deepEqual(w.state.appointments.map(a => a.id).sort(), [...w.server.keys()].sort(), 'every appointment is a server row')
})

test('the Owner may schedule a follow-up through the same bridge (current authorization permits it)', async () => {
  const { w, followup } = await openFollowup()
  w.role('owner')
  const booked = await w.flow.create(followupForm, { key: 'f-2', followupId: followup.id })
  assert.equal(booked.ok, true, booked.message)
  assert.equal(booked.warning, '')
  assert.equal(w.state.followups[0].appointmentId, booked.record.id)
})

test('a Dentist cannot book the follow-up: nothing reaches the server and the follow-up stays open', async () => {
  const { w, followup } = await openFollowup()
  w.role('dentist')
  const result = await w.flow.create(followupForm, { key: 'f-3', followupId: followup.id })
  assert.equal(result.ok, false)
  assert.match(result.message, /scheduled by clinic Staff/)
  assert.deepEqual(w.log, [], 'no server create was attempted')
  assert.equal(w.server.size, 1, 'no new server appointment exists')
  assert.equal(w.state.followups[0].status, 'Open')
  // The local adapter refuses a Dentist too, even with a real server appointment id.
  const [existing] = w.server.keys()
  assert.equal(w.actions.linkFollowupAppointment(followup.id, existing).ok, false)
})

test('the Dentist follow-up screen explains that clinic Staff schedule the visit and offers no booking action', () => {
  const source = read('src/pages/Clinical.jsx')
  assert.match(source, /Clinic Staff schedule follow-up visits/)
  assert.match(source, /you can’t book it from here/)
  // The only booking action on the page is gated to Staff.
  assert.match(source, /role==='staff'&&<Button size="sm" onClick=\{\(\)=>setBooking\(f\)\}>Schedule follow-up<\/Button>/)
})

test('a Patient has no active follow-up self-booking control', async () => {
  const { w, followup } = await openFollowup()
  w.role('patient')
  const result = await w.flow.create(followupForm, { key: 'f-4', followupId: followup.id })
  assert.equal(result.ok, false)
  assert.deepEqual(w.log, [])
  const item = patientAttention(w.state, sessionForRole('patient', w.state)).find(i => i.kind === 'followup')
  assert.ok(item, 'the recommendation is still shown to the Patient')
  assert.equal(item.action, 'View follow-up')
  assert.match(item.detail, /clinic will schedule it/)
  const visits = read('src/pages/PatientVisits.jsx')
  assert.doesNotMatch(visits, /you choose a time that works for you|will return in a later update/)
  assert.match(visits, /follow-ups can’t be booked online/)
})

// ================================================================================================================
// EXPIRED SERVER SESSION
// ================================================================================================================
let calls = []
let oldFetch
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
function mockFetch(handler) {
  oldFetch = globalThis.fetch
  calls = []
  globalThis.fetch = async (url, options = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '')
    calls.push({ path, method: (options.method || 'GET').toUpperCase() })
    if (path === '/sanctum/csrf-cookie') return new Response(null, { status: 204 })
    return handler(path, options)
  }
}
let unsubscribe = null
afterEach(() => { if (oldFetch) globalThis.fetch = oldFetch; oldFetch = null; unsubscribe?.(); unsubscribe = null; __resetCsrfCacheForTests() })
const expired = () => json(401, { message: 'Unauthenticated.' })
const listen = () => { const seen = []; unsubscribe = onSessionInvalidated(() => seen.push(1)); return seen }
const apiCalls = () => calls.filter(c => c.path !== '/sanctum/csrf-cookie')

test('an appointment read returning 401 reports the shared session-invalidated signal', async () => {
  mockFetch(expired)
  const seen = listen()
  const result = await api.loadAppointments('2026-09-19')
  assert.equal(result.ok, false)
  assert.equal(result.kind, 'unauthenticated')
  assert.equal(result.message, 'Your session has ended. Sign in again.')
  assert.equal(seen.length, 1)
  assert.equal(apiCalls().length, 1, 'the read stops at the first 401 page')
})

test('availability, recommendation and Patient directory 401s follow the same path', async () => {
  mockFetch(expired)
  const seen = listen()
  assert.equal((await api.fetchAvailability({ branchId: 'b1', serviceId: 'svc1', date: '2026-09-20' })).kind, 'unauthenticated')
  assert.equal((await api.fetchRecommendation({ serviceId: 'svc1' })).kind, 'unauthenticated')
  assert.equal((await api.searchPatients('ma')).kind, 'unauthenticated')
  assert.equal(seen.length, 3)
})

test('create, reschedule, cancel and lifecycle 401s are reported once each and never retried', async () => {
  mockFetch(expired)
  const seen = listen()
  const appointment = api.mapAppointment(row())
  const results = [
    await api.createAppointment({ branchId: 'b1', serviceId: 'svc1', date: '2026-09-20', start: '10:00' }, 'k-create'),
    await api.rescheduleAppointment(appointment, { date: '2026-09-21', start: '10:00' }, 'k-resched'),
    await api.cancelAppointment(appointment, 'k-cancel'),
    await api.transitionAppointment(appointment, 'check-in', 'k-check'),
  ]
  for (const result of results) { assert.equal(result.ok, false); assert.equal(result.kind, 'unauthenticated') }
  assert.equal(seen.length, 4)
  const posts = apiCalls().filter(c => c.method === 'POST')
  assert.equal(posts.length, 4, 'exactly one request per command: a 401 is never retried')
})

test('revalidation keeps the session only when /api/me confirms the same account', async () => {
  const userId = '01jtestuser00000000000001'
  mockFetch(() => expired())
  assert.equal(await sessionStillValid(userId), false, 'server confirms the session is gone')
  globalThis.fetch = oldFetch
  mockFetch(() => json(200, { data: { id: '01jtestuser00000000000002', role: 'staff' } }))
  assert.equal(await sessionStillValid(userId), false, 'a different account is signed in now')
  globalThis.fetch = oldFetch
  mockFetch(() => json(200, { data: { id: userId, role: 'staff' } }))
  assert.equal(await sessionStillValid(userId), true)
  assert.equal(await sessionStillValid(null), false, 'no known server account: never assume the session is valid')
})

test('a 401 on create changes nothing locally: no refresh, no draft clearing, no follow-up link', async () => {
  const { w, followup } = await openFollowup()
  w.role('staff')
  const draft = { id: 'draft-1', patientId: 'p1', mode: 'manual', branchId: 'b1', serviceId: 'svc1', date: '2026-09-26', start: '10:00' }
  w.state = normalizeClinicState({ ...w.state, bookingDrafts: [draft] })
  w.failCreateWith(api.normalizeFailure({ ok: false, kind: 'unauthenticated' }))
  const result = await w.flow.create(followupForm, { key: 'f-5', followupId: followup.id })
  assert.equal(result.ok, false)
  assert.equal(result.kind, 'unauthenticated')
  assert.deepEqual(w.log.map(x => x[0]), ['create'], 'no refresh and no second create attempt')
  assert.equal(w.state.bookingDrafts.length, 1, 'the recoverable draft is kept for the next sign-in')
  assert.equal(w.state.followups[0].status, 'Open')
})

test('the app shell handles the signal through its normal sign-out path (no second session system)', () => {
  const app = read('src/App.jsx')
  assert.match(app, /api\.onSessionInvalidated\(/)
  assert.match(app, /api\.sessionStillValid\(/)
  assert.match(app, /current\.signedOut\(\)/)
  assert.match(app, /Your session has ended\. Sign in again\./)
  // logout() and the expiry path share the same signed-out transition.
  assert.equal((app.match(/signedOut\(\)/g) || []).length >= 2, true)
  const client = read('src/appointments-api.js')
  assert.doesNotMatch(client, /adoptSession|sessionStorage|localStorage|login\(/, 'appointments-api.js holds no session state of its own')
})

// ================================================================================================================
// ANALYTICS WINDOW
// ================================================================================================================
test('the loaded appointment window is bounded and the Scheduling metric names it (never all-time)', () => {
  assert.deepEqual(api.appointmentWindow('2026-09-19'), { from: '2026-06-21', to: '2026-12-21' })
  const admin = read('src/pages/Admin.jsx')
  assert.match(admin, /appointmentWindow\(clinicDate\(\)\)/)
  assert.match(admin, /not all-time; the period selector does not apply/)
  assert.match(admin, /appointmentsTruncated\?'\. Partial: the appointment list limit was reached\.'/)
  for (const path of ['src/pages/Admin.jsx', 'src/pages/Dashboards.jsx']) assert.doesNotMatch(read(path), /all[- ]time appointments|complete appointment history/i, path)
})
