import { isRecord } from './safeguards.js'

// Scheduling reference helpers (M6 cutover). Appointment scheduling authority — the booking window, start grids,
// availability search, overlap checks and deterministic Dentist assignment — lives in the Laravel M6 API (see
// backend SchedulingService); the browser no longer searches for open times or assigns a Dentist. What remains here
// is reference-data filtering the UI uses to present choices (which services a branch offers, which Dentists are
// configured for a branch and service). The server validates every choice again.

const activeAccount=(state,dentist)=>{const user=state.users.find(u=>u.id===dentist.userId);return !!user&&(user.accountStatus||user.status)==='Active'}

// Services an Open branch actively offers (reference data only).
export const servicesAt=(state,branchId)=>{
  const offered=new Set(state.branchServices.filter(bs=>bs.branchId===branchId&&bs.active!==false).map(bs=>bs.serviceId))
  return state.services.filter(s=>s.status==='Active'&&offered.has(s.id))
}
// Dentists configured for a branch and service. Used for Staff Dentist selection and walk-in admission; the M6 server
// decides bookability from the Dentist profile alone. The active-account check stays for the browser-local walk-in and
// treatment prototypes, whose sessions still depend on the local account projection.
export const dentistsFor=(state,branchId,serviceId)=>{
  if(!isRecord(state))return []
  const allowed=new Set(state.dentistServiceAssignments.filter(a=>a.serviceId===serviceId&&a.isAuthorized!==false).map(a=>a.dentistId))
  return state.dentists.filter(d=>d.branchIds?.includes(branchId)&&d.available&&allowed.has(d.id)&&activeAccount(state,d))
}
