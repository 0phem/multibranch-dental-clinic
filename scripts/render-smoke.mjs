import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import React from 'react'
import { renderToString } from 'react-dom/server'

const require=createRequire(import.meta.url)
const files=['store.jsx','layout.jsx','clock.js','contracts.js','workflow.js','phase2.js','pages/Dashboards.jsx','pages/Scheduling.jsx','pages/PatientFlow.jsx','pages/Clinical.jsx','pages/FinanceCommunication.jsx','pages/Admin.jsx','data.js']
const result=await build({stdin:{contents:files.map(file=>`export * from './src/${file}';`).join('\n'),resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'shared-react',setup(b){b.onResolve({filter:/^react$/},()=>({path:pathToFileURL(require.resolve('react')).href,external:true}))}}]})
const m=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))
m.setClockSource(()=>new Date('2026-09-19T02:08:00Z'))
let store
function Capture(){store=m.useClinic();return null}
renderToString(React.createElement(m.ClinicProvider,null,React.createElement(Capture)))
const pages={dashboard:'DashboardPage',book:'BookingPage',appointments:'AppointmentsPage',schedule:'SchedulePage',checkin:'CheckInPage',queue:'QueuePage',capacity:'CapacityPage',patients:'PatientsPage',treatment:'TreatmentPage',billing:'BillingPage',hmo:'HmoPage',inquiries:'InquiriesPage',messages:'MessagesPage',prescriptions:'PrescriptionsPage',followups:'FollowupsPage',branches:'BranchesPage',team:'TeamPage',analytics:'AnalyticsPage',users:'UsersPage',automation:'AutomationPage',engagement:'EngagementPage',loyalty:'LoyaltyPage'}
let count=0
function render(page,role='staff',context=null){
  const session=m.sessionForRole(role,store.state)
  const activeBranch=store.state.branches.find(b=>b.id===session.branchId)?.name||'All Branches'
  return renderToString(React.createElement(m.Shell,{role,page,setPage:()=>{},onLogout:()=>{},activeBranch,setActiveBranch:()=>{},resetDemo:()=>{},store:{...store,session}},React.createElement(m[pages[page]],{role,activeBranch,store:{...store,session},context,setPage:()=>{}})))
}
for(const [role,nav] of Object.entries(m.NAV))for(const [page] of nav){render(page,role);count++}
renderToString(React.createElement(m.Login,{onLogin:()=>{}}))
renderToString(React.createElement(m.ModulesPage))
console.log(`PASS: ${count} initial role/page renders, Login, Module Coverage`)

const providerStore=store
let state=store.state
let session=m.sessionForRole('staff',state)
const actions=m.createWorkflowActions({getState:()=>state,getSession:()=>session,clock:m.clinicNow,commit:patch=>{
  state=m.normalizeClinicState({...state,...patch})
  state.patients=state.patients.map(p=>m.patientProjection(p,state.persons.find(person=>person.id===p.personId)))
  store={...store,state,actions}
}})
const patient=actions.createPatientRecord({person:{firstName:'PhaseOne',lastName:'Patient',phone:'0917-audit-new'},patient:{preferredBranchId:'b1',allergies:'None'}})
assert.equal(patient.ok,true,patient.message)
assert.ok(render('patients','staff',{patientId:patient.record.id}).includes('PhaseOne Patient'))
const booking=actions.saveAppointment({patientId:patient.record.id,branchId:'b1',dentistId:'d1',serviceId:'svc1',date:'2026-09-19',start:'12:00'},{commandId:'smoke-book'})
assert.equal(booking.ok,true,booking.message)
assert.ok(render('checkin').includes('PhaseOne Patient'))
const arrival=actions.checkInAppointment(booking.record.id);assert.equal(arrival.ok,true,arrival.message)
assert.equal(actions.checkInAppointment(booking.record.id).unchanged,true)
assert.ok(!render('checkin').includes('PhaseOne Patient'))
assert.ok(render('queue').includes('PhaseOne Patient'))
assert.ok(!render('queue','dentist').includes('Finish queue step'))
session=m.sessionForRole('dentist',state)
assert.equal(actions.updateQueue(arrival.record.id,'Called').ok,true)
assert.ok(render('treatment','dentist',arrival.context).includes('PhaseOne Patient'))
assert.equal(actions.saveTreatment({queueEntryId:arrival.record.id,procedure:'Consultation'}).ok,true)
assert.ok(render('treatment','dentist',arrival.context).includes('Save Treatment Progress'))
assert.equal(actions.completeTreatment({queueEntryId:arrival.record.id,procedure:'Consultation'}).ok,true)
assert.ok(render('treatment','dentist',arrival.context).includes('read-only'))
assert.ok(render('billing').includes('Draft'))
console.log('PASS: created-patient chart, booking/check-in visibility, exact queue treatment, completion, billing renders')

// Phase 2: exercise shared actions, then render the exact role-visible results.
const ownQueue=state.queue.find(q=>q.patientId==='p1'&&q.status==='Waiting')
assert.ok(ownQueue)
assert.equal(actions.updateQueue(ownQueue.id,'Called').ok,true)
assert.equal(actions.saveTreatment({queueEntryId:ownQueue.id,procedures:[]}).ok,true)
const completed=actions.completeTreatment({queueEntryId:ownQueue.id,procedure:'Phase Two completed care',procedures:[{serviceId:'svc1',quantity:1},{serviceId:'svc2',quantity:1}],prescriptionRequired:true,followupRequired:true,followupDate:'2026-09-20',followupReason:'Phase Two return visit'})
assert.equal(completed.ok,true,completed.message)
assert.ok(render('prescriptions','dentist').includes('Phase Two completed care'))
const rx=actions.savePrescription({treatmentId:completed.record.id,items:[{medication:'Phase Two medication',dosage:'Dentist dose',instructions:'Dentist instructions',duration:'Dentist duration'}]})
assert.equal(rx.ok,true,rx.message)
assert.ok(!render('prescriptions','patient').includes('Phase Two medication'))
assert.equal(actions.authorizePrescription({treatmentId:completed.record.id}).ok,true)
assert.ok(render('prescriptions','patient').includes('Phase Two medication'))
assert.ok(render('dashboard','patient').includes('Phase Two completed care'))
assert.ok(render('followups','patient').includes('Phase Two return visit'))
session=m.sessionForRole('staff',state)
const invoice=state.invoices.find(i=>i.treatmentId===completed.record.id)
assert.equal(invoice.total,1800)
assert.ok(!render('billing','patient').includes(invoice.invoiceNo))
assert.equal(actions.reviewInvoice(invoice.id).ok,true)
assert.ok(render('billing').includes('Review'))
assert.ok(!render('billing','patient').includes(invoice.invoiceNo))
assert.equal(actions.issueInvoice(invoice.id).ok,true)
assert.ok(render('billing','patient').includes(invoice.invoiceNo))
const payment=actions.postPayment(invoice.id,'Cash',1800)
assert.equal(payment.ok,true,payment.message)
assert.equal(actions.postPayment(invoice.id,'Cash',1800).unchanged,true)
assert.ok(render('billing','patient').includes(payment.receipt))
assert.ok(!render('billing','patient').includes('Record Payment'))
const followup=state.followups.find(f=>f.treatmentId===completed.record.id)
assert.ok(render('followups','staff').includes('Schedule follow-up'))
const followBooking=actions.saveAppointment({patientId:'p1',branchId:'b1',dentistId:'d1',serviceId:'svc11',date:'2026-09-20',start:'12:00'},{followupId:followup.id})
assert.equal(followBooking.ok,true,followBooking.message)
assert.ok(render('followups','patient').includes('Scheduled'))
console.log('PASS: Phase 2 procedures, prescription draft privacy/authorization, patient care, invoice review/issue/payment/receipt and follow-up scheduling')

// Exercise ClinicProvider's synchronous snapshot with commands issued before any render.
providerStore.setSession('staff')
const quick=providerStore.actions.saveAppointment({patientId:'p1',branchId:'b1',dentistId:'d1',serviceId:'svc1',date:'2026-09-19',start:'16:00'},{commandId:'provider-double'})
assert.equal(quick.ok,true,quick.message)
const check1=providerStore.actions.checkInAppointment(quick.record.id),check2=providerStore.actions.checkInAppointment(quick.record.id)
assert.equal(check1.ok,true);assert.equal(check2.unchanged,true)
console.log('PASS: immediate repeated command integration')

// Reload persisted ID-only records, including an old record missing branch entirely.
const persisted=new Map()
for(const key of ['persons','patients','appointments','queue','treatments','invoices','followups','prescriptions','dentists','staff','checkIns']){
  const storageKey=key==='checkIns'?'check-ins':key
  persisted.set(`dentalops-v4-${storageKey}`,JSON.stringify(m.persistableCollection(key,state[key])))
}
globalThis.localStorage={getItem:key=>persisted.get(key)||null}
renderToString(React.createElement(m.ClinicProvider,null,React.createElement(Capture)))
assert.ok(render('patients','staff',{patientId:patient.record.id}).includes('PhaseOne Patient'))
assert.ok(render('schedule','dentist').includes('Branch A'))
assert.ok(render('appointments').includes('Appointment management'))
render('queue','dentist')
render('dashboard','staff')
render('dashboard','owner')
assert.equal(store.state.appointments.find(a=>a.id===booking.record.id).branchId,'b1')
assert.ok(render('billing','patient').includes(payment.receipt))
assert.ok(render('prescriptions','patient').includes('Phase Two medication'))
delete globalThis.localStorage
console.log('PASS: persisted ID-only records reload and render across appointments, queue, schedule, chart, dashboards')
