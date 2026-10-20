import React, { useEffect, useState } from 'react'
import { Button } from '../../components.jsx'
import { downloadPrescriptionPdf, myPrescriptions } from '../../api-client.js'

const day = iso => iso ? new Date(iso).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }) : ''

/** M19: the patient's (and their dependents') issued prescriptions, read-only, with the PDF. A void one is marked VOID. */
export function PrescriptionsPage({ toast = () => {} }) {
  const [rows, setRows] = useState(null), [error, setError] = useState('')
  useEffect(() => { myPrescriptions().then(r => (r.ok ? setRows(r.data) : setError(r.message || 'Your prescriptions could not be loaded.'))) }, [])
  return <div className="pp-page pp-fade">
    <section className="pp-card">
      <p className="pp-eyebrow">Prescriptions</p>
      <p className="pp-hint">Prescriptions your dentist issued after a visit. Follow your dentist’s instructions; call the branch if you have a question.</p>
      {error && <p className="pp-hint" role="alert">{error}</p>}
      {!rows && !error && <p className="pp-hint" role="status">Loading…</p>}
      {rows && !rows.length && <p className="pp-hint">No prescriptions yet.</p>}
      {rows && rows.length > 0 && <ul className="pp-rx-list">{rows.map(p => <li key={p.id} className={p.status === 'Void' ? 'is-void' : ''}>
        <p><b>{p.number}</b> · {day(p.issued_at)}{p.patient?.name ? ` · ${p.patient.name}` : ''}{p.status === 'Void' ? <span className="pp-void"> VOID — do not use</span> : ''}</p>
        <p className="pp-hint">{p.dentist} · {p.branch}</p>
        <ol>{(p.lines || []).map((l, i) => <li key={i}><b>{l.medicine}</b>{[l.dosage, l.frequency, l.duration].filter(Boolean).length ? ` — ${[l.dosage, l.frequency, l.duration].filter(Boolean).join(', ')}` : ''}{l.instructions ? `. ${l.instructions}` : ''}</li>)}</ol>
        {p.note && <p className="pp-hint">Note: {p.note}</p>}
        <Button size="sm" variant="soft" icon="download" onClick={async () => { const r = await downloadPrescriptionPdf(p.id, p.number); if (!r.ok) toast(r.message || 'The PDF could not be downloaded.', 'warning') }}>Download PDF</Button>
      </li>)}</ul>}
    </section>
  </div>
}
