import React, { useEffect, useState } from 'react'
import { Button, Card, Field, Notice, PageHeader } from '../components.jsx'
import { listAutomations, runAutomationDemo, testAutomation, updateAutomation } from '../api-client.js'

const manila = iso => iso ? new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso)) : 'Not run yet'
const time12 = hhmm => { if (!/^\d{2}:\d{2}$/.test(hhmm || '')) return hhmm; const [h, m] = hhmm.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` }
const DEFAULT_TEXT = {
  hours_before: v => `${v} hours before`, morning_of: v => (v ? 'on' : 'off'), morning_time: v => time12(v), grace_minutes: v => `${v} minutes`,
  rebook_email: v => (v ? 'on' : 'off'), days: v => `after ${v.join(', ')} days`, rules: v => (v.length ? `${v.length} rule(s)` : 'no rules'), notify_count: v => `${v} patients`, send_time: v => time12(v),
}

/**
 * Administration → Automations (Owner): the six scheduled automations. Every value starts as a default that the clinic has not
 * confirmed; the server saves, validates and audits every change (who, old and new value). Nothing is kept in the browser.
 */
export function AutomationsPage({ store }) {
  const toast = store?.toast || (() => {})
  const [rows, setRows] = useState(null), [meta, setMeta] = useState({ categories: [], demo: false })
  const [error, setError] = useState(''), [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    listAutomations().then(r => {
      if (!live) return
      if (!r.ok) return setError(r.message || 'The automations could not be loaded.')
      setError(''); setRows(r.data || []); setMeta(m => ({ ...m, ...(r.meta || {}) }))
    })
    return () => { live = false }
  }, [attempt])

  const saved = r => { setRows(r.data || []); setMeta(m => ({ ...m, ...(r.meta || {}) })) }

  return <div className="au-page">
    <PageHeader kicker="Administration" title="Automations"
      text="What the system does by itself: reminders, possible no-shows, overdue invoices, recall, the waitlist and your daily summary. Times are Philippine time (Asia/Manila). Emails go through the clinic’s email outbox, which retries failures and never sends the same message twice."/>
    <Notice tone="warning" title="Defaults, not confirmed by the clinic">Every number below is a starting value we chose for the demo. Change it to the clinic’s own rule; each change is saved in the audit trail.</Notice>
    {error && <Notice tone="warning" title="Automations unavailable">{error} <Button size="sm" variant="ghost" onClick={() => setAttempt(a => a + 1)}>Try again</Button></Notice>}
    {!rows && !error && <p className="au-muted" role="status">Loading automations…</p>}
    {meta.demo && <DemoClockCard toast={toast} onDone={() => setAttempt(a => a + 1)}/>}
    <div className="au-grid">
      {(rows || []).map(row => <AutomationCard key={row.key} row={row} categories={meta.categories} toast={toast} onSaved={saved} onStale={() => setAttempt(a => a + 1)}/>)}
    </div>
  </div>
}

function AutomationCard({ row, categories, toast, onSaved, onStale }) {
  const [draft, setDraft] = useState(row.settings)
  const [busy, setBusy] = useState(''), [fieldError, setFieldError] = useState('')
  useEffect(() => { setDraft(row.settings); setFieldError('') }, [row.revision])
  const dirty = JSON.stringify(draft) !== JSON.stringify(row.settings)
  const stats = row.last_7_days || {}
  const id = `au-${row.key}`

  const save = async body => {
    setBusy('save'); setFieldError('')
    const r = await updateAutomation(row.key, { ...body, expected_revision: row.revision })
    setBusy('')
    if (!r.ok) {
      if (r.code === 'stale_revision') { toast(r.message, 'warning'); return onStale() }
      setFieldError(r.kind === 'validation' ? Object.values(r.errors || {})[0]?.[0] || r.message : r.message || 'Not saved.')
      return
    }
    onSaved(r); toast(`${row.name} saved.`, 'success')
  }
  const test = async () => {
    setBusy('test')
    const r = await testAutomation(row.key)
    setBusy('')
    const status = r.data?.status
    if (!r.ok) return toast(r.message || 'The test email could not be sent.', 'warning')
    toast(status === 'logged_only' ? 'Test recorded in the local mail log only (no email was sent).' : 'Test email accepted by the mail service. Check your inbox.', status === 'logged_only' ? 'warning' : 'success')
  }
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }))
  const hint = k => `Default: ${DEFAULT_TEXT[k] ? DEFAULT_TEXT[k](row.defaults.settings[k]) : row.defaults.settings[k]}${row.owner_saved ? '' : ' · not confirmed by the clinic'}`

  return <Card className={`au-card ${row.enabled ? '' : 'is-off'}`} title={row.name} subtitle={row.module}
    actions={<button type="button" role="switch" aria-checked={row.enabled} aria-label={`${row.name}: ${row.enabled ? 'on' : 'off'}`} className="au-switch" disabled={!!busy} onClick={() => save({ enabled: !row.enabled })}><span aria-hidden="true"/>{row.enabled ? 'On' : 'Off'}</button>}>
    <p className="au-desc">{row.description}</p>
    <form className="au-form" aria-labelledby={id} onSubmit={e => { e.preventDefault(); if (dirty) save({ settings: draft }) }}>
      <span id={id} hidden>{row.name} settings</span>
      {row.key === 'appointment_reminders' && <>
        <Field label="Hours before the visit" hint={hint('hours_before')}><input type="number" min="1" max="72" value={draft.hours_before} onChange={e => set('hours_before', Number(e.target.value))}/></Field>
        <label className="au-check"><input type="checkbox" checked={!!draft.morning_of} onChange={e => set('morning_of', e.target.checked)}/> Also remind on the morning of the visit <small>{hint('morning_of')}</small></label>
        <Field label="Morning reminder time" hint={hint('morning_time')}><input type="time" value={draft.morning_time} disabled={!draft.morning_of} onChange={e => set('morning_time', e.target.value)}/></Field>
      </>}
      {row.key === 'no_show' && <>
        <Field label="Grace period after the start time (minutes)" hint={hint('grace_minutes')}><input type="number" min="5" max="240" value={draft.grace_minutes} onChange={e => set('grace_minutes', Number(e.target.value))}/></Field>
        <label className="au-check"><input type="checkbox" checked={!!draft.rebook_email} onChange={e => set('rebook_email', e.target.checked)}/> After the front desk confirms a no-show, email “We missed you, book a new time” <small>{hint('rebook_email')}</small></label>
      </>}
      {row.key === 'overdue_invoices' && <Field label="Remind after (days since the invoice was issued, up to 3)" hint={hint('days')}>
        <input inputMode="numeric" value={(draft.days || []).join(', ')} onChange={e => set('days', e.target.value.split(/[\s,]+/).filter(Boolean).map(Number))}/>
      </Field>}
      {row.key === 'recall' && <RecallRules rules={draft.rules || []} categories={categories} onChange={rules => set('rules', rules)} hint={hint('rules')}/>}
      {row.key === 'waitlist' && <Field label="How many waiting patients to tell when a time opens" hint={hint('notify_count')}><input type="number" min="1" max="10" value={draft.notify_count} onChange={e => set('notify_count', Number(e.target.value))}/></Field>}
      {row.key === 'owner_summary' && <Field label="Send time" hint={hint('send_time')}><input type="time" value={draft.send_time} onChange={e => set('send_time', e.target.value)}/></Field>}
      {fieldError && <p className="au-error" role="alert">{fieldError}</p>}
      <div className="au-actions">
        <Button type="submit" size="sm" disabled={!dirty || !!busy}>{busy === 'save' ? 'Saving…' : 'Save changes'}</Button>
        {dirty && <Button size="sm" variant="ghost" onClick={() => setDraft(row.settings)}>Undo</Button>}
        <Button size="sm" variant="soft" icon="mail" disabled={!!busy} onClick={test}>{busy === 'test' ? 'Sending…' : 'Send a test to myself'}</Button>
      </div>
    </form>
    <dl className="au-stats">
      <div><dt>Last run</dt><dd>{manila(row.last_run_at)}</dd></div>
      <div><dt>Sent (7 days)</dt><dd>{stats.sent ?? 0}</dd></div>
      {row.key === 'no_show' && <div><dt>Flagged (7 days)</dt><dd>{stats.flagged ?? 0}</dd></div>}
      <div><dt>Skipped</dt><dd>{stats.skipped ?? 0}</dd></div>
      <div><dt>Failed</dt><dd className={stats.failed ? 'is-bad' : ''}>{stats.failed ?? 0}</dd></div>
      {stats.pending > 0 && <div><dt>Waiting to send</dt><dd>{stats.pending}</dd></div>}
    </dl>
  </Card>
}

function RecallRules({ rules, categories, onChange, hint }) {
  const unused = categories.filter(c => !rules.some(r => r.category === c))
  return <fieldset className="au-rules">
    <legend>Recall rules (one per service category)</legend>
    {!rules.length && <p className="au-muted">No rules. The clinic has not given us any, so nothing is sent.</p>}
    {rules.map((r, i) => <div className="au-rule" key={r.category}>
      <span>{r.category}</span>
      <label>after <input type="number" min="1" max="36" aria-label={`Months after a ${r.category} visit`} value={r.months} onChange={e => onChange(rules.map((x, j) => j === i ? { ...x, months: Number(e.target.value) } : x))}/> months</label>
      <Button size="sm" variant="ghost" onClick={() => onChange(rules.filter((_, j) => j !== i))}>Remove</Button>
    </div>)}
    {unused.length > 0 && <label className="au-add">Add a rule for <select value="" onChange={e => e.target.value && onChange([...rules, { category: e.target.value, months: 6 }])}>
      <option value="">Choose a service category…</option>{unused.map(c => <option key={c}>{c}</option>)}
    </select></label>}
    <small className="au-muted">{hint}. A new rule starts at 6 months; set the clinic’s own interval.</small>
  </fieldset>
}

/** Demo database only: make one reminder due now so the panel can watch it arrive. Hidden everywhere else (the server also refuses). */
function DemoClockCard({ toast, onDone }) {
  const [form, setForm] = useState({ appointment_code: '', invoice_number: '', summary: false })
  const [busy, setBusy] = useState(false), [result, setResult] = useState(null)
  const run = async e => {
    e.preventDefault()
    setBusy(true)
    const r = await runAutomationDemo({ appointment_code: form.appointment_code.trim() || null, invoice_number: form.invoice_number.trim() || null, summary: form.summary })
    setBusy(false)
    if (!r.ok) return toast(r.message || 'The demo clock did not run.', 'warning')
    setResult(r.data); toast('Done. The email is on its way.', 'success'); onDone()
  }
  return <Card className="au-demo" title="Demo clock" subtitle="Demo database only">
    <p className="au-desc">Runs one automation now as if the clock were at its due time, then sends the email at once. The real schedule will not send it again.</p>
    <form className="au-form au-demo-form" onSubmit={run}>
      <Field label="Appointment code (reminder)"><input value={form.appointment_code} placeholder="APT-2026-000001" onChange={e => setForm(f => ({ ...f, appointment_code: e.target.value }))}/></Field>
      <Field label="Invoice number (overdue reminder)"><input value={form.invoice_number} placeholder="INV-2026-000001" onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))}/></Field>
      <label className="au-check"><input type="checkbox" checked={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.checked }))}/> Send today’s Owner summary</label>
      <div className="au-actions"><Button type="submit" size="sm" icon="clock" disabled={busy || (!form.appointment_code.trim() && !form.invoice_number.trim() && !form.summary)}>{busy ? 'Running…' : 'Run now'}</Button></div>
    </form>
    {result && <ul className="au-result" aria-live="polite">{Object.entries(result).filter(([k]) => k !== 'emails_processed').map(([k, v]) => <li key={k}><b>{k.replace(/_/g, ' ')}</b>: simulated {manila(v.simulated_now)} · sent {v.sent ?? 0} · skipped {v.skipped ?? 0}{v.enabled === false ? ' · switched off' : ''}</li>)}</ul>}
  </Card>
}
