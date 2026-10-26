import React, { useEffect, useState } from 'react'
import { myChart } from '../../api-client.js'
import { Odontogram } from '../../components/odontogram/index.js'
import { EmptyState, ErrorState, PageHead, Skeleton } from '../ui.jsx'

/** M10: the patient's (or a dependent's) current tooth chart, read-only and simplified: status per tooth, no notes, no history. */
export function TeethPage() {
  const [data, setData] = useState(null), [error, setError] = useState(''), [picked, setPicked] = useState(null), [attempt, setAttempt] = useState(0)
  useEffect(() => {
    setError('')
    myChart().then(r => (r.ok ? setData(r.data) : setError(r.message || 'Your chart could not be loaded.')))
  }, [attempt])
  return <div className="pp-page pp-fade">
    <PageHead eyebrow="Records & Billing" title="My teeth" text="What your dentist recorded for each tooth. Ask your dentist if you have a question; this chart is not medical advice."/>
    {error && <ErrorState text={error} onRetry={() => setAttempt(a => a + 1)}/>}
    {!data && !error && <Skeleton lines={4} label="Loading your dental chart"/>}
    {data && !data.current.length && <EmptyState icon="star" title="Nothing recorded yet" text="When your dentist records findings on your dental chart during a visit, they will appear here."/>}
    {data && data.current.length > 0 && <section className="pp-card">
      <Odontogram data={data} selected={picked} onSelect={setPicked} canRecord={false}/>
    </section>}
  </div>
}
