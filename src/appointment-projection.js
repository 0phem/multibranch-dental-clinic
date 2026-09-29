import { isLegacyAppointmentRef, isServerId, mapAppointment } from './appointments-api.js'
import { mapVisit } from './visits-api.js'
import { mapQueueEntry } from './queue-api.js'

// TEMPORARY read model for the M6/M8/M9 cutovers. Server appointments, Visits and queue entries (Laravel/PostgreSQL) are
// the only appointment, arrival/encounter and queue truth; the still-browser-local modules (treatment, billing, HMO,
// follow-ups, messaging, dashboards) keep reading `state.appointments`/`state.visits`/`state.queue`/`state.patients`
// through this projection.
// Nothing here is persisted or written back. Remove it module by module as each consumer moves to the backend.

/**
 * Which id the UI keys a server Patient on. The server's Patient public_id is the identity; a browser-local Patient
 * projection is reused only when it is already linked to that exact public_id by server-provided data:
 * - the signed-in Patient's own session (`session.patientPublicId` came from /api/me);
 * - a local account projection whose `backendPatientId` the identity bridge stored from /api/me.
 * Otherwise the public_id itself is the key. There is no email, code or name matching.
 */
export function patientKeyResolver({ session, users = [], patients = [] }) {
  const linked = new Map()
  for (const user of users) {
    if (typeof user.backendPatientId !== 'string') continue
    const patient = patients.find(p => p.userId === user.id)
    if (patient) linked.set(user.backendPatientId, patient.id)
  }
  return publicId => {
    if (!publicId) return null
    if (session?.role === 'patient' && session.patientPublicId === publicId && session.patientId) return session.patientId
    return linked.get(publicId) || publicId
  }
}

/** Server rows -> read-model appointments and Visits, plus read-model Patients for server Patients with no local projection. */
export function buildServerProjection({ rows = [], visitRows = [], queueRows = [], directory = [], session = null, users = [], patients = [] }) {
  const keyFor = patientKeyResolver({ session, users, patients })
  const appointments = rows.map(row => mapAppointment(row, keyFor))
  const visits = visitRows.map(row => mapVisit(row, keyFor))
  const queue = queueRows.map(row => mapQueueEntry(row, keyFor))
  const readModel = new Map()
  const addPatient = (publicId, fields) => {
    if (!publicId || keyFor(publicId) !== publicId) return
    const previous = readModel.get(publicId) || {}
    readModel.set(publicId, {
      ...previous,
      id: publicId, publicId, personId: null, userId: null, preferredBranchId: null, serverProjection: true,
      patientCode: fields.patientCode || previous.patientCode || '', name: fields.name || previous.name || fields.patientCode || publicId,
      firstName: fields.firstName ?? previous.firstName ?? '', lastName: fields.lastName ?? previous.lastName ?? '',
      phone: fields.phone ?? previous.phone ?? '', dob: fields.dob ?? previous.dob ?? '',
    })
  }
  for (const row of [...rows, ...visitRows, ...queueRows]) addPatient(row.patient?.id, { patientCode: row.patient?.code, name: row.patient?.name })
  for (const patient of directory) addPatient(patient.id, patient)
  return { appointments, visits, queue, readModelPatients: [...readModel.values()], keyFor }
}

/** The server Patient public id for a UI Patient key (the reverse of patientKeyResolver), or null for legacy-only Patients. */
export function publicPatientIdFor(patientKey, { session, users = [], patients = [] }) {
  if (!patientKey) return null
  if (session?.role === 'patient' && session.patientId === patientKey) return session.patientPublicId || null
  const patient = patients.find(p => p.id === patientKey)
  if (patient?.serverProjection) return patient.publicId
  const user = patient?.userId ? users.find(u => u.id === patient.userId) : null
  return typeof user?.backendPatientId === 'string' ? user.backendPatientId : null
}

/**
 * D5 LEGACY HISTORY. Records created before the cutovers reference browser-local appointment ids or carry no server
 * Visit. They stay only as read-only history: every such record carries `legacyAppointment` so live integrity
 * decisions, live KPIs and mutations can ignore it. (Since M9 the live queue is the server queue; browser queue rows are
 * no longer read as live state at all.)
 */
export const flagLegacy = (records = [], key = 'appointmentId', legacyTreatmentIds = new Set()) =>
  records.map(record => (isLegacyAppointmentRef(record?.[key]) || legacyTreatmentIds.has(record?.treatmentId)
    ? { ...record, legacyAppointment: true } : record))

/**
 * D5/M8/M9 classification that follows the record links. A treatment is live only when it references its server Visit
 * (a canonical `visitId`, persisted by the exact-link re-anchor in store.jsx); otherwise — a pre-cutover appointment id,
 * or a browser-only encounter with no Visit — it is legacy. Invoices, prescriptions, follow-ups, HMO cases and
 * conversations are legacy when they reference a legacy appointment or a legacy treatment.
 */
export function classifyLegacy({ treatments = [], invoices = [], prescriptions = [], followups = [], hmo = [], conversations = [], inquiries = [] }) {
  const flaggedTreatments = treatments.map(t => (isLegacyAppointmentRef(t?.appointmentId) || !isServerId(t?.visitId) ? { ...t, legacyAppointment: true } : t))
  const legacyTreatmentIds = new Set(flaggedTreatments.filter(t => t.legacyAppointment).map(t => t.id))
  const flag = rows => flagLegacy(rows, 'appointmentId', legacyTreatmentIds)
  return {
    treatments: flaggedTreatments,
    invoices: flag(invoices), prescriptions: flag(prescriptions), followups: flag(followups), hmo: flag(hmo), conversations: flag(conversations),
    inquiries: flagLegacy(inquiries, 'bookedAppointmentId'),
  }
}

/**
 * M9 one-time local evidence re-anchor (compatibility only; remove with the M5/M11 backends). Before browser queue rows
 * stop being read, a local treatment or invoice that lacks a server Visit id gets one ONLY through an exact link:
 * its `queueEntryId` names a browser queue row that carries a server `visitId` — or whose server appointment id is the
 * appointment of a server Visit. When the server queue has an entry for that same Visit, the record's queue link moves
 * to that entry's public id. Nothing is matched by Patient, Dentist, branch, date or time; anything else stays legacy.
 * Idempotent: records that already reference a server Visit (and a server queue entry where one exists) are unchanged.
 */
export function reanchorLocalEvidence({ records = [], localQueue = [], visits = [], serverQueue = [] }) {
  const visitIds = new Set(visits.map(v => v.id))
  const visitByAppointment = new Map(visits.filter(v => v.appointmentId).map(v => [v.appointmentId, v.id]))
  const serverEntryByVisit = new Map(serverQueue.map(q => [q.visitId, q.id]))
  const localById = new Map(localQueue.map(q => [q.id, q]))
  let changed = false
  const next = records.map(record => {
    let visitId = isServerId(record?.visitId) ? record.visitId : null
    if (!visitId) {
      const row = localById.get(record?.queueEntryId)
      const candidate = isServerId(row?.visitId) ? row.visitId : isServerId(row?.appointmentId) ? visitByAppointment.get(row.appointmentId) : null
      if (candidate && visitIds.has(candidate)) visitId = candidate
    }
    if (!visitId) return record
    const serverEntry = serverEntryByVisit.get(visitId)
    const queueEntryId = serverEntry && !isServerId(record.queueEntryId) ? serverEntry : record.queueEntryId
    if (visitId === record.visitId && queueEntryId === record.queueEntryId) return record
    changed = true
    return { ...record, visitId, queueEntryId }
  })
  return { records: next, changed }
}

/** Live operational records only: D5 legacy history never feeds live KPIs or worklists. */
export const liveRecords = (records = []) => records.filter(record => !record?.legacyAppointment)
