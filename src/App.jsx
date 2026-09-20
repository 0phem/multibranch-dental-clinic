import React, { useEffect, useState } from 'react'
import { ClinicProvider, useClinic } from './store.jsx'
import { NAV } from './data.js'
import { Login, Shell, ToastStack } from './layout.jsx'
import { DashboardPage } from './pages/Dashboards.jsx'
import { AppointmentsPage, BookingPage, SchedulePage } from './pages/Scheduling.jsx'
import { CheckInPage, QueuePage, CapacityPage } from './pages/PatientFlow.jsx'
import { PatientsPage, TreatmentPage, PrescriptionsPage, FollowupsPage } from './pages/Clinical.jsx'
import { BillingPage, HmoPage, InquiriesPage, MessagesPage } from './pages/FinanceCommunication.jsx'
import { AnalyticsPage, AutomationPage, BranchesPage, EngagementPage, LoyaltyPage, ModulesPage, TeamPage, UsersPage } from './pages/Admin.jsx'

const START_PAGE={patient:'dashboard',staff:'dashboard',dentist:'dashboard',owner:'dashboard'}

function AppBody() {
  const store=useClinic()
  const [role,setRole]=useState(null)
  const [page,setPageState]=useState('dashboard')
  const [context,setContext]=useState(null)
  const setPage=(next,record=null)=>{if(role&&NAV[role].some(([key])=>key===next)){setContext(record);setPageState(next)}}
  const [activeBranch,setActiveBranch]=useState('All Branches')

  const login=r=>{
    const session=store.setSession(r)
    if(!session?.active)return store.toast('This demo account is inactive.','warning')
    setRole(r); setContext(null);setPageState(START_PAGE[r]); setActiveBranch(store.state.branches.find(b=>b.id===session.branchId)?.name||'All Branches')
  }
  const logout=()=>{store.setSession(null);setRole(null);setContext(null);setPageState('dashboard');setActiveBranch('All Branches')}
  useEffect(()=>{if(role==='patient')setActiveBranch('All Branches')},[role])

  if (!role) return <><Login onLogin={login}/><ToastStack toasts={store.toasts}/></>

  const branch=role==='staff'||role==='dentist'?store.state.branches.find(b=>b.id===store.session?.branchId)?.name||'Unknown branch':activeBranch
  const props={role,activeBranch:branch,store,setPage,context}
  let content
  switch(page){
    case 'dashboard': content=<DashboardPage {...props}/>; break
    case 'book': content=<BookingPage role={role} store={store}/>; break
    case 'appointments': content=<AppointmentsPage role={role} store={store}/>; break
    case 'schedule': content=<SchedulePage store={store}/>; break
    case 'checkin': content=<CheckInPage store={store}/>; break
    case 'queue': content=<QueuePage {...props}/>; break
    case 'capacity': content=<CapacityPage {...props}/>; break
    case 'patients': content=<PatientsPage {...props}/>; break
    case 'treatment': content=<TreatmentPage key={context?.queueEntryId||'none'} {...props}/>; break
    case 'billing': content=<BillingPage role={role} store={store}/>; break
    case 'hmo': content=<HmoPage {...props}/>; break
    case 'inquiries': content=<InquiriesPage store={store}/>; break
    case 'messages': content=<MessagesPage {...props}/>; break
    case 'prescriptions': content=<PrescriptionsPage role={role} store={store}/>; break
    case 'followups': content=<FollowupsPage role={role} store={store}/>; break
    case 'branches': content=<BranchesPage store={store}/>; break
    case 'team': content=<TeamPage store={store}/>; break
    case 'analytics': content=<AnalyticsPage activeBranch={activeBranch} store={store}/>; break
    case 'users': content=<UsersPage store={store}/>; break
    case 'automation': content=<AutomationPage store={store}/>; break
    case 'engagement': content=<EngagementPage role={role} store={store}/>; break
    case 'loyalty': content=<LoyaltyPage store={store}/>; break
    case 'modules': content=<ModulesPage/>; break
    default: content=<DashboardPage {...props}/>;
  }

  return <>
    <Shell role={role} page={page} setPage={setPage} onLogout={logout} activeBranch={branch} setActiveBranch={setActiveBranch} resetDemo={store.resetDemo} store={store}>{content}</Shell>
    <ToastStack toasts={store.toasts}/>
  </>
}

export default function App(){return <ClinicProvider><AppBody/></ClinicProvider>}
