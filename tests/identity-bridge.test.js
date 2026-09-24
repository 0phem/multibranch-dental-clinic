import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import * as data from '../src/data.js'
import { setClockSource } from '../src/clock.js'
import { normalizeClinicState } from '../src/contracts.js'
import { validSession } from '../src/safeguards.js'
import { createIdentityBridge } from '../src/identity-bridge.js'

beforeEach(() => setClockSource(() => new Date('2026-09-19T02:08:00Z')))

const seedKeys = { persons: 'PERSONS', services: 'SERVICES', branchServices: 'BRANCH_SERVICES', dentistServiceAssignments: 'DENTIST_SERVICE_ASSIGNMENTS', branches: 'BRANCHES', dentists: 'DENTISTS', staff: 'STAFF', patients: 'PATIENTS', users: 'USERS', automations: 'AUTOMATIONS' }
function fixture() {
  const seeds = Object.fromEntries(Object.entries(seedKeys).map(([k, v]) => [k, structuredClone(data[`INITIAL_${v}`])]))
  let state = normalizeClinicState({ ...seeds, appointments: [], queue: [], checkIns: [], treatments: [], invoices: [], prescriptions: [], followups: [], hmo: [], conversations: [], inquiries: [], notifications: [], workflowLog: [], audit: [], loyalty: [] })
  const bridge = createIdentityBridge({ getState: () => state, commit: p => { state = normalizeClinicState({ ...state, ...p }) } })
  return { bridge, get state() { return state } }
}

test('the Owner demo account bridges to the existing local Owner identity (Dana Roxas / u1)', () => {
  const f = fixture()
  const result = f.bridge({ role: 'owner', email: 'owner@example.test' })
  assert.equal(result.ok, true)
  assert.equal(result.session.role, 'owner')
  assert.equal(result.session.userId, 'u1')
  assert.equal(validSession(f.state, result.session), true, 'the bridged session must satisfy validSession, not just resemble one')
})

test('the aligned Staff demo account bridges to Alyssa Cruz / u2', () => {
  const f = fixture()
  const result = f.bridge({ role: 'staff', email: 'staff.reception@example.test' })
  assert.equal(result.ok, true)
  assert.equal(result.session.userId, 'u2')
  assert.equal(validSession(f.state, result.session), true)
})

test('a Staff demo account with no corresponding local identity fails closed, never impersonating another Staff member', () => {
  const f = fixture()
  const result = f.bridge({ role: 'staff', email: 'staff.assistant@example.test' })
  assert.equal(result.ok, false)
})

test('the Dentist demo account bridges to Dr. Miguel Reyes / u3 / d1', () => {
  const f = fixture()
  const result = f.bridge({ role: 'dentist', email: 'dentist@example.test' })
  assert.equal(result.ok, true)
  assert.equal(result.session.userId, 'u3')
  assert.equal(result.session.dentistId, 'd1')
  assert.equal(validSession(f.state, result.session), true)
})

test('a mapped email whose backend role does not match the table entry fails closed (email alone is never sufficient)', () => {
  const f = fixture()
  const result = f.bridge({ role: 'staff', email: 'owner@example.test' })
  assert.equal(result.ok, false)
})

test('an unknown Staff/Dentist/Owner email fails closed rather than guessing a local identity', () => {
  const f = fixture()
  const result = f.bridge({ role: 'staff', email: 'nobody@example.test' })
  assert.equal(result.ok, false)
})

test('the aligned demo Patient reuses Maria Santos (p1/u12) — no duplicate local Patient is created', () => {
  const f = fixture()
  const before = { persons: f.state.persons.length, patients: f.state.patients.length, users: f.state.users.length }
  const result = f.bridge({ role: 'patient', email: 'patient@example.test', id: 999, person_id: 999 })
  assert.equal(result.ok, true)
  assert.equal(result.session.patientId, 'p1')
  assert.equal(result.session.userId, 'u12')
  assert.equal(f.state.persons.length, before.persons)
  assert.equal(f.state.patients.length, before.patients)
  assert.equal(f.state.users.length, before.users)
  assert.equal(validSession(f.state, result.session), true)
})

test('a genuinely new backend Patient creates exactly one local Person/Patient/User, with no fabricated history', () => {
  const f = fixture()
  const before = {
    persons: f.state.persons.length, patients: f.state.patients.length, users: f.state.users.length,
    appointments: f.state.appointments.length, treatments: f.state.treatments.length, invoices: f.state.invoices.length,
  }
  const me = { id: 'be-1', person_id: 'be-p-1', role: 'patient', email: 'jamie.cruz@example.test', first_name: 'Jamie', middle_name: '', last_name: 'Cruz', phone: '0917 555 0001', date_of_birth: '1998-05-17' }
  const result = f.bridge(me)
  assert.equal(result.ok, true, JSON.stringify(result))
  assert.equal(f.state.persons.length, before.persons + 1)
  assert.equal(f.state.patients.length, before.patients + 1)
  assert.equal(f.state.users.length, before.users + 1)
  assert.equal(f.state.appointments.length, before.appointments, 'no appointment is fabricated for a new bridged Patient')
  assert.equal(f.state.treatments.length, before.treatments)
  assert.equal(f.state.invoices.length, before.invoices)
  const person = f.state.persons.find(p => p.id === f.state.patients.find(p2 => p2.id === result.session.patientId).personId)
  assert.equal(person.firstName, 'Jamie')
  assert.equal(person.lastName, 'Cruz')
  assert.equal(validSession(f.state, result.session), true)
})

test('bridging the same new backend account twice is idempotent — no duplicate local Patient', () => {
  const f = fixture()
  const me = { id: 'be-2', person_id: 'be-p-2', role: 'patient', email: 'priya.cruz@example.test', first_name: 'Priya', last_name: 'Cruz', phone: '0917 555 9911', date_of_birth: '' }
  const first = f.bridge(me)
  const before = { persons: f.state.persons.length, patients: f.state.patients.length, users: f.state.users.length }
  const second = f.bridge(me)
  assert.equal(second.ok, true)
  assert.equal(second.session.patientId, first.session.patientId)
  assert.equal(second.session.userId, first.session.userId)
  assert.equal(f.state.persons.length, before.persons)
  assert.equal(f.state.patients.length, before.patients)
  assert.equal(f.state.users.length, before.users)
})

test('an identity with no role fails closed rather than crashing', () => {
  const f = fixture()
  assert.equal(f.bridge(null).ok, false)
  assert.equal(f.bridge({ email: 'x@example.test' }).ok, false)
})
