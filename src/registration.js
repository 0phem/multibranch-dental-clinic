import { isRecord } from './safeguards.js'
import { uid, possibleDuplicatePerson } from './logic.js'
import { clinicNow, validDate } from './clock.js'

// Public Patient self-registration (M1/M4). This is the current FRONTEND DEMO account flow: records live in browser-
// local persisted state, not a server database. There is no session yet, so this does not go through the
// authenticated command runner (`createWorkflowActions`'s `run`) and never bypasses its checks for an authenticated
// action — it is a distinct, narrower boundary for the one thing a stranger is allowed to do: create their own
// PERSON + PATIENT + USER, atomically, nothing else. A future backend enforces this with a DB transaction, hashed
// password authentication, email verification and unique constraints; none of that exists here.
const fail=message=>({ok:false,message})
const clean=value=>typeof value==='string'?value.trim().replace(/\s+/g,' '):''
const normalizeEmail=value=>typeof value==='string'?value.trim().toLowerCase():''
const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/
// The only fields a public registration payload may ever contain. Anything else — role/roleName/permissions/
// accountStatus/branchId, or a browser-supplied personId/patientId/userId/id/username/login — fails the whole
// request closed rather than being silently stripped and ignored, so a privileged/identity field can never be
// half-processed. Legitimate optional fields (middleName, dob) are still allowed absent or empty.
const ALLOWED_FIELDS=new Set(['firstName','middleName','lastName','phone','email','dob','preferredBranchId'])

export function createRegistrationAction({getState, commit, clock=clinicNow}) {
  return (form={}, commandId) => {
    const state=getState(), now=clock()
    if(!isRecord(form))return fail('Enter valid registration details.')
    if(Object.keys(form).some(key=>!ALLOWED_FIELDS.has(key)))return fail('Enter valid registration details.')
    const id=typeof commandId==='string'?commandId.trim():''
    if(!id)return fail('A registration command ID is required.')
    // Replay: the same command ID always returns its own prior result, never a second attempt's records.
    const previousPerson=state.persons.find(p=>p.registrationCommandId===id)
    if(previousPerson){
      const patient=state.patients.find(p=>p.personId===previousPerson.id)
      const user=state.users.find(u=>u.personId===previousPerson.id)
      if(patient&&user)return {ok:true,unchanged:true,record:{personId:previousPerson.id,patientId:patient.id,userId:user.id}}
      return fail('This registration is still being processed. Try again in a moment.')
    }
    // Reserved identity/privilege fields (role, permissions, account status, any ID) were already rejected above;
    // only the allowed person/contact fields are ever read here.
    const firstName=clean(form.firstName), lastName=clean(form.lastName), phone=clean(form.phone), email=normalizeEmail(form.email)
    if(!firstName||!lastName)return fail('Enter your first and last name.')
    if(!phone)return fail('Enter a contact number.')
    if(!email||!EMAIL_RE.test(email))return fail('Enter a valid email address.')
    const dob=typeof form.dob==='string'&&form.dob?form.dob:''
    if(dob&&(!validDate(dob)||dob>now.date))return fail('Enter a valid date of birth.')
    const branch=state.branches.find(b=>b.id===form.preferredBranchId&&b.status==='Open')
    if(!branch)return fail('Choose an open branch.')
    if(state.users.some(u=>typeof (u.username||u.login)==='string'&&(u.username||u.login).toLowerCase()===email)||state.persons.some(p=>typeof p.email==='string'&&p.email.toLowerCase()===email))
      return fail('An account already uses this email. Sign in instead, or contact the clinic.')
    // Never claim an existing Patient from typed identity: the same duplicate signal Staff patient creation uses.
    if(possibleDuplicatePerson(state.persons,{firstName,lastName,phone,dob}))
      return fail('An existing patient record may already match these details. Please contact the clinic for account assistance.')
    const person={id:uid('per'),firstName,middleName:clean(form.middleName),lastName,email,phone,dob,sex:'',address:'',registrationCommandId:id}
    const patient={id:uid('p'),personId:person.id,userId:null,patientCode:`PAT-${String(state.patients.length+1).padStart(4,'0')}`,preferredBranchId:branch.id,hmo:'None',hmoMember:'—',allergies:'',medicalHistory:'',dentalHistory:'',emergencyContact:'',consent:false}
    const user={id:uid('u'),personId:person.id,username:email,login:email,roleName:'Patient',role:'Patient',branchId:null,accountStatus:'Active',status:'Active',permissions:['patient-portal'],lastLogin:'Never',registeredAt:now.timestamp}
    patient.userId=user.id
    // Self-service registration has no prior actor: the audit trail names the newly created identity as its own
    // actor, not a fabricated staff/session actor. No email/phone is written into the log payload.
    const key=`registration:${id}`, eventId=`event:${key}`
    const logEntry={id:eventId,commandKey:key,at:now.label,createdAt:now.timestamp,module:'M1→M4',event:'patient.self_registered',eventType:'patient.self_registered',result:'Self-service Patient registration',status:'Success',entityType:'patient',entityId:patient.id,patientId:patient.id,branchId:patient.preferredBranchId}
    const auditEntry={id:uid('aud'),eventId,at:now.label,actor:`${firstName} ${lastName}`.trim(),actorUserId:user.id,action:'Self-service Patient registration',module:'M1→M4'}
    // One atomic commit: PERSON + PATIENT + USER + audit trail, or nothing. No appointment, loyalty account,
    // HMO case, clinical or financial record is created here — only identity.
    commit({persons:[...state.persons,person],patients:[...state.patients,patient],users:[...state.users,user],workflowLog:[logEntry,...state.workflowLog],audit:[auditEntry,...state.audit].slice(0,150)})
    return {ok:true,record:{personId:person.id,patientId:patient.id,userId:user.id}}
  }
}
