import * as appointmentsApi from './appointments-api.js'
import { createWorkflowActions } from './workflow.js'

// Server-first M6 command flows (M6 cutover). Every appointment change is a Laravel command followed by a refresh of
// the in-memory server projection; the browser-local adapter step for unfinished modules (queue, check-in, follow-up,
// in-app notifications) runs only after the server succeeded and is never used to reverse it. For Check-In, No-show and
// treatment start/completion, a no-commit dry run of the local step against the state the server transition would
// produce runs first, so a server transition whose local step would predictably fail is never sent.
//
// Dependencies are injected so the exact flow the store uses is unit-testable with a mocked API:
//   getState()/getSession()  latest store snapshot and session
//   getActions()             the committed workflow actions (adapters)
//   refresh()                reloads server appointments into the projection (async)
//   api                      appointments-api.js (or a test double)
export function createAppointmentFlow({ getState, getSession, getActions, refresh, searchPatients = null, api = appointmentsApi }) {
  const projected = id => getState().appointments.find(a => a.id === id)

  const preflight = (name, appointmentId, status, ...args) => {
    const simulated = { ...getState(), appointments: getState().appointments.map(a => (a.id === appointmentId ? { ...a, status } : a)) }
    const dry = createWorkflowActions({ getState: () => simulated, getSession, commit: () => {} })
    return dry[name](...args)
  }

  const afterServerCommand = async result => {
    // A stale or conflicting command means the server state moved on: refresh so the UI shows the truth.
    if (!result.ok && ['conflict', 'validation', 'not_found'].includes(result.kind)) await refresh()
    return result
  }

  const transitionFirst = async (appointmentId, name, status) => {
    const appointment = projected(appointmentId)
    if (!appointment) return { ok: false, message: 'This appointment is not loaded from the server. Refresh and try again.' }
    if (appointment.status === status) return { ok: true }
    const result = await api.transitionAppointment(appointment, name, api.commandKey())
    if (!result.ok) return afterServerCommand(result)
    await refresh()
    return { ok: true }
  }

  const partial = (what, local) => ({ ok: false, partial: true, message: `${what} is recorded on the appointment, but the local record could not be updated: ${local.message} You can retry this step.` })

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
      return local.ok ? { ok: true } : { ok: true, warning: `The appointment is cancelled, but its local queue/follow-up records need review: ${local.message}` }
    },

    // M8 prototype arrival: server check-in first, then the local check-in/queue records (also the retry path).
    async checkIn(appointmentId) {
      const check = preflight('checkInAppointment', appointmentId, 'Checked In', appointmentId)
      if (!check.ok) return check
      const server = await transitionFirst(appointmentId, 'check-in', 'Checked In')
      if (!server.ok) return server
      const local = getActions().checkInAppointment(appointmentId)
      return local.ok ? local : partial('The arrival', local)
    },

    // M9 prototype No-show for an appointment-linked queue entry: server first, then the local queue.
    async noShow(queueEntryId) {
      const entry = getState().queue.find(q => q.id === queueEntryId)
      if (!entry?.appointmentId) return getActions().updateQueue(queueEntryId, 'No-show')
      const check = preflight('updateQueue', entry.appointmentId, 'No-show', queueEntryId, 'No-show')
      if (!check.ok) return check
      const server = await transitionFirst(entry.appointmentId, 'no-show', 'No-show')
      if (!server.ok) return server
      const local = getActions().updateQueue(queueEntryId, 'No-show')
      return local.ok ? local : partial('The No-show', local)
    },

    // M5 prototype treatment start/draft/completion for an appointment-linked encounter: server transition first.
    async treatment(input, status = 'In Treatment') {
      const entry = getState().queue.find(q => q.id === input?.queueEntryId)
      const name = status === 'Completed' ? 'completeTreatment' : 'saveTreatment'
      if (!entry?.appointmentId) return getActions()[name](input, status)
      const check = preflight(name, entry.appointmentId, status, input, status)
      if (!check.ok || check.unchanged) return check
      const server = await transitionFirst(entry.appointmentId, status === 'Completed' ? 'complete' : 'start-treatment', status)
      if (!server.ok) return server
      const local = getActions()[name](input, status)
      return local.ok ? local : partial(status === 'Completed' ? 'The completion' : 'The treatment start', local)
    },
  }
}
