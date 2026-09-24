import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import * as data from '../src/data.js'
import { setClockSource, clinicNow, maxBookingDate, addDays } from '../src/clock.js'
import { normalizeClinicState, sessionForRole } from '../src/contracts.js'
import { createWorkflowActions } from '../src/workflow.js'
import { assignDentist } from '../src/scheduling.js'
import { appointmentActionState } from '../src/patient-view.js'

// 2026-09-19 10:08 Manila
beforeEach(() => setClockSource(() => new Date('2026-09-19T02:08:00Z')))

const seedKeys = { persons: 'PERSONS', services: 'SERVICES', branchServices: 'BRANCH_SERVICES', dentistServiceAssignments: 'DENTIST_SERVICE_ASSIGNMENTS', branches: 'BRANCHES', dentists: 'DENTISTS', staff: 'STAFF', patients: 'PATIENTS', users: 'USERS' }
function fixture() {
  const seeds = Object.fromEntries(Object.entries(seedKeys).map(([k, v]) => [k, structuredClone(data[`INITIAL_${v}`])]))
  let state = normalizeClinicState({ ...seeds, appointments: [], queue: [], checkIns: [], treatments: [], invoices: [], followups: [], prescriptions: [], notifications: [], workflowLog: [], audit: [], bookingDrafts: [] })
  let session = sessionForRole('patient', state)
  const actions = createWorkflowActions({ getState: () => state, getSession: () => session, commit: patch => { state = normalizeClinicState({ ...state, ...patch }) } })
  return {
    actions, get state() { return state },
    role: role => { session = sessionForRole(role, state) },
    setSession: s => { session = s },
    patch: p => { state = normalizeClinicState({ ...state, ...p }) },
  }
}
const ok = result => { assert.equal(result.ok, true, result.message); return result.record }
const bad = (result, pattern) => { assert.equal(result.ok, false, 'expected the command to fail'); if (pattern) assert.match(result.message, pattern); return result }
const baseForm = (overrides = {}) => ({ patientId: 'p1', branchId: 'b1', dentistId: 'd1', serviceId: 'svc1', date: '2026-09-20', start: '11:00', paymentMethod: 'cash', ...overrides })
const lines = [{ serviceId: 'svc1', quantity: 1 }]
// Real book→check-in→treat→complete pipeline (mirrors tests/phase2.test.js), used only to produce a
// genuine Open follow-up obligation for the horizon-exemption test.
function completeWithFollowup(f) {
  const a = ok(f.actions.saveAppointment(baseForm({ date: '2026-09-19', start: '11:00' })))
  f.role('staff')
  const q = ok(f.actions.checkInAppointment(a.id))
  f.role('dentist')
  ok(f.actions.updateQueue(q.id, 'Called'))
  ok(f.actions.saveTreatment({ queueEntryId: q.id }))
  ok(f.actions.completeTreatment({ queueEntryId: q.id, procedure: 'Consultation', procedures: lines, followupRequired: true }))
  f.role('patient')
}

// ================================================================================================================
// TWO-CALENDAR-MONTH HORIZON
// ================================================================================================================
test('a Patient booking exactly on the horizon boundary succeeds', () => {
  const f = fixture()
  const boundary = maxBookingDate()
  const record = ok(f.actions.saveAppointment(baseForm({ date: boundary })))
  assert.equal(record.date, boundary)
})

test('a Patient booking one day past the horizon is rejected', () => {
  const f = fixture()
  const beyond = addDays(maxBookingDate(), 1)
  bad(f.actions.saveAppointment(baseForm({ date: beyond })), /horizon/i)
})

test('assignDentist rejects a date beyond the given horizon', () => {
  const f = fixture()
  const beyond = addDays(maxBookingDate(), 1)
  const result = assignDentist(f.state, { branchId: 'b1', serviceId: 'svc1', patientId: 'p1', date: beyond, start: '11:00' }, clinicNow(), null, maxBookingDate())
  assert.equal(result.ok, false)
})

test('a past date is still rejected regardless of the horizon', () => {
  const f = fixture()
  bad(f.actions.saveAppointment(baseForm({ date: '2026-09-01' })))
})

test('follow-up scheduling is exempt from the two-month horizon', () => {
  const f = fixture()
  completeWithFollowup(f)
  const followup = f.state.followups.find(x => x.patientId === 'p1' && x.status === 'Open')
  assert.ok(followup, 'a follow-up obligation should exist')
  const beyond = addDays(maxBookingDate(), 30)
  const result = f.actions.saveAppointment(
    { branchId: 'b1', dentistId: 'd1', serviceId: 'svc11', date: beyond, start: '11:00' },
    { followupId: followup.id },
  )
  assert.equal(result.ok, true, result.message)
})

// ================================================================================================================
// PATIENT RESCHEDULE: DATE/TIME ONLY
// ================================================================================================================
test('Patient reschedule cannot change Branch', () => {
  const f = fixture()
  const a = ok(f.actions.saveAppointment(baseForm()))
  bad(f.actions.saveAppointment({ ...baseForm(), branchId: 'b2', date: '2026-09-21' }, { appointmentId: a.id }), /only change the date and time/i)
})

test('Patient reschedule cannot change Service', () => {
  const f = fixture()
  const a = ok(f.actions.saveAppointment(baseForm()))
  bad(f.actions.saveAppointment({ ...baseForm(), serviceId: 'svc2', date: '2026-09-21' }, { appointmentId: a.id }), /only change the date and time/i)
})

test('Patient reschedule cannot change Dentist', () => {
  const f = fixture()
  const a = ok(f.actions.saveAppointment(baseForm()))
  bad(f.actions.saveAppointment({ ...baseForm(), dentistId: 'd6', date: '2026-09-21' }, { appointmentId: a.id }), /only change the date and time/i)
})

test('a Date/Time-only Patient reschedule succeeds when the new slot is valid', () => {
  const f = fixture()
  const a = ok(f.actions.saveAppointment(baseForm()))
  const rescheduled = ok(f.actions.saveAppointment({ ...baseForm(), date: '2026-09-21', start: '13:00' }, { appointmentId: a.id, expectedRevision: a.revision }))
  assert.equal(rescheduled.id, a.id, 'the same appointment is updated, never a second one')
  assert.equal(rescheduled.date, '2026-09-21')
  assert.equal(rescheduled.start, '13:00')
  assert.equal(rescheduled.branchId, a.branchId)
  assert.equal(rescheduled.serviceId, a.serviceId)
  assert.equal(rescheduled.dentistId, a.dentistId)
  assert.equal(f.state.appointments.length, 1, 'no duplicate active appointment is created')
})

test('Staff reschedule is not restricted by the Patient-only Branch/Service/Dentist lock', () => {
  const f = fixture()
  const a = ok(f.actions.saveAppointment(baseForm()))
  f.role('staff')
  const rescheduled = f.actions.saveAppointment({ ...baseForm(), dentistId: 'd2', date: '2026-09-21' }, { appointmentId: a.id, expectedRevision: a.revision })
  assert.equal(rescheduled.ok, true, rescheduled.message)
})

// ================================================================================================================
// PAYMENT METADATA — never fake "paid"
// ================================================================================================================
test('a new booking\'s paymentStatus is always unpaid, never taken from client input', () => {
  const f = fixture()
  const a = ok(f.actions.saveAppointment(baseForm({ paymentMethod: 'card', paymentStatus: 'paid' })))
  assert.equal(a.paymentMethod, 'card')
  assert.equal(a.paymentStatus, 'unpaid', 'paymentStatus can never be set to paid from the booking form')
})

test('payment metadata is preserved unchanged across a reschedule', () => {
  const f = fixture()
  const a = ok(f.actions.saveAppointment(baseForm({ paymentMethod: 'card' })))
  const rescheduled = ok(f.actions.saveAppointment({ ...baseForm(), date: '2026-09-21' }, { appointmentId: a.id, expectedRevision: a.revision }))
  assert.equal(rescheduled.paymentMethod, 'card')
  assert.equal(rescheduled.paymentStatus, 'unpaid')
})

// ================================================================================================================
// CANCELLATION
// ================================================================================================================
test('card selected but unpaid follows the same before-start cancellation rule as cash', () => {
  const f = fixture()
  const a = ok(f.actions.saveAppointment(baseForm({ paymentMethod: 'card' })))
  const state = appointmentActionState({ ...a, paymentMethod: 'card', paymentStatus: 'unpaid' })
  assert.equal(state.canCancel, true)
  assert.equal(state.cancelKind, 'normal')
  ok(f.actions.cancelAppointment(a.id))
  assert.equal(f.state.appointments.find(x => x.id === a.id).status, 'Cancelled')
})

test('card + paid cancellation is blocked, with zero state mutation', () => {
  const f = fixture()
  const a = ok(f.actions.saveAppointment(baseForm({ paymentMethod: 'card' })))
  f.patch({ appointments: f.state.appointments.map(x => x.id === a.id ? { ...x, paymentStatus: 'paid' } : x) })
  const before = JSON.stringify(f.state.appointments)
  const state = appointmentActionState(f.state.appointments.find(x => x.id === a.id))
  assert.equal(state.cancelKind, 'blocked-card-paid')
  assert.equal(state.canCancel, true, 'the Cancel action stays visible/available — it explains, rather than disappearing')
  const result = bad(f.actions.cancelAppointment(a.id), /already been paid by card/i)
  assert.equal(JSON.stringify(f.state.appointments), before, 'no appointment state changed')
})

test('cash cancellation succeeds before the appointment start time', () => {
  const f = fixture()
  const a = ok(f.actions.saveAppointment(baseForm({ date: '2026-09-19', start: '15:00' })))
  ok(f.actions.cancelAppointment(a.id))
  assert.equal(f.state.appointments.find(x => x.id === a.id).status, 'Cancelled')
})

test('cash cancellation is blocked at/after the appointment start time', () => {
  const f = fixture()
  // The fixed test clock is 2026-09-19 10:08; book something earlier today via direct state manipulation
  // (saveAppointment itself would reject a past start time on creation, which is correct — this simulates an
  // appointment that was booked earlier and whose time has since passed).
  const a = ok(f.actions.saveAppointment(baseForm({ date: '2026-09-19', start: '11:00' })))
  f.patch({ appointments: f.state.appointments.map(x => x.id === a.id ? { ...x, start: '09:00' } : x) })
  const state = appointmentActionState(f.state.appointments.find(x => x.id === a.id))
  assert.equal(state.canCancel, false)
  assert.equal(state.cancelKind, 'past-start')
  bad(f.actions.cancelAppointment(a.id), /scheduled time has passed/i)
})

// ================================================================================================================
// BOOKING DRAFTS — paymentMethod joins the cascade
// ================================================================================================================
test('a booking draft accepts a valid paymentMethod and rejects an invalid one', () => {
  const f = fixture()
  const good = f.actions.saveBookingDraft({ paymentMethod: 'card' }, 'cmd-1')
  assert.equal(good.ok, true, good.message)
  assert.equal(f.state.bookingDrafts[0].paymentMethod, 'card')
  const invalid = f.actions.saveBookingDraft({ paymentMethod: 'bitcoin' }, 'cmd-2')
  assert.equal(invalid.ok, false)
})

test('choosing a new Branch clears Service/Date/Time/Payment already saved in the draft', () => {
  const f = fixture()
  f.actions.saveBookingDraft({ mode: 'manual', branchId: 'b1', serviceId: 'svc1', date: '2026-09-20', start: '11:00', paymentMethod: 'cash' }, 'cmd-1')
  const changed = f.actions.saveBookingDraft({ branchId: 'b2', serviceId: null, date: null, start: null, paymentMethod: null }, 'cmd-2')
  assert.equal(changed.ok, true, changed.message)
  const draft = f.state.bookingDrafts[0]
  assert.equal(draft.branchId, 'b2')
  assert.equal(draft.serviceId, null)
  assert.equal(draft.date, null)
  assert.equal(draft.start, null)
  assert.equal(draft.paymentMethod, null)
})
