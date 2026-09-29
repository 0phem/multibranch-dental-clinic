import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as data from '../src/data.js'
import { setClockSource, addDays, clinicNow } from '../src/clock.js'
import { normalizeClinicState, sessionForRole } from '../src/contracts.js'
import { createWorkflowActions } from '../src/workflow.js'
import { createRegistrationAction } from '../src/registration.js'
import * as scheduling from '../src/scheduling.js'
import { dentistsFor as dentistsForFromPatientView } from '../src/patient-view.js'

beforeEach(()=>setClockSource(()=>new Date('2026-09-19T02:08:00Z')))   // 2026-09-19 10:08 Manila

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

// M6 cutover: deterministic Dentist assignment (fewest booked minutes, then Dentist id), the open-time search, conflict
// exclusion, zero-eligible results and confirmation revalidation now run in the Laravel M6 API and are covered by the
// backend suite (AppointmentBookingTest, AppointmentCutoverSupportTest). This file keeps the browser's remaining
// reference-data helpers and guards that no browser scheduling authority comes back.

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
// ================================================================================================================
// REFERENCE ELIGIBILITY (used to present Staff Dentist choices; the server validates every choice)
// ================================================================================================================
test('eligibility pool excludes Dentists at another branch, without the service, unavailable or inactive',()=>{
  const f=fixture()
  const ids=scheduling.dentistsFor(f.state,'b1','svc1').map(d=>d.id)
  assert.ok(ids.includes('d1')&&ids.includes('d2'),'both Branch A Dentists who provide svc1 are listed')
  assert.ok(!ids.includes('d3')&&!ids.includes('d4')&&!ids.includes('d5'),'Dentists at other branches are excluded')
  const unavailable=fixture({dentists:structuredClone(data.INITIAL_DENTISTS).map(d=>d.id==='d1'?{...d,available:false}:d)})
  assert.deepEqual(scheduling.dentistsFor(unavailable.state,'b1','svc1').map(d=>d.id),['d2'])
  assert.deepEqual(scheduling.dentistsFor(f.state,'b1','svc-missing'),[])
})
test('servicesAt lists only active services a branch actively offers',()=>{
  const f=fixture()
  const ids=scheduling.servicesAt(f.state,'b1').map(s=>s.id)
  assert.ok(ids.length>0)
  for(const id of ids)assert.ok(f.state.branchServices.some(bs=>bs.branchId==='b1'&&bs.serviceId===id&&bs.active!==false),id)
})

test('Phase 4B.3A registration and email sign-in remain intact after the scheduling-domain relocation',async()=>{
  const {resolvePatientLogin}=await import('../src/contracts.js')
  let regState=normalizeClinicState({...Object.fromEntries(Object.entries(seedKeys).map(([k,v])=>[k,structuredClone(data[`INITIAL_${v}`])])),appointments:[],queue:[],checkIns:[],treatments:[],invoices:[],followups:[],prescriptions:[],notifications:[],workflowLog:[],audit:[]})
  const register=createRegistrationAction({getState:()=>regState,commit:patch=>{regState=normalizeClinicState({...regState,...patch})}})
  const r=register({firstName:'Regress',lastName:'Test',phone:'0917 555 9911',email:'regress.test@example.com',preferredBranchId:'b1'},'regress-1')
  assert.equal(r.ok,true,r.message)
  const login=resolvePatientLogin(regState,'regress.test@example.com')
  assert.equal(login.ok,true)
})
test('the relocated dentistsFor is identical whether imported from scheduling.js or patient-view.js',()=>{
  const f=fixture()
  assert.deepEqual(dentistsForFromPatientView(f.state,'b1','svc1').map(d=>d.id).sort(),['d1','d2'])
})

// ================================================================================================================
// Source guards
// ================================================================================================================
test('scheduling.js keeps only reference helpers: no browser assignment, search or randomness',()=>{
  assert.deepEqual(Object.keys(scheduling).sort(),['dentistsFor','servicesAt'])
  const src=read('src/scheduling.js')
  for(const forbidden of [/assignDentist/,/findOpenTimes/,/Date\.now\(/,/Math\.random\(/,/branchCapacity/,/dentists\[0\]/,/setTimeout\(/,/paymentPreference/,/bookingDraft/i])
    assert.doesNotMatch(src.replace(/\/\/.*$/gm,''),forbidden)
})
test('no browser code assigns a Dentist or auto-assigns a booking any more',()=>{
  for(const path of ['src/workflow.js','src/pages/PatientBook.jsx','src/pages/PatientVisits.jsx','src/pages/Scheduling.jsx','src/patient-view.js']){
    const src=read(path)
    for(const forbidden of [/assignDentist\(/,/findOpenTimes\(/,/autoAssign/,/SCHEDULING_RULE_VERSION/,/dentists\[0\]/,/branchCapacity/,/paymentPreference/])
      assert.doesNotMatch(src,forbidden,path)
  }
})
test('PHASE4B3_ONBOARDING_BOOKING.md documents the 4B.3B scheduling domain',()=>{
  const doc=read('PHASE4B3_ONBOARDING_BOOKING.md')
  for(const text of ['4B.3B','assignDentist','findOpenTimes','tie-break','14-day','zero-eligible','provisional','No silent'])
    assert.ok(doc.includes(text)||new RegExp(text,'i').test(doc),text)
})
