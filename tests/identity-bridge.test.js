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

test('identity projections format names from first and last name only', () => {
  const f = fixture()
  const person = f.state.persons.find(p => p.id === 'per-owner')
  assert.equal([person.firstName, person.lastName].filter(Boolean).join(' '), 'Dana Roxas')
  assert.equal('middleName' in person, false)
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
  const result = f.bridge({ role: 'patient', email: 'patient@example.test', id: '01jdemopatientuser00000000', patient: { id: '01jdemopatientrecord000000', code: 'PAT-0000' } })
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
  const me = { id: 'be-1', patient: { id: 'be-pt-1', code: 'PAT-0042' }, role: 'patient', email: 'jamie.cruz@example.test', first_name: 'Jamie', last_name: 'Cruz', phone: '0917 555 0001', date_of_birth: '1998-05-17' }
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
  const patient = f.state.patients.find(p => p.id === result.session.patientId)
  assert.equal(patient.patientCode, 'PAT-0042', 'the local projection shows the server patient_code')
  const user = f.state.users.find(u => u.id === result.session.userId)
  assert.equal(user.backendUserId, 'be-1')
  assert.equal(user.backendPatientId, 'be-pt-1', 'keyed on the server-resolved Patient public id')
  assert.equal('backendPersonId' in user, false, 'no internal person id is stored any more')
})

test('bridging the same new backend account twice is idempotent — no duplicate local Patient', () => {
  const f = fixture()
  const me = { id: 'be-2', patient: { id: 'be-pt-2', code: 'PAT-0043' }, role: 'patient', email: 'priya.cruz@example.test', first_name: 'Priya', last_name: 'Cruz', phone: '0917 555 9911', date_of_birth: '' }
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

test('a Patient login with no server-resolved Patient record fails closed instead of guessing one', () => {
  const f = fixture()
  const before = f.state.patients.length
  for (const me of [
    { id: 'be-3', role: 'patient', email: 'nopatient@example.test', first_name: 'No', last_name: 'Record' },
    { id: 'be-3', role: 'patient', email: 'nopatient@example.test', patient: null },
    { id: 7, role: 'patient', email: 'numeric@example.test', patient: { id: 'be-pt-7', code: 'PAT-0007' } },
  ]) assert.equal(f.bridge(me).ok, false, JSON.stringify(me))
  assert.equal(f.state.patients.length, before)
})

test('a projection saved under the old numeric backend id is re-keyed once to the public ids, never duplicated', () => {
  const f = fixture()
  const legacyMe = { id: 'be-4', role: 'patient', email: 'legacy@example.test', first_name: 'Lee', last_name: 'Gacy', patient: { id: 'be-pt-4', code: 'PAT-0044' } }
  const first = f.bridge(legacyMe)
  // Simulate browser state written before the public-id cutover: numeric backend ids.
  const saved = f.state.users.find(u => u.id === first.session.userId)
  f.state.users.splice(f.state.users.indexOf(saved), 1, { ...saved, backendUserId: 12, backendPatientId: undefined, backendPersonId: 34 })
  const before = { persons: f.state.persons.length, patients: f.state.patients.length, users: f.state.users.length }

  const result = f.bridge({ ...legacyMe, id: '01jlegacyuserpublicid00000', patient: { id: '01jlegacypatientpublicid00', code: 'PAT-0044' } })
  assert.equal(result.ok, true, JSON.stringify(result))
  assert.equal(result.session.patientId, first.session.patientId, 'the same local Patient (and its local history) is kept')
  assert.deepEqual({ persons: f.state.persons.length, patients: f.state.patients.length, users: f.state.users.length }, before)
  const user = f.state.users.find(u => u.id === first.session.userId)
  assert.equal(user.backendUserId, '01jlegacyuserpublicid00000')
  assert.equal(user.backendPatientId, '01jlegacypatientpublicid00')
  assert.equal('backendPersonId' in user, false)
  // Idempotent afterwards.
  assert.equal(f.bridge({ ...legacyMe, id: '01jlegacyuserpublicid00000', patient: { id: '01jlegacypatientpublicid00', code: 'PAT-0044' } }).session.userId, first.session.userId)
})

test('a local record already keyed to the server Patient is never duplicated or re-keyed by email', () => {
  const f = fixture()
  const first = f.bridge({ id: 'be-8', role: 'patient', email: 'keyed@example.test', first_name: 'K', last_name: 'Eyed', patient: { id: 'be-pt-8', code: 'PAT-0080' } })
  assert.equal(first.ok, true)
  const before = f.state.users.length
  const other = f.bridge({ id: 'be-9', role: 'patient', email: 'keyed@example.test', patient: { id: 'be-pt-8', code: 'PAT-0080' } })
  assert.equal(other.reason, 'patient-already-linked')
  assert.equal(f.state.users.length, before)
})

test('two legacy projections for the same email fail closed rather than picking one', () => {
  const f = fixture()
  const a = f.bridge({ id: 'be-5', role: 'patient', email: 'twin@example.test', first_name: 'A', last_name: 'Twin', patient: { id: 'be-pt-5', code: 'PAT-0050' } })
  const b = f.bridge({ id: 'be-6', role: 'patient', email: 'twin@example.test', first_name: 'B', last_name: 'Twin', patient: { id: 'be-pt-6', code: 'PAT-0051' } })
  for (const [session, numeric] of [[a.session, 1], [b.session, 2]]) {
    const saved = f.state.users.find(u => u.id === session.userId)
    f.state.users.splice(f.state.users.indexOf(saved), 1, { ...saved, backendUserId: numeric })
  }
  assert.equal(f.bridge({ id: '01jtwinpublicid00000000000', role: 'patient', email: 'twin@example.test', patient: { id: 'x', code: 'PAT-0050' } }).reason, 'ambiguous-legacy-identity')
})
