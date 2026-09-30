import React, { useEffect, useState } from 'react'
import { Button, Card, Field, Modal, Notice, PageHeader, Status, Table } from '../components.jsx'
import { clinicNow } from '../clock.js'
import { commandKey } from '../appointments-api.js'
import { createPriceVersion, formatAmount, inEffect, loadPriceVersions, retractPriceVersion, validAmount, versionStatus } from '../pricing-api.js'
import { peso } from '../logic.js'

// M13 pricing foundation — Owner "Services & Pricing". Confirmed prices are Owner-entered, effective-dated, append-only
// server versions and the only authoritative prices. The service's reference fee is shown separately and labelled as
// unconfirmed; it is never copied into the form (the amount field always starts blank).
const emptyForm = today => ({ level: 'base', kind: 'priced', amount: '', effectiveFrom: today })

export function ServicesPricingPage({ store }) {
  const { state, toast } = store
  const today = clinicNow().date
  const [versions, setVersions] = useState(null)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [form, setForm] = useState(() => emptyForm(today))
  const [confirming, setConfirming] = useState(null)
  const [retracting, setRetracting] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setError('')
    const result = await loadPriceVersions()
    if (result.ok) setVersions(result.versions)
    else setError(result.message || 'Could not load prices.')
  }
  useEffect(() => { load() }, [])

  const selected = state.services.find(s => s.id === selectedId) || null
  const branchesOffering = selected ? state.branches.filter(b => state.branchServices.some(bs => bs.branchId === b.id && bs.serviceId === selected.id && bs.active !== false)) : []
  const open = service => { setSelectedId(service.id); setForm(emptyForm(today)) }
  const history = selected && versions ? versions.filter(v => v.serviceId === selected.id).sort((a, b) => (a.branchName || '').localeCompare(b.branchName || '') || a.effectiveFrom.localeCompare(b.effectiveFrom)) : []

  const levelLabel = level => (level === 'base' ? 'Base clinic price' : `${state.branches.find(b => b.id === level)?.name || level} price`)
  const review = () => {
    if (form.kind === 'priced' && !validAmount(form.amount)) return toast('Enter a price greater than zero with at most two decimals, for example 1500.00.', 'warning')
    if (!form.effectiveFrom || form.effectiveFrom < today) return toast('A price can start today or on a future date.', 'warning')
    setConfirming({ ...form, amount: String(form.amount).trim(), key: commandKey() })
  }
  const confirm = async () => {
    setBusy(true)
    const result = await createPriceVersion({ serviceId: selected.id, branchId: confirming.level === 'base' ? null : confirming.level, kind: confirming.kind, amount: confirming.amount, effectiveFrom: confirming.effectiveFrom }, confirming.key)
    setBusy(false)
    if (!result.ok) { toast(result.message, 'warning'); if (result.kind === 'conflict') { setConfirming(null); load() } return }
    setConfirming(null); setForm(emptyForm(today)); await load()
    toast(confirming.kind === 'priced' ? 'Confirmed price saved.' : 'Price ended at this level.', 'success')
  }
  const retract = async () => {
    setBusy(true)
    const result = await retractPriceVersion(retracting.version, retracting.key)
    setBusy(false)
    if (!result.ok) return toast(result.message, 'warning')
    setRetracting(null); await load(); toast('Scheduled price retracted.', 'success')
  }

  return <>
    <PageHeader title="Services & Pricing" text="Confirmed prices are entered by the Owner and take effect on a chosen date. Each change adds a new version; earlier versions are kept."/>
    <Notice tone="info" title="Confirmed prices versus reference fees">A <b>confirmed price</b> is one you enter and confirm here; billing will use only confirmed prices. A <b>reference fee (unconfirmed)</b> is project reference data, not a clinic price, and is never used for billing.</Notice>
    {error && <Notice tone="warning" title="Prices could not be loaded">{error} <Button size="sm" onClick={load}>Retry</Button></Notice>}
    {!versions && !error && <Notice>Loading prices…</Notice>}
    {versions && <Card title="Services" subtitle="Base clinic price in effect today, with any branch prices">
      <Table rows={state.services} columns={[
        { key: 'name', label: 'Service', render: s => <div><b>{s.name}</b><small className="block-muted">{s.code} • {s.status}</small></div> },
        { key: 'base', label: 'Confirmed base price today', render: s => { const v = inEffect(versions, s.id, null, today); return v ? <span>{formatAmount(v.amount)} <small className="block-muted">since {v.effectiveFrom}</small></span> : <Status>No confirmed price</Status> } },
        { key: 'branches', label: 'Branch prices today', render: s => { const list = state.branches.map(b => [b, inEffect(versions, s.id, b.id, today)]).filter(([, v]) => v); return list.length ? list.map(([b, v]) => <small className="block-muted" key={b.id}>{b.name}: {v.kind === 'priced' ? formatAmount(v.amount) : 'ended (uses base)'}</small>) : '—' } },
        { key: 'reference', label: 'Reference fee (unconfirmed)', render: s => (s.baseFee != null ? <small>{peso.format(s.baseFee)} <span className="block-muted">reference only</span></small> : '—') },
        { key: 'actions', label: 'Actions', render: s => <Button size="sm" onClick={() => open(s)}>Manage prices</Button> },
      ]}/>
    </Card>}

    <Modal open={!!selected} onClose={() => setSelectedId(null)} title={selected ? `${selected.name} — prices` : ''} subtitle="Versions are never edited. A scheduled (future) version can be retracted before it starts." wide>{selected && <>
      <p className="pt-hint">Reference fee (unconfirmed): {selected.baseFee != null ? peso.format(selected.baseFee) : '—'} — not used for billing and not copied into the form.</p>
      <h3>Price history</h3>
      {history.length ? <Table rows={history} columns={[
        { key: 'level', label: 'Level', render: v => (v.level === 'base' ? 'Base clinic price' : v.branchName) },
        { key: 'kind', label: 'Price', render: v => (v.kind === 'priced' ? formatAmount(v.amount) : 'Ended at this level') },
        { key: 'effectiveFrom', label: 'Effective from' },
        { key: 'status', label: 'Status', render: v => <Status>{versionStatus(v, versions, today)}</Status> },
        { key: 'by', label: 'Confirmed by', render: v => <small>{v.createdBy || '—'}{v.retractedAt ? ` • retracted by ${v.retractedBy || '—'}` : ''}</small> },
        { key: 'actions', label: 'Actions', render: v => (versionStatus(v, versions, today) === 'Scheduled' ? <Button size="sm" variant="ghost" onClick={() => setRetracting({ version: v, key: commandKey() })}>Retract</Button> : null) },
      ]}/> : <Notice>No confirmed price yet. Billing reports “pricing needed” for this service until you set one.</Notice>}
      <h3>Set a price</h3>
      <div className="form-grid">
        <Field label="Level"><select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}><option value="base">Base clinic price (all branches)</option>{branchesOffering.map(b => <option key={b.id} value={b.id}>{b.name} only</option>)}</select></Field>
        <Field label="Action"><select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value, amount: '' })}><option value="priced">Set confirmed price</option><option value="ended">End price at this level</option></select></Field>
        {form.kind === 'priced' && <Field label="Confirmed price (₱)" required hint="Type the clinic’s price. It is not filled in from the reference fee."><input inputMode="decimal" autoComplete="off" placeholder="e.g. 1500.00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}/></Field>}
        <Field label="Effective from" required hint="Today or a future date"><input type="date" min={today} value={form.effectiveFrom} onChange={e => setForm({ ...form, effectiveFrom: e.target.value })}/></Field>
        <Button className="span-2" onClick={review}>Review price change</Button>
      </div>
    </>}</Modal>

    <Modal open={!!confirming} onClose={() => !busy && setConfirming(null)} title="Confirm authoritative price">{confirming && selected && <>
      <p><b>{selected.name}</b> • {levelLabel(confirming.level)}</p>
      <p>{confirming.kind === 'priced' ? <>Confirmed price: <b>{formatAmount(confirming.amount)}</b></> : <>End the price at this level{confirming.level === 'base' ? ' (the service will have no base price)' : ' (this branch will use the base price)'}</>} from <b>{confirming.effectiveFrom}</b>.</p>
      <Notice tone="warning">Billing will use this price from that date. Once it takes effect it cannot be changed — you can only add a newer version.</Notice>
      <div className="form-actions"><Button variant="ghost" disabled={busy} onClick={() => setConfirming(null)}>Go back</Button><Button disabled={busy} onClick={confirm}>Confirm price</Button></div>
    </>}</Modal>

    <Modal open={!!retracting} onClose={() => !busy && setRetracting(null)} title="Retract scheduled price">{retracting && <>
      <p>Retract the {retracting.version.kind === 'priced' ? formatAmount(retracting.version.amount) : 'ended'} version for {retracting.version.level === 'base' ? 'the base clinic price' : retracting.version.branchName}, scheduled from {retracting.version.effectiveFrom}?</p>
      <p className="pt-hint">The version is kept in the history, marked retracted.</p>
      <div className="form-actions"><Button variant="ghost" disabled={busy} onClick={() => setRetracting(null)}>Keep it</Button><Button disabled={busy} onClick={retract}>Retract</Button></div>
    </>}</Modal>
  </>
}
