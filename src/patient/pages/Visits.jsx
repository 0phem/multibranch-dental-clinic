import React, { useEffect, useRef, useState } from 'react'
import { Button, Icon, Modal } from '../../components.jsx'
import { listAppointments } from '../../api-client.js'
import { cancelAppointment, commandKey, rescheduleAppointment } from '../../appointments-api.js'
import { clinic } from '../../clinic-config.js'
import { BookingCalendar, TimeSlots } from '../BookingCalendar.jsx'
import { dateLong, downloadIcs, splitAppointments, time12, todayManila } from '../format.js'
import { EmptyState, ErrorState, PageHead, Pill, Skeleton, useLoad } from '../ui.jsx'

const addDays = (date, n) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }

/** Visits: upcoming and past appointments from the server, with reschedule and cancel through the server's own commands. */
export function VisitsPage({ context, onNavigate, toast }) {
  const today = todayManila()
  const list = useLoad(() => listAppointments({ from: addDays(today, -90), to: addDays(today, 92), per_page: 100 }), [today])
  const [tab, setTab] = useState('upcoming')
  const [action, setAction] = useState(null) // {kind: 'cancel'|'reschedule', appointment}
  const { upcoming, past } = splitAppointments(list.data)
  const focusId = context?.appointmentId || context?.id || null
  useEffect(() => {
    if (!focusId || list.status !== 'ready') return
    if (past.some(a => a.id === focusId)) setTab('past')
    requestAnimationFrame(() => document.getElementById(`visit-${focusId}`)?.scrollIntoView({ block: 'center' }))
  }, [focusId, list.status])
  const shown = tab === 'upcoming' ? upcoming : past

  return <div className="pp-page">
    <PageHead eyebrow="Your visits" title="My visits" actions={<Button icon="plusCalendar" onClick={() => onNavigate('book')}>Book a visit</Button>}/>
    <div className="pp-tabs" role="tablist" aria-label="Visits">
      {[['upcoming', `Upcoming${list.status === 'ready' ? ` (${upcoming.length})` : ''}`], ['past', 'Past and cancelled']].map(([key, label]) =>
        <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)}>{label}</button>)}
    </div>
    {list.status === 'loading' && <Skeleton lines={4} label="Loading your visits"/>}
    {list.status === 'error' && <ErrorState text={list.error} onRetry={list.reload}/>}
    {list.status === 'ready' && !shown.length && (tab === 'upcoming'
      ? <EmptyState icon="calendar" title="No upcoming visits" text="When you book, your appointment appears here."><Button onClick={() => onNavigate('book')}>Book a visit</Button></EmptyState>
      : <EmptyState icon="clock" title="No past visits yet" text="Visits from the last three months appear here."/>)}
    {list.status === 'ready' && <ul className="pp-list" aria-label={tab === 'upcoming' ? 'Upcoming visits' : 'Past visits'}>
      {shown.map(a => <li key={a.id} id={`visit-${a.id}`} className={`pp-card pp-visit pp-fade ${focusId === a.id ? 'is-focus' : ''}`}>
        <div className="pp-visit-date" aria-hidden="true"><b>{Number(a.date.slice(8))}</b><span>{new Date(`${a.date}T00:00:00Z`).toLocaleDateString('en-PH', { month: 'short', timeZone: 'UTC' })}</span></div>
        <div className="pp-visit-body">
          <h3>{a.service?.name}</h3>
          <p>{dateLong(a.date)} · {time12(a.start_time)} – {time12(a.end_time)}</p>
          <p className="pp-muted"><Icon name="pin" size={14}/> {a.branch?.name}{a.dentist?.name ? ` · ${a.dentist.name}` : ''}</p>
          <p className="pp-muted">Ref. {a.code} <Pill>{a.status}</Pill></p>
          {tab === 'upcoming' && <div className="pp-actions">
            <Button size="sm" variant="soft" icon="download" onClick={() => downloadIcs({ id: a.id, service: a.service?.name, branchName: a.branch?.name, dentist: a.dentist?.name, startsAt: a.starts_at, endsAt: a.ends_at, clinicName: clinic.name }, `${a.code || 'appointment'}.ics`)}>Add to calendar</Button>
            <Button size="sm" variant="ghost" onClick={() => setAction({ kind: 'reschedule', appointment: a })}>Reschedule</Button>
            <Button size="sm" variant="ghost" className="pp-danger" onClick={() => setAction({ kind: 'cancel', appointment: a })}>Cancel</Button>
          </div>}
        </div>
      </li>)}
    </ul>}
    {action?.kind === 'cancel' && <CancelDialog appointment={action.appointment} onClose={() => setAction(null)} onDone={() => { setAction(null); toast?.('Your appointment is cancelled.', 'success'); list.reload({ quiet: true }) }}/>}
    {action?.kind === 'reschedule' && <RescheduleDialog appointment={action.appointment} onClose={() => setAction(null)} onDone={() => { setAction(null); toast?.('Your appointment is moved.', 'success'); list.reload({ quiet: true }) }}/>}
  </div>
}

function CancelDialog({ appointment, onClose, onDone }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const key = useRef(commandKey())
  const go = async () => {
    setBusy(true); setError('')
    const r = await cancelAppointment(appointment, key.current)
    setBusy(false)
    if (!r.ok) return setError(r.message)
    onDone()
  }
  return <Modal open title="Cancel this visit?" subtitle={`${appointment.service?.name} · ${dateLong(appointment.date)} at ${time12(appointment.start_time)}`} onClose={onClose}>
    <p>Your time will be released for other patients. You can book again any time.</p>
    {error && <p className="pp-error-text" role="alert">{error}</p>}
    <div className="form-actions"><Button variant="ghost" onClick={onClose}>Keep it</Button><Button className="pp-danger-solid" disabled={busy} onClick={go}>{busy ? 'Cancelling…' : 'Cancel visit'}</Button></div>
  </Modal>
}

function RescheduleDialog({ appointment, onClose, onDone }) {
  const [date, setDate] = useState(''), [slot, setSlot] = useState(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const key = useRef(commandKey())
  const go = async () => {
    setBusy(true); setError('')
    const r = await rescheduleAppointment(appointment, { date, start: slot.start_time }, key.current)
    setBusy(false)
    if (!r.ok) { key.current = commandKey(); return setError(r.message) }
    onDone()
  }
  return <Modal open title="Choose a new time" subtitle={`${appointment.service?.name} at ${appointment.branch?.name}`} onClose={onClose} wide>
    <BookingCalendar branchId={appointment.branch?.id} serviceId={appointment.service?.id} appointmentId={appointment.id} value={date} onChange={d => { setDate(d); setSlot(null) }}/>
    {date && <TimeSlots branchId={appointment.branch?.id} serviceId={appointment.service?.id} appointmentId={appointment.id} date={date} value={slot} onChange={setSlot}/>}
    {error && <p className="pp-error-text" role="alert">{error}</p>}
    <div className="form-actions"><Button variant="ghost" onClick={onClose}>Keep current time</Button><Button disabled={!slot || busy} onClick={go}>{busy ? 'Moving…' : slot ? `Move to ${dateLong(date, { year: false })}, ${time12(slot.start_time)}` : 'Choose a time'}</Button></div>
  </Modal>
}
