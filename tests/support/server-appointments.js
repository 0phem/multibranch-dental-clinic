import { createWorkflowActions } from '../../src/workflow.js'
import { clinicNow } from '../../src/clock.js'

// Test support for the M6/M8 cutovers. Appointments and Visits are server-authoritative (Laravel/PostgreSQL); the
// frontend only holds a read projection. These helpers stand in for "the server accepted a command and the projection
// was refreshed", and mirror store.jsx's server-first flows synchronously: a no-commit dry run of the local adapter step
// against the state the server command would produce, then the server command, then the real local step. The server
// rules mirrored here are the ones VisitService / AppointmentService enforce (and backend tests cover).

let sequence = 0
// Deterministic ULID-shaped public ids (Crockford base32 alphabet; no i/l/o/u).
export const serverId = n => `01jtest${String(n).padStart(19, '0')}`
const VISIT_TRANSITIONS = { 'In Treatment': 'Checked In', Completed: 'In Treatment' }

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

/** A mapped server Visit (the read-model shape visits-api.js mapVisit produces). */
export function serverVisit(fields = {}) {
  const n = ++sequence
  const now = clinicNow()
  const arrivedAt = fields.arrivedAt || now.timestamp
  return {
    id: fields.id || serverId(500000 + n), source: fields.appointmentId ? 'appointment' : 'walk_in', status: 'Checked In', revision: 1,
    arrivedAt, checkedIn: arrivedAt.slice(11, 16), clinicDate: fields.clinicDate || arrivedAt.slice(0, 10), closedAt: null,
    appointmentId: null, serviceId: null, dentistId: null, server: true, ...fields,
    walkIn: !fields.appointmentId,
  }
}

/**
 * @param {{actions:()=>object, getState:()=>object, getSession:()=>object, patchState:(patch:object)=>void}} f
 */
export function serverFlow({ actions, getState, getSession, patchState }) {
  const appointmentById = id => getState().appointments.find(a => a.id === id)
  const visits = () => getState().visits || []
  const dryRun = (patch, name, args) => {
    const simulated = { ...getState(), ...patch }
    return createWorkflowActions({ getState: () => simulated, getSession, commit: () => {} })[name](...args)
  }
  const setAppointment = (id, changes) => patchState({ appointments: getState().appointments.map(a => (a.id === id ? { ...a, ...changes, revision: (a.revision || 1) + 1 } : a)) })
  const hasActiveVisit = patientId => visits().some(v => v.patientId === patientId && ['Checked In', 'In Treatment'].includes(v.status))
  const walkInKeys = new Map()

  // Server Check-In + Visit, then the local queue handoff (mirrors appointmentFlow.checkIn).
  const openVisit = (visit, appointmentId) => {
    const patch = { visits: [...visits(), visit] }
    if (appointmentId) patch.appointments = getState().appointments.map(a => (a.id === appointmentId ? { ...a, status: 'Checked In' } : a))
    const check = dryRun(patch, 'admitVisit', [visit.id])
    if (!check.ok) return check
    if (appointmentId) setAppointment(appointmentId, { status: 'Checked In' })
    patchState({ visits: [...visits(), visit] })
    return actions().admitVisit(visit.id)
  }

  return {
    /** A server-confirmed booking (the server has already validated it). */
    book(form, extra = {}) {
      const record = serverAppointment({ patientId: form.patientId, branchId: form.branchId, dentistId: form.dentistId, serviceId: form.serviceId, date: form.date, start: form.start, notes: form.notes || '', ...extra })
      patchState({ appointments: [...getState().appointments, record] })
      return appointmentById(record.id)
    },
    setAppointment,
    /** Scheduled Check-In (VisitService::checkInScheduled). */
    checkIn(appointmentId) {
      const appointment = appointmentById(appointmentId)
      const existing = visits().find(v => v.appointmentId === appointmentId)
      if (existing) return actions().admitVisit(existing.id)
      if (!appointment) return { ok: false, message: 'This appointment is not loaded from the server.' }
      if (!['Pending', 'Confirmed'].includes(appointment.status)) return { ok: false, message: `An appointment that is ${appointment.status} cannot be checked in.` }
      if (appointment.date !== clinicNow().date) return { ok: false, message: 'Only today’s appointments can be checked in.' }
      if (hasActiveVisit(appointment.patientId)) return { ok: false, message: 'This patient already has an active visit.' }
      const visit = serverVisit({ appointmentId, patientId: appointment.patientId, branchId: appointment.branchId, dentistId: appointment.dentistId, serviceId: appointment.serviceId })
      return openVisit(visit, appointmentId)
    },
    /** Walk-In (VisitService::walkIn). The key makes a repeated submission replay instead of acting twice. */
    walkIn(form, key = null) {
      const request = JSON.stringify([form.patientId, form.branchId, form.serviceId || null, form.dentistId || null])
      if (key && walkInKeys.has(key)) {
        const [visitId, original] = walkInKeys.get(key)
        if (original !== request) return { ok: false, message: 'This Idempotency-Key was already used for a different request.' }
        // The server replays the original Visit; the local queue handoff is idempotent (and day-bound).
        return actions().admitVisit(visitId)
      }
      if (hasActiveVisit(form.patientId)) return { ok: false, message: 'This patient already has an active visit.' }
      const visit = serverVisit({ patientId: form.patientId, branchId: form.branchId, dentistId: form.dentistId || null, serviceId: form.serviceId || null })
      const result = openVisit(visit, null)
      if (result.ok && key) walkInKeys.set(key, [visit.id, request])
      return result
    },
    /** Pre-arrival No-show (AppointmentService::transition 'no-show'): no Visit exists or is created. */
    noShow(appointmentId) {
      const appointment = appointmentById(appointmentId)
      if (!appointment || !['Pending', 'Confirmed'].includes(appointment.status) || visits().some(v => v.appointmentId === appointmentId)) return { ok: false, message: 'Only an appointment whose patient has not arrived can be marked No-show.' }
      setAppointment(appointmentId, { status: 'No-show' })
      return actions().applyAppointmentNoShow(appointmentId)
    },
    /** Visit start-treatment / complete (cascading to the linked appointment), then the local M5 step. */
    treatment(input, status = 'In Treatment') {
      const name = status === 'Completed' ? 'completeTreatment' : 'saveTreatment'
      const entry = getState().queue.find(q => q.id === input?.queueEntryId)
      const visit = entry?.visitId ? visits().find(v => v.id === entry.visitId) : null
      if (!visit) return actions()[name](input, status)
      if (visit.status !== status) {
        if (VISIT_TRANSITIONS[status] !== visit.status) return { ok: false, message: `A visit that is ${visit.status} cannot move to ${status}.` }
        if (!visit.dentistId) return { ok: false, message: 'Assign a responsible Dentist to this visit before clinical work starts.' }
        const linked = visit.appointmentId ? appointmentById(visit.appointmentId) : null
        if (linked && linked.status !== visit.status) return { ok: false, message: `The linked appointment is ${linked.status}; this visit needs clinic review.` }
        const moved = v => (v.id === visit.id ? { ...v, status, revision: v.revision + 1, closedAt: status === 'Completed' ? clinicNow().timestamp : null } : v)
        const patch = { visits: visits().map(moved), appointments: getState().appointments.map(a => (a.id === visit.appointmentId ? { ...a, status } : a)) }
        const check = dryRun(patch, name, [input, status])
        if (!check.ok || check.unchanged) return check
        patchState({ visits: visits().map(moved) })
        if (visit.appointmentId) setAppointment(visit.appointmentId, { status })
      }
      return actions()[name](input, status)
    },
    complete(input) { return this.treatment(input, 'Completed') },
    cancel(id) {
      const appointment = appointmentById(id)
      if (!appointment || !['Pending', 'Confirmed'].includes(appointment.status) || visits().some(v => v.appointmentId === id)) return { ok: false, message: 'This appointment can no longer be cancelled.' }
      setAppointment(id, { status: 'Cancelled' })
      return actions().applyAppointmentCancellation(id)
    },
  }
}

/**
 * Wraps a raw createWorkflowActions() object the way store.jsx's appointmentFlow does: scheduled Check-In, Walk-In,
 * pre-arrival No-show and treatment start/completion run server-first. Everything else passes straight through.
 * `checkInAppointment` / `admitWalkIn` / `markNoShow` are test-level names for those server-first flows.
 */
export function serverFirstActions(rawActions, flow) {
  return {
    ...rawActions,
    checkInAppointment: id => flow.checkIn(id),
    admitWalkIn: (form, key) => flow.walkIn(form, key),
    markNoShow: id => flow.noShow(id),
    saveTreatment: (input, status = 'In Treatment') => flow.treatment(input, status),
    completeTreatment: (input, status = 'Completed') => flow.treatment(input, status),
  }
}

/** Standard fixture plumbing: raw actions + server flow + server-first wrapped actions over a mutable test state. */
export function withServerAppointments({ getState, setState, getSession, rawActions }) {
  const flow = serverFlow({ actions: () => rawActions(), getState, getSession, patchState: patch => setState({ ...getState(), ...patch }) })
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

/** A GET /api/visits row (the shape ClinicProvider's initialServerVisits accepts). */
export function serverVisitRow(fields = {}) {
  const v = serverVisit(fields)
  return {
    id: v.id, source: v.source, status: v.status, revision: v.revision, arrived_at: v.arrivedAt, clinic_date: v.clinicDate, closed_at: v.closedAt,
    patient: { id: v.patientId, code: fields.patientCode || '', name: fields.patientName || '' }, branch: { id: v.branchId, name: '' },
    dentist: v.dentistId ? { id: v.dentistId, name: '' } : null, service: v.serviceId ? { id: v.serviceId, name: '' } : null,
    appointment: v.appointmentId ? { id: v.appointmentId, code: fields.appointmentCode || '', status: fields.appointmentStatus || 'Checked In', revision: 2 } : null,
  }
}
