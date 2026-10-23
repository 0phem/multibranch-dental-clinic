import React, { useEffect, useState, useRef } from 'react'
import { Button, Card, Field, Icon, Modal, Notice, PageHeader, Progress, Status, Table } from '../components.jsx'
import { branchCapacity, dentistName, displayTime, patientName, queueWaitEstimate } from '../logic.js'
import { commandKey } from '../appointments-api.js'
import { useVisibleRefresh } from '../use-visible-refresh.js'
import { patientKeyResolver } from '../appointment-projection.js'
import { DEFAULT_COUNTRY, normalizePhoneNumber } from '../phone.js'
import { bookableBranches } from './Scheduling.jsx'

import { clinicDate } from '../clock.js'
import { PatientQueuePage } from './PatientVisits.jsx'
import { PossibleNoShows } from './PossibleNoShows.jsx'
import { FrontDeskToday } from './FrontDeskToday.jsx'
import { CounterCode, IdCheck, SelfRegistered } from './CounterIntake.jsx'
import { QueueByBranch, QueueStatusCounts, useQueueVisibility } from './QueueCounts.jsx'
import { encounterContext, inScope, isActiveQueue, isTodayQueue, sessionForRole } from '../contracts.js'

// M8 front desk. Arrival is server-authoritative: a scheduled Check-In or a Walk-In opens a server Visit (the scheduled
// appointment moves to Checked In) and — when the Visit has a responsible Dentist — queues it, all in one server
// transaction (M9). Patients come from the server directory (or the minimal front-desk registration); nothing here
// writes an arrival or queue record locally.
export function CheckInPage({ store }) {
  const { state, toast }=store
  const session=store.session||sessionForRole('staff',state)
  const flow=store.appointmentFlow
  const [mode,setMode]=useState('scheduled')
  const today=clinicDate()
  // Today's server appointments awaiting arrival (no Visit yet).
  const eligible=state.appointments.filter(a=>inScope(a,session,state)&&a.date===today&&['Confirmed','Pending'].includes(a.status)&&!(state.visits||[]).some(v=>v.appointmentId===a.id))
  // Today's server Visits that are checked in but not in a queue: only a Visit without a responsible Dentist (M9 Q4).
  // Shown honestly; no assignment workflow exists in this wave.
  const notQueued=(state.visits||[]).filter(v=>v.status==='Checked In'&&v.clinicDate===today&&inScope(v,session,state)&&!v.dentistId)
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
    setAppointmentId('');toast(result.queued?`Arrival recorded — queue number ${result.queueNumber}.`:'Arrival recorded.','success')
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
    setAdmitted(true);toast(result.queued?`Walk-in admitted — queue number ${result.queueNumber}.`:'Walk-in arrival recorded.','success')
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
    <PossibleNoShows toast={toast} onChanged={()=>flow?.refresh()}/>
    <div className="fd-grid"><CounterCode toast={toast}/><SelfRegistered toast={toast} store={store} onChanged={()=>flow?.refresh()}/></div>
    <FrontDeskToday toast={toast} onChanged={()=>flow?.refresh()}/>
    <AppointmentsLoadNotice store={store}/>
    <div className="checkin-shell">
      <div className="checkin-mode"><button className={mode==='scheduled'?'active':''} onClick={()=>setMode('scheduled')}><Icon name="calendar" size={18}/>Scheduled</button><button className={mode==='walkin'?'active':''} onClick={()=>setMode('walkin')}><Icon name="user" size={18}/>Walk-in</button></div>
      {mode==='scheduled'?<Card className="checkin-focus-card" title="Scheduled arrivals" subtitle="Select the patient who has arrived." actions={<Button size="sm" variant="ghost" onClick={()=>flow?.refresh()}>Refresh</Button>}>
        <div className="checkin-select-row"><Field label="Today’s appointment"><select value={selectedAppointment?.id||''} onChange={e=>setAppointmentId(e.target.value)}><option value="">Select appointment</option>{eligible.map(a=><option value={a.id} key={a.id}>{displayTime(a.start)} • {patientName(a.patientId,state.patients)} • {a.service}</option>)}</select></Field></div>
        {selectedAppointment?<div className="arrival-card"><div className="avatar large">{patientName(selectedAppointment.patientId,state.patients).split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div className="arrival-main"><span>Arriving patient</span><h2>{patientName(selectedAppointment.patientId,state.patients)}</h2><p>{selectedAppointment.service} • {selectedAppointment.dentistName||dentistName(selectedAppointment.dentistId,state.dentists)}</p><div className="arrival-meta"><span><Icon name="calendar" size={15}/>{displayTime(selectedAppointment.start)}</span><span><Icon name="building" size={15}/>{selectedAppointment.branch}</span><span>{selectedAppointment.appointmentNo}</span></div></div><div className="arrival-action"><Status>{selectedAppointment.status}</Status><Button onClick={checkScheduled} disabled={busy} icon="checkin">{busy?'Recording…':'Confirm arrival'}</Button></div></div>:<Notice>Select an appointment to check the patient in.</Notice>}
        {selectedAppointment?.patientPublicId&&session?.role==='staff'&&<IdCheck patientId={selectedAppointment.patientPublicId} toast={toast}/>}
        <div className="checkin-note"><Icon name="shield" size={17}/><div><b>Fast admission</b><span>The existing patient profile and appointment already identify the patient. The clinic server records the arrival, opens the visit and adds it to the Dentist’s queue; a patient who did not arrive is marked No-show from Appointments.</span></div></div>
        {notQueued.length>0&&<div className="top-gap"><Notice tone="info" title="Checked in, not in a queue">These visits have no responsible Dentist yet, so they are not in a Dentist’s queue and treatment can’t start. Assigning a Dentist later isn’t available yet.</Notice>
          {notQueued.map(v=><div className="clinical-history" key={v.id}><div><b>{v.patientName||patientName(v.patientId,state.patients)}</b><p>{v.walkIn?'Walk-in':v.appointmentCode} • arrived {displayTime(v.checkedIn)} • No Dentist assigned</p></div></div>)}
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
  const { state, toast }=store
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
  }).sort((a,b)=>String(a.branch||'').localeCompare(String(b.branch||''))||String(dentistName(a.dentistId,state.dentists)||'').localeCompare(String(dentistName(b.dentistId,state.dentists)||''))||(a.position||999)-(b.position||999)||(a.queueNumber||0)-(b.queueNumber||0))
  // M9: every queue change is a server command (Idempotency-Key per attempt + expected revision); the server computes
  // numbers and positions. A second click while a command is in flight is ignored.
  const flow=store.appointmentFlow
  const [busy,setBusy]=useState(null)
  const run=async(entry,label,send)=>{
    if(busy)return
    setBusy(entry.id)
    const result=await send(commandKey())
    setBusy(null)
    toast(result.ok?label:result.message,result.ok?'success':'warning')
  }
  const update=(entry,name,label)=>run(entry,label,key=>flow.queueCommand(entry,name,key))
  const [priorityModalEntry, setPriorityModalEntry] = useState(null)
  const [restoreModalEntry, setRestoreModalEntry] = useState(null)
  const priority = entry => {
    setPriorityModalEntry(entry)
  }
  const submitPriority = (entry, priorityLevel, reason) => {
    setPriorityModalEntry(null)
    if (priorityLevel === 'Urgent') {
      run(entry,'Queue priority updated.',key=>flow.queuePriority(entry,'Urgent',reason.trim(),key))
    } else {
      run(entry,'Queue priority updated.',key=>flow.queuePriority(entry,priorityLevel,reason.trim(),key))
    }
  }
  const restore = entry => {
    setRestoreModalEntry(entry)
  }
  const submitRestore = (entry, reason) => {
    setRestoreModalEntry(null)
    run(entry, 'Normal queue place restored.', key => flow.queueRestoreOrder(entry, reason.trim(), key))
  }
  const operational=['staff','owner'].includes(role)
  const vis=useQueueVisibility(store)
  const demo=vis.mode==='demo'
  useVisibleRefresh(flow?.refresh,{active:role!=='patient'})
  if (role==='patient') return <PatientQueuePage store={store} setPage={setPage}/>
  return <>
    <PageHeader title={role==='dentist'?'My Patient Queue':'Patient Queue'} text="The clinic server keeps the queue: numbers, order and positions update for everyone. Priority, then on-time before late arrivals, then arrival order decide positions inside each Dentist’s queue." aside={<Button variant="ghost" onClick={()=>flow?.refresh()}>Refresh</Button>}/>
    <Card title={role==='dentist'?'My queue filters':'Queue filters'} className="filter-card"><div className="filter-row"><label>Branch <select value={activeBranch} disabled><option>{activeBranch}</option></select></label>{role!=='dentist'&&<label>Dentist <select value={dentistFilter} onChange={e=>setDentistFilter(e.target.value)}><option>All Dentists</option>{state.dentists.filter(d=>role==='owner'||d.branchIds.includes(session.branchId)).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}<label>Status <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option>Active</option><option>All</option><option>Waiting</option><option>Called</option><option>Treatment Ready</option><option>Temporarily Away</option><option value="Served">Served (treatment started)</option></select></label></div></Card>
    <AppointmentsLoadNotice store={store}/>
    {!demo&&<QueueStatusCounts store={store} activeBranch={role==='owner'?activeBranch:'All Branches'} vis={vis}/>}
    {operational&&!demo&&<SelfRegistered toast={toast} store={store} compact/>}
    {role==='staff'&&<Notice tone="info">A patient in the queue has already checked in. Marking them as having left or cancelling their visit isn’t available yet — the clinic still needs to decide how an admitted visit is closed. A patient who never arrived is marked No-show from Appointments.</Notice>}
    <Card title="Live queue" subtitle="Priority and checked-in order determine positions inside each dentist queue." className="top-gap">
      <Table rows={visible} columns={[
        {key:'position',label:'Pos.',render:q=>q.position?`#${q.position}`:'—'},
        {key:'queueNumber',label:'Queue no.',render:q=>q.queueNumber||'—'},
        {key:'patient',label:'Patient',render:q=><div>
          <div style={{display:'flex',alignItems:'center',gap:'6px',flexWrap:'wrap'}}>
            <b>{q.patientName||patientName(q.patientId,state.patients)}</b>
            {q.priority==='Urgent'&&<span className="status danger" style={{fontSize:'10px',padding:'2px 6px'}}><i aria-hidden="true"/>Urgent</span>}
            {q.priority==='Priority'&&<span className="status warning" style={{fontSize:'10px',padding:'2px 6px'}}><i aria-hidden="true"/>{q.priorityReason?.includes('Senior')?'Senior Priority':q.priorityReason?.includes('PWD')?'PWD Priority':'Priority'}</span>}
          </div>
          <small className="block-muted">{q.lateArrival&&<span className="fd-badge is-late">Late arrival · queued last</span>} {q.priority} priority{q.priorityReason?` (${q.priorityReason})`:''} • {q.appointmentCode||(q.walkIn?'Walk-in visit':'Scheduled visit')}</small>
        </div>},
        {key:'branch',label:'Branch'},{key:'dentist',label:'Dentist',render:q=>dentistName(q.dentistId,state.dentists)},
        {key:'checkedIn',label:'Checked in',render:q=>displayTime(q.checkedIn)},
        ...(demo?[{key:'wait',label:'Est. wait (demo)',render:q=>`${queueWaitEstimate(q,state.queue,state.appointments,state.treatments,state.dentists)} min`}]:[]),
        {key:'status',label:'Status',render:q=><Status>{q.displayStatus||q.status}</Status>},
        {key:'actions',label:'Actions',render:q=><div className="row-actions">
          {q.status==='Waiting'&&(operational||role==='dentist')&&<Button size="sm" variant="soft" disabled={!!busy} onClick={()=>update(q,'call','Patient called.')}>Call patient</Button>}
          {role==='dentist'&&(['Called','Treatment Ready'].includes(q.status)||q.status==='Served'&&q.visitStatus==='In Treatment')&&<Button size="sm" onClick={()=>setPage('treatment',encounterContext(q))}>{q.treatmentId?'Continue Treatment':'Open Treatment'}</Button>}
          <Button size="sm" variant="ghost" onClick={()=>setPage('patients',encounterContext(q))}>Open Chart</Button>
          {operational&&<>
            {q.status==='Called'&&<Button size="sm" variant="soft" disabled={!!busy} onClick={()=>update(q,'ready','Marked ready for treatment.')}>Ready for treatment</Button>}
            {['Waiting','Called','Treatment Ready'].includes(q.status)&&<Button size="sm" variant="ghost" disabled={!!busy} onClick={()=>update(q,'away','Marked temporarily away.')}>Temporarily Away</Button>}
            {q.status==='Temporarily Away'&&<Button size="sm" variant="soft" disabled={!!busy} onClick={()=>update(q,'return','Returned to the queue.')}>Return to Queue</Button>}
            {active(q)&&q.priority!=='Urgent'&&<Button size="sm" variant="ghost" disabled={!!busy} onClick={()=>priority(q)}>Urgent queue priority</Button>}
            {active(q)&&q.lateArrival&&<Button size="sm" variant="ghost" disabled={!!busy} onClick={()=>restore(q)}>Restore normal place</Button>}
          </>}
        </div>}

      ]}/>
    </Card>
    {priorityModalEntry&&<PriorityModal entry={priorityModalEntry} onClose={()=>setPriorityModalEntry(null)} onConfirm={submitPriority}/>}
    {restoreModalEntry&&<RestoreModal entry={restoreModalEntry} onClose={()=>setRestoreModalEntry(null)} onConfirm={submitRestore}/>}
  </>
}

export function PriorityModal({ entry, onClose, onConfirm }) {
  const [category, setCategory] = useState('Senior Citizen')
  const [reason, setReason] = useState('Senior citizen priority')
  if (!entry) return null
  const isUrgent = category === 'Urgent'
  const priorityLevel = isUrgent ? 'Urgent' : 'Priority'

  const handleSubmit = e => {
    e.preventDefault()
    if (!reason.trim()) return
    onConfirm(entry, priorityLevel, reason.trim())
  }

  return (
    <Modal open title="Assign Queue Priority" subtitle="Prioritize queue position for special needs or medical urgency" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Notice tone="info">
          Operational priority reorders the queue for seniors, PWD, or urgent medical needs. This is an operational accommodation, not a clinical assessment.
        </Notice>
        <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Field label="Priority Category" required>
            <select value={category} onChange={e => {
              const val = e.target.value
              setCategory(val)
              if (val === 'Senior Citizen') setReason('Senior citizen priority')
              else if (val === 'PWD') setReason('Person with disability (PWD) priority')
              else if (val === 'Urgent') setReason('Urgent medical priority')
            }}>
              <option value="Senior Citizen">Senior Citizen (Priority)</option>
              <option value="PWD">Person with Disability - PWD (Priority)</option>
              <option value="Urgent">Urgent / Medical Priority (Urgent)</option>
            </select>
          </Field>
          <Field label="Operational Reason" required hint="Required for operational and audit records.">
            <input
              type="text"
              required
              placeholder="e.g. Elderly patient, wheelchair assistance, acute pain"
              value={reason}
              onChange={e => setReason(e.target.value)}
              autoFocus
            />
          </Field>
        </div>
        <div className="row-actions" style={{ marginTop: '20px' }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant={isUrgent ? 'danger' : 'primary'} disabled={!reason.trim()}>
            Apply {priorityLevel}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export function RestoreModal({ entry, onClose, onConfirm }) {
  const [reason, setReason] = useState('Front desk schedule review')
  if (!entry) return null
  const handleSubmit = e => {
    e.preventDefault()
    if (!reason.trim()) return
    onConfirm(entry, reason.trim())
  }
  return (
    <Modal open title="Restore Normal Queue Place" subtitle="Staff override of late arrival order" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Reason for Restoring Queue Order" required hint="Required for audit and operational records.">
          <input
            type="text"
            required
            placeholder="Reason for giving this late arrival their normal place..."
            value={reason}
            onChange={e => setReason(e.target.value)}
            autoFocus
          />
        </Field>
        <div className="row-actions" style={{ marginTop: '20px' }}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!reason.trim()}>Restore Normal Place</Button>
        </div>
      </form>
    </Modal>
  )
}

export function CapacityPage({ activeBranch, store }) {
  const vis=useQueueVisibility(store)
  useVisibleRefresh(store.appointmentFlow?.refresh,{active:vis.mode!=='demo'})
  // Clinic-server session: only factual queue counts. The workload %, thresholds, waiting-time estimates and cross-branch
  // alternatives below are unapproved prototype estimators and stay in the labelled offline demo only.
  if(vis.mode!=='demo')return <>
    <PageHeader title="Live Queue by Branch" text="Counts of today’s queue entries by status, from the clinic server. The clinic has not approved waiting-time estimates, workload percentages or capacity limits, so none is shown."/>
    <QueueByBranch store={store} activeBranch={activeBranch} vis={vis} title="Today’s queue"/>
    <BranchQueueDetailSection store={store} activeBranch={activeBranch}/>
  </>
  const { state }=store
  const branches=state.branches.filter(b=>activeBranch==='All Branches'||b.name===activeBranch)
  const cards=branches.map(b=>branchCapacity(b.name,state))
  const alternatives=state.branches.filter(b=>b.status==='Open'&&(activeBranch==='All Branches'||b.name!==activeBranch)).map(b=>branchCapacity(b.name,state)).filter(c=>c.activeDentists>0&&!c.overloaded).sort((a,b)=>a.workload-b.workload)
  return <>
    <PageHeader title="Waiting-Time & Cross-Branch Capacity (offline demo)" text="Offline demo estimates only, not clinic policy. Aggregate flow monitoring remains separate from individual queue ordering. It combines live queue load, active dentist capacity, bookings, and configurable branch thresholds."/>
    <div className="cards-3">{cards.map(c=><Card key={c.branch} title={c.branch} subtitle={`Threshold ${c.threshold}%`}><div className="capacity-number">{c.workload}% <span>workload</span></div><Progress value={c.workload} threshold={c.threshold}/><div className="metric-list"><Metric label="Active dentists" value={c.activeDentists}/><Metric label="Waiting" value={c.waiting}/><Metric label="Treatment-ready" value={c.ready}/><Metric label="Booked today" value={c.booked}/><Metric label="Estimated wait" value={`${c.estimate} min`}/></div>{c.overloaded?<Notice tone="warning" title="Capacity risk detected">Front desk and owner should be alerted and shown available capacity at another branch.</Notice>:<Notice tone="success">Branch is currently below its configured demo threshold.</Notice>}</Card>)}</div>
    <Card className="top-gap" title="Cross-branch alternatives" subtitle="Shown when a branch exceeds waiting-time or staffing thresholds">{alternatives.length?<div className="alternative-grid">{alternatives.map(c=><div className="alternative-card" key={c.branch}><b>{c.branch}</b><span>{c.workload}% load</span><small>{c.activeDentists} dentists • ~{c.estimate} min wait</small></div>)}</div>:<Notice tone="warning">No branch is currently below its capacity threshold.</Notice>}</Card>
  </>
}
function Metric({label,value}){return <div><span>{label}</span><b>{value}</b></div>}

function BranchQueueDetailSection({ store, activeBranch }) {
  const { state } = store
  const [selectedBranchId, setSelectedBranchId] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const branches = state.branches.filter(b => activeBranch === 'All Branches' || b.name === activeBranch)
  const queueEntries = (state.queue || []).filter(q => {
    if (!isTodayQueue(q)) return false
    if (selectedBranchId !== 'All' && q.branchId !== selectedBranchId && q.branch !== selectedBranchId) return false
    if (activeBranch !== 'All Branches' && q.branch !== activeBranch) return false
    if (statusFilter !== 'All' && q.status !== statusFilter) return false
    return true
  }).sort((a, b) => (a.position || 999) - (b.position || 999) || (a.queueNumber || 0) - (b.queueNumber || 0))

  return (
    <Card
      className="top-gap"
      title="Live Queue Details"
      subtitle="Authorized patient queue records for today, organized by branch."
    >
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' }}>
        {branches.length > 1 && (
          <select
            className="filter-select"
            aria-label="Filter queue details by branch"
            value={selectedBranchId}
            onChange={e => setSelectedBranchId(e.target.value)}
          >
            <option value="All">All visible branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
        <select
          className="filter-select"
          aria-label="Filter queue details by status"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="All">All statuses ({queueEntries.length})</option>
          <option value="Waiting">Waiting</option>
          <option value="Called">Called</option>
          <option value="Treatment Ready">Treatment Ready</option>
          <option value="Temporarily Away">Temporarily Away</option>
          <option value="Served">Served</option>
        </select>
      </div>

      <Table
        rows={queueEntries}
        empty="No patients matching your filter in today's live queue."
        columns={[
          { key: 'queueNumber', label: '#', render: q => <b>{q.queueNumber ? `#${q.queueNumber}` : (q.code || '—')}</b> },
          { key: 'patient', label: 'Patient', render: q => <div><b>{q.patientName || patientName(q.patientId, state.patients)}</b>{q.priority && q.priority !== 'Normal' && <span className={`mini-chip ${['Urgent', 'Emergency'].includes(q.priority) ? 'danger' : 'info'}`} style={{ marginLeft: 6 }}>{q.priority}</span>}</div> },
          { key: 'service', label: 'Service', render: q => q.service || q.serviceName || 'Consultation' },
          { key: 'dentist', label: 'Dentist', render: q => q.dentistName || dentistName(q.dentistId, state.dentists) || 'Unassigned' },
          { key: 'branch', label: 'Branch', render: q => q.branch || 'Main' },
          { key: 'time', label: 'Time / Arrival', render: q => <small className="block-muted">{displayTime(q.time || q.start || q.arrival)}</small> },
          { key: 'status', label: 'Status', render: q => <Status>{q.status}</Status> },
        ]}
      />
    </Card>
  )
}
