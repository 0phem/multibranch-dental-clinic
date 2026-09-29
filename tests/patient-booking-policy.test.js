import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as data from '../src/data.js'
import * as clock from '../src/clock.js'
import { normalizeClinicState, sessionForRole } from '../src/contracts.js'
import { createWorkflowActions } from '../src/workflow.js'
import { appointmentActionState } from '../src/patient-view.js'
import { serverAppointment } from './support/server-appointments.js'

// M6 cutover: the Patient booking policy (booking window tomorrow..one calendar month after tomorrow, hourly Patient
// starts, reschedule changes date/time only with the same Dentist, cancellation before the start time, stale-revision
// 409s) is enforced by the Laravel M6 API and covered by backend tests (AppointmentBookingTest, AppointmentLifecycleTest,
// AppointmentCutoverSupportTest). The frontend keeps only presentation of those rules and drafts without payment data.

// 2026-09-19 10:08 Manila
beforeEach(() => clock.setClockSource(() => new Date('2026-09-19T02:08:00Z')))

const seedKeys = { persons: 'PERSONS', services: 'SERVICES', branchServices: 'BRANCH_SERVICES', dentistServiceAssignments: 'DENTIST_SERVICE_ASSIGNMENTS', branches: 'BRANCHES', dentists: 'DENTISTS', staff: 'STAFF', patients: 'PATIENTS', users: 'USERS' }
function fixture() {
  const seeds = Object.fromEntries(Object.entries(seedKeys).map(([k, v]) => [k, structuredClone(data[`INITIAL_${v}`])]))
  let state = normalizeClinicState({ ...seeds, appointments: [], queue: [], checkIns: [], treatments: [], invoices: [], followups: [], prescriptions: [], notifications: [], workflowLog: [], audit: [], bookingDrafts: [] })
  const session = sessionForRole('patient', state)
  const actions = createWorkflowActions({ getState: () => state, getSession: () => session, commit: patch => { state = normalizeClinicState({ ...state, ...patch }) } })
  return { actions, get state() { return state } }
}
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('the browser no longer holds Patient booking-window authority', () => {
  assert.equal('maxBookingDate' in clock, false, 'the two-month browser horizon is gone')
  for (const path of ['src/pages/PatientBook.jsx', 'src/pages/PatientVisits.jsx', 'src/patient-view.js']) {
    const source = read(path)
    assert.doesNotMatch(source, /two months|two-month|maxBookingDate/i, path)
    assert.doesNotMatch(source, /assignDentist|findOpenTimes/, `${path} no longer searches or assigns locally`)
  }
  // Every Patient date/time choice comes from the server's availability/recommendation (window + hourly grid).
  assert.match(read('src/pages/PatientBook.jsx'), /fetchRecommendation|useWindowAvailability|useDayAvailability/)
})

test('Patient cancel/reschedule presentation follows the server rule: no online cancel after the start time', () => {
  const upcoming = serverAppointment({ patientId: 'p1', branchId: 'b1', dentistId: 'd1', serviceId: 'svc1', date: '2026-09-19', start: '15:00' })
  assert.deepEqual(appointmentActionState(upcoming), { canReschedule: true, canCancel: true, cancelKind: 'normal', reason: '' })
  const started = { ...upcoming, start: '09:00' }
  const state = appointmentActionState(started)
  assert.equal(state.canCancel, false)
  assert.equal(state.cancelKind, 'past-start')
  assert.equal(appointmentActionState({ ...upcoming, status: 'Checked In' }).canReschedule, false)
})

test('card-paid cancellation presentation is deferred to M11 (no payment data exists on appointments)', () => {
  const upcoming = serverAppointment({ patientId: 'p1', branchId: 'b1', dentistId: 'd1', serviceId: 'svc1', date: '2026-09-20', start: '11:00', paymentMethod: 'card', paymentStatus: 'paid' })
  assert.notEqual(appointmentActionState(upcoming).cancelKind, 'blocked-card-paid')
  assert.doesNotMatch(read('src/pages/PatientVisits.jsx'), /blocked-card-paid|paymentMethod|Payment preference/)
})

test('booking drafts no longer accept a payment preference (D4: payment belongs to M11)', () => {
  const f = fixture()
  assert.equal(f.actions.saveBookingDraft({ paymentMethod: 'card' }, 'cmd-1').ok, false)
  assert.equal(f.actions.saveBookingDraft({ mode: 'manual', branchId: 'b1', serviceId: 'svc1', date: '2026-09-20', start: '11:00' }, 'cmd-2').ok, true)
  assert.equal('paymentMethod' in f.state.bookingDrafts[0], false)
})

test('choosing a new Branch clears Service/Date/Time already saved in the draft', () => {
  const f = fixture()
  f.actions.saveBookingDraft({ mode: 'manual', branchId: 'b1', serviceId: 'svc1', date: '2026-09-20', start: '11:00' }, 'cmd-1')
  const changed = f.actions.saveBookingDraft({ branchId: 'b2', serviceId: null, date: null, start: null }, 'cmd-2')
  assert.equal(changed.ok, true, changed.message)
  const draft = f.state.bookingDrafts[0]
  assert.deepEqual([draft.branchId, draft.serviceId, draft.date, draft.start], ['b2', null, null, null])
})

test('a legacy draft carrying a saved payment preference drops it on the next save', () => {
  const f = fixture()
  f.actions.saveBookingDraft({ mode: 'manual', branchId: 'b1' }, 'cmd-1')
  const legacy = { ...f.state.bookingDrafts[0], paymentMethod: 'cash' }
  const g = fixture()
  // Re-run against a state holding an old-format draft.
  const session = sessionForRole('patient', g.state)
  let state = normalizeClinicState({ ...g.state, bookingDrafts: [legacy] })
  const actions = createWorkflowActions({ getState: () => state, getSession: () => session, commit: patch => { state = normalizeClinicState({ ...state, ...patch }) } })
  assert.equal(actions.saveBookingDraft({ serviceId: 'svc1' }, 'cmd-2').ok, true)
  assert.equal('paymentMethod' in state.bookingDrafts[0], false)
})
