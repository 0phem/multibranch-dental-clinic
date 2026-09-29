import { createWorkflowActions } from '../../src/workflow.js'

// Test support for the M6 cutover. Appointments are server-authoritative (Laravel/PostgreSQL); the frontend only holds
// a read projection. These helpers stand in for "the server accepted a command and the projection was refreshed", and
// mirror store.jsx's server-first flows synchronously: a no-commit dry run of the local adapter step against the state
// the server transition would produce, then the server transition, then the real local step.

let sequence = 0
const SERVER_TRANSITIONS = { 'Checked In': ['Pending', 'Confirmed'], 'No-show': ['Checked In'], 'In Treatment': ['Checked In'], Completed: ['In Treatment'] }
// Deterministic ULID-shaped public ids (Crockford base32 alphabet; no i/l/o/u).
export const serverId = n => `01jtest${String(n).padStart(19, '0')}`

export function serverAppointment(fields = {}) {
  const n = ++sequence
  const date = fields.date || '2026-09-19'
  const start = fields.start || '11:00'
  return {
    id: fields.id || serverId(n), code: fields.code || `APT-2026-${String(n).padStart(6, '0')}`,
    status: 'Confirmed', revision: 1, source: 'Front Desk', assignmentMethod: 'selected', notes: '', server: true,
    duration: 30, ...fields,
    appointmentNo: fields.code || fields.appointmentNo || `APT-2026-${String(n).padStart(6, '0')}`,
    date, start, scheduledStart: `${date}T${start}`,
  }
}

/**
 * @param {{actions:object, getState:()=>object, getSession:()=>object, setAppointments:(rows:object[])=>void}} f
 */
export function serverFlow({ actions, getState, getSession, setAppointments }) {
  const setStatus = (id, status) => setAppointments(getState().appointments.map(a => (a.id === id ? { ...a, status, revision: (a.revision || 1) + 1 } : a)))
  const transitionThen = (appointmentId, status, name, args) => {
    const appointment = appointmentId ? getState().appointments.find(a => a.id === appointmentId) : null
    if (!appointment) return actions()[name](...args)
    if (appointment.status !== status) {
      // Same state table as the server's named lifecycle commands (AppointmentService::TRANSITIONS).
      if (!(SERVER_TRANSITIONS[status] || []).includes(appointment.status)) return { ok: false, message: `An appointment that is ${appointment.status} cannot move to ${status}.` }
      const simulated = { ...getState(), appointments: getState().appointments.map(a => (a.id === appointmentId ? { ...a, status } : a)) }
      const dry = createWorkflowActions({ getState: () => simulated, getSession, commit: () => {} })
      const check = dry[name](...args)
      if (!check.ok || check.unchanged) return check
      setStatus(appointmentId, status)
    }
    return actions()[name](...args)
  }
  const queueEntry = id => getState().queue.find(q => q.id === id)
  return {
    /** A server-confirmed booking (the server has already validated it). */
    book(form, extra = {}) {
      const record = serverAppointment({ patientId: form.patientId, branchId: form.branchId, dentistId: form.dentistId, serviceId: form.serviceId, date: form.date, start: form.start, notes: form.notes || '', ...extra })
      setAppointments([...getState().appointments, record])
      return getState().appointments.find(a => a.id === record.id)
    },
    setStatus,
    checkIn: id => transitionThen(id, 'Checked In', 'checkInAppointment', [id]),
    noShow: queueId => transitionThen(queueEntry(queueId)?.appointmentId, 'No-show', 'updateQueue', [queueId, 'No-show']),
    treatment: (input, status = 'In Treatment') => transitionThen(queueEntry(input?.queueEntryId)?.appointmentId, status, status === 'Completed' ? 'completeTreatment' : 'saveTreatment', [input, status]),
    complete: input => transitionThen(queueEntry(input?.queueEntryId)?.appointmentId, 'Completed', 'completeTreatment', [input]),
    cancel(id) {
      const appointment = getState().appointments.find(a => a.id === id)
      if (!appointment || ['Completed', 'Cancelled', 'No-show', 'In Treatment'].includes(appointment.status)) return { ok: false, message: 'This appointment can no longer be cancelled.' }
      setStatus(id, 'Cancelled')
      return actions().applyAppointmentCancellation(id)
    },
  }
}

/**
 * Wraps a raw createWorkflowActions() object the way store.jsx's appointmentFlow does: Check-In, No-show and treatment
 * start/completion on an appointment-linked encounter run server-first. Everything else passes straight through.
 */
export function serverFirstActions(rawActions, flow) {
  return {
    ...rawActions,
    checkInAppointment: id => flow.checkIn(id),
    saveTreatment: (input, status = 'In Treatment') => flow.treatment(input, status),
    completeTreatment: (input, status = 'Completed') => flow.treatment(input, status),
    updateQueue: (id, status, extra = {}) => (status === 'No-show' && !extra.priority ? flow.noShow(id) : rawActions.updateQueue(id, status, extra)),
  }
}

/** Standard fixture plumbing: raw actions + server flow + server-first wrapped actions over a mutable test state. */
export function withServerAppointments({ getState, setState, getSession, rawActions }) {
  const flow = serverFlow({ actions: () => rawActions(), getState, getSession, setAppointments: rows => setState({ ...getState(), appointments: rows }) })
  return { flow, actions: () => serverFirstActions(rawActions(), flow) }
}

/** A GET /api/appointments row (the shape ClinicProvider's initialServerAppointments accepts). */
export function serverRow(fields = {}) {
  const a = serverAppointment(fields)
  const end = (() => { const [h, m] = a.start.split(':').map(Number); const t = h * 60 + m + a.duration; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}` })()
  return {
    id: a.id, code: a.appointmentNo, status: a.status, source: 'front_desk', assignment_method: a.assignmentMethod, revision: a.revision,
    date: a.date, start_time: a.start, end_time: end, starts_at: `${a.date}T${a.start}:00+08:00`, ends_at: `${a.date}T${end}:00+08:00`, duration_minutes: a.duration,
    patient: { id: a.patientId, code: fields.patientCode || '', name: fields.patientName || '' }, branch: { id: a.branchId, name: '' },
    service: { id: a.serviceId, name: fields.serviceName || '' }, dentist: { id: a.dentistId, name: '' }, notes: a.notes || null,
  }
}
