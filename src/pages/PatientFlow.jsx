import React, { useState, useRef } from 'react'
import { Button, Card, Field, Icon, Notice, PageHeader, Progress, Status, Table } from '../components.jsx'
import { branchCapacity, dentistName, displayTime, patientName, queueWaitEstimate, uid } from '../logic.js'

import { clinicDate } from '../clock.js'
import { PatientQueuePage } from './PatientVisits.jsx'
import { encounterContext, inScope, isActiveQueue, isTodayQueue, patientInScope, sessionForRole } from '../contracts.js'

export function CheckInPage({ store }) {
  const { state, actions, toast }=store
  const session=store.session||sessionForRole('staff',state)
  const [mode,setMode]=useState('scheduled')
  const eligible=state.appointments.filter(a=>inScope(a,session,state)&&a.date===clinicDate()&&['Confirmed','Pending'].includes(a.status)&&!state.checkIns.some(c=>c.appointmentId===a.id)&&!state.queue.some(q=>q.appointmentId===a.id))
  const [appointmentId,setAppointmentId]=useState('')
  const [walkIn,setWalkIn]=useState({patientId:'',branchId:session.branchId||'',dentistId:'',serviceId:''})
  const walkCommand=useRef(uid('walkin'))
  const [admitted,setAdmitted]=useState(false)
  const walkServices=state.services.filter(s=>s.status==='Active'&&state.branchServices.some(bs=>bs.branchId===walkIn.branchId&&bs.serviceId===s.id&&bs.active!==false))
  const walkDentists=state.dentists.filter(d=>d.available&&d.branchIds.includes(walkIn.branchId)&&state.dentistServiceAssignments.some(a=>a.dentistId===d.id&&a.serviceId===walkIn.serviceId&&a.isAuthorized!==false))
  const updateWalkin=(key,value)=>{
    setAdmitted(false);walkCommand.current=uid('walkin')
    setWalkIn(previous=>({...previous,[key]:value,...(key==='branchId'?{serviceId:'',dentistId:''}:key==='serviceId'?{dentistId:''}:{})}))
  }
  const selectedAppointment=eligible.find(a=>a.id===appointmentId)
  const checkScheduled=()=>{
    if(!selectedAppointment)return
    const result=actions.checkInAppointment(selectedAppointment.id)
    if(!result.ok)return toast(result.message,'warning')
    setAppointmentId('');toast(result.unchanged?'Arrival already recorded.':'Arrival recorded and queue entry created.','success')
  }
  const checkWalkin=()=>{
    const result=actions.admitWalkIn(walkIn,walkCommand.current)
    if(!result.ok)return toast(result.message,'warning')
    setAdmitted(true);toast(result.unchanged?'Arrival already recorded.':'Walk-in admitted to the queue.','success')
  }
  return <>
    <PageHeader kicker="Front desk" title="Patient check-in" text="Confirm arrival and move the patient into the live queue. No repeated registration is needed for an existing patient."/>
    <div className="checkin-shell">
      <div className="checkin-mode"><button className={mode==='scheduled'?'active':''} onClick={()=>setMode('scheduled')}><Icon name="calendar" size={18}/>Scheduled</button><button className={mode==='walkin'?'active':''} onClick={()=>setMode('walkin')}><Icon name="user" size={18}/>Walk-in</button></div>
      {mode==='scheduled'?<Card className="checkin-focus-card" title="Scheduled arrivals" subtitle="Select the patient who has arrived.">
        <div className="checkin-select-row"><Field label="Today’s appointment"><select value={selectedAppointment?.id||''} onChange={e=>setAppointmentId(e.target.value)}><option value="">Select appointment</option>{eligible.map(a=><option value={a.id} key={a.id}>{displayTime(a.start)} • {patientName(a.patientId,state.patients)} • {a.service}</option>)}</select></Field></div>
        {selectedAppointment?<div className="arrival-card"><div className="avatar large">{patientName(selectedAppointment.patientId,state.patients).split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div className="arrival-main"><span>Arriving patient</span><h2>{patientName(selectedAppointment.patientId,state.patients)}</h2><p>{selectedAppointment.service} • {dentistName(selectedAppointment.dentistId,state.dentists)}</p><div className="arrival-meta"><span><Icon name="calendar" size={15}/>{displayTime(selectedAppointment.start)}</span><span><Icon name="building" size={15}/>{selectedAppointment.branch}</span></div></div><div className="arrival-action"><Status>{selectedAppointment.status}</Status><Button onClick={checkScheduled} icon="checkin">Confirm arrival</Button></div></div>:<Notice>Select an appointment to check the patient in.</Notice>}
        <div className="checkin-note"><Icon name="shield" size={17}/><div><b>Fast admission</b><span>The existing patient profile and appointment already identify the patient. Staff only confirms the arriving patient and records the arrival event.</span></div></div>
      </Card>:<Card title="Walk-in admission" subtitle="Use an existing patient record, then assign the branch and available dentist."><div className="form-grid">
        <Field label="Patient"><select value={walkIn.patientId} onChange={e=>updateWalkin('patientId',e.target.value)}><option value="">Select patient</option>{state.patients.filter(p=>patientInScope(p,state,session)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Branch"><select value={walkIn.branchId} onChange={e=>updateWalkin('branchId',e.target.value)}>{state.branches.filter(b=>b.status==='Open'&&(session.role==='owner'||b.id===session.branchId)).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        <Field label="Dentist"><select value={walkIn.dentistId} onChange={e=>updateWalkin('dentistId',e.target.value)}><option value="">Select dentist</option>{walkDentists.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        <Field label="Requested service"><select value={walkIn.serviceId} onChange={e=>updateWalkin('serviceId',e.target.value)}><option value="">Select service</option>{walkServices.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <div className="span-2 walkin-action"><Notice tone="info">For a new patient, create the patient record first. Existing demographics are not re-entered during check-in.</Notice><Button disabled={admitted} onClick={checkWalkin} icon="checkin">Admit walk-in to queue</Button></div>
      </div></Card>}
    </div>
  </>
}

export function QueuePage({ role, activeBranch, store, setPage }) {
  const { state, actions, toast }=store
  const session=store.session||sessionForRole(role,state)
  const [dentistFilter,setDentistFilter]=useState('All Dentists')
  const [statusFilter,setStatusFilter]=useState('Active')
  const active=isActiveQueue
  const visible=state.queue.filter(q=>{
    if(!inScope(q,session,state)||!isTodayQueue(q))return false
    if(role==='owner'&&activeBranch!=='All Branches'&&q.branch!==activeBranch)return false
    if(role==='staff'&&dentistFilter!=='All Dentists'&&q.dentistId!==dentistFilter)return false
    if(statusFilter==='Active'&&!active(q))return false
    return ['Active','All'].includes(statusFilter)||q.status===statusFilter
  }).sort((a,b)=>String(a.branch||'').localeCompare(String(b.branch||''))||String(dentistName(a.dentistId,state.dentists)||'').localeCompare(String(dentistName(b.dentistId,state.dentists)||''))||(a.position||999)-(b.position||999))
  const update=(id,status,extra={})=>{
    const result=actions.updateQueue(id,status,extra)
    toast(result.ok?'Queue updated.':result.message,result.ok?'success':'warning')
  }
  const priority=q=>{
    const reason=window.prompt('Reason for emergency priority:')
    if(reason?.trim())update(q.id,q.status,{priority:'Urgent',reason})
  }
  if (role==='patient') return <PatientQueuePage store={store} setPage={setPage}/>
  return <>
    <PageHeader title={role==='dentist'?'My Patient Queue':'Smart Patient Queue'} text="Operational queue controls with priority, check-in age, patient state transitions, and automatic position recalculation." modules={[9,10]}/>
    <Card title={role==='dentist'?'My queue filters':'Queue filters'} className="filter-card"><div className="filter-row"><label>Branch <select value={activeBranch} disabled><option>{activeBranch}</option></select></label>{role!=='dentist'&&<label>Dentist <select value={dentistFilter} onChange={e=>setDentistFilter(e.target.value)}><option>All Dentists</option>{state.dentists.filter(d=>role==='owner'||d.branchIds.includes(session.branchId)).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}<label>Status <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option>Active</option><option>All</option><option>Waiting</option><option>Called</option><option>Treatment Ready</option><option>In Treatment</option><option>Temporarily Away</option><option>Completed</option><option>No-show</option></select></label></div></Card>
    <Card title="Live queue" subtitle="Priority and checked-in order determine positions inside each dentist queue." className="top-gap">
      <Table rows={visible} columns={[
        {key:'position',label:'Pos.',render:q=>q.position?`#${q.position}`:'—'},
        {key:'queueNumber',label:'Queue no.',render:q=>q.queueNumber||q.position||'—'},
        {key:'patient',label:'Patient',render:q=><div><b>{patientName(q.patientId,state.patients)}</b><small className="block-muted">{q.priority} priority • {q.checkInId||'check-in linked'}</small></div>},
        {key:'branch',label:'Branch'},{key:'dentist',label:'Dentist',render:q=>dentistName(q.dentistId,state.dentists)},
        {key:'checkedIn',label:'Checked in',render:q=>displayTime(q.checkedIn)},
        {key:'wait',label:'Est. wait',render:q=>`${queueWaitEstimate(q,state.queue,state.appointments,state.treatments,state.dentists)} min`},
        {key:'status',label:'Status',render:q=><Status>{q.status}</Status>},
        {key:'actions',label:'Actions',render:q=><div className="row-actions">
          {q.status==='Waiting'&&<Button size="sm" variant="soft" onClick={()=>update(q.id,'Called')}>Call patient</Button>}
          {role==='dentist'&&['Called','Treatment Ready','In Treatment'].includes(q.status)&&<Button size="sm" onClick={()=>setPage('treatment',encounterContext(q))}>{q.treatmentId?'Continue Treatment':'Open Treatment'}</Button>}
          <Button size="sm" variant="ghost" onClick={()=>setPage('patients',encounterContext(q))}>Open Chart</Button>
          {role==='staff'&&<>
            {['Waiting','Called','Treatment Ready'].includes(q.status)&&<Button size="sm" variant="ghost" onClick={()=>update(q.id,'Temporarily Away')}>Temporarily Away</Button>}
            {q.status==='Temporarily Away'&&<Button size="sm" variant="soft" onClick={()=>update(q.id,'Waiting')}>Return to Queue</Button>}
            {['Waiting','Called','Treatment Ready','Temporarily Away'].includes(q.status)&&!q.treatmentId&&<Button size="sm" variant="danger" onClick={()=>update(q.id,'No-show')}>No-show</Button>}
            {active(q)&&q.status!=='In Treatment'&&<Button size="sm" variant="ghost" onClick={()=>priority(q)}>Emergency priority</Button>}
          </>}
        </div>}

      ]}/>
    </Card>
  </>
}

export function CapacityPage({ activeBranch, store }) {
  const { state }=store
  const branches=state.branches.filter(b=>activeBranch==='All Branches'||b.name===activeBranch)
  const cards=branches.map(b=>branchCapacity(b.name,state))
  const alternatives=state.branches.filter(b=>b.status==='Open'&&(activeBranch==='All Branches'||b.name!==activeBranch)).map(b=>branchCapacity(b.name,state)).filter(c=>c.activeDentists>0&&!c.overloaded).sort((a,b)=>a.workload-b.workload)
  return <>
    <PageHeader title="Waiting-Time & Cross-Branch Capacity" text="Aggregate flow monitoring remains separate from individual queue ordering. It combines live queue load, active dentist capacity, bookings, and configurable branch thresholds." modules={[10,15]}/>
    <div className="cards-3">{cards.map(c=><Card key={c.branch} title={c.branch} subtitle={`Threshold ${c.threshold}%`}><div className="capacity-number">{c.workload}% <span>workload</span></div><Progress value={c.workload} threshold={c.threshold}/><div className="metric-list"><Metric label="Active dentists" value={c.activeDentists}/><Metric label="Waiting" value={c.waiting}/><Metric label="Treatment-ready" value={c.ready}/><Metric label="Booked today" value={c.booked}/><Metric label="Estimated wait" value={`${c.estimate} min`}/></div>{c.overloaded?<Notice tone="warning" title="Capacity risk detected">Front desk and owner should be alerted and shown available capacity at another branch.</Notice>:<Notice tone="success">Branch is currently below its configured demo threshold.</Notice>}</Card>)}</div>
    <Card className="top-gap" title="Cross-branch alternatives" subtitle="Shown when a branch exceeds waiting-time or staffing thresholds">{alternatives.length?<div className="alternative-grid">{alternatives.map(c=><div className="alternative-card" key={c.branch}><b>{c.branch}</b><span>{c.workload}% load</span><small>{c.activeDentists} dentists • ~{c.estimate} min wait</small></div>)}</div>:<Notice tone="warning">No branch is currently below its capacity threshold.</Notice>}</Card>
  </>
}
function Metric({label,value}){return <div><span>{label}</span><b>{value}</b></div>}
