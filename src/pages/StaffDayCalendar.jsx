import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Card, Modal, Notice, PageHeader, Status } from '../components.jsx'
import { displayTime } from '../logic.js'
import { clinicNow } from '../clock.js'
import { useVisibleRefresh } from '../use-visible-refresh.js'
import {
  VIEWS, WEEKDAYS, createDayLoader, dayTotals, defaultCalendarDate, groupByDate, groupByDentist, isValidClinicDate, monthCells,
  periodContains, periodTarget, shiftPeriod, sourceLabel, statusMeaning, weekDays, weekRange,
} from '../day-calendar.js'

// M6 read-only Staff Appointment Calendar: Day, Week (Monday–Sunday) and Month views of one period at a time. Calendar data
// lives only in this page's own loader (src/day-calendar.js), so choosing a period never replaces the shared appointment
// window other pages use. No command of any kind is available here. Counts and "no appointments" appear only when the response
// for the period is complete; an incomplete one is labelled and shows no totals.

const fmt = (date, options) => new Date(`${date}T00:00:00`).toLocaleDateString('en-PH', options)
const longDate = date => fmt(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
const shortDay = date => fmt(date, { weekday: 'short', month: 'short', day: 'numeric' })
const VIEW_LABEL = { day: 'Day', week: 'Week', month: 'Month' }
const TODAY_LABEL = { day: 'Today', week: 'This week', month: 'This month' }

function periodTitle(view, date) {
  if (!isValidClinicDate(date)) return 'Choose a date'
  if (view === 'day') return longDate(date)
  if (view === 'week') { const { from, to } = weekRange(date); return `${shortDay(from)} – ${shortDay(to)}, ${to.slice(0, 4)}` }
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

function AppointmentButton({ a, onSelect, showDentist = false }) {
  return <button type="button" className="daycal-chip" aria-haspopup="dialog" onClick={() => onSelect(a.id)}>
    <span className="daycal-chip-time">{displayTime(a.start)}</span>
    <span className="daycal-chip-name">{a.patientName || 'Patient'}</span>
    <span className="daycal-chip-status">{a.status}{showDentist && a.dentistName ? ` · ${a.dentistName}` : ''}</span>
  </button>
}

/** One date with its appointments. `totals` is null unless the whole period was read, so no count or "none" is drawn without evidence. */
function DaySection({ date, rows, totals, today, onOpenDay, onSelect, level = 3 }) {
  const H = `h${level}`
  const verified = totals !== null
  return <section className={`daycal-day${date === today ? ' is-today' : ''}`} aria-labelledby={`daycal-d-${date}`}>
    <div className="daycal-day-head">
      <H id={`daycal-d-${date}`}><button type="button" className="daycal-daylink" onClick={() => onOpenDay(date)} aria-label={`Open ${longDate(date)} in Day view`}>{shortDay(date)}</button>{date === today && <span className="daycal-today daycal-today-tag">Today</span>}</H>
      {verified && rows.length > 0 && <span className="daycal-count">{rows.length} appointment{rows.length === 1 ? '' : 's'}</span>}
    </div>
    {rows.map(a => <AppointmentButton key={a.id} a={a} onSelect={onSelect} showDentist/>)}
    {verified && rows.length === 0 && <p className="daycal-none">No appointments</p>}
    {!verified && rows.length === 0 && <p className="daycal-none daycal-unverified">Not verified</p>}
  </section>
}

export function StaffDayCalendar({ store }) {
  const session = store.session
  const serverSession = !!session?.serverUserId
  const sessionKey = serverSession ? `${session.serverUserId}:${session.role}` : null
  const today = useClinicToday()
  const [view, setView] = useState('day')
  const [date, setDate] = useState(defaultCalendarDate)
  const [branchId, setBranchId] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [snapshot, setSnapshot] = useState({ status: 'idle', date: null, key: null, rows: [], complete: false, error: '', stale: false })
  const loaderRef = useRef(null)
  if (!loaderRef.current) loaderRef.current = createDayLoader({ onChange: setSnapshot })
  const loader = loaderRef.current
  const target = periodTarget(view, date)

  // One request per (view, date, session). Leaving the effect — a new period, a changed session, sign-out or unmount —
  // invalidates every response still in flight, so none of them can be applied afterwards.
  useEffect(() => {
    if (!sessionKey || !isValidClinicDate(date)) return undefined
    setSelectedId(null)
    loader.load(target, sessionKey)
    return () => loader.invalidate()
  }, [target, date, sessionKey, loader])
  useVisibleRefresh(() => loader.refresh(), { active: !!sessionKey, intervalMs: 60000 })

  // Staff reach only the branches the server scoped to them (/api/me branch_scopes); a filter appears only for several.
  const branches = useMemo(() => {
    const scopes = Array.isArray(session?.branchScopes) ? session.branchScopes : []
    return store.state.branches.filter(b => scopes.includes(b.id))
  }, [store.state.branches, session?.branchScopes])

  if (!serverSession) return <>
    <PageHeader kicker="Scheduling" title="Appointment Calendar" text="A read-only calendar of appointments from the clinic server."/>
    <Notice tone="info" title="Clinic server required">The Appointment Calendar reads appointments from the clinic server and isn’t available in the offline demo.</Notice>
  </>

  // Only render data that belongs to the period and session on screen; anything else is treated as still loading.
  const current = snapshot.date === target && snapshot.key === sessionKey ? snapshot : null
  const status = current?.status ?? 'loading'
  const rows = status === 'ready' ? current.rows : []
  const complete = status === 'ready' && current.complete
  const activeBranch = branches.length > 1 && branches.some(b => b.id === branchId) ? branchId : null
  const filtered = activeBranch ? rows.filter(r => r.branchId === activeBranch) : rows
  const byDate = groupByDate(rows, { branchId: activeBranch })
  const totals = dayTotals(rows, complete, { branchId: activeBranch })
  const selected = rows.find(r => r.id === selectedId) || null
  const containsToday = periodContains(view, date, today)
  const goto = next => { if (isValidClinicDate(next)) setDate(next) }
  const openDay = day => { setView('day'); goto(day) }
  const nounOf = { day: 'day', week: 'week', month: 'month' }[view]
  const rowsOn = d => byDate.get(d) || []
  const showSummary = complete && filtered.length > 0
  const groups = view === 'day' ? groupByDentist(rows, { branchId: activeBranch }) : []

  return <>
    <PageHeader kicker="Scheduling" title="Appointment Calendar" text="A read-only calendar of appointments by day, week or month. Booking changes are made on the Appointments page."/>
    <Card className="daycal-controls">
      <div className="daycal-bar">
        <div className="daycal-views" role="group" aria-label="Calendar view">
          {VIEWS.map(v => <button key={v} type="button" className={`daycal-view${v === view ? ' is-active' : ''}`} aria-pressed={v === view} onClick={() => setView(v)}>{VIEW_LABEL[v]}</button>)}
        </div>
        <Button variant="ghost" onClick={() => goto(shiftPeriod(view, date, -1))}>Previous {nounOf}</Button>
        {view === 'month'
          ? <label className="daycal-date"><span>Month</span><input type="month" value={date.slice(0, 7)} onChange={e => /^\d{4}-\d{2}$/.test(e.target.value) && goto(`${e.target.value}-01`)} aria-describedby="daycal-heading"/></label>
          : <label className="daycal-date"><span>{view === 'week' ? 'Any date in the week' : 'Date'}</span><input type="date" value={date} onChange={e => goto(e.target.value)} aria-describedby="daycal-heading"/></label>}
        <Button variant="ghost" onClick={() => goto(shiftPeriod(view, date, 1))}>Next {nounOf}</Button>
        <Button variant="soft" disabled={containsToday} onClick={() => goto(today)}>{TODAY_LABEL[view]}</Button>
        {branches.length > 1 && <label className="daycal-branch"><span>Branch</span>
          <select value={activeBranch ?? 'all'} onChange={e => setBranchId(e.target.value)}>
            <option value="all">All my branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select></label>}
      </div>
    </Card>

    <h2 id="daycal-heading" className="daycal-heading" tabIndex={-1}>{periodTitle(view, date)}{containsToday && <span className="daycal-today"> · {view === 'day' ? 'Today' : view === 'week' ? 'This week' : 'This month'}</span>}</h2>

    {status === 'loading' && <Notice tone="info" title="Loading appointments">Reading this {nounOf}’s appointments from the clinic server…</Notice>}
    {status === 'error' && <Notice tone="warning" title="Appointments couldn’t be loaded">{current.error} <Button size="sm" variant="ghost" onClick={() => loader.retry()}>Try again</Button></Notice>}
    {status === 'ready' && !current.complete && <Notice tone="warning" title={`Only part of this ${nounOf} was loaded`}>This {nounOf} has more appointments than this screen reads at once, so what is shown may be missing some. No totals are shown, and a date without appointments here is not confirmed empty. <Button size="sm" variant="ghost" onClick={() => loader.retry()}>Reload</Button></Notice>}
    {status === 'ready' && current.stale && <Notice tone="warning" title="Showing the last loaded list">The latest refresh failed: {current.error} This list may be out of date. <Button size="sm" variant="ghost" onClick={() => loader.retry()}>Try again</Button></Notice>}

    {complete && filtered.length === 0 && <Card><p className="muted-copy" role="status">{activeBranch && rows.length ? `No appointments for this branch ${view === 'day' ? 'on this date' : `this ${nounOf}`} (${rows.length} at your other branches).` : view === 'day' ? 'No appointments on this date.' : `No appointments this ${nounOf}.`}</p></Card>}
    {showSummary && <p className="muted-copy" role="status">{filtered.length} appointment{filtered.length === 1 ? '' : 's'}{view === 'day' ? '' : ` this ${nounOf}`}</p>}

    {status === 'ready' && view === 'day' && groups.map(group => <Card key={group.key} className="daycal-group" title={group.name} subtitle={group.key === 'unassigned' ? 'No Dentist on the record.' : complete ? `${group.rows.length} appointment${group.rows.length === 1 ? '' : 's'}` : undefined}>
      <ul className="daycal-list">
        {group.rows.map(a => <li key={a.id}>
          <button type="button" className="daycal-row" aria-haspopup="dialog" onClick={() => setSelectedId(a.id)}>
            <span className="daycal-time"><b>{displayTime(a.start)}</b><small>to {displayTime(a.end)}</small></span>
            <span className="daycal-main"><b>{a.patientName || 'Patient'}</b><small>{a.serviceName}{branches.length > 1 && a.branchName ? ` · ${a.branchName}` : ''}</small></span>
            <span className="daycal-status"><Status>{a.status}</Status></span>
          </button>
        </li>)}
      </ul>
    </Card>)}

    {status === 'ready' && view === 'week' && <div className="daycal-week">
      {weekDays(date).map(d => <DaySection key={d} date={d} rows={rowsOn(d)} totals={totals} today={today} onOpenDay={openDay} onSelect={setSelectedId}/>)}
    </div>}

    {status === 'ready' && view === 'month' && <>
      {/* Wide screens: a Monday-first grid. Narrow screens: the same month as a day-by-day list (CSS shows exactly one). */}
      <div className="daycal-month-grid" role="group" aria-label={`${periodTitle('month', date)} by day`}>
        {WEEKDAYS.map(w => <div key={w} className="daycal-weekday" aria-hidden="true">{w.slice(0, 3)}</div>)}
        {monthCells(date).map(c => {
          if (!c.fetched) return <div key={c.date} className="daycal-cell is-outside"><span className="daycal-cell-date">{Number(c.date.slice(8))}</span><span className="daycal-none daycal-unverified">Not loaded</span></div>
          const list = rowsOn(c.date), shown = list.slice(0, 3)
          return <div key={c.date} className={`daycal-cell${c.date === today ? ' is-today' : ''}`}>
            <div className="daycal-cell-head">
              <button type="button" className="daycal-daylink" onClick={() => openDay(c.date)} aria-label={`Open ${longDate(c.date)} in Day view`}>{Number(c.date.slice(8))}</button>
              {totals && list.length > 0 && <span className="daycal-count" aria-label={`${list.length} appointment${list.length === 1 ? '' : 's'}`}>{list.length}</span>}
            </div>
            {shown.map(a => <AppointmentButton key={a.id} a={a} onSelect={setSelectedId}/>)}
            {!totals && list.length === 0 && <span className="daycal-none daycal-unverified">Not verified</span>}
            {totals && list.length > shown.length && <button type="button" className="daycal-more" onClick={() => openDay(c.date)}>+{list.length - shown.length} more</button>}
          </div>
        })}
      </div>
      <div className="daycal-agenda">
        {monthCells(date).filter(c => c.fetched).map(c => <DaySection key={c.date} date={c.date} rows={rowsOn(c.date)} totals={totals} today={today} onOpenDay={openDay} onSelect={setSelectedId}/>)}
      </div>
    </>}

    <Modal open={!!selected} title="Appointment details" subtitle="Read-only. Changes are made on the Appointments page." onClose={() => setSelectedId(null)}>
      {selected && <dl className="daycal-detail">
        <div><dt>Appointment</dt><dd>{selected.code || '—'}</dd></div>
        <div><dt>Status</dt><dd><Status>{selected.status}</Status><small className="block-muted">{statusMeaning(selected.status)}</small></dd></div>
        <div><dt>Date and time</dt><dd>{longDate(selected.date)}, {displayTime(selected.start)} to {displayTime(selected.end)}{selected.duration ? ` (${selected.duration} min)` : ''}</dd></div>
        <div><dt>Patient</dt><dd>{selected.patientName || '—'}{selected.patientCode ? <small className="block-muted">{selected.patientCode}</small> : null}</dd></div>
        <div><dt>Service</dt><dd>{selected.serviceName || '—'}</dd></div>
        <div><dt>Dentist</dt><dd>{selected.dentistId ? selected.dentistName || '—' : 'Unassigned'}</dd></div>
        <div><dt>Branch</dt><dd>{selected.branchName || '—'}</dd></div>
        <div><dt>Booked via</dt><dd>{sourceLabel(selected.source)}</dd></div>
      </dl>}
    </Modal>
  </>
}
