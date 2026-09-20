import { uid } from './logic.js'
import { HMO_PROVIDERS, HMO_REQUIREMENT_RULES, HMO_PENDING_HOURS, canProcessHmo, validHmoContext, pendingHours, pendingHmo, missingRequirements, clinicTimestamp } from './phase3-contracts.js'
import { appendNotification, notifyBranch } from './orchestration.js'

const fail=message=>({ok:false,message})
const clean=value=>String(value??'').trim()
const replace=(state,record)=>{state.hmo=(state.hmo||[]).some(h=>h.id===record.id)?state.hmo.map(h=>h.id===record.id?record:h):[record,...(state.hmo||[])]}
const caseContext=h=>({entityType:'hmo',entityId:h.id,hmoCaseId:h.id,patientId:h.patientId,branchId:h.branchId,treatmentId:h.treatmentId,appointmentId:h.appointmentId,action:{page:'hmo',context:{hmoCaseId:h.id,patientId:h.patientId}}})
function publish(ctx,h,key,type,title,body,{staff=false,patient=true,status='Success',module='M13'}={}) {
  const context={...caseContext(h),eventKey:key,eventType:type}
  ctx.event(key,module,type,title,h.patientId,h.branchId,context,status)
  if(patient)appendNotification(ctx.state,ctx.now,key,{patientId:h.patientId},title,body,context)
  if(staff)notifyBranch(ctx.state,ctx.now,key,h.branchId,'hmo',title,'Review this HMO case in your assigned worklist.',context)
}
function coherentRequirements(h) {
  return Array.isArray(h.requirements)&&h.requirements.length===HMO_REQUIREMENT_RULES.length&&HMO_REQUIREMENT_RULES.every(rule=>h.requirements.filter(r=>r?.ruleId===rule.id&&r.id===`${h.id}:${rule.id}`&&['Missing','Provided','Validated locally'].includes(r.state)&&(!r.treatmentId||r.treatmentId===h.treatmentId)).length===1)
}
function coherentTracking(h) {
  return ['contacts','responses','followUpTasks','submissionHistory'].every(k=>Array.isArray(h[k]))&&
    ['contacts','responses','followUpTasks'].every(k=>h[k].every(r=>r&&r.caseId===h.id&&Number.isInteger(r.submissionCycle)&&r.submissionCycle>0))
}
function getCase(ctx,id) {
  const h=(ctx.state.hmo||[]).find(h=>h.id===id)
  return h&&canProcessHmo(ctx.state,ctx.session,h)&&coherentRequirements(h)&&coherentTracking(h)&&(!pendingHmo(h)||clinicTimestamp(h.submittedAt)&&Date.parse(clinicTimestamp(h.submittedAt))<=Date.parse(ctx.now.timestamp))?h:null
}

// A clinic-side case is prepared once for an explicitly linked insured encounter.
// This does not request coverage or decide whether a provider will reimburse it.
export function prepareHmoCase(ctx,input,{system=false}={}) {
  const {state,session,now}=ctx
  const treatment=input.treatmentId?state.treatments.find(t=>t.id===input.treatmentId):null
  const appointmentId=input.appointmentId||treatment?.appointmentId||null
  const appointment=appointmentId?state.appointments.find(a=>a.id===appointmentId):null
  if(input.treatmentId&&!treatment||appointmentId&&!appointment||!treatment&&!appointment)return fail('Select an exact treatment or appointment for HMO handling.')
  const encounter=treatment||appointment
  if(['patientId','branchId'].some(k=>input[k]!=null&&input[k]!==encounter[k])||appointment&&treatment&&['patientId','branchId','dentistId'].some(k=>appointment[k]!==treatment[k]))return fail('HMO encounter context does not match.')
  const patient=state.patients.find(p=>p.id===encounter.patientId)
  const providerId=patient?.hmoProviderId||HMO_PROVIDERS.find(p=>p.name===patient?.hmo)?.id
  if(!patient||!providerId||!clean(patient.hmoMember)||patient.hmoMember==='—')return system?{ok:true,unchanged:true,notApplicable:true}:fail('This patient has no usable configured HMO membership.')
  const context={patientId:patient.id,branchId:encounter.branchId,providerId,treatmentId:treatment?.id||null,appointmentId}
  if(!validHmoContext(state,context)||!system&&!canProcessHmo(state,session,context))return fail('HMO processing is outside your assigned branch or permission.')
  const matches=(state.hmo||[]).filter(h=>appointmentId?h.appointmentId===appointmentId:treatment&&h.treatmentId===treatment.id)
  if(matches.length>1)return fail('Duplicate legacy HMO cases need clinic review.')
  const existing=matches[0]
  if(existing){
    if(!validHmoContext(state,existing)||!coherentRequirements(existing)||!coherentTracking(existing)||existing.patientId!==patient.id||existing.branchId!==encounter.branchId||existing.providerId!==providerId||existing.treatmentId&&existing.treatmentId!==treatment?.id&&treatment)return fail('Existing HMO case has conflicting encounter links.')
    if(treatment&&!existing.treatmentId){
      const canPrefill=['Draft','Missing Requirements','Ready for Submission'].includes(existing.status)&&treatment.status==='Completed'
      const requirements=existing.requirements.map(r=>canPrefill&&r.ruleId==='treatment-request'&&r.state==='Missing'?{...r,state:'Validated locally',treatmentId:treatment.id,validatedAt:now.timestamp}:r)
      const record={...existing,treatmentId:treatment.id,requirements,status:canPrefill&&requirements.every(r=>r.state==='Validated locally')?'Ready for Submission':existing.status}
      replace(state,record)
      publish(ctx,record,`hmo:linked:${existing.id}:${treatment.id}`,'hmo.encounter.linked','Completed treatment linked to HMO case','',{patient:false,module:'M12'})
      return {ok:true,record}
    }
    return {ok:true,unchanged:true,record:existing}
  }
  const id=uid('h'),record={id,schemaVersion:3,...context,memberId:patient.hmoMember,createdAt:now.timestamp,createdBy:system?'System':session.userId,requirements:HMO_REQUIREMENT_RULES.map(r=>({id:`${id}:${r.id}`,ruleId:r.id,label:r.label,state:r.id==='treatment-request'&&treatment?.status==='Completed'?'Validated locally':'Missing',...(r.id==='treatment-request'&&treatment?.status==='Completed'?{treatmentId:treatment.id,validatedAt:now.timestamp}: {})})),status:'Missing Requirements',providerOutcome:null,submittedAt:null,submissionCycle:0,submissionHistory:[],responses:[],contacts:[],followUpTasks:[],escalationStatus:'Not Escalated'}
  replace(state,record)
  publish(ctx,record,`hmo:created:${id}`,'hmo.requirements.missing','HMO requirements needed','Review the listed requirements for your HMO case.',{staff:true,module:'M12'})
  return {ok:true,record}
}
export function hmoActions(run) {
  const command=(name,module,fn)=>run(fn,{name,module})
  const createHmoCase=command('hmo.create','M12',(ctx,input)=>prepareHmoCase(ctx,input))
  const provideHmoRequirement=command('hmo.requirement','M12',(ctx,id,ruleId,input={})=>{
    const {state,session,now}=ctx
    const raw=(state.hmo||[]).find(h=>h.id===id)
    const patientOwns=session.role==='patient'&&raw?.patientId===session.patientId&&state.patients.find(p=>p.id===session.patientId)?.userId===session.userId
    const h=patientOwns&&validHmoContext(state,raw)&&coherentRequirements(raw)?raw:getCase(ctx,id)
    if(!h)return fail('HMO requirement is outside your scope or has invalid links.')
    if(!['Missing Requirements','Ready for Submission','Returned','Draft'].includes(h.status))return fail('Requirements cannot change while submitted or after a final provider outcome.')
    const requirement=h.requirements.find(r=>r.ruleId===ruleId)
    if(!requirement)return fail('Requirement does not belong to this case.')
    const target=patientOwns?'Provided':'Validated locally'
    if(requirement.state===target||requirement.state==='Validated locally')return {ok:true,unchanged:true,record:h}
    if(!clean(input.fileName)&&!requirement.document?.fileName)return fail('Enter the document name or select a file. Only metadata is stored.')
    const document={fileName:clean(input.fileName)||requirement.document.fileName,size:Number.isFinite(input.size)&&input.size>=0?input.size:null,metadataOnly:true,providedBy:session.userId,providedAt:now.timestamp}
    const requirements=h.requirements.map(r=>r.ruleId===ruleId?{...r,state:target,document,...(!patientOwns?{validatedBy:session.userId,validatedAt:now.timestamp}:{})}:r)
    const ready=requirements.every(r=>r.state==='Validated locally')
    const record={...h,requirements,status:ready?'Ready for Submission':h.status==='Returned'?'Returned':'Missing Requirements'}
    replace(state,record)
    publish(ctx,record,`hmo:requirement:${id}:${h.submissionCycle}:${ruleId}:${target}`,patientOwns?'hmo.requirement.provided':'hmo.requirement.validated',patientOwns?'HMO document recorded':'HMO requirement checked locally','Clinic requirement status updated.',{staff:patientOwns,patient:false,module:'M12'})
    return {ok:true,record}
  })
  const submitHmoCase=command('hmo.submit','M13',(ctx,id,input={})=>{
    const h=getCase(ctx,id)
    if(!h)return fail('HMO case is outside your scope or has invalid links.')
    if(!input.commandId)return fail('Submission command ID is required.')
    if(h.submissionHistory.some(s=>s.commandId===input.commandId))return {ok:true,unchanged:true,record:h}
    if(h.status!=='Ready for Submission'||missingRequirements(h).length)return fail('Validate all local requirements before recording submission.')
    if(!['Portal','Email','Phone','In person'].includes(input.method)||!clean(input.note))return fail('Record how Staff submitted the request outside this application and a tracking note.')
    const cycle=h.submissionCycle+1
    const record={...h,status:'Pending',submissionCycle:cycle,submittedAt:ctx.now.timestamp,providerOutcome:null,providerRespondedAt:null,escalatedAt:null,escalationStatus:'Not Escalated',submissionHistory:[...h.submissionHistory,{commandId:input.commandId,cycle,at:ctx.now.timestamp,recordedBy:ctx.session.userId,method:input.method,note:clean(input.note)}]}
    replace(ctx.state,record)
    publish(ctx,record,`hmo:submitted:${id}:${cycle}`,'hmo.submission.recorded','HMO submission recorded','Clinic staff recorded an external submission. A provider response is pending.')
    return {ok:true,record}
  })
  const recordHmoOutcome=command('hmo.response','M13',(ctx,id,input={})=>{
    const h=getCase(ctx,id)
    if(!h)return fail('HMO case is outside your scope or has invalid links.')
    if(!input.commandId||input.caseId&&input.caseId!==id)return fail('Provider response must identify this case and command.')
    if(h.responses.some(r=>r.commandId===input.commandId))return {ok:true,unchanged:true,record:h}
    if((ctx.state.hmo||[]).some(other=>other.id!==id&&Array.isArray(other.responses)&&other.responses.some(r=>r?.commandId===input.commandId)))return fail('Provider response command belongs to a different case.')
    if(!pendingHmo(h)||input.submissionCycle!==h.submissionCycle)return fail('Record a response against the current pending submission.')
    if(!['Approved','Rejected','Returned'].includes(input.outcome)||!['Portal','Email','Phone','In person'].includes(input.method)||!clean(input.note))return fail('Record the externally received outcome, channel and response note.')
    if(input.requirementIds!==undefined&&!Array.isArray(input.requirementIds))return fail('Correction requirements must be a list of this case’s requirement IDs.')
    const correctionIds=[...new Set(input.requirementIds||[])]
    if(input.outcome==='Returned'&&(!correctionIds.length||correctionIds.some(id=>!h.requirements.some(r=>r.ruleId===id))))return fail('Select the requirements the provider returned for correction.')
    const response={id:uid('hr'),caseId:id,commandId:input.commandId,submissionCycle:h.submissionCycle,outcome:input.outcome,method:input.method,note:clean(input.note),recordedBy:ctx.session.userId,recordedAt:ctx.now.timestamp,externalResponseRecorded:true}
    const record={...h,status:input.outcome,providerOutcome:input.outcome,providerRespondedAt:ctx.now.timestamp,...(input.outcome==='Returned'?{returnedAt:ctx.now.timestamp}:{}),responses:[...h.responses,response],requirements:input.outcome==='Returned'?h.requirements.map(r=>correctionIds.includes(r.ruleId)?{...r,state:'Missing',returnedAt:ctx.now.timestamp}:r):h.requirements,followUpTasks:h.followUpTasks.map(t=>({...t,status:'Resolved',resolvedAt:ctx.now.timestamp})),escalationStatus:'Resolved'}
    replace(ctx.state,record)
    publish(ctx,record,`hmo:response:${id}:${h.submissionCycle}`,'hmo.provider.response.recorded',`Provider response recorded: ${input.outcome}`,input.outcome==='Returned'?'The provider returned your request. Review the requirements needing correction.':`Clinic staff recorded the provider outcome: ${input.outcome}.`,{staff:input.outcome==='Returned'})
    return {ok:true,record}
  })
  const evaluateHmoTimers=command('hmo.evaluate','M14',ctx=>{
    let changed=false
    for(const h of ctx.state.hmo||[]){
      if(!getCase(ctx,h.id)||!pendingHmo(h)||pendingHours(h,ctx.now)<HMO_PENDING_HOURS||h.followUpTasks.some(t=>t.submissionCycle===h.submissionCycle))continue
      const task={id:`${h.id}:followup:${h.submissionCycle}`,caseId:h.id,submissionCycle:h.submissionCycle,status:'Open',createdAt:ctx.now.timestamp}
      const record={...h,followUpTasks:[...h.followUpTasks,task],escalationStatus:h.status==='Escalated'?'Escalated':'Follow-Up Required'}
      replace(ctx.state,record);changed=true
      publish(ctx,record,`hmo:overdue:${h.id}:${h.submissionCycle}`,'hmo.followup.required','HMO follow-up required','', {staff:true,patient:false,status:'Warning',module:'M14'})
    }
    return {ok:true,...(!changed?{unchanged:true}:{})}
  })
  const followUpHmo=command('hmo.contact','M14',(ctx,id,input={})=>{
    const h=getCase(ctx,id)
    if(!h)return fail('HMO case is outside your scope or has invalid links.')
    if(!input.commandId)return fail('Contact command ID is required.')
    if(h.contacts.some(c=>c.commandId===input.commandId))return {ok:true,unchanged:true,record:h}
    if((ctx.state.hmo||[]).some(other=>other.id!==id&&Array.isArray(other.contacts)&&other.contacts.some(c=>c?.commandId===input.commandId)))return fail('Contact command belongs to another HMO case.')
    if(!pendingHmo(h)||input.submissionCycle!==h.submissionCycle)return fail('Contact must refer to the current pending submission.')
    if(!['Portal','Email','Phone','In person'].includes(input.method)||!clean(input.note)||!clean(input.nextAction))return fail('Record contact method, note/result, and next action.')
    const contact={id:uid('hc'),caseId:id,commandId:input.commandId,submissionCycle:h.submissionCycle,at:ctx.now.timestamp,staffUserId:ctx.session.userId,method:input.method,note:clean(input.note),nextAction:clean(input.nextAction)}
    const record={...h,contacts:[...h.contacts,contact],lastFollowUpAt:ctx.now.timestamp,followUpTasks:h.followUpTasks.map(t=>t.submissionCycle===h.submissionCycle?{...t,status:h.status==='Escalated'?'Escalated':'Contact Recorded'}:t)}
    replace(ctx.state,record)
    publish(ctx,record,`hmo:contact:${input.commandId}`,'hmo.contact.recorded','Staff contact attempt recorded','',{patient:false,module:'M14'})
    return {ok:true,record}
  })
  const escalateHmo=command('hmo.escalate','M14',(ctx,id)=>{
    const h=getCase(ctx,id)
    if(!h)return fail('HMO case is outside your scope or has invalid links.')
    if(h.status==='Escalated')return {ok:true,unchanged:true,record:h}
    if(h.status!=='Pending'||pendingHours(h,ctx.now)<HMO_PENDING_HOURS||!h.contacts.some(c=>c.submissionCycle===h.submissionCycle))return fail('Escalate an overdue pending case after recording a contact attempt.')
    const task=h.followUpTasks.find(t=>t.submissionCycle===h.submissionCycle)||{id:`${id}:followup:${h.submissionCycle}`,caseId:id,submissionCycle:h.submissionCycle,createdAt:ctx.now.timestamp}
    const record={...h,status:'Escalated',escalatedAt:ctx.now.timestamp,escalatedBy:ctx.session.userId,escalationStatus:'Escalated',followUpTasks:[...h.followUpTasks.filter(t=>t.id!==task.id),{...task,status:'Escalated'}]}
    replace(ctx.state,record)
    publish(ctx,record,`hmo:escalated:${id}:${h.submissionCycle}`,'hmo.escalated','HMO escalation needs attention','',{staff:true,patient:false,status:'Warning',module:'M14'})
    return {ok:true,record}
  })
  return {createHmoCase,provideHmoRequirement,submitHmoCase,recordHmoOutcome,evaluateHmoTimers,followUpHmo,escalateHmo}
}
