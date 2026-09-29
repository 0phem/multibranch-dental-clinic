import { administrationActions } from './administration.js'
import { validSession, permitted, isRecord, completedEncounter } from './safeguards.js'
import { communicationActions } from './communication.js'
import { hmoActions, prepareHmoCase } from './hmo.js'
import { loyaltyActions } from './loyalty.js'
import { workflowContext, notificationEventKey, appendWorkflowEvent, appendNotification, notifyBranch } from './orchestration.js'
import { phase2Actions, treatmentInvoiceItems, linkedTreatment, money } from './phase2.js'
import { clinicNow, validDate } from './clock.js'
import { inScope } from './contracts.js'
import { uid } from './logic.js'
import { bookingDraftActions } from './booking-drafts.js'

const fail=message=>({ok:false,message})
const replace=(rows,record)=>rows.some(x=>x.id===record.id)?rows.map(x=>x.id===record.id?record:x):[...rows,record]
const clean=value=>String(value||'').trim().replace(/\s+/g,' ')
export const patientProjection=(patient,person)=>({...person,...patient,id:patient.id,personId:person.id,name:[person.firstName,person.lastName].filter(Boolean).join(' ')})

// Critical frontend commands read the latest synchronous store snapshot. Their
// patches are committed together by ClinicProvider, outside React state updaters.
export function createWorkflowActions({getState,commit,getSession,clock=clinicNow}) {
  const run=(command,metadata={})=>(...args)=>{
    const before=getState(), state={...before}, session=getSession(), now=clock()
    const user=before.users.find(u=>u.id===session?.userId)
    if(!validSession(before,session,now))return fail('An active clinic session is required.')
    const event=(key,domain,type,result,patientId,branchId,extra={},status='Success')=>{
      const context={...workflowContext(state,key),patientId,branchId,...extra}
      appendWorkflowEvent(state,session,now,key,domain,type,result,context,status)
      if(type==='clinical.prescription.required'){
        const dentist=state.dentists.find(d=>d.id===context.dentistId)
        if(dentist)appendNotification(state,now,key,{userId:dentist.userId,role:'dentist',dentistId:dentist.id},'Prescription task','A requested prescription awaits your authorization.',{...context,eventType:type,eventKey:key})
      }
      if(type==='billing.draft.prepared')notifyBranch(state,now,key,branchId,'billing','Invoice review needed','A completed visit has a draft invoice to review.',{...context,eventType:type,eventKey:key})
    }
    const notify=(key,patientId,type,text)=>{
      const context=workflowContext(state,key)
      const types={'Appointment Confirmation':'appointment.created','Appointment Rescheduled':'appointment.rescheduled','Appointment Cancellation':'appointment.cancelled','Check-In Confirmation':'patient.checked_in','Queue Update':'queue.status.changed','Visit Complete':'clinical.treatment.completed','Follow-Up Required':'clinical.followup.required','Bill Available':'billing.issue','Receipt Available':'billing.payment','Prescription Available':'prescription.authorized'}
      const followup=context.followupId&&['Appointment Confirmation','Appointment Rescheduled','Appointment Cancellation'].includes(type)
      const eventType=followup?(type==='Appointment Confirmation'?'followup.scheduled':type==='Appointment Rescheduled'?'followup.rescheduled':'followup.cancelled'):types[type]||type
      appendNotification(state,now,key,{patientId},followup?type.replace('Appointment','Follow-Up'):type,text,{...context,eventKey:notificationEventKey(state,key),eventType})
    }
    if(args.some(value=>value===null))return fail('Required action details are missing. Reopen the record and try again.')
    const ctx={state,session,now,event,notify}
    const result=command(ctx,...args)
    if(!result.ok&&metadata.name){
      const entityId=typeof args[0]==='string'?args[0]:args[0]?.treatmentId||args[0]?.appointmentId||null
      const key=`failed:${metadata.name}:${session.userId}:${entityId||'new'}:${result.message}`
      // Failed commands discard their business patch. Only the attempted failure
      // is recorded; existing Phase 1/2 failure return contracts remain intact.
      const failureState={...before}
      appendWorkflowEvent(failureState,session,now,key,metadata.domain,metadata.name,result.message,{entityType:typeof args[0]==='object'?(args[0]?.treatmentId?'treatment':args[0]?.appointmentId?'appointment':'workflow'):metadata.name.startsWith('hmo')?'hmo':metadata.name.startsWith('conversation')?'conversation':metadata.name.startsWith('inquiry')?'inquiry':'workflow',entityId},'Failed')
      if(failureState.workflowLog!==before.workflowLog)commit({workflowLog:failureState.workflowLog,audit:failureState.audit})
      return result
    }
    if(result.ok&&!result.unchanged){
      const patch=Object.fromEntries(Object.entries(state).filter(([key,value])=>value!==before[key]))
      commit(patch)
    }
    return result
  }
  const canOperate=(state,session,record)=>['staff','owner'].includes(session.role)&&inScope(record,session,state)
  const closeFollowup=(state,appointmentId,status)=>{
    const appointment=state.appointments.find(a=>a.id===appointmentId)
    const matches=f=>f.appointmentId===appointmentId&&appointment&&f.patientId===appointment.patientId&&(!f.branchId||f.branchId===appointment.branchId)&&(!f.dentistId||f.dentistId===appointment.dentistId)
    // Only reassign when something changes, so an idempotent reconciliation commits nothing.
    if(state.followups.some(f=>matches(f)&&(f.status!==status||f.appointmentId!==(status==='Open'?null:appointmentId))))state.followups=state.followups.map(f=>matches(f)?{...f,status,appointmentId:status==='Open'?null:appointmentId}:f)
  }

  // ---- M6/M8/M9 cutover adapters (TEMPORARY) --------------------------------------------------------------------
  // Appointments, Visits and the queue are server-authoritative (Laravel/PostgreSQL). These commands never create or edit
  // an appointment, a Visit or a queue entry: each runs only AFTER the matching server command succeeded and the server
  // projection was refreshed, and it updates the still-browser-local downstream records (follow-up, in-app notifications)
  // to match. Remove each one when its owning module (M20/M18) becomes backend-authoritative.
  const serverAppointment=(state,id)=>state.appointments.find(a=>a.id===id&&a.server)

  // In-app notification/workflow event for a server-confirmed booking change (M18 prototype projection only).
  const recordAppointmentEvent=run(({state,session,event,notify},id,kind)=>{
    const appointment=serverAppointment(state,id)
    if(!appointment||!inScope(appointment,session,state))return fail('Appointment is outside your scope.')
    if(!['created','rescheduled'].includes(kind))return fail('Unknown appointment event.')
    const branch=state.branches.find(b=>b.id===appointment.branchId)
    const key=`appointment:${appointment.id}:${appointment.revision}`
    event(key,'appointment',`appointment.${kind}`,`${appointment.appointmentNo} • ${branch?.name||''}`,appointment.patientId,appointment.branchId)
    notify(key,appointment.patientId,kind==='created'?'Appointment Confirmation':'Appointment Rescheduled',`Your ${appointment.service} visit is confirmed for ${appointment.date} at ${appointment.start} in ${branch?.name||'the clinic'}.`)
    // A confirmed new Patient booking supersedes that Patient's in-progress Booking Draft.
    if(kind==='created'&&session.role==='patient')state.bookingDrafts=(state.bookingDrafts||[]).filter(d=>d.patientId!==session.patientId)
    return {ok:true,record:appointment}
  })

  // After the server cancelled an appointment: reopen a linked follow-up and notify. A cancellable appointment has not
  // been checked in (the server refuses cancellation once a Visit exists), so it never has a live queue entry.
  const applyAppointmentCancellation=run(({state,session,event,notify},id)=>{
    const appointment=serverAppointment(state,id)
    if(!appointment||!inScope(appointment,session,state))return fail('Appointment is outside your scope.')
    if(appointment.status!=='Cancelled')return fail('The appointment has not been cancelled on the server.')
    if(state.queue.some(q=>q.appointmentId===id))return fail('This appointment has a queue record that needs clinic review.')
    // Notify while the follow-up still points at this appointment, so a follow-up cancellation is reported as such.
    event(`cancel:${id}`,'appointment','appointment.cancelled',`Cancelled ${appointment.appointmentNo}`,appointment.patientId,appointment.branchId)
    notify(`cancel:${id}`,appointment.patientId,'Appointment Cancellation','Your appointment was cancelled.')
    closeFollowup(state,id,'Open')
    return {ok:true}
  })

  // After the server recorded a pre-arrival No-show (the Patient did not arrive, so there is no Visit and no queue
  // entry): reopen a linked follow-up so the clinic can schedule it again.
  const applyAppointmentNoShow=run(({state,session,event},id)=>{
    const appointment=serverAppointment(state,id)
    if(!appointment||!canOperate(state,session,appointment))return fail('Appointment is outside your assigned branch.')
    if(appointment.status!=='No-show')return fail('The No-show has not been recorded on the server.')
    event(`noshow:${id}`,'appointment','appointment.no_show',`No-show ${appointment.appointmentNo}`,appointment.patientId,appointment.branchId)
    closeFollowup(state,id,'Open')
    return {ok:true}
  })

  // M20 bridge: a Dentist-requested follow-up booked as a normal SERVER appointment stores only that appointment's public
  // id. Remove this bridge when M20 becomes backend-authoritative.
  const linkFollowupAppointment=run(({state,session,event,notify},followupId,appointmentId)=>{
    // Clinic-side scheduling of a Dentist-requested follow-up (D3): Staff, or Owner.
    if(!['staff','owner'].includes(session.role))return fail('Follow-up visits are scheduled by the clinic.')
    if(!permitted(state,session,'followups'))return fail('Your account no longer has follow-up scheduling permission.')
    const followup=state.followups.find(f=>f.id===followupId)
    const appointment=serverAppointment(state,appointmentId)
    if(!followup||!inScope(followup,session,state))return fail('Follow-up is outside your scope.')
    if(!appointment)return fail('The booked appointment could not be found on the server.')
    const treatment=linkedTreatment(state,followup)
    if(!treatment||!completedEncounter(state,treatment)||treatment.status!=='Completed'||treatment.followupRequired!==true)return fail('Follow-up relationship needs review.')
    if(!['Open','Scheduled'].includes(followup.status)||['patientId','branchId','dentistId'].some(k=>followup[k]!==appointment[k]))return fail('Follow-up context does not match this booking.')
    if(followup.appointmentId===appointmentId)return {ok:true,unchanged:true,record:followup}
    const record={...followup,status:'Scheduled',appointmentId}
    state.followups=replace(state.followups,record)
    const key=`appointment:${appointment.id}:${appointment.revision}`
    event(key,'appointment→followup','appointment.created',`${appointment.appointmentNo} for follow-up`,followup.patientId,followup.branchId,{followupId})
    notify(key,followup.patientId,'Appointment Confirmation',`Your follow-up visit is booked for ${appointment.date} at ${appointment.start}.`)
    return {ok:true,record}
  })

  // ---- M5 downstream reconciliation (TEMPORARY transitional adapters; decision Q-T7) --------------------------------------
  // The clinical Treatment is server-authoritative (M5). A COMPLETED server Treatment is the durable fact the still-browser-
  // local modules consume: M11 Draft invoice, M20 follow-up task, M19 prescription-required task and M12 HMO handoff.
  // Every authorized Staff/Dentist browser in scope reconciles the missing local
  // projections from the server Treatments it loaded, keyed by the Treatment's public id (the deterministic source key),
  // so the result never depends on which browser completed the treatment. Idempotent: an existing projection for that
  // Treatment is never duplicated or rewritten. It reads the Treatment and never writes it (commit() drops treatments).
  // Pre-server treatment history and Owner summary rows are never reconciled. Remove each adapter when its module's
  // backend lands.
  // M18 boundary: this reconciliation creates NO notification of any kind (no in-app record, email, SMS, delivery status,
  // retry or schedule) — notification & reminder delivery belongs to M18. It only appends M23 workflow-log events
  // (`log`, which never notifies). The M12 HMO adapter it calls is unchanged M12 prototype code: when it opens a case it
  // still records M12's own in-app case notices, exactly as a manual HMO case does (see the M5 hardening report).
  const reconcileTreatmentHandoffs=run(({state,session,now,event,notify})=>{
    if(!['staff','dentist'].includes(session.role))return {ok:true,unchanged:true}
    const log=(key,domain,type,result,t,extra={},status='Success')=>appendWorkflowEvent(state,session,now,key,domain,type,result,{...workflowContext(state,key),patientId:t.patientId,branchId:t.branchId,...extra},status)
    const warnings=[]
    const completed=state.treatments.filter(t=>t.server&&!t.summaryOnly&&!t.patientSubset&&t.status==='Completed'&&inScope(t,session,state)&&completedEncounter(state,t))
    for(const t of completed){
      // M11: Draft invoice priced from the local fee configuration (M13/M11 own pricing; M5 stores no money).
      if(!state.invoices.some(i=>i.treatmentId===t.id)){
        const invoiceId=`inv-${t.id}`
        const priced=treatmentInvoiceItems(state,t,invoiceId)
        if(!priced.ok){
          log(`billing:needs-review:${t.id}`,'treatment→billing','billing.draft.needs_review',priced.message,t,{entityType:'treatment',entityId:t.id,treatmentId:t.id},'Warning')
          warnings.push(priced.message)
        }else{
          const amount=money(priced.items.reduce((sum,p)=>sum+p.amount,0))
          const invoice={id:invoiceId,invoiceNo:`INV-${t.date.slice(0,4)}-${String(state.invoices.length+1).padStart(4,'0')}`,treatmentId:t.id,queueEntryId:t.queueEntryId,visitId:t.visitId,appointmentId:t.appointmentId||null,patientId:t.patientId,branchId:t.branchId,visitDate:t.date,items:priced.items,subtotal:amount,total:amount,netAmount:amount,status:'Draft',paymentStatus:'Unpaid',method:'—',receipt:null,createdBy:'System'}
          state.invoices=[invoice,...state.invoices]
          log(`invoice:${t.id}`,'treatment→billing','billing.draft.prepared',invoice.invoiceNo,t)
        }
      }
      // M20: the Dentist's follow-up decision becomes an Open task that clinic Staff schedule through the M6 bridge.
      if(t.followupRequired&&!state.followups.some(f=>f.treatmentId===t.id)){
        state.followups=[{id:`f-${t.id}`,patientId:t.patientId,treatmentId:t.id,dentistId:t.dentistId,branchId:t.branchId,reason:t.followupReason||`Follow-up after ${t.procedure}`,recommendedDate:t.followupDate||'',interval:t.followupInterval||'',status:'Open',appointmentId:null,taskCreatedAt:now.label},...state.followups]
        log(`followup:${t.id}`,'treatment→followup','clinical.followup.required',`Follow-up for ${t.id}`,t)
      }
      // M19: a requested prescription becomes the Dentist's authorization task (the Dentist enters every medication).
      if(t.prescriptionRequired&&!state.prescriptions.some(rx=>rx.treatmentId===t.id))log(`rx:${t.id}`,'treatment→prescription','clinical.prescription.required','Dentist authorization required',t)
      // M12: clinic-side HMO handoff for an insured Patient (never a provider decision).
      const handoff=prepareHmoCase({state,session,now,event,notify},{treatmentId:t.id},{system:true})
      if(!handoff.ok){
        log(`hmo:handoff:${t.id}`,'treatment→hmo','hmo.handoff.needs_review',handoff.message,t,{entityType:'treatment',entityId:t.id,treatmentId:t.id},'Warning')
        warnings.push(handoff.message)
      }
      if(t.appointmentId)closeFollowup(state,t.appointmentId,'Completed')
      log(`treatment:${t.id}:${t.revision}`,'treatment→automation','clinical.treatment.completed',`${t.id} • Completed`,t)
    }
    return {ok:true,warnings}
  })

  const createPatientRecord=run(({state,session,now,event},input={})=>{
    if(!isRecord(input)||!isRecord(input.person)||!isRecord(input.patient))return fail('Enter patient and contact details.')
    if(session.role!=='staff'&&session.role!=='owner')return fail('Only Staff or Owner can create a patient record.')
    const {person,patient,createPortalAccount=false}=input
    if(['firstName','lastName','phone','email','dob','sex','address'].some(k=>person[k]!=null&&typeof person[k]!=='string'))return fail('Enter valid patient identity and contact text.')
    if(person.dob&&(!validDate(person.dob)||person.dob>now.date))return fail('Enter a valid date of birth.')
    const firstName=clean(person.firstName),lastName=clean(person.lastName),phone=clean(person.phone),email=clean(person.email).toLowerCase()
    if(!firstName||!lastName||!phone)return fail('First name, last name, and phone are required.')
    if(state.persons.some(p=>(p.phone&&p.phone===phone)||(p.firstName?.toLowerCase()===firstName.toLowerCase()&&p.lastName?.toLowerCase()===lastName.toLowerCase()&&p.dob===person.dob)))return fail('A possible duplicate patient/person exists. Review the existing record.')
    if(createPortalAccount&&(!email||state.persons.some(p=>p.email?.toLowerCase()===email)))return fail('A unique email is required for a portal account.')
    const personRecord={...person,id:uid('per'),firstName,lastName,phone,email}
    const preferredBranchId=session.role==='staff'?session.branchId:patient.preferredBranchId||state.branches.find(b=>b.name===patient.preferredBranch)?.id
    if(!state.branches.some(b=>b.id===preferredBranchId))return fail('Select a valid preferred branch.')
    const record={...patient,id:uid('p'),personId:personRecord.id,userId:null,patientCode:`PAT-${String(state.patients.length+1).padStart(4,'0')}`,preferredBranchId,consent:!!patient.consent}
    delete record.preferredBranch
    if(createPortalAccount){
      const username=email
      if(state.users.some(u=>(u.username||u.login)===username))return fail('Portal username already exists.')
      record.userId=uid('u')
      state.users=[...state.users,{id:record.userId,personId:record.personId,username,login:username,roleName:'Patient',role:'Patient',branchId:null,accountStatus:'Active',status:'Active',permissions:['patient-portal'],lastLogin:'Never'}]
    }
    state.persons=[...state.persons,personRecord];state.patients=[...state.patients,record]
    event(`patient:${record.id}`,'patient','patient.record.created',record.patientCode,record.id,preferredBranchId)
    return {ok:true,record:patientProjection(record,personRecord)}
  })
  const commands={...administrationActions(run),...phase2Actions(run),...hmoActions(run),...communicationActions(run),...loyaltyActions(run),...bookingDraftActions(run),recordAppointmentEvent,applyAppointmentCancellation,applyAppointmentNoShow,linkFollowupAppointment,reconcileTreatmentHandoffs,createPatientRecord}
  const permissions={recordAppointmentEvent:'appointments',applyAppointmentCancellation:'appointments',applyAppointmentNoShow:'appointments',linkFollowupAppointment:'followups',createPatientRecord:'patient-demographics',reviewInvoice:'billing',issueInvoice:'billing',postPayment:'billing',savePrescription:'prescriptions',authorizePrescription:'prescriptions',recordLoyaltyActivity:'engagement',processLoyaltyRedemption:'engagement'}
  return Object.fromEntries(Object.entries(commands).map(([name,action])=>[name,(...args)=>permissions[name]&&!permitted(getState(),getSession(),permissions[name])?fail('Your current account or permission no longer allows this action. Reopen your workspace or ask an administrator.'):action(...args)]))
}
