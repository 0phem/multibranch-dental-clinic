import React, { useState, useRef } from 'react'
import { ROLE_INFO } from '../data.js'
import { Button, Card, Field, Icon, Modal, Notice, PageHeader, Status, Table } from '../components.jsx'
import { availableSlots, addMinutes, dateLabel, dentistName, displayTime, patientName, serviceInfo, uid, validateAppointment } from '../logic.js'

import { clinicDate } from '../clock.js'
import { inScope, patientInScope, sessionForRole, TERMINAL } from '../contracts.js'

function appointmentFormDefaults(state, prefill={}, session=null) {
  const patientId=session?.role==='patient'?session.patientId:prefill.patientId || state.patients.find(p=>!session||patientInScope(p,state,session))?.id||''
  const patient=state.patients.find(p=>p.id===patientId)
  const branchId=session?.role==='staff'?session.branchId:prefill.branchId || state.branches.find(b=>b.name===prefill.branch)?.id || patient?.preferredBranchId || state.branches[0]?.id
  const branch=state.branches.find(b=>b.id===branchId)?.name
  const service=serviceInfo(prefill.serviceId||prefill.service||'svc1',state.services)
  const allowedDentistIds=new Set((state.dentistServiceAssignments||[]).filter(a=>a.serviceId===service.id).map(a=>a.dentistId))
  const dentist=state.dentists.find(d=>d.branches.includes(branch)&&d.available&&allowedDentistIds.has(d.id))
  return { patientId, branchId, dentistId:prefill.dentistId||dentist?.id||'', serviceId:service.id||state.services[0]?.id||'', date:prefill.date||clinicDate(), start:prefill.start||'10:00', duration:prefill.duration||service.duration, notes:prefill.notes||'', source:prefill.source||'Portal' }
}

export function AppointmentForm({ role, store, prefill={}, ignoreId=null, onSaved, followupId=null, submitLabel='Validate & Confirm Appointment' }) {
  const { state, actions, toast }=store
  const session=store.session||sessionForRole(role,state)
  const commandId=useRef(uid('booking'))
  const [form,setForm]=useState(()=>appointmentFormDefaults(state,prefill,session))
  const [result,setResult]=useState(null)
  const update=(name,value)=>{
    const next={...form,[name]:value}
    if (name==='serviceId') next.duration=serviceInfo(value,state.services).duration
    if (name==='branchId') {
      const branch=state.branches.find(b=>b.id===value)
      const availableServiceIds=new Set(state.branchServices.filter(bs=>bs.branchId===branch?.id&&bs.active!==false).map(bs=>bs.serviceId))
      if(!availableServiceIds.has(next.serviceId)){
        const first=state.services.find(s=>availableServiceIds.has(s.id)&&s.status==='Active')
        next.serviceId=first?.id||'';next.duration=first?.duration||0
      }
      const allowed=new Set(state.dentistServiceAssignments.filter(a=>a.serviceId===next.serviceId).map(a=>a.dentistId))
      const d=state.dentists.find(x=>x.branchIds.includes(value)&&x.available&&allowed.has(x.id))
      next.dentistId=d?.id||''
    }
    if(name==='serviceId'){
      const allowed=new Set(state.dentistServiceAssignments.filter(a=>a.serviceId===value).map(a=>a.dentistId))
      const d=state.dentists.find(x=>x.branchIds.includes(next.branchId)&&x.available&&allowed.has(x.id))
      next.dentistId=d?.id||''
    }
    if(followupId){next.patientId=prefill.patientId;next.branchId=prefill.branchId;next.dentistId=prefill.dentistId}
    setForm(next); setResult(null)
  }
  const validate=()=>{const r=validateAppointment(form,state,ignoreId); setResult(r); return r}
  const save=()=>{
    const r=validateAppointment(form,state,ignoreId)
    setResult(r)
    const result=actions.saveAppointment(form,{appointmentId:ignoreId,commandId:commandId.current,expectedRevision:prefill.revision,followupId})
    if(!result.ok)return toast(result.message,'warning')
    toast(ignoreId?'Appointment rescheduled.':'Appointment confirmed.','success')
    onSaved?.(result.record)
  }
  const branch=state.branches.find(b=>b.id===form.branchId)
  const serviceIds=new Set(state.branchServices.filter(bs=>bs.branchId===branch?.id&&bs.active!==false).map(bs=>bs.serviceId))
  const availableServices=state.services.filter(s=>s.status==='Active'&&serviceIds.has(s.id))
  const allowedDentistIds=new Set(state.dentistServiceAssignments.filter(a=>a.serviceId===form.serviceId).map(a=>a.dentistId))
  const availableDentists=state.dentists.filter(d=>d.branchIds.includes(form.branchId)&&d.available&&allowedDentistIds.has(d.id))
  return <div className="booking-layout">
    <form className="form-grid" onSubmit={e=>{e.preventDefault();save()}}>
      {role!=='patient'&&<Field label="Patient" required><select disabled={!!followupId} value={form.patientId} onChange={e=>update('patientId',e.target.value)}>{state.patients.filter(p=>patientInScope(p,state,session)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
      <Field label="Branch" required><select disabled={!!followupId} value={form.branchId} onChange={e=>update('branchId',e.target.value)}>{state.branches.filter(b=>b.status==='Open'&&(session.role!=='staff'||b.id===session.branchId)).map(b=><option key={b.id} value={b.id}>{b.name} • {b.status}</option>)}</select></Field>
      <Field label="Service" required><select value={form.serviceId} onChange={e=>update('serviceId',e.target.value)}>{availableServices.map(s=><option key={s.id} value={s.id}>{s.name} • {s.duration} min</option>)}</select></Field>
      <Field label="Dentist" required><select disabled={!!followupId} value={form.dentistId} onChange={e=>update('dentistId',e.target.value)}>{availableDentists.map(d=><option key={d.id} value={d.id}>{d.name} • {d.specialty}</option>)}</select></Field>
      <Field label="Date" required><input type="date" value={form.date} min={clinicDate()} onChange={e=>update('date',e.target.value)}/></Field>
      <Field label="Start time" required><input type="time" value={form.start} onChange={e=>update('start',e.target.value)}/></Field>
      <Field label="Expected duration"><input value={`${form.duration} minutes`} disabled/></Field>
      <Field label="Notes"><input value={form.notes} placeholder="Optional booking note" onChange={e=>update('notes',e.target.value)}/></Field>
      <div className="form-actions span-2"><Button type="button" variant="ghost" onClick={validate}>Check Slot</Button><Button type="submit">{submitLabel}</Button></div>
    </form>
    <div className="validation-card">
      <div className="validation-title"><b>Smart Scheduling validation</b><span>Real-time checks</span></div>
      {!result&&<Notice tone="info">The system verifies date, branch hours, branch-service availability, dentist service assignment and shift, and overlapping appointments before confirmation.</Notice>}
      {result&&<>
        <div className="check-list">{result.checks.map(c=><div key={c.key} className={`check-row ${c.ok?'ok':'bad'}`}><span>{c.ok?'✓':'!'}</span><div><b>{c.label}</b><small>{c.detail}</small></div></div>)}</div>
        {result.valid?<Notice tone="success" title="Valid slot">All scheduling checks passed. The appointment can be confirmed safely.</Notice>:<Notice tone="warning" title="Requested slot blocked">Select one of the available alternatives or change the branch, dentist, date, or service.</Notice>}
        {!result.valid&&result.alternatives.length>0&&<div className="alternatives"><small>Suggested conflict-free alternatives</small><div className="chip-row">{result.alternatives.map(t=><button type="button" className="chip" key={t} onClick={()=>update('start',t)}>{displayTime(t)}</button>)}</div></div>}
      </>}
    </div>
  </div>
}

function PatientBookingWizard({store}){
  const {state,actions,toast}=store
  const session=store.session||sessionForRole('patient',state)
  const commandId=useRef(uid('booking'))
  const defaults=appointmentFormDefaults(state,{},session)
  const [form,setForm]=useState(defaults)
  const [step,setStep]=useState(0)
  const [finding,setFinding]=useState(false)
  const [suggestions,setSuggestions]=useState([])
  const [confirmed,setConfirmed]=useState(null)
  const steps=['Branch','Service','Dentist','Date & time','Review']
  const branch=state.branches.find(b=>b.id===form.branchId)
  const branchServiceIds=new Set(state.branchServices.filter(bs=>bs.branchId===branch?.id&&bs.active!==false).map(bs=>bs.serviceId))
  const services=state.services.filter(s=>s.status==='Active'&&branchServiceIds.has(s.id))
  const allowedDentistIds=new Set(state.dentistServiceAssignments.filter(a=>a.serviceId===form.serviceId).map(a=>a.dentistId))
  const dentists=state.dentists.filter(d=>d.branchIds.includes(form.branchId)&&d.available&&allowedDentistIds.has(d.id))
  const selectedService=serviceInfo(form.serviceId,state.services)
  const selectedDentist=state.dentists.find(d=>d.id===form.dentistId)
  const update=(key,val)=>{
    const next={...form,[key]:val}
    if(key==='branchId'){
      const b=state.branches.find(x=>x.id===val)
      const ids=new Set(state.branchServices.filter(bs=>bs.branchId===b?.id&&bs.active!==false).map(bs=>bs.serviceId))
      const svc=state.services.find(s=>s.status==='Active'&&ids.has(s.id)); next.serviceId=svc?.id||'';next.duration=svc?.duration||0
      const allowed=new Set(state.dentistServiceAssignments.filter(a=>a.serviceId===next.serviceId).map(a=>a.dentistId))
      const d=state.dentists.find(x=>x.branchIds.includes(val)&&x.available&&allowed.has(x.id)); next.dentistId=d?.id||''
    }
    if(key==='serviceId'){
      const svc=serviceInfo(val,state.services); next.duration=svc.duration
      const allowed=new Set(state.dentistServiceAssignments.filter(a=>a.serviceId===val).map(a=>a.dentistId))
      const d=state.dentists.find(x=>x.branchIds.includes(next.branchId)&&x.available&&allowed.has(x.id)); next.dentistId=d?.id||''
    }
    setForm(next);setSuggestions([])
  }
  const timeOptions=availableSlots(form,state)
  const smartFind=()=>{
    setFinding(true);setSuggestions([])
    window.setTimeout(()=>{
      const options=[]
      for(const d of dentists) for(const start of availableSlots({...form,dentistId:d.id},state)) {
        options.push({dentistId:d.id,start,score:Math.abs(Number(start.slice(0,2))-11)})
      }
      setSuggestions(options.sort((a,b)=>a.score-b.score).slice(0,4));setFinding(false)
    },850)
  }
  const chooseSuggestion=s=>{setForm(x=>({...x,dentistId:s.dentistId,start:s.start}));setSuggestions([]);setStep(4)}
  const save=()=>{
    const result=actions.saveAppointment(form,{commandId:commandId.current})
    if(!result.ok){toast(result.message,'warning');setStep(3);return}
    toast('Appointment confirmed.','success');setConfirmed(result.record)
  }
  if(confirmed)return <div className="booking-success"><div className="booking-success-icon">✓</div><span>Appointment confirmed</span><h2>You’re all set.</h2><p>{confirmed.service} on {dateLabel(confirmed.date)} at {displayTime(confirmed.start)} in {confirmed.branch}.</p><div className="booking-success-summary"><div><span>Dentist</span><b>{dentistName(confirmed.dentistId,state.dentists)}</b></div><div><span>Confirmation</span><b>{confirmed.appointmentNo}</b></div></div><Button onClick={()=>{commandId.current=uid('booking');setConfirmed(null);setStep(0);setForm(appointmentFormDefaults(state,{},session))}} variant="soft">Book another visit</Button></div>
  return <div className="patient-booking">
    <div className="booking-stepper">{steps.map((s,i)=><button key={s} className={`${i===step?'active':''} ${i<step?'complete':''}`} onClick={()=>i<=step&&setStep(i)}><span>{i<step?'✓':i+1}</span><b>{s}</b></button>)}</div>
    <div className="booking-stage">
      {step===0&&<div className="booking-choice-stage"><div className="stage-copy"><span>Step 1 of 5</span><h2>Which clinic works best for you?</h2><p>You can switch branches later if you need a different schedule.</p></div><div className="choice-card-grid">{state.branches.filter(b=>b.status==='Open'&&(session.role!=='staff'||b.id===session.branchId)).map(b=><button key={b.id} className={`choice-card ${form.branchId===b.id?'selected':''}`} onClick={()=>update('branchId',b.id)}><div className="choice-icon"><Icon name="building" size={21}/></div><div><b>{b.name}</b><span>{b.city}</span><small>{b.open}–{b.close} • {b.status}</small></div>{form.branchId===b.id&&<i>✓</i>}</button>)}</div><div className="booking-footer"><span/><Button onClick={()=>setStep(1)} icon="arrow">Continue</Button></div></div>}
      {step===1&&<div className="booking-choice-stage"><div className="stage-copy"><span>Step 2 of 5</span><h2>What can we help you with?</h2><p>Choose the service or visit type you’d like to schedule.</p></div><div className="service-choice-grid">{services.map(s=><button key={s.id} className={`service-choice ${form.serviceId===s.id?'selected':''}`} onClick={()=>update('serviceId',s.id)}><span><Icon name="tooth" size={19}/></span><div><b>{s.name}</b><small>{s.category} • ~{s.duration} min</small></div>{form.serviceId===s.id&&<i>✓</i>}</button>)}</div><div className="booking-footer"><Button variant="ghost" onClick={()=>setStep(0)}>Back</Button><Button onClick={()=>setStep(2)} icon="arrow">Continue</Button></div></div>}
      {step===2&&<div className="booking-choice-stage"><div className="stage-copy"><span>Step 3 of 5</span><h2>Choose your dentist</h2><p>Only dentists assigned to {branch?.name||'Select branch'} and eligible for {selectedService.name} are shown.</p></div><div className="dentist-choice-grid">{dentists.map(d=><button key={d.id} className={`dentist-choice ${form.dentistId===d.id?'selected':''}`} onClick={()=>update('dentistId',d.id)}><div className="avatar large">{d.name.replace('Dr. ','').split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div><b>{d.name}</b><span>{d.specialty}</span><small>{d.shiftStart}–{d.shiftEnd}</small></div>{form.dentistId===d.id&&<i>✓</i>}</button>)}</div><div className="booking-footer"><Button variant="ghost" onClick={()=>setStep(1)}>Back</Button><Button onClick={()=>setStep(3)} icon="arrow">Continue</Button></div></div>}
      {step===3&&<div className="booking-time-stage"><div className="stage-copy"><span>Step 4 of 5</span><h2>Pick a date and available time</h2><p>Past dates and conflicting times are automatically blocked.</p></div><div className="date-time-layout"><div className="date-panel"><Field label="Appointment date"><input type="date" min={clinicDate()} value={form.date} onChange={e=>update('date',e.target.value)}/></Field><div className="smart-find-card"><span><Icon name="sparkles" size={20}/></span><div><b>Want us to find it?</b><small>We’ll scan valid times for this service and branch.</small></div><Button size="sm" variant="soft" onClick={smartFind} disabled={finding}>{finding?'Finding…':'Find best schedule'}</Button></div></div><div className="time-panel"><div className="time-panel-head"><div><b>Available times</b><small>{dateLabel(form.date)} • {selectedDentist?.name}</small></div><span>{timeOptions.length} slots</span></div><div className="time-grid">{timeOptions.length?timeOptions.map(t=><button className={form.start===t?'selected':''} key={t} onClick={()=>update('start',t)}>{displayTime(t)}</button>):<Notice tone="warning">No available times for this dentist on the selected date. Try Smart Schedule or choose another dentist.</Notice>}</div></div></div>{finding&&<div className="finding-overlay"><div className="finding-loader"><Icon name="sparkles" size={24}/></div><b>Finding the best schedules for you…</b><span>Checking branch hours, dentist availability and conflicts</span></div>}{suggestions.length>0&&<div className="smart-results"><div className="smart-results-head"><div><span><Icon name="sparkles" size={18}/></span><div><b>Best available options</b><small>All of these passed Smart Scheduling validation.</small></div></div><button onClick={()=>setSuggestions([])}>Dismiss</button></div><div className="smart-result-grid">{suggestions.map((s,i)=><button key={`${s.dentistId}-${s.start}`} onClick={()=>chooseSuggestion(s)}><span>#{i+1} match</span><b>{displayTime(s.start)}</b><small>{dentistName(s.dentistId,state.dentists)}</small></button>)}</div></div>}<div className="booking-footer"><Button variant="ghost" onClick={()=>setStep(2)}>Back</Button><Button onClick={()=>setStep(4)} icon="arrow" disabled={!timeOptions.includes(form.start)}>Review appointment</Button></div></div>}
      {step===4&&<div className="booking-review-stage"><div className="stage-copy"><span>Step 5 of 5</span><h2>Review your appointment</h2><p>Nothing is charged at booking. Billing is based on completed treatment after your visit.</p></div><div className="review-card"><div className="review-main"><div className="calendar-tile"><strong>{form.date.slice(-2)}</strong><span>{dateLabel(form.date).split(' ')[0]}</span></div><div><span className="review-label">{selectedService.name}</span><h3>{dateLabel(form.date)} • {displayTime(form.start)}</h3><p>{branch?.name||'Select branch'} • {selectedDentist?.name}</p></div></div><div className="review-details"><div><span>Expected duration</span><b>~{form.duration} minutes</b></div><div><span>Booking source</span><b>Patient Portal</b></div><div><span>Payment</span><b>After completed treatment</b></div></div></div><Field label="Optional note"><textarea value={form.notes} placeholder="Anything the clinic should know before your visit?" onChange={e=>update('notes',e.target.value)}/></Field><div className="booking-footer"><Button variant="ghost" onClick={()=>setStep(3)}>Back</Button><Button onClick={save} icon="checkin">Confirm appointment</Button></div></div>}
    </div>
  </div>
}

export function BookingPage({ role, store }) {
  if(role==='patient')return <><PageHeader kicker="Online booking" title="Book your visit" text="Choose what you need and we’ll only show schedules that are actually available."/><PatientBookingWizard store={store}/></>
  return <><PageHeader kicker="Scheduling" title="Create an appointment" text="Staff bookings use the same conflict-prevention and availability rules as patient self-booking."/><Card title="Appointment details"><AppointmentForm role={role} store={store}/></Card></>
}

export function AppointmentsPage({ role, store }) {
  const { state, actions, toast }=store
  const session=store.session||sessionForRole(role,state)
  const [reschedule,setReschedule]=useState(null)
  const [newOpen,setNewOpen]=useState(false)
  const [patientTab,setPatientTab]=useState('upcoming')
  const pid=ROLE_INFO.patient.patientId
  const visible=state.appointments.filter(a=>inScope(a,session,state)).sort((a,b)=>`${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))
  const cancel=a=>{
    if (!window.confirm('Cancel this appointment and release the reserved slot?')) return
    const result=actions.cancelAppointment(a.id)
    toast(result.ok?'Appointment cancelled.':result.message,result.ok?'success':'warning')
  }
  if(role==='patient'){
    const upcoming=visible.filter(a=>!TERMINAL.includes(a.status)&&a.date>=clinicDate())
    const completed=visible.filter(a=>['Completed','No-show'].includes(a.status)||(a.date<clinicDate()&&a.status!=='Cancelled'))
    const cancelled=visible.filter(a=>a.status==='Cancelled')
    const map={upcoming,completed,cancelled}; const rows=map[patientTab]
    return <>
      <PageHeader kicker="Your visits" title="Appointments" text="Everything you need for upcoming and previous clinic visits." aside={<Button onClick={()=>setNewOpen(true)} icon="plusCalendar">Book appointment</Button>}/>
      <div className="patient-tabs"><button className={patientTab==='upcoming'?'active':''} onClick={()=>setPatientTab('upcoming')}>Upcoming <span>{upcoming.length}</span></button><button className={patientTab==='completed'?'active':''} onClick={()=>setPatientTab('completed')}>Past <span>{completed.length}</span></button><button className={patientTab==='cancelled'?'active':''} onClick={()=>setPatientTab('cancelled')}>Cancelled <span>{cancelled.length}</span></button></div>
      <div className="appointment-card-list">{rows.length?rows.map(a=><article className="appointment-card" key={a.id}><div className="appointment-date-block"><b>{a.date.slice(-2)}</b><span>{dateLabel(a.date).split(' ')[0]}</span></div><div className="appointment-card-main"><div className="appointment-card-head"><div><span>{a.service}</span><h3>{displayTime(a.start)} • {a.branch}</h3></div><Status>{a.status}</Status></div><div className="appointment-card-meta"><span><Icon name="tooth" size={15}/>{dentistName(a.dentistId,state.dentists)}</span><span><Icon name="calendar" size={15}/>{a.duration} minutes</span><span><Icon name="file" size={15}/>{a.appointmentNo||a.id}</span></div>{a.notes&&<p className="appointment-note">{a.notes}</p>}<div className="appointment-card-actions">{['Confirmed','Pending'].includes(a.status)&&a.date>=clinicDate()&&<><Button size="sm" variant="soft" onClick={()=>setReschedule(a)}>Reschedule</Button><Button size="sm" variant="ghost" onClick={()=>cancel(a)}>Cancel appointment</Button></>}</div></div></article>):<div className="appointment-empty"><span><Icon name="calendar" size={26}/></span><h3>No {patientTab} appointments</h3><p>{patientTab==='upcoming'?'When you book a visit, it will appear here.':'There are no visits in this section.'}</p>{patientTab==='upcoming'&&<Button onClick={()=>setNewOpen(true)} icon="plusCalendar">Book a visit</Button>}</div>}</div>
      <Modal open={newOpen} title="Book an appointment" subtitle="Choose a valid schedule and confirm your visit." wide onClose={()=>setNewOpen(false)}><PatientBookingWizard store={store}/></Modal>
      <Modal open={!!reschedule} title="Reschedule appointment" subtitle="Your new time must pass the same availability checks." wide onClose={()=>setReschedule(null)}>{reschedule&&<AppointmentForm role={role} store={store} ignoreId={reschedule.id} prefill={reschedule} submitLabel="Save new schedule" onSaved={()=>setReschedule(null)}/>}</Modal>
    </>
  }
  return <>
    <PageHeader kicker="Scheduling" title="Appointment management" text="Create, confirm, reschedule and cancel visits from one operational view." aside={<Button onClick={()=>setNewOpen(true)} icon="plusCalendar">New appointment</Button>}/>
    <Card title="Clinic appointments" subtitle="Smart Scheduling validation applies to every new or changed slot.">
      <Table rows={visible} columns={[
        {key:'appointmentNo',label:'Appointment',render:a=><div><b>{a.appointmentNo||a.id}</b><small className="block-muted">{a.source}</small></div>},
        {key:'date',label:'Date & time',render:a=><div><b>{dateLabel(a.date)}</b><small className="block-muted">{displayTime(a.start)}–{displayTime(addMinutes(a.start,a.duration))}</small></div>},
        {key:'patient',label:'Patient',render:a=>patientName(a.patientId,state.patients)},
        {key:'service',label:'Service'},{key:'dentist',label:'Dentist',render:a=>dentistName(a.dentistId,state.dentists)},
        {key:'status',label:'Status',render:a=><Status>{a.status}</Status>},
        {key:'actions',label:'Actions',render:a=><div className="row-actions">{['Confirmed','Pending'].includes(a.status)&&<><Button size="sm" variant="soft" onClick={()=>setReschedule(a)}>Reschedule</Button><Button size="sm" variant="ghost" onClick={()=>cancel(a)}>Cancel</Button></>}</div>}
      ]}/>
    </Card>
    <Modal open={newOpen} title="Create appointment" subtitle="New staff bookings use the same Smart Scheduling validation." wide onClose={()=>setNewOpen(false)}><AppointmentForm role="staff" store={store} onSaved={()=>setNewOpen(false)}/></Modal>
    <Modal open={!!reschedule} title="Reschedule appointment" subtitle="The new time must pass the same conflict-prevention rules as a new booking." wide onClose={()=>setReschedule(null)}>{reschedule&&<AppointmentForm role={role} store={store} ignoreId={reschedule.id} prefill={reschedule} submitLabel="Validate & save new slot" onSaved={()=>setReschedule(null)}/>}</Modal>
  </>
}

export function SchedulePage({ store }) {
  const { state }=store
  const did=(store.session||sessionForRole('dentist',state)).dentistId
  const [date,setDate]=useState(clinicDate)
  const rows=state.appointments.filter(a=>a.dentistId===did&&a.date===date&&a.status!=='Cancelled').sort((a,b)=>a.start.localeCompare(b.start))
  return <>
    <PageHeader title="My Clinical Schedule" text="Dentist-facing schedule showing validated appointments and expected visit durations." modules={[3,6,7]} aside={<input className="compact-date" type="date" value={date} onChange={e=>setDate(e.target.value)}/>}/>
    <Card title={`${dateLabel(date)} schedule`}>
      <div className="day-schedule">{rows.length?rows.map(a=><div className="schedule-slot" key={a.id}><div className="schedule-time"><b>{displayTime(a.start)}</b><small>{a.duration} min</small></div><div className="schedule-line"/><div className="schedule-visit"><div><strong>{patientName(a.patientId,state.patients)}</strong><span>{a.service}</span><small>{a.branch} • {a.notes||'No booking note'}</small></div><Status>{a.status}</Status></div></div>):<Notice>No appointments are scheduled for this date.</Notice>}</div>
    </Card>
  </>
}
