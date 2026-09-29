import { useVisibleRefresh } from '../use-visible-refresh.js'
import React, { useEffect, useId, useRef, useState } from 'react'
import { Button, Card, ConfirmDialog, Empty, Field, Modal, Notice, PageHeader, Status, Tabs } from '../components.jsx'
import { addDays, clinicDate } from '../clock.js'
import { dateLabel, displayTime } from '../logic.js'
import { commandKey } from '../appointments-api.js'
import { useDayAvailability } from '../booking-availability.js'
import {
  appointmentActionState, appointmentGroups, dentistLabel, hmoCaseView, hmoForAppointment, invoiceView, patientContext, patientFollowups,
  patientInvoices, patientQueueView, patientVisitDetail, queueSentence, resolveTarget,
} from '../patient-view.js'
import { ChoiceGroup, DefinitionList, RecordCard } from '../patient-ui.jsx'

const NO_ACCOUNT=<Notice tone="warning" title="We couldn’t confirm your account">Reopen your workspace, or ask the clinic to check your account access.</Notice>

// Patient reschedule (M6, server-authoritative). Only the date and time change — branch, service and Dentist stay the
// same, and the server enforces that. Times come from GET /availability for this appointment (the server limits it to
// the same Dentist and the Patient booking window); the reschedule command validates everything again and returns
// 409 if the appointment changed meanwhile.
export function PatientReschedule({ store, appointment, onDone }) {
  const { state, toast }=store
  const base=useId(), heading=useRef(null)
  const key=useRef(commandKey())
  const [date,setDate]=useState(appointment.date>clinicDate()?appointment.date:addDays(clinicDate(),1))
  const [start,setStart]=useState('')
  const [failure,setFailure]=useState(null)
  const [saving,setSaving]=useState(false)
  const day=useDayAvailability({branchId:appointment.branchId,serviceId:appointment.serviceId,date,ignoreAppointmentId:appointment.id})
  const rules=day.rules
  const choose=(nextDate,nextStart)=>{key.current=commandKey();setFailure(null);setDate(nextDate);setStart(nextStart)}
  const save=async()=>{
    setSaving(true);setFailure(null)
    const result=await store.appointmentFlow.reschedule(appointment,{date,start},key.current)
    setSaving(false)
    if(!result.ok){setFailure(result);toast(result.message,'warning');key.current=commandKey();if(result.kind==='conflict')day.reload();return}
    toast('Appointment rescheduled.','success');onDone?.(result.record)
  }
  return <div className="pt-scheduler is-modal">
    <div className="pt-scheduler-main">
      <section className="pt-stage" aria-labelledby={`${base}-title`}>
        <div className="pt-stage-copy"><p className="pt-eyebrow">Reschedule</p><h2 id={`${base}-title`} ref={heading} tabIndex={-1}>Pick a new date and time</h2>
          <p>Rescheduling changes only the date and time. Branch, service and Dentist stay the same as your original appointment.</p></div>
        <Field label="Appointment date" hint={rules?.lastDate?`You can book online from ${dateLabel(rules.firstDate)} through ${dateLabel(rules.lastDate)}.`:undefined}>
          <input type="date" min={rules?.firstDate||addDays(clinicDate(),1)} max={rules?.lastDate||undefined} value={date} onChange={event=>choose(event.target.value,'')}/></Field>
        {day.status==='loading'&&<p className="pt-hint" role="status">Loading available times…</p>}
        {day.status==='error'&&<Notice tone="warning" title="Availability couldn’t be loaded">{day.error} <Button size="sm" variant="ghost" onClick={day.reload}>Try again</Button></Notice>}
        {day.status==='ready'&&(day.slots.length
          ?<ChoiceGroup legend={`Available times on ${dateLabel(date)}`} name={`${base}-time`} variant="slots" value={start} onChange={value=>choose(date,value)} options={day.slots.map(t=>({value:t.start,label:displayTime(t.start)}))}/>
          :<Notice tone="warning" title="No open times">There are no open times with your Dentist on {dateLabel(date)}. Try another date.</Notice>)}
        {failure&&<Notice tone="danger" title="This time couldn’t be saved">{failure.message}</Notice>}
        <div className="pt-stage-footer"><span/><Button icon="checkin" onClick={save} disabled={!start||saving}>{saving?'Saving…':'Save new time'}</Button></div>
      </section>
    </div>
    <aside className="pt-summary" aria-label="Your visit"><h2 className="pt-card-label">Your visit</h2><DefinitionList items={[
      {label:'Current time',value:`${dateLabel(appointment.date)} · ${displayTime(appointment.start)}`},
      {label:'Branch',value:state.branches.find(b=>b.id===appointment.branchId)?.name},{label:'Service',value:appointment.service},{label:'Dentist',value:appointment.dentistName||null},
      {label:'New time',value:start?`${dateLabel(date)} · ${displayTime(start)}`:null},
    ]}/></aside>
  </div>
}

// Payment fields come only from an actual linked, evidence-consistent Payment (`invoiceView`'s `receipt`) — never a
// payment preference, and never shown at all unless a legitimate invoice for this exact visit exists.
function paymentSummary(state,session,a) {
  if(a.status!=='Completed')return null
  const invoiceId=patientVisitDetail(state,session,a)?.links?.invoice
  if(!invoiceId)return null
  const invoice=patientInvoices(state,session).find(i=>i.id===invoiceId)
  if(!invoice)return null
  const view=invoiceView(state,invoice)
  return {status:view.status,method:view.receipt?.method||null,invoiceId}
}

function AppointmentCard({ a, state, session, highlight, onReschedule, onCancel, setPage }) {
  const rules=appointmentActionState(a), hmo=hmoForAppointment(state,session,a)
  const detail=a.status==='Completed'?patientVisitDetail(state,session,a):null
  const payment=paymentSummary(state,session,a)
  const links=detail?[['prescription','prescriptions','View prescription',id=>({entityId:id})],['invoice','billing','View invoice or receipt',id=>({entityId:id})],['followup','followups','View follow-up',id=>({entityId:id})],['hmo','hmo','View HMO case',id=>({hmoCaseId:id})]].filter(([key])=>detail.links[key]):[]
  const live=a.date===clinicDate()&&['Checked In','In Treatment'].includes(a.status)
  return <RecordCard id={`appt-${a.id}`} highlight={highlight} title={a.service} subtitle={`${dateLabel(a.date)} • ${displayTime(a.start)} • ${a.branch}`} status={a.status}
    actions={<>
      {live&&<Button size="sm" variant="soft" icon="queue" onClick={()=>setPage?.('queue')}>View live queue</Button>}
      {hmo&&<Button size="sm" variant="ghost" icon="shield" onClick={()=>setPage?.('hmo',{hmoCaseId:hmo.id})}>HMO case: {hmoCaseView(hmo).label}</Button>}
      {rules.canReschedule&&<Button size="sm" variant="soft" onClick={()=>onReschedule(a)}>Reschedule</Button>}
      {rules.canCancel&&<Button size="sm" variant="danger" onClick={()=>onCancel(a)}>Cancel appointment</Button>}
    </>}>
    <DefinitionList items={[{label:'Dentist',value:a.dentistName||dentistLabel(state,a.dentistId)},{label:'Expected duration',value:a.duration?`${a.duration} minutes`:null},{label:'Reference',value:a.appointmentNo},{label:'Your note',value:a.notes}]}/>
    {rules.reason&&<p className="pt-hint">{rules.reason}</p>}
    {detail&&<details className="pt-details"><summary>Visit details</summary>
      <DefinitionList items={[{label:'Procedure',value:detail.procedure},{label:'Services',value:detail.services.join(', ')},{label:'Dentist',value:detail.dentist},
        {label:'Payment status',value:payment?.status},{label:'Payment method',value:payment?.status==='Paid'?payment.method:null}]}/>
      {links.length>0&&<div className="row-actions">{links.map(([key,page,label,context])=><Button key={key} size="sm" variant="ghost" onClick={()=>setPage?.(page,context(detail.links[key]))}>{label}</Button>)}</div>}
    </details>}
  </RecordCard>
}

export function PatientAppointmentsPage({ store, setPage, context }) {
  const { state, actions, toast }=store, session=store.session
  const groups=appointmentGroups(state,session), target=resolveTarget(state,session,'appointments',context)
  const targetTab=target?(groups.upcoming.some(a=>a.id===target)?'upcoming':groups.past.some(a=>a.id===target)?'past':'cancelled'):null
  const [tab,setTab]=useState(targetTab||'upcoming')
  const [reschedule,setReschedule]=useState(null)
  const [cancelling,setCancelling]=useState(null) // appointment | null
  const [busy,setBusy]=useState(false)
  useEffect(()=>{if(targetTab)setTab(targetTab)},[targetTab,target])
  if(!patientContext(state,session))return NO_ACCOUNT
  const rows=groups[tab]
  const startCancel=a=>setCancelling(a)
  // Server cancel command with the revision the Patient saw; a stale revision refreshes the list and asks them to review.
  const confirmCancel=async()=>{
    const a=cancelling;setCancelling(null);setBusy(true)
    const result=await store.appointmentFlow.cancel(a,commandKey())
    setBusy(false)
    if(result.ok&&result.warning)toast(result.warning,'warning')
    toast(result.ok?'Appointment cancelled.':result.message,result.ok?'success':'warning')
  }
  return <div className="pt-page">
    <PageHeader kicker="Your visits" title="Visits" text="Your upcoming, past and cancelled visits across all clinic branches."/>
    <AppointmentsLoadState store={store}/>
    <Tabs active={tab} onChange={setTab} tabs={[{key:'upcoming',label:'Upcoming',count:groups.upcoming.length},{key:'past',label:'Past',count:groups.past.length},{key:'cancelled',label:'Cancelled',count:groups.cancelled.length}]}/>
    <div className="pt-list" aria-live="polite" aria-busy={busy||undefined}>{rows.length?rows.map(a=><AppointmentCard key={a.id} a={a} state={state} session={session} highlight={target===a.id} onReschedule={setReschedule} onCancel={startCancel} setPage={setPage}/>):<Empty title={`No ${tab} visits`} text={tab==='upcoming'?'When you book a visit from Book, it appears here.':'There are no visits in this section.'}/>}</div>
    <Modal open={!!reschedule} title="Reschedule appointment" subtitle="Your new time must pass the same availability checks as a new booking." wide onClose={()=>setReschedule(null)}>{reschedule&&<PatientReschedule store={store} appointment={reschedule} onDone={()=>setReschedule(null)}/>}</Modal>
    <ConfirmDialog open={!!cancelling} title="Cancel this appointment?" confirmLabel="Cancel appointment" cancelLabel="Keep appointment" tone="danger" onConfirm={confirmCancel} onCancel={()=>setCancelling(null)}>
      {cancelling&&<><p><b>{cancelling.service}</b></p><p>{dateLabel(cancelling.date)} at {displayTime(cancelling.start)} with {cancelling.dentistName||dentistLabel(state,cancelling.dentistId)} • {cancelling.branch}</p><p>The reserved time will be released.</p></>}
    </ConfirmDialog>
  </div>
}

export function PatientQueuePage({ store, setPage }) {
  // M9: the Patient's own queue state comes from the server; refresh every 30 s while this page is visible.
  useVisibleRefresh(store.appointmentFlow?.refresh,{active:!!store.session})
  const q=patientQueueView(store.state,store.session)
  if(!q)return NO_ACCOUNT
  let body
  if(q.phase==='none')body=<div><Empty title="No visit today" text="When you have a visit today, its status appears here."/><div className="row-actions"><Button variant="soft" icon="calendar" onClick={()=>setPage?.('appointments')}>View appointments</Button><Button icon="plusCalendar" onClick={()=>setPage?.('book')}>Book a visit</Button></div></div>
  else if(q.phase==='not-checked-in')body=<Card title="You haven’t been checked in yet" subtitle="Your visit today"><DefinitionList items={[{label:'Service',value:q.appointment.service},{label:'Scheduled time',value:displayTime(q.appointment.start)},{label:'Dentist',value:q.appointment.dentist},{label:'Branch',value:q.appointment.branch}]}/><Notice>The clinic records your arrival when you check in at the front desk. Your place in line appears here after that.</Notice></Card>
  else body=<Card title="Your visit today" subtitle={q.branch}>
    <div className="pt-queue-live" role="status" aria-live="polite" aria-atomic="true">
      <Status>{q.status}</Status>
      <p className="pt-queue-sentence">{queueSentence(q)}</p>
      {q.waitMinutes!=null&&<p>Estimated wait: about {q.waitMinutes} min.</p>}
    </div>
    {q.position&&<div className="pt-queue-number" aria-hidden="true">#{q.position}</div>}
    <DefinitionList items={[{label:'Queue number',value:q.queueNumber?String(q.queueNumber):null},{label:'Dentist',value:q.dentist},{label:'Service',value:q.service},{label:'Branch',value:q.branch},{label:'Checked in',value:q.checkedIn?displayTime(q.checkedIn):null}]}/>
    <Notice>Only your own place in line is shown. It updates as the clinic moves the queue.</Notice>
  </Card>
  return <div className="pt-page"><PageHeader kicker="Today" title="Live queue" text="Where you are at the clinic today."/>{body}</div>
}

// Server appointment loading status for Patient lists: honest loading/error states, never an empty list presented as fact.
export function AppointmentsLoadState({ store }) {
  if(store.appointmentsStatus==='loading')return <p className="pt-hint" role="status">Loading your visits…</p>
  if(store.appointmentsStatus==='error')return <Notice tone="warning" title="Your visits couldn’t be loaded">{store.appointmentsError} <Button size="sm" variant="ghost" onClick={()=>store.appointmentFlow?.refresh()}>Try again</Button></Notice>
  return null
}

const FOLLOWUP_NOTE={Open:'Your Dentist recommended a return visit. It isn’t scheduled yet.',Scheduled:'Your follow-up visit is scheduled.',Completed:'This follow-up visit is complete.','Needs clinic review':'The clinic needs to review this record before it can be scheduled.'}
export function PatientFollowupsPage({ store, setPage, context }) {
  const { state }=store, session=store.session
  if(!patientContext(state,session))return NO_ACCOUNT
  const items=patientFollowups(state,session), target=resolveTarget(state,session,'followups',context)
  return <div className="pt-page">
    <PageHeader kicker="Your care" title="Follow-up care" text="Your Dentist decides when a return visit is needed. The clinic then schedules it with you."/>
    <div className="pt-list">{items.length?items.map(({record:f,display,appointment})=><RecordCard key={f.id} id={`followup-${f.id}`} highlight={target===f.id} title={f.reason||'Follow-up visit'} subtitle={`Requested by ${dentistLabel(state,f.dentistId)}`} status={display==='Open'?'Awaiting Scheduling':display}
      actions={<>{appointment&&<Button size="sm" variant="ghost" onClick={()=>setPage?.('appointments',{entityId:appointment.id})}>View appointment</Button>}</>}>
      <p className="pt-hint">{FOLLOWUP_NOTE[display]||''}</p>
      {display==='Open'&&<p className="pt-hint">The clinic schedules Dentist-requested follow-ups with your Dentist. Contact the clinic to arrange this visit; follow-ups can’t be booked online.</p>}
      <DefinitionList items={[{label:'Recommended date',value:f.recommendedDate?dateLabel(f.recommendedDate):null},{label:'Recommended interval',value:f.interval},{label:'Scheduled visit',value:appointment?`${dateLabel(appointment.date)} · ${displayTime(appointment.start)} at ${appointment.branch}`:null}]}/>
    </RecordCard>):<Empty title="No follow-up visits" text="If your Dentist recommends a return visit, it appears here."/>}</div>
  </div>
}
