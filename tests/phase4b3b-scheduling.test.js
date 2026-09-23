import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as data from '../src/data.js'
import { setClockSource, addDays, clinicNow } from '../src/clock.js'
import { normalizeClinicState, sessionForRole } from '../src/contracts.js'
import { createWorkflowActions } from '../src/workflow.js'
import { createRegistrationAction } from '../src/registration.js'
import { assignDentist, findOpenTimes, SCHEDULING_RULE_VERSION, FIND_TIME_DEFAULT_WINDOW_DAYS } from '../src/scheduling.js'
import { dentistsFor as dentistsForFromPatientView } from '../src/patient-view.js'

beforeEach(()=>setClockSource(()=>new Date('2026-09-19T02:08:00Z')))   // 2026-09-19 10:08 Manila

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

// ---- Fixture --------------------------------------------------------------------------------------------------
// Same seed/state shape as tests/workflow.test.js. Default session is the Patient demo persona (Maria, p1/u12);
// call `.role('staff'|'dentist'|'owner')` to switch, or `.setSession(...)` for a forged/custom session.
const seedKeys={persons:'PERSONS',services:'SERVICES',branchServices:'BRANCH_SERVICES',dentistServiceAssignments:'DENTIST_SERVICE_ASSIGNMENTS',branches:'BRANCHES',dentists:'DENTISTS',staff:'STAFF',patients:'PATIENTS',users:'USERS'}
function fixture(overrides={}) {
  const seeds=Object.fromEntries(Object.entries(seedKeys).map(([k,v])=>[k,structuredClone(data[`INITIAL_${v}`])]))
  let state=normalizeClinicState({...seeds,appointments:[],queue:[],checkIns:[],treatments:[],invoices:[],followups:[],prescriptions:[],notifications:[],workflowLog:[],audit:[],...overrides})
  let session=sessionForRole('patient',state)
  const actions=createWorkflowActions({getState:()=>state,getSession:()=>session,commit:patch=>{state=normalizeClinicState({...state,...patch})}})
  return {actions,get state(){return state},role:role=>{session=sessionForRole(role,state)},setSession:s=>{session=s},patch:patch=>{state=normalizeClinicState({...state,...patch})}}
}
// Direct, explicit bookings used to seed workload/conflict scenarios (never through autoAssign). Owner has no
// branch scope restriction, so this can seed any branch regardless of the scenario under test.
function bookDirect(f,form,commandId) {
  f.role('owner')
  const r=f.actions.saveAppointment(form,{commandId})
  assert.equal(r.ok,true,r.message)
  f.role('patient')
  return r.record
}

const TOMORROW='2026-09-20' // avoids the same-day "past time" constraint entirely

// ================================================================================================================
// ASSIGNMENT ELIGIBILITY
// ================================================================================================================
test('eligibility pool excludes Dentists at another branch, without the service, unavailable or inactive',()=>{
  const f=fixture()
  const assignment=assignDentist(f.state,{branchId:'b1',serviceId:'svc1',patientId:'p2',date:TOMORROW,start:'11:00'},clinicNow())
  const ids=assignment.candidates.map(c=>c.dentistId)
  assert.ok(ids.includes('d1')&&ids.includes('d2'),'both Branch A Dentists who provide svc1 are candidates')
  assert.ok(!ids.includes('d3')&&!ids.includes('d4')&&!ids.includes('d5'),'Dentists at other branches are excluded')

  const unavailable=fixture({dentists:structuredClone(data.INITIAL_DENTISTS).map(d=>d.id==='d1'?{...d,available:false}:d)})
  const a2=assignDentist(unavailable.state,{branchId:'b1',serviceId:'svc1',patientId:'p2',date:TOMORROW,start:'11:00'},clinicNow())
  assert.equal(a2.dentistId,'d2','an unavailable Dentist is never assigned')

  const inactive=fixture({users:structuredClone(data.INITIAL_USERS).map(u=>u.id==='u3'?{...u,accountStatus:'Inactive',status:'Inactive'}:u)})
  const a3=assignDentist(inactive.state,{branchId:'b1',serviceId:'svc1',patientId:'p2',date:TOMORROW,start:'11:00'},clinicNow())
  assert.equal(a3.dentistId,'d2','a Dentist whose account is inactive is never assigned')
})

test('shift/time validity excludes a Dentist whose shift has not started yet',()=>{
  const f=fixture()
  // d2's shift starts at 10:00; 09:15 is still within Branch A hours (09:00-18:00) and d1's shift (09:00-18:00).
  const a=assignDentist(f.state,{branchId:'b1',serviceId:'svc1',patientId:'p2',date:TOMORROW,start:'09:15'},clinicNow())
  assert.equal(a.ok,true);assert.equal(a.dentistId,'d1')
  assert.ok(!a.candidates.some(c=>c.dentistId==='d2'))
})

test('an existing Dentist conflict excludes that Dentist only',()=>{
  const f=fixture()
  bookDirect(f,{patientId:'p3',branchId:'b1',dentistId:'d1',serviceId:'svc1',date:TOMORROW,start:'11:00'},'seed-conflict')
  const a=assignDentist(f.state,{branchId:'b1',serviceId:'svc1',patientId:'p2',date:TOMORROW,start:'11:00'},clinicNow())
  assert.equal(a.ok,true);assert.equal(a.dentistId,'d2')
})

test('an existing Patient conflict at another branch/Dentist excludes every candidate',()=>{
  const f=fixture()
  bookDirect(f,{patientId:'p1',branchId:'b2',dentistId:'d5',serviceId:'svc1',date:TOMORROW,start:'11:00'},'seed-patient-conflict')
  const a=assignDentist(f.state,{branchId:'b1',serviceId:'svc1',patientId:'p1',date:TOMORROW,start:'11:00'},clinicNow())
  assert.equal(a.ok,false)
  assert.equal(a.dentistId,null)
})

test('malformed or unknown scheduling state fails safely, never throws',()=>{
  const f=fixture()
  assert.equal(assignDentist(f.state,{}).ok,false)
  assert.equal(assignDentist(f.state,null).ok,false)
  assert.equal(assignDentist(f.state,{branchId:'nope',serviceId:'svc1',patientId:'p1',date:TOMORROW,start:'09:00'}).ok,false)
})

// ================================================================================================================
// DETERMINISM
// ================================================================================================================
test('identical state and input always produce the identical Dentist; array order never decides',()=>{
  const f=fixture()
  const form={branchId:'b1',serviceId:'svc1',patientId:'p2',date:TOMORROW,start:'11:00'}
  const forward=assignDentist(f.state,form,clinicNow())
  const reversed=fixture({dentists:[...structuredClone(data.INITIAL_DENTISTS)].reverse()})
  const backward=assignDentist(reversed.state,form,clinicNow())
  assert.equal(forward.ok,true);assert.equal(forward.dentistId,backward.dentistId)
  assert.equal(assignDentist(f.state,form,clinicNow()).dentistId,forward.dentistId,'repeated identical calls return the same Dentist')
})

test('a tie between eligible Dentists breaks by ascending canonical Dentist ID',()=>{
  const f=fixture()
  const a=assignDentist(f.state,{branchId:'b1',serviceId:'svc1',patientId:'p2',date:TOMORROW,start:'11:00'},clinicNow())
  assert.equal(a.dentistId,'d1')
})

// ================================================================================================================
// WORKLOAD
// ================================================================================================================
test('fewer legitimately booked minutes wins, overriding plain ID order',()=>{
  const f=fixture()
  bookDirect(f,{patientId:'p3',branchId:'b1',dentistId:'d1',serviceId:'svc5',date:TOMORROW,start:'09:00'},'heavy-d1') // 90 min
  const a=assignDentist(f.state,{branchId:'b1',serviceId:'svc1',patientId:'p2',date:TOMORROW,start:'11:00'},clinicNow())
  assert.equal(a.dentistId,'d2','d1 has 90 booked minutes that date; d2 (0 minutes) wins despite the higher ID')
})

test('a terminal (Cancelled) appointment never inflates workload',()=>{
  const f=fixture({appointments:[{id:'cancelled-1',patientId:'p3',branchId:'b1',dentistId:'d1',serviceId:'svc5',date:TOMORROW,start:'09:00',duration:90,status:'Cancelled'}]})
  const a=assignDentist(f.state,{branchId:'b1',serviceId:'svc1',patientId:'p2',date:TOMORROW,start:'11:00'},clinicNow())
  assert.equal(a.dentistId,'d1','the Cancelled appointment contributes no minutes, so the tie still breaks to the lower ID')
})

test('booked minutes on a different date never inflate the selected date\'s workload',()=>{
  const f=fixture()
  bookDirect(f,{patientId:'p3',branchId:'b1',dentistId:'d1',serviceId:'svc5',date:'2026-09-21',start:'09:00'},'other-date')
  const a=assignDentist(f.state,{branchId:'b1',serviceId:'svc1',patientId:'p2',date:TOMORROW,start:'11:00'},clinicNow())
  assert.equal(a.dentistId,'d1','a different date\'s booking does not affect this date\'s tie-break')
})

test('M15 branchCapacity is never consulted to rank Dentists',()=>{
  assert.doesNotMatch(read('src/scheduling.js'),/branchCapacity/)
})

// ================================================================================================================
// ZERO PROVIDER
// ================================================================================================================
test('a real zero-eligible-Dentist branch/service combination produces an explicit no-assignment result',()=>{
  const f=fixture()
  const svc10=assignDentist(f.state,{branchId:'b3',serviceId:'svc10',patientId:'p4',date:TOMORROW,start:'11:00'},clinicNow())
  assert.equal(svc10.ok,false);assert.equal(svc10.dentistId,null);assert.deepEqual(svc10.candidates,[])
  const svc8=assignDentist(f.state,{branchId:'b2',serviceId:'svc8',patientId:'p2',date:TOMORROW,start:'11:00'},clinicNow())
  assert.equal(svc8.ok,false);assert.equal(svc8.dentistId,null)
})
test('zero eligible Dentist never falls back to an unqualified Dentist or another branch',()=>{
  const f=fixture()
  const a=assignDentist(f.state,{branchId:'b3',serviceId:'svc10',patientId:'p4',date:TOMORROW,start:'11:00'},clinicNow())
  assert.notEqual(a.dentistId,'d1');assert.notEqual(a.dentistId,'d4') // d4 is Branch C but not svc10-authorized
  assert.equal(a.dentistId,null)
})

// ================================================================================================================
// FIND OPEN TIMES
// ================================================================================================================
test('the 14-day technical window is the default and is exposed as a named constant',()=>{
  assert.equal(FIND_TIME_DEFAULT_WINDOW_DAYS,14)
  const f=fixture()
  const results=findOpenTimes(f.state,{branchId:'b1',serviceId:'svc1',patientId:'p2'},{now:clinicNow()})
  const now=clinicNow()
  for(const slot of results){assert.ok(slot.date>=now.date);assert.ok(slot.date<=addDays(now.date,13))}
})
test('results are deterministic and chronologically ordered',()=>{
  const f=fixture()
  const form={branchId:'b1',serviceId:'svc1',patientId:'p2'}
  const first=findOpenTimes(f.state,form,{now:clinicNow()})
  const second=findOpenTimes(f.state,form,{now:clinicNow()})
  assert.deepEqual(first,second,'repeated search gives the same ordered output')
  const sorted=[...first].sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start))
  assert.deepEqual(first,sorted)
})
test('only a date/time with at least one eligible Dentist is returned; a zero-eligible service returns empty honestly',()=>{
  const f=fixture()
  assert.deepEqual(findOpenTimes(f.state,{branchId:'b3',serviceId:'svc10',patientId:'p4'},{now:clinicNow()}),[])
  const results=findOpenTimes(f.state,{branchId:'b1',serviceId:'svc1',patientId:'p2'},{now:clinicNow()})
  assert.ok(results.length>0)
  for(const slot of results)assert.ok(['d1','d2'].includes(slot.dentistId))
})
test('an existing Patient conflict excludes that exact slot from the search',()=>{
  const f=fixture()
  bookDirect(f,{patientId:'p2',branchId:'b2',dentistId:'d3',serviceId:'svc1',date:TOMORROW,start:'11:00'},'find-conflict')
  const results=findOpenTimes(f.state,{branchId:'b1',serviceId:'svc1',patientId:'p2'},{startDate:TOMORROW,windowDays:1,now:clinicNow()})
  assert.ok(!results.some(s=>s.date===TOMORROW&&s.start==='11:00'))
  assert.ok(results.some(s=>s.date===TOMORROW),'other times that date remain open')
})
test('the result count is capped by an explicit limit',()=>{
  const f=fixture()
  const results=findOpenTimes(f.state,{branchId:'b1',serviceId:'svc1',patientId:'p2'},{limit:1,now:clinicNow()})
  assert.ok(results.length<=1)
})
test('changing the start date searches the next technical window cleanly',()=>{
  const f=fixture()
  const results=findOpenTimes(f.state,{branchId:'b1',serviceId:'svc1',patientId:'p2'},{startDate:'2026-09-25',windowDays:14,now:clinicNow()})
  for(const slot of results){assert.ok(slot.date>='2026-09-25');assert.ok(slot.date<=addDays('2026-09-25',13))}
})

// ================================================================================================================
// COMMAND INTEGRATION
// ================================================================================================================
const autoForm={branchId:'b1',serviceId:'svc1',date:TOMORROW,start:'11:00'}

test('a new Patient-initiated booking may explicitly request automatic assignment; method and Dentist are persisted',()=>{
  const f=fixture()
  const r=f.actions.saveAppointment(autoForm,{commandId:'auto-1',autoAssign:true})
  assert.equal(r.ok,true,r.message)
  assert.equal(r.record.dentistId,'d1')
  assert.equal(r.record.assignmentMethod,'auto')
  assert.equal(f.state.appointments[0].assignmentMethod,'auto')
  const evt=f.state.workflowLog.find(e=>e.entityId===r.record.id||e.commandKey?.startsWith(`appointment:${r.record.id}`))
  assert.equal(evt.assignmentMethod,'auto');assert.equal(evt.assignmentRuleVersion,SCHEDULING_RULE_VERSION)
})

test('an explicitly selected Patient booking is not auto-assigned and keeps the chosen Dentist',()=>{
  const f=fixture()
  const r=f.actions.saveAppointment({...autoForm,dentistId:'d2'},{commandId:'selected-1'})
  assert.equal(r.ok,true,r.message)
  assert.equal(r.record.dentistId,'d2')
  assert.equal(r.record.assignmentMethod,'selected')
})

test('Staff booking with autoAssign set is ignored; Staff keeps its explicit Dentist',()=>{
  const f=fixture();f.role('staff')
  const r=f.actions.saveAppointment({...autoForm,patientId:'p1',dentistId:'d2'},{commandId:'staff-auto',autoAssign:true})
  assert.equal(r.ok,true,r.message)
  assert.equal(r.record.dentistId,'d2','Staff\'s explicit Dentist is never overridden')
  assert.equal(r.record.assignmentMethod,'selected')
})

test('rescheduling an existing appointment with autoAssign set does not silently move the Dentist',()=>{
  const f=fixture()
  const booked=f.actions.saveAppointment({...autoForm,dentistId:'d1'},{commandId:'orig-1'})
  assert.equal(booked.ok,true,booked.message)
  const rescheduled=f.actions.saveAppointment({...autoForm,dentistId:'d1',start:'13:00'},{appointmentId:booked.record.id,commandId:'resched-1',expectedRevision:booked.record.revision,autoAssign:true})
  assert.equal(rescheduled.ok,true,rescheduled.message)
  assert.equal(rescheduled.record.dentistId,'d1')
})

test('follow-up scheduling with autoAssign set keeps the Dentist who requested the follow-up',()=>{
  const f=fixture({followups:[{id:'f1',patientId:'p1',branchId:'b1',dentistId:'d1',treatmentId:'t1',status:'Open',appointmentId:null}],treatments:[{id:'t1',patientId:'p1',dentistId:'d1',branchId:'b1',queueEntryId:'q1',status:'Completed',followupRequired:true}],queue:[{id:'q1',patientId:'p1',dentistId:'d1',branchId:'b1',treatmentId:'t1',status:'Completed',clinicDate:'2026-09-13'}]})
  const r=f.actions.saveAppointment({...autoForm,serviceId:'svc11',dentistId:'d1'},{commandId:'follow-1',followupId:'f1',autoAssign:true})
  assert.equal(r.ok,true,r.message)
  assert.equal(r.record.dentistId,'d1')
})

test('confirmation still valid: the previewed Dentist matches the recomputed assignment and the booking succeeds',()=>{
  const f=fixture()
  const preview=assignDentist(f.state,{...autoForm,patientId:'p1'},clinicNow())
  assert.equal(preview.ok,true)
  const r=f.actions.saveAppointment({...autoForm,dentistId:preview.dentistId},{commandId:'reviewed-ok',autoAssign:true})
  assert.equal(r.ok,true,r.message);assert.equal(r.record.dentistId,preview.dentistId)
})

test('confirmation stale: a reviewed Dentist that no longer matches the recomputed assignment fails with no appointment created',()=>{
  const f=fixture()
  // The deterministic winner for this exact request is d1 (tie by ID); reviewing d2 is stale.
  const r=f.actions.saveAppointment({...autoForm,dentistId:'d2'},{commandId:'reviewed-stale',autoAssign:true})
  assert.equal(r.ok,false)
  assert.match(r.message,/Availability changed/)
  assert.equal(f.state.appointments.length,0)
})

test('no eligible Dentist fails the booking with no appointment created',()=>{
  const f=fixture()
  const r=f.actions.saveAppointment({branchId:'b3',serviceId:'svc10',date:TOMORROW,start:'11:00'},{commandId:'no-provider',autoAssign:true})
  assert.equal(r.ok,false)
  assert.equal(f.state.appointments.length,0)
})

test('replaying the same commandId creates exactly one appointment',()=>{
  const f=fixture()
  const first=f.actions.saveAppointment(autoForm,{commandId:'replay-1',autoAssign:true})
  assert.equal(first.ok,true,first.message)
  const second=f.actions.saveAppointment(autoForm,{commandId:'replay-1',autoAssign:true})
  assert.equal(second.unchanged,true)
  assert.equal(second.record.id,first.record.id)
  assert.equal(f.state.appointments.length,1)
})

test('a forged Patient session cannot trigger automatic assignment',()=>{
  const f=fixture()
  f.setSession({role:'patient',patientId:'not-a-real-patient',userId:'u12',branchId:null,active:true})
  const r=f.actions.saveAppointment(autoForm,{commandId:'forged-1',autoAssign:true})
  assert.equal(r.ok,false)
  assert.equal(f.state.appointments.length,0)
})

test('a deactivated Patient account cannot trigger automatic assignment',()=>{
  const f=fixture({users:structuredClone(data.INITIAL_USERS).map(u=>u.id==='u12'?{...u,accountStatus:'Inactive',status:'Inactive'}:u)})
  const r=f.actions.saveAppointment(autoForm,{commandId:'deactivated-1',autoAssign:true})
  assert.equal(r.ok,false)
  assert.equal(f.state.appointments.length,0)
})

// ================================================================================================================
// REGRESSION
// ================================================================================================================
test('Phase 4B.3A registration and email sign-in remain intact after the scheduling-domain relocation',async()=>{
  const {resolvePatientLogin}=await import('../src/contracts.js')
  let regState=normalizeClinicState({...Object.fromEntries(Object.entries(seedKeys).map(([k,v])=>[k,structuredClone(data[`INITIAL_${v}`])])),appointments:[],queue:[],checkIns:[],treatments:[],invoices:[],followups:[],prescriptions:[],notifications:[],workflowLog:[],audit:[]})
  const register=createRegistrationAction({getState:()=>regState,commit:patch=>{regState=normalizeClinicState({...regState,...patch})}})
  const r=register({firstName:'Regress',lastName:'Test',phone:'0917 555 9911',email:'regress.test@example.com',preferredBranchId:'b1'},'regress-1')
  assert.equal(r.ok,true,r.message)
  const login=resolvePatientLogin(regState,'regress.test@example.com')
  assert.equal(login.ok,true)
})
test('Maria\'s existing manual booking path is unaffected',()=>{
  const f=fixture()
  const r=f.actions.saveAppointment({branchId:'b1',dentistId:'d1',serviceId:'svc1',date:TOMORROW,start:'11:00'},{commandId:'maria-1'})
  assert.equal(r.ok,true,r.message)
  assert.equal(r.record.assignmentMethod,'selected')
})
test('the relocated dentistsFor is identical whether imported from scheduling.js or patient-view.js',()=>{
  const f=fixture()
  assert.deepEqual(dentistsForFromPatientView(f.state,'b1','svc1').map(d=>d.id).sort(),['d1','d2'])
})

// ================================================================================================================
// Source guards
// ================================================================================================================
test('scheduling.js exposes the required domain surface and contains no forbidden patterns',()=>{
  const src=read('src/scheduling.js')
  for(const token of ['export function assignDentist','export function findOpenTimes','SCHEDULING_RULE_VERSION','FIND_TIME_DEFAULT_WINDOW_DAYS'])
    assert.ok(src.includes(token),token)
  for(const forbidden of [/Date\.now\(/,/Math\.random\(/,/branchCapacity/,/dentists\[0\]/,/setTimeout\(/,/paymentPreference/,/bookingDraft/i])
    assert.doesNotMatch(src,forbidden)
})
test('workflow.js\'s scheduling integration contains no forbidden patterns',()=>{
  const src=read('src/workflow.js')
  for(const forbidden of [/dentists\[0\]/,/branchCapacity/,/paymentPreference/,/bookingDraft/i])
    assert.doesNotMatch(src,forbidden)
})
test('PHASE4B3_ONBOARDING_BOOKING.md documents the 4B.3B scheduling domain',()=>{
  const doc=read('PHASE4B3_ONBOARDING_BOOKING.md')
  for(const text of ['4B.3B','assignDentist','findOpenTimes','tie-break','14-day','zero-eligible','provisional','No silent'])
    assert.ok(doc.includes(text)||new RegExp(text,'i').test(doc),text)
})
