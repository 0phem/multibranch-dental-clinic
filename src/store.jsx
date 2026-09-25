import { readCollection, writeCollection } from './persistence.js'
import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
  INITIAL_PERSONS,
  INITIAL_PATIENTS, INITIAL_APPOINTMENTS, INITIAL_QUEUE,
  INITIAL_TREATMENTS, INITIAL_INVOICES, INITIAL_HMO, INITIAL_INQUIRIES, INITIAL_CONVERSATIONS,
  INITIAL_NOTIFICATIONS, INITIAL_PRESCRIPTIONS, INITIAL_FOLLOWUPS, INITIAL_USERS, INITIAL_AUTOMATIONS,
  INITIAL_WORKFLOW_LOG, INITIAL_CAMPAIGNS, INITIAL_LOYALTY, INITIAL_AUDIT, INITIAL_BOOKING_DRAFTS
} from './data.js'
import { uid, nowLabel } from './logic.js'
import { clinicNow, rebaseDemoRecords } from './clock.js'
import { normalizeClinicState, sessionForRole, resolvePatientLogin, persistableCollection } from './contracts.js'
import { createWorkflowActions } from './workflow.js'
import { createRegistrationAction } from './registration.js'
import { createIdentityBridge } from './identity-bridge.js'
import { fetchReferenceData, deriveDentistServiceAssignments } from './reference-data-bridge.js'

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
const fullName=person=>[person?.firstName,person?.lastName].map(cleanNamePart).filter(Boolean).join(' ')

// Phase 2A: branches/services/branchServices/dentists/staff are backend-authoritative — see the Phase 2A
// plan, section J. They are deliberately NOT usePersist-backed (no localStorage for this slice, refetched
// fresh every session, mirroring how session/role are already never localStorage-cached) and are populated
// only by fetchReferenceData(), gated on the current session's role, below. dentistServiceAssignments is
// not its own fetched collection at all — it was always a *generated* array even in data.js, and stays
// that way here, derived from the fetched dentists' serviceIds (see deriveDentistServiceAssignments).
//
// `initialReferenceData` is a test-only injection point (Phase 2A plan, section P/S2B): when supplied, the
// five collections seed synchronously from it and the live fetch effect never fires. This exists because
// render-smoke.mjs renders ClinicProvider via renderToString, which runs render-phase code only — a real
// fetch-on-mount effect never executes under SSR, so the script needs a synchronous alternative rather than
// silently seeing empty reference data.
export function ClinicProvider({ children, initialReferenceData }) {
  const recoveryBlocked=useRef(false)
  const [persistenceErrors,setPersistenceErrors]=useState({})
  const reportPersistence=useCallback((key,message)=>setPersistenceErrors(previous=>{
    if(previous[key]===message||!previous[key]&&!message)return previous
    const next={...previous};if(message)next[key]=message;else delete next[key];return next
  }),[])

  const [persons,setPersons]=usePersist('persons',INITIAL_PERSONS,reportPersistence,recoveryBlocked)
  const [services,setServices]=useState(initialReferenceData?.services??[])
  const [branchServices,setBranchServices]=useState(initialReferenceData?.branchServices??[])
  const [branches,setBranches]=useState(initialReferenceData?.branches??[])
  const [dentists,setDentists]=useState(initialReferenceData?.dentists??[])
  const [staff,setStaff]=useState(initialReferenceData?.staff??[])
  const dentistServiceAssignments=useMemo(()=>deriveDentistServiceAssignments(dentists),[dentists])
  const [refDataStatus,setRefDataStatus]=useState(initialReferenceData?'ready':'idle')
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
  const [bookingDrafts,setBookingDrafts]=usePersist('booking-drafts',INITIAL_BOOKING_DRAFTS,reportPersistence,recoveryBlocked)
  const [toasts,setToasts]=useState([])
  const [session,setSessionState]=useState(null)
  const sessionRef=useRef(null)
  const stateRef=useRef(null)
  const actionsRef=useRef(null)
  const [clock,setClock]=useState(clinicNow)
  useEffect(()=>{const timer=setInterval(()=>{setClock(clinicNow());if(sessionRef.current?.role==='staff'){actionsRef.current?.evaluateHmoTimers();actionsRef.current?.evaluateOperationalReminders()}},15000);return ()=>clearInterval(timer)},[])
  const setSession=role=>{const next=role?sessionForRole(role,stateRef.current):null;sessionRef.current=next;setSessionState(next);if(next?.role==='staff'){actionsRef.current?.evaluateHmoTimers();actionsRef.current?.evaluateOperationalReminders()}return next}

  // Phase 2A reference-data bootstrap (plan section H/J). Fires once a session exists, role-aware (Patient
  // never triggers a /api/staff call — see fetchReferenceData). A logged-out session clears back to idle so
  // the next login always refetches fresh, never stale cross-account data. Skipped entirely when
  // initialReferenceData was supplied (render-smoke's synchronous test-only path, see ClinicProvider's
  // own comment above).
  const [refDataRetryToken,setRefDataRetryToken]=useState(0)
  const retryReferenceData=()=>setRefDataRetryToken(t=>t+1)
  useEffect(()=>{
    if(initialReferenceData)return
    if(!session?.role){
      setRefDataStatus(current=>current==='idle'?current:'idle')
      setBranches([]);setServices([]);setBranchServices([]);setDentists([]);setStaff([])
      return
    }
    let cancelled=false
    setRefDataStatus('loading')
    fetchReferenceData(session.role).then(result=>{
      if(cancelled)return
      if(!result.ok){setRefDataStatus('error');return}
      setBranches(result.data.branches)
      setServices(result.data.services)
      setBranchServices(result.data.branchServices)
      setDentists(result.data.dentists)
      setStaff(result.data.staff)
      setRefDataStatus('ready')
    })
    return ()=>{cancelled=true}
  },[session?.role,initialReferenceData,refDataRetryToken])

  // Bugfix found during real-browser Phase 2A QA: sessionForRole(role,state) (contracts.js) computes
  // session.active by calling validSession(state,session) internally, at the moment the session is first
  // established (identity-bridge.js, synchronously inside login/checkSession). For Staff/Dentist,
  // validSession checks state.staff/state.dentists — which are now backend-fetched and still empty at
  // that exact moment, since the fetch above only starts once a session exists. The result: active got
  // permanently frozen false, and every subsequent render kept failing validSession even after the fetch
  // completed and state.staff/state.dentists were correctly populated — session itself was never
  // recomputed. (Patient/Owner are unaffected: their validSession checks don't depend on these two
  // collections.) Re-deriving the session once reference data is actually ready fixes this at its root,
  // without touching validSession/sessionForRole's logic or any other role's behavior.
  useEffect(()=>{
    if(refDataStatus==='ready'&&sessionRef.current&&['staff','dentist'].includes(sessionRef.current.role)){
      setSession(sessionRef.current.role)
    }
  },[refDataStatus])

  const personById=id=>persons.find(p=>p.id===id)
  const staffById=id=>staff.find(s=>s.id===id)
  const personProjection=(entity,{doctor=false}={})=>{
    const person=personById(entity.personId)
    const base=fullName(person)
    return {
      ...entity,
      firstName:person?.firstName||'', lastName:person?.lastName||'',
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
    return {...u,name,email:p?.email||'',phone:p?.phone||'',firstName:p?.firstName||'',lastName:p?.lastName||''}
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
    automations,workflowLog,campaigns,loyalty,audit,checkIns,bookingDrafts,clock,today:clock.date
  })
  stateRef.current=state
  const migrationDone=useRef(false)
  useEffect(()=>{
    // Phase 2A: this effect re-derives branchId/serviceId cross-references on still-local records using
    // the current branches/services/dentists/staff — which are empty until the reference-data fetch
    // resolves (refDataStatus==='ready'). Running it earlier would null out every existing local
    // appointment/queue/treatment's branchId/serviceId against an empty branches/dentists/services set —
    // gating on refDataStatus prevents that (plan section S3 — legacy-ID cutover safety).
    if(migrationDone.current||recoveryBlocked.current||refDataStatus!=='ready')return
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
  },[refDataStatus])
  const setters={
    setPersons,setServices,setBranchServices,setBranches,setDentists,setStaff,setPatients,
    setAppointments,setQueue,setTreatments,setInvoices,setHmo,setInquiries,setConversations,setNotifications,
    setPrescriptions,setFollowups,setUsers,setAutomations,setWorkflowLog,setCampaigns,setLoyalty,setAudit,setCheckIns,
    setBookingDrafts
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
  const commit=patch=>{
    // Advance immediately so repeated clicks before React renders see the commit.
    stateRef.current=normalizeClinicState({...stateRef.current,...patch})
    for(const [key,value] of Object.entries(patch))setters[`set${key[0].toUpperCase()}${key.slice(1)}`]?.(persistableCollection(key,value))
  }

  Object.assign(actions,createWorkflowActions({
    getState:()=>stateRef.current,
    getSession:()=>sessionRef.current,
    commit,
  }))
  // Public registration boundary: no session exists yet, so it does not go through createWorkflowActions' run()
  // (which requires validSession); it shares the same synchronous read/validate/commit discipline directly.
  actions.registerPatient=createRegistrationAction({getState:()=>stateRef.current,commit})
  // Backend Foundation 1B — TEMPORARY compatibility bridge (see identity-bridge.js). Translates a real,
  // backend-authenticated identity (GET /api/me) into the shape the still-frontend-local pages/selectors
  // already expect. Remove this wiring once the business modules it stands in for move to the backend.
  actions.bridgeBackendIdentity=createIdentityBridge({getState:()=>stateRef.current,commit})

  actionsRef.current=actions

  // Patient email sign-in: resolves USER -> PERSON -> PATIENT from the typed email, never from a browser-supplied ID.
  const loginPatientByEmail=email=>{
    const result=resolvePatientLogin(stateRef.current,email)
    if(result.ok){sessionRef.current=result.session;setSessionState(result.session)}
    return result
  }

  // Adopts an already-resolved session object as-is (Backend Foundation 1B: the identity-bridge's Patient path
  // produces an arbitrary sessionForUser()-shaped session, not one of the four fixed ROLE_INFO keys setSession
  // understands). Staff/Dentist/Owner keep using setSession(role) unchanged.
  const adoptSession=session=>{sessionRef.current=session;setSessionState(session)}

  const resetDemo=()=>{
    Object.keys(localStorage).filter(k=>k.startsWith(STORAGE_PREFIX)).forEach(k=>localStorage.removeItem(k))
    window.location.reload()
  }

  const value=useMemo(()=>({state,setters,actions,toast,log,workflow,resetDemo,toasts,session,setSession,adoptSession,loginPatientByEmail,persistenceErrors,refDataStatus,retryReferenceData}),[persons,services,branchServices,dentistServiceAssignments,branches,dentists,staff,patients,appointments,queue,treatments,invoices,hmo,inquiries,conversations,notifications,prescriptions,followups,users,automations,workflowLog,campaigns,loyalty,audit,toasts,checkIns,bookingDrafts,session,clock,persistenceErrors,refDataStatus])
  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>
}

export function useClinic() {
  const ctx=useContext(ClinicContext)
  if (!ctx) throw new Error('useClinic must be used inside ClinicProvider')
  return ctx
}
