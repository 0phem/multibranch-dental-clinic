import React, { useState, useRef } from 'react'
import { Button, Card, Field, Modal, Notice, PageHeader, Status, Table } from '../components.jsx'
import { addMinutes, dateLabel, dentistName, displayTime, patientName, serviceInfo, uid, validateAppointment } from '../logic.js'

import { clinicDate } from '../clock.js'
import { PatientAppointmentsPage } from './PatientVisits.jsx'
import { PatientBookingPage } from './PatientBook.jsx'
import { inScope, patientInScope, sessionForRole } from '../contracts.js'

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

export function BookingPage({ role, store, setPage, context }) {
  if(role==='patient')return <PatientBookingPage store={store} setPage={setPage} context={context}/>
  return <><PageHeader kicker="Scheduling" title="Create an appointment" text="Staff bookings use the same conflict-prevention and availability rules as patient self-booking."/><Card title="Appointment details"><AppointmentForm role={role} store={store}/></Card></>
}

export function AppointmentsPage({ role, store, setPage, context }) {
  const { state, actions, toast }=store
  const session=store.session||sessionForRole(role,state)
  const [reschedule,setReschedule]=useState(null)
  const [newOpen,setNewOpen]=useState(false)
  const visible=state.appointments.filter(a=>inScope(a,session,state)).sort((a,b)=>`${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))
  const cancel=a=>{
    if (!window.confirm('Cancel this appointment and release the reserved slot?')) return
    const result=actions.cancelAppointment(a.id)
    toast(result.ok?'Appointment cancelled.':result.message,result.ok?'success':'warning')
  }
  if(role==='patient')return <PatientAppointmentsPage store={store} setPage={setPage} context={context}/>
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
