import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import React from 'react'
import { renderToString } from 'react-dom/server'

const require=createRequire(import.meta.url)
const files=['data.js','clock.js','contracts.js','workflow.js','patient-ui.jsx','patient-view.js','pages/Scheduling.jsx','pages/FinanceCommunication.jsx','pages/PatientCare.jsx','pages/PatientMe.jsx']
const bundle=await build({stdin:{contents:files.map(file=>`export * from './src/${file}';`).join('\n'),resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'shared-react',setup(build){build.onResolve({filter:/^react$/},()=>({path:pathToFileURL(require.resolve('react')).href,external:true}))}}]})
const m=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
m.setClockSource(()=>new Date('2026-09-19T02:08:00Z'))

function fixture() {
  const seeds={persons:'PERSONS',patients:'PATIENTS',users:'USERS',branches:'BRANCHES',services:'SERVICES',branchServices:'BRANCH_SERVICES',dentists:'DENTISTS',staff:'STAFF',dentistServiceAssignments:'DENTIST_SERVICE_ASSIGNMENTS'}
  const reference=Object.fromEntries(Object.entries(seeds).map(([key,name])=>[key,structuredClone(m[`INITIAL_${name}`])]))
  let state=m.normalizeClinicState({...reference,appointments:[],queue:[],checkIns:[],treatments:[],invoices:[],followups:[],prescriptions:[],notifications:[],hmo:[],conversations:[],inquiries:[],workflowLog:[],audit:[],bookingDrafts:[]})
  let session=m.sessionForRole('staff',state)
  const actions=m.createWorkflowActions({getState:()=>state,getSession:()=>session,commit:patch=>{state=m.normalizeClinicState({...state,...patch})}})
  return {actions,get state(){return state},get session(){return session},role(next){session=m.sessionForRole(next,state)},addInvoice(invoice){state=m.normalizeClinicState({...state,invoices:[...state.invoices,invoice]})}}
}
const ok=result=>{assert.equal(result.ok,true,result.message);return result.record}
const render=(Component,props)=>renderToString(React.createElement(Component,props))

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
  const appointment=ok(f.actions.saveAppointment({patientId:'p1',branchId:'b1',dentistId:'d1',serviceId:'svc1',date:'2026-09-19',start:'11:00'}))
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
