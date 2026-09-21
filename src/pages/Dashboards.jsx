import React from 'react'
import { PatientHome } from './PatientHome.jsx'
import { ROLE_INFO } from '../data.js'
import { Button, Card, Icon, MetricRow, Notice, PageHeader, Progress, StatCard, Status } from '../components.jsx'
import { branchCapacity, dentistName, displayTime, patientName, peso } from '../logic.js'

import { pendingHours } from '../phase3-contracts.js'
import { prescriptionTasks } from '../phase2.js'
import { clinicDate } from '../clock.js'
import { encounterContext, isTodayQueue, isActiveQueue, sessionForRole } from '../contracts.js'

export function DashboardPage({ role, activeBranch, setPage, store }) {
  const { state }=store
  if (role==='patient') return <PatientHome store={store} setPage={setPage}/>
  if (role==='staff') return <StaffDashboard setPage={setPage} activeBranch={activeBranch} state={state} session={store.session}/>
  if (role==='dentist') return <DentistDashboard setPage={setPage} state={state} session={store.session}/>
  return <OwnerDashboard setPage={setPage} activeBranch={activeBranch} state={state}/>
}

function StaffDashboard({ activeBranch, setPage, state, session }) {
  const branchFilter=x=>activeBranch==='All Branches'||x.branch===activeBranch
  const todays=state.appointments.filter(a=>a.date===clinicDate()&&a.status!=='Cancelled'&&branchFilter(a)).sort((a,b)=>a.start.localeCompare(b.start))
  const waiting=state.queue.filter(q=>q.status==='Waiting'&&isTodayQueue(q)&&branchFilter(q))
  const pendingHmo=state.hmo.filter(h=>['Pending','Missing Requirements','Ready for Submission','Returned','Escalated'].includes(h.status)&&branchFilter(h))
  const openInquiries=state.inquiries.filter(i=>i.status==='Open'&&i.assignedUserId===(session?.userId||ROLE_INFO.staff.userId)&&i.branchId===(session?.branchId||ROLE_INFO.staff.branchId))
  const overdueHmo=state.hmo.filter(h=>['Pending','Escalated'].includes(h.status)&&pendingHours(h,state.clock)>=12&&branchFilter(h))
  const branch=state.branches.find(b=>b.name===activeBranch)
  return <>
    <PageHeader kicker="Front desk workspace" title="Today’s clinic operations" text={`Keep arrivals, queues, appointments and patient requests moving smoothly${branch?` at ${branch.name}`:''}.`} aside={<Button onClick={()=>setPage('checkin')} icon="checkin">Check in patient</Button>}/>
    <div className="stats-grid">
      <StatCard label="Appointments today" value={todays.length} hint="Confirmed and pending" icon={<Icon name="calendar" size={18}/>}/>
      <StatCard label="Waiting now" value={waiting.length} hint="Across active dentist queues" tone="blue" icon={<Icon name="queue" size={18}/>}/>
      <StatCard label="HMO needs action" value={pendingHmo.length} hint={`${overdueHmo.length} beyond follow-up threshold`} tone="amber" icon={<Icon name="shield" size={18}/>}/>
      <StatCard label="Open inquiries" value={openInquiries.length} hint="Prospective patients" tone="purple" icon={<Icon name="message" size={18}/>}/>
    </div>
    <div className="ops-grid">
      <Card title="Today’s patient flow" subtitle="Upcoming arrivals and current statuses" actions={<button className="text-link" onClick={()=>setPage('appointments')}>View all appointments</button>}>
        <div className="schedule-board elevated">{todays.slice(0,6).map(a=><div key={a.id} className="schedule-chip"><div className="schedule-time-pill">{displayTime(a.start)}</div><div><strong>{patientName(a.patientId,state.patients)}</strong><small>{a.service} • {dentistName(a.dentistId,state.dentists)}</small></div><Status>{a.status}</Status></div>)}</div>
      </Card>
      <Card title="Needs attention" subtitle="Exceptions before routine work">
        <div className="alert-list">
          {overdueHmo.length>0&&<div className="alert warning"><span className="alert-icon"><Icon name="shield" size={18}/></span><div><b>{overdueHmo.length} HMO case{overdueHmo.length>1?'s':''} overdue</b><span>Follow-up threshold has been reached.</span></div><button onClick={()=>setPage('hmo')}>Review</button></div>}
          {waiting.length>0&&<div className="alert info"><span className="alert-icon"><Icon name="queue" size={18}/></span><div><b>{waiting.length} patient{waiting.length>1?'s':''} waiting</b><span>Monitor queue age and dentist availability.</span></div><button onClick={()=>setPage('queue')}>Open queue</button></div>}
          {openInquiries.length>0&&<div className="alert neutral"><span className="alert-icon"><Icon name="message" size={18}/></span><div><b>{openInquiries.length} new social inquir{openInquiries.length>1?'ies':'y'}</b><span>Respond before the lead goes cold.</span></div><button onClick={()=>setPage('inquiries')}>Respond</button></div>}
          {!overdueHmo.length&&!waiting.length&&!openInquiries.length&&<div className="alert success"><span className="alert-icon"><Icon name="shield" size={18}/></span><div><b>Everything is on track</b><span>No urgent operational exceptions right now.</span></div></div>}
        </div>
      </Card>
    </div>
    <Card title="Capacity snapshot" subtitle="Live view of available chair-side capacity" className="top-gap"><div className="capacity-row-grid">{state.branches.filter(b=>activeBranch==='All Branches'||b.name===activeBranch).map(b=>{const c=branchCapacity(b.name,state);return <div key={b.id} className="capacity-tile"><div className="capacity-tile-head"><div><b>{b.name}</b><small>{b.city}</small></div><span className={c.overloaded?'risk':'healthy'}>{c.overloaded?'Attention':'Healthy'}</span></div><div className="capacity-main"><strong>{c.workload}%</strong><span>workload</span></div><Progress value={c.workload} threshold={c.threshold}/><div className="capacity-meta"><span>{c.activeDentists} dentists</span><span>{c.waiting} waiting</span><span>~{c.estimate} min</span></div></div>})}</div></Card>
  </>
}

function DentistDashboard({ setPage, state, session }) {
  const did=session?.dentistId||ROLE_INFO.dentist.dentistId
  const today=state.appointments.filter(a=>a.date===clinicDate()&&a.dentistId===did&&a.status!=='Cancelled').sort((a,b)=>a.start.localeCompare(b.start))
  const ownQueue=state.queue.filter(q=>q.dentistId===did&&isTodayQueue(q)&&isActiveQueue(q)&&q.status!=='Temporarily Away').sort((a,b)=>(a.position||99)-(b.position||99))
  const activeTreatment=state.treatments.find(t=>t.dentistId===did&&t.date===clinicDate()&&t.status==='In Treatment')
  const pendingRx=prescriptionTasks(state,session||sessionForRole('dentist',state)).length
  const follow=state.followups.filter(f=>f.dentistId===did&&f.status==='Open').length
  const next=ownQueue[0]
  return <>
    <PageHeader kicker="Clinical workspace" title="Your day, without the clutter" text="See who is next, open the chart, document treatment and keep follow-up tasks moving." aside={next?<Button onClick={()=>setPage('queue')} icon="queue">Open my queue</Button>:null}/>
    {activeTreatment&&<div className="active-treatment-banner"><div className="pulse-dot"/><div><span>Active treatment</span><b>{patientName(activeTreatment.patientId,state.patients)}</b><small>{activeTreatment.procedure||activeTreatment.plan||'Treatment in progress'}</small></div><Button variant="soft" onClick={()=>setPage('treatment',encounterContext(state.queue.find(q=>q.id===activeTreatment.queueEntryId)))} icon="tooth">Continue treatment</Button></div>}
    <div className="dentist-command-grid">
      <Card className="next-patient-card" title="Next patient" subtitle="Your live queue">
        {next?<><div className="next-patient-top"><div className="avatar xl">{patientName(next.patientId,state.patients).split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div><h2>{patientName(next.patientId,state.patients)}</h2><p>Checked in {displayTime(next.checkedIn)} • Position #{next.position}</p></div><Status>{next.status}</Status></div><div className="next-patient-actions"><Button onClick={()=>setPage('queue')} icon="queue">Open queue</Button><Button variant="soft" onClick={()=>setPage('patients',encounterContext(next))} icon="file">Open chart</Button></div></>:<Notice tone="success" title="Queue clear">No patient is currently waiting for you.</Notice>}
      </Card>
      <div className="clinical-stat-stack"><div><span><Icon name="calendar" size={18}/></span><div><b>{today.length}</b><small>scheduled today</small></div></div><div><span><Icon name="pill" size={18}/></span><div><b>{pendingRx}</b><small>prescription tasks</small></div></div><div><span><Icon name="followup" size={18}/></span><div><b>{follow}</b><small>open follow-ups</small></div></div></div>
    </div>
    <div className="grid-2 top-gap">
      <Card title="Today’s schedule" subtitle="Your validated appointments" actions={<button className="text-link" onClick={()=>setPage('schedule')}>Open schedule</button>}><div className="day-list">{today.slice(0,5).map(a=><div className="day-list-row" key={a.id}><div className="day-time">{displayTime(a.start)}</div><div><b>{patientName(a.patientId,state.patients)}</b><small>{a.service} • {a.duration} min</small></div><Status>{a.status}</Status></div>)}</div></Card>
      <Card title="Clinical task list" subtitle="Handoffs created by completed treatment"><div className="task-list"><button onClick={()=>setPage('prescriptions')}><span><Icon name="pill" size={18}/></span><div><b>Prescription tasks</b><small>{pendingRx?`${pendingRx} awaiting authorization`:'No outstanding prescription tasks'}</small></div><Icon name="chevron" size={16}/></button><button onClick={()=>setPage('followups')}><span><Icon name="followup" size={18}/></span><div><b>Follow-up care</b><small>{follow?`${follow} return-visit obligation${follow>1?'s':''}`:'No unscheduled follow-ups'}</small></div><Icon name="chevron" size={16}/></button><button onClick={()=>setPage('messages')}><span><Icon name="message" size={18}/></span><div><b>Patient messages</b><small>Clinical conversations assigned to you</small></div><Icon name="chevron" size={16}/></button></div></Card>
    </div>
  </>
}

function OwnerDashboard({ activeBranch, setPage, state }) {
  const branchData=state.branches.filter(b=>activeBranch==='All Branches'||b.name===activeBranch).map(b=>branchCapacity(b.name,state))
  const appointments=state.appointments.filter(a=>a.date===clinicDate()&&a.status!=='Cancelled'&&(activeBranch==='All Branches'||a.branch===activeBranch))
  const pendingHmo=state.hmo.filter(h=>['Pending','Escalated'].includes(h.status)&&(activeBranch==='All Branches'||h.branch===activeBranch))
  const revenue=state.invoices.filter(i=>i.status==='Paid'&&(activeBranch==='All Branches'||i.branch===activeBranch)).reduce((s,i)=>s+i.total,0)
  const exceptions=[...branchData.filter(c=>c.overloaded).map(c=>({title:`${c.branch} capacity exception`,detail:`${c.workload}% workload • ~${c.estimate} min wait`})),...pendingHmo.filter(h=>pendingHours(h,state.clock)>=12).map(h=>({title:'HMO follow-up threshold reached',detail:`${patientName(h.patientId,state.patients)} • ${h.provider} • ${pendingHours(h,state.clock).toFixed(1)}h pending`}))]
  const maxLoad=Math.max(100,...branchData.map(x=>x.workload))
  return <>
    <PageHeader kicker="Owner overview" title="Executive dashboard" text="A focused view of clinic performance, exceptions and branch health." aside={<span className="context-chip"><Icon name="building" size={14}/>{activeBranch}</span>}/>
    <div className="stats-grid">
      <StatCard label="Appointments today" value={appointments.length} hint="Across visible branches" icon={<Icon name="calendar" size={18}/>}/>
      <StatCard label="Waiting patients" value={branchData.reduce((s,c)=>s+c.waiting,0)} hint="Live patient flow" tone="blue" icon={<Icon name="queue" size={18}/>}/>
      <StatCard label="HMO pending" value={pendingHmo.length} hint={`${pendingHmo.filter(h=>pendingHours(h,state.clock)>=12).length} beyond threshold`} tone="amber" icon={<Icon name="shield" size={18}/>}/>
      <StatCard label="Paid revenue" value={peso.format(revenue)} hint="Recorded demo transactions" tone="purple" icon={<Icon name="wallet" size={18}/>}/>
    </div>
    <div className="owner-dashboard-grid">
      <Card title="Branch workload" subtitle="Compare patient flow and staffing at a glance" actions={<button className="text-link" onClick={()=>setPage('capacity')}>Capacity details</button>}>
        <div className="branch-chart">{branchData.map(c=><div className="branch-chart-row" key={c.branch}><div className="branch-chart-label"><b>{c.branch}</b><span>{c.activeDentists} dentists • {c.waiting} waiting</span></div><div className="branch-chart-bar"><span style={{width:`${Math.min(100,(c.workload/maxLoad)*100)}%`}}/></div><strong>{c.workload}%</strong></div>)}</div>
        <div className="chart-caption"><span><i className="healthy"/>Healthy</span><span>Updated from live queue and staffing data</span></div>
      </Card>
      <Card title="Priority exceptions" subtitle="Only the issues that may need a decision" actions={<button className="text-link" onClick={()=>setPage('analytics')}>Open analytics</button>}>
        <div className="exception-list">{exceptions.length?exceptions.slice(0,5).map((x,i)=><div className="exception-row" key={i}><span><Icon name="activity" size={17}/></span><div><b>{x.title}</b><small>{x.detail}</small></div><Icon name="chevron" size={16}/></div>):<div className="executive-clear"><span><Icon name="shield" size={22}/></span><div><b>No critical exceptions</b><small>Visible branches are operating within configured thresholds.</small></div></div>}</div>
      </Card>
    </div>
    <div className="cards-3 top-gap">
      <Card title="Scheduling health"><MetricRow label="Confirmed today" value={appointments.filter(a=>a.status==='Confirmed').length}/><MetricRow label="Pending confirmation" value={appointments.filter(a=>a.status==='Pending').length}/><button className="card-link" onClick={()=>setPage('analytics')}>See scheduling report <Icon name="arrow" size={14}/></button></Card>
      <Card title="HMO health"><MetricRow label="Pending provider response" value={pendingHmo.length}/><MetricRow label="Approved cases" value={state.hmo.filter(h=>h.status==='Approved').length}/><button className="card-link" onClick={()=>setPage('hmo')}>Open HMO overview <Icon name="arrow" size={14}/></button></Card>
      <Card title="Patient communication"><MetricRow label="Open inquiries" value={state.inquiries.filter(i=>i.status==='Open').length}/><MetricRow label="Active conversations" value={state.conversations.filter(c=>c.status==='Open').length}/><button className="card-link" onClick={()=>setPage('engagement')}>View engagement <Icon name="arrow" size={14}/></button></Card>
    </div>
  </>
}
