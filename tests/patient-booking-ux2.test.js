import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as data from '../src/data.js'
import { setClockSource, clinicNow, maxBookingDate, addDays } from '../src/clock.js'
import { normalizeClinicState, sessionForRole } from '../src/contracts.js'
import { createWorkflowActions } from '../src/workflow.js'
import { findOpenTimes, FIND_TIME_DEFAULT_WINDOW_DAYS } from '../src/scheduling.js'
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
test('a low result limit truncates the search before reaching a later day; limit:Infinity does not', () => {
  const f = fixture()
  const form = { branchId: 'b1', serviceId: 'svc1', patientId: 'p1' }
  // Fresh seed data has no existing appointments, so day 1 alone already offers several open slots —
  // easily enough to exceed a deliberately small limit before the day-loop ever reaches day 5.
  const truncated = findOpenTimes(f.state, form, { windowDays: 5, limit: 2 })
  assert.equal(truncated.length, 2, 'the small limit caps the result count')
  assert.ok(truncated.every(r => r.date === truncated[0].date), 'every result came from the same (first) day — later days were never reached')
  const laterDate = addDays('2026-09-19', 4)
  assert.ok(!truncated.some(r => r.date === laterDate), 'the later day is absent from the truncated results')

  const exhaustive = findOpenTimes(f.state, form, { windowDays: 5, limit: Number.POSITIVE_INFINITY })
  assert.ok(exhaustive.some(r => r.date === laterDate), 'the later day is genuinely searched and its real opening appears once the limit cannot truncate the day loop')

  // buildDateStrip must reflect this proven fact, not a guess from a truncated list.
  const strip = buildDateStrip(exhaustive, '2026-09-19', 5)
  const laterEntry = strip.find(d => d.date === laterDate)
  assert.equal(laterEntry.hasOpenings, true, 'a genuinely-searched day with a real opening is never marked unavailable')
  assert.equal(strip.length, 5, 'one entry per day across the whole window')
  for (const day of strip) assert.ok('hasOpenings' in day && typeof day.hasOpenings === 'boolean', 'every day resolves to a real boolean — never a third "not checked" state')
})

test('findOpenTimes accepts limit:Infinity safely (no NaN/coercion issue)', () => {
  const f = fixture()
  const results = findOpenTimes(f.state, { branchId: 'b1', serviceId: 'svc1', patientId: 'p1' }, { windowDays: FIND_TIME_DEFAULT_WINDOW_DAYS, limit: Number.POSITIVE_INFINITY })
  assert.ok(Array.isArray(results))
  assert.ok(results.every(r => typeof r.date === 'string' && typeof r.start === 'string' && typeof r.dentistId === 'string'))
})

// ================================================================================================================
// DATE-STRIP / TIME-CHIP HELPERS
// ================================================================================================================
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

test('a restored draft beyond the two-month horizon says so, distinctly from a past date', () => {
  const f = fixture()
  const beyond = addDays(maxBookingDate(), 5)
  f.state = normalizeClinicState({ ...f.state, bookingDrafts: [{ id: 'draft2', patientId: 'p1', mode: 'manual', branchId: 'b1', serviceId: 'svc1', date: beyond, start: '11:00', paymentMethod: null, revision: 1, updatedAt: clinicNow().timestamp }] })
  const draft = patientBookingDraft(f.state, f.session)
  const status = draftStatus(f.state, f.session, draft)
  assert.equal(status.slotValid, false)
  assert.ok(status.issues.some(m => /two-month booking window/.test(m)), status.issues.join(' | '))
  assert.ok(!status.issues.some(m => /has passed/.test(m)))
})

test('a restored draft for a future, otherwise-unavailable slot gets the availability message', () => {
  const f = fixture()
  // A time genuinely outside branch operating hours fails validateAppointment's 'branch-hours' check for
  // EVERY eligible dentist regardless of pool size — a real, deterministic unavailability, not fabricated.
  const branch = f.state.branches.find(b => b.id === 'b1')
  assert.ok(branch.open > '05:00', 'sanity: 05:00 is genuinely before this branch opens')
  f.state = normalizeClinicState({ ...f.state, bookingDrafts: [{ id: 'draft3', patientId: 'p1', mode: 'manual', branchId: 'b1', serviceId: 'svc1', date: '2026-09-21', start: '05:00', paymentMethod: null, revision: 1, updatedAt: clinicNow().timestamp }] })
  const draft = patientBookingDraft(f.state, f.session)
  const status = draftStatus(f.state, f.session, draft)
  assert.equal(status.slotValid, false)
  assert.ok(status.issues.some(m => /no longer available/.test(m)), status.issues.join(' | '))
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
  const src = read('src/pages/PatientBook.jsx')
  assert.match(src, /const locatable=hasUsableCoordinates\(openBranches\)/)
  assert.match(src, /\{locatable&&<div className="pt-location-row">/)
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
test('Smart Find searches the full window before rendering its date and time controls', () => {
  const f=fixture()
  const results=findOpenTimes(f.state,{branchId:'b1',serviceId:'svc1',patientId:'p1'},{limit:Number.POSITIVE_INFINITY})
  const days=buildDateStrip(results,clinicNow().date,FIND_TIME_DEFAULT_WINDOW_DAYS)
  assert.ok(days.some(day=>day.hasOpenings))
  const first=results.find(result=>result.date===days.find(day=>day.hasOpenings).date)
  assert.ok(first?.start)
})
test('the inline Card note states the exact required wording, with no modal introduced for it', () => {
  const src = read('src/pages/PatientBook.jsx')
  assert.match(src, /Selecting Card does not complete payment\. Once a card payment is successfully completed, this appointment can no longer be cancelled online\./)
  assert.doesNotMatch(src, /About card payment/)
})
test('no Pass 2 source file describes the payment domain as server-authoritative/server-hardcoded', () => {
  for (const file of ['src/pages/PatientBook.jsx', 'src/workflow.js']) {
    const src = read(file)
    assert.doesNotMatch(src, /server-authoritative/i)
    assert.doesNotMatch(src, /server-hardcoded/i)
    assert.doesNotMatch(src, /server-owned/i)
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
  assert.match(src, /save\(\{mode:next,branchId:null,serviceId:null,date:null,start:null,paymentMethod:null\}\)/)
})
test('branch change (Smart and Manual) clears service/date/start/paymentMethod', () => {
  const src = read('src/pages/PatientBook.jsx')
  assert.match(src, /save\(\{mode:'smart',branchId:value,serviceId:null,date:null,start:null,paymentMethod:null\}\)/)
  assert.match(src, /save\(\{mode:'manual',branchId:value,serviceId:null,date:null,start:null,paymentMethod:null\}\)/)
})
test('service change clears date/start/paymentMethod', () => {
  const src = read('src/pages/PatientBook.jsx')
  const matches = [...src.matchAll(/save\(\{serviceId:value,date:null,start:null,paymentMethod:null\}\)/g)]
  assert.equal(matches.length, 2, 'both Smart and Manual service-pick cascades')
})
test('date change (Manual) clears start/paymentMethod', () => {
  const src = read('src/pages/PatientBook.jsx')
  assert.match(src, /save\(\{date:value,start:'',paymentMethod:null\}\)/)
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
test('Card selection alone never creates a paid state (existing accepted rule, reconfirmed)', () => {
  const f = fixture()
  const record = ok(f.actions.saveAppointment({ patientId: 'p1', branchId: 'b1', dentistId: 'd2', serviceId: 'svc1', date: '2026-09-20', start: '11:00', paymentMethod: 'card', paymentStatus: 'paid' }))
  assert.equal(record.paymentStatus, 'unpaid')
})
