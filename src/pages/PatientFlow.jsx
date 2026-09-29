import React, { useEffect, useState, useRef } from 'react'
import { Button, Card, Field, Icon, Notice, PageHeader, Progress, Status, Table } from '../components.jsx'
import { branchCapacity, dentistName, displayTime, patientName, queueWaitEstimate } from '../logic.js'
import { commandKey } from '../appointments-api.js'
import { patientKeyResolver } from '../appointment-projection.js'
import { DEFAULT_COUNTRY, normalizePhoneNumber } from '../phone.js'
import { bookableBranches } from './Scheduling.jsx'

import { clinicDate } from '../clock.js'
import { PatientQueuePage } from './PatientVisits.jsx'
import { encounterContext, inScope, isActiveQueue, isTodayQueue, sessionForRole } from '../contracts.js'

// M8 front desk. Arrival is server-authoritative: a scheduled Check-In or a Walk-In opens a server Visit (the scheduled
// appointment moves to Checked In in the same server transaction), then the still-browser-local M9 queue entry is
// created from that Visit. Patients come from the server directory (or the minimal front-desk registration); nothing
// here writes an arrival record locally.
export function CheckInPage({ store }) {
  const { state, toast }=store
  const session=store.session||sessionForRole('staff',state)
  const flow=store.appointmentFlow
  const [mode,setMode]=useState('scheduled')
  const today=clinicDate()
  // Today's server appointments awaiting arrival (no Visit yet).
  const eligible=state.appointments.filter(a=>inScope(a,session,state)&&a.date===today&&['Confirmed','Pending'].includes(a.status)&&!(state.visits||[]).some(v=>v.appointmentId===a.id))
  // Server Visits whose local queue step has not happened in this browser (the local step failed after the server
  // succeeded, or the arrival was recorded in another browser): Staff can complete the queue handoff.
  const pendingQueue=(state.visits||[]).filter(v=>v.status==='Checked In'&&v.clinicDate===today&&inScope(v,session,state)&&!state.queue.some(q=>q.visitId===v.id))
  const [appointmentId,setAppointmentId]=useState('')
  const selectedAppointment=eligible.find(a=>a.id===appointmentId)
  // One Idempotency-Key per confirm attempt, reused when retrying the same arrival.
  const checkInKey=useRef({appointmentId:null,key:null})
  const [busy,setBusy]=useState(false)
  const checkScheduled=async()=>{
    if(!selectedAppointment||busy)return
    if(checkInKey.current.appointmentId!==selectedAppointment.id)checkInKey.current={appointmentId:selectedAppointment.id,key:commandKey()}
    setBusy(true)
    const result=await flow.checkIn(selectedAppointment.id,checkInKey.current.key)
    setBusy(false)
    if(!result.ok)return toast(result.message,'warning')
    checkInKey.current={appointmentId:null,key:null}
    setAppointmentId('');toast(result.unchanged?'Arrival already recorded.':'Arrival recorded and queue entry created.','success')
  }
  const retryQueue=visit=>{
    const result=flow.retryAdmit(visit.id)
    toast(result.ok?'Queue entry created for this visit.':result.message,result.ok?'success':'warning')
  }

  const branches=bookableBranches(state,session)
  const [walkIn,setWalkIn]=useState({patientPublicId:'',branchId:branches[0]?.id||'',dentistId:'',serviceId:''})
  const walkKey=useRef(commandKey())
  const [admitted,setAdmitted]=useState(false)
  const [search,setSearch]=useState('')
  useEffect(()=>{if(search.trim().length>=2){const t=setTimeout(()=>flow?.searchPatients(search),250);return ()=>clearTimeout(t)}},[search])
  const directory=(store.directoryPatients||[]).filter(p=>!search.trim()||`${p.name} ${p.patientCode} ${p.phone}`.toLowerCase().includes(search.trim().toLowerCase()))
  const walkServices=state.services.filter(s=>s.status==='Active'&&state.branchServices.some(bs=>bs.branchId===walkIn.branchId&&bs.serviceId===s.id&&bs.active!==false))
  const walkDentists=state.dentists.filter(d=>d.available&&d.branchIds.includes(walkIn.branchId)&&state.dentistServiceAssignments.some(a=>a.dentistId===d.id&&a.serviceId===walkIn.serviceId&&a.isAuthorized!==false))
  const updateWalkin=(key,value)=>{
    setAdmitted(false);walkKey.current=commandKey()
    setWalkIn(previous=>({...previous,[key]:value,...(key==='branchId'?{serviceId:'',dentistId:''}:key==='serviceId'?{dentistId:''}:{})}))
  }
  const [walking,setWalking]=useState(false)
  // The Dentist is required here only because the browser-local M9 queue is organized per Dentist; the server Visit
  // itself allows an unresolved Dentist.
  const canWalkIn=!!walkIn.patientPublicId&&!!walkIn.branchId&&!!walkIn.serviceId&&!!walkIn.dentistId&&!walking&&!admitted
  const checkWalkin=async()=>{
    if(!canWalkIn)return
    setWalking(true)
    const patientId=patientKeyResolver({session,users:state.users,patients:state.patients})(walkIn.patientPublicId)
    const result=await flow.walkIn({...walkIn,patientId},walkKey.current)
    setWalking(false)
    if(!result.ok)return toast(result.message,'warning')
    setAdmitted(true);toast(result.unchanged?'Arrival already recorded.':'Walk-in admitted to the queue.','success')
  }

  // Minimal front-desk registration of a new walk-in Patient (Person + Patient on the server, no login account).
  const emptyPatient={firstName:'',lastName:'',phone:'',email:'',dob:''}
  const [registering,setRegistering]=useState(false)
  const [newPatient,setNewPatient]=useState(emptyPatient)
  const registerKey=useRef(commandKey())
  const [registerError,setRegisterError]=useState('')
  const updateNewPatient=(key,value)=>{registerKey.current=commandKey();setRegisterError('');setNewPatient(previous=>({...previous,[key]:value}))}
  const register=async()=>{
    const phone=newPatient.phone.trim()?normalizePhoneNumber(DEFAULT_COUNTRY.dial,newPatient.phone):{ok:true,e164:''}
    if(!newPatient.firstName.trim()||!newPatient.lastName.trim())return setRegisterError('Enter the patient’s first and last name.')
    if(!phone.ok)return setRegisterError(phone.reason)
    const result=await flow.registerPatient({...newPatient,firstName:newPatient.firstName.trim(),lastName:newPatient.lastName.trim(),phone:phone.e164,email:newPatient.email.trim()},registerKey.current)
    if(!result.ok)return setRegisterError(result.message)
    updateWalkin('patientPublicId',result.patient.id)
    setNewPatient(emptyPatient);setRegistering(false);registerKey.current=commandKey()
    toast(`Patient ${result.patient.name} registered (${result.patient.patientCode}).`,'success')
  }
  const selectedPatient=(store.directoryPatients||[]).find(p=>p.id===walkIn.patientPublicId)

  return <>
    <PageHeader kicker="Front desk" title="Patient check-in" text="Confirm arrival and move the patient into the live queue. Arrivals are recorded by the clinic server; no repeated registration is needed for an existing patient."/>
    <AppointmentsLoadNotice store={store}/>
    <div className="checkin-shell">
      <div className="checkin-mode"><button className={mode==='scheduled'?'active':''} onClick={()=>setMode('scheduled')}><Icon name="calendar" size={18}/>Scheduled</button><button className={mode==='walkin'?'active':''} onClick={()=>setMode('walkin')}><Icon name="user" size={18}/>Walk-in</button></div>
      {mode==='scheduled'?<Card className="checkin-focus-card" title="Scheduled arrivals" subtitle="Select the patient who has arrived." actions={<Button size="sm" variant="ghost" onClick={()=>flow?.refresh()}>Refresh</Button>}>
        <div className="checkin-select-row"><Field label="Today’s appointment"><select value={selectedAppointment?.id||''} onChange={e=>setAppointmentId(e.target.value)}><option value="">Select appointment</option>{eligible.map(a=><option value={a.id} key={a.id}>{displayTime(a.start)} • {patientName(a.patientId,state.patients)} • {a.service}</option>)}</select></Field></div>
        {selectedAppointment?<div className="arrival-card"><div className="avatar large">{patientName(selectedAppointment.patientId,state.patients).split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div className="arrival-main"><span>Arriving patient</span><h2>{patientName(selectedAppointment.patientId,state.patients)}</h2><p>{selectedAppointment.service} • {selectedAppointment.dentistName||dentistName(selectedAppointment.dentistId,state.dentists)}</p><div className="arrival-meta"><span><Icon name="calendar" size={15}/>{displayTime(selectedAppointment.start)}</span><span><Icon name="building" size={15}/>{selectedAppointment.branch}</span><span>{selectedAppointment.appointmentNo}</span></div></div><div className="arrival-action"><Status>{selectedAppointment.status}</Status><Button onClick={checkScheduled} disabled={busy} icon="checkin">{busy?'Recording…':'Confirm arrival'}</Button></div></div>:<Notice>Select an appointment to check the patient in.</Notice>}
        <div className="checkin-note"><Icon name="shield" size={17}/><div><b>Fast admission</b><span>The existing patient profile and appointment already identify the patient. The clinic server records the arrival and opens the visit; a patient who did not arrive is marked No-show from Appointments.</span></div></div>
        {pendingQueue.length>0&&<div className="top-gap"><Notice tone="warning" title="Arrivals waiting for the queue step">These visits are checked in at the clinic server but have no queue entry in this browser yet.</Notice>
          {pendingQueue.map(v=><div className="clinical-history" key={v.id}><div><b>{v.patientName||patientName(v.patientId,state.patients)}</b><p>{v.walkIn?'Walk-in':v.appointmentCode} • arrived {displayTime(v.checkedIn)} • {v.dentistName||'No Dentist assigned'}</p></div><Button size="sm" variant="soft" onClick={()=>retryQueue(v)}>Add to queue</Button></div>)}
        </div>}
      </Card>:<Card title="Walk-in admission" subtitle="Find the patient in the clinic directory (or register a new patient), then choose the branch, service and available Dentist."><div className="form-grid">
        <Field label="Find patient" hint="Search the clinic Patient directory by name, code or phone."><input value={search} placeholder="Type at least 2 characters" onChange={e=>setSearch(e.target.value)}/></Field>
        <Field label="Patient" required><select value={walkIn.patientPublicId} onChange={e=>updateWalkin('patientPublicId',e.target.value)}><option value="">Select patient</option>{selectedPatient&&!directory.some(p=>p.id===selectedPatient.id)&&<option value={selectedPatient.id}>{selectedPatient.name} • {selectedPatient.patientCode}</option>}{directory.map(p=><option key={p.id} value={p.id}>{p.name} • {p.patientCode}{p.phone?` • ${p.phone}`:''}</option>)}</select></Field>
        <div className="span-2">{registering?<div className="form-grid">
          <Field label="First name" required><input value={newPatient.firstName} onChange={e=>updateNewPatient('firstName',e.target.value)}/></Field>
          <Field label="Last name" required><input value={newPatient.lastName} onChange={e=>updateNewPatient('lastName',e.target.value)}/></Field>
          <Field label="Mobile number" hint="Optional. 10 digits after +63."><input inputMode="tel" value={newPatient.phone} placeholder="9171234567" onChange={e=>updateNewPatient('phone',e.target.value)}/></Field>
          <Field label="Email" hint="Optional. If this email is already on file, select that patient instead."><input type="email" value={newPatient.email} onChange={e=>updateNewPatient('email',e.target.value)}/></Field>
          <Field label="Date of birth" hint="Optional."><input type="date" max={today} value={newPatient.dob} onChange={e=>updateNewPatient('dob',e.target.value)}/></Field>
          <div className="span-2">{registerError&&<Notice tone="warning">{registerError}</Notice>}<div className="row-actions"><Button size="sm" onClick={register}>Register patient</Button><Button size="sm" variant="ghost" onClick={()=>{setRegistering(false);setRegisterError('')}}>Cancel</Button></div><small className="block-muted">Creates a clinic patient record only — no login account. Existing records are never merged automatically.</small></div>
        </div>:<Button size="sm" variant="ghost" onClick={()=>setRegistering(true)}>New patient? Register a walk-in patient</Button>}</div>
        <Field label="Branch"><select value={walkIn.branchId} onChange={e=>updateWalkin('branchId',e.target.value)}>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        <Field label="Requested service" required><select value={walkIn.serviceId} onChange={e=>updateWalkin('serviceId',e.target.value)}><option value="">Select service</option>{walkServices.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Dentist" required hint="The live queue is organized by Dentist, so choose one now."><select value={walkIn.dentistId} onChange={e=>updateWalkin('dentistId',e.target.value)}><option value="">Select dentist</option>{walkDentists.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        <div className="span-2 walkin-action"><Notice tone="info">The clinic server checks branch hours, the service and the Dentist’s shift. A walk-in does not reserve Dentist appointment time.</Notice><Button disabled={!canWalkIn} onClick={checkWalkin} icon="checkin">{walking?'Admitting…':'Admit walk-in to queue'}</Button></div>
      </div></Card>}
    </div>
  </>
}

function AppointmentsLoadNotice({ store }) {
  if(store.appointmentsStatus==='error')return <Notice tone="warning" title="Clinic records couldn’t be loaded">{store.appointmentsError} <Button size="sm" variant="ghost" onClick={()=>store.appointmentFlow?.refresh()}>Try again</Button></Notice>
  if(store.appointmentsStatus==='loading')return <Notice>Loading today’s appointments and visits…</Notice>
  return null
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
    <PageHeader title={role==='dentist'?'My Patient Queue':'Patient Queue'} text="Operational queue controls with priority, check-in age, patient state transitions, and automatic position recalculation."/>
    <Card title={role==='dentist'?'My queue filters':'Queue filters'} className="filter-card"><div className="filter-row"><label>Branch <select value={activeBranch} disabled><option>{activeBranch}</option></select></label>{role!=='dentist'&&<label>Dentist <select value={dentistFilter} onChange={e=>setDentistFilter(e.target.value)}><option>All Dentists</option>{state.dentists.filter(d=>role==='owner'||d.branchIds.includes(session.branchId)).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}<label>Status <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option>Active</option><option>All</option><option>Waiting</option><option>Called</option><option>Treatment Ready</option><option>In Treatment</option><option>Temporarily Away</option><option>Completed</option></select></label></div></Card>
    {role==='staff'&&<Notice tone="info">A patient in the queue has already checked in. Marking them as having left or cancelling their visit isn’t available yet — the clinic still needs to decide how an admitted visit is closed. A patient who never arrived is marked No-show from Appointments.</Notice>}
    <Card title="Live queue" subtitle="Priority and checked-in order determine positions inside each dentist queue." className="top-gap">
      <Table rows={visible} columns={[
        {key:'position',label:'Pos.',render:q=>q.position?`#${q.position}`:'—'},
        {key:'queueNumber',label:'Queue no.',render:q=>q.queueNumber||q.position||'—'},
        {key:'patient',label:'Patient',render:q=><div><b>{patientName(q.patientId,state.patients)}</b><small className="block-muted">{q.priority} priority • {q.appointmentId?state.appointments.find(a=>a.id===q.appointmentId)?.appointmentNo||'Scheduled visit':'Walk-in visit'}</small></div>},
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
    <PageHeader title="Waiting-Time & Cross-Branch Capacity" text="Aggregate flow monitoring remains separate from individual queue ordering. It combines live queue load, active dentist capacity, bookings, and configurable branch thresholds."/>
    <div className="cards-3">{cards.map(c=><Card key={c.branch} title={c.branch} subtitle={`Threshold ${c.threshold}%`}><div className="capacity-number">{c.workload}% <span>workload</span></div><Progress value={c.workload} threshold={c.threshold}/><div className="metric-list"><Metric label="Active dentists" value={c.activeDentists}/><Metric label="Waiting" value={c.waiting}/><Metric label="Treatment-ready" value={c.ready}/><Metric label="Booked today" value={c.booked}/><Metric label="Estimated wait" value={`${c.estimate} min`}/></div>{c.overloaded?<Notice tone="warning" title="Capacity risk detected">Front desk and owner should be alerted and shown available capacity at another branch.</Notice>:<Notice tone="success">Branch is currently below its configured demo threshold.</Notice>}</Card>)}</div>
    <Card className="top-gap" title="Cross-branch alternatives" subtitle="Shown when a branch exceeds waiting-time or staffing thresholds">{alternatives.length?<div className="alternative-grid">{alternatives.map(c=><div className="alternative-card" key={c.branch}><b>{c.branch}</b><span>{c.workload}% load</span><small>{c.activeDentists} dentists • ~{c.estimate} min wait</small></div>)}</div>:<Notice tone="warning">No branch is currently below its capacity threshold.</Notice>}</Card>
  </>
}
function Metric({label,value}){return <div><span>{label}</span><b>{value}</b></div>}
