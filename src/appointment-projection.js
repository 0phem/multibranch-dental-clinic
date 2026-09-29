import { isLegacyAppointmentRef, mapAppointment } from './appointments-api.js'

// TEMPORARY read model for the M6 cutover. Server appointments (Laravel/PostgreSQL) are the only appointment truth; the
// still-browser-local modules (check-in, queue, treatment, billing, HMO, follow-ups, messaging, dashboards) keep reading
// the same `state.appointments`/`state.patients` shapes through this projection. Nothing here is persisted or written
// back. Remove it module by module as each consumer moves to the backend.

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

/** Server rows -> read-model appointments plus read-model Patients for server Patients with no local projection. */
export function buildServerProjection({ rows = [], directory = [], session = null, users = [], patients = [] }) {
  const keyFor = patientKeyResolver({ session, users, patients })
  const appointments = rows.map(row => mapAppointment(row, keyFor))
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
  for (const row of rows) addPatient(row.patient?.id, { patientCode: row.patient?.code, name: row.patient?.name })
  for (const patient of directory) addPatient(patient.id, patient)
  return { appointments, readModelPatients: [...readModel.values()], keyFor }
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
 * D5 LEGACY HISTORY. Records created before the cutover reference browser-local appointment ids. They stay only as
 * read-only history: live queue/check-in collections exclude them, and every other record carries `legacyAppointment`
 * so live integrity decisions, live KPIs and mutations can ignore them.
 */
export function splitLegacy(records = [], key = 'appointmentId') {
  const live = [], legacy = []
  for (const record of records) (isLegacyAppointmentRef(record?.[key]) ? legacy : live).push(record)
  return { live, legacy }
}

export const flagLegacy = (records = [], key = 'appointmentId', legacyTreatmentIds = new Set(), legacyQueueIds = new Set()) =>
  records.map(record => (isLegacyAppointmentRef(record?.[key]) || legacyTreatmentIds.has(record?.treatmentId) || legacyQueueIds.has(record?.queueEntryId)
    ? { ...record, legacyAppointment: true } : record))

/**
 * D5 classification that follows the record links: a treatment is legacy when it references a pre-cutover appointment
 * or a legacy queue entry; invoices, prescriptions, follow-ups, HMO cases and conversations are legacy when they
 * reference a legacy appointment, a legacy treatment or a legacy queue entry.
 */
export function classifyLegacy({ queue = [], checkIns = [], treatments = [], invoices = [], prescriptions = [], followups = [], hmo = [], conversations = [], inquiries = [] }) {
  const liveQueue = splitLegacy(queue), liveCheckIns = splitLegacy(checkIns)
  const legacyQueueIds = new Set(liveQueue.legacy.map(q => q.id))
  const flaggedTreatments = flagLegacy(treatments, 'appointmentId', new Set(), legacyQueueIds)
  const legacyTreatmentIds = new Set(flaggedTreatments.filter(t => t.legacyAppointment).map(t => t.id))
  const flag = rows => flagLegacy(rows, 'appointmentId', legacyTreatmentIds, legacyQueueIds)
  return {
    queue: liveQueue, checkIns: liveCheckIns, treatments: flaggedTreatments,
    invoices: flag(invoices), prescriptions: flag(prescriptions), followups: flag(followups), hmo: flag(hmo), conversations: flag(conversations),
    inquiries: flagLegacy(inquiries, 'bookedAppointmentId'),
  }
}

/** Live operational records only: D5 legacy history never feeds live KPIs or worklists. */
export const liveRecords = (records = []) => records.filter(record => !record?.legacyAppointment)
