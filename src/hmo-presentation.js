import { HMO_PENDING_HOURS, pendingHmo, pendingHours } from './phase3-contracts.js'

// Presentation only. The case and its current submission cycle remain the source of truth.
export function getHmoAttention(h, now) {
  const missing=(Array.isArray(h.requirements)?h.requirements:[]).some(r=>r?.state!=='Validated locally')
  const currentTasks=(Array.isArray(h.followUpTasks)?h.followUpTasks:[]).filter(t=>t?.submissionCycle===h.submissionCycle&&t.status!=='Resolved')
  const elapsed=pendingHmo(h)&&h.submittedAt?pendingHours(h,now):null
  const due=elapsed!==null&&elapsed>=HMO_PENDING_HOURS
  if(h.status==='Approved')return {label:'Approved',needsAction:false,followUp:false,elapsed}
  if(h.status==='Rejected')return {label:'Rejected',needsAction:false,followUp:false,elapsed}
  // A provider return is a provider response, not merely local preparation, so it is classified first.
  if(h.status==='Returned')return {label:'Returned by provider — correction needed',needsAction:true,followUp:false,elapsed}
  if(missing)return {label:'Missing requirements',needsAction:true,followUp:false,elapsed}
  if(h.status==='Ready for Submission')return {label:'Ready for submission',needsAction:true,followUp:false,elapsed}
  if(h.status==='Escalated')return {label:'Escalated',needsAction:true,followUp:true,elapsed}
  if(pendingHmo(h))return {label:due||currentTasks.length?'Follow-up due':'Waiting for provider',needsAction:!!(due||currentTasks.length),followUp:!!(due||currentTasks.length),elapsed}
  return {label:h.status||'Needs review',needsAction:false,followUp:false,elapsed}
}

// Latest externally received provider response from the append-only history; never derived from case status.
export function latestProviderResponse(h) {
  return (Array.isArray(h?.responses)?h.responses:[]).filter(r=>r&&['Approved','Rejected','Returned'].includes(r.outcome)).at(-1)||null
}

export function hmoCasesForView(cases, view, now) {
  if(view==='action')return cases.filter(h=>getHmoAttention(h,now).needsAction)
  if(view==='followups')return cases.filter(h=>getHmoAttention(h,now).followUp)
  return cases
}

export function hmoTimeline(h) {
  const events=[]
  const rows=value=>Array.isArray(value)?value:[]
  if(h.createdAt)events.push({key:'created',at:h.createdAt,label:'Case created'})
  for(const r of rows(h.requirements))if(r?.validatedAt)events.push({key:`validated:${r.id}`,at:r.validatedAt,label:`${r.label} checked locally`})
  for(const s of rows(h.submissionHistory))if(s?.at)events.push({key:`submitted:${s.cycle}`,at:s.at,label:s.cycle>1?'Request resubmitted':'Request submitted'})
  if(h.submittedAt&&!events.some(e=>e.key.startsWith('submitted:')))events.push({key:'submitted',at:h.submittedAt,label:'Submission recorded'})
  for(const c of rows(h.contacts))if(c?.at)events.push({key:`contact:${c.id}`,at:c.at,label:'Clinic contact recorded'})
  if(h.escalatedAt)events.push({key:'escalated',at:h.escalatedAt,label:'Case escalated'})
  for(const r of rows(h.responses))if(r?.recordedAt)events.push({key:`response:${r.id}`,at:r.recordedAt,label:`Provider ${r.outcome} response recorded`})
  if(h.providerRespondedAt&&!events.some(e=>e.key.startsWith('response:')))events.push({key:'response',at:h.providerRespondedAt,label:`Historical ${h.status} outcome recorded`})
  return events.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))
}
