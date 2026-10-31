import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { QueuePage, CheckInPage } from '/src/pages/PatientFlow.jsx'
import { AppointmentsPage } from '/src/pages/Scheduling.jsx'
import { PatientsPage } from '/src/pages/Clinical.jsx'
import { LeavePage, WorkSchedulesPage } from '/src/pages/Staffing.jsx'
import { StaffOnDuty } from '/src/pages/StaffOnDuty.jsx'
import { clinicDate } from '/src/clock.js'
import '/src/styles.css'
import '/src/foundation.css'
import '/src/patient.css'
import '/src/polish.css'
import '/src/automations.css'

// No seed Patient/employee data is imported. All commands and every fetch terminate here.
const params = new URLSearchParams(location.search)
const role = params.get('role') || 'staff'
const today = clinicDate()
const branch = { id: 'b1', name: 'Fictional B8 Branch', status: 'Open', editable: role === 'owner' }
const patients = ['Alpha', 'Beta'].map((name, i) => ({
  id: `b8-public-${i}`, publicId: `b8-public-${i}`, serverProjection: true,
  name: `Fictional ${name} Patient`, patientCode: `B8-${i}`, preferredBranchId: 'b1',
}))
const appointments = patients.map((p, i) => ({
  id: `b8-appointment-${i}`, appointmentNo: `B8-APPT-${i}`, patientId: p.id, patientPublicId: p.id,
  patientName: p.name, branchId: 'b1', branch: branch.name, dentistId: 'd1', serviceId: 'svc1',
  service: 'Fictional consultation', date: today, start: i ? '14:00' : '13:00', duration: 30, status: 'Confirmed',
}))
const queue = patients.map((p, i) => ({
  id: `b8-queue-${i}`, visitId: `b8-visit-${i}`, appointmentId: appointments[i].id,
  patientId: p.id, patientPublicId: p.id, patientName: p.name, patientCode: p.patientCode,
  dentistId: 'd1', branchId: 'b1', branch: branch.name, serviceId: 'svc1',
  clinicDate: today, status: 'Waiting', queueNumber: i + 1, position: i + 1, revision: 3,
}))
const fixture = window.b8 = {
  events: [], requests: [], unexpected: [], today, patients, appointments, queue,
  dutyMode: params.get('duty') || 'ready', canDecide: params.get('decide') === 'yes',
}
const response = (data, status = 200, meta = undefined) => ({ ok: status < 400, status, headers: {}, json: async () => ({ data, meta }) })
const duty = () => ({ date: fixture.dutyMode === 'stale' ? '2000-01-01' : today, as_of: `${today}T10:00:00+08:00`, rows: [
  { dentist_id: 'd1', dentist_name: 'Fictional B8 Dentist', branch_id: 'b1', branch_name: branch.name, on_duty_today: true, working_now: false },
] })
const leave = () => ({ id: 'b8-leave', requester: { name: 'Fictional B8 Requester', role: 'Staff' }, label: 'Fictional leave window', type_label: 'Vacation', status: 'Pending', can_decide: fixture.canDecide, can_cancel: false })
window.fetch = async (url, options = {}) => {
  const path = new URL(String(url), location.origin).pathname
  const method = options.method || 'GET'
  fixture.requests.push({ path, method, body: options.body ? JSON.parse(options.body) : null })
  if (path === '/sanctum/csrf-cookie') return response(null, 204)
  if (path === '/api/work-schedules') {
    if (fixture.dutyMode === 'forbidden') return response(null, 403)
    if (fixture.dutyMode === 'failed') return response(null, 500)
    const hours = Object.fromEntries([1, 2, 3, 4, 5, 6].map(d => [d, { open: '09:00', close: '18:00' }]))
    return response({ dentists: [{ id: 'd1', userId: 'b8-user', name: 'Fictional B8 Dentist', branches: [branch], weekly: [], profile_hours: { start: '09:00', end: '17:00' } }], staff: [], exceptions: [], branches: [{ ...branch, hours }], weekdays: { 7: 'Sunday', 2: 'Tuesday', 1: 'Monday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' }, duty: fixture.dutyMode === 'missing' ? null : duty(), wording_approved: false })
  }
  if (path.endsWith('/affected')) return response({ affected: [], wording_approved: false })
  if (path === '/api/leave/calendar' || path === '/api/leave/mine') return response([])
  if (path === '/api/leave' && method === 'GET') return response([leave()], 200, { approver: 'owner', wording_approved: false })
  if (path === '/api/leave' && method === 'POST') return response({ id: 'b8-created-leave' }, 201)
  if (path.endsWith('/decide')) return response({ status: 'Approved', appointments: [] })
  if (path.startsWith('/api/patients/')) {
    const p = patients.find(p => path === `/api/patients/${p.id}`)
    if (p) return response({ ...p, code: p.patientCode, profile_access: 'identity' })
    if (patients.some(p => path === `/api/patients/${p.id}/records`)) return response({ appointments: [], visits: [], treatments: [], invoices: [], hmo_cases: [] })
  }
  if (path === '/api/front-desk/today') return response({ settings: null, late: [], replies: [], released: [], free_times: [], confirmations: [] })
  if (path === '/api/intake/submissions' || path === '/api/handovers' || path === '/api/no-show-flags') return response([])
  fixture.unexpected.push({ path, method })
  return response(null, 503) // Fail closed; never delegate to native fetch.
}

function Harness() {
  const [view, setView] = useState(params.get('view') || 'queue')
  const [context, setContext] = useState(null)
  const [directory, setDirectory] = useState(patients)
  const [entries, setEntries] = useState(queue)
  const [feedback, setFeedback] = useState('')
  const session = { role, active: true, userId: 'b8-user', serverUserId: 'b8-server-user', dentistId: 'd1', branchId: 'b1', branchScopes: ['b1'] }
  const state = {
    persons: [{ id: 'b8-person' }], users: [{ id: 'b8-user', personId: 'b8-person', role: role === 'dentist' ? 'Dentist' : role === 'owner' ? 'Owner / Admin' : 'Staff', status: 'Active', branchId: 'b1', permissions: ['all'] }],
    staff: [{ id: 'b8-staff', userId: 'b8-user', personId: 'b8-person', branchId: 'b1' }],
    dentists: [{ id: 'd1', userId: 'b8-user', personId: 'b8-person', name: 'Fictional B8 Dentist', available: true, branchIds: ['b1'] }],
    patients, appointments, queue: entries, visits: queue.map(q => ({ ...q, id: q.visitId, status: 'Checked In' })), branches: [branch],
    services: [{ id: 'svc1', name: 'Fictional consultation', duration: 30, status: 'Active' }],
    branchServices: [{ branchId: 'b1', serviceId: 'svc1', active: true }], dentistServiceAssignments: [{ dentistId: 'd1', serviceId: 'svc1', isAuthorized: true }],
    treatments: [], hmo: [], prescriptions: [], followups: [], documents: [], consents: [],
  }
  const navigate = (page, next) => { fixture.events.push({ type: 'navigate', page, context: next }); setContext(next); setView(page) }
  const store = { state, session, directoryPatients: directory, actions: {}, toast: (message, tone) => { fixture.events.push({ type: 'toast', message, tone }); setFeedback(message) }, appointmentFlow: {
    refresh: async () => {}, searchPatients: async () => ({ ok: true }),
    walkIn: async (form, key) => { fixture.events.push({ type: 'walkIn', form, key }); return { ok: true, queued: true, queueNumber: 8 } },
    queueCommand: async (q, command, key) => { fixture.events.push({ type: 'queueCommand', id: q.id, revision: q.revision, command, key }); setEntries(rows => rows.map(r => r.id === q.id ? { ...r, status: 'Called', revision: r.revision + 1 } : r)); return { ok: true } },
  } }
  fixture.removeDirectory = () => setDirectory([])
  return <main style={{ padding: 16, maxWidth: 1200, margin: 'auto' }}>
    <nav aria-label="B8 fixture navigation">{['queue', 'appointments', 'walkin', 'leave', 'hours', 'duty'].map(v => <button key={v} onClick={() => navigate(v, null)}>{v}</button>)}</nav>
    <output aria-label="Fixture feedback">{feedback}</output>
    {view === 'queue' && <QueuePage role={role} activeBranch={branch.name} store={store} setPage={navigate}/>}
    {view === 'patients' && <PatientsPage role={role} store={store} context={context} setPage={navigate}/>}
    {view === 'appointments' && <AppointmentsPage role={role} store={store} context={context} setPage={navigate}/>}
    {view === 'walkin' && <CheckInPage store={store} context={{ mode: 'walkin' }} setPage={navigate}/>}
    {view === 'leave' && <LeavePage role={role} store={store}/>}
    {view === 'hours' && <WorkSchedulesPage role={role} store={store}/>}
    {view === 'duty' && <StaffOnDuty session={session} activeBranch={branch.name}/>}
  </main>
}
createRoot(document.getElementById('root')).render(<Harness/> )
