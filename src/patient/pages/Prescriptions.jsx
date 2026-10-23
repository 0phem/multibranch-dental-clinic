import React, { useEffect, useState } from 'react'
import { Button } from '../../components.jsx'
import { downloadPrescriptionPdf, myPrescriptions } from '../../api-client.js'
import { EmptyState, ErrorState, PageHead, Skeleton } from '../ui.jsx'

const day = iso => iso ? new Date(iso).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }) : ''

/** M19: the patient's (and their dependents') issued prescriptions, read-only, with the PDF. A void one is marked VOID. */
export function PrescriptionsPage({ toast = () => {} }) {
  const [rows, setRows] = useState(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0)
  useEffect(() => {
    setError('')
    myPrescriptions().then(r => (r.ok ? setRows(r.data) : setError(r.message || 'Your prescriptions could not be loaded.')))
  }, [attempt])
  return <div className="pp-page pp-fade">
    <PageHead eyebrow="Records & Billing" title="Prescriptions" text="Prescriptions your dentist issued after a visit. Follow your dentist’s instructions; call the branch if you have a question."/>
    {error && <ErrorState text={error} onRetry={() => setAttempt(a => a + 1)}/>}
    {!rows && !error && <Skeleton lines={4} label="Loading your prescriptions"/>}
    {rows && !rows.length && <EmptyState icon="file" title="No prescriptions yet" text="Prescriptions issued by your dentist after a visit will appear here."/>}
    {rows && rows.length > 0 && <section className="pp-card">
      <ul className="pp-rx-list">{rows.map(p => <li key={p.id} className={p.status === 'Void' ? 'is-void' : ''}>
        <p><b>{p.number}</b> · {day(p.issued_at)}{p.patient?.name ? ` · ${p.patient.name}` : ''}{p.status === 'Void' ? <span className="pp-void"> VOID — do not use</span> : ''}</p>
        <p className="pp-hint">{p.dentist} · {p.branch}</p>
        <ol>{(p.lines || []).map((l, i) => <li key={i}><b>{l.medicine}</b>{[l.dosage, l.frequency, l.duration].filter(Boolean).length ? ` — ${[l.dosage, l.frequency, l.duration].filter(Boolean).join(', ')}` : ''}{l.instructions ? `. ${l.instructions}` : ''}</li>)}</ol>
        {p.note && <p className="pp-hint">Note: {p.note}</p>}
        <Button size="sm" variant="soft" icon="download" onClick={async () => { const r = await downloadPrescriptionPdf(p.id, p.number); if (!r.ok) toast(r.message || 'The PDF could not be downloaded.', 'warning') }}>Download PDF</Button>
      </li>)}</ul>
    </section>}
  </div>
}
