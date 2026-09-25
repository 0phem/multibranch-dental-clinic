import React, { useContext, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Button, Field, Notice, PageHeader, ShellActionsContext } from '../components.jsx'
import { clinicDate, maxBookingDate } from '../clock.js'
import { dateLabel, displayTime, uid } from '../logic.js'
import { assignDentist, findOpenTimes, FIND_TIME_DEFAULT_WINDOW_DAYS } from '../scheduling.js'
import { hasUsableCoordinates, nearestBranch } from '../geo.js'
import { bookingExitOutcome, buildDateStrip, dentistLabel, draftStatus, groupSlotsByPeriod, patientBookingDraft, patientContext, servicesAt } from '../patient-view.js'
import { ChoiceGroup, DateStrip, DefinitionList, TimeSlotGroup } from '../patient-ui.jsx'

// Phase 4B.3C-1 Patient booking entry, extended with a booking-stage Payment step and the 2-calendar-month
// horizon. Smart Find / Manual booking share one explicit choice; both use only the Phase 4B.3B scheduling
// domain (`assignDentist`, `findOpenTimes`) — there is no second scheduling implementation and no Patient
// Dentist chooser. Reschedule and follow-up scheduling are unchanged (`PatientScheduler` in PatientVisits.jsx).

const NO_ACCOUNT=<Notice tone="warning" title="We couldn’t confirm your account">Reopen your workspace, or ask the clinic to check your account access.</Notice>
const emptyForm={branchId:'',serviceId:'',date:'',start:'',paymentMethod:''}
const draftCommandId=()=>uid('draft-save')

function DraftBanner({ status, onResume, onDiscard }) {
  if(!status||!status.hasProgress)return null
  return <Notice tone="info" title="You have a booking in progress">
    <div className="row-actions top-gap">
      <Button size="sm" onClick={onResume}>Resume booking</Button>
      <Button size="sm" variant="ghost" onClick={onDiscard}>Discard</Button>
    </div>
  </Notice>
}

// A quiet, non-interactive progress indicator — where the Patient is, what's left, computed straight from the
// existing free-form `stage` string so it never becomes a second source of navigation truth.
const SMART_STEP_LABELS=['Branch','Service','Options','Payment','Review']
const MANUAL_STEP_LABELS=['Branch','Service','Date','Time','Payment','Review']
const SMART_STAGE_INDEX={'smart-branch':0,'smart-service':1,'smart-schedule':2,payment:3,review:4}
const MANUAL_STAGE_INDEX={'manual-branch':0,'manual-service':1,'manual-date':2,'manual-time':3,payment:4,review:5}
function BookProgress({ mode, stage }) {
  if(!mode||stage==='mode')return null
  const labels=mode==='smart'?SMART_STEP_LABELS:MANUAL_STEP_LABELS
  const current=(mode==='smart'?SMART_STAGE_INDEX:MANUAL_STAGE_INDEX)[stage]??0
  return <ol className="pt-book-progress" aria-label="Booking progress">
    {labels.map((label,index)=><li key={label} className={index<current?'is-done':index===current?'is-current':''} aria-current={index===current?'step':undefined}>
      <span className="pt-book-progress-dot" aria-hidden="true">{index<current?'✓':index+1}</span>
      <span className="pt-book-progress-label">{label}</span>
    </li>)}
  </ol>
}

function ModeChoice({ onChoose }) {
  return <div className="pt-book-modes" role="group" aria-label="How would you like to book?">
    <button type="button" className="pt-book-mode pt-book-mode-primary" onClick={()=>onChoose('smart')}>
      <span className="pt-book-mode-icon" aria-hidden="true">✦</span>
      <span className="pt-book-mode-eyebrow">Smart Find</span>
      <h2>Find the earliest available visit</h2>
      <p>We check real Dentist availability and open times automatically.</p>
    </button>
    <button type="button" className="pt-book-mode" onClick={()=>onChoose('manual')}>
      <span className="pt-book-mode-icon" aria-hidden="true">▤</span>
      <span className="pt-book-mode-eyebrow">Manual Appointment</span>
      <h2>Choose the branch, service, date and time yourself.</h2>
      <p>A Dentist is still assigned automatically based on availability.</p>
    </button>
  </div>
}

function StageHeader({ eyebrow, title, help, headingRef }) {
  return <div className="pt-stage-copy"><p className="pt-eyebrow">{eyebrow}</p><h2 ref={headingRef} tabIndex={-1}>{title}</h2>{help&&<p>{help}</p>}</div>
}

function LocationBranchStep({ state, branchId, onPick, onContinue, headingRef }) {
  const openBranches=state.branches.filter(b=>b.status==='Open')
  const [locationState,setLocationState]=useState('idle') // idle | requesting | found | unavailable | denied | unsupported
  const useLocation=()=>{
    if(typeof navigator==='undefined'||!navigator.geolocation){setLocationState('unsupported');return}
    setLocationState('requesting')
    navigator.geolocation.getCurrentPosition(
      position=>{
        const nearest=nearestBranch(openBranches,{lat:position.coords.latitude,lng:position.coords.longitude})
        if(nearest){onPick(nearest.id);setLocationState('found')}
        else setLocationState('unavailable')
      },
      ()=>setLocationState('denied'),
      {timeout:8000},
    )
  }
  const branch=openBranches.find(b=>b.id===branchId)
  const locatable=hasUsableCoordinates(openBranches)
  return <>
    <StageHeader eyebrow="Smart Find · Step 1 of 4" title="Which branch works for you?" headingRef={headingRef}
      help={locatable?"You can use your location to suggest the nearest branch, or choose one yourself. Nothing is collected unless you choose to share it.":undefined}/>
    {locatable&&<div className="pt-location-row">
      <Button variant="soft" icon="building" onClick={useLocation} disabled={locationState==='requesting'}>{locationState==='requesting'?'Finding your location…':'Use my location'}</Button>
      {locationState==='unavailable'&&<p className="pt-hint">We can’t determine your nearest branch right now — choose one below.</p>}
      {locationState==='denied'&&<p className="pt-hint">Location wasn’t shared — choose a branch below.</p>}
      {locationState==='unsupported'&&<p className="pt-hint">Your browser doesn’t support location — choose a branch below.</p>}
      {locationState==='found'&&branch&&<p className="pt-hint">Nearest branch: <b>{branch.name}</b>. You can change this below.</p>}
    </div>}
    <ChoiceGroup legend="Branch" name="smart-branch" value={branchId} onChange={onPick}
      options={openBranches.map(b=>({value:b.id,label:b.name,description:`${b.city} • ${displayTime(b.open)}–${displayTime(b.close)}`}))}/>
    <div className="pt-stage-footer"><span/><Button icon="arrow" onClick={onContinue} disabled={!branchId}>Continue</Button></div>
  </>
}

function ServiceStep({ state, branchId, serviceId, onPick, onBack, onContinue, headingRef, stepLabel }) {
  const services=servicesAt(state,branchId)
  return <>
    <StageHeader eyebrow={stepLabel} title="What can we help you with?" headingRef={headingRef}/>
    {services.length?<ChoiceGroup legend="Service" name="book-service" value={serviceId} onChange={onPick}
      options={services.map(s=>({value:s.id,label:s.name,descriptionLabel:'Estimated time',description:`About ${s.duration} min`,meta:s.category}))}/>
      :<Notice tone="warning" title="No services available">No services are currently available at this branch. Go back and choose another branch.</Notice>}
    <div className="pt-stage-footer"><Button variant="ghost" onClick={onBack}>Back</Button><Button icon="arrow" onClick={onContinue} disabled={!serviceId||!services.some(s=>s.id===serviceId)}>Continue</Button></div>
  </>
}

// Smart Find: one coherent view at a time — a flat "Earliest available"/"Other times" summary first, or
// (after "Show more times") the full date-strip/time-chip explorer, never both simultaneously. Both views
// read from the SAME exhaustive findOpenTimes call below — no second fetch, no second scheduling engine.
function SmartScheduleStep({ state, session, form, onPick, onBack, onContinue, headingRef }) {
  const [selectedDate,setSelectedDate]=useState(null)
  const branch=state.branches.find(b=>b.id===form.branchId)
  const today=clinicDate()
  // limit:Infinity makes this a genuinely exhaustive search of the whole authoritative window (proven by
  // findOpenTimes's own loop condition, `offset<windowDays && results.length<limit` — with limit=Infinity
  // the result-count check can never cut the day loop short) — every day is really searched, so a day's
  // "no openings" state is a proven fact, never a guess from a truncated result list.
  const results=useMemo(
    ()=>findOpenTimes(state,{branchId:form.branchId,serviceId:form.serviceId,patientId:session.patientId},{limit:Number.POSITIVE_INFINITY}),
    [state,form.branchId,form.serviceId,session.patientId,today],
  )
  const strip=useMemo(()=>buildDateStrip(results,today,FIND_TIME_DEFAULT_WINDOW_DAYS),[results,today])
  const activeDate=selectedDate||results[0]?.date||null
  const dayResults=activeDate?results.filter(r=>r.date===activeDate):[]
  const grouped=groupSlotsByPeriod(dayResults)
  const timeGroups=[['Morning',grouped.morning],['Afternoon',grouped.afternoon],['Evening',grouped.evening]]
  return <>
    <StageHeader eyebrow="Smart Find · Step 3 of 4" title="Real availability, found for you" headingRef={headingRef}
      help={`We checked ${branch?.name||'this branch'} for real Dentist availability across the next ${FIND_TIME_DEFAULT_WINDOW_DAYS} days.`}/>
    {!results.length&&<Notice tone="warning" title="No open times right now">{`No legitimate open times were found for this service at this branch in the next ${FIND_TIME_DEFAULT_WINDOW_DAYS} days. Go back and try another branch or service.`}</Notice>}
    {!!results.length&&<div className="pt-smart-explorer">
      <p className="pt-hint">Earliest available: {dateLabel(results[0].date)} at {displayTime(results[0].start)}</p>
      <DateStrip days={strip} value={activeDate} onChange={setSelectedDate}/>
      {dayResults.length?timeGroups.map(([label,slots])=><TimeSlotGroup key={label} legend={label}
        value={form.date===activeDate?form.start:''} onPick={value=>onPick(dayResults.find(r=>r.start===value))}
        slots={slots.map(r=>({value:r.start,label:displayTime(r.start)}))}/>)
        :<Notice tone="warning" title="No open times on this date">Choose a different date above, or use Manual Appointment to look beyond this window.</Notice>}
    </div>}
    <div className="pt-stage-footer"><Button variant="ghost" onClick={onBack}>Back</Button><Button icon="arrow" onClick={onContinue} disabled={!form.start||form.date!==activeDate}>Continue</Button></div>
  </>
}

function DateStep({ state, session, form, onChange, onBack, onContinue, headingRef }) {
  const today=clinicDate()
  const results=useMemo(()=>findOpenTimes(state,{branchId:form.branchId,serviceId:form.serviceId,patientId:session.patientId},{startDate:today,windowDays:FIND_TIME_DEFAULT_WINDOW_DAYS,limit:Number.POSITIVE_INFINITY}),[state,form.branchId,form.serviceId,session.patientId,today])
  const days=useMemo(()=>buildDateStrip(results,today,FIND_TIME_DEFAULT_WINDOW_DAYS),[results,today])
  return <>
    <StageHeader eyebrow="Manual booking · Step 3 of 5" title="Pick a date" headingRef={headingRef}
      help={`You can book up to two months ahead (through ${dateLabel(maxBookingDate())}).`}/>
    <div className="pt-manual-dates"><p className="pt-card-label">Available dates in the next two weeks</p><DateStrip days={days} value={form.date} onChange={onChange}/></div>
    <Field label="Choose another date"><input type="date" min={today} max={maxBookingDate()} value={form.date} onChange={event=>onChange(event.target.value)}/></Field>
    <div className="pt-stage-footer"><Button variant="ghost" onClick={onBack}>Back</Button><Button icon="arrow" onClick={onContinue} disabled={!form.date}>Continue</Button></div>
  </>
}

function TimeStep({ state, session, form, onPick, onBack, onContinue, headingRef }) {
  const results=findOpenTimes(state,{branchId:form.branchId,serviceId:form.serviceId,patientId:session.patientId},{startDate:form.date,windowDays:1,limit:50})
  const grouped=groupSlotsByPeriod(results)
  const timeGroups=[['Morning',grouped.morning],['Afternoon',grouped.afternoon],['Evening',grouped.evening]]
  return <>
    <StageHeader eyebrow="Manual booking · Step 4 of 5" title={`Available times on ${dateLabel(form.date)}`} headingRef={headingRef}
      help="Only times that pass the clinic’s availability checks are shown. A Dentist is assigned automatically."/>
    {results.length?timeGroups.map(([label,slots])=><TimeSlotGroup key={label} legend={label} value={form.start}
      onPick={value=>onPick(results.find(r=>r.start===value))}
      slots={slots.map(r=>({value:r.start,label:displayTime(r.start)}))}/>)
      :<Notice tone="warning" title="No open times">There are no open times on {dateLabel(form.date)}. Try another date.</Notice>}
    <div className="pt-stage-footer"><Button variant="ghost" onClick={onBack}>Back</Button><Button icon="arrow" onClick={onContinue} disabled={!form.start||!results.some(r=>r.start===form.start)}>Continue</Button></div>
  </>
}

const PAYMENT_OPTIONS=[
  {value:'cash',icon:'wallet',label:'Cash',description:'Pay at the clinic.'},
  {value:'card',icon:'receipt',label:'Card',description:'Card payment preference.',meta:'Selecting Card does not complete payment. Once a card payment is successfully completed, this appointment can no longer be cancelled online.'},
]
// Booking-stage payment intent only — never a charge. paymentStatus is always set to 'unpaid' by the shared
// saveAppointment command itself, regardless of which method is chosen here; nothing on this screen can ever
// mark a booking "paid." The real financial chain (Treatment → Invoice → Payment → Receipt) is unaffected.
function PaymentStep({ mode, form, onPick, onBack, headingRef }) {
  return <>
    <StageHeader eyebrow={`${mode==='smart'?'Smart Find':'Manual booking'} · Payment`} title="How would you like to pay?" headingRef={headingRef}
      help="This only records your preference for the clinic. Nothing is charged now — billing happens after your completed visit."/>
    <ChoiceGroup legend="Payment" name="book-payment" value={form.paymentMethod} onChange={onPick} options={PAYMENT_OPTIONS}/>
    <div className="pt-stage-footer"><Button variant="ghost" onClick={onBack}>Back</Button><span/></div>
  </>
}

const PAYMENT_LABEL={cash:'Cash — pay at the clinic',card:'Card — payment preference (not yet paid)'}
function ReviewStep({ state, mode, form, assignment, notes, onNotes, onBack, onConfirm, error, confirming, headingRef }) {
  const branch=state.branches.find(b=>b.id===form.branchId)
  const service=state.services.find(s=>s.id===form.serviceId)
  return <>
    <StageHeader eyebrow="Review" title="Review your appointment" headingRef={headingRef}/>
    <DefinitionList items={[
      {label:'Booking mode',value:mode==='smart'?'Smart Find':'Manual booking'},
      {label:'Branch',value:branch?.name},
      {label:'Service',value:service?.name},
      {label:'Date',value:form.date?dateLabel(form.date):null},
      {label:'Time',value:form.start?displayTime(form.start):null},
      {label:'Assigned Dentist',value:assignment.ok?dentistLabel(state,assignment.dentistId):null},
      {label:'Payment Method',value:PAYMENT_LABEL[form.paymentMethod]||null},
    ]}/>
    {assignment.ok?<p className="pt-hint">Assigned based on service availability.</p>
      :<Notice tone="warning" title="No Dentist is currently available">This combination has no eligible Dentist right now. Go back and choose a different date, time or branch.</Notice>}
    <Field label="Optional note"><textarea value={notes} placeholder="Anything the clinic should know before your visit?" onChange={event=>onNotes(event.target.value)}/></Field>
    {error&&<Notice tone="danger" title="This time couldn’t be saved">{error}</Notice>}
    <div className="pt-stage-footer">
      <Button variant="ghost" onClick={onBack}>Back</Button>
      <Button icon="checkin" onClick={onConfirm} disabled={!assignment.ok||confirming}>{confirming?'Confirming…':'Confirm appointment'}</Button>
    </div>
  </>
}

export function PatientBookingPage({ store, setPage, context }) {
  const { state, actions, toast }=store
  const session=store.session
  const shellActions=useContext(ShellActionsContext)
  const headingRef=useRef(null), moved=useRef(false)
  const commandId=useRef(uid('booking'))
  const autoResumedRef=useRef(false)
  const [mode,setMode]=useState(null) // null | 'smart' | 'manual'
  const [stage,setStage]=useState('mode')
  const [form,setForm]=useState(emptyForm)
  const [notes,setNotes]=useState('')
  const [error,setError]=useState('')
  const [confirming,setConfirming]=useState(false)
  const [confirmed,setConfirmed]=useState(null)
  const [resumeDismissed,setResumeDismissed]=useState(false)
  useEffect(()=>{if(moved.current)headingRef.current?.focus();moved.current=true},[stage,confirmed])

  const draft=patientBookingDraft(state,session)
  const status=draft?draftStatus(state,session,draft):null
  const persistenceError=store.persistenceErrors?.bookingDrafts||null
  const save=patch=>actions.saveBookingDraft(patch,draftCommandId())
  const change=(key,value)=>setForm(previous=>({...previous,[key]:value}))

  const resumeDraft=()=>{
    const validSlot=status.branch&&status.service&&status.slotValid!==false
    const nextForm={
      branchId:status.branch?draft.branchId:'',
      serviceId:status.branch&&status.service?draft.serviceId:'',
      date:validSlot?draft.date||'':'',
      start:validSlot?draft.start||'':'',
      paymentMethod:validSlot?draft.paymentMethod||'':'',
    }
    setForm(nextForm);setMode(draft.mode||'manual')
    if(status.issues.length)toast(status.issues.join(' '),'warning')
    if(!nextForm.branchId)setStage(draft.mode==='smart'?'smart-branch':'manual-branch')
    else if(!nextForm.serviceId)setStage(draft.mode==='smart'?'smart-service':'manual-service')
    else if(draft.mode==='smart')setStage('smart-schedule')
    else if(!nextForm.date)setStage('manual-date')
    else if(!nextForm.start)setStage('manual-time')
    else if(!nextForm.paymentMethod)setStage('payment')
    else setStage('review')
    setResumeDismissed(true)
  }
  const discardDraft=()=>{actions.discardBookingDraft(uid('draft-discard'));setResumeDismissed(true)}

  // Lets Shell observe an in-app Patient navigation honestly — never blocks it. Logout and session/auth
  // loss never call this listener at all (neither goes through setPage/selectPage), so no toast fires for
  // them; a healthy draft gets the saved-toast, a real device-persistence failure gets an honest warning,
  // and either way navigation always proceeds (see patient-view.js's bookingExitOutcome).
  useEffect(()=>{
    if(!shellActions?.registerPatientNavListener)return undefined
    const listener=()=>{
      const outcome=bookingExitOutcome(stage,!!status?.hasProgress,!!confirmed,persistenceError)
      if(outcome)toast(outcome.message,outcome.tone)
    }
    shellActions.registerPatientNavListener(listener)
    return ()=>shellActions.registerPatientNavListener(null)
  },[shellActions,stage,status?.hasProgress,confirmed,persistenceError])

  // A one-tap "Resume booking" from Home (setPage('book',{resume:true})) auto-resumes once, instead of
  // landing on the Mode-choice screen and requiring a second manual click on DraftBanner. Guarded on the
  // same `hasProgress` fact Home's own Resume-booking surface uses — a draft with only a branch chosen
  // (no service yet) is still meaningfully resumable; requiring branch AND service here would silently
  // fail to resume exactly the drafts Home just told the Patient it could resume.
  useEffect(()=>{
    if(context?.resume&&!autoResumedRef.current&&status?.hasProgress){
      autoResumedRef.current=true
      resumeDraft()
    }
  },[context?.resume,status?.hasProgress])

  if(!patientContext(state,session))return NO_ACCOUNT

  // An upstream choice always invalidates every downstream one, in the persisted draft as well as local
  // state — mode → branch/service/date/time/payment; branch → service/date/time/payment; service →
  // date/time/payment; date → time/payment; time → payment.
  const chooseMode=next=>{setMode(next);setForm(emptyForm);setStage(next==='smart'?'smart-branch':'manual-branch');save({mode:next,branchId:null,serviceId:null,date:null,start:null,paymentMethod:null})}
  const back=to=>{setError('');setStage(to)}

  // The exact assignment Review displays is the same one submitted at confirm time: saveAppointment's authoritative
  // recompute either matches it (booking proceeds) or fails closed with "Availability changed" and creates
  // nothing — the reviewed Dentist is never silently substituted (Phase 4B.3B confirmation semantics).
  const assignment=stage==='review'&&form.branchId&&form.serviceId&&form.date&&form.start
    ?assignDentist(state,{branchId:form.branchId,serviceId:form.serviceId,date:form.date,start:form.start,patientId:session.patientId},undefined,null,maxBookingDate())
    :{ok:false,dentistId:null}
  const confirm=()=>{
    setConfirming(true);setError('')
    const result=actions.saveAppointment({branchId:form.branchId,serviceId:form.serviceId,date:form.date,start:form.start,dentistId:assignment.dentistId,notes,paymentMethod:form.paymentMethod},{commandId:commandId.current,autoAssign:true})
    setConfirming(false)
    if(!result.ok){setError(result.message);toast(result.message,'warning');return}
    toast('Appointment confirmed.','success');setConfirmed(result.record)
  }
  const reset=()=>{commandId.current=uid('booking');setConfirmed(null);setError('');setMode(null);setForm(emptyForm);setNotes('');setStage('mode')}

  if(confirmed){
    const branch=state.branches.find(b=>b.id===confirmed.branchId), service=state.services.find(s=>s.id===confirmed.serviceId)
    return <div className="pt-page is-wide"><section className="pt-success motion-in" aria-labelledby="book-done">
      <p className="pt-eyebrow">Appointment confirmed</p><h2 id="book-done" ref={headingRef} tabIndex={-1}>You’re all set.</h2>
      <p>{service?.name||confirmed.service} on {dateLabel(confirmed.date)} at {displayTime(confirmed.start)} in {branch?.name||confirmed.branch}.</p>
      <DefinitionList items={[{label:'Dentist',value:dentistLabel(state,confirmed.dentistId)},{label:'Confirmation',value:confirmed.appointmentNo},{label:'Payment',value:PAYMENT_LABEL[confirmed.paymentMethod]||null}]}/>
      <div className="row-actions"><Button icon="calendar" onClick={()=>setPage?.('appointments',{entityId:confirmed.id})}>View my visits</Button><Button variant="soft" onClick={reset}>Book another visit</Button></div>
    </section></div>
  }

  return <div className="pt-page is-wide pt-book-flow">
    <PageHeader kicker="Online booking" title="Book your visit" text="Choose how you’d like to book. Only real available times are shown, and nothing is charged when you book."/>
    {!resumeDismissed&&stage==='mode'&&<DraftBanner status={status} onResume={resumeDraft} onDiscard={discardDraft}/>}
    {stage==='mode'&&<ModeChoice onChoose={chooseMode}/>}
    <BookProgress mode={mode} stage={stage}/>
    <section className="pt-stage motion-in" aria-live="polite" key={stage}>
      {stage==='smart-branch'&&<LocationBranchStep state={state} branchId={form.branchId} headingRef={headingRef}
        onPick={value=>{change('branchId',value);save({mode:'smart',branchId:value,serviceId:null,date:null,start:null,paymentMethod:null})}}
        onContinue={()=>setStage('smart-service')}/>}
      {stage==='smart-service'&&<ServiceStep state={state} branchId={form.branchId} serviceId={form.serviceId} headingRef={headingRef} stepLabel="Smart Find · Step 2 of 4"
        onPick={value=>{change('serviceId',value);save({serviceId:value,date:null,start:null,paymentMethod:null})}}
        onBack={()=>back('smart-branch')} onContinue={()=>setStage('smart-schedule')}/>}
      {stage==='smart-schedule'&&<SmartScheduleStep state={state} session={session} form={form} headingRef={headingRef}
        onPick={option=>{setForm(previous=>({...previous,date:option.date,start:option.start}));save({date:option.date,start:option.start,paymentMethod:null})}}
        onContinue={()=>setStage('payment')}
        onBack={()=>back('smart-service')}/>}
      {stage==='manual-branch'&&<>
        <StageHeader eyebrow="Manual booking · Step 1 of 5" title="Which clinic works best for you?" headingRef={headingRef}/>
        <ChoiceGroup legend="Branch" name="manual-branch" value={form.branchId} onChange={value=>{change('branchId',value);save({mode:'manual',branchId:value,serviceId:null,date:null,start:null,paymentMethod:null})}}
          options={state.branches.filter(b=>b.status==='Open').map(b=>({value:b.id,label:b.name,description:`${b.city} • ${displayTime(b.open)}–${displayTime(b.close)}`}))}/>
        <div className="pt-stage-footer"><span/><Button icon="arrow" onClick={()=>setStage('manual-service')} disabled={!form.branchId}>Continue</Button></div>
      </>}
      {stage==='manual-service'&&<ServiceStep state={state} branchId={form.branchId} serviceId={form.serviceId} headingRef={headingRef} stepLabel="Manual booking · Step 2 of 5"
        onPick={value=>{change('serviceId',value);save({serviceId:value,date:null,start:null,paymentMethod:null})}}
        onBack={()=>back('manual-branch')} onContinue={()=>setStage('manual-date')}/>}
      {stage==='manual-date'&&<DateStep state={state} session={session} form={form} headingRef={headingRef}
        onChange={value=>{change('date',value);save({date:value,start:'',paymentMethod:null});change('start','')}}
        onBack={()=>back('manual-service')} onContinue={()=>setStage('manual-time')}/>}
      {stage==='manual-time'&&<TimeStep state={state} session={session} form={form} headingRef={headingRef}
        onPick={option=>{setForm(previous=>({...previous,start:option.start}));save({start:option.start,paymentMethod:null})}}
        onContinue={()=>setStage('payment')}
        onBack={()=>back('manual-date')}/>}
      {stage==='payment'&&<PaymentStep mode={mode} form={form} headingRef={headingRef}
        onPick={value=>{change('paymentMethod',value);save({paymentMethod:value});setStage('review')}}
        onBack={()=>back(mode==='smart'?'smart-schedule':'manual-time')}/>}
      {stage==='review'&&<ReviewStep state={state} mode={mode} form={form} assignment={assignment} notes={notes} onNotes={setNotes} headingRef={headingRef}
        onBack={()=>back('payment')} onConfirm={confirm} error={error} confirming={confirming}/>}
    </section>
  </div>
}
