import { administrationActions } from './administration.js'
import { validSession, permitted, isRecord, encounterIssue, completedEncounter } from './safeguards.js'
import { communicationActions } from './communication.js'
import { hmoActions, prepareHmoCase } from './hmo.js'
import { loyaltyActions } from './loyalty.js'
import { workflowContext, notificationEventKey, appendWorkflowEvent, appendNotification, notifyBranch } from './orchestration.js'
import { phase2Actions, procedureLines, linkedTreatment, money, validInvoice } from './phase2.js'
import { clinicNow, validDate } from './clock.js'
import { encounterContext, inScope, isTodayQueue } from './contracts.js'
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
      const completed=state.treatments.filter(t=>t.status==='Completed'&&!before.treatments.some(old=>old.id===t.id&&old.status==='Completed'))
      for(const treatment of completed){
        const handoff=prepareHmoCase(ctx,{treatmentId:treatment.id},{system:true})
        if(!handoff.ok){
          event(`hmo:handoff:${treatment.id}`,'treatment→hmo','hmo.handoff.needs_review',handoff.message,treatment.patientId,treatment.branchId,{entityType:'treatment',entityId:treatment.id,treatmentId:treatment.id},'Warning')
          result.warnings=[...(result.warnings||[]),handoff.message]
        }
      }
    }
    if(result.ok&&!result.unchanged){
      const patch=Object.fromEntries(Object.entries(state).filter(([key,value])=>value!==before[key]))
      commit(patch)
    }
    return result
  }
  const canOperate=(state,session,record)=>['staff','owner'].includes(session.role)&&inScope(record,session,state)
  const queueRecord=(state,id)=>state.queue.find(q=>q.id===id)
  const closeFollowup=(state,appointmentId,status)=>{
    const appointment=state.appointments.find(a=>a.id===appointmentId)
    state.followups=state.followups.map(f=>f.appointmentId===appointmentId&&appointment&&f.patientId===appointment.patientId&&(!f.branchId||f.branchId===appointment.branchId)&&(!f.dentistId||f.dentistId===appointment.dentistId)?{...f,status,appointmentId:status==='Open'?null:appointmentId}:f)
  }

  // ---- M6/M8/M9 cutover adapters (TEMPORARY) --------------------------------------------------------------------
  // Appointments, Visits and the queue are server-authoritative (Laravel/PostgreSQL). These commands never create or edit
  // an appointment, a Visit or a queue entry: each runs only AFTER the matching server command succeeded and the server
  // projection was refreshed, and it updates the still-browser-local downstream records (treatment, follow-up, in-app
  // notifications) to match. Remove each one when its owning module (M5/M20/M18) becomes backend-authoritative.
  const serverAppointment=(state,id)=>state.appointments.find(a=>a.id===id&&a.server)
  const serverVisit=(state,id)=>(state.visits||[]).find(v=>v.id===id&&v.server)

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

  const saveTreatment=run(({state,session,now,event,notify},input={},status='In Treatment')=>{
    if(!isRecord(input))return fail('Open a valid encounter from My Queue.')
    if(session.role!=='dentist')return fail('Only the assigned dentist may document treatment.')
    const entry=queueRecord(state,input.queueEntryId)
    if(!entry||!inScope(entry,session,state)||!isTodayQueue(entry,now.date))return fail('Open your exact encounter from today’s queue.')
    const issue=encounterIssue(state,entry,now,status);if(issue)return fail(issue)
    const dentist=state.dentists.find(d=>d.id===entry.dentistId)
    if(!dentist||dentist.available===false||dentist.userId!==session.userId||!dentist.branchIds?.includes(entry.branchId))return fail('The assigned Dentist profile is unavailable for this encounter.')
    const visit=serverVisit(state,entry.visitId)
    const appointment=entry.appointmentId?serverAppointment(state,entry.appointmentId):null
    if(!visit||!state.patients.some(p=>p.id===entry.patientId)||!state.branches.some(b=>b.id===entry.branchId)||entry.appointmentId&&(!appointment||['patientId','dentistId','branchId'].some(k=>appointment[k]!==entry[k])||appointment.date!==entry.clinicDate))return fail('Encounter relationships are missing or inconsistent.')
    const current=entry.treatmentId?state.treatments.find(t=>t.id===entry.treatmentId):state.treatments.find(t=>t.queueEntryId===entry.id)
    if(entry.treatmentId&&!current)return fail('The linked treatment record is missing; review this encounter before continuing.')
    if(input.id&&input.id!==current?.id)return fail('Treatment ID does not match this encounter.')
    if(current&&((current.queueEntryId&&current.queueEntryId!==entry.id)||['patientId','dentistId','branchId','appointmentId','visitId'].some(key=>current[key]!=null&&current[key]!==entry[key])))return fail('The linked treatment belongs to another encounter. Review the record linkage.')
    for(const key of ['patientId','appointmentId','dentistId','branchId','visitId'])if(input[key]!=null&&input[key]!==entry[key])return fail('Treatment context does not match the queue entry.')
    if(appointment&&['Cancelled','No-show'].includes(appointment.status))return fail('The appointment does not match the active treatment.')
    // Server-first ordering: the Visit's clinical transition (start-treatment / complete, which also moves a linked
    // appointment) is recorded on the server before the local treatment record changes.
    if(visit.status!==status)return fail(status==='Completed'?'Complete the visit on the server first.':'Start the treatment on the visit first.')
    if(current?.status==='Completed')return status==='Completed'?{ok:true,unchanged:true,record:current}:fail('Completed treatment cannot be reopened here.')
    if(current&&input.revision!=null&&input.revision!==current.revision)return fail('This treatment draft changed. Reopen the encounter before saving your notes.')
    if(!state.branches.some(b=>b.id===entry.branchId&&b.status==='Open'))return fail('This branch is not open for treatment. Ask Staff to review the encounter.')
    // M9: the server queue entry is Served by the Visit start-treatment command itself (server-first), so a local treatment
    // only ever follows a Served entry.
    if(entry.status!=='Served')return fail('Start the treatment from the queue first.')
    if(!['In Treatment','Completed'].includes(status))return fail('Invalid treatment status.')
    if(state.treatments.some(t=>t.dentistId===entry.dentistId&&t.status==='In Treatment'&&t.date===entry.clinicDate&&t.id!==current?.id))return fail('Complete the current treatment before starting another encounter.')
    if(status==='Completed'&&current?.status!=='In Treatment')return fail('Start treatment before completing this encounter.')
    const serviceId=input.procedures?.[0]?.serviceId||input.serviceId||current?.serviceId||entry.serviceId
    const service=state.services.find(s=>s.id===serviceId&&s.status==='Active')
    const branchService=state.branchServices.find(bs=>bs.branchId===entry.branchId&&bs.serviceId===serviceId&&bs.active!==false)
    if(!service||!branchService||!state.dentistServiceAssignments.some(a=>a.dentistId===entry.dentistId&&a.serviceId===serviceId&&a.isAuthorized!==false))return fail('Select an authorized performed service for this branch.')
    if(status==='Completed'&&!clean(input.procedure??current?.procedure))return fail('Document the performed procedure before completing treatment.')
    const treatmentId=current?.id||uid('t')
    const performed=procedureLines(state,entry,treatmentId,input,current)
    if(!performed.ok)return performed
    if(status==='Completed'&&!performed.lines.length)return fail('Confirm at least one performed procedure.')
    for(const key of ['prescriptionRequired','followupRequired'])if(input[key]!==undefined&&typeof input[key]!=='boolean')return fail('Clinical requirements must be explicit Dentist choices.')
    if(input.followupDate&&(!validDate(input.followupDate)||input.followupDate<now.date))return fail('Choose a valid recommended follow-up date.')
    const fields=['complaint','plan','procedure','notes','assistant','assistantStaffId','followupRequired','prescriptionRequired','followupDate','followupInterval','followupReason']
    if(fields.filter(k=>!['followupRequired','prescriptionRequired'].includes(k)).some(k=>input[k]!=null&&typeof input[k]!=='string'))return fail('Clinical documentation fields must contain text.')
    const clinical=Object.fromEntries(fields.filter(k=>input[k]!==undefined).map(k=>[k,input[k]]))
    if(current&&current.status===status&&current.serviceId===serviceId&&JSON.stringify(current.procedures||[])===JSON.stringify(performed.lines)&&Object.entries(clinical).every(([k,v])=>current[k]===v))return {ok:true,unchanged:true,record:current}
    const record={...current,...clinical,id:treatmentId,procedures:performed.lines,queueEntryId:entry.id,visitId:entry.visitId,patientId:entry.patientId,appointmentId:entry.appointmentId||null,dentistId:entry.dentistId,branchId:entry.branchId,requestedServiceId:entry.serviceId,serviceId,date:entry.clinicDate,status,startedAt:current?.startedAt||now.timestamp,completedAt:status==='Completed'?now.timestamp:null,revision:(current?.revision||0)+1}
    state.treatments=replace(state.treatments,record)
    if(status==='Completed'){
      state.patients=state.patients.map(p=>p.id===record.patientId?{...p,dentalHistory:`${p.dentalHistory||''} ${record.procedure} • ${record.date}.`.trim()}:p)
      const existingInvoice=state.invoices.find(i=>i.treatmentId===record.id)
      if(existingInvoice&&!validInvoice(state,existingInvoice))return fail('An existing invoice has inconsistent treatment links.')
      if(state.followups.some(f=>f.treatmentId===record.id&&!linkedTreatment(state,f))||state.prescriptions.some(r=>r.treatmentId===record.id&&!linkedTreatment(state,r)))return fail('An existing clinical handoff has inconsistent treatment links.')
      if(!existingInvoice){
        const invoiceId=uid('inv')
        const items=record.procedures.map(p=>({id:`${invoiceId}-${p.id}`,invoiceId,procedureId:p.id,treatmentId:record.id,serviceId:p.serviceId,quantity:p.quantity,unitFee:p.unitFee,amount:p.amount}))
        const amount=money(items.reduce((sum,p)=>sum+p.amount,0))
        const invoice={id:invoiceId,invoiceNo:`INV-${now.date.slice(0,4)}-${String(state.invoices.length+1).padStart(4,'0')}`,treatmentId:record.id,queueEntryId:entry.id,visitId:entry.visitId,appointmentId:entry.appointmentId||null,patientId:record.patientId,branchId:record.branchId,visitDate:record.date,items,subtotal:amount,total:amount,netAmount:amount,status:'Draft',paymentStatus:'Unpaid',method:'—',receipt:null,createdBy:'System'}
        state.invoices=[invoice,...state.invoices]
        event(`invoice:${record.id}`,'treatment→billing','billing.draft.prepared',invoice.invoiceNo,record.patientId,record.branchId)
      }
      if(record.followupRequired&&!state.followups.some(f=>f.treatmentId===record.id)){
        state.followups=[{id:uid('f'),patientId:record.patientId,treatmentId:record.id,dentistId:record.dentistId,branchId:record.branchId,reason:record.followupReason||`Follow-up after ${record.procedure}`,recommendedDate:record.followupDate||'',interval:record.followupInterval||'',status:'Open',appointmentId:null,taskCreatedAt:now.label},...state.followups]
        notify(`followup:${record.id}`,record.patientId,'Follow-Up Required','Your dentist recommends a follow-up visit.')
        event(`followup:${record.id}`,'treatment→followup','clinical.followup.required',`Follow-up for ${record.id}`,record.patientId,record.branchId)
      }
      if(record.prescriptionRequired&&!state.prescriptions.some(rx=>rx.treatmentId===record.id))event(`rx:${record.id}`,'treatment→prescription','clinical.prescription.required','Dentist authorization required',record.patientId,record.branchId)
      if(entry.appointmentId)closeFollowup(state,entry.appointmentId,'Completed')
      notify(`treatment:${record.id}`,record.patientId,'Visit Complete','Your treatment is complete. Staff will review the prepared bill.')
    }
    event(`treatment:${record.id}:${record.revision}`,'treatment→automation',status==='Completed'?'clinical.treatment.completed':'clinical.treatment.updated',`${record.id} • ${status}`,record.patientId,record.branchId)
    return {ok:true,record,context:{...encounterContext(entry),treatmentId:record.id}}
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
  const commands={...administrationActions(run),...phase2Actions(run),...hmoActions(run),...communicationActions(run),...loyaltyActions(run),...bookingDraftActions(run),recordAppointmentEvent,applyAppointmentCancellation,applyAppointmentNoShow,linkFollowupAppointment,saveTreatment,completeTreatment:(input,status='Completed')=>saveTreatment(input,status),createPatientRecord}
  const permissions={recordAppointmentEvent:'appointments',applyAppointmentCancellation:'appointments',applyAppointmentNoShow:'appointments',linkFollowupAppointment:'followups',saveTreatment:'treatment',completeTreatment:'treatment',createPatientRecord:'patient-demographics',reviewInvoice:'billing',issueInvoice:'billing',postPayment:'billing',savePrescription:'prescriptions',authorizePrescription:'prescriptions',recordLoyaltyActivity:'engagement',processLoyaltyRedemption:'engagement'}
  return Object.fromEntries(Object.entries(commands).map(([name,action])=>[name,(...args)=>permissions[name]&&!permitted(getState(),getSession(),permissions[name])?fail('Your current account or permission no longer allows this action. Reopen your workspace or ask an administrator.'):action(...args)]))
}
