import { administrationActions } from './administration.js'
import { validSession, permitted, isRecord, encounterIssue, validTime, completedEncounter } from './safeguards.js'
import { communicationActions } from './communication.js'
import { hmoActions, prepareHmoCase } from './hmo.js'
import { loyaltyActions } from './loyalty.js'
import { workflowContext, notificationEventKey, appendWorkflowEvent, appendNotification, notifyBranch } from './orchestration.js'
import { phase2Actions, procedureLines, linkedTreatment, money, validInvoice } from './phase2.js'
import { clinicNow, validDate } from './clock.js'
import { encounterContext, inScope, isActiveQueue, isTodayQueue, TERMINAL } from './contracts.js'
import { recalcQueue, uid, validateAppointment } from './logic.js'

const fail=message=>({ok:false,message})
const replace=(rows,record)=>rows.some(x=>x.id===record.id)?rows.map(x=>x.id===record.id?record:x):[...rows,record]
const durable=record=>{const {branch,service,...value}=record;return value}
const clean=value=>String(value||'').trim().replace(/\s+/g,' ')
export const patientProjection=(patient,person)=>({...person,...patient,id:patient.id,personId:person.id,name:[person.firstName,person.middleName,person.lastName].filter(Boolean).join(' ')})

// Critical frontend commands read the latest synchronous store snapshot. Their
// patches are committed together by ClinicProvider, outside React state updaters.
export function createWorkflowActions({getState,commit,getSession,clock=clinicNow}) {
  const run=(command,metadata={})=>(...args)=>{
    const before=getState(), state={...before}, session=getSession(), now=clock()
    const user=before.users.find(u=>u.id===session?.userId)
    if(!validSession(before,session,now))return fail('An active clinic session is required.')
    const event=(key,module,type,result,patientId,branchId,extra={},status='Success')=>{
      const context={...workflowContext(state,key),patientId,branchId,...extra}
      appendWorkflowEvent(state,session,now,key,module,type,result,context,status)
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
      appendWorkflowEvent(failureState,session,now,key,metadata.module,metadata.name,result.message,{entityType:typeof args[0]==='object'?(args[0]?.treatmentId?'treatment':args[0]?.appointmentId?'appointment':'workflow'):metadata.name.startsWith('hmo')?'hmo':metadata.name.startsWith('conversation')?'conversation':metadata.name.startsWith('inquiry')?'inquiry':'workflow',entityId},'Failed')
      if(failureState.workflowLog!==before.workflowLog)commit({workflowLog:failureState.workflowLog,audit:failureState.audit})
      return result
    }
    if(result.ok&&!result.unchanged){
      const completed=state.treatments.filter(t=>t.status==='Completed'&&!before.treatments.some(old=>old.id===t.id&&old.status==='Completed'))
      for(const treatment of completed){
        const handoff=prepareHmoCase(ctx,{treatmentId:treatment.id},{system:true})
        if(!handoff.ok){
          event(`hmo:handoff:${treatment.id}`,'M5→M12','hmo.handoff.needs_review',handoff.message,treatment.patientId,treatment.branchId,{entityType:'treatment',entityId:treatment.id,treatmentId:treatment.id},'Warning')
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

  const saveAppointment=run(({state,session,now,event,notify},form={},options={})=>{
    if(!isRecord(form)||!isRecord(options))return fail('Enter valid appointment details.')
    if(!['patient','staff','owner'].includes(session.role))return fail('This role cannot book appointments.')
    const existing=options.appointmentId?state.appointments.find(a=>a.id===options.appointmentId):null
    if(options.appointmentId&&!existing)return fail('Appointment not found.')
    if(existing&&form.patientId!=null&&form.patientId!==existing.patientId)return fail('An appointment cannot be reassigned to another patient. Cancel and create the correct booking.')
    if(existing&&options.expectedRevision!=null&&options.expectedRevision!==(existing.revision||0)&&existing.commandId!==options.commandId)return fail('This appointment changed after the form opened. Reopen it before rescheduling.')
    if(existing&&state.hmo.some(h=>h.appointmentId===existing.id)&&form.branchId!==existing.branchId)return fail('This appointment has an HMO case at its current branch. Ask the clinic to review the case before changing branch.')
    if(existing&&!inScope(existing,session,state))return fail('Appointment is outside your scope.')
    if(existing&&(!['Pending','Confirmed'].includes(existing.status)||state.checkIns.some(c=>c.appointmentId===existing.id)||state.queue.some(q=>q.appointmentId===existing.id)||state.treatments.some(t=>t.appointmentId===existing.id)))return fail('An admitted or closed appointment cannot be rescheduled.')
    if(session.role==='patient'&&form.patientId!=null&&form.patientId!==session.patientId)return fail('This booking form belongs to another patient. Reopen your own appointment.')
    const request={...form,patientId:session.role==='patient'?session.patientId:form.patientId}
    if(!inScope(request,session,state))return fail('Choose your assigned branch and patient scope.')
    let followup=state.followups.find(f=>options.followupId?f.id===options.followupId:existing&&f.appointmentId===existing.id)
    if(followup&&!permitted(state,session,'followups'))return fail('Your account no longer has follow-up scheduling permission.')
    if(options.followupId&&(!followup||!inScope(followup,session,state)||followup.patientId!==request.patientId||followup.dentistId!==request.dentistId))return fail('Follow-up context does not match this booking.')
    if(followup&&(!linkedTreatment(state,followup)||!completedEncounter(state,linkedTreatment(state,followup))||(linkedTreatment(state,followup).status!=='Completed'||linkedTreatment(state,followup).followupRequired!==true)||followup.branchId!==request.branchId||followup.patientId!==request.patientId||followup.dentistId!==request.dentistId||!['Open','Scheduled'].includes(followup.status)))return fail('Follow-up relationship needs review.')
    if(followup?.appointmentId){
      const linked=state.appointments.find(a=>a.id===followup.appointmentId)
      if(!linked||['patientId','dentistId','branchId'].some(k=>linked[k]!==followup[k])||linked.status==='Completed'||existing&&existing.id!==linked.id)return fail('Follow-up appointment relationship needs review.')
      if(!existing&&['Cancelled','No-show'].includes(linked.status))followup={...followup,status:'Open',appointmentId:null}
      else if(!existing)return {ok:true,unchanged:true,record:linked}
    }
    if(existing&&followup&&followup.appointmentId!==existing.id)return fail('Follow-up cannot be attached to an unrelated appointment.')
    const retry=options.commandId&&state.appointments.find(a=>a.commandId===options.commandId)
    if(retry&&(!inScope(retry,session,state)||['patientId','branchId','dentistId'].some(k=>retry[k]!==request[k])||existing&&retry.id!==existing.id))return fail('This booking command belongs to another encounter. Reopen the intended appointment.')
    if(retry&&!existing)return {ok:true,unchanged:true,record:retry}
    const result=validateAppointment(request,state,existing?.id,now)
    if(!result.valid)return {...fail(result.checks.filter(c=>!c.ok).map(c=>c.label).join('. ')),validation:result}
    const record={...durable(existing||{}),id:existing?.id||uid('a'),commandId:options.commandId||null,appointmentNo:existing?.appointmentNo||`APT-${now.date.slice(0,4)}-${String(state.appointments.length+1).padStart(4,'0')}`,patientId:request.patientId,followupId:followup?.id||existing?.followupId||null,branchId:result.branch.id,dentistId:request.dentistId,serviceId:result.service.id,date:request.date,start:request.start,scheduledStart:`${request.date}T${request.start}`,duration:result.duration,notes:request.notes||'',status:'Confirmed',source:existing?.source||(followup?'Follow-Up Task':session.role==='patient'?'Patient Portal':'Front Desk')}
    if(existing&&['patientId','branchId','dentistId','serviceId','date','start','duration','notes'].every(k=>existing[k]===record[k]))return {ok:true,unchanged:true,record:existing}
    record.revision=(existing?.revision||0)+1
    state.appointments=replace(state.appointments,record)
    if(followup)state.followups=replace(state.followups,{...followup,status:'Scheduled',appointmentId:record.id})
    const key=`appointment:${record.id}:${record.revision}`
    event(key,'M6→M7',existing?'appointment.rescheduled':'appointment.created',`${record.appointmentNo} • ${result.branch.name}`,record.patientId,record.branchId)
    notify(key,record.patientId,existing?'Appointment Rescheduled':'Appointment Confirmation',`Your ${result.service.name} visit is confirmed for ${record.date} at ${record.start} in ${result.branch.name}.`)
    return {ok:true,record:{...record,branch:result.branch.name,service:result.service.name}}
  })

  const cancelAppointment=run(({state,session,now,event,notify},id)=>{
    const appointment=state.appointments.find(a=>a.id===id)
    if(!appointment||!['patient','staff','owner'].includes(session.role)||!inScope(appointment,session,state))return fail('Appointment is outside your scope.')
    if(appointment.status==='Cancelled')return {ok:true,unchanged:true}
    if(!['Pending','Confirmed','Checked In'].includes(appointment.status))return fail('This appointment can no longer be cancelled.')
    const queues=state.queue.filter(q=>q.appointmentId===id)
    if(queues.some(q=>encounterIssue(state,q,now))||state.checkIns.some(c=>c.appointmentId===id&&['patientId','dentistId','branchId'].some(k=>c[k]!==appointment[k])))return fail('Encounter links need clinic review before cancellation.')
    if(queues.some(q=>q.status==='In Treatment')||state.treatments.some(t=>t.appointmentId===id))return fail('An encounter with clinical documentation cannot be cancelled here.')
    state.appointments=replace(state.appointments,{...durable(appointment),status:'Cancelled'})
    state.queue=recalcQueue(state.queue.map(q=>q.appointmentId===id?{...durable(q),status:'Cancelled',currentState:'Cancelled',completedAt:now.timestamp}:q))
    state.checkIns=state.checkIns.map(c=>c.appointmentId===id?{...c,status:'Cancelled'}:c)
    closeFollowup(state,id,'Open')
    event(`cancel:${id}`,'M6→M9','appointment.cancelled',`Cancelled ${appointment.appointmentNo}`,appointment.patientId,appointment.branchId)
    notify(`cancel:${id}`,appointment.patientId,'Appointment Cancellation','Your appointment was cancelled and its queue entry closed.')
    return {ok:true}
  })

  const admit=({state,session,now,event,notify},context,commandId)=>{
    const id=uid('qe'),checkInId=uid('ci')
    const queueNumber=Math.max(0,...state.queue.filter(q=>q.branchId===context.branchId&&q.dentistId===context.dentistId&&q.clinicDate===now.date).map(q=>q.queueNumber||0))+1
    const record={...context,id,queueEntryId:id,checkInId,commandId,queueId:`DQ-${context.branchId}-${context.dentistId}-${now.date}`,clinicDate:now.date,queueNumber,arrivedAt:now.timestamp,checkedIn:now.time,status:'Waiting',currentState:'Waiting',priority:'Normal',priorityReason:'',position:null,calledAt:null,readyAt:null,completedAt:null,treatmentId:null}
    state.checkIns=[...state.checkIns,{...context,id:checkInId,queueEntryId:id,clinicDate:now.date,arrivedAt:now.timestamp,status:'Checked In',type:context.appointmentId?'Scheduled':'Walk-in'}]
    state.queue=recalcQueue([...state.queue,record])
    if(context.appointmentId)state.appointments=state.appointments.map(a=>a.id===context.appointmentId?{...durable(a),status:'Checked In',checkInId,queueEntryId:id}:a)
    event(`arrival:${id}`,'M8→M9','patient.checked_in',`Arrival recorded at ${state.branches.find(b=>b.id===context.branchId)?.name}`,context.patientId,context.branchId)
    notify(`arrival:${id}`,context.patientId,'Check-In Confirmation','Your arrival is recorded. You are in the clinic queue.')
    return {ok:true,record:state.queue.find(q=>q.id===id),context:encounterContext(record)}
  }

  const checkInAppointment=run((ctx,id)=>{
    const {state,session,now}=ctx
    const appointment=state.appointments.find(a=>a.id===id)
    if(!appointment||!canOperate(state,session,appointment))return fail('Appointment is outside your assigned branch.')
    if(TERMINAL.includes(appointment.status))return fail('A closed appointment cannot be checked in again.')
    if(!validTime(appointment.start))return fail('The appointment time is invalid. Ask Staff to review the booking.')
    if(appointment.date!==now.date)return fail('Only today’s appointments can be checked in.')
    const existing=state.queue.find(q=>q.appointmentId===id)
    if(existing){const issue=encounterIssue(state,existing,now);return issue?fail(issue):{ok:true,unchanged:true,record:existing,context:encounterContext(existing)}}
    if(state.treatments.some(t=>t.appointmentId===id))return fail('This appointment already has clinical documentation. Open its encounter for review.')
    if(state.checkIns.some(c=>c.appointmentId===id))return fail('This appointment already has an arrival record.')
    if(!['Confirmed','Pending'].includes(appointment.status))return fail('Appointment is not awaiting arrival.')
    const validation=validateAppointment(appointment,state,id,now,false)
    // Arrival may be late; booking date/time/overlap checks do not rebook the visit.
    const invalid=validation.checks.filter(c=>!['date','time','overlap','patient-overlap'].includes(c.key)&&!c.ok)
    if(invalid.length)return fail(invalid.map(c=>c.label).join('. '))
    return admit(ctx,{appointmentId:id,patientId:appointment.patientId,branchId:appointment.branchId,dentistId:appointment.dentistId,serviceId:appointment.serviceId},`appointment:${id}`)
  })

  const admitWalkIn=run((ctx,form={},commandId)=>{
    if(!isRecord(form))return fail('Enter valid walk-in details.')
    const {state,session,now}=ctx
    if(!commandId)return fail('A walk-in admission command ID is required.')
    if(!canOperate(state,session,form))return fail('Walk-ins must use your assigned branch.')
    const retry=state.queue.find(q=>q.commandId===commandId)
    if(retry){
      if(!inScope(retry,session,state)||['patientId','branchId','dentistId','serviceId'].some(k=>retry[k]!==form[k])||!isTodayQueue(retry,now.date)||!isActiveQueue(retry))return fail('This admission command belongs to a different or closed encounter.')
      const issue=encounterIssue(state,retry,now);return issue?fail(issue):{ok:true,unchanged:true,record:retry,context:encounterContext(retry)}
    }
    const validation=validateAppointment({...form,date:now.date,start:now.time},state,null,now,false)
    const invalid=validation.checks.filter(c=>!['time','overlap','patient-overlap'].includes(c.key)&&!c.ok)
    if(invalid.length)return fail(invalid.map(c=>c.label).join('. '))
    if(state.queue.some(q=>q.patientId===form.patientId&&isTodayQueue(q,now.date)&&isActiveQueue(q)))return fail('This patient already has an active arrival today.')
    return admit(ctx,{appointmentId:null,patientId:form.patientId,branchId:form.branchId,dentistId:form.dentistId,serviceId:form.serviceId},commandId)
  })

  const updateQueue=run(({state,session,now,event,notify},id,status,extra={})=>{
    const entry=queueRecord(state,id)
    if(!entry||!inScope(entry,session,state)||!isTodayQueue(entry,now.date))return fail('Queue entry is outside your current day or scope.')
    const issue=encounterIssue(state,entry,now);if(issue)return fail(issue)
    if(!['staff','owner','dentist'].includes(session.role))return fail('This role cannot control the queue.')
    if(status==='Called'&&state.dentists.find(d=>d.id===entry.dentistId)?.available===false)return fail('This Dentist is unavailable. Ask Staff to review the queue assignment.')
    if(status==='Completed'||status==='In Treatment')return fail('Queue treatment state is controlled by the linked treatment only.')
    if(session.role==='dentist'&&status!=='Called')return fail('Only Staff manages absence, no-show, and priority.')
    if(TERMINAL.includes(entry.status))return fail('This queue entry is closed.')
    const priority=extra.priority
    if(priority){
      if(status!==entry.status)return fail('Priority changes cannot change the queue state.')
      if(!canOperate(state,session,entry)||!['Normal','Priority','Urgent'].includes(priority)||typeof extra.reason!=='string'||!clean(extra.reason))return fail('An authorized priority change requires a reason.')
      if(entry.priority===priority&&entry.priorityReason===clean(extra.reason))return {ok:true,unchanged:true,record:entry}
    }else{
      if(entry.status===status)return {ok:true,unchanged:true,record:entry}
      const allowed={Waiting:['Called','Temporarily Away','No-show'],Called:['Treatment Ready','Temporarily Away','No-show'],'Treatment Ready':['Temporarily Away','No-show'],'Temporarily Away':['Waiting','No-show']}
      if(!allowed[entry.status]?.includes(status))return fail('This queue transition is not allowed.')
      if(status==='No-show'&&entry.treatmentId)return fail('An encounter with clinical documentation cannot be marked no-show.')
    }
    const record={...durable(entry),status:priority?entry.status:status,currentState:priority?entry.status:status,revision:(entry.revision||0)+1}
    if(priority){record.priority=priority;record.priorityReason=clean(extra.reason)}
    if(status==='Temporarily Away')record.awayAt=now.timestamp
    if(status==='Waiting')record.returnedAt=now.timestamp
    if(status==='Called')record.calledAt=now.timestamp
    if(status==='Treatment Ready')record.readyAt=now.timestamp
    if(status==='No-show'){
      record.completedAt=now.timestamp
      state.appointments=state.appointments.map(a=>a.id===entry.appointmentId?{...durable(a),status:'No-show'}:a)
      state.checkIns=state.checkIns.map(c=>c.id===entry.checkInId?{...c,status:'No-show'}:c)
      if(entry.appointmentId)closeFollowup(state,entry.appointmentId,'Open')
    }
    state.queue=recalcQueue(replace(state.queue,record))
    const key=`queue:${id}:${record.revision}`
    event(key,'M9',priority?'queue.priority.changed':'queue.status.changed',priority?`${priority}: ${record.priorityReason}`:status,entry.patientId,entry.branchId)
    notify(key,entry.patientId,'Queue Update',priority?'Your queue priority has been updated.':`Your queue status is now ${status}.`)
    return {ok:true,record}
  })

  const saveTreatment=run(({state,session,now,event,notify},input={},status='In Treatment')=>{
    if(!isRecord(input))return fail('Open a valid encounter from My Queue.')
    if(session.role!=='dentist')return fail('Only the assigned dentist may document treatment.')
    const entry=queueRecord(state,input.queueEntryId)
    if(!entry||!inScope(entry,session,state)||!isTodayQueue(entry,now.date))return fail('Open your exact encounter from today’s queue.')
    const issue=encounterIssue(state,entry,now);if(issue)return fail(issue)
    const dentist=state.dentists.find(d=>d.id===entry.dentistId)
    if(!dentist||dentist.available===false||dentist.userId!==session.userId||!dentist.branchIds?.includes(entry.branchId))return fail('The assigned Dentist profile is unavailable for this encounter.')
    const appointment=entry.appointmentId?state.appointments.find(a=>a.id===entry.appointmentId):null
    if(!state.patients.some(p=>p.id===entry.patientId)||!state.branches.some(b=>b.id===entry.branchId)||entry.appointmentId&&(!appointment||['patientId','dentistId','branchId'].some(k=>appointment[k]!==entry[k])||appointment.date!==entry.clinicDate||appointment.queueEntryId&&appointment.queueEntryId!==entry.id))return fail('Encounter relationships are missing or inconsistent.')
    const current=entry.treatmentId?state.treatments.find(t=>t.id===entry.treatmentId):state.treatments.find(t=>t.queueEntryId===entry.id)
    if(entry.treatmentId&&!current)return fail('The linked treatment record is missing; review this encounter before continuing.')
    if(input.id&&input.id!==current?.id)return fail('Treatment ID does not match this encounter.')
    if(current&&((current.queueEntryId&&current.queueEntryId!==entry.id)||['patientId','dentistId','branchId','appointmentId'].some(key=>current[key]!=null&&current[key]!==entry[key])))return fail('The linked treatment belongs to another encounter. Review the record linkage.')
    for(const key of ['patientId','appointmentId','dentistId','branchId'])if(input[key]!=null&&input[key]!==entry[key])return fail('Treatment context does not match the queue entry.')
    if(appointment&&(appointment.treatmentId&&appointment.treatmentId!==current?.id||['Cancelled','No-show'].includes(appointment.status)))return fail('The appointment does not match the active treatment.')
    if(current?.status==='Completed')return status==='Completed'?{ok:true,unchanged:true,record:current}:fail('Completed treatment cannot be reopened here.')
    if(current&&input.revision!=null&&input.revision!==current.revision)return fail('This treatment draft changed. Reopen the encounter before saving your notes.')
    if(!state.branches.some(b=>b.id===entry.branchId&&b.status==='Open'))return fail('This branch is not open for treatment. Ask Staff to review the encounter.')
    if(!['Called','Treatment Ready','In Treatment'].includes(entry.status))return fail('Call this patient before starting treatment.')
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
    const record={...current,...clinical,id:treatmentId,procedures:performed.lines,queueEntryId:entry.id,patientId:entry.patientId,appointmentId:entry.appointmentId||null,dentistId:entry.dentistId,branchId:entry.branchId,requestedServiceId:entry.serviceId,serviceId,date:entry.clinicDate,status,startedAt:current?.startedAt||now.timestamp,completedAt:status==='Completed'?now.timestamp:null,revision:(current?.revision||0)+1}
    state.treatments=replace(state.treatments,record)
    state.queue=recalcQueue(state.queue.map(q=>q.id===entry.id?{...durable(q),treatmentId:record.id,status,currentState:status,treatmentStartedAt:record.startedAt,completedAt:record.completedAt}:q))
    state.appointments=state.appointments.map(a=>a.id===entry.appointmentId?{...durable(a),status,treatmentId:record.id}:a)
    state.checkIns=state.checkIns.map(c=>c.id===entry.checkInId?{...c,status}:c)
    if(status==='Completed'){
      state.patients=state.patients.map(p=>p.id===record.patientId?{...p,dentalHistory:`${p.dentalHistory||''} ${record.procedure} • ${record.date}.`.trim()}:p)
      const existingInvoice=state.invoices.find(i=>i.treatmentId===record.id)
      if(existingInvoice&&!validInvoice(state,existingInvoice))return fail('An existing invoice has inconsistent treatment links.')
      if(state.followups.some(f=>f.treatmentId===record.id&&!linkedTreatment(state,f))||state.prescriptions.some(r=>r.treatmentId===record.id&&!linkedTreatment(state,r)))return fail('An existing clinical handoff has inconsistent treatment links.')
      if(!existingInvoice){
        const invoiceId=uid('inv')
        const items=record.procedures.map(p=>({id:`${invoiceId}-${p.id}`,invoiceId,procedureId:p.id,treatmentId:record.id,serviceId:p.serviceId,quantity:p.quantity,unitFee:p.unitFee,amount:p.amount}))
        const amount=money(items.reduce((sum,p)=>sum+p.amount,0))
        const invoice={id:invoiceId,invoiceNo:`INV-${now.date.slice(0,4)}-${String(state.invoices.length+1).padStart(4,'0')}`,treatmentId:record.id,queueEntryId:entry.id,appointmentId:entry.appointmentId||null,patientId:record.patientId,branchId:record.branchId,visitDate:record.date,items,subtotal:amount,total:amount,netAmount:amount,status:'Draft',paymentStatus:'Unpaid',method:'—',receipt:null,createdBy:'System'}
        state.invoices=[invoice,...state.invoices]
        event(`invoice:${record.id}`,'M5→M11','billing.draft.prepared',invoice.invoiceNo,record.patientId,record.branchId)
      }
      if(record.followupRequired&&!state.followups.some(f=>f.treatmentId===record.id)){
        state.followups=[{id:uid('f'),patientId:record.patientId,treatmentId:record.id,dentistId:record.dentistId,branchId:record.branchId,reason:record.followupReason||`Follow-up after ${record.procedure}`,recommendedDate:record.followupDate||'',interval:record.followupInterval||'',status:'Open',appointmentId:null,taskCreatedAt:now.label},...state.followups]
        notify(`followup:${record.id}`,record.patientId,'Follow-Up Required','Your dentist recommends a follow-up visit.')
        event(`followup:${record.id}`,'M5→M20','clinical.followup.required',`Follow-up for ${record.id}`,record.patientId,record.branchId)
      }
      if(record.prescriptionRequired&&!state.prescriptions.some(rx=>rx.treatmentId===record.id))event(`rx:${record.id}`,'M5→M19','clinical.prescription.required','Dentist authorization required',record.patientId,record.branchId)
      if(entry.appointmentId)closeFollowup(state,entry.appointmentId,'Completed')
      notify(`treatment:${record.id}`,record.patientId,'Visit Complete','Your treatment is complete. Staff will review the prepared bill.')
    }
    event(`treatment:${record.id}:${record.revision}`,'M5→M23',status==='Completed'?'clinical.treatment.completed':'clinical.treatment.updated',`${record.id} • ${status}`,record.patientId,record.branchId)
    return {ok:true,record,context:{...encounterContext(entry),treatmentId:record.id}}
  })

  const createPatientRecord=run(({state,session,now,event},input={})=>{
    if(!isRecord(input)||!isRecord(input.person)||!isRecord(input.patient))return fail('Enter patient and contact details.')
    if(session.role!=='staff'&&session.role!=='owner')return fail('Only Staff or Owner can create a patient record.')
    const {person,patient,createPortalAccount=false}=input
    if(['firstName','middleName','lastName','phone','email','dob','sex','address'].some(k=>person[k]!=null&&typeof person[k]!=='string'))return fail('Enter valid patient identity and contact text.')
    if(person.dob&&(!validDate(person.dob)||person.dob>now.date))return fail('Enter a valid date of birth.')
    const firstName=clean(person.firstName),lastName=clean(person.lastName),phone=clean(person.phone),email=clean(person.email).toLowerCase()
    if(!firstName||!lastName||!phone)return fail('First name, last name, and phone are required.')
    if(state.persons.some(p=>(p.phone&&p.phone===phone)||(p.firstName?.toLowerCase()===firstName.toLowerCase()&&p.lastName?.toLowerCase()===lastName.toLowerCase()&&p.dob===person.dob)))return fail('A possible duplicate patient/person exists. Review the existing record.')
    if(createPortalAccount&&(!email||state.persons.some(p=>p.email?.toLowerCase()===email)))return fail('A unique email is required for a portal account.')
    const personRecord={...person,id:uid('per'),firstName,lastName,middleName:clean(person.middleName),phone,email}
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
    event(`patient:${record.id}`,'M4','patient.record.created',record.patientCode,record.id,preferredBranchId)
    return {ok:true,record:patientProjection(record,personRecord)}
  })
  const commands={...administrationActions(run),...phase2Actions(run),...hmoActions(run),...communicationActions(run),...loyaltyActions(run),saveAppointment,cancelAppointment,checkInAppointment,admitWalkIn,updateQueue,saveTreatment,completeTreatment:(input,status='Completed')=>saveTreatment(input,status),createPatientRecord}
  const permissions={saveAppointment:'appointments',cancelAppointment:'appointments',checkInAppointment:'checkin',admitWalkIn:'checkin',updateQueue:'queue',saveTreatment:'treatment',completeTreatment:'treatment',createPatientRecord:'patient-demographics',reviewInvoice:'billing',issueInvoice:'billing',postPayment:'billing',savePrescription:'prescriptions',authorizePrescription:'prescriptions',recordLoyaltyActivity:'engagement',processLoyaltyRedemption:'engagement'}
  return Object.fromEntries(Object.entries(commands).map(([name,action])=>[name,(...args)=>permissions[name]&&!permitted(getState(),getSession(),permissions[name])?fail('Your current account or permission no longer allows this action. Reopen your workspace or ask an administrator.'):action(...args)]))
}
