import * as appointmentsApi from './appointments-api.js'
import * as visitsApi from './visits-api.js'
import * as queueApi from './queue-api.js'
import { createWorkflowActions } from './workflow.js'

// Server-first M6/M8/M9 command flows. Every appointment, Visit and queue change is a Laravel command followed by a
// refresh of the in-memory server projection; the browser-local adapter step for unfinished modules (M5 treatment,
// follow-ups, in-app notifications) runs only after the server succeeded and is never used to reverse it. Arrival
// (Check-In / Walk-In) is entirely server-side since M9: the server opens the Visit and queues it in one transaction.
// For treatment start/completion, a no-commit dry run of the local step against the state the server command would
// produce runs first, so a server command whose local step would predictably fail is never sent.
//
// Dependencies are injected so the exact flow the store uses is unit-testable with a mocked API:
//   getState()/getSession()  latest store snapshot and session
//   getActions()             the committed workflow actions (adapters)
//   refresh()                reloads server appointments and Visits into the projection (async)
//   api / visits / queue     appointments-api.js / visits-api.js / queue-api.js (or test doubles)
export function createAppointmentFlow({ getState, getSession, getActions, refresh, searchPatients = null, addDirectoryPatient = null, api = appointmentsApi, visits = visitsApi, queue = queueApi }) {
  const projected = id => getState().appointments.find(a => a.id === id)
  const visitFor = id => (getState().visits || []).find(v => v.id === id)

  // Dry run of a local adapter against a simulated state; nothing is committed.
  const preflight = (patch, name, ...args) => {
    const simulated = { ...getState(), ...patch(getState()) }
    const dry = createWorkflowActions({ getState: () => simulated, getSession, commit: () => {} })
    return dry[name](...args)
  }
  const afterServerCommand = async result => {
    // A stale or conflicting command means the server state moved on: refresh so the UI shows the truth.
    if (!result.ok && ['conflict', 'validation', 'not_found'].includes(result.kind)) await refresh()
    return result
  }

  const partial = (what, local) => ({ ok: false, partial: true, message: `${what} is recorded at the clinic, but this browser’s queue/treatment record could not be updated: ${local.message} You can retry this step.` })

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

    // M8 scheduled Check-In: the server moves the appointment to Checked In, opens the Visit and — when the Visit has a
    // responsible Dentist — queues it, all in one transaction. Nothing is written locally.
    async checkIn(appointmentId, key) {
      const appointment = projected(appointmentId)
      if (!appointment) return { ok: false, message: 'This appointment is not loaded from the server. Refresh and try again.' }
      const result = await visits.checkIn(appointment, key)
      if (!result.ok) return afterServerCommand(result)
      await refresh()
      return { ok: true, visitId: result.row.id, queued: !!result.row.queue, queueNumber: result.row.queue?.queue_number ?? null }
    },

    // M8 Walk-In: a server Visit with no appointment, queued in the same server transaction when a Dentist is given.
    async walkIn(form, key) {
      const result = await visits.walkIn(form, key)
      if (!result.ok) return afterServerCommand(result)
      await refresh()
      return { ok: true, visitId: result.row.id, queued: !!result.row.queue, queueNumber: result.row.queue?.queue_number ?? null }
    },

    // M9 queue commands (server only): 'call' | 'ready' | 'away' | 'return', and the operational priority.
    async queueCommand(entry, name, key) {
      const result = await queue.transitionQueue(entry, name, key)
      if (!result.ok) return afterServerCommand(result)
      await refresh()
      return { ok: true, row: result.row }
    },

    async queuePriority(entry, priority, reason, key) {
      const result = await queue.setQueuePriority(entry, priority, reason, key)
      if (!result.ok) return afterServerCommand(result)
      await refresh()
      return { ok: true, row: result.row }
    },

    // M6 pre-arrival No-show: the scheduled Patient did not arrive, so there is no Visit and no queue entry.
    async noShow(appointment, key) {
      const result = await api.transitionAppointment(appointment, 'no-show', key)
      if (!result.ok) return afterServerCommand(result)
      await refresh()
      const local = getActions().applyAppointmentNoShow(appointment.id)
      return local.ok ? { ok: true } : { ok: true, warning: `The No-show is recorded, but its local follow-up records need review: ${local.message}` }
    },

    // M5 prototype treatment start/draft/completion for a queued encounter: the Visit command runs first (start also
    // Serves the server queue entry and moves a linked appointment, in one server transaction), then the local
    // treatment record follows.
    async treatment(input, status = 'In Treatment') {
      const entry = getState().queue.find(q => q.id === input?.queueEntryId)
      const name = status === 'Completed' ? 'completeTreatment' : 'saveTreatment'
      const visit = entry?.visitId ? visitFor(entry.visitId) : null
      if (!visit) return getActions()[name](input, status)
      const check = preflight(state => ({
        visits: state.visits.map(v => (v.id === visit.id ? { ...v, status } : v)),
        appointments: state.appointments.map(a => (a.id === visit.appointmentId ? { ...a, status } : a)),
        queue: state.queue.map(q => (q.id === entry.id ? { ...q, status: 'Served' } : q)),
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
