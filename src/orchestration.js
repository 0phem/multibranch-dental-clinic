import { uid } from './logic.js'
import { activeUser } from './phase3-contracts.js'

// Context adapters for the established Phase 1/2 command keys. New commands pass
// explicit context. No event is inferred from a component render.
export function workflowContext(state,key) {
  const [kind,part,tail]=key.split(':')
  let entityType,record,page
  if(['appointment','cancel'].includes(kind)){entityType='appointment';record=state.appointments.find(a=>a.id===part);page='appointments'}
  if(['arrival','queue'].includes(kind)){entityType='queue';record=state.queue.find(q=>q.id===part);page='queue'}
  if(['treatment','rx','followup'].includes(kind)){entityType='treatment';record=state.treatments.find(t=>t.id===part);page=kind==='rx'?'prescriptions':kind==='followup'?'followups':'dashboard'}
  if(['issued','paid'].includes(kind)||kind==='invoice'){
    entityType='invoice';page='billing';record=state.invoices.find(i=>kind==='invoice'&&!tail?i.treatmentId===part:i.id===(tail||part))
  }
  if(['prescription','rx-authorized'].includes(kind)){entityType='prescription';page='prescriptions';record=state.prescriptions.find(r=>r.id===part)}
  if(kind==='patient'){entityType='patient';page='patients';record=state.patients.find(p=>p.id===part)}
  const context=record?{followupId:record.followupId,patientId:entityType==='patient'?record.id:record.patientId,branchId:record.branchId,dentistId:record.dentistId,treatmentId:entityType==='treatment'?record.id:record.treatmentId,appointmentId:entityType==='appointment'?record.id:record.appointmentId,queueEntryId:entityType==='queue'?record.id:record.queueEntryId,invoiceId:entityType==='invoice'?record.id:record.invoiceId,prescriptionId:entityType==='prescription'?record.id:undefined}:{}
  return {entityType:entityType||'workflow',entityId:record?.id||null,...context,action:page?{page,context:{...context,entityId:record?.id}}:null}
}
export function notificationEventKey(state,key) {
  const [kind,id]=key.split(':')
  if(kind==='issued')return `invoice:issue:${id}`
  if(kind==='paid')return `invoice:payment:${id}`
  if(kind==='rx-authorized')return `prescription:${id}:${state.prescriptions.find(r=>r.id===id)?.revision}`
  if(kind==='treatment')return `${key}:${state.treatments.find(t=>t.id===id)?.revision}`
  return key
}
export function appendNotification(state,now,key,recipient,title,body,context={}) {
  const patient=state.patients.find(p=>p.id===recipient.patientId)
  const userId=recipient.userId||patient?.userId||null
  const user=state.users.find(u=>u.id===userId)
  if(userId&&!activeUser(user))return
  const commandKey=`${key}:recipient:${userId||patient?.id}`
  if(state.notifications.some(n=>n.commandKey===commandKey))return
  state.notifications=[{id:uid('n'),commandKey,eventId:`event:${context.eventKey||key}`,eventType:context.eventType||title,recipientUserId:userId,recipientPersonId:user?.personId||patient?.personId||null,recipientRole:recipient.role||'patient',patientId:recipient.patientId||context.patientId||null,branchId:context.branchId||user?.branchId||null,dentistId:recipient.dentistId||context.dentistId||null,entityType:context.entityType||null,entityId:context.entityId||null,action:context.action||null,type:title,title,text:body,body,channel:'In-App',status:'Delivered',createdAt:now.timestamp,read:false,readAt:null},...state.notifications]
}
export function notifyBranch(state,now,key,branchId,permission,title,body,context) {
  for(const user of state.users.filter(u=>activeUser(u)&&u.branchId===branchId&&u.permissions?.includes(permission)&&(u.roleName||u.role)!=='Dentist'))appendNotification(state,now,key,{userId:user.id,role:'staff'},title,body,{...context,branchId})
}
export function appendWorkflowEvent(state,session,now,key,module,type,result,context={},status='Success') {
  if(state.workflowLog.some(e=>e.commandKey===key))return
  const id=`event:${key}`
  state.workflowLog=[{id,commandKey:key,at:now.label,createdAt:now.timestamp,module,event:type,eventType:type,result,status,actorUserId:session.userId,...context},...state.workflowLog]
  state.audit=[{id:uid('aud'),eventId:id,at:now.label,actor:session.name,actorUserId:session.userId,action:result,module},...state.audit].slice(0,150)
}
export function automationSnapshot(state) {
  const events=state.workflowLog||[]
  return {events,failed:events.filter(e=>e.status==='Failed'),warnings:events.filter(e=>e.status==='Warning'),success:events.filter(e=>e.status==='Success').length,rules:state.automations||[]}
}
