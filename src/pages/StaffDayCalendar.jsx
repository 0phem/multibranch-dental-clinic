import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Card, ConfirmDialog, Modal, Notice, PageHeader, RefreshButton, Status } from '../components.jsx'
import { displayTime, patientName, dateLabel } from '../logic.js'
import { clinicNow, clinicDate } from '../clock.js'
import { useVisibleRefresh } from '../use-visible-refresh.js'
import { calendarLoad, getAppointment } from '../api-client.js'
import { commandKey } from '../appointments-api.js'
import { AppointmentForm } from './Scheduling.jsx'
import {
  VIEWS, WEEKDAYS, createDayLoader, dayTotals, defaultCalendarDate, groupByDate, isValidClinicDate, monthCells,
  periodContains, periodTarget, shiftPeriod, sourceLabel, statusMeaning, busynessStatus, COUNT_BUSYNESS_THRESHOLDS,
} from '../day-calendar.js'

// M6 interactive Staff/Owner Appointment Calendar: clean full monthly calendar by default with indefinite month navigation,
// daily appointment count previews, busyness indicators, and expandable daily appointment details with working actions
// (create, reschedule, cancel, pre-arrival no-show).

const fmt = (date, options) => new Date(`${date}T00:00:00`).toLocaleDateString('en-PH', options)
const longDate = date => fmt(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
const shortDay = date => fmt(date, { weekday: 'short', month: 'short', day: 'numeric' })

function monthTitle(date) {
  if (!isValidClinicDate(date)) return 'Choose a date'
  return fmt(date, { month: 'long', year: 'numeric' })
}

/** Clinic day, re-read every 15 s so "Today" stays correct across Asia/Manila midnight. */
function useClinicToday() {
  const [today, setToday] = useState(() => clinicNow().date)
  useEffect(() => {
    const timer = setInterval(() => setToday(clinicNow().date), 15000)
    return () => clearInterval(timer)
  }, [])
  return today
}

// F6: a stable avatar colour per patient (from the record id) and the patient's initials.
const AVATAR = ['#1865ac', '#0c7f75', '#8a4baf', '#b26a00', '#c2412b', '#2f6f3e', '#5b6b7f', '#a33a6b']
const initials = name => (name || 'P').split(/\s+/).filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase()
const avatarColour = id => AVATAR[[...String(id || '')].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 997, 7) % AVATAR.length]

/** F6 (R2-02): how full a day is — booked minutes against the dentists' minutes — as a number and a band, never colour alone. */
export function loadBand(day, crowded = 80) {
  if (!day) return null
  if (day.closed) return { band: 'closed', label: 'Closed', detail: day.reason || 'Closed' }
  if (day.percent == null) return { band: 'none', label: 'No dentist hours', detail: '' }
  const band = day.percent >= crowded ? 'crowded' : day.percent >= 50 ? 'busy' : day.percent > 0 ? 'light' : 'free'
  return { band, label: `${day.percent}% booked${band === 'crowded' ? ' · crowded' : ''}`, detail: `${day.appointments} appointment${day.appointments === 1 ? '' : 's'}, ${day.booked_minutes} of ${day.capacity_minutes} dentist minutes` }
}

function LoadBadge({ day, count = 0, crowded = 80 }) {
  const b = loadBand(day, crowded)
  if (b) return <span className={`daycal-load is-${b.band}`} title={b.detail}><i aria-hidden="true"/>{b.label}</span>
  const fallback = busynessStatus({ dayLoad: day, count, crowded })
  return <span className={`daycal-load is-${fallback.band}`} title={fallback.detail}><i aria-hidden="true"/>{fallback.shortLabel}</span>
}

function AppointmentButton({ a, onSelect, showDentist = false }) {
  return <button type="button" className="daycal-chip" aria-haspopup="dialog" onClick={e => { e.stopPropagation(); onSelect(a.id) }}>
    <span className="daycal-avatar" aria-hidden="true" style={{ background: avatarColour(a.patientId || a.patientCode) }}>{initials(a.patientName)}</span>
    <span className="daycal-chip-time">{displayTime(a.start)}</span>
    <span className="daycal-chip-name">{a.patientName || 'Patient'}{a.serviceName ? <small> · {a.serviceName}</small> : null}</span>
    <span className="daycal-chip-status">{a.status}{showDentist && a.dentistName ? ` · ${a.dentistName}` : ''}</span>
  </button>
}

function AppointmentAvatarButton({ a, onSelect }) {
  const name = patientName(a.patientName)
  const tooltip = `${name} · ${displayTime(a.start)} · ${a.serviceName || a.service || 'Appointment'}`
  return (
    <button
      type="button"
      className="daycal-avatar-badge"
      style={{ background: avatarColour(a.patientId || a.patientCode) }}
      title={tooltip}
      aria-label={tooltip}
      onClick={e => { e.stopPropagation(); onSelect(a.id) }}
    >
      {initials(a.patientName)}
    </button>
  )
}

export function StaffDayCalendar({ store }) {
  const session = store.session
  const role = session?.role || 'staff'
  const toast = store.toast || (() => {})
  const serverSession = !!session?.serverUserId
  const sessionKey = serverSession ? `${session.serverUserId}:${session.role}` : null
  const today = useClinicToday()
  const [date, setDate] = useState(defaultCalendarDate)
  const [branchId, setBranchId] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [selectedDate, setSelectedDate] = useState(() => clinicNow().date)
  const [newOpen, setNewOpen] = useState(false)
  const [reschedule, setReschedule] = useState(null)
  const [cancelling, setCancelling] = useState(null)
  const [missed, setMissed] = useState(null)
  const [snapshot, setSnapshot] = useState({ status: 'idle', date: null, key: null, rows: [], complete: false, error: '', stale: false })
  const loaderRef = useRef(null)
  if (!loaderRef.current) loaderRef.current = createDayLoader({ onChange: setSnapshot })
  const loader = loaderRef.current
  const target = periodTarget('month', date)

  // One request per month session. Leaving the effect invalidates every in-flight response.
  useEffect(() => {
    if (!sessionKey || !isValidClinicDate(date)) return undefined
    setSelectedId(null)
    loader.load(target, sessionKey)
    return () => loader.invalidate()
  }, [target, date, sessionKey, loader])
  useVisibleRefresh(() => loader.refresh(), { active: !!sessionKey, intervalMs: 60000 })

  // Staff reach only the branches scoped to them (/api/me branch_scopes); the Owner sees every open branch.
  const branches = useMemo(() => {
    if (session?.role === 'owner') return store.state.branches
    const scopes = Array.isArray(session?.branchScopes) ? session.branchScopes : []
    return store.state.branches.filter(b => scopes.includes(b.id))
  }, [store.state.branches, session?.branchScopes, session?.role])

  const [load, setLoad] = useState({ key: null, days: {}, crowded: 80 })
  const loadParams = useMemo(() => {
    const branch = branches.length > 1 && branches.some(b => b.id === branchId) ? branchId : null
    const cells = monthCells(date)
    const r = { from: cells[0]?.date, to: cells[cells.length - 1]?.date }
    return { key: `${r.from}:${r.to}:${branch || 'all'}`, from: r.from, to: r.to, branch }
  }, [date, branchId, branches])

  useEffect(() => {
    if (!sessionKey || !loadParams?.from || !loadParams?.to) return undefined
    let live = true
    calendarLoad({ from: loadParams.from, to: loadParams.to, branch_ref: loadParams.branch || undefined }).then(r => {
      if (live && r.ok) setLoad({ key: loadParams.key, crowded: r.data.crowded_percent, note: r.data.capacity_note || null, days: Object.fromEntries((r.data.days || []).map(d => [d.date, d])) })
    })
    return () => { live = false }
  }, [sessionKey, loadParams?.key])

  if (!serverSession) return <>
    <PageHeader kicker="Scheduling" title="Appointment Calendar" text="A read-only calendar of appointments from the clinic server."/>
    <Notice tone="info" title="Clinic server required">The Appointment Calendar reads appointments from the clinic server and isn’t available in the offline demo.</Notice>
  </>

  const current = snapshot.date === target && snapshot.key === sessionKey ? snapshot : null
  const status = current?.status ?? 'loading'
  const rows = status === 'ready' ? current.rows : []
  const complete = status === 'ready' && current.complete
  const activeBranch = branches.length > 1 && branches.some(b => b.id === branchId) ? branchId : null
  const filtered = activeBranch ? rows.filter(r => r.branchId === activeBranch) : rows
  const byDate = groupByDate(rows, { branchId: activeBranch })
  const totals = dayTotals(rows, complete, { branchId: activeBranch })
  const verified = totals !== null
  const selected = rows.find(r => r.id === selectedId) || null
  const containsToday = periodContains('month', date, today)

  const goto = next => {
    if (isValidClinicDate(next)) {
      setDate(next)
      setSelectedDate(null)
      setSelectedId(null)
    }
  }

  const rowsOn = d => byDate.get(d) || []
  const loadOf = d => (load.key === loadParams.key ? load.days[d] : null)
  const canManage = session?.role === 'staff' || session?.role === 'owner'

  const handleRefresh = () => {
    loader.refresh()
    store.appointmentFlow?.refresh()
  }

  const resolveAppointment = async row => {
    const fromStore = store.state.appointments.find(x => x.id === row.id)
    if (fromStore?.serviceId && fromStore?.patientPublicId) return fromStore
    try {
      const res = await getAppointment(row.id)
      if (res?.ok && res.data) {
        return {
          ...row,
          revision: res.data.revision ?? 1,
          appointmentNo: res.data.code || row.code,
          patientPublicId: res.data.patient?.id ?? null,
          patientName: res.data.patient?.name ?? row.patientName,
          patientCode: res.data.patient?.code ?? row.patientCode,
          serviceId: res.data.service?.id ?? null,
          serviceName: res.data.service?.name ?? row.serviceName,
          branchId: res.data.branch?.id ?? row.branchId,
          dentistId: res.data.dentist?.id ?? row.dentistId,
        }
      }
    } catch {}
    return fromStore || { ...row, revision: 1, appointmentNo: row.code }
  }

  const onStartReschedule = async a => {
    const full = await resolveAppointment(a)
    setReschedule(full)
  }

  const onStartCancel = async a => {
    const full = await resolveAppointment(a)
    setCancelling(full)
  }

  const onStartNoShow = async a => {
    const full = await resolveAppointment(a)
    setMissed(full)
  }

  const cancel = async () => {
    const a = cancelling; setCancelling(null)
    const result = await store.appointmentFlow.cancel(a, commandKey())
    if (result.ok && result.warning) toast(result.warning, 'warning')
    toast(result.ok ? 'Appointment cancelled.' : result.message, result.ok ? 'success' : 'warning')
    if (result.ok) handleRefresh()
  }

  const markNoShow = async () => {
    const a = missed; setMissed(null)
    const result = await store.appointmentFlow.noShow(a, commandKey())
    if (result.ok && result.warning) toast(result.warning, 'warning')
    toast(result.ok ? 'Marked as No-show.' : result.message, result.ok ? 'success' : 'warning')
    if (result.ok) handleRefresh()
  }

  const [dayStatusFilter, setDayStatusFilter] = useState('All')
  useEffect(() => { setDayStatusFilter('All') }, [selectedDate])
  const selectedRows = selectedDate ? rowsOn(selectedDate) : []
  const selectedLoad = selectedDate ? loadOf(selectedDate) : null
  const visibleDayRows = selectedRows.filter(a => {
    if (dayStatusFilter !== 'All' && a.status !== dayStatusFilter) return false
    return true
  })

  return <>
    <PageHeader
      kicker="Scheduling"
      title="Appointment Calendar"
      text="An interactive monthly calendar of clinic appointments with daily busyness, patient details, and booking controls."
      aside={<div className="row-actions">
        <RefreshButton onClick={handleRefresh}/>
      </div>}
    />

    <Card className="daycal-controls">
      <div className="daycal-bar">
        <Button variant="ghost" onClick={() => goto(shiftPeriod('month', date, -1))}>Previous month</Button>
        <label className="daycal-date">
          <span>Month</span>
          <input
            type="month"
            value={date.slice(0, 7)}
            onChange={e => /^\d{4}-\d{2}$/.test(e.target.value) && goto(`${e.target.value}-01`)}
            aria-describedby="daycal-heading"
          />
        </label>
        <Button variant="ghost" onClick={() => goto(shiftPeriod('month', date, 1))}>Next month</Button>
        <Button variant="soft" disabled={containsToday} onClick={() => goto(today)}>Today</Button>
        {branches.length > 1 && <label className="daycal-branch">
          <span>Branch</span>
          <select value={activeBranch ?? 'all'} onChange={e => setBranchId(e.target.value)}>
            <option value="all">All my branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>}
      </div>
    </Card>

    <p className="daycal-legend" aria-label="Load legend">
      <span className="daycal-load is-free"><i aria-hidden="true"/>0% free</span>
      <span className="daycal-load is-light"><i aria-hidden="true"/>under 50%</span>
      <span className="daycal-load is-busy"><i aria-hidden="true"/>50% or more</span>
      <span className="daycal-load is-crowded"><i aria-hidden="true"/>{load.crowded}% or more: crowded</span>
      <span className="daycal-load is-closed"><i aria-hidden="true"/>Closed</span>
      <small>Booked minutes against the dentists’ hours at the branch.</small>
      {load.note && <small className="daycal-estimate" role="note">{load.note}</small>}
    </p>

    <h2 id="daycal-heading" className="daycal-heading" tabIndex={-1}>
      {monthTitle(date)}{containsToday && <span className="daycal-today"> · This month</span>}
    </h2>

    {status === 'loading' && <Notice tone="info" title="Loading appointments">Reading this month’s appointments from the clinic server…</Notice>}
    {status === 'error' && <Notice tone="warning" title="Appointments couldn’t be loaded">{current.error} <Button size="sm" variant="ghost" onClick={() => loader.retry()}>Try again</Button></Notice>}
    {status === 'ready' && !current.complete && <Notice tone="warning" title="Only part of this month was loaded">This month has more appointments than this screen reads at once, so what is shown may be missing some. No totals are shown, and a date without appointments here is not confirmed empty. <Button size="sm" variant="ghost" onClick={() => loader.retry()}>Reload</Button></Notice>}
    {status === 'ready' && current.stale && <Notice tone="warning" title="Showing the last loaded list">The latest refresh failed: {current.error} This list may be out of date. <Button size="sm" variant="ghost" onClick={() => loader.retry()}>Try again</Button></Notice>}

    {complete && filtered.length === 0 && <Card><p className="muted-copy" role="status">{activeBranch && rows.length ? `No appointments for this branch this month (${rows.length} at your other branches).` : 'No appointments this month.'}</p></Card>}
    {complete && filtered.length > 0 && <p className="muted-copy" role="status">{filtered.length} appointment{filtered.length === 1 ? '' : 's'} this month</p>}

    <div className="daycal-master-detail">
      <div className="daycal-calendar-pane">
        <div className="daycal-month-grid" role="grid" aria-label={`${monthTitle(date)} by day`}>
          {WEEKDAYS.map(w => <div key={w} className="daycal-weekday" aria-hidden="true">{w.slice(0, 3)}</div>)}
          {monthCells(date).map(c => {
            if (!c.fetched) return <div key={c.date} className="daycal-cell is-outside" onClick={() => goto(c.date)} role="gridcell"><span className="daycal-cell-date">{Number(c.date.slice(8))}</span><span className="daycal-none daycal-unverified">Not loaded</span></div>
            const list = rowsOn(c.date)
            const shown = list.slice(0, 3)
            const band = loadBand(loadOf(c.date), load.crowded)
            const isSelected = selectedDate === c.date
            const isPrior = c.date < today

            return <div
              key={c.date}
              className={`daycal-cell${c.date === today ? ' is-today' : ''}${isPrior ? ' past-day' : ''}${isSelected ? ' is-selected' : ''}${band ? ` load-${band.band}` : ''}`}
              onClick={() => setSelectedDate(prev => prev === c.date ? null : c.date)}
              role="gridcell"
              aria-selected={isSelected}
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDate(prev => prev === c.date ? null : c.date) } }}
            >
              <div className="daycal-cell-head">
                <button
                  type="button"
                  className="daycal-daylink"
                  onClick={e => { e.stopPropagation(); setSelectedDate(prev => prev === c.date ? null : c.date) }}
                  aria-label={`Select ${longDate(c.date)}`}
                >
                  {Number(c.date.slice(8))}
                </button>
                {c.date === today && <span className="daycal-today daycal-today-tag">Today</span>}
                {totals && list.length > 0 && <span className="daycal-count" aria-label={`${list.length} appointment${list.length === 1 ? '' : 's'}`}>{list.length}</span>}
              </div>

              <div className="daycal-cell-meta">
                {totals && (
                  list.length > 0
                    ? <span className="daycal-count-label">{list.length} {list.length === 1 ? 'appointment' : 'appointments'}</span>
                    : <span className="daycal-none">No appointments</span>
                )}
                {!totals && list.length === 0 && <span className="daycal-none daycal-unverified">Not verified</span>}
                <LoadBadge day={loadOf(c.date)} count={list.length} crowded={load.crowded}/>
              </div>

              <div className="daycal-cell-chips daycal-avatars-row" aria-label={`${list.length} appointments`}>
                {shown.map(a => <AppointmentAvatarButton key={a.id} a={a} onSelect={setSelectedId}/>)}
                {totals && list.length > shown.length && <button type="button" className="daycal-avatar-badge daycal-more-avatar" title={`+${list.length - shown.length} more appointments`} aria-label={`+${list.length - shown.length} more appointments`} onClick={e => { e.stopPropagation(); setSelectedDate(c.date) }}>+{list.length - shown.length}</button>}
              </div>
            </div>
          })}
        </div>
      </div>

      <aside className="daycal-details-pane">
        {selectedDate ? (
          <Card className="daycal-expanded-day" aria-labelledby="daycal-selected-heading">
            <div className="daycal-expanded-header">
              <div>
                <h3 id="daycal-selected-heading" className="daycal-expanded-title">
                  Appointments for {longDate(selectedDate)}
                  {selectedDate === today && <span className="daycal-today daycal-today-tag">Today</span>}
                </h3>
                <p className="daycal-expanded-meta">
                  {verified
                    ? (selectedRows.length === 0 ? 'No appointments scheduled on this date.' : `${selectedRows.length} appointment${selectedRows.length === 1 ? '' : 's'} scheduled`)
                    : 'Reading appointment details from the clinic server…'}
                  {selectedLoad?.closed && ` · Closed (${selectedLoad.reason || 'Closed'})`}
                </p>
              </div>
              <div className="row-actions">
                <Button size="sm" variant="ghost" onClick={() => setSelectedDate(null)}>Close</Button>
              </div>
            </div>

            {verified && selectedRows.length === 0 && <div className="daycal-expanded-empty">
              <p className="muted-copy">No appointments are scheduled for this date.</p>
              {canManage && <Button size="sm" variant="soft" onClick={() => setNewOpen(true)} icon="plusCalendar">Book an appointment on {shortDay(selectedDate)}</Button>}
            </div>}

            {selectedRows.length > 0 && <div className="daycal-day-filter" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
              <select
                id="daycal-status-filter"
                className="filter-select"
                aria-label="Filter selected day appointments by status"
                value={dayStatusFilter}
                onChange={e => setDayStatusFilter(e.target.value)}
                style={{ fontSize: '13px' }}
              >
                <option value="All">All statuses ({selectedRows.length})</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
                <option value="No-show">No-show</option>
              </select>
            </div>}

            {selectedRows.length > 0 && visibleDayRows.length === 0 && <div className="daycal-expanded-empty">
              <p className="muted-copy">No appointments with status &ldquo;{dayStatusFilter}&rdquo; on this date.</p>
            </div>}

            {visibleDayRows.length > 0 && <ul className="daycal-expanded-list">
              {visibleDayRows.map(a => <li key={a.id} className="daycal-expanded-card">
                <div className="daycal-expanded-main">
                  <span className="daycal-avatar" aria-hidden="true" style={{ background: avatarColour(a.patientId || a.patientCode) }}>{initials(a.patientName)}</span>
                  <div className="daycal-expanded-info">
                    <div className="daycal-expanded-patient">
                      <strong>{a.patientName || 'Patient'}</strong>
                      {a.patientCode && <small className="block-muted">{a.patientCode}</small>}
                    </div>
                    <div className="daycal-expanded-time">
                      <span className="daycal-time-badge">{displayTime(a.start)}–{displayTime(a.end)}</span>
                      {a.duration && <small className="block-muted">({a.duration} min)</small>}
                    </div>
                    <div className="daycal-expanded-details">
                      <span className="daycal-service-name">{a.serviceName || 'Consultation'}</span>
                      <span className="daycal-meta-dot" aria-hidden="true">·</span>
                      <span className="daycal-dentist-name">{a.dentistName || 'Unassigned Dentist'}</span>
                      {branches.length > 1 && a.branchName && <>
                        <span className="daycal-meta-dot" aria-hidden="true">·</span>
                        <span className="daycal-branch-name">{a.branchName}</span>
                      </>}
                    </div>
                  </div>
                  <div className="daycal-expanded-status">
                    <Status>{a.status}</Status>
                  </div>
                </div>
                <div className="daycal-expanded-actions">
                  <Button size="sm" variant="ghost" onClick={() => setSelectedId(a.id)}>Details</Button>
                  {canManage && ['Confirmed', 'Pending'].includes(a.status) && <>
                    <Button size="sm" variant="soft" onClick={() => onStartReschedule(a)}>Reschedule</Button>
                    <Button size="sm" variant="ghost" onClick={() => onStartCancel(a)}>Cancel</Button>
                    {a.date === clinicDate() && <Button size="sm" variant="ghost" onClick={() => onStartNoShow(a)}>No-show</Button>}
                  </>}
                </div>
              </li>)}
            </ul>}
          </Card>
        ) : (
          <Card className="daycal-expanded-day daycal-details-empty">
            <div className="daycal-expanded-header">
              <div>
                <h3 className="daycal-expanded-title">Day Schedule</h3>
                <p className="daycal-expanded-meta">Select a date on the calendar</p>
              </div>
            </div>
            <div className="daycal-expanded-empty">
              <p className="muted-copy">Click any calendar date to inspect scheduled appointments and dentist capacity.</p>
              <Button size="sm" variant="soft" onClick={() => setSelectedDate(today)}>View Today ({shortDay(today)})</Button>
            </div>
          </Card>
        )}
      </aside>
    </div>

    <Modal open={newOpen} title="Create appointment" subtitle="The clinic server validates the slot and assigns an eligible Dentist unless you choose one." wide onClose={() => setNewOpen(false)}>
      <AppointmentForm role={role} store={store} prefill={selectedDate ? { date: selectedDate, ...(activeBranch && activeBranch !== 'all' ? { branchId: activeBranch } : {}) } : null} onSaved={() => { setNewOpen(false); handleRefresh() }}/>
    </Modal>

    <Modal open={!!reschedule} title="Reschedule appointment" subtitle="The new time must pass the same conflict-prevention rules as a new booking." wide onClose={() => setReschedule(null)}>
      {reschedule && <AppointmentForm role={role} store={store} appointment={reschedule} submitLabel="Save new time" onSaved={() => { setReschedule(null); handleRefresh() }}/>}
    </Modal>

    <ConfirmDialog open={!!cancelling} title="Cancel this appointment?" confirmLabel="Cancel appointment" cancelLabel="Keep appointment" tone="danger" onConfirm={cancel} onCancel={() => setCancelling(null)}>
      {cancelling && <p>{cancelling.code || cancelling.appointmentNo} • {dateLabel(cancelling.date)} at {displayTime(cancelling.start)} • {cancelling.patientName}. The reserved time will be released.</p>}
    </ConfirmDialog>

    <ConfirmDialog open={!!missed} title="Mark as No-show?" confirmLabel="Mark No-show" cancelLabel="Keep appointment" tone="danger" onConfirm={markNoShow} onCancel={() => setMissed(null)}>
      {missed && <p>{missed.code || missed.appointmentNo} • today at {displayTime(missed.start)} • {missed.patientName}. Use this only when the patient did not arrive; no visit is created. A patient who has already checked in can’t be marked No-show.</p>}
    </ConfirmDialog>

    <Modal open={!!selected} title="Appointment details" subtitle="Clinic appointment record from the clinic server." onClose={() => setSelectedId(null)}>
      {selected && <dl className="daycal-detail">
        <div><dt>Appointment</dt><dd>{selected.code || '—'}</dd></div>
        <div><dt>Status</dt><dd><Status>{selected.status}</Status><small className="block-muted">{statusMeaning(selected.status)}</small></dd></div>
        <div><dt>Date and time</dt><dd>{longDate(selected.date)}, {displayTime(selected.start)} to {displayTime(selected.end)}{selected.duration ? ` (${selected.duration} min)` : ''}</dd></div>
        <div><dt>Patient</dt><dd>{selected.patientName || '—'}{selected.patientCode ? <small className="block-muted">{selected.patientCode}</small> : null}</dd></div>
        <div><dt>Service</dt><dd>{selected.serviceName || '—'}</dd></div>
        <div><dt>Dentist</dt><dd>{selected.dentistId ? selected.dentistName || '—' : 'Unassigned'}</dd></div>
        <div><dt>Branch</dt><dd>{selected.branchName || '—'}</dd></div>
        <div><dt>Booking payment</dt><dd>{selected.bookingPaymentStatus === 'paid' ? `Deposit paid${selected.bookingPaymentMethod ? ` (${selected.bookingPaymentMethod})` : ''}` : selected.bookingPaymentStatus === 'held' ? 'Pre-authorized (held)' : selected.bookingPaymentStatus === 'refunded' ? 'Refunded' : selected.bookingPaymentStatus === 'forfeited' ? 'Forfeited' : 'Unpaid'}</dd></div>
        <div><dt>Booked via</dt><dd>{sourceLabel(selected.source)}</dd></div>
      </dl>}
    </Modal>
  </>
}
