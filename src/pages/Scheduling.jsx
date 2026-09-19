import React, { useMemo, useState } from 'react'
import { ROLE_INFO, SERVICES, TODAY } from '../data.js'
import { Button, Card, Field, Modal, Notice, PageHeader, Status, Table } from '../components.jsx'
import { addMinutes, dateLabel, dentistName, displayTime, patientName, serviceInfo, uid, validateAppointment } from '../logic.js'

function appointmentFormDefaults(state, prefill={}) {
  const patientId=prefill.patientId || ROLE_INFO.patient.patientId
  const patient=state.patients.find(p=>p.id===patientId)
  const branch=prefill.branch || patient?.preferredBranch || state.branches[0]?.name || 'Branch A'
  const dentist=state.dentists.find(d=>d.branches.includes(branch)&&d.available) || state.dentists[0]
  const service=prefill.service || 'Dental Consultation'
  return { patientId, branch, dentistId:prefill.dentistId||dentist?.id||'', service, date:prefill.date||TODAY, start:prefill.start||'10:00', duration:serviceInfo(service).duration, notes:prefill.notes||'', source:prefill.source||'Portal' }
}

export function AppointmentForm({ role, store, prefill={}, ignoreId=null, onSaved, submitLabel='Validate & Confirm Appointment' }) {
  const { state, setters, toast, log, workflow, notify }=store
  const [form,setForm]=useState(()=>appointmentFormDefaults(state,prefill))
  const [result,setResult]=useState(null)
  const [step,setStep]=useState('edit')
  const update=(name,value)=>{
    const next={...form,[name]:value}
    if (name==='service') next.duration=serviceInfo(value).duration
    if (name==='branch') {
      const d=state.dentists.find(x=>x.branches.includes(value)&&x.available)
      if (d) next.dentistId=d.id
    }
    setForm(next); setResult(null); setStep('edit')
  }
  const validate=()=>{const r=validateAppointment(form,state,ignoreId); setResult(r); setStep('validated'); return r}
  const save=()=>{
    const r=validateAppointment(form,state,ignoreId)
    setResult(r); setStep('validated')
    if (!r.valid) { toast('The requested slot is not valid. Choose an alternative or correct the request.','warning'); return }
    const branchId=state.branches.find(b=>b.name===form.branch)?.id||null;const existing=ignoreId?state.appointments.find(a=>a.id===ignoreId):null;const appointmentNo=existing?.appointmentNo||`APT-${form.date.slice(0,4)}-${String(state.appointments.length+1).padStart(4,'0')}`;const record={ id:ignoreId||uid('a'), appointmentNo, branchId, scheduledStart:`${form.date}T${form.start}`, ...form, duration:r.duration, status:'Confirmed', source:role==='patient'?'Patient Portal':'Front Desk' }
    if (ignoreId) setters.setAppointments(xs=>xs.map(a=>a.id===ignoreId?record:a))
    else setters.setAppointments(xs=>[...xs,record])
    const name=patientName(form.patientId,state.patients)
    notify(form.patientId,ignoreId?'Appointment Rescheduled':'Appointment Confirmation',`${name}, your ${form.service} appointment is confirmed for ${dateLabel(form.date)} at ${displayTime(form.start)} in ${form.branch}.`,'Portal')
    workflow('M6→M7',ignoreId?'Appointment rescheduled':'Appointment created',`${form.branch} • ${dentistName(form.dentistId,state.dentists)} • ${displayTime(form.start)}`)
    log(role==='patient'?name:ROLE_INFO.staff.name,ignoreId?'Rescheduled appointment':'Created appointment','M6')
    toast(ignoreId?'Appointment rescheduled after smart scheduling validation.':'Appointment created and slot reserved.','success')
    onSaved?.(record)
  }
  const availableDentists=state.dentists.filter(d=>d.branches.includes(form.branch))
  return <div className="booking-layout">
    <form className="form-grid" onSubmit={e=>{e.preventDefault();save()}}>
      {role!=='patient'&&<Field label="Patient" required><select value={form.patientId} onChange={e=>update('patientId',e.target.value)}>{state.patients.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
      <Field label="Branch" required><select value={form.branch} onChange={e=>update('branch',e.target.value)}>{state.branches.map(b=><option key={b.id} value={b.name}>{b.name} • {b.status}</option>)}</select></Field>
      <Field label="Service" required><select value={form.service} onChange={e=>update('service',e.target.value)}>{SERVICES.map(s=><option key={s.name} value={s.name}>{s.name} • {s.duration} min</option>)}</select></Field>
      <Field label="Dentist" required><select value={form.dentistId} onChange={e=>update('dentistId',e.target.value)}>{availableDentists.map(d=><option key={d.id} value={d.id}>{d.name} • {d.specialty}</option>)}</select></Field>
      <Field label="Date" required><input type="date" value={form.date} min={TODAY} onChange={e=>update('date',e.target.value)}/></Field>
      <Field label="Start time" required><input type="time" value={form.start} onChange={e=>update('start',e.target.value)}/></Field>
      <Field label="Expected duration"><input value={`${form.duration} minutes`} disabled/></Field>
      <Field label="Notes"><input value={form.notes} placeholder="Optional booking note" onChange={e=>update('notes',e.target.value)}/></Field>
      <div className="form-actions span-2"><Button type="button" variant="ghost" onClick={validate}>Check Slot</Button><Button type="submit">{submitLabel}</Button></div>
    </form>
    <div className="validation-card">
      <div className="validation-title"><b>Smart Scheduling validation</b><span>Module 7</span></div>
      {!result&&<Notice tone="info">The system will verify branch status and hours, service availability, dentist assignment and shift, and overlapping appointments before confirmation.</Notice>}
      {result&&<>
        <div className="check-list">{result.checks.map(c=><div key={c.key} className={`check-row ${c.ok?'ok':'bad'}`}><span>{c.ok?'✓':'!'}</span><div><b>{c.label}</b><small>{c.detail}</small></div></div>)}</div>
        {result.valid?<Notice tone="success" title="Valid slot">All scheduling checks passed. The appointment can be confirmed safely.</Notice>:<Notice tone="warning" title="Requested slot blocked">Select one of the available alternatives or change the branch, dentist, date, or service.</Notice>}
        {!result.valid&&result.alternatives.length>0&&<div className="alternatives"><small>Suggested conflict-free alternatives</small><div className="chip-row">{result.alternatives.map(t=><button type="button" className="chip" key={t} onClick={()=>update('start',t)}>{displayTime(t)}</button>)}</div></div>}
      </>}
    </div>
  </div>
}

export function BookingPage({ role, store }) {
  return <>
    <PageHeader title="Book an Appointment" text="Appointment requests are validated against branch configuration, service availability, dentist assignments and shifts, and existing bookings before confirmation." modules={[6,7]}/>
    <Card title="Appointment request" subtitle="Production-oriented frontend behavior using demo data"><AppointmentForm role={role} store={store}/></Card>
  </>
}

export function AppointmentsPage({ role, store }) {
  const { state, setters, toast, log, workflow, notify }=store
  const [reschedule,setReschedule]=useState(null)
  const [newOpen,setNewOpen]=useState(false)
  const pid=ROLE_INFO.patient.patientId
  const visible=state.appointments.filter(a=>role==='patient'?a.patientId===pid:true).sort((a,b)=>`${b.date}${b.start}`.localeCompare(`${a.date}${a.start}`))
  const cancel=a=>{
    if (!window.confirm('Cancel this appointment and release the reserved slot?')) return
    setters.setAppointments(xs=>xs.map(x=>x.id===a.id?{...x,status:'Cancelled'}:x))
    notify(a.patientId,'Appointment Cancellation',`Your ${a.service} appointment on ${dateLabel(a.date)} at ${displayTime(a.start)} has been cancelled.`)
    workflow('M6','Appointment cancelled',`Slot released • ${a.branch} • ${displayTime(a.start)}`)
    log(role==='patient'?patientName(a.patientId,state.patients):ROLE_INFO.staff.name,'Cancelled appointment','M6')
    toast('Appointment cancelled and slot released.','success')
  }
  return <>
    <PageHeader title={role==='patient'?'My Appointments':'Appointment Management'} text="Create, confirm, reschedule, cancel, and track appointment status while preserving Smart Scheduling validation." modules={[6,7]}/>
    <Card title="Appointment calendar" actions={role==='staff'?<Button onClick={()=>setNewOpen(true)}>New Appointment</Button>:null}>
      <Table rows={visible} columns={[
        {key:'appointmentNo',label:'Appointment no.',render:a=>a.appointmentNo||a.id},
        {key:'date',label:'Date & Time',render:a=><div><b>{dateLabel(a.date)}</b><small className="block-muted">{displayTime(a.start)}–{displayTime(addMinutes(a.start,a.duration))}</small></div>},
        ...(role!=='patient'?[{key:'patient',label:'Patient',render:a=>patientName(a.patientId,state.patients)}]:[]),
        {key:'service',label:'Service'},{key:'branch',label:'Branch'},{key:'dentist',label:'Dentist',render:a=>dentistName(a.dentistId,state.dentists)},
        {key:'status',label:'Status',render:a=><Status>{a.status}</Status>},
        {key:'actions',label:'Actions',render:a=><div className="row-actions">{a.status!=='Cancelled'&&<><Button size="sm" variant="ghost" onClick={()=>setReschedule(a)}>Reschedule</Button><Button size="sm" variant="danger" onClick={()=>cancel(a)}>Cancel</Button></>}</div>}
      ]}/>
    </Card>
    <Modal open={newOpen} title="Create appointment" subtitle="New staff bookings use the same Smart Scheduling validation." wide onClose={()=>setNewOpen(false)}><AppointmentForm role="staff" store={store} onSaved={()=>setNewOpen(false)}/></Modal>
    <Modal open={!!reschedule} title="Reschedule appointment" subtitle="The new time must pass the same conflict-prevention rules as a new booking." wide onClose={()=>setReschedule(null)}>
      {reschedule&&<AppointmentForm role={role} store={store} ignoreId={reschedule.id} prefill={reschedule} submitLabel="Validate & Save New Slot" onSaved={()=>setReschedule(null)}/>} 
    </Modal>
  </>
}

export function SchedulePage({ store }) {
  const { state }=store
  const did=ROLE_INFO.dentist.dentistId
  const [date,setDate]=useState(TODAY)
  const rows=state.appointments.filter(a=>a.dentistId===did&&a.date===date&&a.status!=='Cancelled').sort((a,b)=>a.start.localeCompare(b.start))
  return <>
    <PageHeader title="My Clinical Schedule" text="Dentist-facing schedule showing validated appointments and expected visit durations." modules={[3,6,7]} aside={<input className="compact-date" type="date" value={date} onChange={e=>setDate(e.target.value)}/>}/>
    <Card title={`${dateLabel(date)} schedule`}>
      <div className="day-schedule">{rows.length?rows.map(a=><div className="schedule-slot" key={a.id}><div className="schedule-time"><b>{displayTime(a.start)}</b><small>{a.duration} min</small></div><div className="schedule-line"/><div className="schedule-visit"><div><strong>{patientName(a.patientId,state.patients)}</strong><span>{a.service}</span><small>{a.branch} • {a.notes||'No booking note'}</small></div><Status>{a.status}</Status></div></div>):<Notice>No appointments are scheduled for this date.</Notice>}</div>
    </Card>
  </>
}
