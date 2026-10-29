import React, { useEffect, useMemo, useState } from 'react'
import { Button, Card, ConfirmDialog, Field, FilterBar, Notice, PageHeader } from '../components.jsx'
import {
  addScheduleException, cancelLeave, copyProfileHours, decideLeave, leaveCalendar, leaveConflicts, leaveRequests, myLeave, notifyLeaveAffected,
  notifyScheduleAffected, removeScheduleException, requestLeave, saveWeeklyHours, scheduleAffected, updateStaffProfile, workSchedules,
} from '../api-client.js'
import { commandKey, rescheduleAppointment } from '../appointments-api.js'
import { dutyForBranch } from '../work-hours-duty.js'
import '../den12-work-hours.css'

const firstError = r => (r.kind === 'validation' ? Object.values(r.errors || {})[0]?.[0] || r.message : r.message) || 'That did not work.'
const t12 = hm => { if (!hm) return ''; const [h, m] = hm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` }
const longDate = d => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
const manilaToday = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10)
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10)

/**
 * Appointments a schedule change, a day off or approved leave left without their dentist (M3/M15). Never cancelled: each row
 * shows suggested cover (another dentist at the branch who is free then) with a one-click move through the normal reschedule
 * command, and the list has one action to email those patients a reschedule link (Owner-approved wording only).
 */
export function AffectedAppointments({ rows, wordingApproved, onNotify, onChanged, toast, canAct = true }) {
  const [busy, setBusy] = useState('')
  if (!rows) return null
  if (!rows.length) return <p className="au-muted">No booked appointments are affected.</p>
  const move = async (a, dentist) => {
    setBusy(a.id + dentist.id)
    const r = await rescheduleAppointment({ id: a.id, revision: a.revision }, { date: a.date, start: a.start_time, dentistId: dentist.id }, commandKey())
    setBusy('')
    if (!r.ok) return toast(r.message || 'The appointment could not be moved. Reload and try again.', 'warning')
    toast(`${a.patient} is now with ${dentist.name} at the same time.`, 'success'); onChanged?.()
  }
  const notify = async () => {
    setBusy('notify')
    const r = await onNotify()
    setBusy('')
    if (!r.ok) return toast(firstError(r), 'warning')
    toast(`Told ${r.data.emailed + r.data.in_app_only} patient(s)${r.data.in_app_only ? ` (${r.data.in_app_only} in the app only)` : ''}${r.data.already ? `, ${r.data.already} already told` : ''}.`, 'success'); onChanged?.()
  }
  return <div className="st-affected">
    <Notice tone="warning" title={`${rows.length} booked appointment(s) affected`}>Nothing was cancelled. Move each one to another dentist, or email the patients a link to choose a new time.</Notice>
    <ul className="fd-list">{rows.map(a => <li key={a.id}>
      <div><b>{longDate(a.date)} · {a.time} · {a.patient}</b><span>{a.service} · {a.branch}{a.notified ? ' · patient told' : ''}</span>
        {!a.cover.length && <span>No other dentist is free at that time.</span>}</div>
      {canAct && <div className="ns-actions">{a.cover.slice(0, 2).map(d => <Button key={d.id} size="sm" variant="soft" disabled={!!busy} onClick={() => move(a, d)}>{busy === a.id + d.id ? 'Moving…' : `Move to ${d.name}`}</Button>)}</div>}
    </li>)}</ul>
    {canAct && <div className="au-actions"><Button size="sm" icon="mail" disabled={!!busy || wordingApproved === false} onClick={notify}
      title={wordingApproved === false ? 'The Owner must approve the “Dentist unavailable” email wording first' : undefined}>{busy === 'notify' ? 'Sending…' : 'Email them a reschedule link'}</Button>
      {wordingApproved === false && <span className="au-muted">The Owner must approve the “Dentist unavailable” wording first (Automations → wording).</span>}</div>}
  </div>
}

// ---- M3 Work schedules ----------------------------------------------------------------------------------------------

export function WorkSchedulesPage({ store, role }) {
  const toast = store?.toast || (() => {})
  const [data, setData] = useState(null), [error, setError] = useState(''), [selected, setSelected] = useState(''), [affected, setAffected] = useState(null), [approved, setApproved] = useState(true), [scheduleRole, setScheduleRole] = useState('dentist'), [selectedStaff, setSelectedStaff] = useState(''), [staffEditing, setStaffEditing] = useState(false), [staffStart, setStaffStart] = useState('09:00'), [staffEnd, setStaffEnd] = useState('18:00'), [staffBranch, setStaffBranch] = useState(''), [staffSaving, setStaffSaving] = useState(false)
  const load = () => workSchedules().then(r => { if (r.ok) { setData(r.data); setError(''); setApproved(r.data.wording_approved); const ownDentist = role === 'dentist' ? (r.data.dentists.find(d => d.id === store?.session?.dentistId || d.userId === store?.session?.userId)) : null; setSelected(s => s || ownDentist?.id || r.data.dentists[0]?.id || '') } else setError(r.message || 'Work schedules could not be loaded.') })
  useEffect(() => { load() }, [])
  const dentist = data?.dentists.find(d => d.id === selected)
  const dutyBranches = role === 'staff'
    ? (dentist?.branches || []).filter(branch => data?.duty?.rows?.some(row => row.dentist_id === dentist.id && row.branch_id === branch.id))
    : (dentist?.branches || [])
  const refreshAffected = () => dentist && scheduleAffected(dentist.id).then(r => { if (r.ok) { setAffected(r.data.affected); setApproved(r.data.wording_approved) } })
  useEffect(() => { setAffected(null); refreshAffected() }, [selected])
  const after = r => { if (r.data?.affected) setAffected(r.data.affected); load() }
  const editable = dentist?.branches.some(b => b.editable)
  const canEdit = role === 'owner' && editable
  const ownStaffProfile = role === 'staff'
    ? (store?.state?.staff || []).find(s => s.userId === store?.session?.userId || s.id === store?.session?.staffId)
    : null
  const rawStaff = (data?.staff && data.staff.length > 0) ? data.staff : (store?.state?.staff || [])
  const staffList = rawStaff.map(s => {
    const rawBranchName = s.branch?.name || s.branch || 'Dr. Dana Roxas Dental Clinic'
    const foundBranch = store?.state?.branches?.find(b => b.name === rawBranchName || b.id === s.branch?.id || b.id === s.branchId)
    return { id: s.id, name: s.name || s.fullName || s.id, title: s.title || s.staffType || s.role || 'Staff', branch: foundBranch ? foundBranch.name : rawBranchName, branchRef: foundBranch ? foundBranch.id : (s.branch?.id || 'b1'), shiftStart: s.shift_start || s.shiftStart || '09:00', shiftEnd: s.shift_end || s.shiftEnd || '18:00', available: s.available !== false }
  })
  const currentStaff = staffList.find(s => s.id === (selectedStaff || staffList[0]?.id)) || staffList[0]

  useEffect(() => {
    if (currentStaff) {
      setStaffStart(currentStaff.shiftStart || '09:00')
      setStaffEnd(currentStaff.shiftEnd || '18:00')
      setStaffBranch(currentStaff.branchRef || '')
    }
  }, [currentStaff?.id])

  const handleSaveStaffShift = async (e) => {
    e.preventDefault()
    if (!currentStaff) return
    setStaffSaving(true)
    const payload = {
      shift_start: staffStart,
      shift_end: staffEnd,
      branch_ref: staffBranch || currentStaff.branchRef
    }
    const r = await updateStaffProfile(currentStaff.id, payload)
    setStaffSaving(false)
    if (!r.ok) {
      toast(firstError(r) || 'Could not update staff schedule', 'warning')
      return
    }
    toast(`Updated shift for ${currentStaff.name}: ${t12(staffStart)}–${t12(staffEnd)}.`, 'success')
    setStaffEditing(false)
    load()
  }

  return <div className="st-page">
    <PageHeader kicker={role === 'dentist' ? 'My hours' : role === 'owner' ? 'Administration' : 'Team'} title={role === 'dentist' ? 'My work hours' : 'Work schedules'}
      text="Each dentist’s weekly hours per branch, and dated exceptions. Online booking, the front desk, walk-ins and the calendar use only these hours, inside the branch’s opening hours and minus approved leave. A change never cancels an appointment."/>
    {role === 'staff' && (
      <Notice tone="info" title="My assigned staff shift (read-only)">
        {ownStaffProfile
          ? `Your assigned shift at ${ownStaffProfile.branch || 'your branch'} is ${t12(ownStaffProfile.shiftStart)}–${t12(ownStaffProfile.shiftEnd)} (${ownStaffProfile.staffType || ownStaffProfile.title || 'Staff'}). Staff cannot edit their own assigned work schedule; only the Clinic Owner or an authorized administrator can update staff shifts.`
          : 'Staff cannot edit their own assigned work schedule; only the Clinic Owner or an authorized administrator can update staff shifts. To request time off, submit a request under Leave.'}
      </Notice>
    )}
    {error && <Notice tone="warning" title="Unavailable">{error}</Notice>}
    {role !== 'dentist' && (
      <div className="st-role-toggle" role="tablist" aria-label="Schedule role selector" style={{display:'flex',gap:'8px',marginBottom:'12px'}}>
        <Button variant={scheduleRole === 'dentist' ? 'primary' : 'soft'} size="sm" onClick={() => setScheduleRole('dentist')} role="tab" aria-selected={scheduleRole === 'dentist'}>Dentist schedules</Button>
        <Button variant={scheduleRole === 'staff' ? 'primary' : 'soft'} size="sm" onClick={() => setScheduleRole('staff')} role="tab" aria-selected={scheduleRole === 'staff'}>Staff schedules</Button>
      </div>
    )}
    {scheduleRole === 'staff' ? (
      !staffList.length ? <Notice>No staff members found for your branch.</Notice> : (
        <>
          <Card title="Staff work schedules">
            <Field label="Staff member">
              <select value={selectedStaff || currentStaff?.id || ''} onChange={e => { setSelectedStaff(e.target.value); setStaffEditing(false) }} aria-label="Select staff member">
                {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.title} · {s.branch})</option>)}
              </select>
            </Field>
            {currentStaff && (
              <div style={{marginTop:'12px',padding:'12px',borderRadius:'6px',background:'var(--surface-subtle, #f8fafc)',border:'1px solid var(--line)'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:'8px'}}>
                  <div>
                    <b style={{fontSize:'15px',display:'block'}}>{currentStaff.name}</b>
                    <span className="au-muted" style={{fontSize:'13px'}}>{currentStaff.title} · Branch: {currentStaff.branch}</span>
                    <div style={{marginTop:'4px',fontSize:'13px'}}>
                      <span><b>Assigned shift:</b> {t12(currentStaff.shiftStart)}–{t12(currentStaff.shiftEnd)}</span>
                      <span style={{marginLeft:'12px'}} className={`fd-badge ${currentStaff.available ? 'is-ok' : 'is-bad'}`}>
                        {currentStaff.available ? 'Marked available' : 'Marked unavailable'}
                      </span>
                    </div>
                  </div>
                  {role === 'owner' && !staffEditing && (
                    <Button size="sm" variant="soft" onClick={() => setStaffEditing(true)}>Change shift</Button>
                  )}
                </div>
                {role === 'owner' && staffEditing && (
                  <form onSubmit={handleSaveStaffShift} className="au-form" style={{marginTop:'12px',paddingTop:'12px',borderTop:'1px solid var(--line)'}}>
                    <div className="st-pair">
                      <Field label="Shift start"><input type="time" value={staffStart} onChange={e => setStaffStart(e.target.value)} required/></Field>
                      <Field label="Shift end"><input type="time" value={staffEnd} onChange={e => setStaffEnd(e.target.value)} required/></Field>
                    </div>
                    <Field label="Assigned branch">
                      <select value={staffBranch || currentStaff.branchRef} onChange={e => setStaffBranch(e.target.value)}>
                        {(store?.state?.branches || []).filter(b => b.status !== 'Closed').map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </Field>
                    <div className="ns-actions" style={{marginTop:'8px'}}>
                      <Button type="submit" size="sm" disabled={staffSaving}>{staffSaving ? 'Saving…' : 'Save shift'}</Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setStaffEditing(false)}>Cancel</Button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </Card>
          {currentStaff && (
            <Card title="Weekly roster coverage" subtitle="Assigned operational shifts across operating days.">
              <ul className="st-week">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((dayName, idx) => {
                  const isDayOff = idx === 6
                  return (
                    <li key={dayName}>
                      <b className="st-day">{dayName}</b>
                      <div className="st-cells">
                        <div className={`st-cell ${!isDayOff ? 'is-on' : ''}`}>
                          <span className="st-branch">{currentStaff.branch}</span>
                          <span>{!isDayOff ? `${t12(currentStaff.shiftStart)}–${t12(currentStaff.shiftEnd)}` : 'Day off'}</span>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}
        </>
      )
    ) : (
      !data ? <p className="au-muted" role="status">Loading…</p> : !data.dentists.length ? <Notice>No dentists to show for your branches.</Notice> : <>
        <Card>
          {role === 'dentist' ? (<div className="dentist-hours-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'12px',flexWrap:'wrap',paddingBottom:'10px',borderBottom:'1px solid var(--line)'}}><div><span className="block-muted" style={{fontSize:'11px',textTransform:'uppercase',letterSpacing:'0.05em',fontWeight:700}}>Rostered Provider</span><b style={{fontSize:'16px',color:'var(--ink)',display:'block',marginTop:'2px'}}>{dentist?.name || store?.session?.name || 'Dentist'}</b></div>{data.dentists.length > 1 && (<label style={{fontSize:'12px',display:'flex',alignItems:'center',gap:'6px'}}><span className="au-muted">Select dentist:</span><select value={selected} onChange={e => setSelected(e.target.value)} style={{width:'auto',minHeight:'36px',padding:'4px 8px'}}>{data.dentists.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>)}</div>) : (<Field label="Dentist"><select value={selected} onChange={e => setSelected(e.target.value)}>{data.dentists.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>)}
          {dentist && <div className="den12-duty" role="status" aria-label="Dentist duty today by branch"><p className="den12-duty-title">Duty today by branch</p><div className="den12-duty-list">{dutyBranches.map(branch => {
            const status = dutyForBranch(data.duty, dentist.id, branch.id, manilaToday())
            return <div className="den12-duty-item" key={branch.id}><strong>{branch.name}</strong><span className={`fd-badge ${status === 'on' ? 'is-ok' : status === 'off' ? 'is-muted' : 'is-unknown'}`}>{status === 'on' ? 'On duty today' : status === 'off' ? 'Off duty' : 'Duty status unavailable'}</span></div>
          })}{!dutyBranches.length && <span className="fd-badge is-unknown">Duty status unavailable</span>}</div></div>}
          {role === 'dentist' && <Notice tone="info" title="Roster and working hours are managed by the Clinic Owner and Front Desk staff">Dentists view rostered schedules and shift hours read-only. To request time off or coverage, submit a request under Leave.</Notice>}
          {dentist?.demo && <Notice tone="info" title="Demo schedule, not confirmed by the clinic">These hours were made up for the demonstration. The clinic still has to give each dentist’s real hours.</Notice>}
          {dentist?.profile_hours && <Notice tone="info" title="No weekly schedule yet">Booking uses the hours on the profile ({t12(dentist.profile_hours.start)}–{t12(dentist.profile_hours.end)}) on every day the branch is open, and the calendar marks its capacity as estimated.
            {canEdit && <div className="ns-actions st-gap">{dentist.branches.filter(b => b.editable).map(b => <Button key={b.id} size="sm" variant="soft" onClick={async () => {
              const r = await copyProfileHours(dentist.id, b.id); if (!r.ok) return toast(firstError(r), 'warning'); toast(`${r.data.created} day(s) added at ${b.name}. Edit any day below.`, 'success'); after(r)
            }}>Start from these hours at {b.name}</Button>)}</div>}
            {canEdit && <p className="au-muted">Once a dentist has a weekly schedule, a day without hours is a day off.</p>}</Notice>}
        </Card>
        {dentist && <WeeklyGrid dentist={dentist} data={data} toast={toast} onSaved={after} canEdit={canEdit} role={role}/>}
        {dentist && <Card title="Affected appointments" subtitle="The next 90 days: booked times this dentist no longer covers.">
          <AffectedAppointments rows={affected} wordingApproved={approved} toast={toast} canAct={role !== 'dentist'} onChanged={() => { refreshAffected() }}
            onNotify={() => notifyScheduleAffected(dentist.id)}/>
        </Card>}
        <Exceptions data={data} dentist={dentist} toast={toast} onSaved={after} canEdit={canEdit}/>
      </>
    )}
  </div>
}

function WeeklyGrid({ dentist, data, toast, onSaved, canEdit = true, role = 'owner' }) {
  const [editing, setEditing] = useState(null)
  const rowFor = (branch, day) => dentist.weekly.find(w => w.branch.id === branch.id && w.weekday === Number(day))
  const hours = (branchId, day) => data.branches.find(b => b.id === branchId)?.hours?.[day]
  return <Card className="den12-roster" title={role === 'dentist' ? 'My rostered weekly hours' : 'Weekly hours'} subtitle={canEdit ? 'Select Change to edit a day. The hours must fall inside the branch’s opening hours.' : 'Scheduled shift hours by branch for each day of the week (read-only).'}>
    <ul className="st-week">{Object.entries(data.weekdays).sort(([a], [b]) => Number(a) - Number(b)).map(([day, name]) => <li key={day}>
      <b className="st-day">{name}</b>
      <div className="st-cells">{dentist.branches.map(b => {
        const row = rowFor(b, day), open = hours(b.id, day), key = `${b.id}:${day}`
        const label = !open ? 'Branch closed' : row ? `${t12(row.start)}–${t12(row.end)}${row.break_start ? ` · break ${t12(row.break_start)}–${t12(row.break_end)}` : ''}` : dentist.profile_hours ? `Estimated profile hours: ${t12(dentist.profile_hours.start)}–${t12(dentist.profile_hours.end)}` : 'Day off'
        return <div key={b.id} className={`st-cell ${row && open ? 'is-on' : ''}`}>
          <span className="st-branch">{b.name}</span>
          {editing === key ? <HoursForm row={row} open={open} onCancel={() => setEditing(null)} onSave={async (body, remove) => {
            const r = await saveWeeklyHours(dentist.id, remove ? { branch_ref: b.id, weekday: Number(day), remove: true } : { branch_ref: b.id, weekday: Number(day), ...body })
            if (!r.ok) return firstError(r)
            setEditing(null); toast(remove ? `${name} removed: a day off at ${b.name}.` : `${name} saved.`, 'success'); onSaved(r); return null
          }}/> : <>
            <span>{label}</span>
            {canEdit && b.editable && open && <Button size="sm" variant="ghost" onClick={() => setEditing(key)} aria-label={`Change ${name} at ${b.name}`}>Change</Button>}
          </>}
        </div>
      })}</div>
    </li>)}</ul>
  </Card>
}

function HoursForm({ row, open, onSave, onCancel }) {
  const [f, setF] = useState({ start_time: row?.start || open?.open || '09:00', end_time: row?.end || open?.close || '17:00', has_break: !!row?.break_start, break_start: row?.break_start || '12:00', break_end: row?.break_end || '13:00' })
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  const save = async remove => {
    setBusy(true); setErr('')
    const e = await onSave({ start_time: f.start_time, end_time: f.end_time, break_start: f.has_break ? f.break_start : null, break_end: f.has_break ? f.break_end : null }, remove)
    setBusy(false); if (e) setErr(e)
  }
  return <form className="au-form st-hours" onSubmit={e => { e.preventDefault(); save(false) }}>
    {open && <p className="au-muted">Branch open {t12(open.open)}–{t12(open.close)}</p>}
    <div className="st-pair"><Field label="Starts"><input type="time" value={f.start_time} onChange={e => set('start_time', e.target.value)}/></Field>
      <Field label="Ends"><input type="time" value={f.end_time} onChange={e => set('end_time', e.target.value)}/></Field></div>
    <label className="au-check"><input type="checkbox" checked={f.has_break} onChange={e => set('has_break', e.target.checked)}/> Break</label>
    {f.has_break && <div className="st-pair"><Field label="Break from"><input type="time" value={f.break_start} onChange={e => set('break_start', e.target.value)}/></Field>
      <Field label="Break to"><input type="time" value={f.break_end} onChange={e => set('break_end', e.target.value)}/></Field></div>}
    {err && <p className="au-error" role="alert">{err}</p>}
    <div className="ns-actions"><Button type="submit" size="sm" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
      {row && <Button size="sm" variant="ghost" disabled={busy} onClick={() => save(true)}>Make it a day off</Button>}
      <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button></div>
  </form>
}

function Exceptions({ data, dentist, toast, onSaved, canEdit = true }) {
  const editableBranches = dentist?.branches.filter(b => b.editable) || []
  const [f, setF] = useState({ date: '', kind: 'day_off', branch_ref: '', start_time: '09:00', end_time: '12:00', reason: '' })
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  const rows = data.exceptions.filter(e => !dentist || e.dentist.id === dentist.id)
  const add = async e => {
    e.preventDefault(); setBusy(true); setErr('')
    const r = await addScheduleException(dentist.id, { date: f.date, kind: f.kind, reason: f.reason.trim() || null, ...(f.kind === 'custom_hours' ? { branch_ref: f.branch_ref || editableBranches[0]?.id, start_time: f.start_time, end_time: f.end_time } : {}) })
    setBusy(false)
    if (!r.ok) return setErr(firstError(r))
    toast('Exception saved. Booking reflects it now.', 'success'); setF(x => ({ ...x, date: '', reason: '' })); onSaved(r)
  }
  return <Card title="Exceptions" subtitle="One date: a day off (every branch) or different hours at one branch.">
    {!rows.length ? <p className="au-muted">No upcoming exceptions{dentist ? ` for ${dentist.name}` : ''}.</p> : <ul className="fd-list">{rows.map(x => <li key={x.id}>
      <div><b>{longDate(x.date)} · {x.kind === 'day_off' ? 'Day off' : `${t12(x.start)}–${t12(x.end)} at ${x.branch?.name}`}</b><span>{x.dentist.name}{x.reason ? ` · ${x.reason}` : ''}</span></div>
      {canEdit && x.editable && <Button size="sm" variant="ghost" onClick={async () => { const r = await removeScheduleException(x.id); if (!r.ok) return toast(firstError(r), 'warning'); toast('Exception removed.', 'success'); onSaved(r) }}>Remove</Button>}
    </li>)}</ul>}
    {canEdit && dentist && editableBranches.length > 0 && <form className="au-form st-exception" onSubmit={add}>
      <h3 className="st-sub">Add an exception for {dentist.name}</h3>
      <Field label="Date" required><input type="date" min={manilaToday()} value={f.date} onChange={e => set('date', e.target.value)} required/></Field>
      <Field label="Kind"><select value={f.kind} onChange={e => set('kind', e.target.value)}><option value="day_off">Day off</option><option value="custom_hours">Different hours</option></select></Field>
      {f.kind === 'custom_hours' && <>
        <Field label="Branch"><select value={f.branch_ref || editableBranches[0]?.id} onChange={e => set('branch_ref', e.target.value)}>{editableBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        <div className="st-pair"><Field label="Starts"><input type="time" value={f.start_time} onChange={e => set('start_time', e.target.value)}/></Field>
          <Field label="Ends"><input type="time" value={f.end_time} onChange={e => set('end_time', e.target.value)}/></Field></div>
      </>}
      <Field label="Reason (internal)" hint="Optional, for example “Seminar”."><input value={f.reason} maxLength={120} onChange={e => set('reason', e.target.value)}/></Field>
      {err && <p className="au-error" role="alert">{err}</p>}
      <div className="au-actions"><Button type="submit" disabled={busy || !f.date}>{busy ? 'Saving…' : 'Add exception'}</Button></div>
    </form>}
  </Card>
}

// ---- M15 Leave ------------------------------------------------------------------------------------------------------

const STATUS_TONE = { Pending: 'is-late', Approved: 'is-ok', Declined: 'is-bad', Cancelled: '' }

export function LeavePage({ store, role }) {
  const toast = store?.toast || (() => {})
  const requester = role === 'staff' || role === 'dentist'
  const [tick, setTick] = useState(0), changed = () => setTick(t => t + 1)
  return <div className="st-page">
    <PageHeader kicker={role === 'owner' ? 'Administration' : 'Team'} title={role === 'owner' ? 'Leave requests' : 'Leave'}
      text="Vacation, sick and other leave. Approved leave of a dentist removes their time from booking at once; approving never cancels an appointment. Leave balances are not tracked."/>
    <TeamStrip key={tick}/>
    {requester && <MyLeave toast={toast} onChanged={changed}/>}
    {role !== 'dentist' && <Approvals toast={toast} role={role} onChanged={changed} branches={(store?.state?.branches || []).filter(b => b.status !== 'Closed')}/>}
  </div>
}

function TeamStrip() {
  const from = manilaToday(), to = addDays(from, 13)
  const [rows, setRows] = useState(null)
  useEffect(() => { leaveCalendar(from, to).then(r => setRows(r.ok ? r.data : [])) }, [])
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(from, i)), [from])
  const away = d => (rows || []).filter(r => r.starts_at.slice(0, 10) <= d && (r.ends_at.slice(11, 16) === '00:00' ? addDays(r.ends_at.slice(0, 10), -1) : r.ends_at.slice(0, 10)) >= d)
  return <Card title="Who is away" subtitle="The next two weeks. Approved leave is solid, pending is dashed.">
    {!rows ? <p className="au-muted" role="status">Loading…</p> : <>
      <div className="st-strip" role="list" aria-label="Who is away, next two weeks">{days.map(d => {
        const list = away(d)
        return <div key={d} role="listitem" className="st-strip-day"><b>{longDate(d).replace(/,.*/, '')}<small>{d.slice(8)}</small></b>
          {list.map(r => <span key={r.id} className={`st-away ${r.status === 'Pending' ? 'is-pending' : ''}`} title={`${r.name}: ${r.label} (${r.status})`}>{r.name.split(' ').map(x => x[0]).slice(0, 2).join('')}</span>)}
        </div>
      })}</div>
      {rows.length ? <ul className="st-legend">{rows.map(r => <li key={r.id}><b>{r.name}</b> ({r.role}) · {r.label} · {r.status}</li>)}</ul> : <p className="au-muted">Nobody is away in the next two weeks.</p>}
    </>}
  </Card>
}

function MyLeave({ toast, onChanged }) {
  const [rows, setRows] = useState(null), [denied, setDenied] = useState(false)
  const [f, setF] = useState({ type: 'vacation', start_date: '', end_date: '', partial: false, start_time: '09:00', end_time: '12:00', private_note: '' })
  const [err, setErr] = useState(''), [busy, setBusy] = useState('')
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  const load = () => myLeave().then(r => { if (r.ok) { setRows(r.data); onChanged?.() } else if (r.kind === 'forbidden') setDenied(true) })
  useEffect(() => { load() }, [])
  if (denied) return null
  const submit = async e => {
    e.preventDefault(); setErr('')
    if (f.type === 'other' && !f.private_note.trim()) return setErr('Please explain the reason for “Other” leave.')
    if (!f.start_date || f.start_date < manilaToday()) return setErr('Choose today or a later date.')
    const endDate = f.partial ? f.start_date : (f.end_date || f.start_date)
    if (endDate < f.start_date) return setErr('The until date cannot be before the from date.')
    if (f.partial && (!f.start_time || !f.end_time || f.end_time <= f.start_time)) return setErr('The end time must be after the start time.')
    setBusy('add')
    const r = await requestLeave({ type: f.type, start_date: f.start_date, end_date: endDate, private_note: f.private_note.trim() || null, ...(f.partial ? { start_time: f.start_time, end_time: f.end_time } : {}) })
    setBusy('')
    if (!r.ok) return setErr(firstError(r))
    toast('Leave requested. An authorized approver can review it.', 'success')
    setF(x => ({ ...x, start_date: '', end_date: '', private_note: '' })); load()
  }
  return <Card title="My leave">
    <form className="au-form" onSubmit={submit}>
      <Field label="Type"><select value={f.type} onChange={e => set('type', e.target.value)}><option value="vacation">Vacation</option><option value="sick">Sick</option><option value="other">Other</option></select></Field>
      <div className="st-pair"><Field label="From" required><input type="date" min={manilaToday()} value={f.start_date} onChange={e => setF(x => ({ ...x, start_date: e.target.value, end_date: x.end_date && x.end_date < e.target.value ? '' : x.end_date }))} required/></Field>
        <Field label="To (last day)"><input type="date" min={f.start_date || manilaToday()} value={f.partial ? f.start_date : f.end_date} disabled={f.partial} onChange={e => set('end_date', e.target.value)}/></Field></div>
      <label className="au-check"><input type="checkbox" checked={f.partial} onChange={e => set('partial', e.target.checked)}/> Only part of the day</label>
      {f.partial && <div className="st-pair"><Field label="From (time on selected date)"><input type="time" value={f.start_time} onChange={e => set('start_time', e.target.value)}/></Field>
        <Field label="Until (time on selected date)"><input type="time" value={f.end_time} onChange={e => set('end_time', e.target.value)}/></Field></div>}
      <Field label={f.type === 'other' ? 'Specify reason' : 'Private note (optional)'} required={f.type === 'other'} hint="Seen only by you and the approver. Never emailed."><textarea maxLength={500} placeholder={f.type === 'other' ? 'e.g., Family emergency, bereavement, medical appointment' : ''} value={f.private_note} onChange={e => set('private_note', e.target.value)}/></Field>
      {err && <p className="au-error" role="alert">{err}</p>}
      <div className="au-actions"><Button type="submit" disabled={busy === 'add' || !f.start_date || f.start_date < manilaToday() || (!f.partial && f.end_date && f.end_date < f.start_date) || (f.partial && (!f.start_time || !f.end_time || f.end_time <= f.start_time)) || (f.type === 'other' && !f.private_note.trim())}>{busy === 'add' ? 'Sending…' : 'Request leave'}</Button></div>
    </form>
    {!rows ? <p className="au-muted" role="status">Loading…</p> : !rows.length ? <p className="au-muted">No leave requested yet.</p> : <ul className="fd-list">{rows.map(l => <li key={l.id}>
      <div><b>{l.label}</b><span>{l.type_label} · <span className={`fd-badge ${STATUS_TONE[l.status]}`}>{l.status}</span>{l.decided_by ? ` · by ${l.decided_by}` : ''}</span>{l.private_note && <span>Note: {l.private_note}</span>}</div>
      {l.can_cancel && <Button size="sm" variant="ghost" disabled={busy === l.id} onClick={async () => { setBusy(l.id); const r = await cancelLeave(l.id); setBusy(''); if (!r.ok) return toast(firstError(r), 'warning'); toast('Leave cancelled. The time is bookable again.', 'success'); load() }}>Cancel</Button>}
    </li>)}</ul>}
  </Card>
}

function Approvals({ toast, role, branches, onChanged }) {
  const [rows, setRows] = useState(null), [meta, setMeta] = useState({}), [denied, setDenied] = useState(false), [filters, setFilters] = useState({ status: 'Pending', branch_ref: '' })
  const [open, setOpen] = useState(null)
  const load = () => leaveRequests(filters).then(r => { if (r.ok) { setRows(r.data); setMeta(r.meta || {}); onChanged?.() } else if (r.kind === 'forbidden') setDenied(true) })
  useEffect(() => { load() }, [filters.status, filters.branch_ref])
  if (denied) return role === 'staff' ? <Notice tone="info" title="Leave approvals">The Owner approves leave requests. The Owner can let the front desk approve them too (Automations → Work schedules, leave and handovers).</Notice> : null
  return <Card title={role === 'owner' ? 'Leave requests' : 'Leave requests to decide'} subtitle={meta.approver === 'owner_or_front_desk' ? 'Decided by the Owner or the front desk of the requester’s branch.' : 'Decided by the Owner.'}>
    <FilterBar className="st-filters" ariaLabel="Filter leave requests" onClear={(filters.status !== 'Pending' || filters.branch_ref) ? () => setFilters({ status: 'Pending', branch_ref: '' }) : null}>
      <Field label="Status"><select value={filters.status} onChange={e => setFilters(x => ({ ...x, status: e.target.value }))}><option value="">All</option>{['Pending', 'Approved', 'Declined', 'Cancelled'].map(s => <option key={s}>{s}</option>)}</select></Field>
      <Field label="Branch"><select value={filters.branch_ref} onChange={e => setFilters(x => ({ ...x, branch_ref: e.target.value }))}><option value="">All branches</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
    </FilterBar>
    {!rows ? <p className="au-muted" role="status">Loading…</p> : !rows.length ? <p className="au-muted">No requests here.</p> : <ul className="fd-list">{rows.map(l => <LeaveRow key={l.id} l={l} role={role} open={open === l.id} onToggle={() => setOpen(open === l.id ? null : l.id)} toast={toast} wordingApproved={meta.wording_approved}
      onChanged={decided => { if (decided && filters.status && decided !== filters.status) { setOpen(l.id); setFilters(x => ({ ...x, status: '' })) } else load() }}/>)}</ul>}
  </Card>
}

function LeaveRow({ l, role, open, onToggle, toast, onChanged, wordingApproved }) {
  const [conflicts, setConflicts] = useState(null), [busy, setBusy] = useState(''), [confirmDecision, setConfirmDecision] = useState(null)
  const loadConflicts = () => l.requester.role === 'Dentist' && leaveConflicts(l.id).then(r => { if (r.ok) setConflicts(r.data.appointments) })
  useEffect(() => { if (open) loadConflicts() }, [open])
  const decide = async decision => {
    setBusy(decision)
    const r = await decideLeave(l.id, decision)
    setBusy('')
    if (!r.ok) return toast(firstError(r), 'warning')
    toast(decision === 'approve' ? `Approved. ${l.requester.role === 'Dentist' ? 'Their booking time is blocked now.' : ''}` : 'Declined.', 'success')
    if (decision === 'approve' && r.data.appointments?.length) setConflicts(r.data.appointments)
    onChanged(r.data.status) // keeps the row (and its affected visits) on screen after the decision
  }
  const doCancel = async () => {
    setBusy('cancel')
    const r = await cancelLeave(l.id)
    setBusy('')
    if (!r.ok) return toast(firstError(r), 'warning')
    toast('Leave cancelled. The time is bookable again.', 'success')
    onChanged()
  }
  return <li className="st-leave">
    <div><b>{l.requester.name} ({l.requester.role}) · {l.label}</b>
      <span>{l.type_label} · <span className={`fd-badge ${STATUS_TONE[l.status]}`}>{l.status}</span>{l.decided_by ? ` · by ${l.decided_by}` : ''}</span>
      {l.private_note && <span>Private note: {l.private_note}</span>}</div>
    <div className="ns-actions">
      {l.can_decide && <><Button size="sm" disabled={!!busy} onClick={() => setConfirmDecision('approve')}>{busy === 'approve' ? 'Accepting…' : 'Accept leave request'}</Button>
        <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => setConfirmDecision('decline')}>{busy === 'decline' ? 'Declining…' : 'Decline leave'}</Button></>}
      {l.requester.role === 'Dentist' && l.status !== 'Declined' && l.status !== 'Cancelled' && <Button size="sm" variant="soft" onClick={onToggle} aria-expanded={open}>{open ? 'Hide bookings' : 'Booked appointments'}</Button>}
      {l.can_cancel && l.status === 'Approved' && <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => setConfirmDecision('cancel')}>Cancel leave</Button>}
    </div>
    {confirmDecision && <ConfirmDialog
      open
      title={confirmDecision === 'approve' ? 'Accept leave request?' : confirmDecision === 'decline' ? 'Decline leave request?' : 'Cancel approved leave?'}
      tone={confirmDecision === 'approve' ? 'default' : 'danger'}
      confirmLabel={confirmDecision === 'approve' ? 'Accept leave request' : confirmDecision === 'decline' ? 'Decline leave' : 'Cancel leave'}
      onConfirm={() => {
        const d = confirmDecision
        setConfirmDecision(null)
        if (d === 'cancel') doCancel()
        else decide(d)
      }}
      onCancel={() => setConfirmDecision(null)}
    >
      <p>
        {confirmDecision === 'approve'
          ? `Accepting this leave request for ${l.requester.name} (${l.label}) blocks new bookings during their away window. Existing appointments remain on the affected list so they can be reassigned or rescheduled.`
          : confirmDecision === 'decline'
            ? `Declining marks this leave request for ${l.requester.name} (${l.label}) as Declined and keeps their schedule open for booking.`
            : `Cancelling this approved leave for ${l.requester.name} (${l.label}) reopens their blocked schedule time for booking.`}
      </p>
    </ConfirmDialog>}
    {open && <div className="st-conflicts">
      {l.status === 'Pending' && conflicts?.length > 0 && <p className="au-muted">Approving keeps these appointments; resolve them before or after approving.</p>}
      <AffectedAppointments rows={conflicts} wordingApproved={wordingApproved} toast={toast} canAct={l.status === 'Approved' || l.status === 'Pending'} onChanged={loadConflicts}
        onNotify={() => l.status === 'Approved' ? notifyLeaveAffected(l.id) : Promise.resolve({ ok: false, message: 'Approve the leave first, then email the patients.' })}/>
    </div>}
  </li>
}
