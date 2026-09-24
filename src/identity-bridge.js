import { sessionForRole, sessionForUser } from './contracts.js'
import { uid } from './logic.js'
import { clinicNow } from './clock.js'

// Backend Foundation 1B — TEMPORARY compatibility bridge. Authentication, identity and role are authoritative
// from the real Laravel/Sanctum backend (`GET /api/me`); this module's only job is to project that backend
// identity onto the still-frontend-local business collections (persons/patients/users) so the existing,
// unmigrated pages/selectors keep working completely unchanged. Remove this file, and the `bridgeBackendIdentity`
// wiring in store.jsx, as each corresponding module's data moves to the backend.
//
// Every explicit mapping entry verifies BOTH the exact backend seed email AND that the backend's own `me.role`
// matches the role this entry claims — email alone is never sufficient authority. This table is intentionally
// the ONLY place a backend identity is translated into a local operational identity; nothing here scans an
// array, picks "the first" of anything, or guesses.
const DEMO_IDENTITY_MAP = {
  'owner@example.test': { role: 'owner', kind: 'role-info', roleInfoKey: 'owner' },
  'staff.reception@example.test': { role: 'staff', kind: 'role-info', roleInfoKey: 'staff' },
  // staff.assistant@example.test is deliberately NOT mapped: ROLE_INFO defines exactly one local Staff
  // operational identity (Alyssa Cruz / u2), already claimed above. Mapping a second, distinct backend person
  // to that same local identity would mean two different backend people sharing one local Staff account —
  // exactly what must never happen. This account fails closed (see bridgeFromBackend below) until a second
  // local Staff identity exists to map it to. staff.reception@example.test alone is sufficient for an
  // end-to-end Staff demo.
  'dentist@example.test': { role: 'dentist', kind: 'role-info', roleInfoKey: 'dentist' },
  // Explicit alignment, not a rename of the backend seed and not a name/fuzzy match: the Backend 1A demo
  // Patient account is declared here to represent the existing, already-populated local Patient (Maria
  // Santos, p1/u12), so signing in through the real backend still demonstrates her existing care history
  // rather than a second, empty duplicate Patient.
  'patient@example.test': { role: 'patient', kind: 'local-patient', patientId: 'p1', userId: 'u12' },
}

const cleanText = value => typeof value === 'string' ? value.trim() : ''

export function createIdentityBridge({ getState, commit, clock = clinicNow }) {
  return function bridgeFromBackend(me) {
    if (!me || typeof me !== 'object' || !me.role) return { ok: false, reason: 'invalid-identity' }
    const mapped = DEMO_IDENTITY_MAP[me.email]
    if (mapped) {
      if (mapped.role !== me.role) return { ok: false, reason: 'role-mismatch' }
      const state = getState()
      const session = mapped.kind === 'role-info'
        ? sessionForRole(mapped.roleInfoKey, state)
        : sessionForUser(state, mapped.userId)
      return session ? { ok: true, session } : { ok: false, reason: 'no-local-identity' }
    }
    // Any backend account not in the explicit table above fails closed unless it is a Patient — any number
    // of real people can register as a Patient, so that path is general-purpose, not table-based.
    if (me.role !== 'patient') return { ok: false, reason: 'no-local-identity' }
    return bridgePatient(me, { getState, commit, clock })
  }
}

// Upserts a minimal local Person/Patient/User projection for a real, backend-authenticated Patient who has no
// pre-existing local demo row. Idempotent by `backendUserId`: a second login from the same backend account
// reuses the same local IDs rather than creating a duplicate. Creates identity only — no appointment,
// treatment, invoice, HMO case or any other history is fabricated, exactly like a real registration today.
function bridgePatient(me, { getState, commit, clock }) {
  const existingUser = getState().users.find(u => u.backendUserId === me.id)
  if (existingUser) {
    const session = sessionForUser(getState(), existingUser.id)
    return session ? { ok: true, session } : { ok: false, reason: 'stale-local-identity' }
  }

  const state = getState()
  const now = clock()
  const openBranch = state.branches.find(b => b.status === 'Open')
  const firstName = cleanText(me.first_name)
  const lastName = cleanText(me.last_name)
  const email = cleanText(me.email).toLowerCase()

  const person = {
    id: uid('per'), firstName, middleName: cleanText(me.middle_name), lastName, email,
    phone: cleanText(me.phone), dob: cleanText(me.date_of_birth), sex: '', address: '',
    backendPersonId: me.person_id,
  }
  // No branch preference exists in the current backend registration contract (see backend/README.md); the
  // first Open branch is a technical default for local operational compatibility only, never presented as a
  // stated Patient preference.
  const patient = {
    id: uid('p'), personId: person.id, userId: null,
    patientCode: `PAT-${String(state.patients.length + 1).padStart(4, '0')}`,
    preferredBranchId: openBranch?.id || null, hmo: 'None', hmoMember: '—', allergies: '', medicalHistory: '',
    dentalHistory: '', emergencyContact: '', consent: false,
  }
  const user = {
    id: uid('u'), personId: person.id, username: email, login: email, roleName: 'Patient', role: 'Patient',
    branchId: null, accountStatus: 'Active', status: 'Active', permissions: ['patient-portal'],
    lastLogin: now.timestamp, registeredAt: now.timestamp,
    // Markers written only by this bridge; they make the upsert idempotent and are what makes this whole file
    // removable later without touching the canonical person_id/patient_id relationships they point back to.
    backendUserId: me.id, backendPersonId: me.person_id,
  }
  patient.userId = user.id

  const key = `backend-bridge:${me.id}`, eventId = `event:${key}`
  const logEntry = {
    id: eventId, commandKey: key, at: now.label, createdAt: now.timestamp, module: 'M1→M4',
    event: 'patient.backend_identity_bridged', eventType: 'patient.backend_identity_bridged',
    result: 'Backend-authenticated Patient identity created (local compatibility projection)',
    status: 'Success', entityType: 'patient', entityId: patient.id, patientId: patient.id,
    branchId: patient.preferredBranchId,
  }
  const auditEntry = {
    id: uid('aud'), eventId, at: now.label, actor: `${firstName} ${lastName}`.trim() || email,
    actorUserId: user.id, action: 'Backend-authenticated Patient registration (local compatibility projection)',
    module: 'M1→M4',
  }

  commit({
    persons: [...state.persons, person],
    patients: [...state.patients, patient],
    users: [...state.users, user],
    workflowLog: [logEntry, ...state.workflowLog],
    audit: [auditEntry, ...state.audit].slice(0, 150),
  })

  const session = sessionForUser(getState(), user.id)
  return session ? { ok: true, session } : { ok: false, reason: 'bridge-failed' }
}
