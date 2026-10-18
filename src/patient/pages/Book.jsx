import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Icon } from '../../components.jsx'
import { bookingBranchOptions, bookingDentistOptions, listServices } from '../../api-client.js'
import { commandKey, createAppointment } from '../../appointments-api.js'
import { clinic } from '../../clinic-config.js'
import { BookingCalendar, TimeSlots } from '../BookingCalendar.jsx'
import { dateLong, downloadIcs, hoursSummary, time12 } from '../format.js'
import { EmptyState, ErrorState, PageHead, Skeleton, useLoad } from '../ui.jsx'

const STEPS = ['Service', 'Branch', 'Dentist', 'Date', 'Time', 'Review']

/**
 * One booking flow (decision 4: nothing is paid when booking). Suggestions fill the choices (nearest branch with the earliest slot,
 * any available Dentist), and the Patient can change every one. Choices are kept when going back. Real data only.
 */
export function BookPage({ prefill = null, onDone, onNavigate, toast }) {
  const [step, setStep] = useState(0)
  const [choice, setChoice] = useState({ service: null, branch: null, dentist: null, date: '', slot: null })
  const [done, setDone] = useState(null)
  const services = useLoad(() => listServices(), [])
  const headRef = useRef(null)
  useEffect(() => { headRef.current?.focus({ preventScroll: false }) }, [step])

  // An assistant button may pre-fill the service (and branch): the matching choices are applied once the services load.
  useEffect(() => {
    if (!prefill?.service || services.status !== 'ready' || choice.service) return
    const s = (services.data || []).find(x => x.id === prefill.service && x.status === 'Active')
    if (s) { setChoice(c => ({ ...c, service: s })); setStep(1) }
  }, [services.status])

  const set = patch => setChoice(c => ({ ...c, ...patch }))
  const go = n => setStep(Math.max(0, Math.min(STEPS.length - 1, n)))

  if (done) return <Success appointment={done} onNavigate={onNavigate}/>

  return <div className="pp-page pp-book">
    <PageHead eyebrow="Book a visit" title="Book an appointment" text="Only real open times are shown. Nothing is charged when you book."/>
    <ol className="pp-steps" aria-label="Booking progress">
      {STEPS.map((label, i) => <li key={label} className={i < step ? 'is-done' : i === step ? 'is-current' : ''} aria-current={i === step ? 'step' : undefined}>
        <span className="pp-step-dot">{i < step ? <Icon name="check" size={14}/> : i + 1}</span><span className="pp-step-label">{label}</span>
      </li>)}
    </ol>
    <div className="pp-progress" aria-hidden="true"><span style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }}/></div>

    <section className="pp-card pp-step pp-slide" key={step} aria-labelledby="pp-step-title">
      <h2 id="pp-step-title" tabIndex={-1} ref={headRef}>{['Choose a service', 'Choose a branch', 'Choose a dentist', 'Choose a day', 'Choose a time', 'Review and confirm'][step]}</h2>
      {step === 0 && <ServiceStep services={services} value={choice.service} onPick={s => { set({ service: s, branch: choice.service?.id === s.id ? choice.branch : null, dentist: null, date: '', slot: null }); go(1) }}/>}
      {step === 1 && <BranchStep service={choice.service} value={choice.branch} preferred={prefill?.branch} onPick={b => { set({ branch: b, dentist: choice.branch?.id === b.id ? choice.dentist : null, date: '', slot: null }); go(2) }}/>}
      {step === 2 && <DentistStep service={choice.service} branch={choice.branch} value={choice.dentist} onPick={d => { set({ dentist: d, date: '', slot: null }); go(3) }}/>}
      {step === 3 && <>
        <p className="pp-hint">{choice.branch.name} · {choice.service.name}{choice.dentist ? ` · ${choice.dentist.name}` : ' · any available dentist'}</p>
        <BookingCalendar branchId={choice.branch.id} serviceId={choice.service.id} dentistId={choice.dentist?.id} value={choice.date} onChange={date => { set({ date, slot: null }); go(4) }}/>
      </>}
      {step === 4 && <>
        <p className="pp-hint">{dateLong(choice.date)} at {choice.branch.name}</p>
        <TimeSlots branchId={choice.branch.id} serviceId={choice.service.id} dentistId={choice.dentist?.id} date={choice.date} value={choice.slot} onChange={slot => { set({ slot }); go(5) }}/>
      </>}
      {step === 5 && <Review choice={choice} onEdit={go} onBooked={a => { setDone(a); toast?.('Your appointment is booked.', 'success'); onDone?.(a) }}/>}
      <div className="pp-step-nav">
        {step > 0 && <Button variant="ghost" icon="chevronLeft" onClick={() => go(step - 1)}>Back</Button>}
      </div>
    </section>
  </div>
}

function ServiceStep({ services, value, onPick }) {
  const [q, setQ] = useState('')
  const active = (services.data || []).filter(s => s.status === 'Active')
  const filtered = active.filter(s => `${s.name} ${s.category} ${s.description || ''}`.toLowerCase().includes(q.trim().toLowerCase()))
  const groups = useMemo(() => [...new Set(filtered.map(s => s.category || 'Other'))].map(c => [c, filtered.filter(s => (s.category || 'Other') === c)]), [filtered])
  if (services.status === 'loading') return <Skeleton lines={4} card={false} label="Loading services"/>
  if (services.status === 'error') return <ErrorState text={services.error} onRetry={services.reload}/>
  if (!active.length) return <EmptyState icon="tooth" title="No services are open for booking" text="Please message the front desk to arrange a visit."/>
  return <>
    <label className="pp-search"><Icon name="search" size={18}/><span className="sr-only">Search services</span><input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search services, e.g. cleaning"/></label>
    {!filtered.length && <p className="pp-hint">No service matches “{q}”.</p>}
    {groups.map(([category, list]) => <div key={category} className="pp-group">
      <h3 className="pp-group-title">{category}</h3>
      <div className="pp-options">
        {list.map(s => <button key={s.id} type="button" className={`pp-option ${value?.id === s.id ? 'is-selected' : ''}`} aria-pressed={value?.id === s.id} onClick={() => onPick(s)}>
          <span className="pp-option-icon" aria-hidden="true"><Icon name="tooth" size={20}/></span>
          <span className="pp-option-body"><b>{s.name}</b>{s.description && <small>{s.description}</small>}<em><Icon name="clock" size={14}/> About {s.duration_minutes} minutes</em></span>
          {value?.id === s.id && <Icon name="check" size={18} className="pp-option-check"/>}
        </button>)}
      </div>
    </div>)}
    <p className="pp-hint">Prices are confirmed by the clinic. You’ll receive your invoice after your visit.</p>
  </>
}

/** Branch step: asks for the browser location once (explained, never stored) to rank by distance and earliest slot. */
function BranchStep({ service, value, preferred, onPick }) {
  const [geo, setGeo] = useState(typeof navigator !== 'undefined' && navigator.geolocation ? 'asking' : 'unavailable')
  const [coords, setCoords] = useState(null)
  const [city, setCity] = useState('')
  const [state, setState] = useState({ status: 'loading', data: null, error: '' })
  const ask = () => {
    if (!navigator.geolocation) return setGeo('unavailable')
    setGeo('asking')
    navigator.geolocation.getCurrentPosition(p => { setCoords({ latitude: p.coords.latitude.toFixed(4), longitude: p.coords.longitude.toFixed(4) }); setGeo('granted') },
      () => setGeo('denied'), { maximumAge: 600000, timeout: 8000, enableHighAccuracy: false })
  }
  useEffect(() => { if (geo === 'asking') ask() }, [])
  useEffect(() => {
    if (geo === 'asking') return undefined
    let live = true
    setState(s => ({ ...s, status: 'loading' }))
    bookingBranchOptions({ service_ref: service.id, ...(coords || {}) }).then(r => { if (live) setState(r.ok ? { status: 'ready', data: r.data, error: '' } : { status: 'error', data: null, error: r.message || 'Branches could not be loaded.' }) })
    return () => { live = false }
  }, [geo, coords?.latitude, coords?.longitude])

  const intro = <div className="pp-geo">
    <Icon name="pin" size={20}/>
    <p>{geo === 'granted' ? 'Sorted by distance from you and the earliest open time. Your location is used once and never saved.'
      : geo === 'asking' ? 'To suggest the closest branch, your browser will ask for your location. It is used once to sort branches and is never saved.'
        : geo === 'denied' ? 'Location is off, so branches are listed by the earliest open time. You can filter by city below.'
          : 'Branches are listed by the earliest open time.'}</p>
    {(geo === 'denied' || geo === 'unavailable') && navigator?.geolocation && <Button size="sm" variant="soft" onClick={ask}>Find the best branch for me</Button>}
  </div>
  if (geo === 'asking' || state.status === 'loading') return <>{intro}<Skeleton lines={3} card={false} label="Finding branches"/></>
  if (state.status === 'error') return <>{intro}<ErrorState text={state.error} onRetry={() => setGeo(g => g)}/></>
  const branches = state.data.branches
  if (!branches.length) return <EmptyState icon="building" title="No branch offers this service online right now" text="Please message the front desk and they will help you book."/>
  const cities = [...new Set(branches.map(b => b.city).filter(Boolean))]
  const shown = branches.filter(b => !city || b.city === city)
  const recommended = shown.find(b => b.recommended) || null
  const others = shown.filter(b => b !== recommended).sort((a, b) => (b.id === preferred) - (a.id === preferred))
  const card = (b, highlight) => <button key={b.id} type="button" className={`pp-option pp-branch ${highlight ? 'is-recommended' : ''} ${value?.id === b.id ? 'is-selected' : ''}`} aria-pressed={value?.id === b.id} onClick={() => onPick(b)}>
    <span className="pp-option-icon" aria-hidden="true"><Icon name="building" size={20}/></span>
    <span className="pp-option-body">
      {highlight && <span className="pp-badge">Recommended · {b.reason}</span>}
      <b>{b.name}</b><small>{b.address}</small>
      <em><Icon name="clock" size={14}/> {hoursSummary(b.weekly_hours) || `${time12(b.open_time)} – ${time12(b.close_time)}`}{b.distance_km != null ? ` · ${b.distance_km} km away` : ''}</em>
      <em>{b.earliest ? `Earliest: ${b.earliest.label}` : 'No open time in the next month'}</em>
    </span>
  </button>
  return <>
    {intro}
    {cities.length > 1 && geo !== 'granted' && <div className="pp-filter" role="group" aria-label="Filter by city">
      <button type="button" className={`pp-chip ${!city ? 'is-selected' : ''}`} aria-pressed={!city} onClick={() => setCity('')}>All</button>
      {cities.map(c => <button key={c} type="button" className={`pp-chip ${city === c ? 'is-selected' : ''}`} aria-pressed={city === c} onClick={() => setCity(c)}>{c}</button>)}
    </div>}
    <div className="pp-options">{recommended && card(recommended, true)}{others.map(b => card(b, false))}</div>
  </>
}

function DentistStep({ service, branch, value, onPick }) {
  const dentists = useLoad(() => bookingDentistOptions({ branch_ref: branch.id, service_ref: service.id }), [branch.id, service.id])
  if (dentists.status === 'loading') return <Skeleton lines={3} card={false} label="Loading dentists"/>
  if (dentists.status === 'error') return <ErrorState text={dentists.error} onRetry={dentists.reload}/>
  return <div className="pp-options">
    <button type="button" className={`pp-option ${!value ? 'is-selected' : ''}`} aria-pressed={!value} onClick={() => onPick(null)}>
      <span className="pp-option-icon" aria-hidden="true"><Icon name="sparkles" size={20}/></span>
      <span className="pp-option-body"><b>Any available dentist</b><small>Shows the most open times. The clinic assigns a dentist who does this service.</small></span>
    </button>
    {(dentists.data || []).map(d => <button key={d.id} type="button" className={`pp-option ${value?.id === d.id ? 'is-selected' : ''}`} aria-pressed={value?.id === d.id} onClick={() => onPick(d)}>
      <span className="pp-avatar" aria-hidden="true">{d.name?.split(' ').map(p => p[0]).slice(0, 2).join('')}</span>
      <span className="pp-option-body"><b>{d.name}</b>{d.specialty && <small>{d.specialty}</small>}</span>
    </button>)}
  </div>
}

function Review({ choice, onEdit, onBooked }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const key = useRef(commandKey())
  const confirm = async () => {
    if (busy) return
    setBusy(true); setError('')
    const result = await createAppointment({ branchId: choice.branch.id, serviceId: choice.service.id, date: choice.date, start: choice.slot.start_time, dentistId: choice.dentist?.id || null }, key.current)
    setBusy(false)
    if (!result.ok) { setError(result.message || 'This time could not be booked. Please choose another.'); return }
    onBooked({ ...result.row, serviceName: choice.service.name, branchName: choice.branch.name, branchAddress: choice.branch.address })
  }
  const rows = [['Service', choice.service.name, 0], ['Branch', <>{choice.branch.name}<small>{choice.branch.address}</small></>, 1],
    ['Dentist', choice.slot?.dentist?.name || choice.dentist?.name || 'Assigned by the clinic', 2], ['Date', dateLong(choice.date), 3], ['Time', time12(choice.slot?.start_time), 4]]
  return <>
    <dl className="pp-summary">{rows.map(([k, v, s]) => <div key={k}><dt>{k}</dt><dd>{v}</dd><button type="button" className="link-button" onClick={() => onEdit(s)} aria-label={`Change ${k.toLowerCase()}`}>Change</button></div>)}</dl>
    <p className="pp-note"><Icon name="wallet" size={18}/> You’ll receive your invoice after your visit and can pay online in Billing.</p>
    {error && <p className="pp-error-text" role="alert">{error}</p>}
    <Button width="full" className="pp-primary" disabled={busy} onClick={confirm}>{busy ? 'Booking…' : 'Confirm appointment'}</Button>
  </>
}

function Success({ appointment, onNavigate }) {
  const ics = () => downloadIcs({ id: appointment.id, service: appointment.serviceName || appointment.service?.name, branchName: appointment.branchName || appointment.branch?.name,
    branchAddress: appointment.branchAddress, dentist: appointment.dentistName || appointment.dentist?.name, startsAt: appointment.startsAt || appointment.starts_at,
    endsAt: appointment.endsAt || appointment.ends_at, clinicName: clinic.name })
  const date = appointment.date, start = appointment.start || appointment.start_time
  return <div className="pp-page pp-success pp-fade">
    <div className="pp-card pp-success-card">
      <span className="pp-success-mark" aria-hidden="true"><Icon name="check" size={34}/></span>
      <h1>You’re booked!</h1>
      <p className="pp-lead">{appointment.serviceName || appointment.service?.name} on <b>{dateLong(date)}</b> at <b>{time12(start)}</b>, {appointment.branchName || appointment.branch?.name}.</p>
      <p className="pp-hint">A confirmation email is on its way. You’ll receive your invoice after your visit and can pay online in Billing.</p>
      <div className="pp-actions">
        <Button icon="download" variant="soft" onClick={ics}>Add to calendar</Button>
        <Button onClick={() => onNavigate('visits')}>View my visits</Button>
        <Button variant="ghost" onClick={() => onNavigate('home')}>Back to home</Button>
      </div>
    </div>
  </div>
}
