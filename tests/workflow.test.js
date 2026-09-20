import test from 'node:test'
import assert from 'node:assert/strict'
import * as data from '../src/data.js'
import { clinicNow, setClockSource, rebaseDemoRecords } from '../src/clock.js'
import { normalizeClinicState, sessionForRole, encounterContext, inScope, isTodayQueue } from '../src/contracts.js'
import { availableSlots, validateAppointment, branchCapacity } from '../src/logic.js'
import { createWorkflowActions } from '../src/workflow.js'

setClockSource(()=>new Date('2026-09-19T02:08:00Z'))
const seedKeys={persons:'PERSONS',services:'SERVICES',branchServices:'BRANCH_SERVICES',dentistServiceAssignments:'DENTIST_SERVICE_ASSIGNMENTS',branches:'BRANCHES',dentists:'DENTISTS',staff:'STAFF',patients:'PATIENTS',users:'USERS'}
function fixture(overrides={}) {
  let state=normalizeClinicState({...Object.fromEntries(Object.entries(seedKeys).map(([key,seed])=>[key,structuredClone(data[`INITIAL_${seed}`])])),appointments:[],queue:[],checkIns:[],treatments:[],invoices:[],followups:[],prescriptions:[],notifications:[],workflowLog:[],audit:[],...overrides})
  let session=sessionForRole('staff',state)
  const actions=createWorkflowActions({getState:()=>state,getSession:()=>session,commit:patch=>{state=normalizeClinicState({...state,...patch})}})
  return {actions,get state(){return state},role:role=>{session=sessionForRole(role,state)},patch:patch=>{state=normalizeClinicState({...state,...patch})}}
}
const form={patientId:'p1',branchId:'b1',dentistId:'d1',serviceId:'svc1',date:'2026-09-19',start:'11:00'}
function book(f,patch={},commandId='book-1') {const r=f.actions.saveAppointment({...form,...patch},{commandId});assert.equal(r.ok,true,r.message);return r.record}
function arrive(f,appointment) {const r=f.actions.checkInAppointment(appointment.id);assert.equal(r.ok,true,r.message);return r.record}
function start(f,entry,patch={}) {f.role('dentist');assert.equal(f.actions.updateQueue(entry.id,'Called').ok,true);const r=f.actions.saveTreatment({queueEntryId:entry.id,...patch});assert.equal(r.ok,true,r.message);return r.record}

test('booking and rescheduling preserve branch ID and derive renamed labels',()=>{
  const f=fixture();const a=book(f)
  assert.equal(a.branchId,'b1')
  const changed=f.actions.saveAppointment({...form,start:'12:00'},{appointmentId:a.id})
  assert.equal(changed.ok,true)
  f.patch({branches:f.state.branches.map(b=>b.id==='b1'?{...b,name:'Renamed clinic'}:b)})
  assert.equal(f.state.appointments[0].branch,'Renamed clinic')
  assert.equal(validateAppointment({...form,start:'13:00'},f.state).valid,true)
  const q=arrive(f,changed.record);assert.equal(q.branchId,'b1')
  assert.equal(f.state.queue[0].branch,'Renamed clinic')
  assert.equal(branchCapacity('Renamed clinic',f.state).booked,1)
})

test('booking commands and identical reschedules are idempotent',()=>{
  const f=fixture();const a=book(f);const count=f.state.workflowLog.length
  book(f);assert.equal(f.state.appointments.length,1);assert.equal(f.state.workflowLog.length,count)
  assert.equal(f.actions.saveAppointment(form,{appointmentId:a.id}).unchanged,true)
})

test('patient creation returns patient ID, separately linked to its PERSON',()=>{
  const f=fixture();const r=f.actions.createPatientRecord({person:{firstName:'New',lastName:'Patient',phone:'09170009999'},patient:{preferredBranch:'Branch A'}})
  assert.equal(r.ok,true,r.message);assert.notEqual(r.record.id,r.record.personId)
  assert.equal(f.state.patients.find(p=>p.id===r.record.id).personId,r.record.personId)
  assert.equal(r.record.name,'New Patient')
  assert.equal(f.actions.createPatientRecord({person:{firstName:'New',lastName:'Patient',phone:'09170009999'},patient:{}}).ok,false)
})

test('scheduled check-in creates one check-in and one queue entry, including repeated calls',()=>{
  const f=fixture();const a=book(f);const q=arrive(f,a);const events=f.state.workflowLog.length
  const repeat=f.actions.checkInAppointment(a.id)
  assert.equal(repeat.ok,true);assert.equal(repeat.unchanged,true);assert.equal(repeat.record.id,q.id)
  assert.equal(f.state.queue.length,1);assert.equal(f.state.checkIns.length,1)
  assert.equal(f.state.appointments[0].status,'Checked In');assert.equal(f.state.workflowLog.length,events)
})

for(const status of ['Cancelled','Completed','No-show'])test(`${status} appointments cannot check in`,()=>{
  const f=fixture();const a=book(f);f.patch({appointments:[{...a,status}]})
  assert.equal(f.actions.checkInAppointment(a.id).ok,false);assert.equal(f.state.queue.length,0)
})

test('walk-in preserves service and retries do not duplicate arrival',()=>{
  const f=fixture();const r=f.actions.admitWalkIn({...form,serviceId:'svc2'},'walk-1')
  assert.equal(r.ok,true,r.message);assert.equal(r.record.serviceId,'svc2');assert.equal(r.record.appointmentId,null)
  assert.equal(f.actions.admitWalkIn({...form,serviceId:'svc2'},'walk-1').unchanged,true)
  assert.equal(f.actions.admitWalkIn({...form,serviceId:'svc2'},'walk-2').ok,false)
  assert.equal(f.state.queue.length,1);assert.equal(f.state.checkIns[0].serviceId,'svc2')
  start(f,r.record,{procedure:'Oral prophylaxis'})
  assert.equal(f.actions.completeTreatment({queueEntryId:r.record.id,procedure:'Oral prophylaxis'}).ok,true)
  assert.equal(f.state.invoices[0].branchId,'b1');assert.equal(f.state.invoices[0].total,1200)
})

for(const [name,patch] of [['patient',{patientId:'missing'}],['branch',{branchId:'missing'}],['service',{serviceId:'missing'}],['dentist',{dentistId:'missing'}],['branch assignment',{branchId:'b2'}],['dentist capability',{dentistId:'d2',serviceId:'svc2'}],['branch service',{serviceId:'svc9'}],['past date',{date:'2026-09-18'}],['same-day past time',{start:'10:00'}],['invalid time',{start:'99:00'}],['invalid date',{date:'2026-02-30'}],['branch hours',{start:'18:00'}]])test(`validation blocks invalid ${name}`,()=>{
  const f=fixture();assert.equal(validateAppointment({...form,...patch},f.state).valid,false)
})

test('closed branch and inactive dentist cannot be booked',()=>{
  const f=fixture();f.patch({branches:f.state.branches.map(b=>b.id==='b1'?{...b,status:'Inactive'}:b)})
  assert.equal(validateAppointment(form,f.state).valid,false)
  const other=fixture();other.patch({users:other.state.users.map(u=>u.id==='u3'?{...u,status:'Inactive',accountStatus:'Inactive'}:u)})
  assert.equal(validateAppointment(form,other.state).valid,false)
})

test('dentist and patient overlaps are independently blocked',()=>{
  const f=fixture();book(f)
  assert.equal(validateAppointment({...form,patientId:'p3'},f.state).checks.find(c=>c.key==='overlap').ok,false)
  assert.equal(validateAppointment({...form,dentistId:'d2'},f.state).checks.find(c=>c.key==='patient-overlap').ok,false)
  assert.equal(validateAppointment({...form,start:'11:30'},f.state).valid,true)
})

test('available slots and suggested alternatives pass exactly the same validator',()=>{
  const f=fixture();book(f)
  const slots=availableSlots(form,f.state);assert.ok(slots.length)
  for(const start of slots){assert.ok(start>clinicNow().time);assert.equal(validateAppointment({...form,start},f.state).valid,true)}
  for(const start of validateAppointment(form,f.state).alternatives)assert.equal(validateAppointment({...form,start},f.state).valid,true)
})

test('front desk scope cannot operate another branch; patient cannot act on another patient',()=>{
  const f=fixture();assert.equal(f.actions.saveAppointment({...form,branchId:'b2',dentistId:'d3'}).ok,false)
  f.role('owner');const b=book(f,{branchId:'b2',dentistId:'d3',patientId:'p2'})
  f.role('staff');assert.equal(f.actions.checkInAppointment(b.id).ok,false);assert.equal(f.actions.cancelAppointment(b.id).ok,false)
  f.role('patient');assert.equal(f.actions.cancelAppointment(b.id).ok,false)
  assert.equal(f.actions.checkInAppointment(b.id).ok,false)
})

test('exact queue context carries all encounter references and dentist cannot complete queue',()=>{
  const f=fixture();const a=book(f);const q=arrive(f,a);const context=encounterContext(q)
  assert.deepEqual(context,{queueEntryId:q.id,patientId:'p1',appointmentId:a.id,dentistId:'d1',branchId:'b1',serviceId:'svc1',treatmentId:null})
  f.role('dentist');assert.equal(f.actions.updateQueue(q.id,'Completed').ok,false)
  assert.equal(f.actions.updateQueue(q.id,'No-show').ok,false)
  assert.equal(f.actions.updateQueue(q.id,'Temporarily Away').ok,false)
  assert.equal(f.actions.saveTreatment({patientId:'p1',dentistId:'d1'}).ok,false)
  assert.equal(f.actions.completeTreatment({queueEntryId:q.id,procedure:'Consultation'}).ok,false)
})

test('away and return preserve arrival; emergency changes require reason; no-show closes appointment',()=>{
  const f=fixture();const a=book(f);const q=arrive(f,a)
  assert.equal(f.actions.updateQueue(q.id,'Temporarily Away').ok,true)
  assert.equal(f.state.queue[0].checkedIn,q.checkedIn);assert.equal(f.state.queue[0].position,null)
  assert.equal(f.actions.updateQueue(q.id,'Waiting').ok,true)
  assert.equal(f.actions.updateQueue(q.id,'Waiting',{priority:'Urgent'}).ok,false)
  assert.equal(f.actions.updateQueue(q.id,'Waiting',{priority:'Urgent',reason:'Staff-recorded emergency'}).ok,true)
  assert.equal(f.actions.updateQueue(q.id,'No-show').ok,true)
  assert.equal(f.state.appointments[0].status,'No-show')
  assert.equal(f.actions.checkInAppointment(a.id).ok,false)
})

test('treatment completes only its exact encounter; repeating commands creates no downstream duplicates',()=>{
  const f=fixture();const a=book(f);const b=book(f,{start:'13:00'},'book-2')
  const qa=arrive(f,a),qb=arrive(f,b)
  const t=start(f,qa,{procedure:'Consultation',followupRequired:true,prescriptionRequired:true})
  assert.equal(f.actions.saveTreatment({queueEntryId:qa.id,id:t.id,procedure:'Consultation',followupRequired:true,prescriptionRequired:true}).unchanged,true)
  assert.equal(f.actions.saveTreatment({queueEntryId:qb.id,id:t.id}).ok,false)
  assert.equal(f.actions.completeTreatment({queueEntryId:qa.id,id:t.id,procedure:'Consultation',followupRequired:true,prescriptionRequired:true}).ok,true)
  const count=f.state.workflowLog.length
  assert.equal(f.actions.completeTreatment({queueEntryId:qa.id,id:t.id}).unchanged,true)
  assert.equal(f.state.workflowLog.length,count)
  assert.equal(f.state.queue.find(q=>q.id===qa.id).status,'Completed')
  assert.equal(f.state.queue.find(q=>q.id===qb.id).status,'Waiting')
  assert.equal(f.state.appointments.find(a=>a.id===b.id).status,'Checked In')
  assert.equal(f.state.appointments.find(visit=>visit.id===qa.appointmentId).status,'Completed')
  assert.equal(f.state.invoices.length,1);assert.equal(f.state.followups.length,1);assert.equal(f.state.prescriptions.length,0)
  assert.equal(f.state.workflowLog.filter(e=>e.eventType==='clinical.prescription.required').length,1)
  const t2=start(f,qb,{procedure:'Second consultation'});assert.notEqual(t.id,t2.id)
})

test('dentist-selected performed service drives draft charges, not original booking',()=>{
  const f=fixture();const q=arrive(f,book(f));start(f,q)
  assert.equal(f.actions.completeTreatment({queueEntryId:q.id,serviceId:'svc2',procedure:'Oral prophylaxis'}).ok,true)
  assert.equal(f.state.treatments[0].requestedServiceId,'svc1');assert.equal(f.state.invoices[0].items[0].serviceId,'svc2');assert.equal(f.state.invoices[0].total,1200)
})

test('cancellation reconciles linked queue and follow-up; admitted visits cannot reschedule',()=>{
  const f=fixture();const a=book(f);const q=arrive(f,a)
  f.patch({followups:[{id:'f',patientId:a.patientId,branchId:'b1',appointmentId:a.id,status:'Scheduled'}]})
  assert.equal(f.actions.saveAppointment({...form,start:'13:00'},{appointmentId:a.id}).ok,false)
  assert.equal(f.actions.cancelAppointment(a.id).ok,true)
  assert.equal(f.state.queue[0].status,'Cancelled');assert.equal(f.state.followups[0].status,'Open');assert.equal(f.state.followups[0].appointmentId,null)
  assert.equal(f.actions.cancelAppointment(a.id).unchanged,true)
})

test('day rollover excludes old queues and prevents clinical edits; saved data never rebases',()=>{
  const f=fixture();const q=arrive(f,book(f));f.role('dentist')
  setClockSource(()=>new Date('2026-09-19T16:01:00Z'))
  try{assert.equal(clinicNow().date,'2026-09-20');assert.equal(isTodayQueue(q),false);assert.equal(f.actions.updateQueue(q.id,'Called').ok,false);assert.equal(f.actions.saveTreatment({queueEntryId:q.id}).ok,false);assert.equal(f.state.queue[0].clinicDate,'2026-09-19')}
  finally{setClockSource(()=>new Date('2026-09-19T02:08:00Z'))}
})

test('legacy branch names migrate, unknown walk-in dates do not become today, and seeds rebase only explicitly',()=>{
  const f=fixture({appointments:[{...form,id:'a',branch:'Branch A',branchId:undefined,status:'Confirmed'}],queue:[{id:'q',appointmentId:'a',checkInId:'ci',patientId:'p1',dentistId:'d1',status:'Waiting',checkedIn:'09:50'},{id:'old',patientId:'p2',dentistId:'d1',branch:'Branch A',status:'Waiting',checkedIn:'09:30'}]})
  assert.equal(f.state.queue[0].branchId,'b1');assert.equal(f.state.queue[0].clinicDate,form.date)
  assert.equal(isTodayQueue(f.state.queue[1]),false)
  const rebased=rebaseDemoRecords([{date:'2026-09-19',start:'10:00'}],'2026-09-20')
  assert.equal(rebased[0].date,'2026-09-20');assert.equal(rebased[0].start,'10:00')
})

test('durable collection serialization never stores display identity or branch copies',async()=>{
  const {persistableCollection}=await import('../src/contracts.js')
  const f=fixture();const a=book(f)
  const saved=persistableCollection('appointments',f.state.appointments)
  assert.equal(saved[0].branchId,'b1');assert.equal('branch' in saved[0],false);assert.equal('service' in saved[0],false)
  const patients=persistableCollection('patients',f.state.patients)
  assert.equal('name' in patients[0],false);assert.equal('phone' in patients[0],false);assert.equal('preferredBranch' in patients[0],false)
  const reloaded=normalizeClinicState({...f.state,appointments:saved,patients,branches:f.state.branches.map(b=>b.id==='b1'?{...b,name:'New branch label'}:b)})
  assert.equal(reloaded.appointments[0].branch,'New branch label');assert.equal(reloaded.patients[0].name,'Maria Santos')
})

test('legacy direct treatment ID wins over another treatment for the same appointment',()=>{
  const f=fixture({appointments:[{...form,id:'a'}],queue:[{id:'q',appointmentId:'a',patientId:'p1',dentistId:'d1',treatmentId:'exact',status:'Called'}],treatments:[{id:'other',appointmentId:'a'},{id:'exact',appointmentId:'a'}]})
  assert.equal(f.state.queue[0].treatmentId,'exact')
  assert.equal(f.state.treatments.find(t=>t.id==='exact').queueEntryId,'q')
})

test('prior-day and another dentist’s encounter cannot be opened for treatment',()=>{
  const f=fixture();f.role('owner');const a=book(f,{dentistId:'d2'});const q=arrive(f,a)
  f.role('dentist');assert.equal(inScope(q,sessionForRole('dentist',f.state)),false)
  assert.equal(f.actions.updateQueue(q.id,'Called').ok,false);assert.equal(f.actions.saveTreatment({queueEntryId:q.id}).ok,false)
  f.patch({queue:[{...q,dentistId:'d1',clinicDate:'2026-09-18'}]})
  assert.equal(f.actions.saveTreatment({queueEntryId:q.id}).ok,false)
})

test('invalid walk-in capability never records admission',()=>{
  for(const patch of [{patientId:'missing'},{serviceId:'missing'},{dentistId:'d3'},{serviceId:'svc6',dentistId:'d1'},{branchId:'b2'}]){
    const f=fixture();assert.equal(f.actions.admitWalkIn({...form,...patch},'walk-invalid').ok,false);assert.equal(f.state.queue.length,0);assert.equal(f.state.checkIns.length,0)
  }
})

test('malformed direct treatment links cannot overwrite another encounter',()=>{
  const f=fixture();const qa=arrive(f,book(f));const qb=arrive(f,book(f,{start:'13:00'},'other-visit'))
  const t=start(f,qa,{procedure:'Consultation'})
  f.patch({queue:f.state.queue.map(q=>q.id===qb.id?{...q,status:'Called',treatmentId:t.id}:q)})
  assert.equal(f.actions.saveTreatment({queueEntryId:qb.id,id:t.id,procedure:'Wrong encounter'}).ok,false)
  assert.equal(f.state.treatments[0].queueEntryId,qa.id)
})

test('unfinished historical treatment does not block today’s encounter',()=>{
  const f=fixture({treatments:[{id:'historical',patientId:'p1',dentistId:'d1',date:'2026-09-18',status:'In Treatment'}]})
  const q=arrive(f,book(f));const record=start(f,q)
  assert.equal(record.queueEntryId,q.id)
  assert.equal(f.state.treatments.find(t=>t.id==='historical').status,'In Treatment')
})
