import React, { useMemo, useState } from 'react'
import { ROLE_INFO, TODAY } from '../data.js'
import { Button, Card, Field, Notice, PageHeader, Progress, StatCard, Status, Table } from '../components.jsx'
import { branchCapacity, dateLabel, dentistName, displayTime, patientName, queueWaitEstimate, recalcQueue, uid } from '../logic.js'

export function CheckInPage({ store }) {
  const { state, setters, toast, log, workflow, notify }=store
  const [mode,setMode]=useState('scheduled')
  const eligible=state.appointments.filter(a=>a.date===TODAY&&a.status!=='Cancelled'&&!state.queue.some(q=>q.appointmentId===a.id&&!['Completed','No-show'].includes(q.status)))
  const [appointmentId,setAppointmentId]=useState(eligible[0]?.id||'')
  const [identity,setIdentity]=useState(false)
  const [walkIn,setWalkIn]=useState({patientId:state.patients[0]?.id||'',branch:'Branch A',dentistId:'d1',service:'Dental Consultation'})

  const createQueue=(patientId,branch,dentistId,appointmentId=null)=>{
    const now='10:08'
    const existingForDentist=state.queue.filter(q=>q.branch===branch&&q.dentistId===dentistId)
    const entry={
      id:uid('qe'),queueId:`DQ-${dentistId}-${TODAY}`,checkInId:uid('ci'),queueNumber:existingForDentist.length+1,
      appointmentId,patientId,branch,dentistId,checkedIn:now,status:'Waiting',currentState:'Waiting',
      priority:'Normal',position:99,calledAt:null,readyAt:null,completedAt:null,skipCount:0
    }
    setters.setQueue(xs=>recalcQueue([...xs,entry]))
    if (appointmentId) setters.setAppointments(xs=>xs.map(a=>a.id===appointmentId?{...a,status:'Checked In'}:a))
    notify(patientId,'Check-In Confirmation',`You are checked in at ${branch}. Your live queue position will update automatically.`)
    workflow('M8→M9','Patient checked in',`Queue entry ${entry.id} created`)
    log(ROLE_INFO.staff.name,`Checked in ${patientName(patientId,state.patients)}`,'M8')
    toast('Check-in completed and Smart Queue entry created.','success')
    setIdentity(false)
  }
  const checkScheduled=()=>{
    const a=state.appointments.find(x=>x.id===appointmentId)
    if (!a) return toast('Select a scheduled appointment.','warning')
    if (!identity) return toast('Verify patient identity before check-in.','warning')
    createQueue(a.patientId,a.branch,a.dentistId,a.id)
  }
  const checkWalkin=()=>{
    if (!identity) return toast('Verify patient identity before walk-in registration.','warning')
    createQueue(walkIn.patientId,walkIn.branch,walkIn.dentistId,null)
  }
  return <>
    <PageHeader title="Patient Check-In" text="Verify identity, confirm a scheduled appointment or register a walk-in, record arrival, assign the correct dentist, and create the queue entry." modules={[8,9]}/>
    <div className="tabs"><button className={mode==='scheduled'?'active':''} onClick={()=>setMode('scheduled')}>Scheduled patient</button><button className={mode==='walkin'?'active':''} onClick={()=>setMode('walkin')}>Walk-in patient</button></div>
    <div className="grid-2">
      <Card title={mode==='scheduled'?'Scheduled appointment check-in':'Walk-in registration'}>
        {mode==='scheduled'?<div className="form-grid one-col">
          <Field label="Appointment"><select value={appointmentId} onChange={e=>setAppointmentId(e.target.value)}><option value="">Select appointment</option>{eligible.map(a=><option value={a.id} key={a.id}>{displayTime(a.start)} • {patientName(a.patientId,state.patients)} • {a.service}</option>)}</select></Field>
          <label className="check-control"><input type="checkbox" checked={identity} onChange={e=>setIdentity(e.target.checked)}/><span><b>Patient identity verified</b><small>Confirm name and one clinic-approved identifier before admitting the patient to the queue.</small></span></label>
          <Button onClick={checkScheduled}>Record arrival & create queue entry</Button>
        </div>:<div className="form-grid">
          <Field label="Patient"><select value={walkIn.patientId} onChange={e=>setWalkIn({...walkIn,patientId:e.target.value})}>{state.patients.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Branch"><select value={walkIn.branch} onChange={e=>setWalkIn({...walkIn,branch:e.target.value})}>{state.branches.filter(b=>b.status==='Open').map(b=><option key={b.id}>{b.name}</option>)}</select></Field>
          <Field label="Dentist"><select value={walkIn.dentistId} onChange={e=>setWalkIn({...walkIn,dentistId:e.target.value})}>{state.dentists.filter(d=>d.available&&d.branches.includes(walkIn.branch)).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <Field label="Requested service"><input value={walkIn.service} onChange={e=>setWalkIn({...walkIn,service:e.target.value})}/></Field>
          <label className="check-control span-2"><input type="checkbox" checked={identity} onChange={e=>setIdentity(e.target.checked)}/><span><b>Patient identity verified</b><small>Walk-in details will be stored with the arrival timestamp.</small></span></label>
          <Button className="span-2" onClick={checkWalkin}>Register walk-in & create queue entry</Button>
        </div>}
      </Card>
      <Card title="Admission checklist" subtitle="Module 8 ends when the patient is correctly admitted to Module 9"><div className="check-list static"><div className="check-row ok"><span>✓</span><div><b>Identify patient</b><small>Use existing centralized patient record.</small></div></div><div className="check-row ok"><span>✓</span><div><b>Appointment or walk-in status</b><small>Scheduled appointment is verified; walk-ins are explicitly registered.</small></div></div><div className="check-row ok"><span>✓</span><div><b>Arrival timestamp</b><small>Recorded at check-in.</small></div></div><div className="check-row ok"><span>✓</span><div><b>Branch and dentist</b><small>Confirmed before queue creation.</small></div></div><div className="check-row ok"><span>✓</span><div><b>Queue handoff</b><small>Smart Queue receives a new queue entry automatically.</small></div></div></div></Card>
    </div>
  </>
}

export function QueuePage({ role, activeBranch, store }) {
  const { state, setters, toast, log, workflow, notify }=store
  const [dentistFilter,setDentistFilter]=useState('All Dentists')
  const [statusFilter,setStatusFilter]=useState('Active')
  const pid=ROLE_INFO.patient.patientId
  const did=ROLE_INFO.dentist.dentistId
  const active=q=>!['Completed','No-show'].includes(q.status)
  const visible=state.queue.filter(q=>{
    if (role==='patient'&&q.patientId!==pid) return false
    if (role==='dentist'&&q.dentistId!==did) return false
    if (role==='staff'&&activeBranch!=='All Branches'&&q.branch!==activeBranch) return false
    if (dentistFilter!=='All Dentists'&&q.dentistId!==dentistFilter) return false
    if (statusFilter==='Active'&&!active(q)) return false
    if (statusFilter!=='Active'&&statusFilter!=='All'&&q.status!==statusFilter) return false
    return true
  }).sort((a,b)=>a.branch.localeCompare(b.branch)||dentistName(a.dentistId,state.dentists).localeCompare(dentistName(b.dentistId,state.dentists))||(a.position||99)-(b.position||99))

  const update=(id,status,extra={})=>{
    const target=state.queue.find(q=>q.id===id); if(!target)return
    const now='10:08'
    const patch=status==='Called'?{calledAt:now}:status==='Treatment Ready'?{readyAt:now}:status==='Completed'?{completedAt:now}:{}
    setters.setQueue(xs=>recalcQueue(xs.map(q=>q.id===id?{...q,status,currentState:status,...patch,...extra}:q)))
    notify(target.patientId,'Queue Update',`Your queue status is now ${status}.`)
    workflow('M9',`Queue status changed to ${status}`,`${patientName(target.patientId,state.patients)} • ${target.branch}`)
    log(role==='dentist'?ROLE_INFO.dentist.name:ROLE_INFO.staff.name,`Changed queue status to ${status}`,'M9')
    toast(`Queue status updated to ${status}.`,'success')
  }
  const skip=id=>{const q=state.queue.find(x=>x.id===id); update(id,'Waiting',{skipCount:(q?.skipCount||0)+1,checkedIn:'10:08'})}
  if (role==='patient') {
    const current=visible.find(active)||visible[0]
    const wait=current?queueWaitEstimate(current,state.queue,state.appointments,state.treatments,state.dentists):0
    return <>
      <PageHeader title="Queue & Waiting Time" text="Private patient view showing only your queue status and aggregate waiting-time estimate." modules={[9,10]}/>
      {current?<><div className="stats-grid small"><StatCard label="Status" value={current.status}/><StatCard label="Position" value={active(current)?`#${current.position}`:'—'} tone="blue"/><StatCard label="Estimated wait" value={active(current)?`${wait} min`:'0 min'} tone="amber"/><StatCard label="Dentist" value={dentistName(current.dentistId,state.dentists).replace('Dr. ','')} tone="purple"/></div><Card title="Live queue status"><div className="patient-queue-card"><div className="queue-position">{active(current)?current.position:'✓'}</div><div><h2>{current.status}</h2><p>{current.branch} • {dentistName(current.dentistId,state.dentists)}</p><small>Checked in {displayTime(current.checkedIn)} • Last shown update uses prototype data</small></div></div><Notice tone="info">For privacy, patients never see other patient names or the full staff queue. The estimated wait is derived from your position, dentist schedule, and current demo queue.</Notice></Card></>:<Notice>No active queue entry is recorded for your patient account.</Notice>}
    </>
  }
  return <>
    <PageHeader title={role==='dentist'?'My Patient Queue':'Smart Patient Queue'} text="Operational queue controls with priority, check-in age, patient state transitions, and automatic position recalculation." modules={[9,10]}/>
    <Card title="Queue filters" className="filter-card"><div className="filter-row"><label>Branch <select value={activeBranch} disabled={role==='dentist'}><option>{activeBranch}</option></select></label><label>Dentist <select value={dentistFilter} onChange={e=>setDentistFilter(e.target.value)}><option>All Dentists</option>{state.dentists.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>Status <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option>Active</option><option>All</option><option>Waiting</option><option>Called</option><option>Treatment Ready</option><option>Completed</option><option>No-show</option></select></label></div></Card>
    <Card title="Live queue" subtitle="Priority and checked-in order determine positions inside each dentist queue." className="top-gap">
      <Table rows={visible} columns={[
        {key:'position',label:'Pos.',render:q=>active(q)?`#${q.position}`:'—'},
        {key:'queueNumber',label:'Queue no.',render:q=>q.queueNumber||q.position||'—'},
        {key:'patient',label:'Patient',render:q=><div><b>{patientName(q.patientId,state.patients)}</b><small className="block-muted">{q.priority} priority • {q.checkInId||'check-in linked'}</small></div>},
        {key:'branch',label:'Branch'},{key:'dentist',label:'Dentist',render:q=>dentistName(q.dentistId,state.dentists)},
        {key:'checkedIn',label:'Checked in',render:q=>displayTime(q.checkedIn)},
        {key:'wait',label:'Est. wait',render:q=>`${queueWaitEstimate(q,state.queue,state.appointments,state.treatments,state.dentists)} min`},
        {key:'status',label:'Status',render:q=><Status>{q.status}</Status>},
        {key:'actions',label:'Actions',render:q=><div className="row-actions">{q.status==='Waiting'&&<><Button size="sm" variant="ghost" onClick={()=>update(q.id,'Called')}>Call</Button><Button size="sm" variant="ghost" onClick={()=>skip(q.id)}>Skip</Button><Button size="sm" variant="danger" onClick={()=>update(q.id,'No-show')}>No-show</Button></>}{q.status==='Called'&&<Button size="sm" onClick={()=>update(q.id,'Treatment Ready')}>Ready</Button>}{q.status==='Treatment Ready'&&<Button size="sm" onClick={()=>update(q.id,'Completed')}>Complete queue step</Button>}</div>}
      ]}/>
    </Card>
  </>
}

export function CapacityPage({ activeBranch, store }) {
  const { state }=store
  const branches=state.branches.filter(b=>activeBranch==='All Branches'||b.name===activeBranch)
  const cards=branches.map(b=>branchCapacity(b.name,state))
  const alternatives=cards.filter(c=>!c.overloaded).sort((a,b)=>a.workload-b.workload)
  return <>
    <PageHeader title="Waiting-Time & Cross-Branch Capacity" text="Aggregate flow monitoring remains separate from individual queue ordering. It combines live queue load, active dentist capacity, bookings, and configurable branch thresholds." modules={[10,15]}/>
    <div className="cards-3">{cards.map(c=><Card key={c.branch} title={c.branch} subtitle={`Threshold ${c.threshold}%`}><div className="capacity-number">{c.workload}% <span>workload</span></div><Progress value={c.workload} threshold={c.threshold}/><div className="metric-list"><Metric label="Active dentists" value={c.activeDentists}/><Metric label="Waiting" value={c.waiting}/><Metric label="Treatment-ready" value={c.ready}/><Metric label="Booked today" value={c.booked}/><Metric label="Estimated wait" value={`${c.estimate} min`}/></div>{c.overloaded?<Notice tone="warning" title="Capacity risk detected">Front desk and owner should be alerted and shown available capacity at another branch.</Notice>:<Notice tone="success">Branch is currently below its configured demo threshold.</Notice>}</Card>)}</div>
    <Card className="top-gap" title="Cross-branch alternatives" subtitle="Shown when a branch exceeds waiting-time or staffing thresholds">{alternatives.length?<div className="alternative-grid">{alternatives.map(c=><div className="alternative-card" key={c.branch}><b>{c.branch}</b><span>{c.workload}% load</span><small>{c.activeDentists} dentists • ~{c.estimate} min wait</small></div>)}</div>:<Notice tone="warning">No branch is currently below its capacity threshold.</Notice>}</Card>
  </>
}
function Metric({label,value}){return <div><span>{label}</span><b>{value}</b></div>}
