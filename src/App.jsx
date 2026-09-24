import { validSession, canAccessPage } from './safeguards.js'
import { Notice } from './components.jsx'
import React, { useEffect, useState } from 'react'
import { ClinicProvider, useClinic } from './store.jsx'
import { Brand, Login, Shell, ToastStack } from './layout.jsx'
import { PatientRegister } from './pages/PatientRegister.jsx'
import { DashboardPage } from './pages/Dashboards.jsx'
import { AppointmentsPage, BookingPage, SchedulePage } from './pages/Scheduling.jsx'
import { CheckInPage, QueuePage, CapacityPage } from './pages/PatientFlow.jsx'
import { PatientsPage, TreatmentPage, PrescriptionsPage, FollowupsPage } from './pages/Clinical.jsx'
import { BillingPage, HmoPage, InquiriesPage, MessagesPage } from './pages/FinanceCommunication.jsx'
import { PatientLoyaltyPage } from './pages/PatientLoyalty.jsx'
import { PatientMePage } from './pages/PatientMe.jsx'
import { AnalyticsPage, AutomationPage, BranchesPage, EngagementPage, ModulesPage, TeamPage, UsersPage } from './pages/Admin.jsx'
import * as api from './api-client.js'

const START_PAGE={patient:'dashboard',staff:'dashboard',dentist:'dashboard',owner:'dashboard'}
const NO_WORKSPACE_MESSAGE='This account doesn’t have a workspace configured yet. Contact the clinic administrator.'

function AuthChecking() {
  return <main className="login-shell"><section className="login-panel"><Brand className="brand-login"/><p role="status" className="login-copy">Checking your session…</p></section></main>
}

// Backend Foundation 1B: an honest, distinct screen for "the clinic system could not be reached" — never a
// silent fallback to demo/local authentication, and never a crash.
function AuthUnavailable({ onRetry }) {
  return <main className="login-shell"><section className="login-panel">
    <Brand className="brand-login"/>
    <div className="login-copy-wrap"><h1>Can’t reach the clinic system</h1><p className="login-copy">The clinic system is temporarily unavailable. Check your connection and try again.</p></div>
    <button type="button" className="btn primary md" onClick={onRetry}><span>Try again</span></button>
  </section></main>
}

function AppBody() {
  const store=useClinic()
  const [authPhase,setAuthPhase]=useState('checking')
  const [authError,setAuthError]=useState('')
  const [page,setPageState]=useState('dashboard')
  const [context,setContext]=useState(null)
  const [activeBranch,setActiveBranch]=useState('All Branches')
  const [showRegister,setShowRegister]=useState(false)

  // Backend role is authoritative, always. This is a *derived* value, never independent state a stale login
  // could leave behind — see identity-bridge.js for how it gets here.
  const role=store.session?.role??null

  const enterSession=session=>{
    store.adoptSession(session)
    setContext(null)
    setPageState(START_PAGE[session.role]||'dashboard')
    setActiveBranch(store.state.branches.find(b=>b.id===session.branchId)?.name||'All Branches')
    setShowRegister(false)
  }

  const checkSession=async()=>{
    setAuthPhase('checking')
    setAuthError('')
    const result=await api.me()
    if(result.ok){
      const bridge=store.actions.bridgeBackendIdentity(result.data)
      if(bridge.ok){
        enterSession(bridge.session)
        setAuthPhase('authenticated')
        return
      }
      // Authenticated at the backend, but this checkpoint's frontend has no local operational identity for
      // this account (see identity-bridge.js) — fail closed rather than show a broken workspace, and don't
      // leave a dangling backend session behind either.
      await api.logout()
      setAuthError(NO_WORKSPACE_MESSAGE)
      setAuthPhase('unauthenticated')
      return
    }
    setAuthPhase(result.kind==='unauthenticated'?'unauthenticated':'error')
  }
  // Session restoration on load/refresh comes only from the backend session, never from localStorage.
  useEffect(()=>{checkSession()},[])

  const login=async(email,password)=>{
    setAuthError('')
    const result=await api.login(email,password)
    if(!result.ok){
      const message=result.kind==='validation'?(Object.values(result.errors||{})[0]?.[0]||result.message):result.message
      return {ok:false,message:message||'Something went wrong. Try again.'}
    }
    const bridge=store.actions.bridgeBackendIdentity(result.data)
    if(!bridge.ok){
      await api.logout()
      return {ok:false,message:NO_WORKSPACE_MESSAGE}
    }
    enterSession(bridge.session)
    setAuthPhase('authenticated')
    return {ok:true}
  }

  const register=async form=>{
    setAuthError('')
    const result=await api.register(form)
    if(!result.ok)return result
    const bridge=store.actions.bridgeBackendIdentity(result.data)
    if(!bridge.ok)return {ok:false,message:'Something went wrong finishing your registration. Try signing in.'}
    enterSession(bridge.session)
    setAuthPhase('authenticated')
    return {ok:true}
  }

  const logout=async()=>{
    const result=await api.logout()
    // Always clears the local compatibility session — a stuck authenticated shell is never acceptable — but the
    // message told to the Patient/Staff/Dentist/Owner is honest about whether the backend actually confirmed it.
    store.adoptSession(null)
    setContext(null);setPageState('dashboard');setActiveBranch('All Branches');setShowRegister(false)
    setAuthPhase('unauthenticated')
    store.toast(
      result.backendConfirmed?'You’re signed out.':'Signed out on this device, but the server session close could not be confirmed.',
      result.backendConfirmed?'default':'warning'
    )
  }

  const setPage=(next,record=null)=>{if(role&&canAccessPage(store.state,store.session,next)){setContext(record);setPageState(next)}}

  if(authPhase==='checking')return <AuthChecking/>
  if(authPhase==='error')return <AuthUnavailable onRetry={checkSession}/>

  const storageWarnings=Object.values(store.persistenceErrors||{})
  if(storageWarnings.some(message=>message.includes('could not be read')))return <Notice title="Saved workspace needs recovery">{storageWarnings.join(' ')}</Notice>

  if (!role) return <>
    {authError&&<Notice tone="warning">{authError}</Notice>}
    {showRegister
      ?<PatientRegister onRegister={register} onCancel={()=>{setAuthError('');setShowRegister(false)}}/>
      :<Login onLogin={login} onShowRegister={()=>{setAuthError('');setShowRegister(true)}}/>}
    <ToastStack toasts={store.toasts}/>
  </>

  if(!validSession(store.state,store.session))return <><Notice>Your account or branch access changed. Reopen your workspace or ask an administrator.</Notice><Login onLogin={login}/></>

  const branch=role==='staff'||role==='dentist'?store.state.branches.find(b=>b.id===store.session?.branchId)?.name||'Unknown branch':activeBranch
  const props={role,activeBranch:branch,store,setPage,context}
  let content
  switch(canAccessPage(store.state,store.session,page)?page:'unavailable'){
    case 'dashboard': content=<DashboardPage {...props}/>; break
    case 'book': content=<BookingPage role={role} store={store} setPage={setPage} context={context}/>; break
    case 'appointments': content=<AppointmentsPage role={role} store={store} setPage={setPage} context={context}/>; break
    case 'schedule': content=<SchedulePage store={store}/>; break
    case 'checkin': content=<CheckInPage store={store}/>; break
    case 'queue': content=<QueuePage {...props}/>; break
    case 'capacity': content=<CapacityPage {...props}/>; break
    case 'patients': content=<PatientsPage {...props}/>; break
    case 'treatment': content=<TreatmentPage key={context?.queueEntryId||'none'} {...props}/>; break
    case 'billing': content=<BillingPage role={role} store={store} context={context}/>; break
    case 'hmo': content=<HmoPage {...props}/>; break
    case 'inquiries': content=<InquiriesPage store={store}/>; break
    case 'messages': content=<MessagesPage {...props}/>; break
    case 'prescriptions': content=<PrescriptionsPage role={role} store={store} context={context}/>; break
    case 'followups': content=<FollowupsPage role={role} store={store} setPage={setPage} context={context}/>; break
    case 'branches': content=<BranchesPage store={store}/>; break
    case 'team': content=<TeamPage store={store}/>; break
    case 'analytics': content=<AnalyticsPage activeBranch={activeBranch} store={store}/>; break
    case 'users': content=<UsersPage store={store}/>; break
    case 'automation': content=<AutomationPage store={store}/>; break
    case 'engagement': content=<EngagementPage role={role} store={store}/>; break
    case 'loyalty': content=<PatientLoyaltyPage store={store}/>; break
    case 'me': content=<PatientMePage store={store} setPage={setPage}/>; break
    case 'modules': content=<ModulesPage/>; break
    default: content=<Notice>This screen is no longer available with your current permissions. <button onClick={()=>setPage('dashboard')}>Return home</button></Notice>;
  }

  return <>
    <Shell role={role} page={page} setPage={setPage} onLogout={logout} activeBranch={branch} setActiveBranch={setActiveBranch} resetDemo={store.resetDemo} store={store}>{storageWarnings.length>0&&<Notice tone="warning">{[...new Set(storageWarnings)].join(" ")}</Notice>}{content}</Shell>
    <ToastStack toasts={store.toasts}/>
  </>
}

export default function App(){return <ClinicProvider><AppBody/></ClinicProvider>}
