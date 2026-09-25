import { canAccessPage } from '../src/safeguards.js'
import { readCollection, writeCollection } from '../src/persistence.js'
import { csvCell } from '../src/logic.js'
import { visibleInvoices, visiblePrescriptions } from '../src/phase2.js'
import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import * as data from '../src/data.js'
import { clinicNow, setClockSource } from '../src/clock.js'
import { normalizeClinicState, sessionForRole, persistableCollection } from '../src/contracts.js'
import { createWorkflowActions } from '../src/workflow.js'
import { pendingHours, visibleHmo, visibleNotifications, visibleConversations, notificationDestination, missingRequirements } from '../src/phase3-contracts.js'
import { automationSnapshot } from '../src/orchestration.js'

let instant
beforeEach(()=>{instant='2026-09-19T02:08:00Z';setClockSource(()=>new Date(instant))})
const seedKeys={persons:'PERSONS',services:'SERVICES',branchServices:'BRANCH_SERVICES',dentistServiceAssignments:'DENTIST_SERVICE_ASSIGNMENTS',branches:'BRANCHES',dentists:'DENTISTS',staff:'STAFF',patients:'PATIENTS',users:'USERS',automations:'AUTOMATIONS'}
function fixture(patch={}) {
  const seeds=Object.fromEntries(Object.entries(seedKeys).map(([k,v])=>[k,structuredClone(data[`INITIAL_${v}`])]))
  seeds.users.push({id:'u13',personId:'per-p2',roleName:'Patient',status:'Active',permissions:['patient-portal']})
  seeds.patients=seeds.patients.map(p=>p.id==='p2'?{...p,userId:'u13'}:p)
  let state=normalizeClinicState({...seeds,appointments:[],queue:[],checkIns:[],treatments:[],invoices:[],prescriptions:[],followups:[],hmo:[],conversations:[],inquiries:[],notifications:[],workflowLog:[],audit:[],...patch})
  let session=sessionForRole('staff',state)
  const actions=createWorkflowActions({getState:()=>state,getSession:()=>session,commit:p=>{state=normalizeClinicState({...state,...p})}})
  return {actions,get state(){return state},get session(){return session},role(role,overrides={}){session={...sessionForRole(role,state),...overrides}},patch(p){state=normalizeClinicState({...state,...p})}}
}
const ok=result=>{assert.equal(result.ok,true,result.message);return result.record}
const form={patientId:'p1',branchId:'b1',dentistId:'d1',serviceId:'svc1',date:'2026-09-19',start:'11:00'}
function book(f,patch={}){return ok(f.actions.saveAppointment({...form,...patch}))}
function create(f){const a=book(f);return ok(f.actions.createHmoCase({appointmentId:a.id}))}
function ready(f,h=create(f)){for(const r of h.requirements)ok(f.actions.provideHmoRequirement(h.id,r.ruleId,{fileName:`${r.ruleId}.pdf`}));return f.state.hmo.find(x=>x.id===h.id)}
function submit(f,h=ready(f),commandId='submit-1'){return ok(f.actions.submitHmoCase(h.id,{commandId,method:'Portal',note:'Staff recorded external submission'}))}
const response=(h,outcome='Approved',commandId='response-1')=>({caseId:h.id,submissionCycle:h.submissionCycle,outcome,commandId,method:'Email',note:'Internal externally received response',requirementIds:outcome==='Returned'?['valid-id']:[]})
function contact(f,h,commandId='contact-1'){return ok(f.actions.followUpHmo(h.id,{submissionCycle:h.submissionCycle,commandId,method:'Phone',note:'Internal contact note',nextAction:'Await response'}))}
function complete(f,patch={}) {
  const a=book(f),q=ok(f.actions.checkInAppointment(a.id));f.role('dentist');ok(f.actions.updateQueue(q.id,'Called'));ok(f.actions.saveTreatment({queueEntryId:q.id}));return ok(f.actions.completeTreatment({queueEntryId:q.id,procedure:'Documented procedure',procedures:[{serviceId:'svc1',quantity:1}],...patch}))
}
function thread(f,patch={}) {
  const c={id:'c1',patientId:'p1',branchId:'b1',assignedUserId:'u2',participantUserIds:['u12','u2','u3'],unreadUserIds:['u12','u2','u3'],status:'Open',messages:[],readAtByUser:{},...patch}
  f.patch({conversations:[c]});return f.state.conversations[0]
}


// Phase 3.5: adversarial cases against the protected Phase 3 checkpoint.
test('forged Patient identity cannot book or receive another patient record',()=>{const f=fixture();f.role('patient',{patientId:'p2'});assert.equal(f.actions.saveAppointment({...form,patientId:'p2'}).ok,false)})
test('forged role cannot use an active Patient account as Staff',()=>{const f=fixture();f.role('staff',{userId:'u12'});assert.equal(f.actions.saveAppointment(form).ok,false)})
test('removed Staff branch is revalidated after the session was opened',()=>{const f=fixture();f.patch({users:f.state.users.map(u=>u.id==='u2'?{...u,branchId:'b2'}:u)});assert.equal(f.actions.saveAppointment(form).ok,false)})
test('removed appointment permission blocks shared booking command',()=>{const f=fixture();f.patch({users:f.state.users.map(u=>u.id==='u2'?{...u,permissions:[]}:u)});assert.equal(f.actions.saveAppointment(form).ok,false)})
test('booking retry cannot expose another patient through a reused command ID',()=>{const f=fixture();ok(f.actions.saveAppointment({...form,patientId:'p2'},{commandId:'shared'}));f.role('patient');assert.equal(f.actions.saveAppointment(form,{commandId:'shared'}).ok,false)})
test('walk-in retry cannot return another patient encounter',()=>{const f=fixture();ok(f.actions.admitWalkIn(form,'shared'));assert.equal(f.actions.admitWalkIn({...form,patientId:'p2'},'shared').ok,false)})
test('queue cannot change a cancelled linked appointment to No-show',()=>{const f=fixture(),a=book(f),q=ok(f.actions.checkInAppointment(a.id));f.patch({appointments:[{...f.state.appointments[0],status:'Cancelled'}]});assert.equal(f.actions.updateQueue(q.id,'No-show').ok,false);assert.equal(f.state.appointments[0].status,'Cancelled')})
test('cancellation does not close a queue linked to another patient',()=>{const f=fixture(),a=book(f),q=ok(f.actions.checkInAppointment(a.id));f.patch({queue:[{...q,patientId:'p2'}]});assert.equal(f.actions.cancelAppointment(a.id).ok,false);assert.equal(f.state.queue[0].status,'Waiting')})
test('appointment cannot reschedule when queue survives a missing check-in row',()=>{const f=fixture(),a=book(f);f.patch({queue:[{id:'q',appointmentId:a.id,patientId:'p1',dentistId:'d1',branchId:'b1',clinicDate:form.date,status:'Waiting'}]});assert.equal(f.actions.saveAppointment({...form,start:'13:00'},{appointmentId:a.id}).ok,false)})
test('completed appointment cannot be overwritten by an active treatment draft',()=>{const f=fixture(),a=book(f),q=ok(f.actions.checkInAppointment(a.id));f.role('dentist');ok(f.actions.updateQueue(q.id,'Called'));f.patch({appointments:[{...f.state.appointments[0],status:'Completed'}]});assert.equal(f.actions.saveTreatment({queueEntryId:q.id}).ok,false)})
test('missing Dentist account prevents new booking',()=>{const f=fixture();f.patch({users:f.state.users.filter(u=>u.id!=='u3')});assert.equal(f.actions.saveAppointment(form).ok,false)})
test('malformed time input returns validation instead of throwing',()=>{const f=fixture();assert.equal(f.actions.saveAppointment({...form,start:1234}).ok,false)})
test('missing treatment form returns a recoverable failure',()=>{const f=fixture();f.role('dentist');assert.equal(f.actions.saveTreatment().ok,false)})
test('prescription authorization rejects a completed treatment with broken queue identity',()=>{const f=fixture(),t=complete(f,{prescriptionRequired:true});f.patch({queue:f.state.queue.map(q=>q.id===t.queueEntryId?{...q,patientId:'p2'}:q)});assert.equal(f.actions.authorizePrescription({treatmentId:t.id,items:[{medication:'Medicine',dosage:'Dose',instructions:'Instructions'}]}).ok,false)})
test('paid invoice replay must validate branch and receipt payment links',()=>{const f=fixture();complete(f);f.role('staff');const i=f.state.invoices[0];ok(f.actions.reviewInvoice(i.id));ok(f.actions.issueInvoice(i.id));const paid=ok(f.actions.postPayment(i.id,'Cash',i.total));f.patch({invoices:[{...paid,payment:{...paid.payment,branchId:'b2',receipt:'wrong'}}]});assert.equal(f.actions.postPayment(i.id,'Cash',i.total).ok,false);f.role('patient');assert.equal(visibleInvoices(f.state,f.session).length,0)})
test('HMO impossible calendar timestamp cannot count as pending time',()=>{assert.equal(pendingHours({status:'Pending',submittedAt:'2026-02-30T10:00:00+08:00'}),0)})

test('patient receipt selector hides a paid invoice without payment evidence',()=>{const f=fixture();complete(f);const i=f.state.invoices[0];f.patch({invoices:[{...i,status:'Paid',paymentStatus:'Paid',receipt:'invented'}]});f.role('patient');assert.equal(visibleInvoices(f.state,f.session).length,0)})
test('notification cannot navigate Patient to a draft prescription',()=>{const f=fixture(),t=complete(f,{prescriptionRequired:true}),rx=ok(f.actions.savePrescription({treatmentId:t.id,items:[]}));f.role('patient');assert.equal(notificationDestination(f.state,f.session,{recipientUserId:'u12',patientId:'p1',entityType:'prescription',entityId:rx.id,action:{page:'prescriptions'}}),null)})
test('notification cannot navigate Patient to an unissued invoice',()=>{const f=fixture();complete(f);const i=f.state.invoices[0];f.role('patient');assert.equal(notificationDestination(f.state,f.session,{recipientUserId:'u12',patientId:'p1',entityType:'invoice',entityId:i.id,action:{page:'billing'}}),null)})
test('malformed conversation participant collections fail closed without render crashes',()=>{const f=fixture({conversations:[{id:'bad',patientId:'p1',participantUserIds:'u12',messages:[null],unreadUserIds:'u12'}]});f.role('patient');assert.equal(visibleConversations(f.state,f.session).length,0)})
test('Dentist cannot read or reply after messages permission removal',()=>{const f=fixture();thread(f);f.role('dentist');f.patch({users:f.state.users.map(u=>u.id==='u3'?{...u,permissions:[]}:u)});assert.equal(visibleConversations(f.state,f.session).length,0);assert.equal(f.actions.replyToConversation('c1','Hello','new').ok,false)})
test('Patient HMO upload result excludes internal response notes',()=>{const f=fixture(),h=submit(f);ok(f.actions.recordHmoOutcome(h.id,response(h,'Returned')));f.role('patient');const result=ok(f.actions.provideHmoRequirement(h.id,'valid-id',{fileName:'corrected.pdf'}));assert.equal(result.responses,undefined);assert.equal(result.contacts,undefined)})
test('schema3 provider approval without external response is withheld from Patient',()=>{const f=fixture(),h=create(f);f.patch({hmo:[{...h,status:'Approved',providerOutcome:'Approved'}]});f.role('patient');assert.equal(visibleHmo(f.state,f.session).length,0)})
test('future HMO contact cannot authorize escalation',()=>{const f=fixture(),h=submit(f);instant='2026-09-19T15:08:00Z';contact(f,h);f.patch({hmo:f.state.hmo.map(h=>({...h,contacts:h.contacts.map(c=>({...c,at:'2027-01-01T10:00:00+08:00'}))}))});assert.equal(f.actions.escalateHmo(h.id).ok,false)})
test('whitespace configured procedure fee is invalid, not a free procedure',()=>{const f=fixture(),a=book(f),q=ok(f.actions.checkInAppointment(a.id));f.role('dentist');ok(f.actions.updateQueue(q.id,'Called'));ok(f.actions.saveTreatment({queueEntryId:q.id}));f.patch({services:f.state.services.map(s=>s.id==='svc1'?{...s,baseFee:'   '}:s)});assert.equal(f.actions.completeTreatment({queueEntryId:q.id,procedure:'Done',procedures:[{serviceId:'svc1',quantity:1}]}).ok,false)})
test('non-text prescription contents cannot be authorized as object strings',()=>{const f=fixture(),t=complete(f,{prescriptionRequired:true});assert.equal(f.actions.authorizePrescription({treatmentId:t.id,items:[{medication:{bad:true},dosage:'Dose',instructions:'Instructions'}]}).ok,false)})
test('Owner account creation rejects unknown role and nonexistent branch',()=>{const f=fixture();f.role('owner');const input={firstName:'New',lastName:'User',email:'new@example.test',roleName:'Invented',branchId:'b1'};assert.equal(f.actions.createUserAccount(input).ok,false);assert.equal(f.actions.createUserAccount({...input,roleName:'Receptionist',branchId:'missing'}).ok,false)})
test('Patient cannot create accounts or deactivate users through shared actions',()=>{const f=fixture();f.role('patient');assert.equal(f.actions.createUserAccount({}).ok,false);assert.equal(f.actions.setUserStatus('u2','Inactive').ok,false)})
test('Owner status assignment is repeat safe and cannot deactivate current account',()=>{const f=fixture();f.role('owner');ok(f.actions.setUserStatus('u2','Inactive'));const n=f.state.workflowLog.length;assert.equal(f.actions.setUserStatus('u2','Inactive').unchanged,true);assert.equal(f.state.workflowLog.length,n);assert.equal(f.actions.setUserStatus('u1','Inactive').ok,false)})
for(const [label,collection,userId,profileId] of [['Staff','staff','u2','s1'],['Dentist','dentists','u3','d1']]){
  test(`${label} account deactivation preserves backend-authoritative availability`,()=>{
    const f=fixture();f.role('owner')
    const before=structuredClone({staff:f.state.staff,dentists:f.state.dentists})
    assert.equal(f.state[collection].find(p=>p.id===profileId).available,true)
    ok(f.actions.setUserStatus(userId,'Inactive'))
    const user=f.state.users.find(u=>u.id===userId)
    assert.equal(user.accountStatus,'Inactive');assert.equal(user.status,'Inactive')
    assert.deepEqual({staff:f.state.staff,dentists:f.state.dentists},before)
  })
  test(`${label} account activation preserves independently unavailable profile`,()=>{
    const f=fixture();f.role('owner')
    f.patch({users:f.state.users.map(u=>u.id===userId?{...u,status:'Inactive',accountStatus:'Inactive'}:u),
      [collection]:f.state[collection].map(p=>p.id===profileId?{...p,available:false}:p)})
    const before=structuredClone({staff:f.state.staff,dentists:f.state.dentists})
    ok(f.actions.setUserStatus(userId,'Active'))
    const user=f.state.users.find(u=>u.id===userId)
    assert.equal(user.accountStatus,'Active');assert.equal(user.status,'Active')
    assert.deepEqual({staff:f.state.staff,dentists:f.state.dentists},before)
  })
}
test('branch configuration rejects impossible hours and nonfinite threshold',()=>{const f=fixture();f.role('owner');assert.equal(f.actions.saveBranch('b1',{...f.state.branches[0],open:'18:00',close:'09:00'}).ok,false);assert.equal(f.actions.saveBranch('b1',{...f.state.branches[0],threshold:Infinity}).ok,false)})
test('Staff cannot mutate branches or personnel through shared commands',()=>{const f=fixture();assert.equal(f.actions.saveBranch('b1',{}).ok,false);assert.equal(f.actions.savePersonnel('dentists','d1',{}).ok,false)})

for(const [label,change] of [
  ['inactive account',f=>f.patch({users:f.state.users.map(u=>u.id==='u2'?{...u,accountStatus:'Inactive'}:u)})],
  ['missing Staff profile',f=>f.patch({staff:f.state.staff.filter(s=>s.userId!=='u2')})],
  ['missing person',f=>f.patch({persons:f.state.persons.filter(p=>p.id!=='per-s1')})],
  ['expired session',f=>f.role('staff',{expiresAt:'2026-09-18T00:00:00Z'})],
])test(`${label} invalidates a previously available command`,()=>{const f=fixture(),a=book(f);change(f);assert.equal(f.actions.checkInAppointment(a.id).ok,false);assert.equal(f.state.queue.length,0)})
test('valid Patient rejects a form explicitly identifying another patient',()=>{const f=fixture();f.role('patient');assert.equal(f.actions.saveAppointment({...form,patientId:'p2'}).ok,false)})
test('rescheduling cannot change patient identity',()=>{const f=fixture(),a=book(f);assert.equal(f.actions.saveAppointment({...form,patientId:'p2',start:'13:00'},{appointmentId:a.id}).ok,false)})
test('stale reschedule revision cannot overwrite a newer appointment',()=>{const f=fixture(),a=book(f);ok(f.actions.saveAppointment({...form,start:'12:00'},{appointmentId:a.id,commandId:'newer',expectedRevision:a.revision}));assert.equal(f.actions.saveAppointment({...form,start:'13:00'},{appointmentId:a.id,commandId:'older',expectedRevision:a.revision}).ok,false);assert.equal(f.state.appointments[0].start,'12:00')})
test('HMO-linked appointment cannot silently move its case to another branch',()=>{const f=fixture(),h=create(f);f.role('owner');assert.equal(f.actions.saveAppointment({...form,branchId:'b2',dentistId:'d3'},{appointmentId:h.appointmentId}).ok,false)})
for(const status of ['Completed','No-show','Cancelled','In Treatment','Unexpected'])test(`reschedule rejects ${status} current state`,()=>{const f=fixture(),a=book(f);f.patch({appointments:[{...a,status}]});assert.equal(f.actions.saveAppointment({...form,start:'13:00'},{appointmentId:a.id}).ok,false)})
test('duplicate queue links block check-in retry and terminal queue cannot reopen',()=>{const f=fixture(),a=book(f),q=ok(f.actions.checkInAppointment(a.id));f.patch({queue:[q,{...q,id:'duplicate'}]});assert.equal(f.actions.checkInAppointment(a.id).ok,false);assert.equal(f.actions.updateQueue(q.id,'Called').ok,false)})
test('malformed appointment clock cannot be accepted as a late arrival',()=>{const f=fixture(),a=book(f);f.patch({appointments:[{...a,start:'10:99'}]});assert.equal(f.actions.checkInAppointment(a.id).ok,false)})
test('stale admission after cancellation never creates arrival records',()=>{const f=fixture(),a=book(f);ok(f.actions.cancelAppointment(a.id));assert.equal(f.actions.checkInAppointment(a.id).ok,false);assert.equal(f.state.queue.length,0)})
test('wrong check-in patient blocks treatment and leaves all business records intact',()=>{const f=fixture(),a=book(f),q=ok(f.actions.checkInAppointment(a.id));f.role('dentist');ok(f.actions.updateQueue(q.id,'Called'));f.patch({checkIns:f.state.checkIns.map(c=>({...c,patientId:'p2'}))});const before=structuredClone(f.state);assert.equal(f.actions.saveTreatment({queueEntryId:q.id}).ok,false);assert.deepEqual(f.state,before)})
test('stale draft cannot overwrite newer clinical notes or a completed treatment',()=>{const f=fixture(),a=book(f),q=ok(f.actions.checkInAppointment(a.id));f.role('dentist');ok(f.actions.updateQueue(q.id,'Called'));const t=ok(f.actions.saveTreatment({queueEntryId:q.id}));ok(f.actions.saveTreatment({queueEntryId:q.id,revision:t.revision,notes:'new'}));assert.equal(f.actions.saveTreatment({queueEntryId:q.id,revision:t.revision,notes:'old'}).ok,false);ok(f.actions.completeTreatment({queueEntryId:q.id,procedure:'Done',procedures:[{serviceId:'svc1',quantity:1}]}));assert.equal(f.actions.saveTreatment({queueEntryId:q.id,notes:'old'}).ok,false);assert.equal(f.state.queue[0].status,'Completed')})
test('removed treating branch prevents prescription authorization',()=>{const f=fixture(),t=complete(f,{prescriptionRequired:true});f.patch({dentists:f.state.dentists.map(d=>d.id==='d1'?{...d,branchIds:[]}:d)});assert.equal(f.actions.authorizePrescription({treatmentId:t.id,items:[{medication:'M',dosage:'D',instructions:'I'}]}).ok,false)})
test('authorized prescription stays immutable under stale draft and authorize retries',()=>{const f=fixture(),t=complete(f,{prescriptionRequired:true});const rx=ok(f.actions.authorizePrescription({treatmentId:t.id,items:[{medication:'M',dosage:'D',instructions:'I'}]}));ok(f.actions.savePrescription({treatmentId:t.id,items:[]}));assert.deepEqual(f.state.prescriptions[0],rx)})
test('stale prescription draft revision cannot erase newer medication',()=>{const f=fixture(),t=complete(f,{prescriptionRequired:true}),rx=ok(f.actions.savePrescription({treatmentId:t.id,items:[]}));ok(f.actions.savePrescription({treatmentId:t.id,revision:rx.revision,items:[{medication:'New'}]}));assert.equal(f.actions.savePrescription({treatmentId:t.id,revision:rx.revision,items:[]}).ok,false)})
test('Paid is terminal for review and payment evidence is required for issue replay',()=>{const f=fixture();complete(f);f.role('staff');const i=f.state.invoices[0];ok(f.actions.reviewInvoice(i.id));ok(f.actions.issueInvoice(i.id));const paid=ok(f.actions.postPayment(i.id,'Cash',i.total));assert.equal(f.actions.reviewInvoice(i.id).ok,false);f.patch({invoices:[{...paid,payment:undefined}]});assert.equal(f.actions.issueInvoice(i.id).ok,false)})
test('stale follow-up cancellation can recover through validated rebooking',()=>{const f=fixture();complete(f,{followupRequired:true});f.role('staff');const follow=f.state.followups[0],a=ok(f.actions.saveAppointment({...form,start:'13:00'},{followupId:follow.id}));f.patch({appointments:f.state.appointments.map(x=>x.id===a.id?{...x,status:'Cancelled'}:x)});const replacement=ok(f.actions.saveAppointment({...form,start:'14:00'},{followupId:follow.id}));assert.notEqual(replacement.id,a.id);assert.equal(f.state.followups[0].appointmentId,replacement.id);assert.equal(f.state.followups[0].status,'Scheduled')})
test('failed follow-up rebooking leaves original relationship unchanged',()=>{const f=fixture();complete(f,{followupRequired:true});f.role('staff');const follow=f.state.followups[0],a=ok(f.actions.saveAppointment({...form,start:'13:00'},{followupId:follow.id}));f.patch({appointments:f.state.appointments.map(x=>x.id===a.id?{...x,status:'Cancelled'}:x)});const before=structuredClone(f.state.followups);assert.equal(f.actions.saveAppointment({...form,start:'99:00'},{followupId:follow.id}).ok,false);assert.deepEqual(f.state.followups,before)})
test('new HMO case rejects explicit wrong provider and cancelled encounter',()=>{const f=fixture(),a=book(f);assert.equal(f.actions.createHmoCase({appointmentId:a.id,providerId:'hmo-healthfirst'}).ok,false);ok(f.actions.cancelAppointment(a.id));assert.equal(f.actions.createHmoCase({appointmentId:a.id}).ok,false)})
test('closed thread rejects new reply without changing other unread state',()=>{const f=fixture();thread(f);ok(f.actions.closeConversation('c1'));const before=structuredClone(f.state.conversations);assert.equal(f.actions.replyToConversation('c1','Late reply','late').ok,false);assert.deepEqual(f.state.conversations,before)})
test('midnight prevents yesterday walk-in replay from acting as new admission',()=>{const f=fixture();ok(f.actions.admitWalkIn(form,'walk'));instant='2026-09-19T16:01:00Z';assert.equal(f.actions.admitWalkIn(form,'walk').ok,false);assert.equal(f.state.queue.length,1)})
test('old-day queue notification has no misleading current-queue destination',()=>{const f=fixture(),a=book(f);ok(f.actions.checkInAppointment(a.id));f.role('patient');const n=visibleNotifications(f.state,f.session).find(n=>n.entityType==='queue');instant='2026-09-19T16:01:00Z';assert.equal(notificationDestination(f.state,f.session,n),null)})
test('removed permission prevents direct screen access',()=>{const f=fixture();assert.equal(canAccessPage(f.state,f.session,'billing'),true);f.patch({users:f.state.users.map(u=>u.id==='u2'?{...u,permissions:[]}:u)});assert.equal(canAccessPage(f.state,f.session,'billing'),false);f.role('patient');assert.equal(canAccessPage(f.state,f.session,'users'),false)})
test('personnel branch and user assignment stay synchronized',()=>{const f=fixture();f.role('owner');ok(f.actions.savePersonnel('staff','s1',{branchId:'b2',shiftStart:'09:00',shiftEnd:'18:00'}));assert.equal(f.state.staff.find(s=>s.id==='s1').branchId,'b2');assert.equal(f.state.users.find(u=>u.id==='u2').branchId,'b2')})
test('branch service retries set desired state rather than toggling twice',()=>{const f=fixture();f.role('owner');ok(f.actions.setBranchService('b1','svc1',false));const count=f.state.workflowLog.length;assert.equal(f.actions.setBranchService('b1','svc1',false).unchanged,true);assert.equal(f.state.workflowLog.length,count)})
test('new account retries never duplicate linked identity profiles',()=>{const f=fixture();f.role('owner');const input={firstName:'New',lastName:'User',email:'new@example.test',roleName:'Receptionist',branchId:'b1'};ok(f.actions.createUserAccount(input));assert.equal(f.actions.createUserAccount(input).ok,false);assert.equal(f.state.users.filter(u=>u.username==='new@example.test').length,1)})
test('patient update revalidates account permission and required demographics',()=>{const f=fixture();assert.equal(f.actions.updatePatientRecord('p1',{person:{firstName:'   '}}).ok,false);f.patch({users:f.state.users.map(u=>u.id==='u2'?{...u,permissions:[]}:u)});assert.equal(f.actions.updatePatientRecord('p1',{person:{firstName:'Changed'}}).ok,false)})
test('unreadable storage remains untouched and reports recovery requirement',()=>{const storage={getItem:()=>'{broken',setItem:()=>assert.fail('must not overwrite')};const read=readCollection(storage,'dentalops-v4-appointments',[]);assert.equal(read.blocked,true);assert.match(read.error,/not been overwritten/)})
test('storage quota failure reports unsaved changes instead of claiming persistence',()=>{assert.equal(writeCollection({setItem(){throw new Error('quota')}},'test',[]).ok,false)})
test('CSV export neutralizes spreadsheet formulas while preserving quoted human text',()=>{assert.equal(csvCell('=1+1'),'"\'=1+1"');assert.equal(csvCell('Maria "M" Santos'),'"Maria ""M"" Santos"')})

test('arrival timestamp in the future cannot advance a queue',()=>{const f=fixture(),a=book(f),q=ok(f.actions.checkInAppointment(a.id));f.patch({queue:[{...q,arrivedAt:'2026-09-19T18:00:00+08:00'}]});assert.equal(f.actions.updateQueue(q.id,'Called').ok,false)})
test('UTC arrival timestamps are interpreted on the Manila clinic day',()=>{const f=fixture(),a=book(f),q=ok(f.actions.checkInAppointment(a.id));f.patch({queue:[{...q,arrivedAt:'2026-09-18T23:50:00Z'}]});assert.equal(f.actions.updateQueue(q.id,'Called').ok,true)})
test('missing canonical IDs in storage require recovery without overwriting data',()=>{assert.equal(readCollection({getItem:()=>JSON.stringify([{}])},'test',[]).blocked,true)})
test('removed financial permission hides financial selectors',()=>{const f=fixture();complete(f);f.role('staff');f.patch({users:f.state.users.map(u=>u.id==='u2'?{...u,permissions:[]}:u)});assert.equal(visibleInvoices(f.state,f.session).length,0)})
test('patient identity input rejects impossible DOB and object-valued names',()=>{const f=fixture();for(const person of [{firstName:{name:'New'},lastName:'Patient',phone:'123'},{firstName:'New',lastName:'Patient',phone:'123',dob:'2026-02-30'}])assert.equal(f.actions.createPatientRecord({person,patient:{}}).ok,false)})

test('malformed HMO submission cycle cannot strand a new submission',()=>{const f=fixture(),h=ready(f);f.patch({hmo:[{...h,submissionCycle:'0'}]});assert.equal(f.actions.submitHmoCase(h.id,{commandId:'bad-cycle',method:'Portal',note:'Externally submitted'}).ok,false);assert.equal(f.state.hmo[0].status,'Ready for Submission')})
test('non-text emergency reason cannot authorize priority',()=>{const f=fixture(),a=book(f),q=ok(f.actions.checkInAppointment(a.id));assert.equal(f.actions.updateQueue(q.id,'Waiting',{priority:'Urgent',reason:{fake:true}}).ok,false);assert.equal(f.state.queue[0].priority,'Normal')})
test('removed follow-up permission blocks direct obligation scheduling',()=>{const f=fixture();complete(f,{followupRequired:true});f.role('staff');f.patch({users:f.state.users.map(u=>u.id==='u2'?{...u,permissions:u.permissions.filter(p=>p!=='followups')}:u)});assert.equal(f.actions.saveAppointment({...form,start:'13:00'},{followupId:f.state.followups[0].id}).ok,false)})
test('boolean and collection numeric payloads never become procedure or payment amounts',()=>{const f=fixture(),a=book(f),q=ok(f.actions.checkInAppointment(a.id));f.role('dentist');ok(f.actions.updateQueue(q.id,'Called'));ok(f.actions.saveTreatment({queueEntryId:q.id}));for(const quantity of [true,[1],{}])assert.equal(f.actions.completeTreatment({queueEntryId:q.id,procedure:'Done',procedures:[{serviceId:'svc1',quantity}]}).ok,false);ok(f.actions.completeTreatment({queueEntryId:q.id,procedure:'Done',procedures:[{serviceId:'svc1',quantity:1}]}));f.role('staff');const i=f.state.invoices[0];ok(f.actions.reviewInvoice(i.id));ok(f.actions.issueInvoice(i.id));assert.equal(f.actions.postPayment(i.id,'Cash',[i.total]).ok,false)})
