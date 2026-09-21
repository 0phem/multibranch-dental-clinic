import { uid } from './logic.js'
import { patientInScope } from './contracts.js'
import { HMO_PROVIDERS } from './phase3-contracts.js'
import { isRecord, permitted, validTime } from './safeguards.js'
import { validDate } from './clock.js'

const fail=message=>({ok:false,message})
const clean=value=>typeof value==='string'?value.trim():''
export const ROLE_PERMISSIONS={Patient:['patient-portal'],Receptionist:['appointments','checkin','queue','patient-demographics','billing','hmo','messages','followups'],Dentist:['schedule','queue','clinical-records','treatment','prescriptions','followups','messages'],'Dental Assistant':['queue','clinical-records'],'HMO Coordinator':['hmo','patient-demographics','messages'],Cashier:['billing','patient-demographics'],'Patient Engagement Staff':['inquiries','messages','engagement'],'Owner / Admin':['all']}
const selected=(form,keys)=>Object.fromEntries(keys.filter(k=>form[k]!==undefined).map(k=>[k,form[k]]))
const unchanged=(a,b)=>Object.entries(b).every(([k,v])=>JSON.stringify(a[k])===JSON.stringify(v))
export function administrationActions(run) {
  const createUserAccount=run(({state,session,now,event},form={})=>{
    if(session.role!=='owner'||!isRecord(form))return fail('Only Owner/Admin can create accounts.')
    const username=clean(form.username).toLowerCase(),email=clean(form.email).toLowerCase(),roleName=form.roleName
    if(!clean(form.firstName)||!clean(form.lastName)||!username||!email)return fail('First name, last name, username and email are required.')
    if(!Object.hasOwn(ROLE_PERMISSIONS,roleName))return fail('Choose a supported account role.')
    const branch=state.branches.find(b=>b.id===form.branchId),scoped=!['Patient','Owner / Admin'].includes(roleName)
    if(scoped&&!branch)return fail('Choose an existing branch for this account.')
    if(!['Active','Inactive'].includes(form.accountStatus||'Active'))return fail('Choose Active or Inactive account status.')
    if(form.dob&&(!validDate(form.dob)||form.dob>now.date))return fail('Enter a valid date of birth.')
    if(state.users.some(u=>clean(u.username||u.login).toLowerCase()===username)||state.persons.some(p=>clean(p.email).toLowerCase()===email))return fail('An account or person already uses this username/email. Review the existing record.')
    const person={...selected(form,['phone','dob','sex','address']),id:uid('per'),firstName:clean(form.firstName),middleName:clean(form.middleName),lastName:clean(form.lastName),email}
    const user={id:uid('u'),personId:person.id,username,login:username,roleName,role:roleName,branchId:scoped?branch.id:null,accountStatus:form.accountStatus||'Active',status:form.accountStatus||'Active',permissions:[...ROLE_PERMISSIONS[roleName]],lastLogin:'Never'}
    state.persons=[...state.persons,person];state.users=[...state.users,user]
    const profile={id:uid(roleName==='Dentist'?'d':'s'),personId:person.id,userId:user.id,staffType:roleName,licenseNo:'',shiftStart:branch?.open||'09:00',shiftEnd:branch?.close||'18:00',available:user.status==='Active'}
    if(roleName==='Dentist')state.dentists=[...state.dentists,{...profile,branchIds:[branch.id],specialty:'Unspecified',assistantStaffId:null}]
    else if(scoped)state.staff=[...state.staff,{...profile,branchId:branch.id,role:roleName}]
    else if(roleName==='Patient')state.patients=[...state.patients,{id:uid('p'),personId:person.id,userId:user.id,patientCode:`PAT-${String(state.patients.length+1).padStart(4,'0')}`,preferredBranchId:state.branches[0]?.id||null,hmo:'None',hmoMember:'—',allergies:'None',medicalHistory:'',dentalHistory:'',consent:false}]
    event(`account:${user.id}`,'M1','access.user.created','Account and linked profile created',null,user.branchId,{entityType:'user',entityId:user.id})
    return {ok:true,record:user,user}
  })
  const setUserStatus=run(({state,session,event},id,status)=>{
    if(session.role!=='owner')return fail('Only Owner/Admin can change account status.')
    const user=state.users.find(u=>u.id===id)
    if(!user||!['Active','Inactive'].includes(status))return fail('Select an existing account and valid status.')
    if(id===session.userId&&status==='Inactive')return fail('You cannot deactivate the account you are using. Ask another authorized administrator.')
    if((user.accountStatus||user.status)===status)return {ok:true,unchanged:true,record:user,status}
    const record={...user,accountStatus:status,status,revision:(user.revision||0)+1}
    state.users=state.users.map(u=>u.id===id?record:u)
    for(const key of ['dentists','staff'])state[key]=state[key].map(p=>p.userId===id?{...p,available:status==='Active'}:p)
    event(`account:status:${id}:${record.revision}`,'M1→M3','access.user.status.changed',`Account ${status}`,null,user.branchId,{entityType:'user',entityId:id})
    return {ok:true,record,status}
  })
  const updatePatientRecord=run(({state,session,now,event},id,input={})=>{
    const patient=state.patients.find(p=>p.id===id)
    if(!patient||!['staff','dentist'].includes(session.role)||!patientInScope(patient,state,session)||!permitted(state,session,session.role==='staff'?'patient-demographics':'clinical-records')||!isRecord(input))return fail('Patient is outside your current permitted scope.')
    const person=state.persons.find(p=>p.id===patient.personId)
    if(!person||input.person!=null&&!isRecord(input.person)||input.patient!=null&&!isRecord(input.patient))return fail('Patient identity needs review.')
    const personPatch=session.role==='staff'?selected(input.person||{},['firstName','middleName','lastName','phone','email','dob','sex','address']):{}
    const patientPatch=selected(input.patient||{},session.role==='staff'?['preferredBranchId','hmo','hmoMember','emergencyContact','consent']:['allergies','medicalHistory','dentalHistory'])
    if(Object.values(personPatch).some(v=>typeof v!=='string')||Object.entries(patientPatch).some(([k,v])=>k==='consent'?typeof v!=='boolean':typeof v!=='string'))return fail('Enter valid text and consent fields.')
    if(['firstName','lastName','phone'].some(k=>k in personPatch&&!clean(personPatch[k])))return fail('First name, last name and phone cannot be blank.')
    if(personPatch.dob&&(!validDate(personPatch.dob)||personPatch.dob>now.date))return fail('Enter a valid date of birth.')
    if(input.patient?.preferredBranch!==undefined){const branch=state.branches.find(b=>b.name===input.patient.preferredBranch);if(!branch)return fail('Choose an existing preferred branch.');patientPatch.preferredBranchId=branch.id}
    if(patientPatch.preferredBranchId&&!state.branches.some(b=>b.id===patientPatch.preferredBranchId))return fail('Choose an existing preferred branch.')
    if(patientPatch.hmo!==undefined)patientPatch.hmoProviderId=HMO_PROVIDERS.find(h=>h.name===patientPatch.hmo)?.id||null
    if(unchanged(person,personPatch)&&unchanged(patient,patientPatch))return {ok:true,unchanged:true,record:patient}
    const record={...patient,...patientPatch,revision:(patient.revision||0)+1}
    state.persons=state.persons.map(p=>p.id===person.id?{...p,...personPatch}:p);state.patients=state.patients.map(p=>p.id===id?record:p)
    event(`patient:updated:${id}:${record.revision}`,'M4','patient.record.updated','Permitted patient fields updated',id,patient.preferredBranchId,{entityType:'patient',entityId:id})
    return {ok:true,record}
  })
  const saveBranch=run(({state,session,event},id,form={})=>{
    const branch=state.branches.find(b=>b.id===id)
    if(session.role!=='owner'||!branch||!isRecord(form))return fail('Only Owner/Admin can update an existing branch.')
    const patch=selected(form,['name','branchCode','city','status','open','close','threshold','phone','address'])
    const next={...branch,...patch}
    if(!clean(next.name)||!clean(next.branchCode)||!['Open','Temporarily Closed','Inactive'].includes(next.status)||!validTime(next.open)||!validTime(next.close)||next.open>=next.close||!Number.isFinite(next.threshold)||next.threshold<=0)return fail('Enter a branch name/code, valid operating hours and a positive capacity threshold.')
    if(state.branches.some(b=>b.id!==id&&(b.branchCode===next.branchCode||b.name===next.name)))return fail('Branch name and code must identify one branch.')
    if(unchanged(branch,patch))return {ok:true,unchanged:true,record:branch}
    const record={...next,revision:(branch.revision||0)+1};state.branches=state.branches.map(b=>b.id===id?record:b)
    event(`branch:${id}:${record.revision}`,'M2','branch.updated','Branch configuration updated',null,id,{entityType:'branch',entityId:id})
    return {ok:true,record}
  })
  const setBranchService=run(({state,session,event},branchId,serviceId,active)=>{
    if(session.role!=='owner'||typeof active!=='boolean'||!state.branches.some(b=>b.id===branchId)||!state.services.some(s=>s.id===serviceId))return fail('Select an existing branch and service as Owner/Admin.')
    const old=state.branchServices.find(b=>b.branchId===branchId&&b.serviceId===serviceId)
    if(old&&(old.active!==false)===active)return {ok:true,unchanged:true,record:old}
    const record={...old,id:old?.id||uid('bs'),branchId,serviceId,active,revision:(old?.revision||0)+1}
    state.branchServices=old?state.branchServices.map(b=>b.id===old.id?record:b):[...state.branchServices,record]
    event(`branch-service:${record.id}:${record.revision}`,'M2','branch.service.changed','Service availability updated',null,branchId,{entityType:'branch',entityId:branchId})
    return {ok:true,record}
  })
  const savePersonnel=run(({state,session,event},collection,id,form={})=>{
    if(session.role!=='owner'||!['dentists','staff'].includes(collection)||!isRecord(form))return fail('Only Owner/Admin can update personnel.')
    const old=state[collection].find(p=>p.id===id),user=state.users.find(u=>u.id===old?.userId)
    if(!old||!user||['id','personId','userId','staffType'].some(k=>form[k]!=null&&form[k]!==old[k]))return fail('Personnel identity cannot be changed here.')
    const patch=selected(form,['licenseNo','specialty','specialization','shiftStart','shiftEnd','available',...(collection==='dentists'?['branchIds','assistantStaffId']:['branchId'])])
    const next={...old,...patch},ids=collection==='dentists'?next.branchIds:[next.branchId]
    if(!Array.isArray(ids)||!ids.length||ids.some(id=>!state.branches.some(b=>b.id===id))||typeof next.available!=='boolean'||!validTime(next.shiftStart)||!validTime(next.shiftEnd)||next.shiftStart>=next.shiftEnd)return fail('Choose valid branch assignments, availability and shift hours.')
    if(ids.some(id=>{const b=state.branches.find(b=>b.id===id);return next.shiftStart<b.open||next.shiftEnd>b.close}))return fail('The shift must fit each assigned branch’s operating hours.')
    if(next.assistantStaffId&&!state.staff.some(s=>s.id===next.assistantStaffId&&s.staffType==='Dental Assistant'&&ids.includes(s.branchId)))return fail('Choose an assistant assigned to this branch.')
    if(unchanged(old,patch))return {ok:true,unchanged:true,record:old}
    const record={...next,revision:(old.revision||0)+1};state[collection]=state[collection].map(p=>p.id===id?record:p)
    state.users=state.users.map(u=>u.id===user.id?{...u,branchId:ids.includes(u.branchId)?u.branchId:ids[0]}:u)
    event(`personnel:${id}:${record.revision}`,'M3','personnel.updated','Personnel availability updated',null,ids[0],{entityType:collection,entityId:id})
    return {ok:true,record}
  })
  return {createUserAccount,setUserStatus,updatePatientRecord,saveBranch,setBranchService,savePersonnel}
}
