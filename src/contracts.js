import { INITIAL_BRANCHES, ROLE_INFO } from './data.js'
import { clinicDate } from './clock.js'

export const TERMINAL = ['Completed','Cancelled','No-show']
export const isActiveQueue = q => !!q && !TERMINAL.includes(q.status)
export const isTodayQueue = (q, date=clinicDate()) => q?.clinicDate === date
export const isWaitingQueue = q => isActiveQueue(q) && q.status !== 'Temporarily Away'
export function branchIdFor(record, branches) {
  if (record?.branchId) return record.branchId
  return branches.find(b=>b.name===record?.branch)?.id || INITIAL_BRANCHES.find(b=>b.name===record?.branch)?.id || null
}
export function sessionForRole(role, state) {
  const info=ROLE_INFO[role]
  if (!info) return null
  const user=state.users.find(u=>u.id===info.userId)
  return {...info,role,branchId:user?.branchId||info.branchId||null,active:!!user&&(user.accountStatus||user.status)==='Active'}
}
export function inScope(record, session) {
  if (!session?.active || !record) return false
  if (session.role==='owner') return !session.scopeBranchId || record.branchId===session.scopeBranchId
  if (session.role==='patient') return record.patientId===session.patientId
  if (session.role==='dentist') return record.dentistId===session.dentistId
  return session.role==='staff' && !!session.branchId && record.branchId===session.branchId
}
export function patientInScope(patient, state, session) {
  if (!session?.active) return false
  if (session.role==='patient') return patient.id===session.patientId
  if (session.role==='owner') return true
  if (session.role==='staff' && patient.preferredBranchId===session.branchId) return true
  return [...state.appointments,...state.queue,...state.treatments].some(x=>x.patientId===patient.id&&inScope(x,session))
}
export function encounterContext(entry) {
  return entry ? {queueEntryId:entry.id,patientId:entry.patientId,appointmentId:entry.appointmentId||null,dentistId:entry.dentistId,branchId:entry.branchId,serviceId:entry.serviceId,treatmentId:entry.treatmentId||null} : null
}

// Display projections must not become duplicate sources of identity or branch data.
export function persistableCollection(key, rows) {
  const identity=['name','firstName','middleName','lastName','email','phone','dob','sex','address']
  const omitted={
    appointments:['branch','service'],queue:['branch'],treatments:['branch'],invoices:['branch'],
    patients:[...identity,'preferredBranch'],dentists:[...identity,'branches','assistant'],
    staff:[...identity,'branch'],users:identity,
  }[key]||[]
  return rows.map(row=>Object.fromEntries(Object.entries(row).filter(([field])=>{
    if(field==='branch'&&!row.branchId)return true
    if(field==='preferredBranch'&&!row.preferredBranchId)return true
    if(field==='branches'&&!row.branchIds?.length)return true
    return !omitted.includes(field)
  })))
}

// Compatibility boundary for existing localStorage records. IDs are authoritative;
// branch names below are display projections, never relationship keys for new writes.
export function normalizeClinicState(state) {
  const branches=state.branches
  const identity=record=>{
    const person=state.persons.find(p=>p.id===record.personId)
    const {id,...fields}=person||{}
    return {...record,...fields,name:person?[person.firstName,person.middleName,person.lastName].filter(Boolean).join(' '):record.name||record.id}
  }
  const withBranch=record=>{
    const branchId=branchIdFor(record,branches)
    return {...record,branchId,branch:branches.find(b=>b.id===branchId)?.name||'Unknown branch'}
  }
  const appointments=state.appointments.map(a=>{
    const service=state.services.find(s=>s.id===a.serviceId||(!a.serviceId&&s.name===a.service))
    return {...withBranch(a),serviceId:service?.id||a.serviceId||null,service:service?.name||'Unknown service',duration:a.duration||service?.duration||30}
  })
  const treatments=state.treatments.map(t=>{
    const appointment=appointments.find(a=>a.id===t.appointmentId)
    const invoice=state.invoices.find(i=>i.treatmentId===t.id)
    return withBranch({...t,branchId:t.branchId||appointment?.branchId||branchIdFor(invoice,branches)})
  })
  const queue=state.queue.map(q=>{
    const appointment=appointments.find(a=>a.id===q.appointmentId)
    // No patient/dentist/day matching: legacy linkage must have a direct encounter ID.
    const appointmentTreatments=q.appointmentId?treatments.filter(t=>t.appointmentId===q.appointmentId):[]
    const treatment=q.treatmentId?treatments.find(t=>t.id===q.treatmentId):treatments.find(t=>t.queueEntryId===q.id)||(appointmentTreatments.length===1?appointmentTreatments[0]:null)
    const clinicDay=q.clinicDate||q.arrivedAt?.slice(0,10)||appointment?.date||q.queueId?.match(/\d{4}-\d{2}-\d{2}$/)?.[0]||null
    return withBranch({...q,queueEntryId:q.id,branchId:q.branchId||appointment?.branchId||branchIdFor(q,branches),serviceId:q.serviceId||appointment?.serviceId||treatment?.serviceId||null,clinicDate:clinicDay,treatmentId:treatment?.id||q.treatmentId||null,currentState:q.status})
  })
  const checkIns=[...(state.checkIns||[])]
  for (const q of queue) if(q.checkInId&&!checkIns.some(c=>c.id===q.checkInId)) checkIns.push({id:q.checkInId,queueEntryId:q.id,appointmentId:q.appointmentId||null,patientId:q.patientId,dentistId:q.dentistId,branchId:q.branchId,serviceId:q.serviceId,clinicDate:q.clinicDate,arrivedAt:q.arrivedAt||(q.clinicDate?`${q.clinicDate}T${q.checkedIn}:00+08:00`:null),status:TERMINAL.includes(q.status)?q.status:'Checked In',legacy:true})
  return {...state,appointments,queue,checkIns,treatments:treatments.map(t=>({...t,queueEntryId:t.queueEntryId||queue.find(q=>q.treatmentId===t.id)?.id||null})),
    invoices:state.invoices.map(withBranch),
    followups:state.followups.map(f=>({...f,branchId:f.branchId||treatments.find(t=>t.id===f.treatmentId)?.branchId||appointments.find(a=>a.id===f.appointmentId)?.branchId||null})),
    patients:state.patients.map(p=>{const preferredBranchId=p.preferredBranchId||branchIdFor({branch:p.preferredBranch},branches);return {...identity(p),preferredBranchId,preferredBranch:branches.find(b=>b.id===preferredBranchId)?.name||'Unknown branch'}}),
    dentists:state.dentists.map(d=>{const branchIds=d.branchIds||(d.branches||[]).map(branch=>branchIdFor({branch},branches)).filter(Boolean);return {...d,branchIds,branches:branchIds.map(id=>branches.find(b=>b.id===id)?.name||'Unknown branch')}}),
    staff:state.staff.map(s=>{const projected=withBranch(s);return {...projected,branch:!projected.branchId&&(s.branch==='All Branches'||state.users.find(u=>u.id===s.userId)?.branch==='All Branches')?'All Branches':projected.branch}}),
  }
}
