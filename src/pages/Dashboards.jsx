import React from 'react'
import { ROLE_INFO, TODAY } from '../data.js'
import { Card, PageHeader, StatCard, Status, Notice, MetricRow, Progress } from '../components.jsx'
import { branchCapacity, dateLabel, dentistName, displayTime, nextAppointment, patientName, peso, queueWaitEstimate } from '../logic.js'

export function DashboardPage({ role, activeBranch, setPage, store }) {
  const { state }=store
  const {appointments,queue,hmo,invoices,conversations,notifications,followups,branches,dentists,treatments,patients}=state
  if (role==='patient') return <PatientDashboard setPage={setPage} state={state}/>
  if (role==='staff') return <StaffDashboard setPage={setPage} activeBranch={activeBranch} state={state}/>
  if (role==='dentist') return <DentistDashboard setPage={setPage} state={state}/>
  return <OwnerDashboard setPage={setPage} activeBranch={activeBranch} state={state}/>
}

function PatientDashboard({ setPage, state }) {
  const pid=ROLE_INFO.patient.patientId
  const next=nextAppointment(pid,state.appointments)
  const q=state.queue.find(x=>x.patientId===pid&&!['Completed','No-show'].includes(x.status))
  const wait=q?queueWaitEstimate(q,state.queue,state.appointments,state.treatments,state.dentists):0
  const openFollowups=state.followups.filter(f=>f.patientId===pid&&f.status==='Open').length
  const unread=state.notifications.filter(n=>n.patientId===pid&&!n.read).length + state.conversations.filter(c=>c.patientId===pid&&c.unreadBy?.includes('patient')).length
  const dentist=next?dentistName(next.dentistId,state.dentists):'—'
  return <>
    <PageHeader title={`Good morning, ${ROLE_INFO.patient.name.split(' ')[0]}`} text="Your next visit, queue status, messages, prescriptions, and follow-up care in one place." modules={[6,9,10,17,18,19,20]}/>
    <div className="stats-grid">
      <StatCard label="Next appointment" value={next?`${dateLabel(next.date)} • ${displayTime(next.start)}`:'None'} hint={next?`${next.branch} • ${dentist}`:'Book your next visit'} tone="teal"/>
      <StatCard label="Current queue" value={q?q.status:'Not checked in'} hint={q?`Position #${q.position} • ${wait} min estimated`:'Queue appears after check-in'} tone="blue"/>
      <StatCard label="Open follow-ups" value={openFollowups} hint="Return visits requiring scheduling" tone="amber"/>
      <StatCard label="Unread updates" value={unread} hint="Messages and operational notifications" tone="purple"/>
    </div>
    <div className="grid-2">
      <Card title="Upcoming visit" subtitle="Validated by Smart Scheduling" actions={<button className="text-link" onClick={()=>setPage('appointments')}>View appointments →</button>}>
        {next?<div className="appointment-focus"><div className="date-box"><b>{next.date.slice(-2)}</b><span>{dateLabel(next.date).split(' ')[0].toUpperCase()}</span></div><div><h3>{next.service}</h3><p>{displayTime(next.start)} • {next.branch}</p><p>{dentist}</p></div><Status>{next.status}</Status></div>:<Notice>No upcoming appointment is currently recorded.</Notice>}
      </Card>
      <Card title="Live patient flow" subtitle="Your own queue information only" actions={<button className="text-link" onClick={()=>setPage('queue')}>Open queue →</button>}>
        {q?<><div className="flow-strip"><div><small>Checked in</small><b>{displayTime(q.checkedIn)}</b></div><span>→</span><div><small>Position</small><b>#{q.position}</b></div><span>→</span><div><small>Est. wait</small><b>{wait} min</b></div></div><Notice tone="success">You will automatically receive an update when the clinic changes your queue status.</Notice></>:<Notice tone="info">Check in at the clinic before your live position and estimated waiting time appear.</Notice>}
      </Card>
    </div>
    <div className="grid-2 top-gap">
      <Card title="Recent updates"><div className="feed-list">{state.notifications.filter(n=>n.patientId===pid).slice(0,4).map(n=><div className="feed-item" key={n.id}><span className={`feed-dot ${n.read?'':'new'}`}/><div><b>{n.type}</b><p>{n.text}</p><small>{n.createdAt} • {n.channel}</small></div><Status>{n.status}</Status></div>)}</div></Card>
      <Card title="Care continuity" subtitle="Follow-up obligations created from treatment">{state.followups.filter(f=>f.patientId===pid).map(f=><div className="metric-row" key={f.id}><div><span>{f.reason}</span><small>Recommended {dateLabel(f.recommendedDate)} • {f.interval}</small></div><Status>{f.status}</Status></div>)}</Card>
    </div>
  </>
}

function StaffDashboard({ activeBranch, setPage, state }) {
  const branchFilter=x=>activeBranch==='All Branches'||x.branch===activeBranch
  const todays=state.appointments.filter(a=>a.date===TODAY&&a.status!=='Cancelled'&&branchFilter(a))
  const waiting=state.queue.filter(q=>q.status==='Waiting'&&branchFilter(q))
  const pendingHmo=state.hmo.filter(h=>['Pending','Missing Requirements','Returned'].includes(h.status)&&branchFilter(h))
  const openInquiries=state.inquiries.filter(i=>i.status==='Open')
  const overdueHmo=state.hmo.filter(h=>h.status==='Pending'&&h.pendingHours>=12&&branchFilter(h))
  return <>
    <PageHeader title="Front Desk Operations" text="Appointments, arrivals, live patient flow, HMO work, billing, and communication requiring action." modules={[6,7,8,9,10,11,12,13,14,16,17,18,20]}/>
    <div className="stats-grid">
      <StatCard label="Today's appointments" value={todays.length} hint={activeBranch}/>
      <StatCard label="Waiting patients" value={waiting.length} hint="Across active dentist queues" tone="blue"/>
      <StatCard label="HMO requiring action" value={pendingHmo.length} hint={`${overdueHmo.length} beyond follow-up threshold`} tone="amber"/>
      <StatCard label="Open social inquiries" value={openInquiries.length} hint="Pre-booking patient engagement" tone="purple"/>
    </div>
    <div className="grid-2">
      <Card title="Operational attention" actions={<button className="text-link" onClick={()=>setPage('capacity')}>View capacity →</button>}>
        <div className="alert-list">
          {overdueHmo.length>0&&<div className="alert warning"><b>{overdueHmo.length} HMO follow-up task{overdueHmo.length>1?'s':''} overdue</b><span>Timer-driven escalation is active.</span></div>}
          {waiting.length>0&&<div className="alert info"><b>{waiting.length} patient{waiting.length>1?'s':''} currently waiting</b><span>Review queue age and dentist availability.</span></div>}
          {openInquiries.length>0&&<div className="alert neutral"><b>{openInquiries.length} social inquiry awaiting response</b><span>Track response before it becomes an unhandled thread.</span></div>}
        </div>
      </Card>
      <Card title="Branch load snapshot">{state.branches.filter(b=>activeBranch==='All Branches'||b.name===activeBranch).map(b=>{const c=branchCapacity(b.name,state);return <div key={b.id} className="capacity-mini"><div><b>{b.name}</b><small>{c.activeDentists} active dentists • {c.waiting} waiting</small></div><div><Progress value={c.workload} threshold={c.threshold}/><span>{c.estimate} min estimated wait</span></div></div>})}</Card>
    </div>
    <Card title="Today's appointment board" className="top-gap" actions={<button className="text-link" onClick={()=>setPage('appointments')}>Manage appointments →</button>}>
      <div className="schedule-board">{todays.sort((a,b)=>a.start.localeCompare(b.start)).map(a=><div key={a.id} className="schedule-chip"><b>{displayTime(a.start)}</b><div><strong>{patientName(a.patientId,state.patients)}</strong><small>{a.service} • {a.branch} • {dentistName(a.dentistId,state.dentists)}</small></div><Status>{a.status}</Status></div>)}</div>
    </Card>
  </>
}

function DentistDashboard({ setPage, state }) {
  const did=ROLE_INFO.dentist.dentistId
  const today=state.appointments.filter(a=>a.date===TODAY&&a.dentistId===did&&a.status!=='Cancelled').sort((a,b)=>a.start.localeCompare(b.start))
  const ownQueue=state.queue.filter(q=>q.dentistId===did&&!['Completed','No-show'].includes(q.status)).sort((a,b)=>(a.position||99)-(b.position||99))
  const activeTreatment=state.treatments.find(t=>t.dentistId===did&&t.date===TODAY&&t.status==='In Treatment')
  const pendingRx=state.treatments.filter(t=>t.dentistId===did&&t.status==='Completed'&&t.prescriptionRequired&&!state.prescriptions.some(rx=>rx.treatmentId===t.id)).length
  const follow=state.followups.filter(f=>f.dentistId===did&&f.status==='Open').length
  return <>
    <PageHeader title="Clinical Dashboard" text="Your schedule, queue, patient records, treatment documentation, prescriptions, and follow-up obligations." modules={[4,5,9,17,19,20]}/>
    <div className="stats-grid">
      <StatCard label="Scheduled today" value={today.length} hint="Your confirmed and pending visits"/>
      <StatCard label="Waiting for you" value={ownQueue.filter(q=>q.status==='Waiting').length} hint="Live dentist queue" tone="blue"/>
      <StatCard label="Prescription tasks" value={pendingRx} hint="After completed treatment" tone="amber"/>
      <StatCard label="Open follow-ups" value={follow} hint="Return visits not yet booked" tone="purple"/>
    </div>
    <div className="grid-2">
      <Card title="Next patient" actions={<button className="text-link" onClick={()=>setPage('queue')}>Open my queue →</button>}>
        {ownQueue[0]?<div className="patient-focus"><div className="avatar large">{patientName(ownQueue[0].patientId,state.patients).split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div><h3>{patientName(ownQueue[0].patientId,state.patients)}</h3><p>Position #{ownQueue[0].position} • checked in {displayTime(ownQueue[0].checkedIn)}</p><p>{ownQueue[0].priority} priority</p></div><Status>{ownQueue[0].status}</Status></div>:<Notice>No patient is currently waiting in your queue.</Notice>}
      </Card>
      <Card title="Today's schedule" actions={<button className="text-link" onClick={()=>setPage('schedule')}>Full schedule →</button>}><div className="schedule-board">{today.map(a=><div className="schedule-chip" key={a.id}><b>{displayTime(a.start)}</b><div><strong>{patientName(a.patientId,state.patients)}</strong><small>{a.service} • {a.duration} min</small></div><Status>{a.status}</Status></div>)}</div></Card>
    </div>
    {activeTreatment&&<Card className="top-gap" title="Treatment in progress"><Notice tone="warning" title={patientName(activeTreatment.patientId,state.patients)}>{activeTreatment.procedure||activeTreatment.plan}</Notice></Card>}
  </>
}

function OwnerDashboard({ activeBranch, setPage, state }) {
  const branchData=state.branches.filter(b=>activeBranch==='All Branches'||b.name===activeBranch).map(b=>branchCapacity(b.name,state))
  const appointments=state.appointments.filter(a=>a.date===TODAY&&a.status!=='Cancelled'&&(activeBranch==='All Branches'||a.branch===activeBranch))
  const pendingHmo=state.hmo.filter(h=>h.status==='Pending'&&(activeBranch==='All Branches'||h.branch===activeBranch))
  const revenue=state.invoices.filter(i=>i.status==='Paid'&&(activeBranch==='All Branches'||i.branch===activeBranch)).reduce((s,i)=>s+i.total,0)
  const exceptions=[
    ...branchData.filter(c=>c.overloaded).map(c=>({tone:'warning',title:`${c.branch} capacity exception`,detail:`${c.workload}% workload • ${c.estimate} min estimated wait`})),
    ...pendingHmo.filter(h=>h.pendingHours>=12).map(h=>({tone:'warning',title:'HMO follow-up threshold reached',detail:`${patientName(h.patientId,state.patients)} • ${h.provider} • ${h.pendingHours}h pending`})),
  ]
  return <>
    <PageHeader title="Executive Dashboard" text="Cross-branch decision view built from operational KPIs, exceptions, workload, HMO, patient flow, and recorded revenue." modules={[15,21,22]} aside={<span className="context-chip">{activeBranch}</span>}/>
    <div className="stats-grid">
      <StatCard label="Appointments today" value={appointments.length} hint={activeBranch}/>
      <StatCard label="Live waiting patients" value={branchData.reduce((s,c)=>s+c.waiting,0)} hint="Across visible branches" tone="blue"/>
      <StatCard label="Pending HMO cases" value={pendingHmo.length} hint={`${pendingHmo.filter(h=>h.pendingHours>=12).length} beyond threshold`} tone="amber"/>
      <StatCard label="Recorded paid revenue" value={peso.format(revenue)} hint="Demo transactions only" tone="purple"/>
    </div>
    <div className="grid-2">
      <Card title="Branch comparison" subtitle="Live workload and patient flow"><div className="branch-bars">{branchData.map(c=><div key={c.branch}><div className="bar-label"><span>{c.branch}</span><b>{c.workload}% load</b></div><Progress value={c.workload} threshold={c.threshold}/><small>{c.activeDentists} active dentists • {c.waiting} waiting • {c.booked} booked today • ~{c.estimate} min wait</small></div>)}</div></Card>
      <Card title="Priority exceptions" subtitle="Management should see exceptions before raw details" actions={<button className="text-link" onClick={()=>setPage('analytics')}>Open analytics →</button>}>
        <div className="alert-list">{exceptions.length?exceptions.map((x,i)=><div className={`alert ${x.tone}`} key={i}><b>{x.title}</b><span>{x.detail}</span></div>):<div className="alert success"><b>No high-priority exceptions</b><span>Visible branches are within configured demo thresholds.</span></div>}</div>
      </Card>
    </div>
    <div className="cards-3 top-gap">
      <Card title="Scheduling"><MetricRow label="Conflict-free confirmed bookings" value={appointments.filter(a=>a.status==='Confirmed').length}/><MetricRow label="Pending confirmation" value={appointments.filter(a=>a.status==='Pending').length}/></Card>
      <Card title="HMO"><MetricRow label="Pending" value={pendingHmo.length}/><MetricRow label="Approved" value={state.hmo.filter(h=>h.status==='Approved').length}/></Card>
      <Card title="Communication"><MetricRow label="Open inquiries" value={state.inquiries.filter(i=>i.status==='Open').length}/><MetricRow label="Open conversations" value={state.conversations.filter(c=>c.status==='Open').length}/></Card>
    </div>
  </>
}
