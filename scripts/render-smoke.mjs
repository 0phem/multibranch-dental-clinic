import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import React from 'react'
import { renderToString } from 'react-dom/server'

const require=createRequire(import.meta.url)
const files=['components.jsx','store.jsx','layout.jsx','clock.js','contracts.js','workflow.js','phase2.js','phase3-contracts.js','orchestration.js','pages/Dashboards.jsx','pages/Scheduling.jsx','pages/PatientFlow.jsx','pages/Clinical.jsx','pages/FinanceCommunication.jsx','pages/Admin.jsx','data.js']
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

// Phase 3 operational flows: no real provider, delivery, or server transport.
const hmoCase=state.hmo.find(h=>h.treatmentId===completed.record.id)
assert.ok(hmoCase)
assert.ok(render('hmo','patient').includes('My HMO Coverage'))
assert.ok(render('hmo','patient').includes('Record Document Metadata'))
for(const requirement of hmoCase.requirements)assert.equal(actions.provideHmoRequirement(hmoCase.id,requirement.ruleId,{fileName:'clinic-document.pdf'}).ok,true)
assert.equal(actions.submitHmoCase(hmoCase.id,{commandId:'smoke-submit',method:'Portal',note:'Internal submission note'}).ok,true)
m.setClockSource(()=>new Date('2026-09-19T15:08:00Z'))
assert.equal(actions.evaluateHmoTimers().ok,true)
const followContact={commandId:'smoke-contact',submissionCycle:1,method:'Phone',note:'Internal contact history',nextAction:'Await provider'}
assert.equal(actions.followUpHmo(hmoCase.id,followContact).ok,true)
assert.equal(actions.escalateHmo(hmoCase.id).ok,true)
assert.ok(render('hmo','staff',{hmoCaseId:hmoCase.id}).includes('Record Provider Response'))
assert.ok(!render('hmo','patient',{hmoCaseId:hmoCase.id}).includes('Internal contact history'))
assert.ok(!render('hmo','patient',{hmoCaseId:hmoCase.id}).includes('Record Provider Response'))
assert.equal(actions.recordHmoOutcome(hmoCase.id,{caseId:hmoCase.id,commandId:'smoke-return',submissionCycle:1,outcome:'Returned',method:'Email',note:'Internal correction request',requirementIds:['valid-id']}).ok,true)
assert.equal(actions.provideHmoRequirement(hmoCase.id,'valid-id',{fileName:'corrected.pdf'}).ok,true)
assert.equal(actions.submitHmoCase(hmoCase.id,{commandId:'smoke-resubmit',method:'Portal',note:'Internal resubmission'}).ok,true)
assert.equal(actions.recordHmoOutcome(hmoCase.id,{caseId:hmoCase.id,commandId:'smoke-approve',submissionCycle:2,outcome:'Approved',method:'Email',note:'Internal recorded outcome'}).ok,true)
assert.ok(render('hmo','patient',{hmoCaseId:hmoCase.id}).includes('Provider Approved'))
const ownNotification=state.notifications.find(n=>n.recipientUserId==='u12'&&n.entityId===hmoCase.id)
session=m.sessionForRole('patient',state)
const dest=m.notificationDestination(state,session,ownNotification)
assert.equal(dest.context.hmoCaseId,hmoCase.id)
assert.equal(actions.markNotificationRead(ownNotification.id).ok,true)
const renderPanel=role=>renderToString(React.createElement(m.NotificationPanel,{role,store:{...store,session:m.sessionForRole(role,state)},setPage:()=>{},onClose:()=>{}}))
assert.ok(renderPanel('patient').includes('View all'))
assert.ok(!renderPanel('dentist').includes('Invoice review needed'))
session=m.sessionForRole('staff',state)
const conversation=state.conversations.find(c=>c.id==='c1')
assert.ok(m.visibleConversations(state,session).some(c=>c.id===conversation.id))
assert.equal(actions.replyToConversation(conversation.id,'Phase Three clinic reply','smoke-reply').ok,true)
assert.ok(render('messages','patient',{conversationId:conversation.id}).includes('Phase Three clinic reply'))
assert.ok(!render('messages','dentist',{conversationId:conversation.id}).includes('Phase Three clinic reply'))
session=m.sessionForRole('patient',state)
assert.equal(actions.markConversationRead(conversation.id).ok,true)
assert.ok(!state.conversations.find(c=>c.id===conversation.id).unreadUserIds.includes('u12'))
session=m.sessionForRole('staff',state)
assert.equal(actions.submitHmoCase(hmoCase.id,{commandId:'invalid-final-state'}).ok,false)
assert.ok(render('automation','owner').includes('hmo.submit'))
const beforeRender=JSON.stringify(state)
for(let repeat=0;repeat<2;repeat++){render('hmo','staff');render('hmo','patient');renderPanel('patient');render('messages','dentist');render('automation','owner')}
assert.equal(JSON.stringify(state),beforeRender)
m.setClockSource(()=>new Date('2026-09-19T02:08:00Z'))
console.log('PASS: Phase 3 HMO correction/resubmission/escalation, Patient privacy, notification navigation/read scope, participant messages, monitor failures, render purity')

// Exercise ClinicProvider's synchronous snapshot with commands issued before any render.
providerStore.setSession('staff')
const quick=providerStore.actions.saveAppointment({patientId:'p1',branchId:'b1',dentistId:'d1',serviceId:'svc1',date:'2026-09-19',start:'16:00'},{commandId:'provider-double'})
assert.equal(quick.ok,true,quick.message)
const check1=providerStore.actions.checkInAppointment(quick.record.id),check2=providerStore.actions.checkInAppointment(quick.record.id)
assert.equal(check1.ok,true);assert.equal(check2.unchanged,true)
console.log('PASS: immediate repeated command integration')

// Reload persisted ID-only records, including an old record missing branch entirely.
const persisted=new Map()
for(const key of ['persons','patients','appointments','queue','treatments','invoices','followups','prescriptions','hmo','notifications','conversations','inquiries','dentists','staff','checkIns']){
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
assert.ok(render('hmo','patient',{hmoCaseId:hmoCase.id}).includes('Provider Approved'))
assert.ok(render('messages','patient',{conversationId:conversation.id}).includes('Phase Three clinic reply'))
delete globalThis.localStorage
console.log('PASS: persisted ID-only records reload and render across appointments, queue, schedule, chart, dashboards')

// Phase 3.5: invalid/current-state recovery surfaces, without changing fixtures on disk.
const recoveryBase=store.state
const recoveryFollow=recoveryBase.followups.find(f=>f.id===followup.id)
store={...store,state:m.normalizeClinicState({...recoveryBase,
  appointments:recoveryBase.appointments.map(a=>a.id===recoveryFollow.appointmentId?{...a,status:'Cancelled'}:a),
  conversations:recoveryBase.conversations.map(c=>c.id===conversation.id?{...c,status:'Closed'}:c),
})}
assert.ok(render('appointments','staff').includes('Cancelled'))
assert.ok(render('followups','staff').includes('Schedule follow-up'))
assert.ok(render('billing','patient').includes(payment.receipt))
assert.ok(render('messages','patient',{conversationId:conversation.id}).includes('Closed'))
assert.ok(!render('treatment','dentist',{queueEntryId:'missing'}).includes('Save Treatment Progress'))
const stalePanel=renderToString(React.createElement(m.NotificationPanel,{role:'patient',store:{...store,session:m.sessionForRole('patient',store.state),state:{...store.state,notifications:[{id:'stale',recipientUserId:'u12',patientId:'p1',title:'Old update',body:'Review availability',entityType:'invoice',entityId:'missing',action:{page:'billing'}}]}},setPage:()=>{},onClose:()=>{}}))
assert.ok(stalePanel.includes('Old update'));assert.ok(!stalePanel.includes('View update'))
store={...store,state:{...store.state,queue:[]}}
// Phase 4B.1 Patient wording: an empty queue renders an explicit no-visit/not-checked-in state (previously "No active queue entry").
assert.ok(/No visit today|haven’t been checked in yet/.test(render('queue','patient')))
store={...store,state:{...store.state,users:store.state.users.map(u=>u.id==='u12'?{...u,accountStatus:'Inactive'}:u)}}
assert.ok(!render('billing','patient').includes(payment.receipt))
store={...store,state:recoveryBase}
console.log('PASS: Phase 3.5 cancelled appointment/follow-up recovery, paid receipt, closed conversation, invalid encounter, stale notification, empty queue and inactive-account privacy')
store={...store,state:{...recoveryBase,patients:[]}}
assert.ok(render('patients','staff').includes('New Patient'))
store={...store,state:recoveryBase}
console.log('PASS: empty patient registry retains the Staff registration recovery action')
assert.ok(render('checkin','staff').includes('Select an appointment to check the patient in.'))
assert.doesNotMatch(render('checkin','staff'),/Confirm arrival<\/button>/)
store={...store,state:{...recoveryBase,hmo:recoveryBase.hmo.map(h=>h.id===hmoCase.id?{...h,contacts:{malformed:true}}:h)}}
assert.ok(render('hmo','staff',{hmoCaseId:hmoCase.id}).includes('need clinic review'))
store={...store,state:recoveryBase}
console.log('PASS: explicit arrival selection and malformed HMO tracking recovery render')

// Phase 4A: shared presentation must preserve semantic controls and role scope.
const ui=component=>renderToString(component)
const field=ui(React.createElement(m.Field,{label:'Visit note',required:true,hint:'Keep the encounter context',error:'Review the current visit'},React.createElement('input',{defaultValue:'Retained draft'})))
assert.match(field,/aria-required="true"/)
assert.match(field,/aria-invalid="true"/)
assert.match(field,/aria-describedby=/)
assert.ok(field.includes('Retained draft'))
assert.match(ui(React.createElement(m.Button,null,'Continue')),/type="button"/)
const records=ui(React.createElement(m.Table,{caption:'Patient appointments',columns:[{key:'name',label:'Patient'},{key:'status',label:'State'}],rows:[{id:'long',name:'A long patient name retained in full',status:'Cancelled'}]}))
assert.ok(records.includes('Patient appointments'))
assert.match(records,/scope="col"/)
assert.ok(records.includes('mobile-cell-label'))
assert.ok(records.includes('A long patient name retained in full'))
assert.match(ui(React.createElement(m.Status,null,'Escalated')),/status attention/)
assert.match(ui(React.createElement(m.Status,null,'Rejected')),/status danger/)
assert.match(ui(React.createElement(m.Status,null,'Validated locally')),/status info/)
const modal=ui(React.createElement(m.Modal,{open:true,title:'Review invoice',onClose:()=>{}},'Exact invoice'))
assert.match(modal,/<dialog/)
assert.match(modal,/aria-labelledby=/)
assert.ok(modal.includes('Close Review invoice'))
assert.ok(render('dashboard','patient').includes('/images/logo.png'))
assert.ok(render('dashboard','owner').includes('Skip to content'))
const staffUser=m.sessionForRole('staff',store.state).userId
const beforeRestricted=store
store={...store,state:{...store.state,users:store.state.users.map(u=>u.id===staffUser?{...u,permissions:u.permissions.filter(p=>p!=='billing')}:u)}}
const restricted=render('dashboard','staff')
assert.ok(!restricted.includes('>Billing &amp; Payments</span>'))
// Inspect the navigation itself rather than unrelated dashboard text.
const navMarkup=restricted.match(/<nav class="main-nav"[\s\S]*?<\/nav>/)?.[0]||''
assert.ok(navMarkup.length)
assert.ok(!navMarkup.includes('Billing'))
store=beforeRestricted
console.log('PASS: Phase 4A shared field/table/dialog semantics, distinct statuses, official logo and permission-filtered navigation')

// Clinic brand alignment: the authoritative visible identity is the text "Dr. Dana E. Roxas" / "Dental Clinic" beside the
// official compact logo, never the old product name. Only rendered text/markup is checked; stable internal identifiers
// (e.g. storage namespaces) are deliberately out of scope.
const clinicName='Dr. Dana E. Roxas',clinicIdentity=`<strong>${clinicName}</strong><span>Dental Clinic</span>`
const loginHtml=renderToString(React.createElement(m.Login,{onLogin:()=>{}}))
assert.ok(loginHtml.includes('src="/images/logo.png"'),'login uses the official compact logo')
assert.ok(loginHtml.includes(clinicIdentity),'login shows the exact clinic identity as real text')
const brandedHtml=[loginHtml]
for(const [role,nav] of Object.entries(m.NAV)){
  for(const [page] of nav)brandedHtml.push(render(page,role))
  const shell=render('dashboard',role)
  assert.ok(shell.includes('src="/images/logo.png"'),`${role} shell uses the compact official logo`)
  assert.ok(shell.includes(clinicIdentity),`${role} shell shows the clinic name with Dental Clinic subtitle`)
}
for(const html of brandedHtml)assert.ok(!/dentalops/i.test(html),'no user-facing render still uses the old product name')
// Every image the UI references must exist. logo-with-name.png is a supplied asset that is deliberately not rendered.
for(const file of new Set(brandedHtml.flatMap(html=>[...html.matchAll(/src="(\/images\/[^"]+)"/g)].map(x=>x[1])))){
  assert.ok(existsSync(`public${file}`),`${file} exists in public/`)
  assert.equal(readFileSync(`public${file}`).subarray(0,8).toString('hex'),'89504e470d0a1a0a',`${file} is a PNG`)
}
// The official artwork must never be altered. Update these hashes only when the client supplies a replacement asset.
const assetSha256={'public/images/logo.png':'9ffca1383e222e1e6b04068b8026212f1c0f7619ec441201aec0a684752c8e5e','public/images/logo-with-name.png':'dffe98c29e6acd00b3970fe4246824943ab2057b70e547dbec1e7ab00c2f068b'}
for(const [file,hash] of Object.entries(assetSha256)){
  assert.ok(existsSync(file),`${file} exists as a supplied clinic asset`)
  assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),hash,`${file} must remain unmodified`)
}
// Copy that only renders after interaction (Assistant panel, export filenames) is checked at source. Presentation files
// hold no stable internal identifiers; storage namespaces live in store.jsx/persistence.js, which are intentionally not scanned.
for(const file of ['App.jsx','layout.jsx','components.jsx',...readdirSync('src/pages').map(name=>`pages/${name}`)])
  assert.ok(!/dentalops/i.test(readFileSync(`src/${file}`,'utf8')),`src/${file} still contains the old product name`)
const documentTitle=readFileSync('index.html','utf8').match(/<title>([^<]*)<\/title>/)?.[1]
assert.equal(documentTitle,`${clinicName} Dental Clinic`)
console.log('PASS: clinic brand alignment — compact logo with exact clinic text on login and every role shell, unmodified official assets, document title and no old product name in the UI')

// Phase 4B.1 Patient core experience: real Patient pages rendered from state built through real commands.
store={...store,state}
const patientPages=m.NAV.patient.map(([page])=>page)
const mainOf=html=>html.match(/<main id="main-content"[\s\S]*?<\/main>/)?.[0]||''
const staffControls=['Record Payment','Review Invoice','Issue Invoice','Confirm arrival','Call patient','Prepare HMO Case','Record Provider Response','Authorize Prescription','Emergency priority','Mark resolved']
for(const page of patientPages){
  const html=render(page,'patient'),main=mainOf(html)
  assert.equal((main.match(/<h1[\s>]/g)||[]).length,1,`${page}: exactly one h1`)
  for(const control of staffControls)assert.ok(!html.includes(control),`${page}: no Staff control ${control}`)
  assert.ok(!html.includes('assistant-fab'),`${page}: the Patient assistant never floats over content`)
  assert.ok(html.includes('id="clinic-assistant-toggle"')&&html.includes('aria-controls="clinic-assistant-panel"')&&html.includes('aria-expanded="false"'),`${page}: the Patient assistant trigger lives in the top bar`)
  assert.ok(!html.includes('PhaseOne'),`${page}: no other Patient's data`)
  for(const tag of main.match(/<button\b[^>]*>/g)||[])assert.ok(/\stype="/.test(tag),`${page}: button declares a type ${tag}`)
}
const home=render('dashboard','patient')
assert.ok(/Good (morning|afternoon|evening), Maria/.test(home))
for(const text of ['Needs your attention','Recent care','Phase Two completed care','Quick access'])assert.ok(home.includes(text),text)
assert.ok(!/keep this page updated|Recent notifications/.test(home))
assert.ok(home.includes('Care &amp; coverage')&&home.includes('Visits'))
const upcomingVisit=state.appointments.find(a=>a.id===followBooking.record.id)
const visit=state.appointments.find(a=>a.id===ownQueue.appointmentId)
const appts=render('appointments','patient')
assert.ok(appts.includes('Reschedule')&&appts.includes('Cancel appointment')&&appts.includes('aria-pressed'))
const past=render('appointments','patient',{entityId:visit.id})
assert.ok(past.includes('Visit details')&&past.includes('is-target')&&past.includes('Phase Two completed care'))
assert.ok(!past.includes('Rescheduled')&&!render('appointments','patient',{entityId:'nope'}).includes('is-target'))
assert.ok(render('appointments','patient',{entityId:upcomingVisit.id}).includes('is-target'))
const rxRecord=state.prescriptions.find(r=>r.status==='Authorized')
assert.ok(render('prescriptions','patient',{entityId:rxRecord.id}).includes('is-target'))
assert.ok(!render('prescriptions','patient',{entityId:'other'}).includes('is-target'))
assert.ok(!/Renew|Reissue|Edit prescription/.test(render('prescriptions','patient')))
const bill=render('billing','patient',{invoiceId:invoice.id})
assert.ok(bill.includes('is-target')&&bill.includes(payment.receipt)&&bill.includes('Total')&&bill.includes('The clinic records payments'))
assert.ok(!/>Pay</.test(bill)&&!/Payment pay-/.test(bill))
assert.ok(render('followups','patient',{entityId:followup.id}).includes('is-target'))
const hmoPage=render('hmo','patient',{hmoCaseId:hmoCase.id})
assert.ok(hmoPage.includes('is-target')&&hmoPage.includes('Provider Approved')&&hmoPage.includes('is not approval from your HMO'))
assert.ok(!/Internal|Record Provider Response/.test(hmoPage))
const bookPage=render('book','patient')
for(const text of ['class="pt-stepper"','aria-current="step"','type="radio"','<fieldset','Step 1 of 5'])assert.ok(bookPage.includes(text),text)
assert.ok(!/Any available|Finding|Smart Scheduling validation/.test(bookPage))
const doneQueue=render('queue','patient')
assert.ok(doneQueue.includes('Your visit is complete.')&&!/0 min|updates automatically/.test(doneQueue))
assert.ok(/Unread: /.test(renderPanel('patient')))
// A live queue entry, built by the real Staff check-in command.
m.setClockSource(()=>new Date('2026-09-19T02:08:00Z'))
session=m.sessionForRole('staff',state)
const liveVisit=actions.saveAppointment({patientId:'p1',branchId:'b1',dentistId:'d2',serviceId:'svc1',date:'2026-09-19',start:'16:30'},{commandId:'p4b-live'})
assert.equal(liveVisit.ok,true,liveVisit.message)
assert.equal(actions.checkInAppointment(liveVisit.record.id).ok,true)
store={...store,state}
const liveQueue=render('queue','patient')
assert.ok(liveQueue.includes('in line')&&liveQueue.includes('aria-live="polite"')&&liveQueue.includes('Estimated wait')&&!liveQueue.includes('PhaseOne'))
assert.ok(render('dashboard','patient').includes('You’re checked in.')&&render('dashboard','patient').includes('View live queue'))
m.setClockSource(()=>new Date('2026-09-19T15:08:00Z'))
// Messages: participant conversations only, and never a control that promises Patient-started messages.
const messages=render('messages','patient')
assert.ok(messages.includes('Conversations')&&messages.includes('Select a conversation'))
assert.ok(!/Start (a )?(new )?(conversation|message)|New message/i.test(messages))
const threadPage=render('messages','patient',{conversationId:conversation.id})
assert.ok(threadPage.includes('has-thread')&&threadPage.includes('Send message')&&threadPage.includes('All conversations'))
const withState=patch=>{store={...store,state:{...store.state,...patch}}}
const fullState=store.state
withState({conversations:store.state.conversations.map(c=>({...c,status:'Closed'}))})
const closedThread=render('messages','patient',{conversationId:conversation.id})
assert.ok(closedThread.includes('This conversation is closed')&&!closedThread.includes('<textarea'))
withState({conversations:[]})
assert.ok(render('messages','patient').includes('No messages from the clinic yet.'))
const quietHome=render('dashboard','patient')
assert.ok(!quietHome.includes('Message the clinic')&&!quietHome.includes('Your conversations'))
store={...store,state:fullState}
// Invalid or stale Patient session: every Patient page fails closed instead of showing another identity.
withState({users:fullState.users.map(u=>u.id==='u12'?{...u,accountStatus:'Inactive',status:'Inactive'}:u)})
for(const page of ['dashboard','book','appointments','queue','prescriptions','followups','hmo','billing','messages']){
  const html=render(page,'patient')
  assert.ok(html.includes('couldn’t confirm your account'),`${page}: fails closed for an inactive account`)
  assert.ok(!html.includes('Phase Two')&&!html.includes(payment.receipt),`${page}: exposes nothing`)
}
store={...store,state:fullState}
// The other roles keep the shell's floating assistant button unchanged.
for(const role of ['staff','dentist','owner']){const html=render('dashboard',role);assert.ok(html.includes('assistant-fab')&&!html.includes('clinic-assistant-toggle'),`${role}: floating assistant unchanged`)}
console.log('PASS: Phase 4B.1 Patient Journey Hub, booking semantics, appointments, live queue, care records, HMO, receipts, Messages, deep links, isolation and fail-closed sessions')
