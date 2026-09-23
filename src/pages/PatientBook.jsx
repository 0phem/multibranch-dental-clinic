import React, { useEffect, useId, useRef, useState } from 'react'
import { Button, Field, Notice, PageHeader } from '../components.jsx'
import { clinicDate } from '../clock.js'
import { dateLabel, displayTime, uid } from '../logic.js'
import { assignDentist, findOpenTimes } from '../scheduling.js'
import { nearestBranch } from '../geo.js'
import { dentistLabel, draftStatus, patientBookingDraft, patientContext, servicesAt } from '../patient-view.js'
import { ChoiceGroup, DefinitionList } from '../patient-ui.jsx'

// Phase 4B.3C-1 Patient booking entry. Replaces the single 5-step wizard (which included a manual Dentist-choice
// step) with an explicit Smart Find / Manual Booking choice. Both modes use only the Phase 4B.3B scheduling domain
// (`assignDentist`, `findOpenTimes`) — there is no second scheduling implementation and no Patient Dentist chooser.
// Reschedule and follow-up scheduling are unchanged (`PatientScheduler` in PatientVisits.jsx).

const NO_ACCOUNT=<Notice tone="warning" title="We couldn’t confirm your account">Reopen your workspace, or ask the clinic to check your account access.</Notice>
const emptyForm={branchId:'',serviceId:'',date:'',start:''}
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

function ModeChoice({ onChoose }) {
  return <div className="pt-book-modes" role="group" aria-label="How would you like to book?">
    <button type="button" className="pt-book-mode" onClick={()=>onChoose('smart')}>
      <span className="pt-book-mode-eyebrow">Smart Find</span>
      <h2>Show me the earliest valid options</h2>
      <p>Deterministic scheduling — we check real availability and assign a Dentist automatically. Not AI.</p>
    </button>
    <button type="button" className="pt-book-mode" onClick={()=>onChoose('manual')}>
      <span className="pt-book-mode-eyebrow">Manual booking</span>
      <h2>Choose my branch, service, date and time</h2>
      <p>Pick exactly what works for you. A Dentist is still assigned automatically based on availability.</p>
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
  return <>
    <StageHeader eyebrow="Smart Find · Step 1 of 3" title="Which branch works for you?" headingRef={headingRef}
      help="You can use your location to suggest the nearest branch, or choose one yourself. Nothing is collected unless you choose to share it."/>
    <div className="pt-location-row">
      <Button variant="soft" icon="building" onClick={useLocation} disabled={locationState==='requesting'}>{locationState==='requesting'?'Finding your location…':'Use my location'}</Button>
      {locationState==='unavailable'&&<p className="pt-hint">We can’t determine your nearest branch right now — choose one below.</p>}
      {locationState==='denied'&&<p className="pt-hint">Location wasn’t shared — choose a branch below.</p>}
      {locationState==='unsupported'&&<p className="pt-hint">Your browser doesn’t support location — choose a branch below.</p>}
      {locationState==='found'&&branch&&<p className="pt-hint">Nearest branch: <b>{branch.name}</b>. You can change this below.</p>}
    </div>
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
      options={services.map(s=>({value:s.id,label:s.name,description:`${s.category} • about ${s.duration} min`}))}/>
      :<Notice tone="warning" title="No services available">No services are currently available at this branch. Go back and choose another branch.</Notice>}
    <div className="pt-stage-footer"><Button variant="ghost" onClick={onBack}>Back</Button><Button icon="arrow" onClick={onContinue} disabled={!serviceId||!services.some(s=>s.id===serviceId)}>Continue</Button></div>
  </>
}

// Smart Find: several deterministic options across the technical search window, not one forced result.
function SmartScheduleStep({ state, session, form, onPick, onBack, headingRef }) {
  const results=findOpenTimes(state,{branchId:form.branchId,serviceId:form.serviceId,patientId:session.patientId},{})
  const branch=state.branches.find(b=>b.id===form.branchId)
  return <>
    <StageHeader eyebrow="Smart Find · Step 3 of 3" title="Here are the earliest valid options" headingRef={headingRef}
      help="Every option already passed the clinic’s availability checks, including a Dentist who is free at that time."/>
    {results.length?<ul className="pt-book-options">{results.map(option=><li key={`${option.date}-${option.start}`}>
      <button type="button" onClick={()=>onPick(option)}>
        <span className="pt-book-option-when"><b>{dateLabel(option.date)}</b><span>{displayTime(option.start)}</span></span>
        <span className="pt-book-option-meta">{branch?.name} · {option.dentist}</span>
      </button>
    </li>)}</ul>:<Notice tone="warning" title="No open times right now">No legitimate open times were found for this service at this branch in the next two weeks. Go back and try another branch or service.</Notice>}
    <div className="pt-stage-footer"><Button variant="ghost" onClick={onBack}>Back</Button><span/></div>
  </>
}

function DateStep({ form, onChange, onBack, onContinue, headingRef }) {
  return <>
    <StageHeader eyebrow="Manual booking · Step 3 of 4" title="Pick a date" headingRef={headingRef}/>
    <Field label="Appointment date"><input type="date" min={clinicDate()} value={form.date} onChange={event=>onChange(event.target.value)}/></Field>
    <div className="pt-stage-footer"><Button variant="ghost" onClick={onBack}>Back</Button><Button icon="arrow" onClick={onContinue} disabled={!form.date}>Continue</Button></div>
  </>
}

function TimeStep({ state, session, form, onPick, onBack, headingRef }) {
  const results=findOpenTimes(state,{branchId:form.branchId,serviceId:form.serviceId,patientId:session.patientId},{startDate:form.date,windowDays:1,limit:50})
  return <>
    <StageHeader eyebrow="Manual booking · Step 4 of 4" title={`Available times on ${dateLabel(form.date)}`} headingRef={headingRef}
      help="Only times that pass the clinic’s availability checks are shown. A Dentist is assigned automatically."/>
    {results.length?<ChoiceGroup legend={`Available times on ${dateLabel(form.date)}`} name="book-time" variant="slots" value={form.start}
      onChange={value=>onPick(results.find(r=>r.start===value))}
      options={results.map(r=>({value:r.start,label:displayTime(r.start)}))}/>
      :<Notice tone="warning" title="No open times">There are no open times on {dateLabel(form.date)}. Try another date.</Notice>}
    <div className="pt-stage-footer"><Button variant="ghost" onClick={onBack}>Back</Button><span/></div>
  </>
}

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

export function PatientBookingPage({ store, setPage }) {
  const { state, actions, toast }=store
  const session=store.session
  const headingRef=useRef(null), moved=useRef(false)
  const commandId=useRef(uid('booking'))
  const [mode,setMode]=useState(null) // null | 'smart' | 'manual'
  const [stage,setStage]=useState('mode')
  const [form,setForm]=useState(emptyForm)
  const [notes,setNotes]=useState('')
  const [error,setError]=useState('')
  const [confirming,setConfirming]=useState(false)
  const [confirmed,setConfirmed]=useState(null)
  const [resumeDismissed,setResumeDismissed]=useState(false)
  useEffect(()=>{if(moved.current)headingRef.current?.focus();moved.current=true},[stage,confirmed])
  if(!patientContext(state,session))return NO_ACCOUNT

  const draft=patientBookingDraft(state,session)
  const status=draft?draftStatus(state,session,draft):null
  const save=patch=>actions.saveBookingDraft(patch,draftCommandId())
  const change=(key,value)=>setForm(previous=>({...previous,[key]:value}))

  const resumeDraft=()=>{
    const nextForm={
      branchId:status.branch?draft.branchId:'',
      serviceId:status.branch&&status.service?draft.serviceId:'',
      date:status.branch&&status.service&&status.slotValid!==false?draft.date||'':'',
      start:status.branch&&status.service&&status.slotValid!==false?draft.start||'':'',
    }
    setForm(nextForm);setMode(draft.mode||'manual')
    if(status.issues.length)toast(status.issues.join(' '),'warning')
    if(!nextForm.branchId)setStage(draft.mode==='smart'?'smart-branch':'manual-branch')
    else if(!nextForm.serviceId)setStage(draft.mode==='smart'?'smart-service':'manual-service')
    else if(draft.mode==='smart')setStage('smart-schedule')
    else if(!nextForm.date)setStage('manual-date')
    else if(!nextForm.start)setStage('manual-time')
    else setStage('review')
    setResumeDismissed(true)
  }
  const discardDraft=()=>{actions.discardBookingDraft(uid('draft-discard'));setResumeDismissed(true)}

  const chooseMode=next=>{setMode(next);setForm(emptyForm);setStage(next==='smart'?'smart-branch':'manual-branch');save({mode:next})}
  const back=to=>{setError('');setStage(to)}

  // The exact assignment Review displays is the same one submitted at confirm time: saveAppointment's authoritative
  // recompute either matches it (booking proceeds) or fails closed with "Availability changed" and creates
  // nothing — the reviewed Dentist is never silently substituted (Phase 4B.3B confirmation semantics).
  const assignment=stage==='review'&&form.branchId&&form.serviceId&&form.date&&form.start
    ?assignDentist(state,{branchId:form.branchId,serviceId:form.serviceId,date:form.date,start:form.start,patientId:session.patientId})
    :{ok:false,dentistId:null}
  const confirm=()=>{
    setConfirming(true);setError('')
    const result=actions.saveAppointment({branchId:form.branchId,serviceId:form.serviceId,date:form.date,start:form.start,dentistId:assignment.dentistId,notes},{commandId:commandId.current,autoAssign:true})
    setConfirming(false)
    if(!result.ok){setError(result.message);toast(result.message,'warning');return}
    toast('Appointment confirmed.','success');setConfirmed(result.record)
  }
  const reset=()=>{commandId.current=uid('booking');setConfirmed(null);setError('');setMode(null);setForm(emptyForm);setNotes('');setStage('mode')}

  if(confirmed){
    const branch=state.branches.find(b=>b.id===confirmed.branchId), service=state.services.find(s=>s.id===confirmed.serviceId)
    return <div className="pt-page is-wide"><section className="pt-success" aria-labelledby="book-done">
      <p className="pt-eyebrow">Appointment confirmed</p><h2 id="book-done" ref={headingRef} tabIndex={-1}>You’re all set.</h2>
      <p>{service?.name||confirmed.service} on {dateLabel(confirmed.date)} at {displayTime(confirmed.start)} in {branch?.name||confirmed.branch}.</p>
      <DefinitionList items={[{label:'Dentist',value:dentistLabel(state,confirmed.dentistId)},{label:'Confirmation',value:confirmed.appointmentNo}]}/>
      <div className="row-actions"><Button icon="calendar" onClick={()=>setPage?.('appointments',{entityId:confirmed.id})}>View my visits</Button><Button variant="soft" onClick={reset}>Book another visit</Button></div>
    </section></div>
  }

  return <div className="pt-page is-wide pt-book-flow">
    <PageHeader kicker="Online booking" title="Book your visit" text="Choose how you’d like to book. Only real available times are shown, and nothing is charged when you book."/>
    {!resumeDismissed&&stage==='mode'&&<DraftBanner status={status} onResume={resumeDraft} onDiscard={discardDraft}/>}
    {stage==='mode'&&<ModeChoice onChoose={chooseMode}/>}
    <section className="pt-stage" aria-live="polite">
      {stage==='smart-branch'&&<LocationBranchStep state={state} branchId={form.branchId} headingRef={headingRef}
        onPick={value=>{change('branchId',value);save({mode:'smart',branchId:value})}}
        onContinue={()=>setStage('smart-service')}/>}
      {stage==='smart-service'&&<ServiceStep state={state} branchId={form.branchId} serviceId={form.serviceId} headingRef={headingRef} stepLabel="Smart Find · Step 2 of 3"
        onPick={value=>{change('serviceId',value);save({serviceId:value})}}
        onBack={()=>back('smart-branch')} onContinue={()=>setStage('smart-schedule')}/>}
      {stage==='smart-schedule'&&<SmartScheduleStep state={state} session={session} form={form} headingRef={headingRef}
        onPick={option=>{setForm(previous=>({...previous,date:option.date,start:option.start}));save({date:option.date,start:option.start});setStage('review')}}
        onBack={()=>back('smart-service')}/>}
      {stage==='manual-branch'&&<>
        <StageHeader eyebrow="Manual booking · Step 1 of 4" title="Which clinic works best for you?" headingRef={headingRef}/>
        <ChoiceGroup legend="Branch" name="manual-branch" value={form.branchId} onChange={value=>{change('branchId',value);save({mode:'manual',branchId:value})}}
          options={state.branches.filter(b=>b.status==='Open').map(b=>({value:b.id,label:b.name,description:`${b.city} • ${displayTime(b.open)}–${displayTime(b.close)}`}))}/>
        <div className="pt-stage-footer"><span/><Button icon="arrow" onClick={()=>setStage('manual-service')} disabled={!form.branchId}>Continue</Button></div>
      </>}
      {stage==='manual-service'&&<ServiceStep state={state} branchId={form.branchId} serviceId={form.serviceId} headingRef={headingRef} stepLabel="Manual booking · Step 2 of 4"
        onPick={value=>{change('serviceId',value);save({serviceId:value})}}
        onBack={()=>back('manual-branch')} onContinue={()=>setStage('manual-date')}/>}
      {stage==='manual-date'&&<DateStep form={form} headingRef={headingRef}
        onChange={value=>{change('date',value);save({date:value,start:''});change('start','')}}
        onBack={()=>back('manual-service')} onContinue={()=>setStage('manual-time')}/>}
      {stage==='manual-time'&&<TimeStep state={state} session={session} form={form} headingRef={headingRef}
        onPick={option=>{setForm(previous=>({...previous,start:option.start}));save({start:option.start});setStage('review')}}
        onBack={()=>back('manual-date')}/>}
      {stage==='review'&&<ReviewStep state={state} mode={mode} form={form} assignment={assignment} notes={notes} onNotes={setNotes} headingRef={headingRef}
        onBack={()=>back(mode==='smart'?'smart-schedule':'manual-time')} onConfirm={confirm} error={error} confirming={confirming}/>}
    </section>
  </div>
}
