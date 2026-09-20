import test from 'node:test'
import assert from 'node:assert/strict'
import * as data from '../src/data.js'
import { setClockSource } from '../src/clock.js'
import { normalizeClinicState, sessionForRole, persistableCollection } from '../src/contracts.js'
import { createWorkflowActions } from '../src/workflow.js'
import { visibleInvoices, visiblePrescriptions, prescriptionTasks } from '../src/phase2.js'

setClockSource(()=>new Date('2026-09-19T02:08:00Z'))
const seedKeys={persons:'PERSONS',services:'SERVICES',branchServices:'BRANCH_SERVICES',dentistServiceAssignments:'DENTIST_SERVICE_ASSIGNMENTS',branches:'BRANCHES',dentists:'DENTISTS',staff:'STAFF',patients:'PATIENTS',users:'USERS'}
function fixture(){
  let state=normalizeClinicState({...Object.fromEntries(Object.entries(seedKeys).map(([k,v])=>[k,structuredClone(data[`INITIAL_${v}`])])),appointments:[],queue:[],checkIns:[],treatments:[],invoices:[],followups:[],prescriptions:[],notifications:[],workflowLog:[],audit:[]})
  let session=sessionForRole('staff',state)
  const actions=createWorkflowActions({getState:()=>state,getSession:()=>session,commit:patch=>{state=normalizeClinicState({...state,...patch})}})
  return {actions,get state(){return state},get session(){return session},role(role,patch={}){session={...sessionForRole(role,state),...patch}},patch(patch){state=normalizeClinicState({...state,...patch})}}
}
const form={patientId:'p1',branchId:'b1',dentistId:'d1',serviceId:'svc1',date:'2026-09-19',start:'11:00'}
const lines=[{serviceId:'svc1',quantity:1},{serviceId:'svc2',quantity:2,notes:'Performed cleaning'}]
function ok(result){assert.equal(result.ok,true,result.message);return result.record}
function encounter(f){
  const a=ok(f.actions.saveAppointment(form));const q=ok(f.actions.checkInAppointment(a.id));f.role('dentist');ok(f.actions.updateQueue(q.id,'Called'));ok(f.actions.saveTreatment({queueEntryId:q.id}));return q
}
function complete(f,patch={}){const q=encounter(f);return ok(f.actions.completeTreatment({queueEntryId:q.id,procedure:'Consultation and cleaning',procedures:lines,...patch}))}
function issue(f){f.role('staff');const i=f.state.invoices[0];ok(f.actions.reviewInvoice(i.id));ok(f.actions.issueInvoice(i.id));return f.state.invoices[0]}
const medication={medication:'Dentist-entered medication',dosage:'Dentist-entered dose',instructions:'Dentist-entered frequency',duration:'Dentist-entered duration'}

test('multiple actual procedures and configured fees produce linked itemized invoice',()=>{
  const f=fixture();const t=complete(f);const i=f.state.invoices[0]
  assert.equal(t.requestedServiceId,'svc1');assert.deepEqual(i.items.map(x=>x.serviceId),['svc1','svc2']);assert.equal(i.total,3000);assert.equal(i.subtotal,3000)
  for(const item of i.items){assert.equal(item.invoiceId,i.id);assert.equal(item.treatmentId,t.id);assert.ok(t.procedures.some(p=>p.id===item.procedureId));assert.equal('name' in item,false)}
})
test('branch configured fee overrides are used; supplied line amounts are ignored',()=>{
  const f=fixture();f.patch({branchServices:f.state.branchServices.map(b=>b.branchId==='b1'&&b.serviceId==='svc2'?{...b,feeOverride:1234.56}:b)})
  complete(f,{procedures:[{serviceId:'svc2',quantity:2,unitFee:1,amount:1}]});assert.equal(f.state.invoices[0].total,2469.12)
})
test('repeat completion preserves exact invoice, item IDs, follow-up and event counts',()=>{
  const f=fixture();const t=complete(f,{prescriptionRequired:true,followupRequired:true});const before=structuredClone(f.state)
  assert.equal(f.actions.completeTreatment({id:t.id,queueEntryId:t.queueEntryId}).unchanged,true)
  for(const key of ['invoices','followups','workflowLog','audit','notifications','prescriptions'])assert.deepEqual(f.state[key],before[key])
  assert.equal(f.state.followups.length,1);assert.equal(prescriptionTasks(f.state,f.session).length,1)
})
test('save draft creates no invoice, prescription task or follow-up and does not close encounter',()=>{
  const f=fixture();const q=encounter(f);ok(f.actions.saveTreatment({queueEntryId:q.id,procedure:'Draft',procedures:lines,prescriptionRequired:true,followupRequired:true}))
  assert.equal(f.state.invoices.length,0);assert.equal(f.state.followups.length,0);assert.equal(prescriptionTasks(f.state,f.session).length,0);assert.equal(f.state.queue[0].status,'In Treatment');assert.equal(f.state.appointments[0].status,'In Treatment')
})
test('no clinical requests means no prescription task and no follow-up',()=>{const f=fixture();complete(f);assert.equal(prescriptionTasks(f.state,f.session).length,0);assert.equal(f.state.prescriptions.length,0);assert.equal(f.state.followups.length,0)})
for(const procedures of [[],[{serviceId:'missing',quantity:1}],[{serviceId:'svc2',quantity:0}],[{serviceId:'svc2',quantity:1.5}],[{serviceId:'svc6',quantity:1}],[{serviceId:'svc2',quantity:1,treatmentId:'other'}]])test(`invalid procedure rejected atomically: ${JSON.stringify(procedures)}`,()=>{
  const f=fixture();const q=encounter(f);const before=structuredClone(f.state);assert.equal(f.actions.completeTreatment({queueEntryId:q.id,procedure:'Documented',procedures}).ok,false);assert.deepEqual(f.state,before)
})
for(const role of ['staff','patient','owner'])test(`${role} cannot make treatment or prescription decisions`,()=>{
  const f=fixture();const t=complete(f,{prescriptionRequired:true});f.role(role)
  assert.equal(f.actions.saveTreatment({queueEntryId:t.queueEntryId,procedures:lines}).ok,false)
  assert.equal(f.actions.authorizePrescription({treatmentId:t.id,items:[medication]}).ok,false)
})
test('prescription drafts remain private; authorization retains exact IDs and audit',()=>{
  const f=fixture();const t=complete(f,{prescriptionRequired:true});const rx=ok(f.actions.savePrescription({treatmentId:t.id,items:[medication]}))
  assert.equal(rx.patientId,t.patientId);assert.equal(rx.dentistId,t.dentistId);assert.equal(rx.treatmentId,t.id);assert.equal(rx.items[0].prescriptionId,rx.id)
  assert.equal(prescriptionTasks(f.state,f.session).length,1)
  f.role('patient');assert.equal(visiblePrescriptions(f.state,f.session).length,0)
  f.role('dentist');const authorized=ok(f.actions.authorizePrescription({treatmentId:t.id,items:[medication]}));assert.equal(authorized.authorizedBy,'u3');assert.ok(authorized.authorizedAt)
  assert.equal(prescriptionTasks(f.state,f.session).length,0);const events=f.state.workflowLog.length
  assert.equal(f.actions.authorizePrescription({treatmentId:t.id,items:[medication]}).unchanged,true);assert.equal(f.state.prescriptions.length,1);assert.equal(f.state.workflowLog.length,events)
  f.role('patient');assert.equal(visiblePrescriptions(f.state,f.session).length,1)
  f.role('patient',{patientId:'p2'});assert.equal(visiblePrescriptions(f.state,f.session).length,0)
})
test('other dentist cannot authorize prescription and forged patient context fails',()=>{
  const f=fixture();const t=complete(f,{prescriptionRequired:true});assert.equal(f.actions.authorizePrescription({treatmentId:t.id,patientId:'p2',items:[medication]}).ok,false)
  f.role('dentist',{dentistId:'d2',userId:'u6'});assert.equal(f.actions.authorizePrescription({treatmentId:t.id,items:[medication]}).ok,false)
})
test('authorization requires explicit request and complete medication details',()=>{
  const f=fixture();const t=complete(f);assert.equal(f.actions.authorizePrescription({treatmentId:t.id,items:[medication]}).ok,false)
  const g=fixture();const requested=complete(g,{prescriptionRequired:true});for(const items of [[],[{}],[{...medication,dosage:''}]])assert.equal(g.actions.authorizePrescription({treatmentId:requested.id,items}).ok,false)
})
test('malformed legacy prescription cannot be authorized or shown to wrong patient',()=>{
  const f=fixture();const t=complete(f,{prescriptionRequired:true});f.patch({prescriptions:[{id:'bad',treatmentId:t.id,patientId:'p2',dentistId:t.dentistId,status:'Authorized'}]})
  assert.equal(f.actions.authorizePrescription({treatmentId:t.id,items:[medication]}).ok,false);f.role('patient',{patientId:'p2'});assert.equal(visiblePrescriptions(f.state,f.session).length,0)
})
test('invoice review is separate from issuance; repeat issuance does not duplicate events',()=>{
  const f=fixture();complete(f);f.role('staff');const i=f.state.invoices[0]
  assert.equal(f.actions.issueInvoice(i.id).ok,false);ok(f.actions.reviewInvoice(i.id));assert.equal(f.state.invoices[0].status,'Review')
  f.role('patient');assert.equal(visibleInvoices(f.state,f.session).length,0)
  f.role('staff');ok(f.actions.issueInvoice(i.id));const events=f.state.workflowLog.length;assert.equal(f.actions.issueInvoice(i.id).unchanged,true);assert.equal(f.state.workflowLog.length,events)
  assert.equal(f.actions.reviewInvoice(i.id).ok,false)
})
for(const amount of [undefined,0,-1,NaN,Infinity,1,3000.001])test(`invalid full payment amount ${amount} is rejected`,()=>{
  const f=fixture();complete(f);const i=issue(f);assert.equal(f.actions.postPayment(i.id,'Cash',amount).ok,false);assert.equal(f.state.invoices[0].status,'Issued');assert.equal(f.state.invoices[0].payment,undefined)
})
test('payment only accepts issued valid invoices and supported methods',()=>{
  const f=fixture();complete(f);f.role('staff');const i=f.state.invoices[0];assert.equal(f.actions.postPayment(i.id,'Cash',i.total).ok,false);issue(f)
  assert.equal(f.actions.postPayment(i.id,'Unknown',i.total).ok,false)
  f.patch({invoices:[{...f.state.invoices[0],total:1}]});assert.equal(f.actions.postPayment(i.id,'Cash',1).ok,false)
})
for(const method of ['Cash','Card','Electronic'])test(`${method} payment and receipt retain exact relationships and are idempotent`,()=>{
  const f=fixture();const t=complete(f);const i=issue(f);const paid=ok(f.actions.postPayment(i.id,method,i.total));assert.equal(paid.status,'Paid');assert.equal(paid.paymentStatus,'Paid');assert.equal(paid.payment.invoiceId,i.id);assert.equal(paid.payment.patientId,t.patientId);assert.equal(paid.payment.receipt,paid.receipt);assert.equal(paid.payment.simulation,method!=='Cash')
  const events=f.state.workflowLog.length;assert.equal(f.actions.postPayment(i.id,method,i.total).unchanged,true);assert.equal(f.state.workflowLog.length,events);assert.equal(f.state.invoices.length,1)
  f.role('patient');assert.equal(visibleInvoices(f.state,f.session)[0].receipt,paid.receipt)
  f.role('patient',{patientId:'p2'});assert.equal(visibleInvoices(f.state,f.session).length,0)
})
for(const role of ['patient','dentist','owner'])test(`${role} cannot issue invoices or record payment`,()=>{
  const f=fixture();complete(f);const i=issue(f);f.role(role);assert.equal(f.actions.reviewInvoice(i.id).ok,false);assert.equal(f.actions.issueInvoice(i.id).ok,false);assert.equal(f.actions.postPayment(i.id,'Cash',i.total).ok,false)
})
test('follow-up preserves exact treatment; scheduling, reschedule, cancellation and completion synchronize',()=>{
  const f=fixture();const t=complete(f,{followupRequired:true,followupReason:'Review healing',followupDate:'2026-09-20'});const follow=f.state.followups[0]
  assert.equal(follow.treatmentId,t.id);assert.equal(follow.patientId,t.patientId);assert.equal(follow.dentistId,t.dentistId)
  f.role('staff');const a=ok(f.actions.saveAppointment({...form,start:'13:00'},{followupId:follow.id}));assert.equal(f.state.followups[0].status,'Scheduled');assert.equal(f.state.followups[0].appointmentId,a.id)
  const moved=ok(f.actions.saveAppointment({...form,start:'14:00'},{appointmentId:a.id}));assert.equal(moved.id,a.id);assert.equal(f.state.followups[0].appointmentId,a.id)
  ok(f.actions.cancelAppointment(a.id));assert.equal(f.state.followups[0].status,'Open');assert.equal(f.state.followups[0].appointmentId,null)
  const replacement=ok(f.actions.saveAppointment({...form,start:'15:00'},{followupId:follow.id}));assert.notEqual(replacement.id,a.id)
  const q=ok(f.actions.checkInAppointment(replacement.id));f.role('dentist');ok(f.actions.updateQueue(q.id,'Called'));ok(f.actions.saveTreatment({queueEntryId:q.id}));ok(f.actions.completeTreatment({queueEntryId:q.id,procedure:'Review completed',procedures:[lines[0]]}));assert.equal(f.state.followups[0].status,'Completed');assert.equal(f.state.followups[0].appointmentId,replacement.id)
})
for(const [label,patch] of [['missing patient',{patientId:'missing'}],['wrong branch',{branchId:'b2'}],['wrong dentist',{dentistId:'d2'}],['missing service',{serviceId:'bad'}],['past date',{date:'2026-09-18'}],['past time',{start:'09:00'}],['operating hours',{start:'20:00'}],['capability',{serviceId:'svc6'}]])test(`follow-up booking rejects ${label} using existing validation`,()=>{
  const f=fixture();complete(f,{followupRequired:true});f.role('staff');assert.equal(f.actions.saveAppointment({...form,start:'13:00',...patch},{followupId:f.state.followups[0].id}).ok,false);assert.equal(f.state.followups[0].status,'Open')
})
for(const overlap of ['patient','dentist'])test(`follow-up booking respects ${overlap} overlap`,()=>{
  const f=fixture();complete(f,{followupRequired:true});f.role('staff');ok(f.actions.saveAppointment({...form,patientId:overlap==='patient'?'p1':'p3',dentistId:overlap==='patient'?'d2':'d1',start:'13:00'}))
  const r=f.actions.saveAppointment({...form,start:'13:00'},{followupId:f.state.followups[0].id});assert.equal(r.ok,false);assert.equal(r.validation.checks.find(c=>c.key===(overlap==='patient'?'patient-overlap':'overlap')).ok,false)
})
test('malformed follow-up relationship cannot create a booking',()=>{
  const f=fixture();complete(f,{followupRequired:true});f.patch({followups:[{...f.state.followups[0],treatmentId:'missing'}]});f.role('staff');assert.equal(f.actions.saveAppointment({...form,start:'13:00'},{followupId:f.state.followups[0].id}).ok,false)
})
for(const corruption of ['missing patient','missing appointment','wrong patient appointment','wrong queue appointment'])test(`completion blocks ${corruption} atomically`,()=>{
  const f=fixture();const q=encounter(f)
  if(corruption==='missing patient')f.patch({patients:[]})
  if(corruption==='missing appointment')f.patch({appointments:[]})
  if(corruption==='wrong patient appointment')f.patch({appointments:f.state.appointments.map(a=>({...a,patientId:'p2'}))})
  if(corruption==='wrong queue appointment')f.patch({appointments:f.state.appointments.map(a=>({...a,queueEntryId:'another'}))})
  const before=structuredClone(f.state);assert.equal(f.actions.completeTreatment({queueEntryId:q.id,procedure:'Documented',procedures:lines}).ok,false);assert.deepEqual(f.state,before)
})
test('nested procedure, invoice, payment and prescription references survive persistence',()=>{
  const f=fixture();const t=complete(f,{prescriptionRequired:true});ok(f.actions.authorizePrescription({treatmentId:t.id,items:[medication]}));const i=issue(f);ok(f.actions.postPayment(i.id,'Cash',i.total))
  const persisted=Object.fromEntries(['treatments','invoices','prescriptions'].map(k=>[k,JSON.parse(JSON.stringify(persistableCollection(k,f.state[k])))]));f.patch(persisted)
  f.role('patient');assert.equal(visibleInvoices(f.state,f.session)[0].payment.invoiceId,i.id);assert.equal(visiblePrescriptions(f.state,f.session)[0].treatmentId,t.id)
})

test('missing Dentist profile cannot save or complete an encounter',()=>{
  const f=fixture();const q=encounter(f);f.patch({dentists:f.state.dentists.filter(d=>d.id!=='d1')});assert.equal(f.actions.completeTreatment({queueEntryId:q.id,procedure:'Documented',procedures:lines}).ok,false)
})
test('invoice cannot switch to another queue or appointment',()=>{
  for(const key of ['queueEntryId','appointmentId']){const f=fixture();complete(f);f.role('staff');const i=f.state.invoices[0];f.patch({invoices:[{...i,[key]:'wrong'}]});assert.equal(f.actions.reviewInvoice(i.id).ok,false)}
})
test('duplicate independent invoices for a treatment cannot be issued or paid',()=>{
  const f=fixture();complete(f);const i=issue(f);f.patch({invoices:[i,{...i,id:'duplicate'}]});assert.equal(f.actions.postPayment(i.id,'Cash',i.total).ok,false)
})
test('invalid fee configuration rolls completion back',()=>{
  const f=fixture();const q=encounter(f);f.patch({services:f.state.services.map(s=>s.id==='svc2'?{...s,baseFee:NaN}:s)});assert.equal(f.actions.completeTreatment({queueEntryId:q.id,procedure:'Documented',procedures:lines}).ok,false);assert.equal(f.state.queue[0].status,'In Treatment');assert.equal(f.state.invoices.length,0)
})
test('closed branch, removed assignment, and inactive Dentist block follow-up booking',()=>{
  for(const change of ['branch','assignment','dentist']){
    const f=fixture();complete(f,{followupRequired:true});f.role('staff')
    if(change==='branch')f.patch({branches:f.state.branches.map(b=>b.id==='b1'?{...b,status:'Closed'}:b)})
    if(change==='assignment')f.patch({branchServices:[]})
    if(change==='dentist')f.patch({dentists:f.state.dentists.map(d=>d.id==='d1'?{...d,available:false}:d)})
    assert.equal(f.actions.saveAppointment({...form,start:'13:00'},{followupId:f.state.followups[0].id}).ok,false)
  }
})
test('follow-up retries cannot reuse a missing or unrelated appointment',()=>{
  const f=fixture();complete(f,{followupRequired:true});f.role('staff');const follow=f.state.followups[0]
  f.patch({followups:[{...follow,status:'Scheduled',appointmentId:'missing'}]});assert.equal(f.actions.saveAppointment({...form,start:'13:00'},{followupId:follow.id}).ok,false)
})
test('follow-up appointment cannot be rescheduled to a different patient or Dentist',()=>{
  const f=fixture();complete(f,{followupRequired:true});f.role('staff');const follow=f.state.followups[0];const a=ok(f.actions.saveAppointment({...form,start:'13:00'},{followupId:follow.id}))
  for(const patch of [{patientId:'p2'},{dentistId:'d2'},{branchId:'b2'}])assert.equal(f.actions.saveAppointment({...form,start:'14:00',...patch},{appointmentId:a.id}).ok,false)
})
test('malformed follow-up on another patient is not closed by this treatment',()=>{
  const f=fixture();const q=encounter(f);f.patch({followups:[{id:'bad',patientId:'p2',appointmentId:q.appointmentId,status:'Scheduled'}]});ok(f.actions.completeTreatment({queueEntryId:q.id,procedure:'Documented',procedures:lines}));assert.equal(f.state.followups[0].status,'Scheduled')
})
test('Staff cannot process another branch invoice',()=>{const f=fixture();complete(f);f.role('staff',{branchId:'b2'});assert.equal(f.actions.reviewInvoice(f.state.invoices[0].id).ok,false)})
test('patient never receives a receipt linked to another patient payment',()=>{
  const f=fixture();complete(f);const i=issue(f);const paid=ok(f.actions.postPayment(i.id,'Cash',i.total));f.patch({invoices:[{...paid,payment:{...paid.payment,patientId:'p2'}}]});f.role('patient');assert.equal(visibleInvoices(f.state,f.session).length,0)
})
test('explicit false choices and malformed dates cannot create clinical obligations',()=>{
  const f=fixture();const q=encounter(f);for(const patch of [{prescriptionRequired:'false'},{followupRequired:'true'},{followupDate:'2026-02-30'}])assert.equal(f.actions.completeTreatment({queueEntryId:q.id,procedure:'Documented',procedures:lines,...patch}).ok,false)
  assert.equal(f.state.followups.length,0)
})
test('prescription child items cannot be copied with another prescription relationship',()=>{
  const f=fixture();const t=complete(f,{prescriptionRequired:true});assert.equal(f.actions.authorizePrescription({treatmentId:t.id,items:[{...medication,prescriptionId:'another'}]}).ok,false)
})

test('malformed legacy invoice child rows fail gracefully without changing state',()=>{
  const f=fixture();complete(f);f.role('staff');const i=f.state.invoices[0];f.patch({invoices:[{...i,items:[null,null]}]});assert.equal(f.actions.reviewInvoice(i.id).ok,false);assert.equal(f.state.invoices[0].status,'Draft')
})
