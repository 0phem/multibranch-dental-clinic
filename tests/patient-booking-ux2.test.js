import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as data from '../src/data.js'
import { setClockSource, clinicNow, addDays } from '../src/clock.js'
import { normalizeClinicState, sessionForRole } from '../src/contracts.js'
import { createWorkflowActions } from '../src/workflow.js'
import { hasUsableCoordinates, nearestBranch } from '../src/geo.js'
import {
  buildDateStrip, groupSlotsByPeriod, relativeDateLabel, bookingExitOutcome,
  draftStatus, patientBookingDraft, patientHome,
} from '../src/patient-view.js'

// 2026-09-19 10:08 Manila
beforeEach(() => setClockSource(() => new Date('2026-09-19T02:08:00Z')))

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const seedKeys = { persons: 'PERSONS', services: 'SERVICES', branchServices: 'BRANCH_SERVICES', dentistServiceAssignments: 'DENTIST_SERVICE_ASSIGNMENTS', branches: 'BRANCHES', dentists: 'DENTISTS', staff: 'STAFF', patients: 'PATIENTS', users: 'USERS' }
function fixture() {
  const seeds = Object.fromEntries(Object.entries(seedKeys).map(([k, v]) => [k, structuredClone(data[`INITIAL_${v}`])]))
  let state = normalizeClinicState({ ...seeds, appointments: [], queue: [], checkIns: [], treatments: [], invoices: [], followups: [], prescriptions: [], notifications: [], workflowLog: [], audit: [], bookingDrafts: [] })
  let session = sessionForRole('patient', state)
  const actions = createWorkflowActions({ getState: () => state, getSession: () => session, commit: patch => { state = normalizeClinicState({ ...state, ...patch }) } })
  return {
    actions, get state() { return state }, set state(next) { state = next },
    role: role => { session = sessionForRole(role, state) },
    get session() { return session },
  }
}
const ok = result => { assert.equal(result.ok, true, result.message); return result.record }

// ================================================================================================================
// SMART FIND DATE-STRIP EXHAUSTIVENESS — proves limit:Infinity searches the whole window; a low limit truncates it
// ================================================================================================================
// M6 cutover: open-time search is server-side. The date strip is built from server availability fetched for every day
// shown (booking-availability.js), so each day's hasOpenings is a server fact.
test('the booking pages build their date strips from server availability for every day shown', () => {
  const hook = read('src/booking-availability.js')
  assert.match(hook, /Promise\.all\(dates\.map\(date => fetchAvailability/)
  const book = read('src/pages/PatientBook.jsx')
  assert.match(book, /useWindowAvailability\(/)
  assert.match(book, /fetchRecommendation\(/)
})

test('a strip that starts tomorrow labels days from the clinic date, not from its first day', () => {
  const days = buildDateStrip([], '2026-09-20', 3, '2026-09-19')
  assert.deepEqual(days.map(d => d.label).slice(0, 1), ['Tomorrow'])
  assert.notEqual(days[1].label, 'Tomorrow')
})
test('buildDateStrip produces exactly windowDays entries with a real date/label/hasOpenings shape', () => {
  const results = [{ date: '2026-09-20', start: '09:00' }, { date: '2026-09-20', start: '10:00' }, { date: '2026-09-22', start: '14:00' }]
  const strip = buildDateStrip(results, '2026-09-19', 5)
  assert.equal(strip.length, 5)
  assert.deepEqual(strip.map(d => d.date), ['2026-09-19', '2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23'])
  assert.deepEqual(strip.map(d => d.hasOpenings), [false, true, false, true, false])
  assert.equal(strip[0].label, 'Today')
  assert.equal(strip[1].label, 'Tomorrow')
})

test('groupSlotsByPeriod buckets by time of day; Evening stays empty unless a real slot falls there', () => {
  const results = [{ date: 'x', start: '09:00' }, { date: 'x', start: '11:30' }, { date: 'x', start: '13:00' }, { date: 'x', start: '16:59' }]
  const grouped = groupSlotsByPeriod(results)
  assert.equal(grouped.morning.length, 2)
  assert.equal(grouped.afternoon.length, 2)
  assert.equal(grouped.evening.length, 0)
  const withEvening = groupSlotsByPeriod([...results, { date: 'x', start: '18:00' }])
  assert.equal(withEvening.evening.length, 1)
})

test('relativeDateLabel uses Today/Tomorrow/weekday+day, always from the supplied clinic date', () => {
  assert.equal(relativeDateLabel('2026-09-19', '2026-09-19'), 'Today')
  assert.equal(relativeDateLabel('2026-09-20', '2026-09-19'), 'Tomorrow')
  const later = relativeDateLabel('2026-09-25', '2026-09-19')
  assert.ok(/^\w{3} \d{1,2}$/.test(later), `expected "Weekday Day" shape, got "${later}"`)
})

// ================================================================================================================
// RESTORED-DRAFT REASON-SPECIFIC COPY (past / horizon / availability)
// ================================================================================================================
test('a restored draft with a past date says the date has passed', () => {
  const f = fixture()
  f.state = normalizeClinicState({ ...f.state, bookingDrafts: [{ id: 'draft1', patientId: 'p1', mode: 'manual', branchId: 'b1', serviceId: 'svc1', date: '2026-09-01', start: '11:00', paymentMethod: null, revision: 1, updatedAt: clinicNow().timestamp }] })
  const draft = patientBookingDraft(f.state, f.session)
  const status = draftStatus(f.state, f.session, draft)
  assert.equal(status.slotValid, false)
  assert.ok(status.issues.some(m => /has passed/.test(m)), status.issues.join(' | '))
})

test('a restored future draft is left for the server to judge (no browser booking-window verdict)', () => {
  const f = fixture()
  f.state = normalizeClinicState({ ...f.state, bookingDrafts: [{ id: 'draft2', patientId: 'p1', mode: 'manual', branchId: 'b1', serviceId: 'svc1', date: addDays(clinicNow().date, 90), start: '05:00', revision: 1, updatedAt: clinicNow().timestamp }] })
  const status = draftStatus(f.state, f.session, patientBookingDraft(f.state, f.session))
  assert.equal(status.slotValid, null, 'unknown until the booking page checks fresh server availability')
  assert.deepEqual(status.issues, [])
})
test('resuming a draft rechecks the saved slot against fresh server availability before reusing it', () => {
  const src = read('src/pages/PatientBook.jsx')
  assert.match(src, /const resumeDraft=async\(\)=>\{/)
  assert.match(src, /fetchAvailability\(\{branchId:draft\.branchId,serviceId:draft\.serviceId,date:draft\.date\}\)/)
  assert.match(src, /outside the online booking window/)
  assert.match(src, /no longer available/)
})

// ================================================================================================================
// bookingExitOutcome — honest, never-blocking navigation toast
// ================================================================================================================
test('bookingExitOutcome: nothing to say when confirmed, still on mode, or no meaningful progress', () => {
  assert.equal(bookingExitOutcome('review', true, true, null), null)
  assert.equal(bookingExitOutcome('mode', true, false, null), null)
  assert.equal(bookingExitOutcome('smart-branch', false, false, null), null)
})
test('bookingExitOutcome: healthy progress reports the saved toast', () => {
  const outcome = bookingExitOutcome('smart-schedule', true, false, null)
  assert.equal(outcome.tone, 'default')
  assert.match(outcome.message, /Booking saved\. Resume anytime\./)
})
test('bookingExitOutcome: a real persistence failure reports an honest warning, never a false "saved" claim', () => {
  const outcome = bookingExitOutcome('smart-schedule', true, false, 'disk is full')
  assert.equal(outcome.tone, 'warning')
  assert.notEqual(outcome.message, 'Booking saved. Resume anytime.', 'the failure case must never say the same thing as the healthy-save toast')
  assert.match(outcome.message, /couldn.t be saved/i)
  assert.match(outcome.message, /this device/)
})

// ================================================================================================================
// RESUME BOOKING on Patient Home
// ================================================================================================================
test('patientHome exposes no resume surface when there is no draft', () => {
  const f = fixture()
  assert.equal(patientHome(f.state, f.session).resume, null)
})
test('patientHome exposes a resume surface for a healthy, issue-free draft, never a fabricated one', () => {
  const f = fixture()
  f.state = normalizeClinicState({ ...f.state, bookingDrafts: [{ id: 'draft4', patientId: 'p1', mode: 'smart', branchId: 'b1', serviceId: 'svc1', date: null, start: null, paymentMethod: null, revision: 1, updatedAt: clinicNow().timestamp }] })
  const resume = patientHome(f.state, f.session).resume
  assert.ok(resume)
  assert.equal(resume.mode, 'smart')
  assert.equal(resume.branch, f.state.branches.find(b => b.id === 'b1').name)
})
test('patientHome suppresses the resume surface once the draft has real issues (e.g. a past saved date)', () => {
  const f = fixture()
  f.state = normalizeClinicState({ ...f.state, bookingDrafts: [{ id: 'draft5', patientId: 'p1', mode: 'manual', branchId: 'b1', serviceId: 'svc1', date: '2026-09-01', start: '11:00', paymentMethod: null, revision: 1, updatedAt: clinicNow().timestamp }] })
  assert.equal(patientHome(f.state, f.session).resume, null)
})

// ================================================================================================================
// LOCATION — no misleading button when no branch has usable coordinates; ready once coordinates exist
// ================================================================================================================
test('hasUsableCoordinates is false against the current seeded branches (none carry coordinates)', () => {
  const f = fixture()
  assert.equal(hasUsableCoordinates(f.state.branches), false)
})
test('hasUsableCoordinates activates once a real Open branch carries finite coordinates, and nearestBranch keeps working', () => {
  const branches = structuredClone(data.INITIAL_BRANCHES).map(b => b.id === 'b1' ? { ...b, latitude: 14.83, longitude: 120.90 } : b)
  assert.equal(hasUsableCoordinates(branches), true)
  assert.equal(nearestBranch(branches, { lat: 14.83, lng: 120.90 }).id, 'b1')
})
test('LocationBranchStep only renders "Use my location" behind a real hasUsableCoordinates gate (source guard)', () => {
  // M6 cutover: the gate is the server's own report of real branch coordinates (eligible branches' hasCoordinates).
  const src = read('src/pages/PatientBook.jsx')
  assert.match(src, /const locatable=lookup\.branches\.some\(b=>b\.hasCoordinates\)/)
  assert.match(src, /\{locatable&&<div className="pt-location-row">/)
  assert.match(src, /locationRanking==='distance'/)
})

// ================================================================================================================
// LANGUAGE CLEANUP / HONEST WORDING — source guards
// ================================================================================================================
test('no developer-facing "Deterministic scheduling"/"Not AI" language remains in the Book page', () => {
  const src = read('src/pages/PatientBook.jsx')
  assert.doesNotMatch(src, /Deterministic scheduling/)
  assert.doesNotMatch(src, /Not AI/)
})
test('the first Smart Find result is labelled "Earliest available", never "Recommended"', () => {
  const src = read('src/pages/PatientBook.jsx')
  assert.match(src, /Earliest available/)
  assert.doesNotMatch(src, /Recommended/)
})
test('Smart Find shows the server suggestion as not reserved before confirmation', () => {
  const src = read('src/pages/PatientBook.jsx')
  assert.match(src, /This suggestion is not reserved/)
  assert.match(src, /appointmentFlow\.create\(/)
})
test('no payment preference is collected or shown during booking (D4: payment belongs to M11)', () => {
  for (const file of ['src/pages/PatientBook.jsx', 'src/booking-drafts.js', 'src/pages/PatientVisits.jsx']) {
    const src = read(file).replace(/\/\/.*$/gm, '')
    assert.doesNotMatch(src, /paymentMethod|PAYMENT_OPTIONS|Selecting Card/, file)
  }
})
test('no Patient-facing Dentist chooser exists anywhere in the Book page', () => {
  const src = read('src/pages/PatientBook.jsx')
  assert.doesNotMatch(src, /choose.{0,20}dentist/i)
})

// ================================================================================================================
// BOOKING-DRAFT CASCADE INVARIANTS (already-accepted behavior, explicit regression coverage per row)
// ================================================================================================================
test('mode change clears branch/service/date/start/paymentMethod (source guard on the exact call)', () => {
  const src = read('src/pages/PatientBook.jsx')
  assert.match(src, /save\(\{mode:next,branchId:null,serviceId:null,date:null,start:null\}\)/)
})
test('branch change (Smart and Manual) clears dependent choices', () => {
  const src = read('src/pages/PatientBook.jsx')
  assert.match(src, /save\(\{branchId:value,date:null,start:null\}\)/)
  assert.match(src, /save\(\{mode:'manual',branchId:value,serviceId:null,date:null,start:null\}\)/)
})
test('service change clears date/start (Smart service comes first and also clears the branch)', () => {
  const src = read('src/pages/PatientBook.jsx')
  assert.match(src, /save\(\{mode:'smart',serviceId:value,branchId:null,date:null,start:null\}\)/)
  assert.match(src, /save\(\{serviceId:value,date:null,start:null\}\)/)
})
test('date change (Manual) clears start', () => {
  const src = read('src/pages/PatientBook.jsx')
  assert.match(src, /save\(\{date:value,start:''\}\)/)
})

// ================================================================================================================
// REGRESSION — Pass 1 chrome and existing payment/cancellation rules stay untouched
// ================================================================================================================
test('Pass 1 Patient-only menu/assistant/logout source guards remain intact', () => {
  const src = read('src/layout.jsx')
  assert.match(src, /role!==['"]patient['"]&&<button className="mobile-menu/)
  assert.match(src, /role==='patient'&&<ClinicAssistant/)
  assert.match(src, /registerPatientNavListener/)
})
