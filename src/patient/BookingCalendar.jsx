import React, { useEffect, useMemo, useState } from 'react'
import { Button, Icon } from '../components.jsx'
import { appointmentAvailability, bookingCalendar } from '../api-client.js'
import { dateLong, time12 } from './format.js'
import { ErrorState, Skeleton } from './ui.jsx'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const LABEL = { available: 'available', full: 'fully booked', closed: 'closed', past: 'not bookable', outside: 'outside the booking window' }

/**
 * Month calendar for booking (and rescheduling), in the passport-appointment pattern: closed and fully booked days are disabled and
 * look different, available days are highlighted, today is marked, and the months move only within the online booking window.
 * Every state comes from GET /api/appointments/calendar, i.e. the same rules the booking command enforces.
 */
export function BookingCalendar({ branchId, serviceId, dentistId = null, appointmentId = null, value, onChange }) {
  const [month, setMonth] = useState(value ? value.slice(0, 7) : null)
  const [state, setState] = useState({ status: 'loading', data: null, error: '' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (month && state.data?.month === month && state.status === 'ready') return undefined // the first load already returned this month
    let live = true
    setState(s => ({ ...s, status: 'loading' }))
    bookingCalendar({ branch_ref: branchId, service_ref: serviceId, dentist_ref: dentistId, appointment_id: appointmentId, month }).then(r => {
      if (!live) return
      setState(r.ok ? { status: 'ready', data: r.data, error: '' } : { status: 'error', data: null, error: r.message || 'The calendar could not be loaded.' })
      if (r.ok && !month) setMonth(r.data.month)
    })
    return () => { live = false }
  }, [branchId, serviceId, dentistId, appointmentId, month, attempt])

  const cells = useMemo(() => {
    if (!state.data) return []
    const [y, m] = state.data.month.split('-').map(Number)
    const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
    return [...Array.from({ length: lead }, () => null), ...state.data.days]
  }, [state.data])

  if (state.status === 'error') return <ErrorState text={state.error} onRetry={() => setAttempt(a => a + 1)}/>
  const data = state.data
  const title = data ? new Date(`${data.month}-01T00:00:00Z`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : 'Loading…'
  const anyAvailable = data?.days.some(d => d.status === 'available')

  return <div className="pp-cal" aria-busy={state.status === 'loading'}>
    <div className="pp-cal-head">
      <Button size="sm" variant="ghost" aria-label="Previous month" disabled={!data?.previous_month || state.status === 'loading'} onClick={() => setMonth(data.previous_month)}><Icon name="chevronLeft" size={18}/></Button>
      <h3 aria-live="polite">{title}</h3>
      <Button size="sm" variant="ghost" aria-label="Next month" disabled={!data?.next_month || state.status === 'loading'} onClick={() => setMonth(data.next_month)}><Icon name="chevron" size={18}/></Button>
    </div>
    {!data ? <Skeleton lines={5} card={false} label="Loading the calendar"/> : <>
      <div className="pp-cal-grid pp-cal-anim" key={data.month} role="grid" aria-label={`Available days in ${title}`}>
        {WEEKDAYS.map(d => <span key={d} className="pp-cal-dow" role="columnheader" aria-hidden="true">{d}</span>)}
        {cells.map((day, i) => day === null ? <span key={`b${i}`} className="pp-cal-blank" aria-hidden="true"/> : <button
          key={day.date} type="button" role="gridcell"
          className={`pp-cal-day is-${day.status} ${day.date === data.today ? 'is-today' : ''} ${value === day.date ? 'is-selected' : ''}`}
          disabled={day.status !== 'available'} aria-pressed={value === day.date}
          aria-label={`${dateLong(day.date)}, ${LABEL[day.status]}${day.date === data.today ? ', today' : ''}`}
          onClick={() => onChange(day.date)}>
          <span className="pp-cal-num">{Number(day.date.slice(8))}</span>
          {day.status === 'available' && <span className="pp-cal-dot" aria-hidden="true"/>}
        </button>)}
      </div>
      <div className="pp-cal-legend" aria-hidden="true"><span><i className="is-available"/>Available</span><span><i className="is-full"/>Fully booked</span><span><i className="is-closed"/>Closed</span><span><i className="is-today"/>Today</span></div>
      {!anyAvailable && <p className="pp-hint">No open days in this month{data.next_month ? ' — try the next month.' : '.'}</p>}
    </>}
  </div>
}

/** Time chips for one day, grouped Morning / Afternoon, from GET /api/appointments/availability (the real scheduling rules). */
export function TimeSlots({ branchId, serviceId, dentistId = null, appointmentId = null, date, value, onChange }) {
  const [state, setState] = useState({ status: 'loading', slots: [], error: '' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!date) return undefined
    let live = true
    setState({ status: 'loading', slots: [], error: '' })
    appointmentAvailability({ branch_ref: branchId, service_ref: serviceId, date, dentist_ref: dentistId, appointment_id: appointmentId }).then(r => {
      if (live) setState(r.ok ? { status: 'ready', slots: r.data?.slots || [], error: '' } : { status: 'error', slots: [], error: r.message || 'Times could not be loaded.' })
    })
    return () => { live = false }
  }, [branchId, serviceId, dentistId, appointmentId, date, attempt])

  if (!date) return null
  if (state.status === 'loading') return <Skeleton lines={2} card={false} label="Loading times"/>
  if (state.status === 'error') return <ErrorState text={state.error} onRetry={() => setAttempt(a => a + 1)}/>
  if (!state.slots.length) return <p className="pp-hint">This day just filled up. Please choose another day.</p>
  const groups = [['Morning', state.slots.filter(s => s.start_time < '12:00')], ['Afternoon', state.slots.filter(s => s.start_time >= '12:00')]].filter(([, list]) => list.length)

  return <div className="pp-times pp-fade">
    {groups.map(([label, list]) => <fieldset key={label} className="pp-time-group">
      <legend>{label}</legend>
      <div className="pp-chips">
        {list.map(slot => <button key={slot.start_time} type="button" className={`pp-chip ${value?.start_time === slot.start_time ? 'is-selected' : ''}`}
          aria-pressed={value?.start_time === slot.start_time} onClick={() => onChange(slot)}>
          <b>{time12(slot.start_time)}</b>{!dentistId && slot.dentist?.name && <small>{slot.dentist.name}</small>}
        </button>)}
      </div>
    </fieldset>)}
  </div>
}
