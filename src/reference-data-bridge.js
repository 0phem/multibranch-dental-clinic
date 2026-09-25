// Phase 2A — translates the real Laravel reference-data API (branches/services/branch-services/staff/
// dentists) into the exact legacy record shape src/data.js's INITIAL_* exports always produced, so
// normalizeClinicState (contracts.js) and every downstream consumer (scheduling.js, logic.js,
// patient-view.js, every UI component) need zero changes. Directly continues the identity-bridge.js
// pattern already proven in this codebase — not a new architectural idea.
//
// Every mapped record's id/userId/personId is a legacy_ref-style string (e.g. 'b1', 'd1', 'per-d1') —
// the backend's internal bigint primary key is never read here and never reaches the frontend. persons/
// users stay fully local and unchanged this phase (see the Phase 2A plan, section D): INITIAL_PERSONS/
// INITIAL_USERS already contain a matching 'per-<ref>'/'u<n>' row for every dentist/staff roster member,
// so personId/userId resolve against the existing local collections with no merge step required — the
// display name a Patient/Staff/Owner sees is unchanged from before this phase.
import * as api from './api-client.js'

export function mapBranch(row) {
  return {
    id: row.id, branchCode: row.branch_code, name: row.name, city: row.city, address: row.address,
    phone: row.phone, open: row.open_time?.slice(0, 5), close: row.close_time?.slice(0, 5),
    status: row.status, threshold: row.capacity_threshold,
  }
}

export function mapService(row) {
  return {
    id: row.id, code: row.code, name: row.name, duration: row.duration_minutes,
    baseFee: row.reference_fee_php, category: row.category, status: row.status,
  }
}

export function mapBranchService(row) {
  return { id: `bs-${row.branch_ref}-${row.service_ref}`, branchId: row.branch_ref, serviceId: row.service_ref, active: row.active, durationOverride: row.duration_override_minutes ?? undefined }
}

export function mapStaffProfile(row) {
  return {
    id: row.id, userId: row.userId, personId: row.personId, staffType: row.title || 'Staff',
    // staffType is the legacy Staff-title field; it is not a Dentist specialty or license.
    role: row.title || '',
    branchId: row.branchId || null, shiftStart: row.shiftStart?.slice(0, 5), shiftEnd: row.shiftEnd?.slice(0, 5),
    available: row.available,
  }
}

export function mapDentistProfile(row) {
  return {
    id: row.id, userId: row.userId, personId: row.personId, staffType: 'Dentist',
    licenseNo: row.license_no ?? undefined, specialty: row.specialty || '',
    branchIds: row.branch_ids || [], assistantStaffId: row.assistantStaffId || null,
    shiftStart: row.shiftStart?.slice(0, 5), shiftEnd: row.shiftEnd?.slice(0, 5), available: row.available,
    // Not part of the legacy INITIAL_DENTISTS shape — consumed only by deriveDentistServiceAssignments
    // below, harmless extra field elsewhere (persistableCollection's 'dentists' omit-list doesn't strip it,
    // and nothing does exact-shape comparison against it).
    serviceIds: row.service_ids || [],
  }
}

// dentistServiceAssignments was always a *generated* array in data.js (see dentistServiceAssignmentId()),
// never an independently seeded collection — this reproduces that exact generation client-side from the
// already-fetched dentists response, so no 6th bootstrap call is needed (Phase 2A plan, section H).
export function deriveDentistServiceAssignments(dentists) {
  return dentists.flatMap(d => (d.serviceIds || []).map(serviceId => ({
    id: `dsa-${d.id}-${serviceId}`, dentistId: d.id, serviceId,
  })))
}

// Role-aware bootstrap (Phase 2A plan, section H/point 1): Patient never calls /api/staff — least privilege
// stays intact at the transport layer, not just the backend's own authorization.
export async function fetchReferenceData(role) {
  const calls = {
    branches: api.listBranches(), services: api.listServices(), branchServices: api.listBranchServices(),
    dentists: api.listDentists(),
    ...(role === 'patient' ? {} : { staff: api.listStaff() }),
  }
  const keys = Object.keys(calls)
  const results = await Promise.all(Object.values(calls))
  const failed = results.find(r => !r.ok)
  if (failed) return { ok: false, kind: failed.kind, message: failed.message }

  const byKey = Object.fromEntries(keys.map((key, i) => [key, results[i].data]))
  const dentists = (byKey.dentists || []).map(mapDentistProfile)
  return {
    ok: true,
    data: {
      branches: (byKey.branches || []).map(mapBranch),
      services: (byKey.services || []).map(mapService),
      branchServices: (byKey.branchServices || []).map(mapBranchService),
      staff: (byKey.staff || []).map(mapStaffProfile),
      dentists,
      dentistServiceAssignments: deriveDentistServiceAssignments(dentists),
    },
  }
}

// ---- Write side (Phase 2A plan, section J/point 8) --------------------------------------------------
// Each function calls the real API, maps the confirmed response back to the legacy shape, and returns it
// for the caller to hand to the new adopt*FromServer actions (administration.js) — never the original
// saveBranch/setBranchService/savePersonnel, whose own independent local validation is not provably
// identical to the backend's and must not be re-run against an already-server-confirmed payload.

export async function syncBranchUpdate(legacyRef, form) {
  const payload = {}
  if (form.branchCode !== undefined) payload.branch_code = form.branchCode
  if (form.name !== undefined) payload.name = form.name
  if (form.city !== undefined) payload.city = form.city
  if (form.address !== undefined) payload.address = form.address
  if (form.phone !== undefined) payload.phone = form.phone
  if (form.open !== undefined) payload.open_time = form.open
  if (form.close !== undefined) payload.close_time = form.close
  if (form.status !== undefined) payload.status = form.status
  if (form.threshold !== undefined) payload.capacity_threshold = form.threshold

  const result = await api.updateBranch(legacyRef, payload)
  if (!result.ok) return result
  return { ok: true, record: mapBranch(result.data) }
}

export async function syncBranchServiceToggle(branchId, serviceId, active) {
  const result = await api.setBranchService({ branch_ref: branchId, service_ref: serviceId, active })
  if (!result.ok) return result
  return { ok: true, record: mapBranchService(result.data) }
}

export async function syncPersonnelUpdate(collection, legacyRef, form) {
  if (collection === 'staff') {
    const payload = {}
    // The Admin.jsx staff-edit form edits `staffType` — maps onto the API's `title` field, which is what
    // staff_profiles.title (bugfix — see the add_title_to_staff_profiles_table migration) actually stores.
    if (form.staffType !== undefined) payload.title = form.staffType
    if (form.branchId !== undefined) payload.branch_ref = form.branchId
    if (form.shiftStart !== undefined) payload.shift_start = form.shiftStart
    if (form.shiftEnd !== undefined) payload.shift_end = form.shiftEnd
    if (form.available !== undefined) payload.available = form.available

    const result = await api.updateStaffProfile(legacyRef, payload)
    if (!result.ok) return result
    return { ok: true, record: mapStaffProfile(result.data) }
  }

  const payload = {}
  if (form.licenseNo !== undefined) payload.license_no = form.licenseNo
  if (form.specialty !== undefined) payload.specialty = form.specialty
  if (form.assistantStaffId !== undefined) payload.assistant_staff_ref = form.assistantStaffId
  if (form.branchIds !== undefined) payload.branch_ids = form.branchIds
  if (form.shiftStart !== undefined) payload.shift_start = form.shiftStart
  if (form.shiftEnd !== undefined) payload.shift_end = form.shiftEnd
  if (form.available !== undefined) payload.available = form.available

  const result = await api.updateDentistProfile(legacyRef, payload)
  if (!result.ok) return result
  return { ok: true, record: mapDentistProfile(result.data) }
}
