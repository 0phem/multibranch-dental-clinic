import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  INITIAL_PERSONS, INITIAL_SERVICES, INITIAL_BRANCH_SERVICES, INITIAL_DENTIST_SERVICE_ASSIGNMENTS,
  INITIAL_BRANCHES, INITIAL_DENTISTS, INITIAL_STAFF, INITIAL_PATIENTS, INITIAL_APPOINTMENTS, INITIAL_QUEUE,
  INITIAL_TREATMENTS, INITIAL_INVOICES, INITIAL_HMO, INITIAL_INQUIRIES, INITIAL_CONVERSATIONS,
  INITIAL_NOTIFICATIONS, INITIAL_PRESCRIPTIONS, INITIAL_FOLLOWUPS, INITIAL_USERS, INITIAL_AUTOMATIONS,
  INITIAL_WORKFLOW_LOG, INITIAL_CAMPAIGNS, INITIAL_LOYALTY, INITIAL_AUDIT, ROLE_INFO, TODAY
} from './data.js'
import { uid, nowLabel } from './logic.js'
import { clinicNow, rebaseDemoRecords } from './clock.js'
import { normalizeClinicState, sessionForRole, patientInScope, persistableCollection } from './contracts.js'
import { createWorkflowActions } from './workflow.js'

const ClinicContext=createContext(null)
const STORAGE_PREFIX='dentalops-v4-'

function usePersist(key, initial) {
  const [value,setValue]=useState(()=>{
    const seed=['appointments','queue','treatments','invoices','followups','prescriptions'].includes(key)?rebaseDemoRecords(initial):initial
    try { const saved=localStorage.getItem(`${STORAGE_PREFIX}${key}`); const parsed=saved?JSON.parse(saved):null; return Array.isArray(parsed)?parsed:seed }
    catch { return seed }
  })
  useEffect(()=>{ try{localStorage.setItem(`${STORAGE_PREFIX}${key}`,JSON.stringify(value))}catch{} },[key,value])
  return [value,setValue]
}

const cleanNamePart=value=>String(value||'').trim().replace(/\s+/g,' ')
const fullName=person=>[person?.firstName,person?.middleName,person?.lastName].map(cleanNamePart).filter(Boolean).join(' ')

export function ClinicProvider({ children }) {
  const [persons,setPersons]=usePersist('persons',INITIAL_PERSONS)
  const [services,setServices]=usePersist('services',INITIAL_SERVICES)
  const [branchServices,setBranchServices]=usePersist('branch-services',INITIAL_BRANCH_SERVICES)
  const [dentistServiceAssignments,setDentistServiceAssignments]=usePersist('dentist-service-assignments',INITIAL_DENTIST_SERVICE_ASSIGNMENTS)
  const [branches,setBranches]=usePersist('branches',INITIAL_BRANCHES)
  const [dentists,setDentists]=usePersist('dentists',INITIAL_DENTISTS)
  const [staff,setStaff]=usePersist('staff',INITIAL_STAFF)
  const [patients,setPatients]=usePersist('patients',INITIAL_PATIENTS)
  const [appointments,setAppointments]=usePersist('appointments',INITIAL_APPOINTMENTS)
  const [queue,setQueue]=usePersist('queue',INITIAL_QUEUE)
  const [treatments,setTreatments]=usePersist('treatments',INITIAL_TREATMENTS)
  const [invoices,setInvoices]=usePersist('invoices',INITIAL_INVOICES)
  const [hmo,setHmo]=usePersist('hmo',INITIAL_HMO)
  const [inquiries,setInquiries]=usePersist('inquiries',INITIAL_INQUIRIES)
  const [conversations,setConversations]=usePersist('conversations',INITIAL_CONVERSATIONS)
  const [notifications,setNotifications]=usePersist('notifications',INITIAL_NOTIFICATIONS)
  const [prescriptions,setPrescriptions]=usePersist('prescriptions',INITIAL_PRESCRIPTIONS)
  const [followups,setFollowups]=usePersist('followups',INITIAL_FOLLOWUPS)
  const [users,setUsers]=usePersist('users',INITIAL_USERS)
  const [automations,setAutomations]=usePersist('automations',INITIAL_AUTOMATIONS)
  const [workflowLog,setWorkflowLog]=usePersist('workflow-log',INITIAL_WORKFLOW_LOG)
  const [campaigns,setCampaigns]=usePersist('campaigns',INITIAL_CAMPAIGNS)
  const [loyalty,setLoyalty]=usePersist('loyalty',INITIAL_LOYALTY)
  const [audit,setAudit]=usePersist('audit',INITIAL_AUDIT)
  const [checkIns,setCheckIns]=usePersist('check-ins',[])
  const [toasts,setToasts]=useState([])
  const [session,setSessionState]=useState(null)
  const sessionRef=useRef(null)
  const stateRef=useRef(null)
  const [clock,setClock]=useState(clinicNow)
  useEffect(()=>{const timer=setInterval(()=>setClock(clinicNow()),15000);return ()=>clearInterval(timer)},[])
  const setSession=role=>{const next=role?sessionForRole(role,stateRef.current):null;sessionRef.current=next;setSessionState(next);return next}


  const personById=id=>persons.find(p=>p.id===id)
  const staffById=id=>staff.find(s=>s.id===id)
  const personProjection=(entity,{doctor=false}={})=>{
    const person=personById(entity.personId)
    const base=fullName(person)
    return {
      ...entity,
      firstName:person?.firstName||'', middleName:person?.middleName||'', lastName:person?.lastName||'',
      email:person?.email||'', phone:person?.phone||'', dob:person?.dob||'', sex:person?.sex||'', address:person?.address||'',
      name:doctor && base ? `Dr. ${base}` : base || entity.id,
    }
  }
  const projectedStaff=staff.map(s=>personProjection(s))
  const projectedDentists=dentists.map(d=>{
    const projected=personProjection(d,{doctor:true})
    const assistant=staffById(d.assistantStaffId)
    return {...projected,assistant:assistant?fullName(personById(assistant.personId)):'Unassigned'}
  })
  const projectedPatients=patients.map(p=>personProjection(p))
  const projectedUsers=users.map(u=>{
    const p=personById(u.personId)
    const base=fullName(p)
    const role=u.roleName||u.role
    const name=role==='Dentist'&&base?`Dr. ${base}`:base||u.username
    return {...u,name,email:p?.email||'',phone:p?.phone||'',firstName:p?.firstName||'',middleName:p?.middleName||'',lastName:p?.lastName||''}
  })
  const serviceById=id=>services.find(s=>s.id===id)
  const projectedAppointments=appointments.map(a=>{
    const svc=serviceById(a.serviceId) || services.find(s=>s.name===a.service)
    return {...a,serviceId:svc?.id||a.serviceId||null,service:svc?.name||a.service||'Unknown service',duration:a.duration||svc?.duration||30}
  })

  const state=normalizeClinicState({
    persons,services,branchServices,dentistServiceAssignments,branches,
    dentists:projectedDentists,staff:projectedStaff,patients:projectedPatients,appointments:projectedAppointments,
    queue,treatments,invoices,hmo,inquiries,conversations,notifications,prescriptions,followups,users:projectedUsers,
    automations,workflowLog,campaigns,loyalty,audit,checkIns,clock,today:clock.date
  })
  stateRef.current=state
  const migrationDone=useRef(false)
  useEffect(()=>{
    if(migrationDone.current)return
    migrationDone.current=true
    // Persist recovered IDs once, before a later branch rename can lose a legacy
    // name-based relationship. Preserve unknown dates; do not fabricate encounters.
    const migrate=(raw,projected,keys)=>raw.map(record=>{
      const next=projected.find(x=>x.id===record.id)
      return {...record,...Object.fromEntries(keys.map(key=>[key,next?.[key]??null]))}
    })
    setAppointments(persistableCollection('appointments',migrate(appointments,state.appointments,['branchId','serviceId'])))
    setQueue(persistableCollection('queue',migrate(queue,state.queue,['branchId','serviceId','clinicDate','treatmentId','queueEntryId'])))
    setTreatments(persistableCollection('treatments',migrate(treatments,state.treatments,['branchId','queueEntryId'])))
    setInvoices(persistableCollection('invoices',migrate(invoices,state.invoices,['branchId'])))
    setFollowups(migrate(followups,state.followups,['branchId']))
    setPatients(persistableCollection('patients',migrate(patients,state.patients,['preferredBranchId'])))
    setDentists(persistableCollection('dentists',migrate(dentists,state.dentists,['branchIds'])))
    setStaff(persistableCollection('staff',migrate(staff,state.staff,['branchId'])))
    setCheckIns(state.checkIns)
  },[])
  const setters={
    setPersons,setServices,setBranchServices,setDentistServiceAssignments,setBranches,setDentists,setStaff,setPatients,
    setAppointments,setQueue,setTreatments,setInvoices,setHmo,setInquiries,setConversations,setNotifications,
    setPrescriptions,setFollowups,setUsers,setAutomations,setWorkflowLog,setCampaigns,setLoyalty,setAudit,setCheckIns
  }

  const toast=(message,tone='default')=>{
    const id=uid('toast'); setToasts(xs=>[...xs,{id,message,tone}]); setTimeout(()=>setToasts(xs=>xs.filter(x=>x.id!==id)),3200)
  }
  const log=(actor,action,module='M23')=>{
    setAudit(xs=>[{id:uid('aud'),at:nowLabel(),actor,action,module},...xs].slice(0,150))
  }
  const workflow=(module,event,result,status='Success',eventType=null)=>{
    setWorkflowLog(xs=>[{id:uid('log'),at:nowLabel(),module,event,eventType:eventType||event,result,status},...xs].slice(0,150))
  }
  const notify=(patientId,type,text,channel='In-App')=>{
    setNotifications(xs=>[{id:uid('n'),patientId,type,channel,text,status:'Delivered',createdAt:nowLabel(),read:false},...xs])
  }

  const updatePatientRecord=(patientId,{person:personPatch={},patient:patientPatch={}})=>{
    const raw=patients.find(p=>p.id===patientId)
    if(!raw) return {ok:false,message:'Patient record not found.'}
    const actor=sessionRef.current
    const projected=stateRef.current.patients.find(p=>p.id===patientId)
    if(!actor?.active||!['staff','dentist'].includes(actor.role)||!patientInScope(projected,stateRef.current,actor))return {ok:false,message:'Patient is outside your scope.'}
    const personKeys=actor.role==='staff'?['firstName','middleName','lastName','phone','email','dob','sex','address']:[]
    const patientKeys=actor.role==='staff'?['preferredBranchId','hmo','hmoMember','emergencyContact','consent']:['allergies','medicalHistory','dentalHistory']
    if(actor.role==='staff'&&patientPatch.preferredBranch!==undefined){
      const branch=branches.find(b=>b.name===patientPatch.preferredBranch)
      if(!branch)return {ok:false,message:'Choose an existing preferred branch.'}
      patientPatch={...patientPatch,preferredBranchId:branch.id}
    }
    personPatch=Object.fromEntries(Object.entries(personPatch).filter(([key])=>personKeys.includes(key)))
    patientPatch=Object.fromEntries(Object.entries(patientPatch).filter(([key])=>patientKeys.includes(key)))
    setPersons(xs=>xs.map(p=>p.id===raw.personId?{...p,...personPatch}:p))
    setPatients(xs=>xs.map(p=>p.id===patientId?{...p,...patientPatch}:p))
    workflow('M4','Patient record updated',patientId,'Success','patient.record.updated')
    return {ok:true}
  }

  const createUserAccount=form=>{
    const username=String(form.username||'').trim().toLowerCase()
    const email=String(form.email||'').trim().toLowerCase()
    if(!cleanNamePart(form.firstName)||!cleanNamePart(form.lastName)||!username||!email) return {ok:false,message:'First name, last name, username, and email are required.'}
    if(users.some(u=>(u.username||u.login).toLowerCase()===username)) return {ok:false,message:'Username must be unique.'}
    if(persons.some(p=>(p.email||'').toLowerCase()===email)) return {ok:false,message:'Email must be unique.'}
    const personId=uid('per'), userId=uid('u')
    const personRecord={id:personId,firstName:cleanNamePart(form.firstName),middleName:cleanNamePart(form.middleName),lastName:cleanNamePart(form.lastName),email,phone:String(form.phone||'').trim(),dob:form.dob||'',sex:form.sex||'',address:form.address||''}
    const roleName=form.roleName
    const branch=branches.find(b=>b.id===form.branchId)
    const selectedBranch=roleName==='Owner / Admin'||roleName==='Patient'?'All Branches':branch?.name||'All Branches'
    const selectedBranchId=roleName==='Owner / Admin'||roleName==='Patient'?null:form.branchId
    const permissionMap={
      Patient:['patient-portal'],Receptionist:['appointments','checkin','queue','patient-demographics','billing','hmo','messages','followups'],
      Dentist:['schedule','queue','clinical-records','treatment','prescriptions','followups','messages'],'Dental Assistant':['queue','clinical-records'],
      'HMO Coordinator':['hmo','patient-demographics','messages'],Cashier:['billing','patient-demographics'],'Patient Engagement Staff':['inquiries','messages','engagement'],'Owner / Admin':['all']
    }
    const user={id:userId,personId,username,login:username,roleName,role:roleName,branchId:selectedBranchId,branch:selectedBranch,accountStatus:form.accountStatus||'Active',status:form.accountStatus||'Active',permissions:permissionMap[roleName]||[],lastLogin:'Never'}
    setPersons(xs=>[...xs,personRecord]); setUsers(xs=>[...xs,user])
    const display=fullName(personRecord)
    if(roleName==='Dentist'){
      const profileId=uid('d')
      setDentists(xs=>[...xs,{id:profileId,userId,personId,staffType:'Dentist',licenseNo:'',branches:[selectedBranch],branchIds:[selectedBranchId],specialty:'Unspecified',shiftStart:branch?.open||'09:00',shiftEnd:branch?.close||'18:00',available:user.accountStatus==='Active',assistantStaffId:null}])
      workflow('M1→M3','User account created / role synchronized',`${username} • Dentist profile created`,'Success','access.user.created')
    } else if(['Receptionist','Dental Assistant','HMO Coordinator','Cashier','Patient Engagement Staff'].includes(roleName)){
      setStaff(xs=>[...xs,{id:uid('s'),userId,personId,staffType:roleName,licenseNo:'—',specialization:roleName,role:roleName,branchId:selectedBranchId,branch:selectedBranch,shiftStart:branch?.open||'09:00',shiftEnd:branch?.close||'18:00',available:user.accountStatus==='Active'}])
      workflow('M1→M3','User account created / role synchronized',`${username} • Staff profile created`,'Success','access.user.created')
    } else if(roleName==='Patient'){
      const patientCode=`PAT-${String(patients.length+1).padStart(4,'0')}`
      setPatients(xs=>[...xs,{id:uid('p'),personId,userId,patientCode,preferredBranchId:branches[0]?.id||null,preferredBranch:branches[0]?.name||'Branch A',hmo:'None',hmoMember:'—',allergies:'None',medicalHistory:'',dentalHistory:'',emergencyContact:'',consent:false}])
      workflow('M1→M4','Patient portal account created',`${username} • Patient record linked`,'Success','access.user.created')
    }
    log(ROLE_INFO.owner.name,`Created ${roleName} account for ${display}`,'M1')
    return {ok:true,user:{...user,name:roleName==='Dentist'?`Dr. ${display}`:display,email}}
  }

  const toggleUserStatus=userId=>{
    const current=users.find(u=>u.id===userId); if(!current) return {ok:false,message:'User not found.'}
    const next=(current.accountStatus||current.status)==='Active'?'Inactive':'Active'
    setUsers(xs=>xs.map(u=>u.id===userId?{...u,accountStatus:next,status:next}:u))
    setDentists(xs=>xs.map(d=>d.userId===userId?{...d,available:next==='Active'}:d))
    setStaff(xs=>xs.map(s=>s.userId===userId?{...s,available:next==='Active'}:s))
    workflow('M1→M3','Account status changed',`${current.username} • ${next} • personnel availability synchronized`,'Success','access.user.status.changed')
    return {ok:true,status:next}
  }

  const createHmoCase=form=>{
    const patient=projectedPatients.find(p=>p.id===form.patientId); if(!patient) return {ok:false,message:'Select a patient.'}
    const provider=form.provider||patient.hmo
    const memberId=form.memberId||patient.hmoMember
    if(!provider||provider==='None'||!memberId||memberId==='—') return {ok:false,message:'The patient does not have usable HMO provider/member information.'}
    const required=['HMO Card','Valid ID','Dentist treatment request']
    const present=form.documents||['HMO Card']
    const missing=required.filter(x=>!present.includes(x))
    const h={id:uid('h'),patientId:patient.id,provider,memberId,treatment:form.treatment||'Requested dental treatment',serviceId:form.serviceId||null,branch:form.branch||patient.preferredBranch,eligibility:'Provider Verification Required',documents:present,missing,status:missing.length?'Missing Requirements':'Ready for Submission',submittedAt:null,pendingHours:0,reference:null,followUpCount:0,lastContact:null,providerOutcome:null,escalationStatus:'Not Escalated'}
    setHmo(xs=>[h,...xs])
    if(missing.length) notify(patient.id,'HMO Requirements Needed',`${missing.length} HMO requirement${missing.length>1?'s are':' is'} missing: ${missing.join(', ')}.`)
    workflow('M12','HMO case created and local completeness checked',`${patient.name} • ${missing.length} missing`,'Success','hmo.case.created')
    return {ok:true,record:h}
  }

  const markHmoRequirementReceived=(caseId,requirement)=>{
    const h=hmo.find(x=>x.id===caseId); if(!h) return {ok:false,message:'HMO case not found.'}
    const missing=h.missing.filter(x=>x!==requirement)
    setHmo(xs=>xs.map(x=>x.id===caseId?{...x,documents:[...new Set([...(x.documents||[]),requirement])],missing,status:missing.length?'Missing Requirements':'Ready for Submission'}:x))
    workflow('M12','HMO requirement received',`${h.id} • ${requirement}`,'Success','hmo.requirement.received')
    return {ok:true}
  }

  const submitHmoCase=caseId=>{
    const h=hmo.find(x=>x.id===caseId); if(!h) return {ok:false,message:'HMO case not found.'}
    if(h.missing?.length) return {ok:false,message:'Missing HMO requirements must be completed before submission.'}
    const ref=h.reference||`HMO-${TODAY.slice(0,4)}-${String(Date.now()).slice(-6)}`
    setHmo(xs=>xs.map(x=>x.id===caseId?{...x,status:'Pending',submittedAt:nowLabel(),pendingHours:0,reference:ref,eligibility:'Awaiting Provider Response'}:x))
    notify(h.patientId,'HMO Submitted',`Your HMO request ${ref} has been submitted to ${h.provider}.`)
    workflow('M13','HMO request submitted',`${ref} • provider response pending`,'Success','hmo.request.submitted')
    return {ok:true,reference:ref}
  }

  const followUpHmo=caseId=>{
    const h=hmo.find(x=>x.id===caseId); if(!h) return {ok:false,message:'HMO case not found.'}
    setHmo(xs=>xs.map(x=>x.id===caseId?{...x,followUpCount:(x.followUpCount||0)+1,lastContact:nowLabel(),escalationStatus:x.escalationStatus||'Follow-Up Required'}:x))
    workflow('M14','HMO follow-up contact recorded',h.reference||h.id,'Success','hmo.followup.recorded')
    return {ok:true}
  }

  const escalateHmo=caseId=>{
    const h=hmo.find(x=>x.id===caseId); if(!h) return {ok:false,message:'HMO case not found.'}
    setHmo(xs=>xs.map(x=>x.id===caseId?{...x,status:'Escalated',escalationStatus:'Escalated',lastContact:nowLabel()}:x))
    notify(h.patientId,'HMO Escalation Update',`Your HMO case requires additional clinic follow-up with ${h.provider}.`)
    workflow('M14','Unresolved HMO case escalated',h.reference||h.id,'Success','hmo.case.escalated')
    return {ok:true}
  }

  const recordHmoOutcome=(caseId,outcome)=>{
    const h=hmo.find(x=>x.id===caseId); if(!h) return {ok:false,message:'HMO case not found.'}
    setHmo(xs=>xs.map(x=>x.id===caseId?{...x,status:outcome,providerOutcome:outcome,pendingHours:0,lastContact:nowLabel(),eligibility:outcome==='Approved'?'Provider Approved':outcome==='Rejected'?'Provider Rejected':outcome==='Returned'?'Provider Returned':x.eligibility,escalationStatus:'Resolved'}:x))
    notify(h.patientId,'HMO Status Update',`Your HMO provider response is ${outcome}.`)
    workflow('M13',`Provider response recorded: ${outcome}`,h.reference||h.id,'Success','hmo.provider.response')
    return {ok:true}
  }

  const actions={updatePatientRecord,createUserAccount,toggleUserStatus,createHmoCase,markHmoRequirementReceived,submitHmoCase,followUpHmo,escalateHmo,recordHmoOutcome}

  Object.assign(actions,createWorkflowActions({
    getState:()=>stateRef.current,
    getSession:()=>sessionRef.current,
    commit:patch=>{
      // Advance immediately so repeated clicks before React renders see the commit.
      stateRef.current=normalizeClinicState({...stateRef.current,...patch})
      for(const [key,value] of Object.entries(patch))setters[`set${key[0].toUpperCase()}${key.slice(1)}`]?.(persistableCollection(key,value))
    },
  }))

  const resetDemo=()=>{
    Object.keys(localStorage).filter(k=>k.startsWith(STORAGE_PREFIX)).forEach(k=>localStorage.removeItem(k))
    window.location.reload()
  }

  const value=useMemo(()=>({state,setters,actions,toast,log,workflow,notify,resetDemo,toasts,session,setSession}),[persons,services,branchServices,dentistServiceAssignments,branches,dentists,staff,patients,appointments,queue,treatments,invoices,hmo,inquiries,conversations,notifications,prescriptions,followups,users,automations,workflowLog,campaigns,loyalty,audit,toasts,checkIns,session,clock])
  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>
}

export function useClinic() {
  const ctx=useContext(ClinicContext)
  if (!ctx) throw new Error('useClinic must be used inside ClinicProvider')
  return ctx
}
