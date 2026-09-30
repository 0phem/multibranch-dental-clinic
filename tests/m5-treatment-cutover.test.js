import test, { beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { setClockSource } from '../src/clock.js'
import * as treatmentsApi from '../src/treatments-api.js'
import { __resetCsrfCacheForTests, onSessionInvalidated } from '../src/api-client.js'
import { buildServerProjection, classifyLegacy } from '../src/appointment-projection.js'
import { persistableCollection, sessionForRole } from '../src/contracts.js'
import { prescriptionTasks } from '../src/phase2.js'
import { patientCare } from '../src/patient-view.js'
import * as data from '../src/data.js'
import { serverId } from './support/server-appointments.js'
import { row, world } from './support/mock-server-world.js'

// M5 cutover: Laravel/PostgreSQL is the ONLY authority for the clinical Treatment record (anchored to the server Visit).
// These tests exercise the real client, projection, flows and transitional downstream adapters against mocked HTTP / a
// mocked server (the server rules themselves are covered by backend/tests/Feature/Treatments).

beforeEach(() => setClockSource(() => new Date('2026-09-19T02:08:00Z')))
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const treatmentRow = (fields = {}) => ({
  id: serverId(6000), status: 'In Treatment', revision: 2, clinic_date: '2026-09-19', started_at: '2026-09-19T10:10:00+08:00', completed_at: null, author: true,
  visit: { id: serverId(4000), status: 'In Treatment', revision: 2, source: 'appointment', queue: { id: serverId(7000), status: 'Served' } },
  patient: { id: serverId(500), code: 'PAT-0500', name: 'Server Patient' }, branch: { id: 'b1', name: 'Branch A' }, dentist: { id: 'd1', name: 'Miguel Reyes' },
  appointment: { id: serverId(900), code: 'APT-2026-000900', status: 'In Treatment' }, requested_service: { id: 'svc1', name: 'Dental Consultation' },
  prescription_required: false, followup_required: true,
  procedures: [{ id: serverId(6100), line_no: 1, service: { id: 'svc1', code: 'SVC1', name: 'Dental Consultation' }, quantity: 1, notes: 'Upper' }],
  chief_complaint: 'Sensitivity', treatment_plan: 'Review', procedure_summary: 'Consultation', clinical_notes: 'Tolerated well.',
  assistant: { id: 's2', name: 'Nina Torres' }, followup_recommended_date: '2026-10-01', followup_reason: 'Review', followup_interval: '2 weeks', ...fields,
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
// TREATMENT CLIENT
// ================================================================================================================
test('mapTreatment keeps public ids, server status and lines without any money; Owner rows are summary-only', () => {
  const t = treatmentsApi.mapTreatment(treatmentRow(), id => (id === serverId(500) ? 'p1' : id))
  assert.deepEqual([t.id, t.server, t.patientId, t.visitId, t.queueEntryId, t.appointmentId, t.status, t.revision], [serverId(6000), true, 'p1', serverId(4000), serverId(7000), serverId(900), 'In Treatment', 2])
  assert.deepEqual([t.complaint, t.plan, t.procedure, t.notes, t.followupDate], ['Sensitivity', 'Review', 'Consultation', 'Tolerated well.', '2026-10-01'])
  assert.deepEqual(Object.keys(t.procedures[0]).sort(), ['id', 'lineNo', 'notes', 'quantity', 'serviceCode', 'serviceId', 'serviceName', 'treatmentId'])
  assert.equal(t.summaryOnly, false)
  const { chief_complaint, treatment_plan, procedure_summary, clinical_notes, followup_reason, followup_recommended_date, assistant, ...summary } = treatmentRow()
  const owner = treatmentsApi.mapTreatment(summary)
  assert.equal(owner.summaryOnly, true); assert.equal(owner.notes, ''); assert.equal(owner.complaint, '')
})

test('the Patient subset carries only date, procedure summary, service names and the Dentist name (plus its own id)', () => {
  const t = treatmentsApi.mapPatientTreatment({ id: serverId(6000), date: '2026-09-19', procedure_summary: 'Consultation', services: [{ name: 'Dental Consultation' }], dentist: { name: 'Miguel Reyes' } }, 'p1')
  assert.deepEqual([t.patientSubset, t.status, t.patientId, t.procedure, t.dentistName, t.procedures[0].serviceName], [true, 'Completed', 'p1', 'Consultation', 'Miguel Reyes', 'Dental Consultation'])
  for (const hidden of ['complaint', 'plan', 'notes', 'prescriptionRequired', 'followupRequired', 'history', 'branchId', 'appointmentId', 'dentistId', 'visitId', 'serviceId'])
    assert.equal(hidden in t || hidden in t.procedures[0], false, hidden)
})

test('loads Treatments in the bounded window with paging; the Patient uses /treatments/mine only', async () => {
  mockFetch((path) => {
    if (path.startsWith('/api/treatments/mine')) return json(200, { data: [] })
    const page = Number(new URL(`http://x${path}`).searchParams.get('page'))
    return json(200, { data: [treatmentRow({ id: serverId(6000 + page) })], meta: { current_page: page, last_page: 2 } })
  })
  const result = await treatmentsApi.loadTreatments('2026-09-19')
  assert.equal(result.ok, true); assert.equal(result.rows.length, 2)
  const params = new URL(`http://x${apiCalls()[0].path}`).searchParams
  assert.deepEqual([params.get('from'), params.get('to'), params.get('per_page')], ['2026-06-21', '2026-12-21', '100'])
  await treatmentsApi.loadMyTreatments()
  assert.equal(apiCalls().at(-1).path, '/api/treatments/mine', 'no Patient id parameter is ever sent')
})

test('start / document / complete send named commands with Idempotency-Key and expected_revision, never a status or a price', async () => {
  mockFetch(() => json(200, { data: treatmentRow() }))
  const t = treatmentsApi.mapTreatment(treatmentRow())
  await treatmentsApi.startTreatment({ id: serverId(4000), revision: 1 }, 'start-1')
  await treatmentsApi.documentTreatment(t, { complaint: ' Sensitivity ', plan: '', procedure: 'Consultation', notes: 'x', prescriptionRequired: true, followupRequired: false, followupDate: '2026-10-01', followupReason: 'ignored',
    procedures: [{ id: serverId(6100), serviceId: 'svc1', quantity: '2', notes: '', unitFee: 999, amount: 999 }, { id: serverId(6100), serviceId: 'svc2', quantity: 1 }, { serviceId: 'svc2', quantity: 1 }] }, 'doc-1')
  await treatmentsApi.completeTreatment(t, 'done-1')
  const [start, doc, complete] = apiCalls()
  assert.deepEqual([start.method, start.path, start.body, start.headers['Idempotency-Key']], ['POST', `/api/visits/${serverId(4000)}/treatment`, { expected_revision: 1 }, 'start-1'])
  assert.deepEqual([doc.path, doc.headers['Idempotency-Key'], doc.body.expected_revision], [`/api/treatments/${serverId(6000)}/document`, 'doc-1', 2])
  assert.deepEqual([doc.body.chief_complaint, doc.body.treatment_plan, doc.body.prescription_required, doc.body.followup_required], ['Sensitivity', null, true, false])
  assert.deepEqual([doc.body.followup_recommended_date, doc.body.followup_reason], [null, null], 'no follow-up fields without a follow-up decision')
  assert.deepEqual(doc.body.procedures, [
    { id: serverId(6100), service_ref: 'svc1', quantity: 2, notes: null },
    { service_ref: 'svc2', quantity: 1, notes: null },   // the saved line's id with another service becomes a new line
    { service_ref: 'svc2', quantity: 1, notes: null },
  ])
  assert.doesNotMatch(JSON.stringify(doc.body), /fee|amount|price|subtotal/i)
  assert.deepEqual([complete.path, complete.body], [`/api/treatments/${serverId(6000)}/complete`, { expected_revision: 2 }])
  for (const call of [start, doc, complete]) assert.equal('status' in call.body, false)
})

test('M5 refusals keep their codes with treatment wording; a 401 reaches the shared session-invalidated path', async () => {
  mockFetch(path => (path.endsWith('/document')
    ? json(409, { message: 'changed', code: 'stale_revision' })
    : path.endsWith('/treatment') ? json(409, { message: 'exists', code: 'treatment_exists' }) : json(401, { message: 'Unauthenticated.' })))
  const seen = []; unsubscribe = onSessionInvalidated(() => seen.push(1))
  const stale = await treatmentsApi.documentTreatment(treatmentsApi.mapTreatment(treatmentRow()), { procedures: [] }, 'k')
  assert.deepEqual([stale.kind, stale.code], ['conflict', 'stale_revision']); assert.match(stale.message, /re-apply your unsaved changes/)
  const exists = await treatmentsApi.startTreatment({ id: serverId(4000), revision: 1 }, 'k2')
  assert.match(exists.message, /already started/)
  const expired = await treatmentsApi.completeTreatment(treatmentsApi.mapTreatment(treatmentRow()), 'k3')
  assert.equal(expired.kind, 'unauthenticated'); assert.equal(seen.length, 1)
})

// ================================================================================================================
// PROJECTION, PERSISTENCE AND LEGACY
// ================================================================================================================
test('server Treatments are an in-memory projection: never persisted, never written by a local patch', () => {
  const projection = buildServerProjection({ treatmentRows: [treatmentRow()] })
  assert.equal(projection.treatments[0].server, true)
  assert.equal(persistableCollection('treatments', projection.treatments).length, 0)
  const store = read('src/store.jsx')
  assert.match(store, /treatments:_ignoredTreatments,hmo:_ignoredHmo,claimDecisions:_ignoredClaimDecisions,\.\.\.patch\}=rawPatch/, 'commit() drops any local treatment patch')
  assert.doesNotMatch(store, /localStorage\.removeItem/, 'the pre-server history key is never cleared')
  // A Patient projection only ever holds its own subset rows.
  const patientView = buildServerProjection({ treatmentRows: [treatmentRow()], myTreatmentRows: [], session: { role: 'patient', patientId: 'p1' } })
  assert.equal(patientView.treatments.every(t => t.server), true)
})

test('browser-local treatments are read-only pre-server history; only exact Visit links stay non-demo history', () => {
  const { treatments } = classifyLegacy({ treatments: [
    { id: 'pre', visitId: serverId(4000), appointmentId: serverId(900), status: 'Completed', patientId: 'p1', dentistId: 'd1', branchId: 'b1', prescriptionRequired: true, procedures: [] },
    { id: 'demo', appointmentId: 'old-a4', status: 'Completed', patientId: 'p4' },
  ] })
  assert.deepEqual(treatments.map(t => [t.id, t.server, t.preServer, !!t.legacyAppointment]), [['pre', false, true, false], ['demo', false, true, true]])
  const stored = persistableCollection('treatments', treatments)
  assert.equal(stored.length, 2, 'history stays in the browser key')
  for (const row of stored) for (const flag of ['server', 'preServer', 'legacyAppointment']) assert.equal(flag in row, false, flag)
  // Pre-server history starts no new prescription task.
  const dentistState = { ...Object.fromEntries(['users', 'persons', 'dentists', 'patients', 'branches', 'staff'].map(k => [k, data[`INITIAL_${k.toUpperCase()}`]])), treatments, prescriptions: [], visits: [] }
  assert.equal(prescriptionTasks(dentistState, sessionForRole('dentist', dentistState)).length, 0)
  assert.equal(data.INITIAL_TREATMENTS.every(t => !String(t.appointmentId).match(/^[0-9a-z]{26}$/)), true, 'demo seeds are never live')
})

test('no browser Treatment authority remains', () => {
  const workflow = read('src/workflow.js')
  assert.doesNotMatch(workflow, /saveTreatment|completeTreatment|uid\('t'\)|dentalHistory|state\.treatments=/)
  assert.doesNotMatch(read('src/phase2.js'), /export function procedureLines/)
  assert.doesNotMatch(read('src/appointment-flow.js'), /transitionVisit|start-treatment|preflight/)
  for (const path of ['src/workflow.js', 'src/phase2.js', 'src/communication.js', 'src/loyalty.js', 'src/administration.js'])
    assert.doesNotMatch(read(path), /state\.treatments\s*=/, `${path} never writes treatments`)
})

// ================================================================================================================
// SERVER-FIRST FLOWS (real appointment-flow.js over the mocked server)
// ================================================================================================================
async function called(w) {
  const a = w.seed(row())
  await w.flow.checkIn(a.id, 'arrive')
  const entry = w.state.queue[0]
  w.role('dentist'); await w.flow.queueCommand(entry, 'call', 'call-1')
  return w.state.queue[0]
}

test('start, document and complete are server commands; another session sees the same documentation after refresh', async () => {
  const w = world(); const entry = await called(w)
  const patchesBefore = w.patches.length
  const started = await w.flow.startTreatment(entry)
  assert.equal(started.ok, true, started.message)
  assert.deepEqual([w.state.queue[0].status, w.state.visits[0].status, w.state.appointments[0].status, started.record.status], ['Served', 'In Treatment', 'In Treatment', 'In Treatment'])
  const saved = await w.flow.saveTreatment(started.record, { complaint: 'Sensitivity', procedure: 'Consultation', notes: 'Tolerated well.', procedures: [{ serviceId: 'svc1', quantity: 1 }, { serviceId: 'svc2', quantity: 2 }] })
  assert.equal(saved.ok, true, saved.message); assert.equal(saved.record.revision, 2); assert.equal(saved.record.procedures.length, 2)
  assert.equal(w.patches.length, patchesBefore, 'no local write for start or documentation')

  // Another browser/session (Staff in scope) refreshes and reads the same server documentation, read-only.
  w.role('staff'); await w.flow.refresh()
  const seen = w.state.treatments.find(t => t.server)
  assert.deepEqual([seen.notes, seen.procedure, seen.author, seen.procedures.map(p => p.quantity)], ['Tolerated well.', 'Consultation', false, [1, 2]])
  assert.equal((await w.flow.saveTreatment(seen, { notes: 'Staff edit' })).ok, false, 'Staff cannot document')

  w.role('dentist'); await w.flow.refresh()
  const current = w.state.treatments.find(t => t.server)
  const done = await w.flow.completeTreatment(current)
  assert.equal(done.ok, true, done.message)
  assert.deepEqual([done.record.status, w.state.visits[0].status, w.state.appointments[0].status, w.state.queue[0].status], ['Completed', 'Completed', 'Completed', 'Served'])
  assert.deepEqual(w.log.filter(x => x[0].startsWith('treatment.')).map(x => x[0]), ['treatment.start', 'treatment.document', 'treatment.complete'])
})

test('a stale save refreshes, keeps the unsaved text for the Dentist and never overwrites the newer server record', async () => {
  const w = world(); const entry = await called(w)
  const t = (await w.flow.startTreatment(entry, { complaint: 'First' })).record
  assert.equal(t.revision, 2)
  const opened = { ...t, revision: 1 }                   // this tab opened the record before that save
  const form = { complaint: 'Tab B text', procedures: [] }
  const stale = await w.flow.saveTreatment(opened, form)
  assert.equal(stale.ok, false); assert.equal(stale.code, 'stale_revision')
  assert.equal(w.log.at(-1)[0], 'refresh', 'the projection is refreshed after a conflict')
  assert.equal(w.state.treatments.find(x => x.server).complaint, 'First', 'the newer server record is untouched')
  assert.equal(form.complaint, 'Tab B text', 'the form text is never discarded by the flow')
})

test('completion does not depend on the browser invoice; every authorized browser reconciles the handoffs once by Treatment id', async () => {
  const w = world(); const entry = await called(w)
  const t = (await w.flow.startTreatment(entry, { procedure: 'Consultation', procedures: [{ serviceId: 'svc1', quantity: 1 }], followupRequired: true, followupReason: 'Recall', prescriptionRequired: true })).record
  const done = await w.flow.completeTreatment(t)
  assert.equal(done.ok, true, done.message)
  const invoice = w.state.invoices[0]
  assert.deepEqual([invoice.id, invoice.treatmentId, invoice.visitId, invoice.status, invoice.total], [`inv-${t.id}`, t.id, t.visitId, 'Draft', 600])
  assert.equal(w.state.followups[0].id, `f-${t.id}`)
  assert.equal(w.state.workflowLog.filter(e => e.eventType === 'clinical.prescription.required').length, 1)

  // A Staff browser that never saw the completion (no local downstream records) reconciles the same projections once.
  w.state = { ...w.state, invoices: [], followups: [], workflowLog: [], notifications: [] }
  w.role('staff'); await w.flow.refresh()
  const before = structuredClone(w.state.treatments.find(x => x.server))
  assert.equal(w.actions.reconcileTreatmentHandoffs().ok, true)
  w.actions.reconcileTreatmentHandoffs()
  assert.deepEqual(w.state.invoices.map(i => i.id), [`inv-${t.id}`], 'created once, keyed by the Treatment public id')
  assert.deepEqual(w.state.followups.map(f => f.id), [`f-${t.id}`])
  assert.deepEqual(w.state.notifications.filter(n => !String(n.eventType).startsWith('hmo.')), [], 'M5 reconciliation creates no notification (M18 owns delivery)')
  assert.deepEqual(w.state.treatments.find(x => x.server), before, 'reconciliation never changes the server Treatment')
  // The Owner summary never drives local clinical handoffs.
  w.state = { ...w.state, invoices: [] }; w.role('owner'); await w.flow.refresh()
  w.actions.reconcileTreatmentHandoffs(); assert.equal(w.state.invoices.length, 0)
})

test('only the author may save or complete; another Dentist is refused before any server call', async () => {
  const w = world(); const entry = await called(w)
  const t = (await w.flow.startTreatment(entry)).record
  const before = w.log.length
  const foreign = { ...t, author: false }
  assert.equal((await w.flow.saveTreatment(foreign, { notes: 'x' })).ok, false)
  assert.equal((await w.flow.completeTreatment(foreign)).ok, false)
  assert.equal(w.log.length, before, 'nothing was sent')
})

test('the Patient care history reads the server subset, and completion no longer appends to dentalHistory', async () => {
  const w = world(); const entry = await called(w)
  const t = (await w.flow.startTreatment(entry, { procedure: 'Consultation', notes: 'internal', procedures: [{ serviceId: 'svc1', quantity: 1 }] })).record
  const history = w.state.patients.find(p => p.id === 'p1').dentalHistory
  await w.flow.completeTreatment(t)
  assert.equal(w.state.patients.find(p => p.id === 'p1').dentalHistory, history, 'no live append to the legacy text')
  const subset = treatmentsApi.mapPatientTreatment({ id: t.id, date: t.date, procedure_summary: 'Consultation', services: [{ name: 'Dental Consultation' }], dentist: { name: 'Miguel Reyes' } }, 'p1')
  w.role('patient')
  const care = patientCare({ ...w.state, treatments: [subset], visitsProjected: false }, w.session)
  assert.deepEqual(care.map(c => [c.procedure, c.services[0]]), [['Consultation', 'Dental Consultation']])
  assert.doesNotMatch(JSON.stringify(care), /internal/)
})

test('Patient Billing / Visit / HMO views link to the narrowed subset only through their own exact records', async () => {
  const w = world(); const entry = await called(w)
  const t = (await w.flow.startTreatment(entry, { procedure: 'Consultation', procedures: [{ serviceId: 'svc1', quantity: 1 }], prescriptionRequired: true })).record
  await w.flow.completeTreatment(t)
  const appointment = w.state.appointments[0]
  w.state = { ...w.state, invoices: w.state.invoices.map(i => ({ ...i, status: 'Issued' })) }
  const subset = treatmentsApi.mapPatientTreatment({ id: t.id, date: t.date, procedure_summary: 'Consultation', services: [{ name: 'Dental Consultation' }], dentist: { name: 'Miguel Reyes' } }, 'p1')
  w.role('patient')
  const patientState = { ...w.state, treatments: [subset], visitsProjected: false }
  const { patientVisitDetail, patientInvoices, patientCare } = await import('../src/patient-view.js')
  assert.equal(patientInvoices(patientState, w.session).length, 1, 'the M11 invoice still reaches the Patient by its own treatmentId link')
  const detail = patientVisitDetail(patientState, w.session, appointment)
  assert.equal(detail.procedure, 'Consultation'); assert.equal(detail.links.invoice, w.state.invoices[0].id)
  assert.equal(patientCare(patientState, w.session)[0].appointmentId, appointment.id, 'visit link comes from the exact invoice record')
  // Without an exact record of another module, nothing is inferred (no date / Dentist / service matching).
  const unlinked = { ...patientState, invoices: [] }
  assert.equal(patientVisitDetail(unlinked, w.session, appointment), null)
  assert.equal(patientCare(unlinked, w.session)[0].appointmentId, null)
})

test('a save that succeeds before a refused completion is reported as saved, never as rolled back', async () => {
  const w = world(); const entry = await called(w)
  const t = (await w.flow.startTreatment(entry)).record
  const result = await w.flow.completeTreatment(t, { procedure: 'Consultation', procedures: [] }, { dirty: true })
  assert.equal(result.ok, false); assert.equal(result.saved, true)
  assert.match(result.message, /Your documentation was saved, but the treatment was not completed: Confirm at least one performed procedure/)
  assert.equal(result.record.revision, 2); assert.equal(result.record.procedure, 'Consultation'); assert.equal(result.record.status, 'In Treatment')
})
