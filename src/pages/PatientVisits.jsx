import React, { useEffect, useId, useRef, useState } from 'react'
import { Button, Card, ConfirmDialog, Empty, Field, Modal, Notice, PageHeader, Status, Tabs } from '../components.jsx'
import { clinicDate, maxBookingDate } from '../clock.js'
import { dateLabel, displayTime, uid } from '../logic.js'
import {
  appointmentActionState, appointmentGroups, dentistLabel, dentistsFor, hmoCaseView, hmoForAppointment, invoiceView, nextScheduleForm, patientContext, patientFollowups,
  patientInvoices, patientQueueView, patientVisitDetail, queueSentence, resolveTarget, scheduleFormDefaults, scheduleSlots, servicesAt, suggestTimes,
} from '../patient-view.js'
import { ChoiceGroup, DefinitionList, RecordCard, Stepper } from '../patient-ui.jsx'

const PAYMENT_LABEL={cash:'Cash — pay at the clinic',card:'Card — payment preference (not yet paid)'}

const NO_ACCOUNT=<Notice tone="warning" title="We couldn’t confirm your account">Reopen your workspace, or ask the clinic to check your account access.</Notice>
const STEPS=['Branch','Service','Dentist','Date & time','Review']
const TITLES=['Which clinic works best for you?','What can we help you with?','Choose your preferred Dentist','Pick a date and time','Review your appointment']

// One scheduler for booking, rescheduling and follow-up scheduling. It offers only what the shared validator
// accepts and saves through the shared saveAppointment command with the same options the existing forms used.
export function PatientScheduler({ store, mode='book', appointment=null, followup=null, inModal=false, onDone, setPage }) {
  const { state, actions, toast }=store
  const session=store.session, base=useId()
  const commandId=useRef(uid('booking')), heading=useRef(null), moved=useRef(false)
  const firstStep=mode==='book'?0:3
  const [form,setForm]=useState(()=>scheduleFormDefaults(state,session,{appointment,followup}))
  const [step,setStep]=useState(firstStep)
  const [reached,setReached]=useState(firstStep)
  const [suggestions,setSuggestions]=useState(null)
  const [error,setError]=useState('')
  const [confirmed,setConfirmed]=useState(null)
  useEffect(()=>{if(moved.current)heading.current?.focus();moved.current=true},[step,confirmed])
  if(!form)return NO_ACCOUNT

  const ignoreId=mode==='reschedule'?appointment.id:null
  // Patient rescheduling changes only Date/Time — Branch, Service and Dentist are always locked (never only
  // when an HMO case happens to be present), matching saveAppointment's authoritative enforcement of the
  // same rule. Follow-up scheduling keeps its existing, separate branch/Dentist lock.
  const rescheduleLocked=mode==='reschedule'
  const lock=mode==='followup'?{branchId:followup.branchId,dentistId:followup.dentistId}:rescheduleLocked?{branchId:appointment.branchId,serviceId:appointment.serviceId,dentistId:appointment.dentistId}:{}
  const branches=state.branches.filter(b=>b.status==='Open'&&(!lock.branchId||b.id===lock.branchId))
  const services=servicesAt(state,form.branchId)
  const dentists=dentistsFor(state,form.branchId,form.serviceId).filter(d=>!lock.dentistId||d.id===lock.dentistId)
  const slots=scheduleSlots(state,form,ignoreId)
  const branch=state.branches.find(b=>b.id===form.branchId), service=state.services.find(s=>s.id===form.serviceId), dentist=state.dentists.find(d=>d.id===form.dentistId)
  const when=form.start?`${dateLabel(form.date)} · ${displayTime(form.start)}`:null
  const gates=[!!branch,!!service&&services.some(s=>s.id===service.id),!!dentist&&dentists.some(d=>d.id===dentist.id),slots.includes(form.start)]
  const blockers=['Choose a branch to continue.','Choose a service to continue.',dentists.length?'Choose a Dentist to continue.':'No Dentist is available for this service at this branch. Try another service or branch.','Choose an available time to continue.']
  const go=index=>{setStep(index);setReached(previous=>Math.max(previous,index))}
  const change=(key,value)=>{setForm(previous=>nextScheduleForm(state,previous,key,value,lock));setSuggestions(null);setError('')}
  const pick=s=>{setForm(previous=>({...previous,dentistId:s.dentistId,start:s.start}));setSuggestions(null);go(4)}
  const reset=()=>{commandId.current=uid('booking');setConfirmed(null);setError('');setForm(scheduleFormDefaults(state,session,{}));setStep(0);setReached(0)}
  const save=()=>{
    const options=mode==='book'?{commandId:commandId.current}:mode==='reschedule'?{appointmentId:appointment.id,commandId:commandId.current,expectedRevision:appointment.revision}:{commandId:commandId.current,followupId:followup.id}
    const result=actions.saveAppointment(form,options)
    if(!result.ok){setError(result.message);toast(result.message,'warning');setStep(3);return}
    setError('')
    if(mode==='book'){toast('Appointment confirmed.','success');setConfirmed(result.record);return}
    toast(mode==='reschedule'?'Appointment rescheduled.':'Follow-up appointment scheduled.','success');onDone?.(result.record)
  }

  if(confirmed)return <section className="pt-success" aria-labelledby={`${base}-done`}>
    <p className="pt-eyebrow">Appointment confirmed</p><h2 id={`${base}-done`} ref={heading} tabIndex={-1}>You’re all set.</h2>
    <p>{service?.name} on {dateLabel(confirmed.date)} at {displayTime(confirmed.start)} in {confirmed.branch}.</p>
    <DefinitionList items={[{label:'Dentist',value:dentistLabel(state,confirmed.dentistId)},{label:'Confirmation',value:confirmed.appointmentNo}]}/>
    <div className="row-actions"><Button icon="calendar" onClick={()=>setPage?.('appointments',{entityId:confirmed.id})}>View my appointments</Button><Button variant="soft" onClick={reset}>Book another visit</Button></div>
  </section>

  const summary=[
    mode==='reschedule'&&{label:'Current time',value:`${dateLabel(appointment.date)} · ${displayTime(appointment.start)}`},
    {label:'Branch',value:branch?.name},{label:'Service',value:service?.name},{label:'Dentist',value:dentist?.name},{label:'New time',value:when},
    // Payment preference is never re-collected on reschedule — it's preserved unchanged from the original booking.
    mode==='reschedule'&&{label:'Payment',value:PAYMENT_LABEL[appointment.paymentMethod]||null},
  ].filter(Boolean)
  const RESCHEDULE_LOCK_NOTE='Rescheduling changes only the date and time. Branch, service and Dentist stay the same as your original appointment.'
  const helpers=[
    rescheduleLocked?RESCHEDULE_LOCK_NOTE:(lock.branchId?'Your Dentist requested this follow-up, so the branch is set.':'You can change branches later if you need a different schedule.'),
    rescheduleLocked?RESCHEDULE_LOCK_NOTE:'Choose the service or visit type you’d like to schedule.',
    rescheduleLocked?RESCHEDULE_LOCK_NOTE:(lock.dentistId?'Your Dentist requested this follow-up, so the Dentist is set.':`Only Dentists at ${branch?.name||'this branch'} who provide ${service?.name||'this service'} are shown.`),
    'Only times that pass the clinic’s availability checks are shown.',
    'Nothing is charged when you book. Billing is based on completed treatment after your visit.',
  ]
  const confirmLabel=mode==='reschedule'?'Save new time':mode==='followup'?'Schedule follow-up':'Confirm appointment'
  return <div className={`pt-scheduler ${inModal?'is-modal':''}`.trim()}>
    <div className="pt-scheduler-main">
      <Stepper label={mode==='book'?'Booking steps':'Scheduling steps'} steps={STEPS} current={step} reached={reached} onSelect={go}/>
      <section className="pt-stage" aria-labelledby={`${base}-title`}>
        <div className="pt-stage-copy"><p className="pt-eyebrow">{`Step ${step+1} of ${STEPS.length}`}</p><h2 id={`${base}-title`} ref={heading} tabIndex={-1}>{TITLES[step]}</h2><p>{helpers[step]}</p></div>
        {step===0&&<ChoiceGroup legend="Branch" name={`${base}-branch`} value={form.branchId} disabled={!!lock.branchId} onChange={value=>change('branchId',value)} options={branches.map(b=>({value:b.id,label:b.name,description:`${b.city} • ${displayTime(b.open)}–${displayTime(b.close)}`}))}/>}
        {step===1&&(services.length?<ChoiceGroup legend="Service" name={`${base}-service`} value={form.serviceId} disabled={!!lock.serviceId} onChange={value=>change('serviceId',value)} options={services.map(s=>({value:s.id,label:s.name,description:`${s.category} • about ${s.duration} min`}))}/>:<Notice tone="warning" title="No services available">No services are currently available at this branch. Go back and choose another branch.</Notice>)}
        {step===2&&(dentists.length?<ChoiceGroup legend="Preferred Dentist" name={`${base}-dentist`} value={form.dentistId} disabled={!!lock.dentistId} onChange={value=>change('dentistId',value)} options={dentists.map(d=>({value:d.id,label:d.name,description:`${d.specialty} • ${displayTime(d.shiftStart)}–${displayTime(d.shiftEnd)}`}))}/>:<Notice tone="warning" title="No Dentist available">No Dentist is available for {service?.name||'this service'} at {branch?.name||'this branch'}. Go back and choose another service or branch.</Notice>)}
        {step===3&&<>
          <Field label="Appointment date" hint={mode==='followup'?undefined:`You can book up to two months ahead (through ${dateLabel(maxBookingDate())}).`}><input type="date" min={clinicDate()} max={mode==='followup'?undefined:maxBookingDate()} value={form.date} onChange={event=>change('date',event.target.value)}/></Field>
          {slots.length?<ChoiceGroup legend={`Available times on ${dateLabel(form.date)}`} name={`${base}-time`} variant="slots" value={form.start} onChange={value=>change('start',value)} options={slots.map(t=>({value:t,label:displayTime(t)}))}/>:<Notice tone="warning" title="No open times">There are no open times with {dentist?.name||'this Dentist'} on {dateLabel(form.date)}. Try another date{lock.dentistId?'':', another Dentist'} or suggested times.</Notice>}
          <div className="pt-suggest">
            <Button variant="soft" icon="sparkles" onClick={()=>setSuggestions(suggestTimes(state,form,ignoreId,4,lock.dentistId))}>Show suggested times</Button>
            {suggestions&&(suggestions.length?<div><h3>Suggested times</h3><p className="pt-hint">The earliest open times on {dateLabel(form.date)}, checked with the same availability rules.</p><ul className="pt-suggest-list">{suggestions.map(s=><li key={`${s.dentistId}-${s.start}`}><button type="button" className="btn soft" onClick={()=>pick(s)}>{displayTime(s.start)} · {s.dentist}</button></li>)}</ul></div>:<Notice>No suggested times on {dateLabel(form.date)}. Try another date.</Notice>)}
          </div>
        </>}
        {step===4&&<>
          <DefinitionList items={[{label:'Service',value:service?.name},{label:'Dentist',value:dentist?.name},{label:'Branch',value:branch?.name},{label:'When',value:when},{label:'Expected duration',value:form.duration?`About ${form.duration} minutes`:null}]}/>
          <Field label="Optional note"><textarea value={form.notes} placeholder="Anything the clinic should know before your visit?" onChange={event=>change('notes',event.target.value)}/></Field>
        </>}
        {error&&<Notice tone="danger" title="This time couldn’t be saved">{error}</Notice>}
        <div className="pt-stage-footer">
          {step>firstStep||(mode==='book'&&step>0)?<Button variant="ghost" onClick={()=>setStep(step-1)}>Back</Button>:<span/>}
          {step<4?<div className="pt-continue"><Button icon="arrow" onClick={()=>go(step+1)} disabled={!gates[step]} aria-describedby={gates[step]?undefined:`${base}-blocker`}>Continue</Button>{!gates[step]&&<p id={`${base}-blocker`} className="pt-hint">{blockers[step]}</p>}</div>:<Button icon="checkin" onClick={save}>{confirmLabel}</Button>}
        </div>
      </section>
    </div>
    <aside className="pt-summary" aria-label="Your visit so far"><h2 className="pt-card-label">Your visit so far</h2><DefinitionList items={summary}/></aside>
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
      {/* Blocked-card-paid stays visible on purpose — it explains why, rather than silently disappearing. */}
      {rules.canCancel&&<Button size="sm" variant="danger" onClick={()=>onCancel(a,rules.cancelKind)}>Cancel appointment</Button>}
    </>}>
    <DefinitionList items={[{label:'Dentist',value:dentistLabel(state,a.dentistId)},{label:'Expected duration',value:a.duration?`${a.duration} minutes`:null},{label:'Reference',value:a.appointmentNo},{label:'Payment',value:PAYMENT_LABEL[a.paymentMethod]||null},{label:'Your note',value:a.notes}]}/>
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
  const [cancelling,setCancelling]=useState(null) // {appointment, kind:'normal'|'blocked-card-paid'} | null
  useEffect(()=>{if(targetTab)setTab(targetTab)},[targetTab,target])
  if(!patientContext(state,session))return NO_ACCOUNT
  const rows=groups[tab]
  const startCancel=(a,kind)=>setCancelling({appointment:a,kind})
  const confirmCancel=()=>{
    const a=cancelling.appointment;setCancelling(null)
    const result=actions.cancelAppointment(a.id)
    toast(result.ok?'Appointment cancelled.':result.message,result.ok?'success':'warning')
  }
  return <div className="pt-page">
    <PageHeader kicker="Your visits" title="Visits" text="Your upcoming, past and cancelled visits across all clinic branches."/>
    <Tabs active={tab} onChange={setTab} tabs={[{key:'upcoming',label:'Upcoming',count:groups.upcoming.length},{key:'past',label:'Past',count:groups.past.length},{key:'cancelled',label:'Cancelled',count:groups.cancelled.length}]}/>
    <div className="pt-list" aria-live="polite">{rows.length?rows.map(a=><AppointmentCard key={a.id} a={a} state={state} session={session} highlight={target===a.id} onReschedule={setReschedule} onCancel={startCancel} setPage={setPage}/>):<Empty title={`No ${tab} visits`} text={tab==='upcoming'?'When you book a visit from Book, it appears here.':'There are no visits in this section.'}/>}</div>
    <Modal open={!!reschedule} title="Reschedule appointment" subtitle="Your new time must pass the same availability checks as a new booking." wide onClose={()=>setReschedule(null)}>{reschedule&&<PatientScheduler store={store} mode="reschedule" appointment={reschedule} inModal onDone={()=>setReschedule(null)}/>}</Modal>
    <ConfirmDialog open={cancelling?.kind==='normal'} title="Cancel this appointment?" confirmLabel="Cancel appointment" cancelLabel="Keep appointment" tone="danger" onConfirm={confirmCancel} onCancel={()=>setCancelling(null)}>
      {cancelling&&<><p><b>{cancelling.appointment.service}</b></p><p>{dateLabel(cancelling.appointment.date)} at {displayTime(cancelling.appointment.start)} with {dentistLabel(state,cancelling.appointment.dentistId)} • {cancelling.appointment.branch}</p><p>The reserved time will be released.</p></>}
    </ConfirmDialog>
    {/* Card-paid block: an informative state only — no confirm/destructive action exists here, so no mutation
        path is even reachable from this dialog. */}
    <Modal open={cancelling?.kind==='blocked-card-paid'} title="This appointment can’t be cancelled online" onClose={()=>setCancelling(null)}>
      <Notice tone="warning">This appointment has already been paid by card and cannot be cancelled online. Please contact the clinic for assistance.</Notice>
      <div className="row-actions top-gap"><Button variant="soft" onClick={()=>setCancelling(null)}>Close</Button></div>
    </Modal>
  </div>
}

export function PatientQueuePage({ store, setPage }) {
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
    <DefinitionList items={[{label:'Dentist',value:q.dentist},{label:'Service',value:q.service},{label:'Branch',value:q.branch},{label:'Checked in',value:q.checkedIn?displayTime(q.checkedIn):null}]}/>
    <Notice>Only your own place in line is shown. The estimated wait is based on the current queue at this clinic and can change.</Notice>
  </Card>
  return <div className="pt-page"><PageHeader kicker="Today" title="Live queue" text="Where you are at the clinic today."/>{body}</div>
}

const FOLLOWUP_NOTE={Open:'Your Dentist recommended a return visit. It isn’t scheduled yet.',Scheduled:'Your follow-up visit is scheduled.',Completed:'This follow-up visit is complete.','Needs clinic review':'The clinic needs to review this record before it can be scheduled.'}
export function PatientFollowupsPage({ store, setPage, context }) {
  const { state }=store, session=store.session
  const [booking,setBooking]=useState(null)
  if(!patientContext(state,session))return NO_ACCOUNT
  const items=patientFollowups(state,session), target=resolveTarget(state,session,'followups',context)
  return <div className="pt-page">
    <PageHeader kicker="Your care" title="Follow-up care" text="Your Dentist decides when a return visit is needed. Once it is requested, you choose a time that works for you."/>
    <div className="pt-list">{items.length?items.map(({record:f,display,appointment})=><RecordCard key={f.id} id={`followup-${f.id}`} highlight={target===f.id} title={f.reason||'Follow-up visit'} subtitle={`Requested by ${dentistLabel(state,f.dentistId)}`} status={display==='Open'?'Awaiting Scheduling':display}
      actions={<>{display==='Open'&&<Button size="sm" onClick={()=>setBooking(f)}>Schedule follow-up</Button>}{appointment&&<Button size="sm" variant="ghost" onClick={()=>setPage?.('appointments',{entityId:appointment.id})}>View appointment</Button>}</>}>
      <p className="pt-hint">{FOLLOWUP_NOTE[display]||''}</p>
      <DefinitionList items={[{label:'Recommended date',value:f.recommendedDate?dateLabel(f.recommendedDate):null},{label:'Recommended interval',value:f.interval},{label:'Scheduled visit',value:appointment?`${dateLabel(appointment.date)} · ${displayTime(appointment.start)} at ${appointment.branch}`:null}]}/>
    </RecordCard>):<Empty title="No follow-up visits" text="If your Dentist recommends a return visit, it appears here."/>}</div>
    <Modal open={!!booking} title="Schedule follow-up" subtitle="Your Dentist requested this return visit. Pick a time that fits." wide onClose={()=>setBooking(null)}>{booking&&<PatientScheduler store={store} mode="followup" followup={booking} inModal onDone={()=>setBooking(null)}/>}</Modal>
  </div>
}
