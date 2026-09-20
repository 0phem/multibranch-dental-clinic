import { clinicNow } from './clock.js'

export const HMO_PROVIDERS=[{id:'hmo-medicare',name:'MediCare Plus'},{id:'hmo-healthfirst',name:'HealthFirst'}]
export const HMO_REQUIREMENT_RULES=[
  {id:'hmo-card',label:'HMO Card'},
  {id:'valid-id',label:'Valid ID'},
  {id:'treatment-request',label:'Dentist treatment request'},
]
export const HMO_PENDING_HOURS=12
export const pendingHmo=h=>['Pending','Escalated'].includes(h.status)
export const activeUser=user=>!!user&&(user.accountStatus||user.status)==='Active'
export function clinicTimestamp(value) {
  if(!value)return null
  const local=/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?$/.test(value)?`${value.replace(' ','T')}${value.length===16?':00':''}+08:00`:value
  return Number.isFinite(Date.parse(local))?local:null
}
export function pendingHours(h,now=clinicNow()) {
  const start=clinicTimestamp(h.submittedAt),end=clinicTimestamp(pendingHmo(h)?now.timestamp:h.providerRespondedAt)
  return start&&end?Math.max(0,(Date.parse(end)-Date.parse(start))/3600000):0
}
export const missingRequirements=h=>(h.requirements||[]).filter(r=>r?.state!=='Validated locally')
export function validHmoContext(state,h) {
  if(!h||!state.patients.some(p=>p.id===h.patientId)||!state.branches.some(b=>b.id===h.branchId)||!HMO_PROVIDERS.some(p=>p.id===h.providerId))return false
  const t=h.treatmentId?state.treatments.find(t=>t.id===h.treatmentId):null
  const a=h.appointmentId?state.appointments.find(a=>a.id===h.appointmentId):null
  if(h.treatmentId&&(!t||t.patientId!==h.patientId||t.branchId!==h.branchId))return false
  if(h.appointmentId&&(!a||a.patientId!==h.patientId||a.branchId!==h.branchId))return false
  if(t&&h.appointmentId&&(t.appointmentId!==h.appointmentId||t.dentistId!==a.dentistId))return false
  return true
}
export function canProcessHmo(state,session,h) {
  const user=state.users.find(u=>u.id===session?.userId)
  return session?.active&&session.role==='staff'&&activeUser(user)&&user.permissions?.includes('hmo')&&user.branchId===h.branchId&&session.branchId===h.branchId&&validHmoContext(state,h)
}
export function visibleHmo(state,session) {
  if(!session?.active||!activeUser(state.users.find(u=>u.id===session.userId)))return []
  if(session.role==='dentist'&&!state.dentists.some(d=>d.id===session.dentistId&&d.userId===session.userId))return []
  return (state.hmo||[]).filter(h=>{
    if(!validHmoContext(state,h))return session.role==='owner'&&(!session.scopeBranchId||session.scopeBranchId===h.branchId)
    if(session.role==='patient')return h.patientId===session.patientId&&state.patients.find(p=>p.id===h.patientId)?.userId===session.userId
    if(session.role==='staff')return canProcessHmo(state,session,h)
    if(session.role==='owner')return !session.scopeBranchId||session.scopeBranchId===h.branchId
    if(session.role==='dentist')return state.treatments.some(t=>t.id===h.treatmentId&&t.dentistId===session.dentistId)||state.appointments.some(a=>a.id===h.appointmentId&&a.dentistId===session.dentistId)
    return false
  }).map(h=>['staff','owner'].includes(session.role)?h:{id:h.id,patientId:h.patientId,branchId:h.branchId,treatmentId:h.treatmentId,appointmentId:h.appointmentId,providerId:h.providerId,status:h.status,providerOutcome:h.providerOutcome,submittedAt:h.submittedAt,providerRespondedAt:h.providerRespondedAt,requirements:h.requirements.map((r,index)=>r?{id:r.id,ruleId:r.ruleId,label:r.label,state:r.state}:{id:`invalid-${index}`,label:'Unknown requirement',state:'Needs clinic review'}),missing:h.missing})
}
export function ownsNotification(state,session,n) {
  if(!session?.active||n.recipientUserId!==session.userId||!activeUser(state.users.find(u=>u.id===session.userId)))return false
  if(session.role==='patient')return n.patientId===session.patientId&&state.patients.find(p=>p.id===session.patientId)?.userId===session.userId
  if(session.role==='staff')return n.branchId===session.branchId&&state.users.find(u=>u.id===session.userId)?.branchId===n.branchId
  if(session.role==='dentist')return n.dentistId===session.dentistId&&state.dentists.some(d=>d.id===session.dentistId&&d.userId===session.userId)
  return session.role==='owner'
}
export const visibleNotifications=(state,session)=>(state.notifications||[]).filter(n=>ownsNotification(state,session,n))
export function canReadConversation(state,session,c) {
  if(!session?.active||!c?.participantUserIds?.includes(session.userId))return false
  const user=state.users.find(u=>u.id===session.userId)
  if(!activeUser(user)||!state.patients.some(p=>p.id===c.patientId))return false
  if(session.role==='patient')return c.patientId===session.patientId&&state.patients.find(p=>p.id===c.patientId)?.userId===session.userId
  if(session.role==='staff')return c.branchId===session.branchId&&user.branchId===c.branchId&&user.permissions?.includes('messages')
  if(session.role==='dentist')return state.dentists.some(d=>d.id===session.dentistId&&d.userId===session.userId)
  return false
}
export const visibleConversations=(state,session)=>(state.conversations||[]).filter(c=>canReadConversation(state,session,c))

// Migration is pure: recover only explicit IDs or an unambiguous named assignee.
// Unknown legacy ownership remains inaccessible; no broad-role ownership is invented.
export function normalizePhase3(state) {
  const userName=u=>{const p=state.persons.find(p=>p.id===u.personId);return `${(u.roleName||u.role)==='Dentist'?'Dr. ':''}${[p?.firstName,p?.middleName,p?.lastName].filter(Boolean).join(' ')}`}
  const assignee=record=>{
    if(record.assignedUserId)return state.users.find(u=>u.id===record.assignedUserId)
    const matches=state.users.filter(u=>userName(u)===(record.assignedTo||record.assigned))
    return matches.length===1?matches[0]:null
  }
  const patients=state.patients.map(p=>({...p,hmoProviderId:p.hmoProviderId||HMO_PROVIDERS.find(h=>h.name===p.hmo)?.id||null}))
  const hmo=(state.hmo||[]).map(h=>{
    const branchId=h.branchId||state.branches.find(b=>b.name===h.branch)?.id||null
    const providerId=h.providerId||HMO_PROVIDERS.find(p=>p.name===h.provider)?.id||null
    const requirements=Array.isArray(h.requirements)?h.requirements:HMO_REQUIREMENT_RULES.map(r=>({id:`${h.id}:${r.id}`,ruleId:r.id,label:r.label,state:(Array.isArray(h.documents)?h.documents:[]).some(d=>d===r.label||r.id==='valid-id'&&d==='ID'||r.id==='treatment-request'&&d==='Treatment Request')?'Validated locally':'Missing',legacy:true}))
    return {...h,branchId,providerId,eligibility:['Approved','Rejected','Returned'].includes(h.status)?`Provider response recorded: ${h.status}`:pendingHmo(h)?'Awaiting external provider response':'Not provider-verified',branch:state.branches.find(b=>b.id===branchId)?.name||'Unknown branch',provider:HMO_PROVIDERS.find(p=>p.id===providerId)?.name||h.provider||'Unknown provider',requirements,missing:requirements.filter(r=>r?.state!=='Validated locally').map(r=>r?.label||'Unknown requirement'),submissionCycle:h.submissionCycle??(h.submittedAt?1:0),contacts:h.contacts||[],responses:h.responses||[],followUpTasks:h.followUpTasks||[],submissionHistory:h.submissionHistory||[],legacy:!h.schemaVersion||h.legacy===true}
  })
  const conversations=(state.conversations||[]).map(c=>{
    const assigned=assignee(c),patient=patients.find(p=>p.id===c.patientId)
    const participantUserIds=c.participantUserIds||[patient?.userId,assigned?.id].filter(Boolean)
    // Without an exact assignee, do not grant even partial access to a legacy thread.
    const participants=c.participantUserIds?participantUserIds:assigned?participantUserIds:[]
    const unreadUserIds=c.unreadUserIds||participants.filter(id=>id===patient?.userId?(c.unreadBy||[]).includes('patient'):(c.unreadBy||[]).includes((assigned?.roleName||assigned?.role)==='Dentist'?'dentist':'staff'))
    return {...c,branchId:c.branchId||assigned?.branchId||null,assignedUserId:c.assignedUserId||assigned?.id||null,participantUserIds:participants,unreadUserIds,readAtByUser:c.readAtByUser||{},messages:(c.messages||[]).map(m=>({...m,senderUserId:m.senderUserId||(m.sender==='patient'?patient?.userId:m.sender===((assigned?.roleName||assigned?.role)==='Dentist'?'dentist':'staff')?assigned?.id:null)||null}))}
  })
  const notifications=(state.notifications||[]).map(n=>{
    const patient=patients.find(p=>p.id===n.patientId)
    return {...n,recipientUserId:n.recipientUserId||(!n.recipientRole||n.recipientRole==='patient'?patient?.userId:null)||null,recipientPersonId:n.recipientPersonId||(!n.recipientRole||n.recipientRole==='patient'?patient?.personId:null)||null,recipientRole:n.recipientRole||'patient',title:n.title||n.type,body:n.body||n.text,readAt:n.readAt||null,legacy:n.legacy??!n.eventType}
  })
  const inquiries=(state.inquiries||[]).map(i=>{const user=assignee(i);return {...i,assignedUserId:i.assignedUserId||user?.id||null,branchId:i.branchId||user?.branchId||null}})
  return {patients,hmo,conversations,notifications,inquiries}
}

export function notificationDestination(state,session,n) {
  if(!ownsNotification(state,session,n)||!n.action)return null
  const collections={appointment:'appointments',queue:'queue',treatment:'treatments',invoice:'invoices',prescription:'prescriptions',hmo:'hmo'}
  const record=(state[collections[n.entityType]]||[]).find(r=>r.id===n.entityId)
  if(!record||record.patientId!==n.patientId)return null
  if(session.role==='patient'&&record.patientId!==session.patientId||session.role==='staff'&&record.branchId!==session.branchId||session.role==='dentist'&&record.dentistId!==session.dentistId)return null
  const pages={appointment:['appointments'],queue:['queue'],treatment:['dashboard','followups','prescriptions'],invoice:['billing'],prescription:['prescriptions'],hmo:['hmo']}
  if(!pages[n.entityType]?.includes(n.action.page))return null
  return {page:n.action.page,context:{entityId:record.id,patientId:record.patientId,branchId:record.branchId,dentistId:record.dentistId,appointmentId:n.entityType==='appointment'?record.id:record.appointmentId,queueEntryId:n.entityType==='queue'?record.id:record.queueEntryId,treatmentId:n.entityType==='treatment'?record.id:record.treatmentId,invoiceId:n.entityType==='invoice'?record.id:undefined,hmoCaseId:n.entityType==='hmo'?record.id:undefined,prescriptionId:n.entityType==='prescription'?record.id:undefined}}
}
