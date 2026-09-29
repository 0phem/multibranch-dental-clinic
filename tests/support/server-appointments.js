import { createWorkflowActions } from '../../src/workflow.js'
import { clinicNow } from '../../src/clock.js'
import { encounterContext, inScope } from '../../src/contracts.js'

// Test support for the M6/M8/M9 cutovers. Appointments, Visits and the queue are server-authoritative
// (Laravel/PostgreSQL); the frontend only holds a read projection. These helpers stand in for "the server accepted a
// command and the projection was refreshed", and mirror store.jsx's server-first flows synchronously. The server rules
// mirrored here are the ones AppointmentService / VisitService / QueueService enforce (and backend tests cover).

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

// ---- M9 server queue mirror (QueueService) -------------------------------------------------------------------------
const QUEUE_RANK = { Urgent: 0, Priority: 1, Normal: 2 }
const POSITIONAL = ['Waiting', 'Called', 'Treatment Ready']
const QUEUE_TRANSITIONS = { call: [['Waiting'], 'Called'], ready: [['Called'], 'Treatment Ready'], away: [['Waiting', 'Called', 'Treatment Ready'], 'Temporarily Away'], return: [['Temporarily Away'], 'Waiting'] }

/** A mapped server queue entry (the read-model shape queue-api.js mapQueueEntry produces). */
export function serverQueueEntry(visit, queueNumber, fields = {}) {
  const n = ++sequence
  const id = fields.id || serverId(900000 + n)
  return {
    id, queueEntryId: id, server: true, status: 'Waiting', priority: 'Normal', priorityReason: '', queueNumber, position: null, revision: 1,
    clinicDate: visit.clinicDate, closedAt: null, visitId: visit.id, visitStatus: visit.status, walkIn: !visit.appointmentId,
    arrivedAt: visit.arrivedAt, checkedIn: visit.checkedIn, patientId: visit.patientId, branchId: visit.branchId, dentistId: visit.dentistId,
    serviceId: visit.serviceId || null, appointmentId: visit.appointmentId || null, displayStatus: 'Waiting', ...fields,
  }
}

/** Server positions (per branch + Dentist + day: priority, exact arrival, queue number) and Visit-derived display. */
export function projectQueue(queue, visits = []) {
  const groups = new Map()
  for (const q of queue) {
    if (!POSITIONAL.includes(q.status)) continue
    const key = `${q.branchId}|${q.dentistId}|${q.clinicDate}`
    groups.set(key, [...(groups.get(key) || []), q])
  }
  const positions = new Map()
  for (const list of groups.values()) {
    list.sort((a, b) => QUEUE_RANK[a.priority] - QUEUE_RANK[b.priority] || String(a.arrivedAt).localeCompare(String(b.arrivedAt)) || a.queueNumber - b.queueNumber)
      .forEach((q, i) => positions.set(q.id, i + 1))
  }
  return queue.map(q => {
    const visitStatus = visits.find(v => v.id === q.visitId)?.status ?? q.visitStatus
    return { ...q, queueEntryId: q.id, position: positions.get(q.id) ?? null, visitStatus, displayStatus: q.status === 'Served' ? visitStatus : q.status }
  })
}

/**
 * @param {{actions:()=>object, getState:()=>object, getSession:()=>object, patchState:(patch:object)=>void}} f
 */
export function serverFlow({ actions, getState, getSession, patchState }) {
  const appointmentById = id => getState().appointments.find(a => a.id === id)
  const visits = () => getState().visits || []
  const queue = () => getState().queue || []
  const dryRun = (patch, name, args) => {
    const simulated = { ...getState(), ...patch }
    return createWorkflowActions({ getState: () => simulated, getSession, commit: () => {} })[name](...args)
  }
  const setAppointment = (id, changes) => patchState({ appointments: getState().appointments.map(a => (a.id === id ? { ...a, ...changes, revision: (a.revision || 1) + 1 } : a)) })
  const setServer = ({ visits: nextVisits = visits(), queue: nextQueue = queue() }) => patchState({ visits: nextVisits, queue: projectQueue(nextQueue, nextVisits) })
  const hasActiveVisit = patientId => visits().some(v => v.patientId === patientId && ['Checked In', 'In Treatment'].includes(v.status))
  const walkInKeys = new Map()
  const entryFor = visitId => queue().find(q => q.visitId === visitId)
  const canOperate = record => {
    const session = getSession()
    return ['staff', 'owner'].includes(session?.role) && inScope(record, session, getState())
  }

  // Server arrival (M8 + M9 in one transaction): appointment Checked In, Visit, and — with a Dentist — the queue entry.
  const openVisit = (visit, appointmentId) => {
    if (appointmentId) setAppointment(appointmentId, { status: 'Checked In' })
    let entry = null
    if (visit.dentistId) {
      const number = Math.max(0, ...queue().filter(q => q.branchId === visit.branchId && q.dentistId === visit.dentistId && q.clinicDate === visit.clinicDate).map(q => q.queueNumber)) + 1
      entry = serverQueueEntry(visit, number)
    }
    setServer({ visits: [...visits(), visit], queue: entry ? [...queue(), entry] : queue() })
    const record = entry ? entryFor(visit.id) : null
    return { ok: true, visit, record, context: record ? encounterContext(record) : null }
  }

  return {
    /** A server-confirmed booking (the server has already validated it). */
    book(form, extra = {}) {
      const record = serverAppointment({ patientId: form.patientId, branchId: form.branchId, dentistId: form.dentistId, serviceId: form.serviceId, date: form.date, start: form.start, notes: form.notes || '', ...extra })
      patchState({ appointments: [...getState().appointments, record] })
      return appointmentById(record.id)
    },
    setAppointment,
    setServer,
    /** Scheduled Check-In (VisitService::checkInScheduled + QueueService::enqueue). */
    checkIn(appointmentId) {
      const appointment = appointmentById(appointmentId)
      const existing = visits().find(v => v.appointmentId === appointmentId)
      if (existing) return { ok: true, unchanged: true, visit: existing, record: entryFor(existing.id) || null, context: entryFor(existing.id) ? encounterContext(entryFor(existing.id)) : null }
      if (!appointment) return { ok: false, message: 'This appointment is not loaded from the server.' }
      if (!canOperate(appointment)) return { ok: false, message: 'This appointment is outside your assigned branch.' }
      if (!['Pending', 'Confirmed'].includes(appointment.status)) return { ok: false, message: `An appointment that is ${appointment.status} cannot be checked in.` }
      if (appointment.date !== clinicNow().date) return { ok: false, message: 'Only today’s appointments can be checked in.' }
      if (hasActiveVisit(appointment.patientId)) return { ok: false, message: 'This patient already has an active visit.' }
      const visit = serverVisit({ appointmentId, patientId: appointment.patientId, branchId: appointment.branchId, dentistId: appointment.dentistId, serviceId: appointment.serviceId })
      return openVisit(visit, appointmentId)
    },
    /** Walk-In (VisitService::walkIn + enqueue). The key makes a repeated submission replay instead of acting twice. */
    walkIn(form, key = null) {
      const request = JSON.stringify([form.patientId, form.branchId, form.serviceId || null, form.dentistId || null])
      if (key && walkInKeys.has(key)) {
        const [visitId, original] = walkInKeys.get(key)
        if (original !== request) return { ok: false, message: 'This Idempotency-Key was already used for a different request.' }
        return { ok: true, unchanged: true, visit: visits().find(v => v.id === visitId), record: entryFor(visitId) || null }
      }
      if (!canOperate(form)) return { ok: false, message: 'Walk-ins must use your assigned branch.' }
      if (!getState().patients.some(p => p.id === form.patientId)) return { ok: false, message: 'The patient could not be found.' }
      if (form.dentistId && !getState().dentists.some(d => d.id === form.dentistId)) return { ok: false, message: 'The Dentist could not be found.' }
      if (hasActiveVisit(form.patientId)) return { ok: false, message: 'This patient already has an active visit.' }
      const visit = serverVisit({ patientId: form.patientId, branchId: form.branchId, dentistId: form.dentistId || null, serviceId: form.serviceId || null })
      const result = openVisit(visit, null)
      if (result.ok && key) walkInKeys.set(key, [visit.id, request])
      return result
    },
    /** M9 named queue commands (QueueService::transition). */
    queue(entryId, name) {
      const entry = queue().find(q => q.id === entryId)
      if (!entry || !QUEUE_TRANSITIONS[name]) return { ok: false, message: 'This queue command is not available.' }
      const session = getSession()
      const allowed = name === 'call' ? canOperate(entry) || (session?.role === 'dentist' && entry.dentistId === session.dentistId) : canOperate(entry)
      if (!allowed) return { ok: false, message: 'This role cannot perform that queue action.' }
      const [from, to] = QUEUE_TRANSITIONS[name]
      if (entry.status === to) return { ok: true, unchanged: true, record: entry }
      if (entry.status === 'Served' || visits().find(v => v.id === entry.visitId)?.status !== 'Checked In') return { ok: false, message: 'This patient has left the waiting queue.' }
      if (!from.includes(entry.status)) return { ok: false, message: `A queue entry that is ${entry.status} cannot move to ${to}.` }
      if (entry.clinicDate !== clinicNow().date) return { ok: false, message: 'This queue entry belongs to another clinic day.' }
      setServer({ queue: queue().map(q => (q.id === entryId ? { ...q, status: to, revision: q.revision + 1 } : q)) })
      return { ok: true, record: queue().find(q => q.id === entryId) }
    },
    /** M9 operational priority (Staff/Owner, reason required). */
    priority(entryId, priority, reason) {
      const entry = queue().find(q => q.id === entryId)
      if (!entry || !canOperate(entry)) return { ok: false, message: 'Only in-scope Staff or the Owner can change queue priority.' }
      if (!Object.hasOwn(QUEUE_RANK, priority) || typeof reason !== 'string' || !reason.trim()) return { ok: false, message: 'A queue priority change needs a reason.' }
      if (entry.status === 'Served') return { ok: false, message: 'This patient has left the waiting queue.' }
      if (entry.clinicDate !== clinicNow().date) return { ok: false, message: 'This queue entry belongs to another clinic day.' }
      setServer({ queue: queue().map(q => (q.id === entryId ? { ...q, priority, priorityReason: reason.trim(), revision: q.revision + 1 } : q)) })
      return { ok: true, record: queue().find(q => q.id === entryId) }
    },
    /** Pre-arrival No-show (AppointmentService::transition 'no-show'): no Visit exists or is created. */
    noShow(appointmentId) {
      const appointment = appointmentById(appointmentId)
      if (!appointment || !['Pending', 'Confirmed'].includes(appointment.status) || visits().some(v => v.appointmentId === appointmentId)) return { ok: false, message: 'Only an appointment whose patient has not arrived can be marked No-show.' }
      setAppointment(appointmentId, { status: 'No-show' })
      return actions().applyAppointmentNoShow(appointmentId)
    },
    /** Visit start-treatment (Serves the queue entry) / complete, cascading to the appointment, then the local M5 step. */
    treatment(input, status = 'In Treatment') {
      const name = status === 'Completed' ? 'completeTreatment' : 'saveTreatment'
      const entry = queue().find(q => q.id === input?.queueEntryId)
      const visit = entry?.visitId ? visits().find(v => v.id === entry.visitId) : null
      if (!visit) return actions()[name](input, status)
      if (visit.status !== status) {
        if (VISIT_TRANSITIONS[status] !== visit.status) return { ok: false, message: `A visit that is ${visit.status} cannot move to ${status}.` }
        if (!visit.dentistId) return { ok: false, message: 'Assign a responsible Dentist to this visit before clinical work starts.' }
        const linked = visit.appointmentId ? appointmentById(visit.appointmentId) : null
        if (linked && linked.status !== visit.status) return { ok: false, message: `The linked appointment is ${linked.status}; this visit needs clinic review.` }
        if (status === 'In Treatment' && !['Called', 'Treatment Ready'].includes(entry.status)) return { ok: false, message: 'Call this patient before starting treatment.' }
        const nextVisits = visits().map(v => (v.id === visit.id ? { ...v, status, revision: v.revision + 1, closedAt: status === 'Completed' ? clinicNow().timestamp : null } : v))
        const nextQueue = status === 'In Treatment' ? queue().map(q => (q.id === entry.id ? { ...q, status: 'Served', closedAt: clinicNow().timestamp, revision: q.revision + 1 } : q)) : queue()
        const check = dryRun({ visits: nextVisits, queue: projectQueue(nextQueue, nextVisits), appointments: getState().appointments.map(a => (a.id === visit.appointmentId ? { ...a, status } : a)) }, name, [input, status])
        if (!check.ok || check.unchanged) return check
        setServer({ visits: nextVisits, queue: nextQueue })
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
 * queue commands, pre-arrival No-show and treatment start/completion run server-first. `checkInAppointment` /
 * `admitWalkIn` / `updateQueue` / `markNoShow` are test-level names for those server flows (updateQueue maps the
 * target status onto the M9 named command; there is no queue command for 'No-show').
 */
export function serverFirstActions(rawActions, flow) {
  const commandFor = { Called: 'call', 'Treatment Ready': 'ready', 'Temporarily Away': 'away', Waiting: 'return' }
  return {
    ...rawActions,
    checkInAppointment: id => flow.checkIn(id),
    admitWalkIn: (form, key) => flow.walkIn(form, key),
    markNoShow: id => flow.noShow(id),
    updateQueue: (id, status, extra = {}) => (extra.priority ? flow.priority(id, extra.priority, extra.reason)
      : commandFor[status] ? flow.queue(id, commandFor[status]) : { ok: false, message: `There is no queue command for ${status}.` }),
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

/** A GET /api/queue row (the shape ClinicProvider's initialServerQueue accepts), from a mapped queue entry. */
export function serverQueueRow(entry, fields = {}) {
  return {
    id: entry.id, status: entry.status, priority: entry.priority, priority_reason: entry.priorityReason || null, queue_number: entry.queueNumber,
    position: entry.position ?? null, revision: entry.revision, clinic_date: entry.clinicDate, closed_at: entry.closedAt || null,
    branch: { id: entry.branchId, name: '' }, dentist: { id: entry.dentistId, name: '' },
    visit: { id: entry.visitId, status: entry.visitStatus, source: entry.walkIn ? 'walk_in' : 'appointment', revision: 1, arrived_at: entry.arrivedAt },
    patient: { id: entry.patientId, code: fields.patientCode || '', name: fields.patientName || '' },
    service: entry.serviceId ? { id: entry.serviceId, name: '' } : null,
    appointment: entry.appointmentId ? { id: entry.appointmentId, code: fields.appointmentCode || '', status: fields.appointmentStatus || 'Checked In', start_time: '11:00' } : null,
  }
}

/**
 * Mirror of GET /api/queue/mine (QueueService::patientCurrent) for one Patient over the helper's server state: the
 * Patient's single active Visit and its queue entry — own number, phase and position only, no wait estimate.
 */
export function patientQueueState(state, patientId) {
  const visit = [...(state.visits || [])].reverse().find(v => v.patientId === patientId && ['Checked In', 'In Treatment'].includes(v.status))
  if (!visit) return null
  const entry = (state.queue || []).find(q => q.visitId === visit.id) || null
  const phase = visit.status === 'In Treatment' ? 'in-treatment' : !entry ? 'checked-in'
    : { Waiting: 'waiting', Called: 'called', 'Treatment Ready': 'ready', 'Temporarily Away': 'away' }[entry.status] || 'checked-in'
  const appointment = visit.appointmentId ? (state.appointments || []).find(a => a.id === visit.appointmentId) : null
  const serviceId = appointment?.serviceId || visit.serviceId
  return {
    phase, queue_status: entry?.status ?? null, queue_number: entry?.queueNumber ?? null,
    position: entry && POSITIONAL.includes(entry.status) ? entry.position : null,
    clinic_date: visit.clinicDate, arrived_at: visit.arrivedAt,
    branch: { name: (state.branches || []).find(b => b.id === visit.branchId)?.name || '' },
    dentist: visit.dentistId ? { name: personName(state, (state.dentists || []).find(d => d.id === visit.dentistId)?.personId) } : null,
    service: serviceId ? { name: (state.services || []).find(s => s.id === serviceId)?.name || '' } : null,
    appointment: appointment ? { start_time: appointment.start } : null,
  }
}

// The server returns the Dentist's Person full name (DentistProfile → Person), without a title.
function personName(state, personId) {
  const person = (state.persons || []).find(p => p.id === personId)
  return person ? [person.firstName, person.lastName].filter(Boolean).join(' ') : ''
}

/** The state a signed-in Patient's store holds: their own server queue state as `myQueue`. */
export const asPatient = (state, patientId) => ({ ...state, myQueue: patientQueueState(state, patientId) })
