import { validSession } from './safeguards.js'
import { clinicNow, clinicDate, maxBookingDate, addDays } from './clock.js'
import { inScope, isActiveQueue, isTodayQueue, TERMINAL } from './contracts.js'
import { availableSlots, dateLabel, nextAppointment, peso, queueWaitEstimate } from './logic.js'
import { followupDisplayState, linkedTreatment, visibleInvoices, visiblePrescriptions } from './phase2.js'
import { LOYALTY_PROGRAM, accountsOf, ledgerIssue, needMoreMessage } from './loyalty.js'
import { HMO_PROVIDERS, notificationDestination, visibleConversations, visibleHmo, visibleNotifications } from './phase3-contracts.js'
import { assignDentist, dentistsFor, servicesAt } from './scheduling.js'

// Relocated to the scheduling domain (Phase 4B.3B); re-exported here so existing Patient-view callers are unaffected.
export { dentistsFor, servicesAt }

// Read-only Patient view models. Every selector revalidates the session, scopes to the exact Patient,
// composes the established visible*/inScope selectors, mutates nothing and creates no workflow events.

// The store projects display names onto Dentists and users; fall back to the person record so views never depend on it.
const personName=(state,personId)=>{const p=state.persons.find(x=>x.id===personId);return [p?.firstName,p?.lastName].filter(Boolean).join(' ')}
export function dentistLabel(state,dentistId) {
  const d=state.dentists.find(x=>x.id===dentistId)
  if(!d)return ''
  if(d.name&&d.name!==d.id)return d.name
  const base=personName(state,d.personId)
  return base?`Dr. ${base}`:d.id
}

const byWhen=(a,b)=>`${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`)
const nonEmpty=value=>typeof value==='string'&&value?value:null

export function patientContext(state,session) {
  if(!validSession(state,session)||session.role!=='patient')return null
  const patient=state.patients.find(p=>p.id===session.patientId&&p.userId===session.userId)
  return patient?{patientId:patient.id,userId:session.userId,patient,firstName:patient.firstName||'',name:patient.name||''}:null
}

export function greetingFor(time=clinicNow().time) {
  const hour=Number(String(time).slice(0,2))
  return hour<12?'Good morning':hour<18?'Good afternoon':'Good evening'
}

export function formatStamp(value) {
  const match=typeof value==='string'&&value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/)
  if(!match)return typeof value==='string'?value:''
  const hour=Number(match[2])
  return `${dateLabel(match[1])} · ${((hour+11)%12)+1}:${match[3]} ${hour>=12?'PM':'AM'}`
}

// ---- Appointments -------------------------------------------------------------------------------
export function patientAppointments(state,session) {
  if(!patientContext(state,session))return []
  return state.appointments.filter(a=>inScope(a,session,state)).sort(byWhen)
}
export function appointmentGroups(state,session,today=clinicDate()) {
  const all=patientAppointments(state,session)
  return {
    upcoming:all.filter(a=>!TERMINAL.includes(a.status)&&a.date>=today),
    past:all.filter(a=>['Completed','No-show'].includes(a.status)||(a.date<today&&a.status!=='Cancelled')).reverse(),
    cancelled:all.filter(a=>a.status==='Cancelled').reverse(),
  }
}
// Reschedule/Cancel are offered for Pending/Confirmed visits that have not been admitted. Cancellation adds
// two Patient-specific rules (see workflow.js's cancelAppointment, the authoritative enforcement — this
// selector only drives the UI's presentation of the same rule): a card appointment already marked paid
// can't be cancelled online at all (cancelKind 'blocked-card-paid' — the button stays visible so the Patient
// gets an explanation, never a silent disappearance); once the scheduled start has passed, online
// cancellation is unavailable regardless of payment method. Reschedule itself has no separate cutoff here
// (P2 remains otherwise unresolved) — only the cancellation timing above is this task's explicit rule.
export function appointmentActionState(appointment,now=clinicNow()) {
  const today=now.date
  if(['Confirmed','Pending'].includes(appointment.status)&&appointment.date>=today){
    const started=appointment.date<today||(appointment.date===today&&appointment.start<=now.time)
    if(appointment.paymentMethod==='card'&&appointment.paymentStatus==='paid')return {canReschedule:true,canCancel:true,cancelKind:'blocked-card-paid',reason:''}
    if(started)return {canReschedule:true,canCancel:false,cancelKind:'past-start',reason:'This appointment’s scheduled time has passed, so it can’t be cancelled online. Please contact the clinic for assistance.'}
    return {canReschedule:true,canCancel:true,cancelKind:'normal',reason:''}
  }
  if(appointment.status==='Checked In')return {canReschedule:false,canCancel:false,cancelKind:null,reason:'Your arrival has been recorded, so this visit can’t be changed online.'}
  if(appointment.status==='In Treatment')return {canReschedule:false,canCancel:false,cancelKind:null,reason:'This visit is in progress.'}
  return {canReschedule:false,canCancel:false,cancelKind:null,reason:''}
}

// ---- Care, follow-up, records ------------------------------------------------------------------
// Only the currently approved Patient-visible clinical subset: date, procedure text, performed service names, Dentist.
function careEntry(state,t) {
  return {id:t.id,date:t.date,procedure:typeof t.procedure==='string'?t.procedure:'',
    services:(Array.isArray(t.procedures)?t.procedures.filter(Boolean):[]).map(p=>state.services.find(s=>s.id===p.serviceId)?.name).filter(Boolean),
    dentist:dentistLabel(state,t.dentistId),appointmentId:t.appointmentId||null}
}
export function patientCare(state,session) {
  if(!patientContext(state,session))return []
  return state.treatments.filter(t=>t.status==='Completed'&&inScope(t,session,state)).sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(t=>careEntry(state,t))
}
export function patientFollowups(state,session) {
  if(!patientContext(state,session))return []
  return state.followups.filter(f=>inScope(f,session,state)&&linkedTreatment(state,f)).map(f=>({
    record:f,display:followupDisplayState(state,f),
    appointment:state.appointments.find(a=>a.id===f.appointmentId&&inScope(a,session,state))||null,
  }))
}
export const patientPrescriptions=(state,session)=>patientContext(state,session)?visiblePrescriptions(state,session).filter(r=>r.status==='Authorized'):[]
export const patientInvoices=(state,session)=>patientContext(state,session)?visibleInvoices(state,session):[]
export const patientHmo=(state,session)=>patientContext(state,session)?visibleHmo(state,session):[]
export const patientNotifications=(state,session)=>patientContext(state,session)?visibleNotifications(state,session):[]

export function patientVisitDetail(state,session,appointment) {
  if(!patientContext(state,session)||!appointment||!inScope(appointment,session,state))return null
  const treatment=state.treatments.find(t=>t.appointmentId===appointment.id&&t.status==='Completed'&&inScope(t,session,state))
  if(!treatment)return null
  return {...careEntry(state,treatment),links:{
    prescription:patientPrescriptions(state,session).find(r=>r.treatmentId===treatment.id)?.id||null,
    invoice:patientInvoices(state,session).find(i=>i.treatmentId===treatment.id)?.id||null,
    followup:patientFollowups(state,session).find(f=>f.record.treatmentId===treatment.id)?.record.id||null,
    hmo:patientHmo(state,session).find(h=>h.treatmentId===treatment.id||h.appointmentId===appointment.id)?.id||null,
  }}
}
export function hmoForAppointment(state,session,appointment) {
  return patientHmo(state,session).find(h=>h.appointmentId===appointment.id)||null
}

export function prescriptionView(state,r) {
  const t=linkedTreatment(state,r)
  return {id:r.id,status:r.status,dentist:dentistLabel(state,r.dentistId),authorizedAt:r.authorizedAt||null,visitDate:t?.date||null,treatmentId:r.treatmentId,
    items:(Array.isArray(r.items)?r.items.filter(Boolean):[r]).map((item,index)=>({key:item.id||index,medication:item.medication||'',dosage:item.dosage||'',instructions:item.instructions||'',duration:item.duration||''}))}
}
export function invoiceView(state,i) {
  const payment=i.payment&&typeof i.payment==='object'?i.payment:null
  return {id:i.id,invoiceNo:i.invoiceNo||'',status:i.status,date:i.visitDate,branch:state.branches.find(b=>b.id===i.branchId)?.name||'',branchId:i.branchId,appointmentId:i.appointmentId||null,treatmentId:i.treatmentId,
    items:(Array.isArray(i.items)?i.items.filter(Boolean):[]).map((item,index)=>({key:item.id||index,name:state.services.find(s=>s.id===item.serviceId)?.name||item.name||'Service',quantity:item.quantity||1,unit:item.unitFee??item.amount,amount:item.amount})),
    total:i.total,
    receipt:i.receipt?{number:i.receipt,amount:payment?.amount??i.total,status:payment?.status||i.paymentStatus,method:payment?.method||(i.method&&i.method!=='—'?i.method:''),simulated:!!payment?.simulation,paidAt:payment?.recordedAt||i.paidAt||null}:null}
}
export const money=value=>peso.format(Number(value)||0)

// ---- HMO: keep M12 (local preparation), M13 (provider outcome) and M14 (follow-up) distinct -------------
const HMO_STAGE={
  Draft:'The clinic is preparing your HMO request.',
  'Missing Requirements':'Some documents are still needed before the clinic can prepare your request.',
  'Ready for Submission':'Your documents have been checked at the clinic. The clinic has not submitted your request yet.',
  Pending:'The clinic has recorded a submission. No provider response has been recorded yet.',
  Returned:'Your HMO provider returned this request for correction. Please provide the documents marked below.',
  Escalated:'The clinic is following up with the provider. No provider decision has been recorded.',
  Approved:'Your HMO provider’s approval was recorded by the clinic.',
  Rejected:'Your HMO provider’s rejection was recorded by the clinic. Please contact the clinic about next steps.',
}
export function hmoCaseView(h) {
  const outcome=['Approved','Rejected','Returned'].includes(h.status)
  const historical=!!h.legacy&&outcome
  const requirements=(h.requirements||[]).filter(Boolean)
  const canProvide=['Draft','Missing Requirements','Ready for Submission','Returned'].includes(h.status)
  return {
    id:h.id,provider:HMO_PROVIDERS.find(p=>p.id===h.providerId)?.name||'HMO',
    label:historical?`Historical recorded ${h.status}`:outcome?`Provider ${h.status}`:h.status,
    stage:historical?'This outcome comes from an earlier record. It has not been verified as a provider response in this system.':HMO_STAGE[h.status]||`Status: ${h.status}`,
    checked:requirements.filter(r=>r.state==='Validated locally').length,total:requirements.length,
    submittedAt:h.submittedAt||null,respondedAt:h.providerRespondedAt||null,escalated:h.status==='Escalated',canProvide,
    requirements:requirements.map(r=>({id:r.id,ruleId:r.ruleId,label:r.label,state:r.state,needsAction:canProvide&&r.state==='Missing',returned:h.status==='Returned'&&r.state==='Missing'})),
  }
}

// ---- Messages (participant-scoped; separate from Notifications) --------------------------------------
// The store projects display names onto users; fall back to the person record so the view never depends on it.
function userName(state,user) {
  if(user?.name)return user.name
  const base=personName(state,user?.personId)
  return (user?.roleName||user?.role)==='Dentist'&&base?`Dr. ${base}`:base||user?.username||''
}
const readableContext=text=>{
  const value=typeof text==='string'?text.trim():''
  return !value||/^[A-Za-z]+\s+[a-z]{1,3}[-\w]*\d[\w-]*$/.test(value)?'About your care':value
}
function conversationView(state,session,c) {
  const others=(c.participantUserIds||[]).filter(id=>id!==session.userId).map(id=>state.users.find(u=>u.id===id)).filter(Boolean)
  const appointment=c.appointmentId?state.appointments.find(a=>a.id===c.appointmentId&&inScope(a,session,state)):null
  return {
    id:c.id,status:c.status,canReply:c.status==='Open',unread:(c.unreadUserIds||[]).includes(session.userId),
    title:others.length?others.map(u=>userName(state,u)).join(', '):'Clinic team',role:others.map(u=>u.roleName||u.role).filter(Boolean).join(', '),
    context:appointment?`About your ${appointment.service} visit on ${dateLabel(appointment.date)}`:readableContext(c.context),
    messages:(c.messages||[]).map(m=>({id:m.id,mine:m.senderUserId===session.userId,sender:userName(state,state.users.find(u=>u.id===m.senderUserId))||'Historical participant',text:m.text,at:m.at})),
  }
}
export function patientConversations(state,session) {
  if(!patientContext(state,session))return []
  return visibleConversations(state,session).map(c=>conversationView(state,session,c))
}

// ---- Queue: the Patient's own place and aggregate estimate only --------------------------------------
const PHASES={Waiting:'waiting',Called:'called','Treatment Ready':'ready','Temporarily Away':'away','In Treatment':'in-treatment',Completed:'completed','No-show':'no-show',Cancelled:'cancelled'}
export function patientQueueView(state,session) {
  if(!patientContext(state,session))return null
  const today=clinicDate()
  const entries=state.queue.filter(q=>inScope(q,session,state)&&isTodayQueue(q,today))
  const entry=entries.find(isActiveQueue)||[...entries].sort((a,b)=>String(b.completedAt||b.checkedIn||'').localeCompare(String(a.completedAt||a.checkedIn||'')))[0]
  if(!entry){
    const expected=appointmentGroups(state,session,today).upcoming.find(a=>a.date===today&&['Confirmed','Pending'].includes(a.status))
    return expected?{phase:'not-checked-in',appointment:{id:expected.id,service:expected.service,start:expected.start,branch:expected.branch,dentist:dentistLabel(state,expected.dentistId)}}:{phase:'none'}
  }
  const phase=PHASES[entry.status]||'waiting'
  const appointment=entry.appointmentId?state.appointments.find(a=>a.id===entry.appointmentId&&inScope(a,session,state)):null
  return {
    phase,status:entry.status,active:isActiveQueue(entry),
    position:phase==='waiting'&&entry.position?entry.position:null,
    waitMinutes:phase==='waiting'?queueWaitEstimate(entry,state.queue,state.appointments,state.treatments,state.dentists):null,
    dentist:dentistLabel(state,entry.dentistId),branch:entry.branch||'',
    service:state.services.find(s=>s.id===entry.serviceId)?.name||appointment?.service||'',
    start:appointment?.start||null,checkedIn:entry.checkedIn||null,
  }
}

export function queueSentence(q) {
  if(!q)return ''
  if(q.phase==='waiting')return q.position?`You’re #${q.position} in line${q.branch?` at ${q.branch}`:''}.`:'You’re in line.'
  return {called:'The clinic has called you.',ready:'You’re ready for treatment.',away:'Your place in line is paused.','in-treatment':'Your visit is in progress.',completed:'Your visit is complete.','no-show':'This visit was recorded as a no-show.',cancelled:'This visit was cancelled.'}[q.phase]||''
}

// ---- Journey Hub -------------------------------------------------------------------------------------
export function patientAttention(state,session) {
  const ctx=patientContext(state,session)
  if(!ctx)return []
  const items=[]
  for(const h of patientHmo(state,session)){
    const view=hmoCaseView(h),needed=view.requirements.filter(r=>r.needsAction).length
    if(needed)items.push({id:`hmo:${h.id}`,kind:'hmo',title:h.status==='Returned'?'Your HMO request was returned for correction':'HMO documents are needed',detail:`${view.provider} • ${needed} document${needed>1?'s':''} to provide`,page:'hmo',context:{hmoCaseId:h.id},action:'Review documents'})
  }
  for(const f of patientFollowups(state,session))
    if(f.display==='Open')items.push({id:`followup:${f.record.id}`,kind:'followup',title:'A follow-up visit needs scheduling',detail:f.record.reason||'Your Dentist recommended a return visit.',page:'followups',context:{entityId:f.record.id},action:'Schedule follow-up'})
  for(const i of patientInvoices(state,session))
    if(['Issued','Open'].includes(i.status))items.push({id:`invoice:${i.id}`,kind:'invoice',title:'An invoice is ready to view',detail:`${i.invoiceNo} • ${money(i.total)}`,page:'billing',context:{entityId:i.id},action:'View invoice'})
  const notifications=patientNotifications(state,session)
  for(const r of patientPrescriptions(state,session))
    if(notifications.some(n=>!n.read&&n.entityType==='prescription'&&n.entityId===r.id&&notificationDestination(state,session,n)))items.push({id:`rx:${r.id}`,kind:'prescription',title:'A new prescription is available',detail:`Authorized by ${dentistLabel(state,r.dentistId)}`,page:'prescriptions',context:{entityId:r.id},action:'View prescription'})
  for(const c of patientConversations(state,session))
    if(c.unread)items.push({id:`message:${c.id}`,kind:'message',title:'You have an unread message',detail:c.title,page:'messages',context:{conversationId:c.id},action:'Read message'})
  const unread=notifications.filter(n=>!n.read).length
  if(unread)items.push({id:'notifications',kind:'notification',title:`${unread} unread notification${unread>1?'s':''}`,detail:'Updates and reminders from the clinic.',page:null,context:null,action:'View notifications'})
  return items
}

// Phase 4B.3C-1 Home: only the subset of `patientAttention()` that is genuinely blocking/actionable before care or
// a bill can proceed (a Returned/Missing HMO requirement, an Open Dentist-requested follow-up, an issued unpaid
// invoice). An unread message, a newly authorized prescription and the unread-notification count are real events
// too, but they belong to Notifications/Messages, not a giant Home alert — this never duplicates them here.
export function patientActionRequired(state,session) {
  return patientAttention(state,session).filter(item=>['hmo','followup','invoice'].includes(item.kind))
}

export function patientHome(state,session) {
  const ctx=patientContext(state,session)
  if(!ctx)return null
  const now=clinicNow()
  const groups=appointmentGroups(state,session,now.date)
  const queue=patientQueueView(state,session)
  const live=queue&&['waiting','called','ready','away','in-treatment'].includes(queue.phase)?queue:null
  const summary=a=>({id:a.id,service:a.service,date:a.date,start:a.start,branch:a.branch,status:a.status,dentist:dentistLabel(state,a.dentistId)})
  const today=groups.upcoming.find(a=>a.date===now.date)
  const next=nextAppointment(ctx.patientId,groups.upcoming)
  const conversations=patientConversations(state,session)
  // A healthy, meaningful, issue-free draft only — never fabricated, never shown when the draft is stale
  // (draftStatus already revalidates branch/service/slot against current canonical state).
  const rawDraft=patientBookingDraft(state,session)
  const draft=rawDraft?draftStatus(state,session,rawDraft):null
  const resume=draft&&draft.hasProgress&&!draft.issues.length?{mode:draft.mode,branch:draft.branch?.name||null,service:draft.service?.name||null}:null
  return {
    greeting:greetingFor(now.time),firstName:ctx.firstName,
    hero:live?{kind:'queue',queue:live}:today?{kind:'today',appointment:summary(today)}:next?{kind:'next',appointment:summary(next)}:{kind:'none'},
    attention:patientAttention(state,session),
    care:patientCare(state,session).slice(0,3).map(c=>({...c,hasVisit:patientAppointments(state,session).some(a=>a.id===c.appointmentId)})),
    hasConversation:conversations.length>0,unreadMessages:conversations.filter(c=>c.unread).length,
    hasLoyalty:!!accountsOf(state,ctx.patientId)?.length,
    resume,
  }
}

// First-use vs returning: derived from real canonical history, never a stored onboarding flag. A cancelled-only
// appointment still counts as history (the Patient has been through the flow before), so it stays "returning".
export function patientHomeMode(state,session) {
  if(!patientContext(state,session))return null
  const hasHistory=patientAppointments(state,session).length>0||patientCare(state,session).length>0||patientPrescriptions(state,session).length>0||
    patientInvoices(state,session).length>0||patientFollowups(state,session).length>0||patientHmo(state,session).length>0
  return hasHistory?'returning':'first-use'
}

// Only a canonical field the Patient record already has a legitimate home for is ever flagged; nothing invents
// a requirement the model doesn't support. Currently: a missing contact number (Person.phone is legitimately
// nullable in the ERD, and a self-registered account still requires it, so a gap here means a pre-existing record).
export function patientProfileGaps(state,session) {
  const ctx=patientContext(state,session)
  if(!ctx)return []
  return ctx.patient.phone?[]:[{field:'phone',message:'Add a contact number so the clinic can reach you about your visit.'}]
}

// M24 Referral & Loyalty. The balance shown is the ledger-validated one; a ledger the app cannot trust is reported as
// "review" and never exposes a usable balance or a redemption control. No referral relationship or reward benefit is modeled.
const LOYALTY_LABELS={'Qualified Visit':'Qualified visit','Qualified Referral':'Qualified referral','Referral Reward':'Referral reward','Redemption Request':'Reward request',Redemption:'Reward redeemed'}
const pointsLabel=points=>points>0?`+${points} ${points===1?'point':'points'}`:points<0?`−${Math.abs(points)} ${Math.abs(points)===1?'point':'points'}`:''
const loyaltyEntry=(entry,index)=>({key:nonEmpty(entry.id)||`legacy-${index}`,label:LOYALTY_LABELS[entry.type]||'Loyalty activity',detail:nonEmpty(entry.detail),pointsLabel:pointsLabel(Number.isSafeInteger(entry.points)?entry.points:0),date:typeof entry.at==='string'?entry.at:'',status:nonEmpty(entry.status)})
export function patientLoyalty(state,session) {
  const ctx=patientContext(state,session)
  if(!ctx)return null
  const {redemptionThreshold:threshold}=LOYALTY_PROGRAM, rows=accountsOf(state,ctx.patientId)
  if(rows&&!rows.length)return {status:'none',threshold}
  const account=rows?.length===1?rows[0]:null
  const history=account&&Array.isArray(account.history)&&account.history.every(e=>e&&typeof e==='object'&&!Array.isArray(e))?account.history.map(loyaltyEntry):[]
  const code=account&&nonEmpty(account.referralCode)
  if(!account||ledgerIssue(account))return {status:'review',threshold,code,history}
  const pending=account.history.find(e=>e.type==='Redemption Request'&&e.status==='Pending')||null
  const missing=Math.max(0,threshold-account.points)
  return {status:'ready',threshold,code,points:account.points,history,pending:!!pending,pendingSince:pending?nonEmpty(pending.requestedAt)||nonEmpty(pending.at):null,canRequest:!pending&&!missing,missing,
    reason:pending?'Your reward request is awaiting clinic processing.':missing?needMoreMessage(missing):''}
}

// Notification and deep-link contexts only ever focus a record the Patient can actually see.
export function resolveTarget(state,session,page,context) {
  if(!patientContext(state,session)||!context||typeof context!=='object')return null
  if(page==='appointments'){const id=nonEmpty(context.appointmentId)||nonEmpty(context.entityId);return patientAppointments(state,session).some(a=>a.id===id)?id:null}
  if(page==='prescriptions'){
    const list=patientPrescriptions(state,session),id=nonEmpty(context.prescriptionId)||nonEmpty(context.entityId)
    return (list.find(r=>r.id===id)||list.find(r=>nonEmpty(context.treatmentId)&&r.treatmentId===context.treatmentId))?.id||null
  }
  if(page==='billing'){const id=nonEmpty(context.invoiceId)||nonEmpty(context.entityId);return patientInvoices(state,session).some(i=>i.id===id)?id:null}
  if(page==='followups'){
    const list=patientFollowups(state,session),id=nonEmpty(context.entityId)||nonEmpty(context.followupId)
    return (list.find(f=>f.record.id===id)||list.find(f=>f.record.treatmentId===(nonEmpty(context.treatmentId)||id)))?.record.id||null
  }
  if(page==='hmo'){const id=nonEmpty(context.hmoCaseId);return patientHmo(state,session).some(h=>h.id===id)?id:null}
  if(page==='messages'){const id=nonEmpty(context.conversationId);return visibleConversations(state,session).some(c=>c.id===id)?id:null}
  return null
}

// ---- Scheduling helpers (same authoritative validator as the shared booking command) -----------------
export function scheduleFormDefaults(state,session,{appointment=null,followup=null}={}) {
  const ctx=patientContext(state,session)
  const source=appointment||followup
  if(!ctx)return null
  const open=state.branches.filter(b=>b.status==='Open')
  const branchId=source?.branchId||(open.some(b=>b.id===ctx.patient.preferredBranchId)?ctx.patient.preferredBranchId:open[0]?.id)||''
  const followService=followup?state.services.find(s=>s.name==='Follow-Up'):null
  const serviceId=appointment?.serviceId||followService?.id||''
  const service=state.services.find(s=>s.id===serviceId)
  const dentists=serviceId?dentistsFor(state,branchId,serviceId):[]
  const dentistId=source?.dentistId||dentists[0]?.id||''
  const today=clinicDate()
  return {patientId:ctx.patientId,branchId,serviceId,dentistId,duration:service?.duration||0,
    date:appointment?.date||(followup?.recommendedDate&&followup.recommendedDate>today?followup.recommendedDate:today),
    start:appointment?.start||'',notes:appointment?.notes||followup?.reason||'',source:appointment?.source||(followup?'Follow-Up Task':'Portal')}
}
export function nextScheduleForm(state,form,key,value,lock={}) {
  const next={...form,[key]:value}
  if(key==='branchId'){
    const services=servicesAt(state,value)
    if(!services.some(s=>s.id===next.serviceId)){next.serviceId='';next.duration=0}
  }
  if(key==='serviceId')next.duration=state.services.find(s=>s.id===value)?.duration||0
  if(key==='branchId'||key==='serviceId'){
    const dentists=next.serviceId?dentistsFor(state,next.branchId,next.serviceId):[]
    if(!dentists.some(d=>d.id===next.dentistId))next.dentistId=dentists[0]?.id||''
  }
  if(lock.branchId)next.branchId=lock.branchId
  if(lock.serviceId)next.serviceId=lock.serviceId
  if(lock.dentistId)next.dentistId=lock.dentistId
  return next
}
export const scheduleSlots=(state,form,ignoreId=null)=>form.dentistId&&form.serviceId?availableSlots(form,state,ignoreId):[]
// Chronological, not ranked: every entry passed the same validator for the chosen date.
export function suggestTimes(state,form,ignoreId=null,limit=4,onlyDentistId=null) {
  if(!form.serviceId)return []
  return dentistsFor(state,form.branchId,form.serviceId).filter(d=>!onlyDentistId||d.id===onlyDentistId)
    .flatMap(d=>availableSlots({...form,dentistId:d.id},state,ignoreId).map(start=>({dentistId:d.id,dentist:d.name,start})))
    .sort((a,b)=>a.start.localeCompare(b.start)||a.dentist.localeCompare(b.dentist)).slice(0,limit)
}

// ---- Booking Drafts (Phase 4B.3C-1: BOOKING DRAFT != APPOINTMENT) --------------------------------------
// The session Patient's own draft only — never a browser-supplied patientId. `state.bookingDrafts` is
// session-Patient-scoped identically to every other Patient selector here (fail closed, no cross-Patient read).
export function patientBookingDraft(state,session) {
  if(!patientContext(state,session))return null
  return (state.bookingDrafts||[]).find(d=>d.patientId===session.patientId)||null
}

// Revalidates a resumed draft's branch/service/slot against CURRENT canonical state — never trusts the saved
// values as still true. `issues` explains in plain language what changed; the caller must show this and let the
// Patient choose again rather than silently replacing a stale branch, service, date or time.
export function draftStatus(state,session,draft) {
  if(!patientContext(state,session)||!draft||draft.patientId!==session.patientId)return null
  const branch=draft.branchId?state.branches.find(b=>b.id===draft.branchId&&b.status==='Open')||null:null
  const service=branch&&draft.serviceId?servicesAt(state,branch.id).find(s=>s.id===draft.serviceId)||null:null
  const issues=[]
  if(draft.branchId&&!branch)issues.push('The branch you chose is no longer open. Choose another branch.')
  if(draft.branchId&&branch&&draft.serviceId&&!service)issues.push('That service is no longer offered at this branch. Choose another service.')
  let slotValid=null
  if(branch&&service&&draft.date&&draft.start){
    // Threading the same 2-month horizon the shared saveAppointment command enforces means a stale,
    // now-out-of-range draft date fails through the exact same path as an unavailable slot — no parallel
    // horizon check needed here. `now` is captured once and reused for both the real validity check and
    // the reason-specific message below — the authoritative clinic date, never a fresh browser-local one.
    const now=clinicNow()
    slotValid=assignDentist(state,{branchId:branch.id,serviceId:service.id,date:draft.date,start:draft.start,patientId:session.patientId},now,null,maxBookingDate()).ok
    if(!slotValid){
      if(draft.date<now.date)issues.push('Your saved date has passed. Choose another date.')
      else if(draft.date>maxBookingDate())issues.push('Your saved date is beyond the two-month booking window. Choose another date.')
      else issues.push('Your saved time is no longer available. Choose another time.')
    }
  }
  return {branch,service,date:draft.date||null,start:draft.start||null,mode:draft.mode||null,slotValid,issues,hasProgress:!!(draft.branchId||draft.serviceId||draft.date||draft.start)}
}

// ---- Smart Find availability explorer helpers (Pass 2) — pure, render nothing, touch no state ----------

// "Today"/"Tomorrow"/weekday+day-number, always from the two date strings supplied by the caller (the
// authoritative clinic date and the date being labeled) — never a freshly-constructed, browser-local `new
// Date()` used to determine "now."
export function relativeDateLabel(date, today) {
  if(date===today)return 'Today'
  if(date===addDays(today,1))return 'Tomorrow'
  const asDate=new Date(`${date}T00:00:00`)
  return `${asDate.toLocaleDateString('en-PH',{weekday:'short'})} ${asDate.getDate()}`
}

// One entry per day across the exhaustive Smart Find search window, `hasOpenings` a proven fact (not a
// guess) once `results` came from an uncapped/exhaustive findOpenTimes call — every day in the window was
// genuinely searched, so there is no third "not checked" state to represent.
export function buildDateStrip(results, startDate, windowDays) {
  const opened=new Set((results||[]).map(r=>r.date))
  return Array.from({length:windowDays},(_,offset)=>{
    const date=addDays(startDate,offset)
    const dayLabel=relativeDateLabel(date,startDate)
    const dayNumber=Number(date.slice(-2))
    return {date, label:dayLabel, dayLabel, dayNumber, fullLabel:dateLabel(date), hasOpenings:opened.has(date)}
  })
}

// Buckets real findOpenTimes results by time of day; Evening is only ever non-empty when a real slot
// falls there — the caller decides whether to render an Evening heading at all based on that.
export function groupSlotsByPeriod(results) {
  const groups={morning:[],afternoon:[],evening:[]}
  for(const result of results||[]){
    const hour=Number(result.start.slice(0,2))
    if(hour<12)groups.morning.push(result)
    else if(hour<17)groups.afternoon.push(result)
    else groups.evening.push(result)
  }
  return groups
}

// What (if anything) to tell the Patient when they navigate away from an in-progress booking. `null` means
// say nothing (booking confirmed, still on the mode-choice screen, or no meaningful progress at all).
// Navigation itself is never blocked here — a device-persistence failure doesn't destroy the in-memory
// draft during ordinary in-app navigation (see workflow.js/store.jsx), so this only ever reports the truth
// honestly, it never intercepts.
export function bookingExitOutcome(stage, hasProgress, confirmed, persistenceError) {
  if(confirmed||stage==='mode'||!hasProgress)return null
  return persistenceError
    ? {tone:'warning',message:'Your booking progress couldn’t be saved to this device. It may be lost if you reload or close the app.'}
    : {tone:'default',message:'Booking saved. Resume anytime.'}
}
