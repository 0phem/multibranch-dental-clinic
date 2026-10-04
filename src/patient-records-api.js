import * as api from './api-client.js'
import { normalizeFailure } from './appointments-api.js'

// M4 Patient record client. Laravel/PostgreSQL is the only authority for the non-clinical Patient profile: nothing here
// reads or writes browser storage, and a failure is returned as an explicit result — never a demo or "first" Patient.
// Clinical history (allergies, medical and dental history) has no server representation yet, so it is neither loaded nor
// sent. Ids are public ULIDs; the preferred branch uses its legacy_ref, like the rest of the reference API.

/** The fields a front-desk Staff account may maintain, in UI naming -> server naming. */
export const EDITABLE_FIELDS = {
  firstName: 'first_name', lastName: 'last_name', phone: 'phone', dob: 'date_of_birth', sex: 'sex',
  address: 'address', emergencyContact: 'emergency_contact', email: 'email', preferredBranchId: 'preferred_branch_id',
}

/** Server record -> UI read model. Fields outside the viewer's tier stay undefined (not ''), so a restricted record is never shown as blank data. */
export function mapPatientRecord(row) {
  return {
    id: row.id, patientCode: row.code, name: row.name || '', firstName: row.first_name || '', lastName: row.last_name || '',
    dob: row.date_of_birth || '', phone: row.phone || '',
    // `identity` is the directory-level tier (no sex, email, address, emergency contact, branch or revision); `full` adds them.
    access: row.profile_access === 'full' ? 'full' : 'identity',
    sex: 'sex' in row ? row.sex || '' : undefined, emergencyContact: 'emergency_contact' in row ? row.emergency_contact || '' : undefined,
    email: 'email' in row ? row.email || '' : undefined, address: 'address' in row ? row.address || '' : undefined,
    preferredBranchId: 'preferred_branch' in row ? row.preferred_branch?.id ?? null : undefined,
    preferredBranch: 'preferred_branch' in row ? row.preferred_branch?.name ?? '' : undefined,
    hasPortalAccount: row.has_portal_account === true, revision: row.revision,
  }
}

/** Only the fields that differ from the loaded record, in server naming. An account holder's email is never sent (M1 owns it). */
export function changedFields(record, form) {
  const changes = {}
  for (const [ui, server] of Object.entries(EDITABLE_FIELDS)) {
    if (form[ui] === undefined || form[ui] === record[ui]) continue
    if (ui === 'email' && record.hasPortalAccount) continue
    const value = typeof form[ui] === 'string' ? form[ui].trim() : form[ui]
    if (value === (record[ui] ?? '')) continue
    changes[server] = value === '' && !['first_name', 'last_name'].includes(server) ? null : value
  }
  return changes
}

export async function loadPatientRecord(id) {
  const result = await api.getPatientRecord(id)
  return result.ok ? { ok: true, record: mapPatientRecord(result.data) } : normalizeFailure(result)
}

/** Saves the changed fields against the revision that was loaded; a 409 means someone else saved first. */
export async function savePatientRecord(record, form) {
  const changes = changedFields(record, form)
  if (!Object.keys(changes).length) return { ok: true, unchanged: true, record }
  const result = await api.updatePatientRecordRemote(record.id, { ...changes, expected_revision: record.revision })
  if (!result.ok) {
    const failure = normalizeFailure(result)
    return failure.kind === 'conflict' ? { ...failure, message: 'This patient record changed after you opened it. Reload it before saving again.' } : failure
  }
  return { ok: true, record: mapPatientRecord(result.data) }
}

/** The read-only index of linked records: counts per family plus the families that have no server source yet. */
export async function loadPatientRecordIndex(id) {
  const result = await api.getPatientRecordIndex(id)
  if (!result.ok) return normalizeFailure(result)
  const d = result.data
  const families = ['appointments', 'visits', 'treatments', 'invoices', 'hmo_cases']
  return {
    ok: true,
    counts: Object.fromEntries(families.map(f => [f, Array.isArray(d[f]) ? d[f].length : 0])),
    limit: d.limit_per_list ?? null,
    unavailable: Array.isArray(d.unavailable) ? d.unavailable : [],
  }
}
