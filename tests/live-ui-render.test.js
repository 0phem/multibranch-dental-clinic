import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { withServerAppointments } from './support/server-appointments.js'
import { setClockSource } from '../src/clock.js'

const require=createRequire(import.meta.url)
const files=['data.js','clock.js','contracts.js','safeguards.js','phase3-contracts.js','workflow.js','hmo-presentation.js','patient-ui.jsx','patient-view.js','pages/Scheduling.jsx','pages/FinanceCommunication.jsx','pages/PatientCare.jsx','pages/PatientMe.jsx']
const bundle=await build({stdin:{contents:files.map(file=>`export * from './src/${file}';`).join('\n'),resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'shared-react',setup(build){build.onResolve({filter:/^react$/},()=>({path:pathToFileURL(require.resolve('react')).href,external:true}))}}]})
const m=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
m.setClockSource(()=>new Date('2026-09-19T02:08:00Z'))
// The server-flow helper's dry run uses the unbundled modules, so pin that clock too.
setClockSource(()=>new Date('2026-09-19T02:08:00Z'))

function fixture() {
  const seeds={persons:'PERSONS',patients:'PATIENTS',users:'USERS',branches:'BRANCHES',services:'SERVICES',branchServices:'BRANCH_SERVICES',dentists:'DENTISTS',staff:'STAFF',dentistServiceAssignments:'DENTIST_SERVICE_ASSIGNMENTS'}
  const reference=Object.fromEntries(Object.entries(seeds).map(([key,name])=>[key,structuredClone(m[`INITIAL_${name}`])]))
  let state=m.normalizeClinicState({...reference,appointments:[],queue:[],checkIns:[],treatments:[],invoices:[],followups:[],prescriptions:[],notifications:[],hmo:[],conversations:[],inquiries:[],workflowLog:[],audit:[],bookingDrafts:[]})
  let session=m.sessionForRole('staff',state)
  const raw=m.createWorkflowActions({getState:()=>state,getSession:()=>session,commit:patch=>{state=m.normalizeClinicState({...state,...patch})}})
  // M6 cutover: server appointments; Check-In/No-show/treatment transitions run server-first.
  const server=withServerAppointments({getState:()=>state,setState:next=>{state=m.normalizeClinicState(next)},getSession:()=>session,rawActions:()=>raw})
  return {get actions(){return server.actions()},flow:server.flow,get state(){return state},get session(){return session},role(next){session=m.sessionForRole(next,state)},addInvoice(invoice){state=m.normalizeClinicState({...state,invoices:[...state.invoices,invoice]})}}
}
const ok=result=>{assert.equal(result.ok,true,result.message);return result.record}
const render=(Component,props)=>renderToString(React.createElement(Component,props))

test('live HMO worklist uses scoped cases and detail reveals the three module sections',()=>{
  const f=fixture()
  const appointment=f.flow.book({patientId:'p1',branchId:'b1',dentistId:'d1',serviceId:'svc1',date:'2026-09-19',start:'11:00'})
  const h=ok(f.actions.createHmoCase({appointmentId:appointment.id}))
  const store={state:f.state,session:f.session,actions:f.actions,toast:()=>{}}
  const list=render(m.HmoPage,{role:'staff',store})
  assert.match(list,/HMO Management/)
  assert.match(list,/All Cases/);assert.match(list,/Needs Action/);assert.match(list,/Follow-Ups/)
  // Worklist views are pressed toggle buttons, not a partial tabs pattern; counts stay out of the accessible name.
  assert.doesNotMatch(list,/role="tab/);assert.match(list,/role="group" aria-label="HMO case views"/)
  assert.match(list,/aria-pressed="true"[^>]*>All Cases<span aria-hidden="true">1<\/span>/)
  assert.match(list,/class="hmo-case-row/);assert.match(list,/Maria Santos/)
  assert.doesNotMatch(list,/aria-label="View case for/,'row keeps its visible text as the accessible name')
  assert.doesNotMatch(list,/John Dela Cruz/)
  assert.doesNotMatch(list,/Case Timeline/)
  const detail=render(m.HmoPage,{role:'staff',store,context:{hmoCaseId:h.id}})
  for(const section of ['Patient','HMO Provider','Verification','Request Status','Follow-Up','Case Timeline'])assert.ok(detail.includes(section))
  assert.match(detail,/HMO Card/);assert.match(detail,/Missing Requirements/)
  assert.equal((detail.match(/>HMO Card</g)||[]).length,1,'requirement name renders once in the checklist')
  assert.match(detail,/Validate Locally/);assert.match(detail,/aria-describedby="[^"]*-req-/)
  assert.match(detail,/<h2 tabindex="-1">Maria Santos<\/h2>/)
  assert.doesNotMatch(detail,/Request submitted|Provider Approved response recorded/)
  assert.doesNotMatch(detail,/Last provider response/,'no response is fabricated before one is recorded')
})

test('a Returned case corrected to Ready keeps Returned as the last provider response',()=>{
  const f=fixture()
  const appointment=f.flow.book({patientId:'p1',branchId:'b1',dentistId:'d1',serviceId:'svc1',date:'2026-09-19',start:'11:00'})
  const h=ok(f.actions.createHmoCase({appointmentId:appointment.id}))
  const validate=ruleId=>ok(f.actions.provideHmoRequirement(h.id,ruleId,{fileName:`${ruleId}.pdf`}))
  for(const rule of m.HMO_REQUIREMENT_RULES)validate(rule.id)
  const submitted=ok(f.actions.submitHmoCase(h.id,{commandId:'submit-1',method:'Portal',note:'Submitted externally'}))
  ok(f.actions.recordHmoOutcome(h.id,{commandId:'response-1',caseId:h.id,submissionCycle:submitted.submissionCycle,outcome:'Returned',method:'Email',note:'Provider returned the ID',requirementIds:['valid-id']}))
  assert.equal(m.getHmoAttention(f.state.hmo.find(x=>x.id===h.id)).label,'Returned by provider — correction needed')
  validate('valid-id')
  const corrected=f.state.hmo.find(x=>x.id===h.id)
  assert.equal(corrected.status,'Ready for Submission')
  assert.equal(m.latestProviderResponse(corrected).outcome,'Returned')
  const detail=render(m.HmoPage,{role:'staff',store:{state:f.state,session:f.session,actions:f.actions,toast:()=>{}},context:{hmoCaseId:h.id}})
  assert.match(detail,/Current status: <b>Ready for Submission<\/b>/)
  assert.match(detail,/Last provider response: <b>Returned<\/b>/)
  assert.doesNotMatch(detail,/Outcome: /,'current workflow status is never presented as a provider outcome')
  assert.equal(m.latestProviderResponse({status:'Approved',providerOutcome:'Approved'}),null,'legacy status alone is not response history')
})

test('HMO attention and timeline derive from case state and dated events',()=>{
  const h={id:'case',status:'Missing Requirements',submissionCycle:0,requirements:[{id:'one',label:'HMO Card',state:'Missing'}],followUpTasks:[]}
  assert.equal(m.getHmoAttention(h,{timestamp:'2026-09-19T10:08:00+08:00'}).label,'Missing requirements')
  assert.deepEqual(m.hmoTimeline(h),[])
  const pending={...h,id:'pending',status:'Pending',submissionCycle:1,requirements:[{id:'one',label:'HMO Card',state:'Validated locally'}],submittedAt:'2026-09-19T00:08:00+08:00',contacts:[]}
  assert.equal(m.getHmoAttention(pending,{timestamp:'2026-09-19T13:08:00+08:00'}).label,'Follow-up due')
  assert.equal(m.getHmoAttention(pending,{timestamp:'2026-09-19T02:08:00+08:00'}).label,'Waiting for provider')
  assert.deepEqual(m.hmoTimeline(pending).map(e=>e.label),['Submission recorded'])
  const cases=[h,pending,{...pending,id:'approved',status:'Approved'}]
  const now={timestamp:'2026-09-19T13:08:00+08:00'}
  assert.equal(m.hmoCasesForView(cases,'all',now).length,3)
  assert.deepEqual(m.hmoCasesForView(cases,'action',now).map(c=>c.id),['case','pending'])
  assert.deepEqual(m.hmoCasesForView(cases,'followups',now).map(c=>c.status),['Pending'])
  // A provider return is its own attention state, even when requirements are also missing.
  const returned=m.getHmoAttention({...h,id:'returned',status:'Returned'},now)
  assert.equal(returned.label,'Returned by provider — correction needed');assert.equal(returned.needsAction,true)
})

test('Patient HMO hides operational data while Owner summary counts visible cases',()=>{
  const f=fixture()
  const appointment=f.flow.book({patientId:'p1',branchId:'b1',dentistId:'d1',serviceId:'svc1',date:'2026-09-19',start:'11:00'})
  const h=ok(f.actions.createHmoCase({appointmentId:appointment.id}))
  f.role('patient')
  const patient=render(m.HmoPage,{role:'patient',store:{state:f.state,session:f.session,actions:f.actions,toast:()=>{}}})
  assert.match(patient,/HMO Coverage/);assert.match(patient,/Action required/)
  // Only Patient-provided documents are Patient actions; the clinic-prepared Dentist request is not.
  assert.match(patient,/Missing: (<!-- -->)?HMO Card, Valid ID</)
  assert.doesNotMatch(patient,/Missing: (<!-- -->)?[^<]*Dentist treatment request/)
  assert.match(patient,/The clinic prepares this document/)
  const request=m.hmoCaseView(f.state.hmo.find(x=>x.id===h.id)).requirements.find(r=>r.ruleId==='treatment-request')
  assert.equal(request.clinicSide,true);assert.equal(request.needsAction,false)
  assert.match(m.patientAttention(f.state,f.session).find(i=>i.kind==='hmo').detail,/2 documents to provide/)
  assert.doesNotMatch(patient,/Record Contact Attempt|Escalate Case|Case Timeline|Internal tracking note|John Dela Cruz/)
  f.role('owner')
  const owner=render(m.HmoPage,{role:'owner',store:{state:f.state,session:f.session,actions:f.actions,toast:()=>{}}})
  assert.match(owner,/Cases requiring attention/);assert.match(owner,/Maria Santos/)
  assert.doesNotMatch(owner,/Record Contact Attempt|Record Provider Response|Prepare HMO Case/)
  assert.equal(f.state.hmo.find(x=>x.id===h.id)?.status,'Missing Requirements')
})

test('Owner reaches approved and other cases through a read-only All Cases view',()=>{
  const f=fixture()
  const first=f.flow.book({patientId:'p1',branchId:'b1',dentistId:'d1',serviceId:'svc1',date:'2026-09-19',start:'11:00'})
  const second=f.flow.book({patientId:'p1',branchId:'b1',dentistId:'d1',serviceId:'svc1',date:'2026-09-19',start:'13:00'})
  const approved=ok(f.actions.createHmoCase({appointmentId:first.id})),missing=ok(f.actions.createHmoCase({appointmentId:second.id}))
  for(const rule of m.HMO_REQUIREMENT_RULES)ok(f.actions.provideHmoRequirement(approved.id,rule.id,{fileName:`${rule.id}.pdf`}))
  const submitted=ok(f.actions.submitHmoCase(approved.id,{commandId:'owner-submit',method:'Portal',note:'Submitted externally'}))
  ok(f.actions.recordHmoOutcome(approved.id,{commandId:'owner-response',caseId:approved.id,submissionCycle:submitted.submissionCycle,outcome:'Approved',method:'Phone',note:'Approved by provider'}))
  f.role('owner')
  const store={state:f.state,session:f.session,actions:f.actions,toast:()=>{}}
  const owner=render(m.HmoPage,{role:'owner',store})
  assert.match(owner,/<span>Approved<\/span><b>1<\/b>/,'summary counts the non-attention approved case')
  assert.match(owner,/aria-pressed="true"[^>]*>Needs Attention</);assert.match(owner,/>All Cases<span aria-hidden="true">2<\/span>/)
  assert.equal((owner.match(/class="hmo-case-row/g)||[]).length,1,'attention view lists only the case needing action')
  const visible=m.visibleHmo(f.state,f.session)
  assert.deepEqual(m.hmoCasesForView(visible,'action').map(h=>h.id),[missing.id])
  assert.deepEqual(m.hmoCasesForView(visible,'all').map(h=>h.id).sort(),[approved.id,missing.id].sort())
  const detail=render(m.HmoPage,{role:'owner',store,context:{hmoCaseId:approved.id}})
  assert.match(detail,/Current status: <b>Provider Approved<\/b>/);assert.match(detail,/Last provider response: <b>Approved<\/b>/);assert.match(detail,/Case Timeline/)
  assert.doesNotMatch(detail,/Prepare HMO Case|Check overdue cases|Validate Locally|Record External Submission|Record Resubmission|Record Provider Response|Record Contact Attempt|Escalate Case/)
})

test('HMO Coordinator is a Staff title with branch scoped HMO permission',()=>{
  const f=fixture(), user=f.state.users.find(u=>u.id==='u4')
  assert.equal(user.roleName,'HMO Coordinator')
  const session={role:'staff',userId:user.id,branchId:user.branchId,active:true}
  assert.equal(m.validSession(f.state,session),true)
  assert.equal(m.permitted(f.state,session,'hmo'),true)
  assert.equal(m.visibleHmo(f.state,session).length,0)
  assert.equal(m.validSession(f.state,{...session,role:'HMO Coordinator'}),false)
})

test('the live date and time controls render separate selected and unavailable choices',()=>{
  const dates=render(m.DateStrip,{days:[{date:'2026-09-19',dayLabel:'Today',dayNumber:19,hasOpenings:true},{date:'2026-09-20',dayLabel:'Tomorrow',dayNumber:20,hasOpenings:true},{date:'2026-09-21',dayLabel:'Mon',dayNumber:21,hasOpenings:false}],value:'2026-09-20',onChange:()=>{}})
  assert.equal((dates.match(/class="pt-date-chip(?: is-selected)?"/g)||[]).length,3)
  assert.match(dates,/aria-checked="true"/)
  assert.match(dates,/disabled=""/)
  const slots=render(m.TimeSlotGroup,{legend:'Morning',slots:[{value:'09:00',label:'9:00 AM'},{value:'09:30',label:'9:30 AM'},{value:'10:00',label:'10:00 AM',disabled:true}],value:'09:30',onPick:()=>{}})
  assert.equal((slots.match(/class="pt-time-slot(?: is-selected)?"/g)||[]).length,3)
  assert.match(slots,/class="pt-time-slot is-selected" aria-pressed="true"/)
  assert.match(slots,/disabled=""/)
})

test('live Staff Billing renders compact closed rows and excludes a Branch B invoice',()=>{
  const f=fixture()
  f.addInvoice({...structuredClone(m.INITIAL_INVOICES[0]),id:'branch-a-invoice'})
  f.addInvoice(structuredClone(m.INITIAL_INVOICES[1]))
  const html=render(m.BillingPage,{role:'staff',store:{state:f.state,session:f.session,actions:{},toast:()=>{}}})
  assert.match(html,/class="billing-worklist-row"/)
  assert.match(html,/Maria Santos/)
  assert.doesNotMatch(html,/INV-2026-0002/)
  assert.doesNotMatch(html,/<details[^>]* open/)
  assert.match(html,/class="billing-worklist-detail"/)
})

test('completed payment reaches the live Patient Payments list with a View Receipt action',()=>{
  const f=fixture()
  const appointment=f.flow.book({patientId:'p1',branchId:'b1',dentistId:'d1',serviceId:'svc1',date:'2026-09-19',start:'11:00'})
  const queue=ok(f.actions.checkInAppointment(appointment.id))
  f.role('dentist')
  ok(f.actions.updateQueue(queue.id,'Called'))
  ok(f.actions.saveTreatment({queueEntryId:queue.id}))
  const treatment=ok(f.actions.completeTreatment({queueEntryId:queue.id,procedure:'Dental Consultation',procedures:[{serviceId:'svc1',quantity:1}]}))
  f.role('staff')
  const invoice=f.state.invoices.find(i=>i.treatmentId===treatment.id)
  ok(f.actions.reviewInvoice(invoice.id));ok(f.actions.issueInvoice(invoice.id))
  const payment=ok(f.actions.postPayment(invoice.id,'Cash',invoice.total))
  f.role('patient')
  const html=render(m.BillingPage,{role:'patient',store:{state:f.state,session:f.session,actions:{},toast:()=>{}}})
  assert.match(html,/View Receipt/)
  assert.ok(html.includes(payment.receipt))
  assert.match(html,/Dental Consultation/)
  assert.doesNotMatch(html,/class="pt-receipt"/)
})

test('Patient Profile remains a profile-only page without duplicate account navigation',()=>{
  const f=fixture();f.role('patient')
  const html=render(m.PatientMePage,{store:{state:f.state,session:f.session}})
  assert.match(html,/Profile/)
  assert.doesNotMatch(html,/>More</)
  assert.doesNotMatch(html,/Referral &amp; Loyalty|Receipts &amp; Payments/)
})
