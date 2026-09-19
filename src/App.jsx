import React, { useEffect, useState } from 'react'
import { ClinicProvider, useClinic } from './store.jsx'
import { ROLE_INFO } from './data.js'
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
  const [page,setPage]=useState('dashboard')
  const [activeBranch,setActiveBranch]=useState('All Branches')

  const login=r=>{
    setRole(r); setPage(START_PAGE[r]); setActiveBranch(ROLE_INFO[r].branch||'All Branches')
  }
  const logout=()=>{setRole(null);setPage('dashboard');setActiveBranch('All Branches')}
  useEffect(()=>{if(role==='patient')setActiveBranch('All Branches')},[role])

  if (!role) return <><Login onLogin={login}/><ToastStack toasts={store.toasts}/></>

  const props={role,activeBranch,store,setPage}
  let content
  switch(page){
    case 'dashboard': content=<DashboardPage {...props}/>; break
    case 'book': content=<BookingPage role={role} store={store}/>; break
    case 'appointments': content=<AppointmentsPage role={role} store={store}/>; break
    case 'schedule': content=<SchedulePage store={store}/>; break
    case 'checkin': content=<CheckInPage store={store}/>; break
    case 'queue': content=<QueuePage role={role} activeBranch={activeBranch} store={store}/>; break
    case 'capacity': content=<CapacityPage activeBranch={activeBranch} store={store}/>; break
    case 'patients': content=<PatientsPage role={role} store={store}/>; break
    case 'treatment': content=<TreatmentPage store={store}/>; break
    case 'billing': content=<BillingPage role={role} store={store}/>; break
    case 'hmo': content=<HmoPage role={role} activeBranch={activeBranch} store={store}/>; break
    case 'inquiries': content=<InquiriesPage store={store}/>; break
    case 'messages': content=<MessagesPage role={role} store={store}/>; break
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
    <Shell role={role} page={page} setPage={setPage} onLogout={logout} activeBranch={activeBranch} setActiveBranch={setActiveBranch} resetDemo={store.resetDemo}>{content}</Shell>
    <ToastStack toasts={store.toasts}/>
  </>
}

export default function App(){return <ClinicProvider><AppBody/></ClinicProvider>}
