import { clinicNow, validDate, clinicDateAt } from './clock.js'
import { isServerId } from './appointments-api.js'

export const isRecord=value=>!!value&&typeof value==='object'&&!Array.isArray(value)
export const validTime=value=>typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value)
const active=u=>!!u&&(u.accountStatus||u.status)==='Active'
const staffRoles=['Receptionist','Dental Assistant','HMO Coordinator','Cashier','Patient Engagement Staff']

// Revalidate identity claims against the CURRENT store, never just session flags.
export function validSession(state,session,now=clinicNow()) {
  if(!session?.active)return false
  const user=state.users.find(u=>u.id===session.userId)
  if(!active(user)||!Array.isArray(user.permissions)||!state.persons.some(p=>p.id===user.personId))return false
  if(session.expiresAt&&(!Number.isFinite(Date.parse(session.expiresAt))||Date.parse(session.expiresAt)<=Date.parse(now.timestamp)))return false
  const role=user.roleName||user.role
  if(session.role==='owner')return role==='Owner / Admin'&&user.permissions?.includes('all')
  if(session.role==='patient')return role==='Patient'&&user.permissions?.includes('patient-portal')&&state.patients.some(p=>p.id===session.patientId&&p.userId===user.id&&p.personId===user.personId)
  if(session.role==='dentist')return role==='Dentist'&&state.dentists.some(d=>d.id===session.dentistId&&d.userId===user.id&&d.personId===user.personId&&d.branchIds?.includes(session.branchId)&&user.branchId===session.branchId)
  return session.role==='staff'&&staffRoles.includes(role)&&user.branchId===session.branchId&&state.staff.some(s=>s.userId===user.id&&s.personId===user.personId&&s.branchId===session.branchId)
}
export function permitted(state,session,permission) {
  if(!validSession(state,session))return false
  const permissions=state.users.find(u=>u.id===session.userId).permissions||[]
  return permissions.includes('all')||permissions.includes(permission)||session.role==='patient'&&permissions.includes('patient-portal')
}

const same=(a,b,keys)=>keys.every(k=>(a?.[k]??null)===(b?.[k]??null))
const contextKeys=['patientId','dentistId','branchId','appointmentId']
const ARRIVAL_SKEW_MS=5*60*1000
// Missing legacy optional links remain readable; explicit contradictory links fail closed.
// M8/M9/M5: every live encounter is one server Visit; its queue entry `q` is the server M9 entry for that Visit
// (`q.visitId`) and its clinical record is the server M5 Treatment for that Visit. All three are server truth (one server
// transaction moves them together); this check only refuses to act on a projection that is missing or contradictory.
// Pre-server (browser-local) treatment history never takes part in a live encounter.
export function encounterIssue(state,q,now=clinicNow()) {
  if(!q||!state.patients.some(p=>p.id===q.patientId)||!state.branches.some(b=>b.id===q.branchId)||!state.dentists.some(d=>d.id===q.dentistId))return 'The encounter profile is missing. Ask the clinic to review this record.'
  // Arrival times come from the server clock, so a few minutes of browser clock skew are tolerated.
  if(!validDate(q.clinicDate)||q.arrivedAt&&(!strictTimestamp(q.arrivedAt)||Date.parse(strictTimestamp(q.arrivedAt))>Date.parse(now.timestamp)+ARRIVAL_SKEW_MS||clinicDateAt(strictTimestamp(q.arrivedAt))!==q.clinicDate))return 'The arrival date/time needs clinic review.'
  if(state.queue.filter(x=>x.id===q.id||q.visitId&&x.visitId===q.visitId).length!==1)return 'Duplicate encounter links need clinic review.'
  if(!q.visitId)return 'This queue entry has no clinic visit record. Ask the clinic to review it.'
  // Visits are projected for Staff/Dentist/Owner sessions (fail closed when one is missing). A Patient session has no
  // Visit API yet (D9), so its read-only views validate the encounter from the local links alone.
  const v=(state.visits||[]).find(v=>v.id===q.visitId)
  if(!v&&state.visitsProjected!==false)return 'This visit is not loaded from the clinic server. Refresh the worklist and try again.'
  if(v&&(!same(v,q,contextKeys)||v.clinicDate!==q.clinicDate))return 'The queue and visit identify different encounters. Ask the clinic to review the links.'
  const a=q.appointmentId?state.appointments.find(a=>a.id===q.appointmentId):null
  if(q.appointmentId&&(!a||!same(a,q,['patientId','dentistId','branchId'])||a.date!==q.clinicDate))return 'The queue and appointment identify different encounters. Ask the clinic to review the links.'
  if(a&&['Cancelled','No-show'].includes(a.status))return 'The appointment is already closed. Refresh the worklist; this queue requires clinic review.'
  if(!v)return null
  // A scheduled Visit moves its appointment in the same server transaction, so their statuses always match.
  if(a&&a.status!==v.status)return 'The appointment and visit disagree. Refresh the worklist; this encounter needs clinic review.'
  if((q.status==='Served')!==(v.status!=='Checked In'))return 'The queue and visit disagree. Refresh the worklist; this encounter needs clinic review.'
  const treatments=state.treatments.filter(t=>t.server&&t.visitId===v.id)
  if(treatments.length>1)return 'Multiple treatments reference this visit. Ask the clinic to review the links.'
  const t=treatments[0]
  if(t&&(!same(t,q,['patientId','dentistId','branchId','appointmentId'])||t.status!==v.status))return 'The treatment does not match this encounter. Refresh the worklist; it needs clinic review.'
  // Completed Visits from before the M5 cutover legitimately have no server Treatment; an In Treatment Visit always has one.
  if(!t&&v.status==='In Treatment')return 'This encounter’s treatment is not loaded from the clinic server. Refresh the worklist and try again.'
  return null
}
// M5/M9 (Q11): completed-encounter evidence is anchored on the server Visit. A SERVER Treatment counts when it is Completed
// and — where Visits are projected — its Visit is Completed for the same Patient, Dentist, branch and appointment. A
// Patient session (no Visit API yet, D9) reads only its own completed safe subset from the server, which is itself the
// evidence. A pre-server local treatment keeps counting only for downstream records already linked to it, through its
// exact server Visit link.
export function completedEncounter(state,t) {
  if(!t||t.status!=='Completed')return false
  if(t.server&&t.patientSubset)return state.visitsProjected===false
  if(!isServerId(t.visitId))return false
  const v=(state.visits||[]).find(v=>v.id===t.visitId)
  if(!v)return state.visitsProjected===false
  return v.status==='Completed'&&same(v,t,contextKeys)
}
export function paymentConsistent(invoice) {
  const p=invoice.payment
  if(invoice.status!=='Paid')return !p&&invoice.paymentStatus==='Unpaid'&&!invoice.receipt
  return !!p&&p.status==='Completed'&&p.invoiceId===invoice.id&&p.patientId===invoice.patientId&&p.branchId===invoice.branchId&&Number.isFinite(p.amount)&&p.amount>0&&p.amount===invoice.total&&['Cash','Card','Electronic'].includes(p.method)&&p.method===invoice.method&&invoice.paymentStatus==='Paid'&&!!p.id&&!!p.recordedBy&&!!p.recordedAt&&!!p.receipt&&p.receipt===invoice.receipt
}
export function strictTimestamp(value) {
  if(typeof value!=='string'||!validDate(value.slice(0,10)))return null
  const match=value.match(/^\d{4}-\d{2}-\d{2}[ T](\d{2}:\d{2})(?::([0-5]\d)(?:\.\d{1,3})?)?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/)
  if(!match||!validTime(match[1]))return null
  const normalized=value.replace(' ','T')+(match[3]?'':'+08:00')
  return Number.isFinite(Date.parse(normalized))?normalized:null
}

// UI route guard complements command/selector checks; no URL or context grants access.
const pages={patient:['dashboard','book','appointments','queue','prescriptions','followups','hmo','messages','billing','loyalty','me'],staff:['dashboard','appointments','checkin','queue','capacity','patients','billing','hmo','inquiries','messages','followups','engagement'],dentist:['dashboard','schedule','queue','patients','treatment','prescriptions','followups','messages'],owner:['dashboard','analytics','branches','team','capacity','hmo','users','pricing','automation','engagement']}
const pagePermission={appointments:'appointments',book:'appointments',checkin:'checkin',queue:'queue',patients:'patient-demographics',billing:'billing',hmo:'hmo',messages:'messages',followups:'followups',schedule:'schedule',treatment:'treatment',prescriptions:'prescriptions',engagement:'engagement',inquiries:'inquiries'}
export function canAccessPage(state,session,page) {
  if(!validSession(state,session)||!pages[session.role]?.includes(page))return false
  if(session.role==='owner'||session.role==='patient')return true
  if(page==='patients'&&session.role==='dentist')return permitted(state,session,'clinical-records')
  if(page==='inquiries'){const u=state.users.find(u=>u.id===session.userId);return permitted(state,session,'inquiries')||u.roleName==='Receptionist'&&permitted(state,session,'messages')}
  return !pagePermission[page]||permitted(state,session,pagePermission[page])
}
