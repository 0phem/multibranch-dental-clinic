import React, { useEffect, useState } from 'react'
import { myChart } from '../../api-client.js'
import { ToothChart, toothLabel } from '../../pages/DentalChart.jsx'

/** M10: the patient's (or a dependent's) current tooth chart, read-only and simplified: status per tooth, no notes, no history. */
export function TeethPage() {
  const [data, setData] = useState(null), [error, setError] = useState(''), [picked, setPicked] = useState(null)
  useEffect(() => { myChart().then(r => (r.ok ? setData(r.data) : setError(r.message || 'Your chart could not be loaded.'))) }, [])
  const current = picked && data?.current?.find(c => c.tooth === picked)
  return <div className="pp-page pp-fade">
    <section className="pp-card">
      <p className="pp-eyebrow">My teeth</p>
      <p className="pp-hint">What your dentist recorded for each tooth. Ask your dentist if you have a question; this chart is not advice.</p>
      {error && <p className="pp-hint" role="alert">{error}</p>}
      {!data && !error && <p className="pp-hint" role="status">Loading…</p>}
      {data && (data.current.length ? <ToothChart data={data} picked={picked} onPick={setPicked}/> : <p className="pp-hint">Nothing recorded yet.</p>)}
      {current && <p className="pp-hint" aria-live="polite">Tooth {toothLabel(picked, data.settings?.numbering)}: <b>{current.status}</b>{current.surfaces?.length ? ` (${current.surfaces.join(' ')})` : ''}, {current.recorded_on}.</p>}
    </section>
  </div>
}
