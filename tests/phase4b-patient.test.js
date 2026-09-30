import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import * as data from '../src/data.js'
import { setClockSource, clinicNow } from '../src/clock.js'
import { normalizeClinicState, sessionForRole } from '../src/contracts.js'
import { createWorkflowActions } from '../src/workflow.js'
import { withServerAppointments, asPatient } from './support/server-appointments.js'
import { notificationDestination } from '../src/phase3-contracts.js'
import * as view from '../src/patient-view.js'
import { mapPatientHmoCase } from '../src/hmo-api.js'

beforeEach(()=>setClockSource(()=>new Date('2026-09-19T02:08:00Z')))

const seedKeys={persons:'PERSONS',services:'SERVICES',branchServices:'BRANCH_SERVICES',dentistServiceAssignments:'DENTIST_SERVICE_ASSIGNMENTS',branches:'BRANCHES',dentists:'DENTISTS',staff:'STAFF',patients:'PATIENTS',users:'USERS',automations:'AUTOMATIONS'}
function fixture(patch={}) {
  const seeds=Object.fromEntries(Object.entries(seedKeys).map(([k,v])=>[k,structuredClone(data[`INITIAL_${v}`])]))
  seeds.users.push({id:'u13',personId:'per-p2',roleName:'Patient',status:'Active',permissions:['patient-portal']})
  seeds.patients=seeds.patients.map(p=>p.id==='p2'?{...p,userId:'u13'}:p)
  let state=normalizeClinicState({...seeds,appointments:[],visits:[],queue:[],treatments:[],invoices:[],prescriptions:[],followups:[],hmo:[],conversations:[],inquiries:[],notifications:[],workflowLog:[],audit:[],...patch})
  let session=sessionForRole('staff',state)
  const raw=createWorkflowActions({getState:()=>state,getSession:()=>session,commit:p=>{state=normalizeClinicState({...state,...p})}})
  // M6/M8 cutovers: server appointments and Visits; Check-In, No-show and treatment transitions run server-first.
  const server=withServerAppointments({getState:()=>state,setState:next=>{state=normalizeClinicState(next)},getSession:()=>session,rawActions:()=>raw})
  return {get actions(){return server.actions()},flow:server.flow,get state(){return state},get session(){return session},role(role,overrides={}){session={...sessionForRole(role,state),...overrides}},patch(p){state=normalizeClinicState({...state,...p})}}
}
const maria=f=>sessionForRole('patient',f.state)
// A GET /api/hmo-cases/mine row (the Patient's server safe subset).
const REQS=[{rule:'hmo-card',label:'HMO Card',state:'Missing'},{rule:'valid-id',label:'Valid ID',state:'Missing'},{rule:'treatment-request',label:'Dentist treatment request',state:'Missing'}]
const patientCase=(fields={})=>({id:'01jhmo0000000000000000000a',status:'Missing Requirements',provider_name:'Insurer One',member_number:'••••0123',visit_date:'2026-09-19',appointment:null,branch:{name:'Branch A'},requirements:REQS,submitted_at:null,final_at:null,approved_amount:null,...fields})
const john=f=>({...sessionForRole('patient',f.state),userId:'u13',patientId:'p2',name:'John Dela Cruz'})
const ok=result=>{assert.equal(result.ok,true,result.message);return result.record}
const form={patientId:'p1',branchId:'b1',dentistId:'d1',serviceId:'svc1',date:'2026-09-19',start:'11:00'}
const book=(f,patch={})=>f.flow.book({...form,...patch})
function checkIn(f,patch={}){const a=book(f,patch);return {a,q:ok(f.actions.checkInAppointment(a.id))}}
function complete(f,patch={}) {
  const {q}=checkIn(f);f.role('dentist');ok(f.actions.updateQueue(q.id,'Called'));ok(f.actions.saveTreatment({queueEntryId:q.id}))
  return ok(f.actions.completeTreatment({queueEntryId:q.id,procedure:'Documented procedure',complaint:'PRIVATE-COMPLAINT',plan:'PRIVATE-PLAN',notes:'PRIVATE-NOTES',procedures:[{serviceId:'svc1',quantity:1},{serviceId:'svc2',quantity:2}],...patch}))
}
const medication={medication:'Test medication',dosage:'1 tablet',instructions:'After meals',duration:'3 days'}
function fullJourney(f) {
  const t=complete(f,{prescriptionRequired:true,followupRequired:true,followupDate:'2026-09-26',followupReason:'Return check'})
  ok(f.actions.savePrescription({treatmentId:t.id,items:[medication]}))
  const draft=f.state.prescriptions.find(r=>r.treatmentId===t.id)
  return {t,draft}
}
function issueInvoice(f,t){f.role('staff');const i=f.state.invoices.find(x=>x.treatmentId===t.id);ok(f.actions.reviewInvoice(i.id));ok(f.actions.issueInvoice(i.id));return f.state.invoices.find(x=>x.id===i.id)}

// ---- Identity, scope and fail-closed behavior ---------------------------------------------------------

test('Patient identity is derived only from the validated session, never from ROLE_INFO',()=>{
  const f=fixture()
  const m=view.patientContext(f.state,maria(f)),j=view.patientContext(f.state,john(f))
  assert.deepEqual([m.patientId,m.firstName],['p1','Maria'])
  assert.deepEqual([j.patientId,j.firstName],['p2','John'])
  const base=maria(f)
  for(const bad of [null,undefined,{},sessionForRole('staff',f.state),sessionForRole('owner',f.state),{...base,patientId:'p2'},{...base,active:false},{...base,userId:'u2'},{...base,userId:'missing'}])
    assert.equal(view.patientContext(f.state,bad),null)
})

test('every Patient selector fails closed for forged, stale and non-Patient sessions',()=>{
  const f=fixture();book(f);checkIn(f,{start:'12:00'})
  const base=maria(f)
  const selectors=[
    s=>view.patientAppointments(f.state,s),s=>view.patientCare(f.state,s),s=>view.patientFollowups(f.state,s),s=>view.patientPrescriptions(f.state,s),
    s=>view.patientInvoices(f.state,s),s=>view.patientHmo(f.state,s),s=>view.patientNotifications(f.state,s),s=>view.patientConversations(f.state,s),s=>view.patientAttention(f.state,s),
  ]
  const nullSelectors=[s=>view.patientHome(f.state,s),s=>view.patientQueueView(f.state,s),s=>view.patientBookingDraft(f.state,s)]
  for(const bad of [null,{},sessionForRole('staff',f.state),{...base,patientId:'p2'},{...base,active:false},{...base,userId:'u13'}]){
    for(const read of selectors)assert.deepEqual(read(bad),[])
    for(const read of nullSelectors)assert.equal(read(bad),null)
  }
  // A Patient account that is deactivated after the session started loses every view.
  f.patch({users:f.state.users.map(u=>u.id==='u12'?{...u,accountStatus:'Inactive',status:'Inactive'}:u)})
  assert.equal(view.patientHome(f.state,base),null)
  assert.deepEqual(view.patientAppointments(f.state,base),[])
})

test('greeting follows the centralized clinic clock',()=>{
  const f=fixture()
  assert.equal(view.patientHome(f.state,maria(f)).greeting,'Good morning')
  setClockSource(()=>new Date('2026-09-19T06:30:00Z'));assert.equal(view.patientHome(f.state,maria(f)).greeting,'Good afternoon')
  setClockSource(()=>new Date('2026-09-19T12:30:00Z'));assert.equal(view.patientHome(f.state,maria(f)).greeting,'Good evening')
})

test('second Patient sees only their own appointments, hero and queue',()=>{
  const f=fixture()
  const a1=book(f),a2=book(f,{patientId:'p2',dentistId:'d2',serviceId:'svc1',start:'12:00'})
  ok(f.actions.checkInAppointment(a1.id));ok(f.actions.checkInAppointment(a2.id))
  assert.deepEqual(view.patientAppointments(f.state,maria(f)).map(a=>a.id),[a1.id])
  assert.deepEqual(view.patientAppointments(f.state,john(f)).map(a=>a.id),[a2.id])
  // Each Patient's store holds only their own server queue state (GET /api/queue/mine).
  const asJohn=asPatient(f.state,'p2'),asMaria=asPatient(f.state,'p1')
  const queueJohn=view.patientQueueView(asJohn,john(f)),queueMaria=view.patientQueueView(asMaria,maria(f))
  assert.equal(queueJohn.dentist,'Patricia Lim');assert.equal(queueMaria.dentist,'Miguel Reyes')
  assert.doesNotMatch(JSON.stringify([queueJohn,view.patientHome(asJohn,john(f))]),/Maria|Miguel|"p1"/)
  assert.doesNotMatch(JSON.stringify([queueMaria,view.patientHome(asMaria,maria(f))]),/John|Patricia|"p2"/)
})

// ---- Journey Hub ------------------------------------------------------------------------------------

test('Journey Hub hero follows queue → today → next → none',()=>{
  const f=fixture()
  assert.equal(view.patientHome(f.state,maria(f)).hero.kind,'none')
  const later=book(f,{date:'2026-09-25'})
  assert.equal(view.patientHome(f.state,maria(f)).hero.kind,'next')
  const today=book(f,{start:'14:00',serviceId:'svc2'})
  const hero=view.patientHome(f.state,maria(f)).hero
  assert.equal(hero.kind,'today');assert.equal(hero.appointment.id,today.id)
  ok(f.actions.checkInAppointment(today.id))
  const live=view.patientHome(asPatient(f.state,'p1'),maria(f)).hero
  assert.equal(live.kind,'queue');assert.equal(live.queue.phase,'waiting')
  assert.ok(later.id)
})

test('a brand-new Patient has a calm empty hub with no fabricated tasks',()=>{
  const f=fixture(),home=view.patientHome(f.state,john(f))
  assert.equal(home.hero.kind,'none');assert.deepEqual(home.attention,[]);assert.deepEqual(home.care,[]);assert.equal(home.hasConversation,false)
})

test('attention items are derived only from real Patient-visible state',()=>{
  const f=fixture(),{t,draft}=fullJourney(f)
  // M12: the Patient's HMO case comes from the server (/api/hmo-cases/mine), never from treatment completion.
  f.patch({hmo:[mapPatientHmoCase(patientCase(),'p1')]})
  // Draft prescription, draft invoice and no conversation yet: only real items exist.
  assert.equal(draft.status,'Draft')
  const kinds=()=>view.patientAttention(f.state,maria(f)).map(i=>i.kind)
  assert.ok(!kinds().includes('prescription'));assert.ok(!kinds().includes('invoice'))
  f.role('dentist');ok(f.actions.authorizePrescription({treatmentId:t.id}))
  issueInvoice(f,t)
  f.patch({conversations:[{id:'c1',patientId:'p1',branchId:'b1',assignedUserId:'u2',participantUserIds:['u12','u2'],unreadUserIds:['u12'],status:'Open',messages:[{id:'m1',senderUserId:'u2',text:'Hello',at:'2026-09-19 10:00'}],readAtByUser:{}}]})
  const items=view.patientAttention(f.state,maria(f))
  assert.deepEqual(items.map(i=>i.kind),['hmo','followup','invoice','prescription','message','notification'])
  for(const item of items){
    assert.ok(item.title&&item.action)
    if(item.page)assert.ok(view.resolveTarget(f.state,maria(f),item.page,item.context),`${item.kind} deep link resolves to a visible record`)
  }
  assert.deepEqual(view.patientAttention(f.state,john(f)),[])
  // Paying the invoice removes the invoice item; reading the thread removes the message item.
  f.role('staff');const invoice=f.state.invoices.find(i=>i.treatmentId===t.id);ok(f.actions.postPayment(invoice.id,'Cash',invoice.total))
  f.role('patient');ok(f.actions.markConversationRead('c1'))
  assert.ok(!kinds().includes('invoice'));assert.ok(!kinds().includes('message'))
})

test('Journey Hub follow-up items and the Follow-Up page share one display state, including cancelled links',()=>{
  const f=fixture(),{t}=fullJourney(f)
  const open=()=>view.patientFollowups(f.state,maria(f)).filter(x=>x.display==='Open').length
  const attention=()=>view.patientAttention(f.state,maria(f)).filter(i=>i.kind==='followup').length
  assert.equal(open(),1);assert.equal(attention(),1)
  // The clinic books a Dentist-requested follow-up as a server appointment and links it (M20 bridge).
  f.role('staff')
  const followup=f.state.followups.find(x=>x.treatmentId===t.id)
  const booked=book(f,{serviceId:'svc11',date:'2026-09-26',start:'12:00'});ok(f.actions.linkFollowupAppointment(followup.id,booked.id))
  assert.equal(open(),0);assert.equal(attention(),0)
  assert.equal(view.patientFollowups(f.state,maria(f))[0].display,'Scheduled')
  ok(f.flow.cancel(booked.id))
  assert.equal(open(),1);assert.equal(attention(),1)
})

test('care summary exposes only the approved Patient-visible subset',()=>{
  const f=fixture();const t=complete(f)
  const [entry]=view.patientCare(f.state,maria(f))
  assert.deepEqual(Object.keys(entry).sort(),['appointmentId','date','dentist','id','procedure','services'])
  assert.deepEqual(entry.services,['Dental Consultation','Oral Prophylaxis']);assert.equal(entry.id,t.id)
  const detail=view.patientVisitDetail(f.state,maria(f),f.state.appointments[0])
  assert.doesNotMatch(JSON.stringify([entry,detail]),/PRIVATE-(COMPLAINT|PLAN|NOTES)/)
  assert.deepEqual(view.patientCare(f.state,john(f)),[]);assert.equal(view.patientVisitDetail(f.state,john(f),f.state.appointments[0]),null)
})

// ---- Appointments -----------------------------------------------------------------------------------

test('appointment actions mirror established behavior and explain admitted visits without inventing policy',()=>{
  const f=fixture(),a=book(f)
  assert.deepEqual(view.appointmentActionState(a),{canReschedule:true,canCancel:true,cancelKind:'normal',reason:''})
  assert.equal(view.appointmentActionState({...a,date:'2026-09-18'}).canCancel,false)
  const admitted=view.appointmentActionState({...a,status:'Checked In'})
  assert.equal(admitted.canReschedule,false);assert.match(admitted.reason,/arrival has been recorded/)
  assert.doesNotMatch(admitted.reason,/hour|minute|late|fee|penalt|deadline|cutoff/i)
  for(const status of ['Completed','Cancelled','No-show'])assert.deepEqual(view.appointmentActionState({...a,status}),{canReschedule:false,canCancel:false,cancelKind:null,reason:''})
})

test('appointment groups place visits in the established tabs',()=>{
  const f=fixture()
  const upcoming=book(f,{date:'2026-09-25'}),cancelled=book(f,{date:'2026-09-26'});ok(f.flow.cancel(cancelled.id))
  const groups=view.appointmentGroups(f.state,maria(f))
  assert.deepEqual(groups.upcoming.map(a=>a.id),[upcoming.id]);assert.deepEqual(groups.cancelled.map(a=>a.id),[cancelled.id]);assert.deepEqual(groups.past,[])
  assert.equal(view.appointmentGroups(f.state,john(f)).upcoming.length,0)
})

test('cancel and reschedule are server commands; the projection reflects the server revision',()=>{
  const f=fixture(),a=book(f)
  assert.equal(a.revision,1);assert.equal(a.server,true)
  // A server reschedule keeps the same id and raises the revision the UI must send with its next command.
  f.patch({appointments:f.state.appointments.map(x=>x.id===a.id?{...x,start:'12:00',revision:2}:x)})
  assert.equal(view.patientAppointments(f.state,maria(f))[0].revision,2)
  f.role('patient');ok(f.flow.cancel(a.id))
  assert.equal(view.appointmentGroups(f.state,maria(f)).cancelled.length,1)
  assert.equal('saveAppointment' in f.actions,false);assert.equal('cancelAppointment' in f.actions,false)
})

// ---- Booking reference data (the server validates every choice) ---------------------------------------------

test('a Dentist whose assignment is revoked or whose account is inactive is not offered',()=>{
  const f=fixture()
  const revoked=f.state.dentistServiceAssignments.map(a=>a.dentistId==='d1'&&a.serviceId==='svc2'?{...a,isAuthorized:false}:a)
  f.patch({dentistServiceAssignments:revoked})
  assert.ok(!view.dentistsFor(f.state,'b1','svc2').some(d=>d.id==='d1'))
  f.patch({users:f.state.users.map(u=>u.id==='u6'?{...u,accountStatus:'Inactive',status:'Inactive'}:u)})
  assert.ok(!view.dentistsFor(f.state,'b1','svc1').some(d=>d.id==='d2'))
})

// ---- Queue privacy ----------------------------------------------------------------------------------

test('queue view exposes only the Patient’s own place and number, with no backend wait estimate (M9 Q5)',()=>{
  const f=fixture()
  const own=checkIn(f),other=checkIn(f,{patientId:'p2',dentistId:'d1',start:'12:00'})
  const view1=view.patientQueueView(asPatient(f.state,'p1'),maria(f))
  assert.deepEqual(Object.keys(view1).sort(),['active','branch','checkedIn','dentist','phase','position','queueNumber','service','start','status','waitMinutes'])
  assert.equal(view1.phase,'waiting');assert.equal(view1.position,1);assert.equal(view1.queueNumber,1);assert.equal(view1.waitMinutes,null)
  assert.equal(view.patientQueueView(asPatient(f.state,'p2'),john(f)).position,2)
  assert.doesNotMatch(JSON.stringify(view1),new RegExp(`John|${other.q.id}|${other.a.id}|p2`))
})

test('queue phases progress from real Staff commands with no meaningless wait after completion',()=>{
  const f=fixture(),{q}=checkIn(f),phase=()=>view.patientQueueView(asPatient(f.state,'p1'),maria(f))
  assert.equal(phase().phase,'waiting');assert.equal(phase().waitMinutes,null)
  ok(f.actions.updateQueue(q.id,'Temporarily Away'));assert.equal(phase().phase,'away');assert.equal(phase().position,null);assert.equal(phase().waitMinutes,null)
  ok(f.actions.updateQueue(q.id,'Waiting'));ok(f.actions.updateQueue(q.id,'Called'))
  assert.equal(phase().phase,'called');assert.equal(phase().waitMinutes,null)
  f.role('dentist');ok(f.actions.saveTreatment({queueEntryId:q.id}))
  assert.equal(phase().phase,'in-treatment');assert.equal(phase().waitMinutes,null);assert.equal(phase().position,null)
  ok(f.actions.completeTreatment({queueEntryId:q.id,procedure:'Documented procedure',procedures:[{serviceId:'svc1',quantity:1}]}))
  // Once the encounter is complete there is no active queue experience any more.
  assert.equal(phase().phase,'none');assert.equal(phase().position,undefined)
})

test('not checked in and no-visit states never invent an arrival rule',()=>{
  const f=fixture()
  assert.deepEqual(view.patientQueueView(f.state,maria(f)),{phase:'none'})
  const a=book(f,{start:'14:00'}),state=view.patientQueueView(f.state,maria(f))
  assert.equal(state.phase,'not-checked-in');assert.equal(state.appointment.id,a.id)
  f.role('staff');ok(f.actions.checkInAppointment(a.id));f.role('staff')
  // One active Visit per Patient (D5): a second appointment the same day cannot be checked in while the first visit is
  // active; if the Patient never comes for it, Staff mark it No-show before arrival (no Visit is created).
  const later=book(f,{start:'16:00',serviceId:'svc2'})
  assert.equal(f.actions.checkInAppointment(later.id).ok,false)
  assert.equal(f.actions.markNoShow(later.id).ok,true)
  assert.equal(f.state.visits.filter(v=>v.patientId===later.patientId).length,1)
  assert.ok(view.patientQueueView(f.state,maria(f)).phase)
})

// ---- Prescriptions, invoices, receipts ----------------------------------------------------------------

test('Draft Prescriptions stay private until the Dentist authorizes them',()=>{
  const f=fixture(),{t,draft}=fullJourney(f)
  assert.equal(draft.status,'Draft')
  assert.deepEqual(view.patientPrescriptions(f.state,maria(f)),[])
  assert.doesNotMatch(JSON.stringify([view.patientAttention(f.state,maria(f)),view.patientNotifications(f.state,maria(f))]),/Test medication/)
  f.role('dentist');ok(f.actions.authorizePrescription({treatmentId:t.id}))
  const [rx]=view.patientPrescriptions(f.state,maria(f))
  assert.equal(rx.status,'Authorized');assert.equal(view.prescriptionView(f.state,rx).items[0].medication,'Test medication')
  assert.deepEqual(view.patientPrescriptions(f.state,john(f)),[])
})

test('invoices appear only when issued with payment evidence and never expose internal payment IDs',()=>{
  const f=fixture(),t=complete(f)
  assert.deepEqual(view.patientInvoices(f.state,maria(f)),[])
  f.role('staff');const draft=f.state.invoices.find(i=>i.treatmentId===t.id);assert.equal(draft.status,'Draft')
  ok(f.actions.reviewInvoice(draft.id));assert.deepEqual(view.patientInvoices(f.state,maria(f)),[])
  ok(f.actions.issueInvoice(draft.id))
  const [issued]=view.patientInvoices(f.state,maria(f));assert.equal(issued.status,'Issued')
  assert.equal(view.invoiceView(f.state,issued).receipt,null)
  const payment=ok(f.actions.postPayment(draft.id,'Electronic',issued.total))
  const [paid]=view.patientInvoices(f.state,maria(f));const shown=view.invoiceView(f.state,paid)
  assert.equal(shown.receipt.number,paid.receipt);assert.equal(shown.receipt.amount,paid.payment.amount);assert.equal(shown.receipt.status,'Completed');assert.equal(shown.receipt.method,'Electronic');assert.equal(shown.receipt.simulated,true);assert.ok(payment)
  assert.equal(shown.items.length,2);assert.deepEqual(Object.keys(shown.items[0]).sort(),['amount','key','name','quantity','unit'])
  assert.ok(!('payment' in shown)&&!('paymentId' in shown),'no separate payment record is exposed')
  assert.ok(!Object.keys(shown.receipt).some(key=>/payment/i.test(key)))
  assert.equal(shown.receipt.number,paid.receipt)
  // Evidence-less Paid state is withheld.
  f.patch({invoices:f.state.invoices.map(i=>i.id===paid.id?{...i,payment:undefined}:i)})
  assert.deepEqual(view.patientInvoices(f.state,maria(f)),[])
  assert.deepEqual(view.patientInvoices(f.state,john(f)),[])
})

// ---- HMO semantics ----------------------------------------------------------------------------------

test('HMO copy keeps local preparation, provider outcome and follow-up distinct',()=>{
  const base={id:'h',providerId:'hmo-medicare',requirements:[{id:'h:a',ruleId:'a',label:'A',state:'Validated locally'},{id:'h:b',ruleId:'b',label:'B',state:'Missing'}]}
  const stage=status=>view.hmoCaseView({...base,status})
  assert.equal(stage('Ready for Submission').label,'Ready for Submission');assert.match(stage('Ready for Submission').stage,/not submitted/)
  assert.match(stage('Pending').stage,/No provider response/)
  assert.equal(stage('Escalated').label,'Escalated');assert.doesNotMatch(stage('Escalated').stage,/approv|reject/i);assert.equal(stage('Escalated').escalated,true)
  assert.equal(stage('Approved').label,'Provider Approved');assert.equal(stage('Rejected').label,'Provider Rejected')
  const historical=view.hmoCaseView({...base,status:'Approved',legacy:true})
  assert.equal(historical.label,'Historical recorded Approved');assert.match(historical.stage,/earlier record/);assert.doesNotMatch(historical.label,/^Provider/)
  const returned=stage('Returned');assert.deepEqual(returned.requirements.map(r=>[r.label,r.returned,r.needsAction]),[['A',false,false],['B',true,true]])
  assert.equal(stage('Pending').canProvide,false);assert.equal(stage('Pending').requirements[1].needsAction,false)
  assert.deepEqual([stage('Pending').checked,stage('Pending').total],[1,2])
})

test('Patient HMO view is limited to the server Patient projection and real provider evidence',()=>{
  const f=fixture()
  const show=fields=>{f.patch({hmo:[mapPatientHmoCase(patientCase(fields),'p1')]});return view.patientHmo(f.state,maria(f))}
  const [pending]=show({status:'Pending',submitted_at:'2026-09-19T09:00:00+08:00',requirements:REQS.map(r=>({...r,state:'Validated'}))})
  assert.equal(view.hmoCaseView(pending).stage.includes('submission'),true)
  const returned=view.hmoCaseView(show({status:'Returned',submitted_at:'2026-09-19T09:00:00+08:00',requirements:REQS.map(r=>({...r,state:r.rule==='valid-id'?'Missing':'Validated'}))})[0])
  assert.equal(returned.label,'Provider Returned');assert.deepEqual(returned.requirements.filter(r=>r.returned).map(r=>r.ruleId),['valid-id'])
  assert.ok(view.patientAttention(f.state,maria(f)).some(i=>i.kind==='hmo'&&i.title.includes('returned')))
  const approved=show({status:'Approved',submitted_at:'2026-09-19T09:00:00+08:00',final_at:'2026-09-19T11:00:00+08:00',approved_amount:'1200.00',requirements:REQS.map(r=>({...r,state:'Validated'}))})
  assert.equal(view.hmoCaseView(approved[0]).label,'Provider Approved');assert.equal(view.hmoCaseView(approved[0]).approvedAmount,'1200.00')
  // The server subset carries no notes, contacts, recorders or history; another Patient sees nothing.
  assert.doesNotMatch(JSON.stringify([approved,view.hmoCaseView(approved[0])]),/INTERNAL-|note|recordedBy|"contacts":\[\{/)
  assert.deepEqual(view.patientHmo(f.state,john(f)),[])
})

// ---- Messages and Notifications -------------------------------------------------------------------------

const thread=(patch={})=>({id:'c1',patientId:'p1',branchId:'b1',assignedUserId:'u2',participantUserIds:['u12','u2'],unreadUserIds:['u12','u2'],status:'Open',messages:[{id:'m1',senderUserId:'u2',text:'Hello Maria',at:'2026-09-19 10:00'},{id:'m2',senderUserId:'u12',text:'Hi',at:'2026-09-19 10:01'}],readAtByUser:{},...patch})

test('Messages honor participant scope and resolve readable names and context',()=>{
  const f=fixture({conversations:[thread({context:'Appointment a1'})]})
  const [c]=view.patientConversations(f.state,maria(f))
  assert.equal(c.title,'Alyssa Cruz');assert.equal(c.role,'Receptionist');assert.equal(c.unread,true);assert.equal(c.canReply,true)
  assert.equal(c.context,'About your care','a raw record ID is never shown');assert.deepEqual(c.messages.map(m=>m.mine),[false,true])
  assert.deepEqual(view.patientConversations(f.state,john(f)),[])
  const link=book(f);f.patch({conversations:[thread({appointmentId:link.id,context:'Appointment inquiry'})]})
  assert.match(view.patientConversations(f.state,maria(f))[0].context,/About your Dental Consultation visit on Sep 19, 2026/)
})

test('non-participant, malformed and closed threads',()=>{
  const f=fixture({conversations:[thread({id:'other',participantUserIds:['u3']}),thread({id:'bad',participantUserIds:'u12'}),thread({id:'closed',status:'Closed'})]})
  assert.deepEqual(view.patientConversations(f.state,maria(f)).map(c=>c.id),['closed'])
  const [closed]=view.patientConversations(f.state,maria(f));assert.equal(closed.canReply,false)
  assert.equal(f.actions.replyToConversation('closed','x','cmd').ok,false)
  assert.equal(view.patientHome(f.state,maria(f)).hasConversation,true)
  assert.equal(view.patientHome(fixture().state,maria(fixture())).hasConversation,false)
})

test('Notification destinations stay revalidated and deep links focus only visible records',()=>{
  const f=fixture(),{t,draft}=fullJourney(f);const session=maria(f)
  const forged={id:'n-forged',commandKey:'k',eventId:'e',eventType:'x',recipientUserId:'u12',recipientRole:'patient',patientId:'p1',entityType:'prescription',entityId:draft.id,action:{page:'prescriptions',context:{}},type:'Prescription Available',title:'x',body:'x',read:false}
  f.patch({notifications:[...f.state.notifications,forged]})
  assert.equal(notificationDestination(f.state,session,forged),null)
  assert.ok(!view.patientAttention(f.state,session).some(i=>i.kind==='prescription'),'a Draft notification creates no attention item')
  assert.equal(view.resolveTarget(f.state,session,'prescriptions',{entityId:draft.id}),null)
  f.role('dentist');ok(f.actions.authorizePrescription({treatmentId:t.id}))
  const rx=f.state.prescriptions.find(r=>r.treatmentId===t.id)
  assert.equal(view.resolveTarget(f.state,session,'prescriptions',{prescriptionId:rx.id}),rx.id)
  assert.equal(view.resolveTarget(f.state,john(f),'prescriptions',{prescriptionId:rx.id}),null)
  const appt=f.state.appointments[0]
  assert.equal(view.resolveTarget(f.state,session,'appointments',{entityId:appt.id}),appt.id)
  assert.equal(view.resolveTarget(f.state,john(f),'appointments',{entityId:appt.id}),null)
  for(const page of ['appointments','prescriptions','billing','followups','hmo','messages'])for(const bad of [null,undefined,'x',{},{entityId:'nope'},{entityId:{}},{hmoCaseId:5}])assert.equal(view.resolveTarget(f.state,session,page,bad),null)
  assert.equal(view.resolveTarget(f.state,{...session,active:false},'appointments',{entityId:appt.id}),null)
})

test('read selectors mutate nothing and create no workflow events',()=>{
  const f=fixture(),{t}=fullJourney(f);f.role('dentist');ok(f.actions.authorizePrescription({treatmentId:t.id}))
  const before=JSON.stringify(f.state)
  for(let i=0;i<3;i++){const s=maria(f);view.patientHome(f.state,s);view.patientAttention(f.state,s);view.patientQueueView(f.state,s);view.patientConversations(f.state,s);view.appointmentGroups(f.state,s);view.patientFollowups(f.state,s);view.patientBookingDraft(f.state,s)}
  assert.equal(JSON.stringify(f.state),before)
})

// ---- Source-level guards for the Patient surfaces ---------------------------------------------------------

const src=file=>readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8')
// Only the dedicated Patient files: PatientFlow.jsx is the shared Staff/Dentist check-in and queue page.
const patientFiles=()=>['patient-view.js','patient-ui.jsx','pages/PatientHome.jsx','pages/PatientVisits.jsx','pages/PatientCare.jsx','pages/PatientMessages.jsx']

test('Patient surfaces exist as dedicated files',()=>{
  for(const file of ['patient-view.js','patient-ui.jsx','patient.css','pages/PatientHome.jsx','pages/PatientVisits.jsx','pages/PatientCare.jsx','pages/PatientMessages.jsx'])assert.ok(existsSync(new URL(`../src/${file}`,import.meta.url)),file)
})

test('Patient surfaces have no artificial delay, native confirm/prompt, raw setter or hardcoded identity',()=>{
  for(const file of patientFiles()){
    const text=src(file)
    assert.doesNotMatch(text,/setTimeout|setInterval/,`${file}: no artificial timers`)
    assert.doesNotMatch(text,/window\.(confirm|prompt|alert)|\b(confirm|prompt|alert)\(/,`${file}: no native dialogs`)
    assert.doesNotMatch(text,/\.setters\b|\bsetters\b|\bset(Loyalty|Campaigns|Appointments|Invoices|Prescriptions|Hmo|Conversations|Notifications|Followups)\b/,`${file}: no raw collection setters`)
    assert.doesNotMatch(text,/ROLE_INFO/,`${file}: identity is session-derived`)
  }
})

test('the shared booking page delegates Patient rendering and the old wizard is gone',()=>{
  const text=src('pages/Scheduling.jsx')
  assert.doesNotMatch(text,/PatientBookingWizard|Finding…|finding-overlay|smartFind/)
  assert.match(text,/PatientBookingPage/);assert.match(text,/PatientAppointmentsPage/)
})

test('Saved Workspace Recovery still preempts every screen',()=>{
  const app=src('App.jsx')
  assert.ok(app.indexOf('Saved workspace needs recovery')>0)
  assert.ok(app.indexOf('Saved workspace needs recovery')<app.indexOf('<Login onLogin'))
  assert.ok(app.indexOf('Saved workspace needs recovery')<app.indexOf('<Shell '))
})

test('Patient sessions still cannot reach the M24/M25 Staff administration route',()=>{
  const guard=src('safeguards.js')
  assert.match(guard,/patient:\[[^\]]*'loyalty'[^\]]*\]/);assert.doesNotMatch(guard.match(/patient:\[[^\]]*\]/)[0],/engagement/)
})
