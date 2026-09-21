import { readCollection, writeCollection } from './persistence.js'
import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
  INITIAL_PERSONS, INITIAL_SERVICES, INITIAL_BRANCH_SERVICES, INITIAL_DENTIST_SERVICE_ASSIGNMENTS,
  INITIAL_BRANCHES, INITIAL_DENTISTS, INITIAL_STAFF, INITIAL_PATIENTS, INITIAL_APPOINTMENTS, INITIAL_QUEUE,
  INITIAL_TREATMENTS, INITIAL_INVOICES, INITIAL_HMO, INITIAL_INQUIRIES, INITIAL_CONVERSATIONS,
  INITIAL_NOTIFICATIONS, INITIAL_PRESCRIPTIONS, INITIAL_FOLLOWUPS, INITIAL_USERS, INITIAL_AUTOMATIONS,
  INITIAL_WORKFLOW_LOG, INITIAL_CAMPAIGNS, INITIAL_LOYALTY, INITIAL_AUDIT
} from './data.js'
import { uid, nowLabel } from './logic.js'
import { clinicNow, rebaseDemoRecords } from './clock.js'
import { normalizeClinicState, sessionForRole, persistableCollection } from './contracts.js'
import { createWorkflowActions } from './workflow.js'

const ClinicContext=createContext(null)
const STORAGE_PREFIX='dentalops-v4-'

function usePersist(key, initial, report, recoveryBlocked) {
  const blocked=useRef(false)
  const loadError=useRef(null)
  const [value,setValue]=useState(()=>{
    const seed=['appointments','queue','treatments','invoices','followups','prescriptions','hmo','notifications','conversations','inquiries'].includes(key)?rebaseDemoRecords(initial):initial
    // SSR smoke has no browser storage; it must not simulate a storage failure.
    if(typeof localStorage==='undefined')return seed
    const result=readCollection(localStorage,`${STORAGE_PREFIX}${key}`,seed)
    blocked.current=result.blocked;loadError.current=result.error
    if(result.blocked)recoveryBlocked.current=true
    return result.value
  })
  useEffect(()=>{
    if(blocked.current){report(key,loadError.current);return}
    if(recoveryBlocked.current)return
    if(typeof localStorage==='undefined')return
    const result=writeCollection(localStorage,`${STORAGE_PREFIX}${key}`,value)
    report(key,result.ok?null:result.message)
  },[key,value,report])
  return [value,setValue]
}

const cleanNamePart=value=>String(value||'').trim().replace(/\s+/g,' ')
const fullName=person=>[person?.firstName,person?.middleName,person?.lastName].map(cleanNamePart).filter(Boolean).join(' ')

export function ClinicProvider({ children }) {
  const recoveryBlocked=useRef(false)
  const [persistenceErrors,setPersistenceErrors]=useState({})
  const reportPersistence=useCallback((key,message)=>setPersistenceErrors(previous=>{
    if(previous[key]===message||!previous[key]&&!message)return previous
    const next={...previous};if(message)next[key]=message;else delete next[key];return next
  }),[])

  const [persons,setPersons]=usePersist('persons',INITIAL_PERSONS,reportPersistence,recoveryBlocked)
  const [services,setServices]=usePersist('services',INITIAL_SERVICES,reportPersistence,recoveryBlocked)
  const [branchServices,setBranchServices]=usePersist('branch-services',INITIAL_BRANCH_SERVICES,reportPersistence,recoveryBlocked)
  const [dentistServiceAssignments,setDentistServiceAssignments]=usePersist('dentist-service-assignments',INITIAL_DENTIST_SERVICE_ASSIGNMENTS,reportPersistence,recoveryBlocked)
  const [branches,setBranches]=usePersist('branches',INITIAL_BRANCHES,reportPersistence,recoveryBlocked)
  const [dentists,setDentists]=usePersist('dentists',INITIAL_DENTISTS,reportPersistence,recoveryBlocked)
  const [staff,setStaff]=usePersist('staff',INITIAL_STAFF,reportPersistence,recoveryBlocked)
  const [patients,setPatients]=usePersist('patients',INITIAL_PATIENTS,reportPersistence,recoveryBlocked)
  const [appointments,setAppointments]=usePersist('appointments',INITIAL_APPOINTMENTS,reportPersistence,recoveryBlocked)
  const [queue,setQueue]=usePersist('queue',INITIAL_QUEUE,reportPersistence,recoveryBlocked)
  const [treatments,setTreatments]=usePersist('treatments',INITIAL_TREATMENTS,reportPersistence,recoveryBlocked)
  const [invoices,setInvoices]=usePersist('invoices',INITIAL_INVOICES,reportPersistence,recoveryBlocked)
  const [hmo,setHmo]=usePersist('hmo',INITIAL_HMO,reportPersistence,recoveryBlocked)
  const [inquiries,setInquiries]=usePersist('inquiries',INITIAL_INQUIRIES,reportPersistence,recoveryBlocked)
  const [conversations,setConversations]=usePersist('conversations',INITIAL_CONVERSATIONS,reportPersistence,recoveryBlocked)
  const [notifications,setNotifications]=usePersist('notifications',INITIAL_NOTIFICATIONS,reportPersistence,recoveryBlocked)
  const [prescriptions,setPrescriptions]=usePersist('prescriptions',INITIAL_PRESCRIPTIONS,reportPersistence,recoveryBlocked)
  const [followups,setFollowups]=usePersist('followups',INITIAL_FOLLOWUPS,reportPersistence,recoveryBlocked)
  const [users,setUsers]=usePersist('users',INITIAL_USERS,reportPersistence,recoveryBlocked)
  const [automations,setAutomations]=usePersist('automations',INITIAL_AUTOMATIONS,reportPersistence,recoveryBlocked)
  const [workflowLog,setWorkflowLog]=usePersist('workflow-log',INITIAL_WORKFLOW_LOG,reportPersistence,recoveryBlocked)
  const [campaigns,setCampaigns]=usePersist('campaigns',INITIAL_CAMPAIGNS,reportPersistence,recoveryBlocked)
  const [loyalty,setLoyalty]=usePersist('loyalty',INITIAL_LOYALTY,reportPersistence,recoveryBlocked)
  const [audit,setAudit]=usePersist('audit',INITIAL_AUDIT,reportPersistence,recoveryBlocked)
  const [checkIns,setCheckIns]=usePersist('check-ins',[],reportPersistence,recoveryBlocked)
  const [toasts,setToasts]=useState([])
  const [session,setSessionState]=useState(null)
  const sessionRef=useRef(null)
  const stateRef=useRef(null)
  const actionsRef=useRef(null)
  const [clock,setClock]=useState(clinicNow)
  useEffect(()=>{const timer=setInterval(()=>{setClock(clinicNow());if(sessionRef.current?.role==='staff'){actionsRef.current?.evaluateHmoTimers();actionsRef.current?.evaluateOperationalReminders()}},15000);return ()=>clearInterval(timer)},[])
  const setSession=role=>{const next=role?sessionForRole(role,stateRef.current):null;sessionRef.current=next;setSessionState(next);if(next?.role==='staff'){actionsRef.current?.evaluateHmoTimers();actionsRef.current?.evaluateOperationalReminders()}return next}


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
    if(migrationDone.current||recoveryBlocked.current)return
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
    setHmo(persistableCollection('hmo',state.hmo))
    setConversations(persistableCollection('conversations',state.conversations))
    setNotifications(state.notifications)
    setInquiries(persistableCollection('inquiries',state.inquiries))
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
    setWorkflowLog(xs=>[{id:uid('log'),at:nowLabel(),module,event,eventType:eventType||event,result,status},...xs])
  }
  const actions={}

  Object.assign(actions,createWorkflowActions({
    getState:()=>stateRef.current,
    getSession:()=>sessionRef.current,
    commit:patch=>{
      // Advance immediately so repeated clicks before React renders see the commit.
      stateRef.current=normalizeClinicState({...stateRef.current,...patch})
      for(const [key,value] of Object.entries(patch))setters[`set${key[0].toUpperCase()}${key.slice(1)}`]?.(persistableCollection(key,value))
    },
  }))

  actionsRef.current=actions

  const resetDemo=()=>{
    Object.keys(localStorage).filter(k=>k.startsWith(STORAGE_PREFIX)).forEach(k=>localStorage.removeItem(k))
    window.location.reload()
  }

  const value=useMemo(()=>({state,setters,actions,toast,log,workflow,resetDemo,toasts,session,setSession,persistenceErrors}),[persons,services,branchServices,dentistServiceAssignments,branches,dentists,staff,patients,appointments,queue,treatments,invoices,hmo,inquiries,conversations,notifications,prescriptions,followups,users,automations,workflowLog,campaigns,loyalty,audit,toasts,checkIns,session,clock,persistenceErrors])
  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>
}

export function useClinic() {
  const ctx=useContext(ClinicContext)
  if (!ctx) throw new Error('useClinic must be used inside ClinicProvider')
  return ctx
}
