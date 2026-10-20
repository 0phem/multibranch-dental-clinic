import React, { useEffect, useMemo, useState } from 'react'
import { Button, Card, Field, Notice, PageHeader } from '../components.jsx'
import { patientChart, prescriptionVisits, recordChartEntry } from '../api-client.js'

const firstError = r => (r.kind === 'validation' ? Object.values(r.errors || {})[0]?.[0] || r.message : r.message) || 'That did not work.'
const today = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10)
const day = d => d ? new Date(`${d}T00:00:00Z`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : ''

// FDI codes per quadrant, in the order a chart is drawn (the patient's right on the viewer's left).
const ADULT = [['18', '17', '16', '15', '14', '13', '12', '11'], ['21', '22', '23', '24', '25', '26', '27', '28'], ['48', '47', '46', '45', '44', '43', '42', '41'], ['31', '32', '33', '34', '35', '36', '37', '38']]
const PRIMARY = [['55', '54', '53', '52', '51'], ['61', '62', '63', '64', '65'], ['85', '84', '83', '82', '81'], ['71', '72', '73', '74', '75']]
const QUADRANT = ['Upper right', 'Upper left', 'Lower right', 'Lower left']
const PALETTE = ['#e6f4ef', '#fde8e4', '#e3ecfb', '#fff4e0', '#efe6fb', '#eceff3', '#f6e1e1', '#e0f2f6', '#fbf3d8']

/** The label shown for an FDI code under the Owner's numbering (Universal: 1–32 adult, A–T primary). */
export function toothLabel(fdi, numbering = 'fdi') {
  if (numbering !== 'universal') return fdi
  const q = Number(fdi[0]), n = Number(fdi[1])
  if (q <= 4) return String({ 1: 9 - n, 2: 8 + n, 3: 25 - n, 4: 24 + n }[q])
  return 'ABCDEFGHIJKLMNOPQRST'[{ 5: 5 - n, 6: 4 + n, 7: 15 - n, 8: 14 + n }[q]]
}
const abbr = label => label.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()

/**
 * The tooth chart (SVG, one row per quadrant so a tooth stays a usable tap target on a phone). Each tooth shows its number and the
 * abbreviation of its current status as text, so colour is never the only signal; a legend lists the abbreviations. Teeth are
 * buttons: Enter or Space opens one. Recording is for Dentists only.
 */
export function ToothChart({ data, onPick, picked }) {
  const [set, setSet] = useState('adult')
  const current = useMemo(() => Object.fromEntries((data.current || []).map(c => [c.tooth, c])), [data])
  const statuses = data.settings?.statuses || []
  const colour = s => PALETTE[Math.max(0, statuses.indexOf(s)) % PALETTE.length]
  const rows = set === 'adult' ? ADULT : PRIMARY
  const W = 46, H = 64
  return <div className="tc-wrap">
    <div className="st-tabs" role="tablist" aria-label="Teeth">
      {[['adult', 'Adult (32)'], ['primary', 'Primary (20)']].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={set === k} className={set === k ? 'is-on' : ''} onClick={() => setSet(k)}>{l}</button>)}
    </div>
    <div className="tc-quadrants">{rows.map((teeth, qi) => <figure key={qi} className="tc-quadrant">
      <figcaption>{QUADRANT[qi]}</figcaption>
      <svg viewBox={`0 0 ${teeth.length * W} ${H}`} role="group" aria-label={`${QUADRANT[qi]} teeth`}>
        {teeth.map((t, i) => {
          const c = current[t], label = toothLabel(t, data.settings?.numbering)
          return <g key={t} role="button" tabIndex={0} className={`tc-tooth ${picked === t ? 'is-picked' : ''}`} transform={`translate(${i * W + 3},4)`}
            aria-label={`Tooth ${label}${c ? `: ${c.status}${c.surfaces?.length ? `, surfaces ${c.surfaces.join(' ')}` : ''}, ${day(c.recorded_on)}` : ': nothing recorded'}`}
            onClick={() => onPick(t)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(t) } }}>
            <rect width={W - 6} height={H - 10} rx="10" fill={c ? colour(c.status) : '#ffffff'} stroke={picked === t ? '#1865ac' : '#9fb3c8'} strokeWidth={picked === t ? 3 : 1.4}/>
            <text x={(W - 6) / 2} y="20" textAnchor="middle" className="tc-num">{label}</text>
            <text x={(W - 6) / 2} y="42" textAnchor="middle" className="tc-abbr">{c ? abbr(c.status) : '·'}</text>
          </g>
        })}
      </svg>
    </figure>)}</div>
    <ul className="tc-legend" aria-label="Legend">{statuses.map(s => <li key={s}><span className="tc-swatch" style={{ background: colour(s) }} aria-hidden="true"/>{abbr(s)} = {s}</li>)}<li><span className="tc-swatch" aria-hidden="true"/>· = nothing recorded</li></ul>
    <p className="au-muted">Numbering: {data.settings?.numbering === 'universal' ? 'Universal' : 'FDI'}. Surfaces: M mesial, O occlusal or incisal, D distal, B buccal, L lingual.</p>
  </div>
}

/** One tooth: its history and, for a Dentist, the form to record a new finding (never an edit). */
function ToothPanel({ data, tooth, canRecord, patientId, onSaved, onClose, toast }) {
  const history = (data.history || []).filter(h => h.tooth === tooth)
  const current = (data.current || []).find(c => c.tooth === tooth)
  const [f, setF] = useState({ status: data.settings?.statuses?.[0] || '', surfaces: [], note: '', recorded_on: today() })
  const [busy, setBusy] = useState(false), [err, setErr] = useState('')
  const save = async e => {
    e.preventDefault(); setBusy(true); setErr('')
    const r = await recordChartEntry(patientId, { tooth, ...f, note: f.note.trim() || null })
    setBusy(false)
    if (!r.ok) return setErr(firstError(r))
    toast(`Tooth ${toothLabel(tooth, data.settings?.numbering)} recorded.`, 'success'); onSaved(r.data); setF(x => ({ ...x, surfaces: [], note: '' }))
  }
  return <aside className="tc-panel" aria-label={`Tooth ${toothLabel(tooth, data.settings?.numbering)}`}>
    <div className="tc-panel-head"><h3>Tooth {toothLabel(tooth, data.settings?.numbering)}{data.settings?.numbering === 'universal' ? ` (FDI ${tooth})` : ''}</h3><Button size="sm" variant="ghost" onClick={onClose}>Close</Button></div>
    <p>{current ? <><b>{current.status}</b>{current.surfaces?.length ? ` · ${current.surfaces.join(' ')}` : ''} · {day(current.recorded_on)}</> : 'Nothing recorded yet.'}</p>
    {canRecord && <form className="au-form" onSubmit={save}>
      <Field label="Status" required><select value={f.status} onChange={e => setF(x => ({ ...x, status: e.target.value }))}>{(data.settings?.statuses || []).map(s => <option key={s}>{s}</option>)}</select></Field>
      <fieldset className="tc-surfaces"><legend>Surfaces (optional)</legend>{data.surfaces.map(s => <label key={s} className="au-check"><input type="checkbox" checked={f.surfaces.includes(s)} onChange={e => setF(x => ({ ...x, surfaces: e.target.checked ? [...x.surfaces, s] : x.surfaces.filter(y => y !== s) }))}/> {s}</label>)}</fieldset>
      <Field label="Date"><input type="date" max={today()} value={f.recorded_on} onChange={e => setF(x => ({ ...x, recorded_on: e.target.value }))}/></Field>
      <Field label="Note (optional)" hint="Seen by dentists only."><textarea maxLength={1000} value={f.note} onChange={e => setF(x => ({ ...x, note: e.target.value }))}/></Field>
      {err && <p className="au-error" role="alert">{err}</p>}
      <Button type="submit" size="sm" disabled={busy || !f.status}>{busy ? 'Saving…' : 'Record'}</Button>
      <p className="au-muted">A new entry never replaces the history; the latest entry is the current chart.</p>
    </form>}
    {data.history && <><h4 className="st-sub">History</h4>{!history.length ? <p className="au-muted">No entries.</p> : <ol className="tc-history">{history.map(h => <li key={h.id}>
      <b>{h.status}</b>{h.surfaces?.length ? ` · ${h.surfaces.join(' ')}` : ''} · {day(h.recorded_on)} · {h.dentist}{h.note ? <span>{h.note}</span> : null}</li>)}</ol>}</>}
  </aside>
}

/** A chart with its tooth panel (side panel on desktop, bottom sheet on a phone). */
export function ChartView({ patientId, canRecord, toast }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [picked, setPicked] = useState(null)
  useEffect(() => { setData(null); setPicked(null); patientChart(patientId).then(r => (r.ok ? setData(r.data) : setError(r.message || 'The chart could not be loaded.'))) }, [patientId])
  if (error) return <Notice tone="warning" title="Chart unavailable">{error}</Notice>
  if (!data) return <p className="au-muted" role="status">Loading the chart…</p>
  return <div className={`tc-layout ${picked ? 'has-panel' : ''}`}>
    <ToothChart data={data} picked={picked} onPick={setPicked}/>
    {picked && <ToothPanel key={picked} data={data} tooth={picked} canRecord={canRecord} patientId={patientId} toast={toast} onSaved={setData} onClose={() => setPicked(null)}/>}
  </div>
}

/** Dentist: Dental chart page (choose a patient from recent visits at your branches). */
export function DentalChartPage({ store }) {
  const toast = store?.toast || (() => {})
  const [visits, setVisits] = useState(null), [patientId, setPatientId] = useState('')
  useEffect(() => { prescriptionVisits().then(r => setVisits(r.ok ? r.data : [])) }, [])
  const patients = [...new Map((visits || []).map(v => [v.patient.id, v.patient])).values()]
  return <div className="st-page">
    <PageHeader kicker="Clinical" title="Dental chart" text="Record what you find per tooth and surface. Each entry is kept; the latest one is the current chart. The system makes no diagnosis or suggestion."/>
    <Card>
      {!visits ? <p className="au-muted" role="status">Loading…</p> : <Field label="Patient" hint="Patients with a visit at your branches in the last 30 days."><select value={patientId} onChange={e => setPatientId(e.target.value)}>
        <option value="">Choose a patient…</option>{patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
      {patientId && <ChartView patientId={patientId} canRecord toast={toast}/>}
    </Card>
  </div>
}
