import React, { useEffect, useRef, useState } from 'react'
import { Button, Card, ConfirmDialog, Field, Modal, Notice, PageHeader, Status, Table } from '../components.jsx'
import { addMinutes, dateLabel, dentistName, displayTime, patientName } from '../logic.js'
import { clinicDate } from '../clock.js'
import { commandKey } from '../appointments-api.js'
import { publicPatientIdFor } from '../appointment-projection.js'
import { useDayAvailability } from '../booking-availability.js'
import { dentistsFor, servicesAt } from '../scheduling.js'
import { PatientAppointmentsPage } from './PatientVisits.jsx'
import { PatientBookingPage } from './PatientBook.jsx'
import { inScope, sessionForRole } from '../contracts.js'

// Staff/Owner appointment form (M6, server-authoritative). Used for a new front-desk booking, a reschedule, and a
// Dentist-requested follow-up. The Patient comes from the server Patient directory (public_id), branches are limited to
// the account's server authorization scopes (Owner: every open branch), start times come from server availability on the
// 30-minute Staff grid, and the server validates and assigns on confirm. Nothing here writes an appointment locally.
function bookableBranches(state,session){
  const open=state.branches.filter(b=>b.status==='Open')
  if(session?.role==='staff')return open.filter(b=>Array.isArray(session.branchScopes)?session.branchScopes.includes(b.id):b.id===session.branchId)
  return open
}

export function AppointmentForm({ role, store, appointment=null, followup=null, onSaved, submitLabel='Confirm appointment' }) {
  const { state, toast }=store
  const session=store.session||sessionForRole(role,state)
  const key=useRef(commandKey())
  const branches=bookableBranches(state,session)
  const followupPatient=followup?publicPatientIdFor(followup.patientId,{session,users:state.users,patients:state.patients}):null
  const [form,setFormState]=useState(()=>{
    if(appointment)return {patientPublicId:appointment.patientPublicId,branchId:appointment.branchId,serviceId:appointment.serviceId,dentistId:appointment.dentistId,date:appointment.date>=clinicDate()?appointment.date:clinicDate(),start:'',notes:''}
    if(followup)return {patientPublicId:followupPatient,branchId:followup.branchId,serviceId:'',dentistId:followup.dentistId,date:followup.recommendedDate&&followup.recommendedDate>=clinicDate()?followup.recommendedDate:clinicDate(),start:'',notes:followup.reason||''}
    return {patientPublicId:'',branchId:branches[0]?.id||'',serviceId:'',dentistId:'',date:clinicDate(),start:'',notes:''}
  })
  const [search,setSearch]=useState('')
  const [failure,setFailure]=useState(null)
  const [saving,setSaving]=useState(false)
  const setForm=next=>{key.current=commandKey();setFailure(null);setFormState(next)}
  const update=(name,value)=>setForm(previous=>{
    const next={...previous,[name]:value}
    if(name==='branchId'){next.serviceId='';next.dentistId=followup?previous.dentistId:'';next.start=''}
    if(name==='serviceId'){next.dentistId=followup||appointment?previous.dentistId:'';next.start=''}
    if(['date','dentistId'].includes(name))next.start=''
    return next
  })
  useEffect(()=>{if(!appointment&&!followup&&search.trim().length>=2){const t=setTimeout(()=>store.appointmentFlow?.searchPatients(search),250);return ()=>clearTimeout(t)}},[search])

  const services=servicesAt(state,form.branchId)
  const dentists=form.serviceId?dentistsFor(state,form.branchId,form.serviceId):[]
  const lockedDentist=!!followup
  const day=useDayAvailability({branchId:form.branchId,serviceId:form.serviceId,date:form.date,patientPublicId:form.patientPublicId||null,
    ignoreAppointmentId:appointment?.id||null,dentistId:form.dentistId||null,enabled:!!form.serviceId})
  const directory=(store.directoryPatients||[]).filter(p=>!search.trim()||`${p.name} ${p.patientCode} ${p.phone}`.toLowerCase().includes(search.trim().toLowerCase()))
  const selectedPatient=(store.directoryPatients||[]).find(p=>p.id===form.patientPublicId)

  if(followup&&(followup.legacyAppointment||!followupPatient))return <Notice tone="warning" title="This follow-up can’t be booked here">
    {followup.legacyAppointment?'This follow-up belongs to historical demo records and is read-only.':'This Patient has no clinic account record on the server yet, so a server appointment can’t be created for them. Register the Patient first.'}
  </Notice>

  const save=async()=>{
    setSaving(true);setFailure(null)
    const result=appointment
      ?await store.appointmentFlow.reschedule(appointment,{date:form.date,start:form.start,dentistId:form.dentistId&&form.dentistId!==appointment.dentistId?form.dentistId:null},key.current)
      :await store.appointmentFlow.create({branchId:form.branchId,serviceId:form.serviceId,date:form.date,start:form.start,notes:form.notes||null,patientPublicId:form.patientPublicId,dentistId:form.dentistId||null},{key:key.current,followupId:followup?.id||null})
    setSaving(false)
    if(!result.ok){
      setFailure(result);toast(result.message,'warning')
      if(result.kind==='conflict'||result.kind==='validation'){key.current=commandKey();day.reload()}
      return
    }
    if(result.warning)toast(result.warning,'warning')
    toast(appointment?'Appointment rescheduled.':followup?'Follow-up appointment scheduled.':'Appointment confirmed.','success')
    onSaved?.(result.record)
  }
  const canSave=!!form.patientPublicId&&!!form.branchId&&!!form.serviceId&&!!form.date&&!!form.start&&!saving

  return <div className="booking-layout">
    <form className="form-grid" onSubmit={e=>{e.preventDefault();if(canSave)save()}}>
      {appointment||followup
        ?<Field label="Patient"><input value={appointment?`${appointment.patientName||patientName(appointment.patientId,state.patients)} • ${appointment.patientCode||''}`:patientName(followup.patientId,state.patients)} disabled/></Field>
        :<>
          <Field label="Find patient" hint="Search the clinic Patient directory by name, code or phone."><input value={search} placeholder="Type at least 2 characters" onChange={e=>setSearch(e.target.value)}/></Field>
          <Field label="Patient" required><select value={form.patientPublicId} onChange={e=>update('patientPublicId',e.target.value)}>
            <option value="">Select a patient</option>
            {directory.map(p=><option key={p.id} value={p.id}>{p.name} • {p.patientCode}{p.phone?` • ${p.phone}`:''}</option>)}
          </select></Field>
        </>}
      <Field label="Branch" required><select disabled={!!appointment||!!followup} value={form.branchId} onChange={e=>update('branchId',e.target.value)}>
        {!branches.length&&<option value="">No authorized branch</option>}
        {(appointment||followup?state.branches.filter(b=>b.id===form.branchId):branches).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
      </select></Field>
      <Field label="Service" required><select disabled={!!appointment} value={form.serviceId} onChange={e=>update('serviceId',e.target.value)}>
        <option value="">Select a service</option>
        {(appointment?state.services.filter(s=>s.id===appointment.serviceId):services).map(s=><option key={s.id} value={s.id}>{s.name} • {s.duration} min</option>)}
      </select></Field>
      <Field label="Dentist" hint={lockedDentist?'The requesting Dentist.':'Leave on automatic to let the clinic assign an eligible Dentist.'}>
        <select disabled={lockedDentist} value={form.dentistId} onChange={e=>update('dentistId',e.target.value)}>
          {!lockedDentist&&<option value="">Assign automatically</option>}
          {(lockedDentist?state.dentists.filter(d=>d.id===form.dentistId):dentists).map(d=><option key={d.id} value={d.id}>{d.name} • {d.specialty}</option>)}
        </select></Field>
      <Field label="Date" required><input type="date" value={form.date} min={clinicDate()} onChange={e=>update('date',e.target.value)}/></Field>
      <Field label="Notes"><input value={form.notes} disabled={!!appointment} placeholder="Optional booking note" onChange={e=>update('notes',e.target.value)}/></Field>
      <div className="span-2">
        {!form.serviceId?<Notice tone="info">Choose a service to see available start times.</Notice>
          :day.status==='loading'?<p className="block-muted" role="status">Loading available times…</p>
          :day.status==='error'?<Notice tone="warning" title="Availability couldn’t be loaded">{day.error} <Button size="sm" variant="ghost" onClick={day.reload}>Try again</Button></Notice>
          :day.slots.length?<div className="alternatives"><small>Available start times on {dateLabel(form.date)}</small><div className="chip-row" role="group" aria-label="Available start times">
            {day.slots.map(s=><button type="button" key={s.start} className={`chip ${form.start===s.start?'active':''}`} aria-pressed={form.start===s.start} onClick={()=>setForm(previous=>({...previous,start:s.start}))}>{displayTime(s.start)}{!form.dentistId&&s.dentist?` · ${s.dentist}`:''}</button>)}
          </div></div>
          :<Notice tone="warning" title="No open times">No bookable start times on {dateLabel(form.date)}. Try another date{lockedDentist?'':' or Dentist'}.</Notice>}
      </div>
      <div className="form-actions span-2"><Button type="submit" disabled={!canSave}>{saving?'Saving…':submitLabel}</Button></div>
    </form>
    <div className="validation-card">
      <div className="validation-title"><b>Scheduling checks</b><span>Confirmed by the clinic server</span></div>
      {!failure&&<Notice tone="info">Only start times the server can accept are offered. On confirm, the server re-checks branch hours, branch service, Dentist eligibility and shift, and Dentist/Patient conflicts{selectedPatient?` for ${selectedPatient.name}`:''}.</Notice>}
      {failure&&<>
        <Notice tone={failure.kind==='conflict'?'warning':'danger'} title={failure.kind==='conflict'?'Availability changed':'This slot can’t be booked'}>{failure.message}</Notice>
        {!!failure.alternatives?.length&&<div className="alternatives"><small>Other start times on this date</small><div className="chip-row">{failure.alternatives.map(t=><button type="button" className="chip" key={t} onClick={()=>setForm(previous=>({...previous,start:t}))}>{displayTime(t)}</button>)}</div></div>}
      </>}
    </div>
  </div>
}

function AppointmentsStatusNotice({ store }) {
  if(store.appointmentsStatus==='loading')return <p className="block-muted" role="status">Loading appointments from the clinic server…</p>
  if(store.appointmentsStatus==='error')return <Notice tone="warning" title="Appointments couldn’t be loaded">{store.appointmentsError} <Button size="sm" variant="ghost" onClick={()=>store.appointmentFlow?.refresh()}>Try again</Button></Notice>
  if(store.appointmentsTruncated)return <Notice tone="warning">Only the first part of a very large appointment list was loaded. Narrow the view to see everything.</Notice>
  return null
}

export function BookingPage({ role, store, setPage, context }) {
  if(role==='patient')return <PatientBookingPage store={store} setPage={setPage} context={context}/>
  return <><PageHeader kicker="Scheduling" title="Create an appointment" text="Front-desk bookings are validated by the clinic server with the same conflict-prevention rules as patient self-booking."/><Card title="Appointment details"><AppointmentForm role={role} store={store}/></Card></>
}

export function AppointmentsPage({ role, store, setPage, context }) {
  const { state, toast }=store
  const session=store.session||sessionForRole(role,state)
  const [reschedule,setReschedule]=useState(null)
  const [cancelling,setCancelling]=useState(null)
  const [newOpen,setNewOpen]=useState(false)
  if(role==='patient')return <PatientAppointmentsPage store={store} setPage={setPage} context={context}/>
  const visible=state.appointments.filter(a=>inScope(a,session,state)).sort((a,b)=>`${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))
  const cancel=async()=>{
    const a=cancelling;setCancelling(null)
    const result=await store.appointmentFlow.cancel(a,commandKey())
    if(result.ok&&result.warning)toast(result.warning,'warning')
    toast(result.ok?'Appointment cancelled.':result.message,result.ok?'success':'warning')
  }
  return <>
    <PageHeader kicker="Scheduling" title="Appointment management" text="Create, reschedule and cancel visits. Every change is validated and stored by the clinic server." aside={<div className="row-actions"><Button variant="ghost" onClick={()=>store.appointmentFlow.refresh()}>Refresh</Button><Button onClick={()=>setNewOpen(true)} icon="plusCalendar">New appointment</Button></div>}/>
    <AppointmentsStatusNotice store={store}/>
    <Card title="Clinic appointments" subtitle="Appointments in your authorized branches, about three months back and ahead.">
      <Table rows={visible} empty="No appointments in your authorized branches." columns={[
        {key:'appointmentNo',label:'Appointment',render:a=><div><b>{a.appointmentNo}</b><small className="block-muted">{a.source}</small></div>},
        {key:'date',label:'Date & time',render:a=><div><b>{dateLabel(a.date)}</b><small className="block-muted">{displayTime(a.start)}–{displayTime(addMinutes(a.start,a.duration))}</small></div>},
        {key:'patient',label:'Patient',render:a=>a.patientName||patientName(a.patientId,state.patients)},
        {key:'service',label:'Service'},{key:'dentist',label:'Dentist',render:a=>a.dentistName||dentistName(a.dentistId,state.dentists)},
        {key:'status',label:'Status',render:a=><Status>{a.status}</Status>},
        {key:'actions',label:'Actions',render:a=><div className="row-actions">{['Confirmed','Pending'].includes(a.status)&&<><Button size="sm" variant="soft" onClick={()=>setReschedule(a)}>Reschedule</Button><Button size="sm" variant="ghost" onClick={()=>setCancelling(a)}>Cancel</Button></>}</div>}
      ]}/>
    </Card>
    <Modal open={newOpen} title="Create appointment" subtitle="The clinic server validates the slot and assigns an eligible Dentist unless you choose one." wide onClose={()=>setNewOpen(false)}><AppointmentForm role={role} store={store} onSaved={()=>setNewOpen(false)}/></Modal>
    <Modal open={!!reschedule} title="Reschedule appointment" subtitle="The new time must pass the same conflict-prevention rules as a new booking." wide onClose={()=>setReschedule(null)}>{reschedule&&<AppointmentForm role={role} store={store} appointment={reschedule} submitLabel="Save new time" onSaved={()=>setReschedule(null)}/>}</Modal>
    <ConfirmDialog open={!!cancelling} title="Cancel this appointment?" confirmLabel="Cancel appointment" cancelLabel="Keep appointment" tone="danger" onConfirm={cancel} onCancel={()=>setCancelling(null)}>
      {cancelling&&<p>{cancelling.appointmentNo} • {dateLabel(cancelling.date)} at {displayTime(cancelling.start)} • {cancelling.patientName}. The reserved time will be released.</p>}
    </ConfirmDialog>
  </>
}

export function SchedulePage({ store }) {
  const { state }=store
  const did=(store.session||sessionForRole('dentist',state)).dentistId
  const [date,setDate]=useState(clinicDate)
  const rows=state.appointments.filter(a=>a.dentistId===did&&a.date===date&&a.status!=='Cancelled').sort((a,b)=>a.start.localeCompare(b.start))
  return <>
    <PageHeader title="My Clinical Schedule" text="Your appointments from the clinic server, with expected visit durations." aside={<div className="row-actions"><input className="compact-date" type="date" aria-label="Schedule date" value={date} onChange={e=>setDate(e.target.value)}/><Button variant="ghost" onClick={()=>store.appointmentFlow.refresh()}>Refresh</Button></div>}/>
    <AppointmentsStatusNotice store={store}/>
    <Card title={`${dateLabel(date)} schedule`}>
      <div className="day-schedule">{rows.length?rows.map(a=><div className="schedule-slot" key={a.id}><div className="schedule-time"><b>{displayTime(a.start)}</b><small>{a.duration} min</small></div><div className="schedule-line"/><div className="schedule-visit"><div><strong>{a.patientName||patientName(a.patientId,state.patients)}</strong><span>{a.service}</span><small>{a.branch} • {a.notes||'No booking note'}</small></div><Status>{a.status}</Status></div></div>):<Notice>No appointments are scheduled for this date.</Notice>}</div>
    </Card>
  </>
}
