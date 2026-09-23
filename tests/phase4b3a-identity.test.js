import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import * as data from '../src/data.js'
import { setClockSource } from '../src/clock.js'
import { normalizeClinicState, sessionForRole, sessionForUser, resolvePatientLogin, persistableCollection } from '../src/contracts.js'
import { createWorkflowActions } from '../src/workflow.js'
import { createRegistrationAction } from '../src/registration.js'
import { readCollection, writeCollection } from '../src/persistence.js'
import { patientHomeMode, patientContext, patientAppointments } from '../src/patient-view.js'

beforeEach(()=>setClockSource(()=>new Date('2026-09-19T02:08:00Z')))   // 2026-09-19 10:08 Manila

// ---- Fixture --------------------------------------------------------------------------------------------------

const seedKeys={persons:'PERSONS',services:'SERVICES',branchServices:'BRANCH_SERVICES',dentistServiceAssignments:'DENTIST_SERVICE_ASSIGNMENTS',branches:'BRANCHES',dentists:'DENTISTS',staff:'STAFF',patients:'PATIENTS',users:'USERS',automations:'AUTOMATIONS'}
function fixture(patch={}) {
  const seeds=Object.fromEntries(Object.entries(seedKeys).map(([k,v])=>[k,structuredClone(data[`INITIAL_${v}`])]))
  let state=normalizeClinicState({...seeds,appointments:[],queue:[],checkIns:[],treatments:[],invoices:[],prescriptions:[],followups:[],hmo:[],conversations:[],inquiries:[],notifications:[],workflowLog:[],audit:[],loyalty:[],...patch})
  let session=null
  const actions=createWorkflowActions({getState:()=>state,getSession:()=>session,commit:p=>{state=normalizeClinicState({...state,...p})}})
  const register=createRegistrationAction({getState:()=>state,commit:p=>{state=normalizeClinicState({...state,...p})}})
  return {
    actions,register,
    get state(){return state},get session(){return session},
    role(role,overrides={}){session={...sessionForRole(role,state),...overrides};return session},
    setSession(s){session=s},
    patch(p){state=normalizeClinicState({...state,...p})},
  }
}
const ok=result=>{assert.equal(result.ok,true,result.message);return result.record}
const bad=(result,pattern)=>{assert.equal(result.ok,false,'expected the command to fail');if(pattern)assert.match(result.message,pattern);return result}
const validForm=(overrides={})=>({firstName:'Jamie',lastName:'Cruz',phone:'0917 555 0001',email:'jamie.cruz@example.com',dob:'',preferredBranchId:'b1',...overrides})
const findByEmail=(f,email)=>{
  const person=f.state.persons.find(p=>p.email?.toLowerCase()===email.toLowerCase())
  const user=person&&f.state.users.find(u=>u.personId===person.id)
  const patient=person&&f.state.patients.find(p=>p.personId===person.id)
  return {person,user,patient}
}

// ---- Registration -----------------------------------------------------------------------------------------------

test('a valid new Patient registers: PERSON + PATIENT + USER created atomically and linked',()=>{
  const f=fixture()
  const record=ok(f.register(validForm(),'reg-1'))
  const {person,user,patient}=findByEmail(f,'jamie.cruz@example.com')
  assert.deepEqual([record.personId,record.patientId,record.userId],[person.id,patient.id,user.id])
  assert.equal(person.firstName,'Jamie');assert.equal(person.lastName,'Cruz');assert.equal(person.phone,'0917 555 0001')
  assert.equal(patient.personId,person.id);assert.equal(patient.userId,user.id);assert.equal(patient.preferredBranchId,'b1')
  assert.equal(user.personId,person.id);assert.equal(user.roleName,'Patient');assert.deepEqual(user.permissions,['patient-portal'])
  assert.equal(user.accountStatus,'Active');assert.equal(user.status,'Active')
  // No appointment, loyalty account, HMO case, clinical or financial record is created by registration.
  assert.equal(f.state.appointments.length,0);assert.equal(f.state.loyalty.length,0);assert.equal(f.state.hmo.length,0)
  assert.equal(f.state.treatments.length,0);assert.equal(f.state.invoices.length,0);assert.equal(f.state.prescriptions.length,0)
})

test('email is normalized: case and surrounding whitespace do not create a distinct identity',()=>{
  const f=fixture()
  ok(f.register(validForm({email:'  Jamie.Cruz@Example.com  '}),'reg-1'))
  const {person,user}=findByEmail(f,'jamie.cruz@example.com')
  assert.equal(person.email,'jamie.cruz@example.com');assert.equal(user.username,'jamie.cruz@example.com')
})

test('a duplicate email is rejected: no account uses the same email as an existing Person or User',()=>{
  const f=fixture()
  bad(f.register(validForm({email:'maria@example.com'}),'reg-1'),/already uses this email/)
  bad(f.register(validForm({email:'MARIA@example.com'}),'reg-2'),/already uses this email/)
  assert.equal(f.state.persons.length,data.INITIAL_PERSONS.length)
  ok(f.register(validForm(),'reg-3'))
  bad(f.register(validForm({firstName:'Someone',lastName:'Else',phone:'0917 000 9999'}),'reg-4'),/already uses this email/)
})

test('the Patient duplicate detector blocks a match on phone, or on name plus date of birth, without disclosing the existing record',()=>{
  const f=fixture()
  const byPhone=bad(f.register(validForm({email:'new1@example.com',phone:'0917 123 4567'}),'reg-1'),/existing patient record may already match/)
  assert.doesNotMatch(byPhone.message,/Maria|Santos|p1|per-p1/)
  bad(f.register({firstName:'Maria',lastName:'Santos',phone:'0900 000 0000',dob:'1998-05-17',email:'new2@example.com',preferredBranchId:'b1'},'reg-2'),/existing patient record may already match/)
  // A name match alone, with no dob and no phone match, is not claimed as a duplicate.
  ok(f.register({firstName:'Maria',lastName:'Santos',phone:'0917 555 7777',dob:'',email:'new3@example.com',preferredBranchId:'b1'},'reg-3'))
  assert.equal(f.state.patients.length,data.INITIAL_PATIENTS.length+1)
})

test('malformed payloads fail safely and create nothing',()=>{
  const f=fixture(),before=JSON.stringify([f.state.persons,f.state.patients,f.state.users])
  for(const form of [null,'x',42,[],undefined])assert.equal(f.register(form,'reg-x').ok,false)
  for(const overrides of [
    {firstName:''},{lastName:''},{firstName:'   '},{phone:''},{email:''},{email:'not-an-email'},{email:'a@b'},
    {dob:'not-a-date'},{dob:'2999-01-01'},{preferredBranchId:''},{preferredBranchId:'nonexistent-branch'},
  ])bad(f.register(validForm(overrides),'reg-1'))
  assert.equal(JSON.stringify([f.state.persons,f.state.patients,f.state.users]),before)
})

// A reserved identity/privilege field anywhere in the payload fails the WHOLE request closed — it is not silently
// stripped and the rest of the payload processed. Each case is checked individually with a full before/after
// state snapshot, and with a neutral message that does not name the offending field or leak the allowlist.
test('role/roleName injection is rejected outright, with no state change',()=>{
  const f=fixture(),before=JSON.stringify([f.state.persons,f.state.patients,f.state.users])
  const r1=bad(f.register({...validForm(),role:'Owner / Admin'},'reg-role'),/Enter valid registration details\./)
  const r2=bad(f.register({...validForm(),roleName:'Owner / Admin'},'reg-rolename'))
  assert.doesNotMatch(r1.message,/role|reserved|allow/i)
  assert.equal(JSON.stringify([f.state.persons,f.state.patients,f.state.users]),before)
})

test('permissions injection is rejected outright, with no state change',()=>{
  const f=fixture(),before=JSON.stringify([f.state.persons,f.state.patients,f.state.users])
  bad(f.register({...validForm(),permissions:['all']},'reg-perm'),/Enter valid registration details\./)
  assert.equal(JSON.stringify([f.state.persons,f.state.patients,f.state.users]),before)
})

test('accountStatus injection is rejected outright, with no state change',()=>{
  const f=fixture(),before=JSON.stringify([f.state.persons,f.state.patients,f.state.users])
  bad(f.register({...validForm(),accountStatus:'Inactive'},'reg-status'),/Enter valid registration details\./)
  bad(f.register({...validForm(),status:'Inactive'},'reg-status2'))
  assert.equal(JSON.stringify([f.state.persons,f.state.patients,f.state.users]),before)
})

test('personId injection is rejected outright, with no state change',()=>{
  const f=fixture(),before=JSON.stringify([f.state.persons,f.state.patients,f.state.users])
  bad(f.register({...validForm(),personId:'per-p1'},'reg-personid'),/Enter valid registration details\./)
  assert.equal(JSON.stringify([f.state.persons,f.state.patients,f.state.users]),before)
})

test('patientId injection is rejected outright, with no state change',()=>{
  const f=fixture(),before=JSON.stringify([f.state.persons,f.state.patients,f.state.users])
  bad(f.register({...validForm(),patientId:'p1'},'reg-patientid'),/Enter valid registration details\./)
  assert.equal(JSON.stringify([f.state.persons,f.state.patients,f.state.users]),before)
})

test('userId injection is rejected outright, with no state change',()=>{
  const f=fixture(),before=JSON.stringify([f.state.persons,f.state.patients,f.state.users])
  bad(f.register({...validForm(),userId:'u12'},'reg-userid'),/Enter valid registration details\./)
  assert.equal(JSON.stringify([f.state.persons,f.state.patients,f.state.users]),before)
})

test('a browser-supplied top-level id, username, login or branchId is also rejected outright',()=>{
  const f=fixture(),before=JSON.stringify([f.state.persons,f.state.patients,f.state.users])
  for(const overrides of [{id:'p1'},{username:'maria.santos'},{login:'maria.santos'},{branchId:'b1'},{registrationCommandId:'x'}])
    bad(f.register({...validForm(),...overrides},'reg-extra'),/Enter valid registration details\./)
  assert.equal(JSON.stringify([f.state.persons,f.state.patients,f.state.users]),before)
})

test('a legitimate registration with only allowed fields still succeeds and mints its own IDs',()=>{
  const f=fixture()
  const record=ok(f.register(validForm(),'reg-legit'))
  const user=f.state.users.find(u=>u.id===record.userId)
  assert.equal(user.roleName,'Patient');assert.deepEqual(user.permissions,['patient-portal']);assert.equal(user.accountStatus,'Active');assert.equal(user.branchId,null)
  assert.match(record.personId,/^per-/);assert.match(record.patientId,/^p-/);assert.match(record.userId,/^u-/)
  // Maria's real records are untouched by any of the rejected attempts above or this legitimate one.
  assert.equal(f.state.persons.find(p=>p.id==='per-p1').email,'maria@example.com')
})

test('partial-write prevention: a rejected registration creates no Person, Patient or User row at all',()=>{
  const f=fixture()
  bad(f.register(validForm({email:'maria@example.com'}),'reg-dup'))
  assert.equal(f.state.persons.length,data.INITIAL_PERSONS.length)
  assert.equal(f.state.patients.length,data.INITIAL_PATIENTS.length)
  assert.equal(f.state.users.length,data.INITIAL_USERS.length)
})

test('replaying the same command ID returns the original result and creates nothing new',()=>{
  const f=fixture()
  const first=ok(f.register(validForm(),'reg-1'))
  const again=f.register(validForm({firstName:'Different',lastName:'Name'}),'reg-1')
  assert.equal(again.ok,true);assert.equal(again.unchanged,true)
  assert.deepEqual(again.record,first)
  assert.equal(f.state.persons.length,data.INITIAL_PERSONS.length+1)
})

test('rapid duplicate registration (two different command IDs, same instant) creates exactly one account',()=>{
  const f=fixture()
  const a=ok(f.register(validForm(),'reg-a'))
  const b=f.register(validForm({firstName:'Someone',lastName:'Else',phone:'0917 000 8888'}),'reg-b')
  assert.equal(b.ok,false)
  assert.equal(f.state.persons.filter(p=>p.email==='jamie.cruz@example.com').length,1)
  assert.equal(f.state.patients.length,data.INITIAL_PATIENTS.length+1)
})

// ---- Relationship -------------------------------------------------------------------------------------------

test('the created Person/Patient/User share exactly the canonical person relationship (person_id), not a Patient->User foreign key',()=>{
  const f=fixture()
  const record=ok(f.register(validForm(),'reg-1'))
  const patient=f.state.patients.find(p=>p.id===record.patientId), user=f.state.users.find(u=>u.id===record.userId)
  assert.equal(patient.personId,record.personId);assert.equal(user.personId,record.personId)
  // The frontend keeps patients.userId as a compatibility denormalization for existing safeguards (sessionForUser/
  // validSession both cross-check it against personId); it is not treated as the canonical ERD relationship.
  assert.equal(patient.userId,user.id)
})

test('no duplicate Person, orphan User or orphan Patient is ever created by registration',()=>{
  const f=fixture()
  for(let i=0;i<3;i++)ok(f.register(validForm({firstName:`Person${i}`,email:`person${i}@example.com`,phone:`0917 555 100${i}`}),`reg-${i}`))
  const emails=f.state.persons.map(p=>p.email?.toLowerCase())
  assert.equal(new Set(emails).size,emails.length,'no two persons share an email')
  for(const user of f.state.users)if((user.roleName||user.role)==='Patient')assert.ok(f.state.persons.some(p=>p.id===user.personId),`orphan user ${user.id}`)
  for(const patient of f.state.patients)assert.ok(f.state.persons.some(p=>p.id===patient.personId),`orphan patient ${patient.id}`)
})

// ---- Login --------------------------------------------------------------------------------------------------

test('Maria’s existing demo account still signs in by role and, now, by her real email',()=>{
  const f=fixture()
  const roleSession=sessionForRole('patient',f.state)
  assert.equal(roleSession.active,true);assert.equal(roleSession.patientId,'p1')
  const emailResult=resolvePatientLogin(f.state,'maria@example.com')
  assert.equal(emailResult.ok,true);assert.equal(emailResult.session.patientId,'p1');assert.equal(emailResult.session.userId,'u12')
  assert.equal(resolvePatientLogin(f.state,'MARIA@EXAMPLE.COM  ').ok,true,'email lookup is normalized')
})

test('a newly registered Patient can sign in with the email they registered with',()=>{
  const f=fixture()
  const record=ok(f.register(validForm(),'reg-1'))
  const result=resolvePatientLogin(f.state,'jamie.cruz@example.com')
  assert.equal(result.ok,true)
  assert.deepEqual([result.session.patientId,result.session.userId,result.session.role],[record.patientId,record.userId,'patient'])
  assert.equal(result.session.active,true)
  assert.equal(sessionForUser(f.state,record.userId).patientId,record.patientId)
})

test('an unknown email fails sign-in without revealing whether any account exists',()=>{
  const f=fixture()
  const result=resolvePatientLogin(f.state,'nobody@example.com')
  assert.equal(result.ok,false)
  assert.doesNotMatch(result.message,/Maria|Santos|p1/)
})

test('a deactivated newly registered account fails sign-in',()=>{
  const f=fixture()
  const record=ok(f.register(validForm(),'reg-1'))
  f.patch({users:f.state.users.map(u=>u.id===record.userId?{...u,accountStatus:'Inactive',status:'Inactive'}:u)})
  const result=resolvePatientLogin(f.state,'jamie.cruz@example.com')
  assert.equal(result.ok,false);assert.match(result.message,/inactive/i)
  assert.equal(sessionForUser(f.state,record.userId).active,false)
})

test('a malformed or ambiguous User<->Patient relationship fails closed instead of guessing',()=>{
  const f=fixture()
  const record=ok(f.register(validForm(),'reg-1'))
  // Duplicate Patient rows claiming the same User: ambiguous, must not pick one.
  f.patch({patients:[...f.state.patients,{...f.state.patients.find(p=>p.id===record.patientId),id:'p-dup'}]})
  assert.equal(sessionForUser(f.state,record.userId),null)
  assert.equal(resolvePatientLogin(f.state,'jamie.cruz@example.com').ok,false)
})

test('a Staff/Dentist/Owner account cannot enter the Patient sign-in path, even by exact email match',()=>{
  const f=fixture()
  assert.equal(sessionForUser(f.state,'u1'),null)   // Owner
  assert.equal(sessionForUser(f.state,'u2'),null)   // Staff
  assert.equal(sessionForUser(f.state,'u3'),null)   // Dentist
  const result=resolvePatientLogin(f.state,'dana.roxas@clinic.demo')
  assert.equal(result.ok,false)
})

// ---- Privacy --------------------------------------------------------------------------------------------------

test('a newly registered Patient sees only their own empty/first-use state, never Maria’s',()=>{
  const f=fixture()
  const record=ok(f.register(validForm(),'reg-1'))
  const session=sessionForUser(f.state,record.userId)
  const ctx=patientContext(f.state,session)
  assert.equal(ctx.patientId,record.patientId);assert.equal(ctx.firstName,'Jamie')
  assert.deepEqual(patientAppointments(f.state,session),[])
  assert.doesNotMatch(JSON.stringify(ctx),/Maria|Santos|p1\b/)
})

test('Maria’s existing session still sees only her own state after another Patient registers',()=>{
  const f=fixture()
  ok(f.register(validForm(),'reg-1'))
  const maria=sessionForRole('patient',f.state)
  const ctx=patientContext(f.state,maria)
  assert.equal(ctx.patientId,'p1')
  assert.doesNotMatch(JSON.stringify(ctx),/Jamie|Cruz/)
})

// ---- First-use Home ------------------------------------------------------------------------------------------

test('a newly registered Patient gets first-use Home',()=>{
  const f=fixture()
  const record=ok(f.register(validForm(),'reg-1'))
  const session=sessionForUser(f.state,record.userId)
  assert.equal(patientHomeMode(f.state,session),'first-use')
})

test('a first real appointment transitions the Patient naturally into the returning Journey Hub',()=>{
  const f=fixture()
  const record=ok(f.register(validForm(),'reg-1'))
  let session=sessionForUser(f.state,record.userId)
  assert.equal(patientHomeMode(f.state,session),'first-use')
  f.setSession(session)
  ok(f.actions.saveAppointment({patientId:record.patientId,branchId:'b1',dentistId:'d1',serviceId:'svc1',date:'2026-09-20',start:'11:00'}))
  session=sessionForUser(f.state,record.userId)
  assert.equal(patientHomeMode(f.state,session),'returning')
})

test('a Patient whose only appointment was cancelled remains a returning Patient, not first-use',()=>{
  const f=fixture()
  const record=ok(f.register(validForm(),'reg-1'))
  let session=sessionForUser(f.state,record.userId)
  f.setSession(session)
  const appt=ok(f.actions.saveAppointment({patientId:record.patientId,branchId:'b1',dentistId:'d1',serviceId:'svc1',date:'2026-09-20',start:'11:00'}))
  ok(f.actions.cancelAppointment(appt.id))
  session=sessionForUser(f.state,record.userId)
  assert.equal(patientHomeMode(f.state,session),'returning')
})

test('there is no stored onboarding flag: mode is recomputed from real state, not a field on the Patient/User record',()=>{
  const f=fixture()
  const record=ok(f.register(validForm(),'reg-1'))
  const patient=f.state.patients.find(p=>p.id===record.patientId), user=f.state.users.find(u=>u.id===record.userId)
  for(const key of Object.keys(patient))assert.doesNotMatch(key.toLowerCase(),/onboard|firstuse|first-use/)
  for(const key of Object.keys(user))assert.doesNotMatch(key.toLowerCase(),/onboard|firstuse|first-use/)
})

test('a Patient with real history (an existing appointment) keeps the full returning Journey Hub',()=>{
  const f=fixture()
  f.role('staff')
  ok(f.actions.saveAppointment({patientId:'p1',branchId:'b1',dentistId:'d1',serviceId:'svc1',date:'2026-09-20',start:'11:00'}))
  assert.equal(patientHomeMode(f.state,sessionForRole('patient',f.state)),'returning')
})

// ---- Persistence ----------------------------------------------------------------------------------------------

const IDENTITY_KEYS={persons:'persons',patients:'patients',users:'users'}
function memoryStorage(initial={}) {
  const map=new Map(Object.entries(initial)),writes=[]
  return {map,writes,getItem:k=>map.has(k)?map.get(k):null,setItem(k,v){writes.push(k);map.set(k,String(v))},removeItem:k=>map.delete(k)}
}
const PREFIX='dentalops-v4-'

test('a newly registered identity survives two persistence reloads unchanged, with no false Saved Workspace Recovery',()=>{
  const f=fixture()
  const record=ok(f.register(validForm(),'reg-1'))
  const storage=memoryStorage()
  for(const [key,name] of Object.entries(IDENTITY_KEYS))assert.equal(writeCollection(storage,`${PREFIX}${name}`,persistableCollection(key,f.state[key])).ok,true)
  let saved=Object.fromEntries(Object.entries(IDENTITY_KEYS).map(([,name])=>[name,storage.map.get(`${PREFIX}${name}`)]))
  for(let i=0;i<2;i++){
    const reloaded={}
    for(const [key,name] of Object.entries(IDENTITY_KEYS)){
      const result=readCollection(storage,`${PREFIX}${name}`,[])
      assert.equal(result.blocked,false,`${name} reload ${i}`)
      reloaded[key]=result.value
    }
    f.patch(reloaded)
    const session=sessionForUser(f.state,record.userId)
    assert.ok(session&&session.active,`session resolves after reload ${i}`)
    assert.equal(session.patientId,record.patientId)
    for(const [key,name] of Object.entries(IDENTITY_KEYS))writeCollection(storage,`${PREFIX}${name}`,persistableCollection(key,f.state[key]))
    for(const [,name] of Object.entries(IDENTITY_KEYS))assert.equal(storage.map.get(`${PREFIX}${name}`),saved[name],`${name} byte-stable across reload ${i}`)
  }
})

test('genuinely corrupt identity data still triggers recovery and is preserved, never silently overwritten',()=>{
  const corrupt={notJson:'{not json',notArray:JSON.stringify({id:'per-x'}),rowWithoutId:JSON.stringify([{firstName:'x'}]),nullRow:JSON.stringify([null])}
  for(const key of ['persons','patients','users']){
    for(const [name,raw] of Object.entries(corrupt)){
      const storage=memoryStorage({[`${PREFIX}${key}`]:raw})
      const result=readCollection(storage,`${PREFIX}${key}`,[])
      assert.equal(result.blocked,true,`${key}/${name}`)
      assert.match(result.error,new RegExp(`Saved ${key} data could not be read.*not been overwritten`))
      assert.deepEqual(storage.writes,[],`${key}/${name}`);assert.equal(storage.map.get(`${PREFIX}${key}`),raw,`${key}/${name}`)
    }
  }
})

// ---- Source guards --------------------------------------------------------------------------------------------

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('registration is a distinct public boundary, not the authenticated command runner, and never uses a fake actor',()=>{
  const reg=read('src/registration.js')
  assert.doesNotMatch(reg,/validSession|getSession/)
  assert.doesNotMatch(reg,/ROLE_INFO/)
  assert.match(reg,/registerPatient|createRegistrationAction/)
})

test('the reserved-field allowlist source guard exists and covers every privileged field the test suite checks',()=>{
  const reg=read('src/registration.js')
  assert.match(reg,/ALLOWED_FIELDS/)
  for(const field of ['firstName','middleName','lastName','phone','email','dob','preferredBranchId'])
    assert.match(reg,new RegExp(`'${field}'`))
  assert.match(reg,/Object\.keys\(form\)\.some\(key=>!ALLOWED_FIELDS\.has\(key\)\)/)
})

test('registration never implements a password field or a verification flow (only documents that they are absent)',()=>{
  const reg=read('src/registration.js')+read('src/pages/PatientRegister.jsx')
  assert.doesNotMatch(reg,/type=["']password["']/i)
  assert.doesNotMatch(reg,/passwordHash\s*[:=]/i)
  assert.doesNotMatch(reg,/verifyEmail|sendVerification|verificationCode|emailVerifiedAt/i)
})

test('the identity model documents PERSON as the shared hub, not a PERSON -> USER -> PATIENT foreign-key chain',()=>{
  assert.ok(existsSync(new URL('../PHASE4B3_ONBOARDING_BOOKING.md',import.meta.url)))
  const doc=read('PHASE4B3_ONBOARDING_BOOKING.md')
  assert.doesNotMatch(doc,/PERSON\s*(→|->)\s*USER\s*(→|->)\s*PATIENT/)
  assert.match(doc,/person_id/i)
})

test('Login guards the new Patient auth props so it still renders with none supplied (SSR compatibility)',()=>{
  const login=read('src/layout.jsx')
  assert.match(login,/selected==='patient'&&onLoginPatientEmail/)
  assert.match(login,/export function Login/)
  assert.match(read('src/pages/PatientRegister.jsx'),/export function PatientRegister/)
})
