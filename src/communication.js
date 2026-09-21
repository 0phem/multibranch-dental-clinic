import { isRecord } from './safeguards.js'
import { appendNotification } from './orchestration.js'
import { uid } from './logic.js'
import { canReadConversation, ownsNotification, activeUser, clinicTimestamp } from './phase3-contracts.js'

const fail=message=>({ok:false,message})
const clean=value=>typeof value==='string'?value.trim():''
export function communicationActions(run) {
  const markNotificationRead=run(({state,session,now},id)=>{
    const n=state.notifications.find(n=>n.id===id)
    if(!n||!ownsNotification(state,session,n))return fail('Notification is outside your scope.')
    if(n.read)return {ok:true,unchanged:true,record:n}
    const record={...n,read:true,readAt:now.timestamp}
    state.notifications=state.notifications.map(x=>x.id===id?record:x)
    return {ok:true,record}
  })
  const markAllNotificationsRead=run(({state,session,now})=>{
    if(!state.notifications.some(n=>ownsNotification(state,session,n)&&!n.read))return {ok:true,unchanged:true}
    state.notifications=state.notifications.map(n=>ownsNotification(state,session,n)&&!n.read?{...n,read:true,readAt:now.timestamp}:n)
    return {ok:true}
  })
  const markConversationRead=run(({state,session,now},id)=>{
    const c=state.conversations.find(c=>c.id===id)
    if(!canReadConversation(state,session,c))return fail('Conversation is outside your participant scope.')
    if(!c.unreadUserIds.includes(session.userId))return {ok:true,unchanged:true,record:c}
    const record={...c,unreadUserIds:c.unreadUserIds.filter(id=>id!==session.userId),readAtByUser:{...c.readAtByUser,[session.userId]:now.timestamp}}
    state.conversations=state.conversations.map(x=>x.id===id?record:x)
    return {ok:true,record}
  })
  const replyToConversation=run(({state,session,now,event},id,text,commandId)=>{
    const c=state.conversations.find(c=>c.id===id)
    if(!canReadConversation(state,session,c))return fail('Conversation is outside your participant scope.')
    if(!commandId||!clean(text))return fail('Enter a message and a reply command ID.')
    const previous=c.messages.find(m=>m.commandId===commandId)
    if(previous)return previous.senderUserId===session.userId?{ok:true,unchanged:true,record:c}:fail('Reply command belongs to another participant.')
    if(state.conversations.some(other=>other.id!==id&&Array.isArray(other.messages)&&other.messages.some(m=>m?.commandId===commandId)))return fail('Reply command belongs to another conversation.')
    if(c.status!=='Open')return fail('This conversation is closed.')
    const message={id:uid('cm'),commandId,senderUserId:session.userId,text:clean(text),at:now.timestamp}
    const record={...c,messages:[...c.messages,message],unreadUserIds:[...new Set([...c.unreadUserIds,...c.participantUserIds.filter(id=>id!==session.userId)])].filter(id=>id!==session.userId),readAtByUser:{...c.readAtByUser,[session.userId]:now.timestamp}}
    state.conversations=state.conversations.map(x=>x.id===id?record:x)
    event(`message:${commandId}`,'M17','conversation.reply.recorded','Reply recorded in clinic conversation',c.patientId,c.branchId,{entityType:'conversation',entityId:id,conversationId:id})
    return {ok:true,record}
  },{name:'conversation.reply',module:'M17'})
  const closeConversation=run(({state,session,event},id)=>{
    const c=state.conversations.find(c=>c.id===id)
    if(!['staff','dentist'].includes(session.role)||!canReadConversation(state,session,c))return fail('Only assigned clinic participants can close this conversation.')
    if(c.status==='Closed')return {ok:true,unchanged:true,record:c}
    const record={...c,status:'Closed'}
    state.conversations=state.conversations.map(x=>x.id===id?record:x)
    event(`conversation:close:${id}`,'M17','conversation.closed','Conversation closed',c.patientId,c.branchId,{entityType:'conversation',entityId:id})
    return {ok:true,record}
  })
  const canInquiry=(state,session,i)=>session.role==='staff'&&i?.assignedUserId===session.userId&&i.branchId===session.branchId&&state.users.some(u=>u.id===session.userId&&(u.permissions?.includes('inquiries')||(u.roleName||u.role)==='Receptionist'&&u.permissions?.includes('messages')))
  const createInquiry=run(({state,session,now,event},form={},commandId)=>{
    if(!isRecord(form))return fail('Enter valid inquiry details.')
    if(!canInquiry(state,session,{assignedUserId:session.userId,branchId:session.branchId})||!clean(form.name)||!clean(form.topic)||!commandId)return fail('Assigned Staff, contact name, inquiry topic and command ID are required.')
    const old=state.inquiries.find(i=>i.commandId===commandId)
    if(old)return canInquiry(state,session,old)?{ok:true,unchanged:true,record:old}:fail('Inquiry is outside your scope.')
    const record={id:uid('inq'),commandId,name:clean(form.name),contact:clean(form.contact),topic:clean(form.topic),source:clean(form.source),assignedUserId:session.userId,branchId:session.branchId,status:'Open',receivedAt:now.timestamp}
    state.inquiries=[record,...state.inquiries]
    event(`inquiry:${record.id}`,'M16','inquiry.created','Inquiry recorded',null,record.branchId,{entityType:'inquiry',entityId:record.id})
    return {ok:true,record}
  })
  const updateInquiry=run(({state,session,now,event},id,status)=>{
    const i=state.inquiries.find(i=>i.id===id)
    if(!canInquiry(state,session,i)||!['Responded','Closed'].includes(status))return fail('Inquiry action is outside your scope.')
    if(i.status===status)return {ok:true,unchanged:true,record:i}
    if(['Closed','Converted'].includes(i.status))return fail('Inquiry is already closed or converted.')
    const record={...i,status,...(status==='Responded'?{respondedAt:now.timestamp}:{closedAt:now.timestamp})}
    state.inquiries=state.inquiries.map(x=>x.id===id?record:x)
    event(`inquiry:${id}:${status}`,'M16',`inquiry.${status.toLowerCase()}`,'Staff recorded inquiry status',i.patientId,i.branchId,{entityType:'inquiry',entityId:id})
    return {ok:true,record}
  })
  const convertInquiry=run(({state,session,now,event},id,appointmentId)=>{
    const i=state.inquiries.find(i=>i.id===id),a=state.appointments.find(a=>a.id===appointmentId)
    if(!canInquiry(state,session,i)||!a||a.branchId!==session.branchId||a.status==='Cancelled'||i.patientId&&i.patientId!==a.patientId)return fail('Inquiry and appointment context do not match your scope.')
    if(i.bookedAppointmentId)return i.bookedAppointmentId===appointmentId?{ok:true,unchanged:true,record:i}:fail('Inquiry is already linked to another appointment.')
    if(!['Open','Responded'].includes(i.status))return fail('Only an open or responded inquiry can be converted.')
    const patient=state.patients.find(p=>p.id===a.patientId)
    if(!patient)return fail('Appointment patient is missing.')
    let conversation=state.conversations.find(c=>c.id===i.conversationId||c.inquiryId===id)
    if(conversation&&(conversation.patientId!==a.patientId||!canReadConversation(state,session,conversation)))return fail('Linked conversation does not match this conversion.')
    if(!conversation){
      const patientUser=state.users.find(u=>u.id===patient.userId)
      conversation={id:uid('c'),patientId:a.patientId,branchId:a.branchId,appointmentId:a.id,inquiryId:id,assignedUserId:session.userId,participantUserIds:[session.userId,...(activeUser(patientUser)?[patientUser.id]:[])],context:'Appointment inquiry',status:'Open',messages:[],unreadUserIds:[],readAtByUser:{},createdAt:now.timestamp}
      state.conversations=[conversation,...state.conversations]
    }else state.conversations=state.conversations.map(c=>c.id===conversation.id?{...c,appointmentId:a.id,inquiryId:id}:c)
    const record={...i,patientId:a.patientId,bookedAppointmentId:a.id,conversationId:conversation.id,status:'Converted',convertedAt:now.timestamp}
    state.inquiries=state.inquiries.map(x=>x.id===id?record:x)
    event(`inquiry:converted:${id}`,'M16→M17→M6','inquiry.converted','Inquiry linked to appointment and conversation',a.patientId,a.branchId,{entityType:'inquiry',entityId:id,appointmentId:a.id,conversationId:conversation.id})
    return {ok:true,record}
  },{name:'inquiry.convert',module:'M16'})
  const evaluateOperationalReminders=run(ctx=>{
    const {state,session,now,event}=ctx
    const user=state.users.find(u=>u.id===session.userId)
    if(session.role!=='staff'||!user?.permissions?.includes('appointments'))return {ok:true,unchanged:true}
    let changed=false
    for(const a of state.appointments){
      const start=clinicTimestamp(`${a.date}T${a.start}`)
      const hours=start?(Date.parse(start)-Date.parse(now.timestamp))/3600000:-1
      const key=`reminder:appointment:${a.id}:${a.revision||0}`
      if(a.branchId!==session.branchId||a.status!=='Confirmed'||hours<=0||hours>24||state.workflowLog.some(e=>e.commandKey===key))continue
      const context={entityType:'appointment',entityId:a.id,appointmentId:a.id,patientId:a.patientId,branchId:a.branchId,eventKey:key,eventType:'appointment.reminder',action:{page:'appointments',context:{appointmentId:a.id}}}
      event(key,'M18','appointment.reminder','Foreground appointment reminder prepared',a.patientId,a.branchId,context)
      appendNotification(state,now,key,{patientId:a.patientId},'Upcoming appointment','You have an appointment within the next 24 hours. Review your visit details.',context);changed=true
    }
    for(const q of state.queue){
      const start=clinicTimestamp(q.arrivedAt||`${q.clinicDate}T${q.checkedIn}`),key=`reminder:delay:${q.id}`
      if(q.branchId!==session.branchId||q.clinicDate!==now.date||!['Waiting','Called','Treatment Ready'].includes(q.status)||!start||Date.parse(now.timestamp)-Date.parse(start)<35*60000||state.workflowLog.some(e=>e.commandKey===key))continue
      const context={entityType:'queue',entityId:q.id,queueEntryId:q.id,patientId:q.patientId,branchId:q.branchId,eventKey:key,eventType:'queue.delay',action:{page:'queue',context:{queueEntryId:q.id}}}
      event(key,'M18','queue.delay','Foreground waiting-time update prepared',q.patientId,q.branchId,context)
      appendNotification(state,now,key,{patientId:q.patientId},'Queue waiting update','Your visit is still in the queue. Please check with the front desk for assistance.',context);changed=true
    }
    return {ok:true,...(!changed?{unchanged:true}:{})}
  })
  return {evaluateOperationalReminders,markNotificationRead,markAllNotificationsRead,markConversationRead,replyToConversation,closeConversation,createInquiry,updateInquiry,convertInquiry}
}
