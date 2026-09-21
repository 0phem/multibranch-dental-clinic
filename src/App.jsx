import { validSession, canAccessPage } from './safeguards.js'
import { Notice } from './components.jsx'
import React, { useEffect, useState } from 'react'
import { ClinicProvider, useClinic } from './store.jsx'
import { Login, Shell, ToastStack } from './layout.jsx'
import { DashboardPage } from './pages/Dashboards.jsx'
import { AppointmentsPage, BookingPage, SchedulePage } from './pages/Scheduling.jsx'
import { CheckInPage, QueuePage, CapacityPage } from './pages/PatientFlow.jsx'
import { PatientsPage, TreatmentPage, PrescriptionsPage, FollowupsPage } from './pages/Clinical.jsx'
import { BillingPage, HmoPage, InquiriesPage, MessagesPage } from './pages/FinanceCommunication.jsx'
import { PatientLoyaltyPage } from './pages/PatientLoyalty.jsx'
import { AnalyticsPage, AutomationPage, BranchesPage, EngagementPage, ModulesPage, TeamPage, UsersPage } from './pages/Admin.jsx'

const START_PAGE={patient:'dashboard',staff:'dashboard',dentist:'dashboard',owner:'dashboard'}

function AppBody() {
  const store=useClinic()
  const [role,setRole]=useState(null)
  const [page,setPageState]=useState('dashboard')
  const [context,setContext]=useState(null)
  const setPage=(next,record=null)=>{if(role&&canAccessPage(store.state,store.session,next)){setContext(record);setPageState(next)}}
  const [activeBranch,setActiveBranch]=useState('All Branches')

  const login=r=>{
    const session=store.setSession(r)
    if(!session?.active)return store.toast('This demo account is inactive.','warning')
    setRole(r); setContext(null);setPageState(START_PAGE[r]); setActiveBranch(store.state.branches.find(b=>b.id===session.branchId)?.name||'All Branches')
  }
  const logout=()=>{store.setSession(null);setRole(null);setContext(null);setPageState('dashboard');setActiveBranch('All Branches')}
  useEffect(()=>{if(role==='patient')setActiveBranch('All Branches')},[role])

  const storageWarnings=Object.values(store.persistenceErrors||{})
  if(storageWarnings.some(message=>message.includes('could not be read')))return <Notice title="Saved workspace needs recovery">{storageWarnings.join(' ')}</Notice>

  if (!role) return <><Login onLogin={login}/><ToastStack toasts={store.toasts}/></>

  if(!validSession(store.state,store.session))return <><Notice>Your account or branch access changed. Reopen your workspace or ask an administrator.</Notice><Login onLogin={login}/></>

  const branch=role==='staff'||role==='dentist'?store.state.branches.find(b=>b.id===store.session?.branchId)?.name||'Unknown branch':activeBranch
  const props={role,activeBranch:branch,store,setPage,context}
  let content
  switch(canAccessPage(store.state,store.session,page)?page:'unavailable'){
    case 'dashboard': content=<DashboardPage {...props}/>; break
    case 'book': content=<BookingPage role={role} store={store} setPage={setPage}/>; break
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
    case 'modules': content=<ModulesPage/>; break
    default: content=<Notice>This screen is no longer available with your current permissions. <button onClick={()=>setPage('dashboard')}>Return home</button></Notice>;
  }

  return <>
    <Shell role={role} page={page} setPage={setPage} onLogout={logout} activeBranch={branch} setActiveBranch={setActiveBranch} resetDemo={store.resetDemo} store={store}>{storageWarnings.length>0&&<Notice tone="warning">{[...new Set(storageWarnings)].join(" ")}</Notice>}{content}</Shell>
    <ToastStack toasts={store.toasts}/>
  </>
}

export default function App(){return <ClinicProvider><AppBody/></ClinicProvider>}
