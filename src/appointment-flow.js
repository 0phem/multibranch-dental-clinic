import * as appointmentsApi from './appointments-api.js'
import * as visitsApi from './visits-api.js'
import { clinicNow } from './clock.js'
import { createWorkflowActions } from './workflow.js'

// Server-first M6/M8 command flows. Every appointment and Visit change is a Laravel command followed by a refresh of
// the in-memory server projection; the browser-local adapter step for unfinished modules (M9 queue, M5 treatment,
// follow-ups, in-app notifications) runs only after the server succeeded and is never used to reverse it. For
// Check-In, Walk-In and treatment start/completion, a no-commit dry run of the local step against the state the
// server command would produce runs first, so a server command whose local step would predictably fail is never sent.
//
// Dependencies are injected so the exact flow the store uses is unit-testable with a mocked API:
//   getState()/getSession()  latest store snapshot and session
//   getActions()             the committed workflow actions (adapters)
//   refresh()                reloads server appointments and Visits into the projection (async)
//   api / visits             appointments-api.js / visits-api.js (or test doubles)
export function createAppointmentFlow({ getState, getSession, getActions, refresh, searchPatients = null, addDirectoryPatient = null, api = appointmentsApi, visits = visitsApi }) {
  const projected = id => getState().appointments.find(a => a.id === id)
  const visitFor = id => (getState().visits || []).find(v => v.id === id)

  // Dry run of a local adapter against a simulated state; nothing is committed.
  const preflight = (patch, name, ...args) => {
    const simulated = { ...getState(), ...patch(getState()) }
    const dry = createWorkflowActions({ getState: () => simulated, getSession, commit: () => {} })
    return dry[name](...args)
  }
  // The Visit the server would open for this arrival (used only for the dry run).
  const simulatedVisit = fields => {
    const now = clinicNow()
    return { id: 'preflight-visit', server: true, status: 'Checked In', revision: 1, arrivedAt: now.timestamp, checkedIn: now.time, clinicDate: now.date, appointmentId: null, serviceId: null, ...fields }
  }
  const admitPreflight = visit => preflight(state => ({
    visits: [...(state.visits || []), visit],
    appointments: state.appointments.map(a => (a.id === visit.appointmentId ? { ...a, status: 'Checked In' } : a)),
  }), 'admitVisit', visit.id)

  const afterServerCommand = async result => {
    // A stale or conflicting command means the server state moved on: refresh so the UI shows the truth.
    if (!result.ok && ['conflict', 'validation', 'not_found'].includes(result.kind)) await refresh()
    return result
  }

  const partial = (what, local) => ({ ok: false, partial: true, message: `${what} is recorded at the clinic, but this browser’s queue/treatment record could not be updated: ${local.message} You can retry this step.` })

  // M9 handoff of a server Visit (idempotent; also the retry path).
  const admit = (visitId, what) => {
    const local = getActions().admitVisit(visitId)
    return local.ok ? { ...local, visitId } : partial(what, local)
  }

  return {
    refresh,
    searchPatients,

    async create(form, { key, followupId = null } = {}) {
      if (followupId) {
        // Transitional M20 bridge (removed when M20 is backend-authoritative): the Dentist records/recommends the
        // follow-up; clinic Staff (or the Owner) schedule it. Dentists and Patients get no booking path here, so no
        // server appointment is ever created for them through this bridge.
        if (!['staff', 'owner'].includes(getSession()?.role)) return { ok: false, message: 'Follow-up visits are scheduled by clinic Staff.' }
        const followup = getState().followups.find(f => f.id === followupId)
        if (!followup || followup.legacyAppointment) return { ok: false, message: 'This follow-up is historical and cannot be booked here.' }
      }
      const result = await api.createAppointment(form, key)
      if (!result.ok) return afterServerCommand(result)
      await refresh()
      const warnings = []
      if (followupId) {
        const link = getActions().linkFollowupAppointment(followupId, result.row.id)
        if (!link.ok) warnings.push(`The appointment is booked, but the follow-up task was not linked: ${link.message}`)
      } else getActions().recordAppointmentEvent(result.row.id, 'created')
      return { ok: true, record: projected(result.row.id), warning: warnings.join(' ') }
    },

    async reschedule(appointment, form, key) {
      const result = await api.rescheduleAppointment(appointment, form, key)
      if (!result.ok) return afterServerCommand(result)
      await refresh()
      getActions().recordAppointmentEvent(result.row.id, 'rescheduled')
      return { ok: true, record: projected(result.row.id) }
    },

    async cancel(appointment, key) {
      const result = await api.cancelAppointment(appointment, key)
      if (!result.ok) return afterServerCommand(result)
      await refresh()
      const local = getActions().applyAppointmentCancellation(appointment.id)
      return local.ok ? { ok: true } : { ok: true, warning: `The appointment is cancelled, but its local follow-up/notification records need review: ${local.message}` }
    },

    // M8 scheduled Check-In: the server moves the appointment to Checked In and opens the Visit atomically; then the
    // local M9 queue entry is created from that Visit. An appointment whose Visit already exists only retries the
    // local queue step.
    async checkIn(appointmentId, key) {
      const appointment = projected(appointmentId)
      if (!appointment) return { ok: false, message: 'This appointment is not loaded from the server. Refresh and try again.' }
      const existing = (getState().visits || []).find(v => v.appointmentId === appointmentId)
      if (existing) return admit(existing.id, 'The arrival')
      const check = admitPreflight(simulatedVisit({
        source: 'appointment', appointmentId, patientId: appointment.patientId, patientPublicId: appointment.patientPublicId,
        branchId: appointment.branchId, dentistId: appointment.dentistId, serviceId: appointment.serviceId,
      }))
      if (!check.ok) return check
      const result = await visits.checkIn(appointment, key)
      if (!result.ok) return afterServerCommand(result)
      await refresh()
      return admit(result.row.id, 'The arrival')
    },

    // M8 Walk-In: a server Visit with no appointment, then the local M9 queue entry. `form.patientId` is the UI key of
    // the directory-selected Patient and `form.patientPublicId` its server public id.
    async walkIn(form, key) {
      const check = admitPreflight(simulatedVisit({
        source: 'walk_in', patientId: form.patientId, patientPublicId: form.patientPublicId,
        branchId: form.branchId, dentistId: form.dentistId || null, serviceId: form.serviceId || null,
      }))
      if (!check.ok) return check
      const result = await visits.walkIn(form, key)
      if (!result.ok) return afterServerCommand(result)
      await refresh()
      return admit(result.row.id, 'The walk-in')
    },

    // Explicit "Add to queue" for a Visit the server already opened: the plain local result (the Visit itself is
    // already recorded, and the page says so).
    retryAdmit(visitId) {
      const local = getActions().admitVisit(visitId)
      return local.ok ? { ...local, visitId } : local
    },

    // M6 pre-arrival No-show: the scheduled Patient did not arrive, so there is no Visit and no queue entry.
    async noShow(appointment, key) {
      const result = await api.transitionAppointment(appointment, 'no-show', key)
      if (!result.ok) return afterServerCommand(result)
      await refresh()
      const local = getActions().applyAppointmentNoShow(appointment.id)
      return local.ok ? { ok: true } : { ok: true, warning: `The No-show is recorded, but its local follow-up records need review: ${local.message}` }
    },

    // M5 prototype treatment start/draft/completion for a Visit-linked encounter: the Visit command runs first (it
    // also moves a linked appointment), then the local treatment record follows.
    async treatment(input, status = 'In Treatment') {
      const entry = getState().queue.find(q => q.id === input?.queueEntryId)
      const name = status === 'Completed' ? 'completeTreatment' : 'saveTreatment'
      const visit = entry?.visitId ? visitFor(entry.visitId) : null
      if (!visit) return getActions()[name](input, status)
      const check = preflight(state => ({
        visits: state.visits.map(v => (v.id === visit.id ? { ...v, status } : v)),
        appointments: state.appointments.map(a => (a.id === visit.appointmentId ? { ...a, status } : a)),
      }), name, input, status)
      if (!check.ok || check.unchanged) return check
      if (visit.status !== status) {
        const result = await visits.transitionVisit(visit, status === 'Completed' ? 'complete' : 'start-treatment', api.commandKey())
        if (!result.ok) return afterServerCommand(result)
        await refresh()
      }
      const local = getActions()[name](input, status)
      return local.ok ? local : partial(status === 'Completed' ? 'The completion' : 'The treatment start', local)
    },

    // Minimal front-desk registration (Person + Patient, no login) for a new walk-in Patient.
    async registerPatient(form, key) {
      const result = await visits.registerPatient(form, key)
      if (!result.ok) return result
      addDirectoryPatient?.(result.patient)
      return result
    },
  }
}
