import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as data from '../src/data.js'
import { setClockSource, clinicNow } from '../src/clock.js'
import { normalizeClinicState, sessionForRole } from '../src/contracts.js'
import { createWorkflowActions } from '../src/workflow.js'
import { patientActionRequired, patientAttention, patientBookingDraft, patientHome, draftStatus } from '../src/patient-view.js'
import { haversineKm, nearestBranch } from '../src/geo.js'
import { findOpenTimes } from '../src/scheduling.js'

beforeEach(()=>setClockSource(()=>new Date('2026-09-19T02:08:00Z')))   // 2026-09-19 10:08 Manila

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

// ---- Fixture --------------------------------------------------------------------------------------------------
const seedKeys={persons:'PERSONS',services:'SERVICES',branchServices:'BRANCH_SERVICES',dentistServiceAssignments:'DENTIST_SERVICE_ASSIGNMENTS',branches:'BRANCHES',dentists:'DENTISTS',staff:'STAFF',patients:'PATIENTS',users:'USERS'}
function fixture(overrides={}) {
  const seeds=Object.fromEntries(Object.entries(seedKeys).map(([k,v])=>[k,structuredClone(data[`INITIAL_${v}`])]))
  let state=normalizeClinicState({...seeds,appointments:[],queue:[],checkIns:[],treatments:[],invoices:[],followups:[],prescriptions:[],notifications:[],workflowLog:[],audit:[],bookingDrafts:[],...overrides})
  let session=sessionForRole('patient',state)
  const actions=createWorkflowActions({getState:()=>state,getSession:()=>session,commit:patch=>{state=normalizeClinicState({...state,...patch})}})
  return {actions,get state(){return state},role:role=>{session=sessionForRole(role,state)},setSession:s=>{session=s},patch:patch=>{state=normalizeClinicState({...state,...patch})}}
}

// ================================================================================================================
// BOOKING DRAFTS
// ================================================================================================================
test('a draft is created and updated in place — one per Patient, never a second row',()=>{
  const f=fixture()
  const first=f.actions.saveBookingDraft({mode:'manual',branchId:'b1'},'d1')
  assert.equal(first.ok,true,first.message)
  assert.equal(f.state.bookingDrafts.length,1)
  assert.equal(f.state.bookingDrafts[0].patientId,'p1')
  assert.equal(f.state.bookingDrafts[0].dentistId,undefined,'a draft never stores a committed Dentist selection')
  const second=f.actions.saveBookingDraft({serviceId:'svc1'},'d2')
  assert.equal(second.ok,true,second.message)
  assert.equal(f.state.bookingDrafts.length,1,'upserted, not a second row')
  assert.equal(second.record.branchId,'b1','earlier valid progress is kept')
  assert.equal(second.record.serviceId,'svc1')
})

test('replaying an identical patch is a structural no-op',()=>{
  const f=fixture()
  f.actions.saveBookingDraft({mode:'smart',branchId:'b1'},'d1')
  const revision=f.state.bookingDrafts[0].revision
  const again=f.actions.saveBookingDraft({branchId:'b1'},'d2')
  assert.equal(again.unchanged,true)
  assert.equal(f.state.bookingDrafts[0].revision,revision)
})

test('a draft reserves no slot, consumes no capacity and creates no appointment/queue entry',()=>{
  const f=fixture()
  f.actions.saveBookingDraft({mode:'manual',branchId:'b1',serviceId:'svc1',date:'2026-09-20',start:'11:00'},'d1')
  assert.equal(f.state.appointments.length,0)
  assert.equal(f.state.queue.length,0)
  assert.equal(f.state.bookingDrafts.length,1)
})

test('only a Patient may save or discard a draft; a non-Patient session is rejected with no state change',()=>{
  for(const role of ['staff','dentist','owner']){
    const f=fixture();f.role(role)
    const save=f.actions.saveBookingDraft({branchId:'b1'},'d1')
    assert.equal(save.ok,false)
    assert.equal(f.state.bookingDrafts.length,0)
    const discard=f.actions.discardBookingDraft('d2')
    assert.equal(discard.ok,false)
  }
})

test('a forged or deactivated Patient session cannot save a draft',()=>{
  const f=fixture()
  f.setSession({role:'patient',patientId:'not-a-real-patient',userId:'u12',branchId:null,active:true})
  assert.equal(f.actions.saveBookingDraft({branchId:'b1'},'d1').ok,false)
  assert.equal(f.state.bookingDrafts.length,0)
  const deactivated=fixture({users:structuredClone(data.INITIAL_USERS).map(u=>u.id==='u12'?{...u,accountStatus:'Inactive',status:'Inactive'}:u)})
  assert.equal(deactivated.actions.saveBookingDraft({branchId:'b1'},'d1').ok,false)
})

test('a Patient can only read and discard their own draft — second Patient isolation',()=>{
  const f=fixture()
  f.actions.saveBookingDraft({mode:'manual',branchId:'b1'},'d1')
  const maria=sessionForRole('patient',f.state)
  const stranger={role:'patient',patientId:'p2',userId:null,branchId:null,active:false}
  assert.equal(patientBookingDraft(f.state,stranger),null,"a second Patient's session cannot read another Patient's draft")
  assert.equal(patientBookingDraft(f.state,maria).patientId,'p1')
})

test('malformed or reserved-field patches fail closed, creating and changing nothing',()=>{
  const f=fixture()
  for(const bad of [{mode:'ai-powered'},{branchId:123},{date:'not-a-date'},{start:'25:99'},{extra:'nope'},{patientId:'p2'},{dentistId:'d1'}])
    assert.equal(f.actions.saveBookingDraft(bad,'d1').ok,false,JSON.stringify(bad))
  assert.equal(f.state.bookingDrafts.length,0)
  assert.equal(f.actions.saveBookingDraft({branchId:'b1'},'').ok,false,'an empty command ID is rejected')
})

test('discarding an existing draft removes it; discarding again is a safe no-op',()=>{
  const f=fixture()
  f.actions.saveBookingDraft({branchId:'b1'},'d1')
  const first=f.actions.discardBookingDraft('discard-1')
  assert.equal(first.ok,true);assert.equal(f.state.bookingDrafts.length,0)
  const again=f.actions.discardBookingDraft('discard-2')
  assert.equal(again.ok,true);assert.equal(again.unchanged,true)
})

test('a successful new booking clears the Patient\'s draft atomically; a replayed confirmation never duplicates it',()=>{
  const f=fixture()
  f.actions.saveBookingDraft({mode:'manual',branchId:'b1',serviceId:'svc1',date:'2026-09-20',start:'11:00'},'d1')
  assert.equal(f.state.bookingDrafts.length,1)
  const confirm=f.actions.saveAppointment({branchId:'b1',serviceId:'svc1',date:'2026-09-20',start:'11:00'},{commandId:'confirm-1',autoAssign:true})
  assert.equal(confirm.ok,true,confirm.message)
  assert.equal(confirm.record.assignmentMethod,'auto')
  assert.equal(f.state.bookingDrafts.length,0,'the draft is gone in the same commit as the new appointment')
  assert.equal(f.state.appointments.length,1)
  const replay=f.actions.saveAppointment({branchId:'b1',serviceId:'svc1',date:'2026-09-20',start:'11:00'},{commandId:'confirm-1',autoAssign:true})
  assert.equal(replay.unchanged,true)
  assert.equal(f.state.appointments.length,1,'no duplicate appointment from the replay')
})

test('a Staff reschedule or Staff booking never touches a Patient draft',()=>{
  const f=fixture()
  f.actions.saveBookingDraft({branchId:'b1'},'d1')
  f.role('staff')
  const staffBooking=f.actions.saveAppointment({patientId:'p1',branchId:'b1',dentistId:'d1',serviceId:'svc1',date:'2026-09-20',start:'11:00'},{commandId:'staff-1'})
  assert.equal(staffBooking.ok,true,staffBooking.message)
  assert.equal(f.state.bookingDrafts.length,1,'Staff creating a Patient appointment does not clear the Patient\'s own draft (only the Patient\'s own new booking does)')
})

// ================================================================================================================
// draftStatus revalidation
// ================================================================================================================
test('draftStatus reports a closed branch, a dropped service and a stale time without silently replacing them',()=>{
  const f=fixture()
  const session=sessionForRole('patient',f.state)
  f.actions.saveBookingDraft({mode:'manual',branchId:'b1',serviceId:'svc4',date:'2026-09-20',start:'11:00'},'d1')
  const okStatus=draftStatus(f.state,session,patientBookingDraft(f.state,session))
  assert.equal(okStatus.slotValid,true);assert.equal(okStatus.issues.length,0)

  const closedBranch=fixture({branches:structuredClone(data.INITIAL_BRANCHES).map(b=>b.id==='b1'?{...b,status:'Inactive'}:b)})
  closedBranch.actions.saveBookingDraft({branchId:'b1',serviceId:'svc4'},'d1')
  const closedSession=sessionForRole('patient',closedBranch.state)
  const closedStatus=draftStatus(closedBranch.state,closedSession,patientBookingDraft(closedBranch.state,closedSession))
  assert.equal(closedStatus.branch,null);assert.ok(closedStatus.issues.some(i=>/branch/i.test(i)))

  // A past/invalid time at a still-open branch/service is reported invalid, not silently swapped for another time.
  f.actions.saveBookingDraft({date:'2026-09-19',start:'07:00'},'d2')
  const staleStatus=draftStatus(f.state,session,patientBookingDraft(f.state,session))
  assert.equal(staleStatus.slotValid,false)
  assert.equal(staleStatus.date,'2026-09-19');assert.equal(staleStatus.start,'07:00','the stale value itself is reported, never dropped or replaced')
})

test('draftStatus fails closed for a forged patientId and returns null for no draft',()=>{
  const f=fixture()
  const session=sessionForRole('patient',f.state)
  assert.equal(draftStatus(f.state,session,null),null)
  assert.equal(draftStatus(f.state,session,{patientId:'p2',branchId:'b1'}),null,'a draft belonging to another Patient is never evaluated')
})

// ================================================================================================================
// Home: action-required vs. the full attention list
// ================================================================================================================
test('patientActionRequired is the hmo/followup/invoice subset of patientAttention, never messages/prescriptions/notifications',()=>{
  const f=fixture({
    hmo:[{id:'h1',branchId:'b1',providerId:'hmo-medicare',patientId:'p1',status:'Returned',requirements:[{id:'r1',ruleId:'hmo-card',label:'HMO Card',state:'Missing'}]}],
    followups:[{id:'f1',patientId:'p1',branchId:'b1',dentistId:'d1',treatmentId:'t1',status:'Open'}],
    treatments:[{id:'t1',patientId:'p1',dentistId:'d1',branchId:'b1',status:'Completed',followupRequired:true}],
    invoices:[{id:'inv1',patientId:'p1',branchId:'b1',treatmentId:'t1',status:'Issued',paymentStatus:'Unpaid',total:100,items:[]}],
    conversations:[{id:'c1',patientId:'p1',branchId:'b1',participantUserIds:['u12'],unreadUserIds:['u12'],status:'Open',messages:[]}],
    notifications:[{id:'n1',patientId:'p1',recipientUserId:'u12',type:'Appointment Confirmation',read:false,createdAt:'2026-09-19 08:00'}],
  })
  const session=sessionForRole('patient',f.state)
  const attention=patientAttention(f.state,session), actionRequired=patientActionRequired(f.state,session)
  assert.ok(attention.some(i=>i.kind==='message')&&attention.some(i=>i.kind==='notification'),'the full attention list still carries every kind (unchanged selector)')
  assert.ok(!actionRequired.some(i=>['message','notification','prescription'].includes(i.kind)),'action-required never duplicates ordinary notification-channel events')
  assert.ok(actionRequired.some(i=>i.kind==='hmo')&&actionRequired.some(i=>i.kind==='followup')&&actionRequired.some(i=>i.kind==='invoice'))
  for(const item of actionRequired)assert.ok(item.page,'every action-required item has a real destination page')
})

test('patientHome still returns the full attention/care shape unchanged (back-compat for existing selectors)',()=>{
  const f=fixture()
  const session=sessionForRole('patient',f.state)
  const home=patientHome(f.state,session)
  assert.ok(Array.isArray(home.attention));assert.ok(Array.isArray(home.care))
})

// ================================================================================================================
// Geo
// ================================================================================================================
test('haversineKm is symmetric, zero for identical points, and Infinity for missing coordinates',()=>{
  const manila={lat:14.5995,lng:120.9842}, cebu={lat:10.3157,lng:123.8854}
  assert.equal(haversineKm(manila,manila),0)
  assert.equal(Math.round(haversineKm(manila,cebu)),Math.round(haversineKm(cebu,manila)))
  assert.ok(haversineKm(manila,cebu)>550&&haversineKm(manila,cebu)<620)
  assert.equal(haversineKm(manila,{lat:null,lng:1}),Infinity)
})

test('nearestBranch returns null honestly when canonical branches carry no coordinates (today, always) or coords are absent',()=>{
  const branches=structuredClone(data.INITIAL_BRANCHES)
  assert.equal(nearestBranch(branches,{lat:14.8,lng:120.9}),null,'no seeded branch has latitude/longitude yet')
  assert.equal(nearestBranch(branches,null),null)
})

test('nearestBranch activates automatically once a branch carries real coordinates, with no other change needed',()=>{
  const branches=structuredClone(data.INITIAL_BRANCHES).map(b=>b.id==='b1'?{...b,latitude:14.83,longitude:120.90}:b.id==='b2'?{...b,latitude:14.60,longitude:121.00}:b)
  const nearer=nearestBranch(branches,{lat:14.83,lng:120.90})
  assert.equal(nearer.id,'b1')
  assert.equal(nearestBranch(branches,{lat:14.60,lng:121.00}).id,'b2')
  // A branch that is not Open is never suggested even if it has coordinates.
  const closed=branches.map(b=>b.id==='b1'?{...b,status:'Inactive'}:b)
  assert.notEqual(nearestBranch(closed,{lat:14.83,lng:120.90})?.id,'b1')
})

// ================================================================================================================
// Manual-mode single-date search reuses findOpenTimes (no duplicate scheduling implementation)
// ================================================================================================================
test('a 1-day findOpenTimes window returns only that date\'s legitimate times, matching Manual booking\'s Time step',()=>{
  const f=fixture()
  const results=findOpenTimes(f.state,{branchId:'b1',serviceId:'svc1',patientId:'p1'},{startDate:'2026-09-20',windowDays:1,limit:50})
  assert.ok(results.length>0)
  for(const slot of results)assert.equal(slot.date,'2026-09-20')
})

// ================================================================================================================
// Source guards
// ================================================================================================================
test('mobile Patient navigation is exactly four items: Home, Book, Visits, Menu (Me is no longer a primary destination)',()=>{
  const src=read('src/layout.jsx')
  const match=src.match(/const mobilePatientNav=(\[.*?\]\.filter)/)
  assert.ok(match,'mobilePatientNav literal found')
  const labels=[...match[1].matchAll(/'([A-Za-z]+)'\]/g)].map(x=>x[1])
  assert.deepEqual(labels,['Home','Book','Visits'],'the array itself holds the three page destinations')
  assert.doesNotMatch(match[1],/'me'/,'"me" is not a primary mobile-nav destination')
  assert.match(src,/<span>Menu<\/span>/,'a fourth, static Menu trigger opens the Patient menu sheet')
  assert.match(src,/export function PatientMenuSheet/,'the Menu sheet is its own component, reachable from the bottom nav')
})

// ================================================================================================================
// Pass 1 Patient mobile UX remediation: single menu entry point, Patient-only assistant, confirmed logout.
// ================================================================================================================
test('Patient has exactly one menu entry point: the top-left workspace hamburger is gated away from Patient, unchanged for other roles',()=>{
  const src=read('src/layout.jsx')
  assert.match(src,/role!==['"]patient['"]&&<button className="mobile-menu/,'the top-left hamburger only renders for non-Patient roles')
})
test('the Clinic Assistant renders only for the Patient role — no fallback variant for Staff/Dentist/Owner',()=>{
  const src=read('src/layout.jsx')
  assert.match(src,/role==='patient'&&<ClinicAssistant/,'ClinicAssistant is rendered only when role is patient')
  assert.doesNotMatch(src,/:<ClinicAssistant/,'no ternary fallback renders ClinicAssistant for another role')
  assert.doesNotMatch(src,/function ClinicAssistant\(\{role/,'ClinicAssistant no longer takes a role/patient prop — it has exactly one shape now')
})
test('the Patient Menu is the single navigation source for care and account destinations',()=>{
  const src=read('src/layout.jsx')
  assert.match(src,/MENU_GROUPS=\[/,'the Menu sheet uses a grouped, curated destination list')
  for(const heading of ['Bookings','Communications','Account'])assert.match(src,new RegExp(`'${heading}'`),`Menu group: ${heading}`)
  for(const destination of ['hmo','prescriptions','followups','loyalty','me'])assert.ok(src.includes(`['${destination}'`),`Menu destination: ${destination}`)
  assert.doesNotMatch(read('src/pages/PatientMe.jsx'),/aria-label="More"|SECONDARY/,'Profile does not duplicate navigation')
  assert.doesNotMatch(src,/PATIENT_MENU_SECONDARY/,'the old flat secondary-list import is removed (orphaned by the grouped redesign)')
})
test('Patient logout requires explicit confirmation and never fires directly from the Menu sheet',()=>{
  const src=read('src/layout.jsx')
  assert.match(src,/onRequestLogout/,'the Menu sheet requests logout rather than calling onLogout directly')
  assert.match(src,/<ConfirmDialog open=\{logoutConfirmOpen\}/,'Shell owns a real confirmation dialog for logout, not an immediate call')
  assert.match(src,/tone="default"/,'the logout dialog uses the non-destructive tone — a session ends, Patient data is not deleted')
})
test('booking-drafts.js and geo.js contain no forbidden patterns',()=>{
  for(const file of ['src/booking-drafts.js','src/geo.js','src/pages/PatientBook.jsx']){
    const src=read(file)
    for(const forbidden of [/Date\.now\(/,/Math\.random\(/,/dentists\[0\]/,/setTimeout\(/,/paymentPreference/,/PayMongo/i,/\botp\b/i,/overdue|past due|payment deadline/i])
      assert.doesNotMatch(src,forbidden,`${file}: ${forbidden}`)
  }
})
test('the assistant FAB CSS clears the mobile bottom nav and a sticky booking footer',()=>{
  const css=read('src/patient.css')
  assert.match(css,/assistant-fab\.is-patient/)
  assert.match(css,/--pt-bottom-nav/)
  assert.match(css,/:has\(\.pt-stage-footer\)/)
})
test('PHASE4B3_ONBOARDING_BOOKING.md documents the 4B.3C-1 Patient UX and Booking Draft architecture',()=>{
  const doc=read('PHASE4B3_ONBOARDING_BOOKING.md')
  for(const text of ['4B.3C-1','Booking Draft','BOOKING DRAFT','Smart Find','Manual booking','nearestBranch','assistant','Me'])
    assert.ok(new RegExp(text,'i').test(doc),text)
})
