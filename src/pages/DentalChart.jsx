import React, { useEffect, useState } from 'react'
import { Button, Card, Field, Notice, PageHeader } from '../components.jsx'
import { patientChart, prescriptionVisits, recordChartEntry, searchPatients } from '../api-client.js'
import { Odontogram, toothLabel } from '../components/odontogram/index.js'

export { toothLabel } from '../components/odontogram/index.js'

const firstError = r => (r.kind === 'validation' ? Object.values(r.errors || {})[0]?.[0] || r.message : r.message) || 'That did not work.'

/** Unified ChartView (shared between Dentist page, Staff patient record, and drawer) */
export function ChartView({ patientId, canRecord, toast, store }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [picked, setPicked] = useState(null)

  useEffect(() => {
    setData(null)
    setPicked(null)
    patientChart(patientId).then(r => (r.ok ? setData(r.data) : setError(r.message || 'The chart could not be loaded.')))
  }, [patientId])

  if (error) return <Notice tone="warning" title="Chart unavailable">{error}</Notice>
  if (!data) return <p className="au-muted" role="status">Loading the chart…</p>

  const branches = store?.state?.branches || []
  const activeBranchId = store?.session?.branchId || null

  const handleRecord = async (payload) => {
    const res = await recordChartEntry(patientId, payload)
    if (res.ok) {
      toast?.(`Tooth ${toothLabel(payload.tooth, data.settings?.numbering)} recorded.`, 'success')
      setData(res.data)
      return { ok: true }
    } else {
      return { ok: false, message: firstError(res) }
    }
  }

  return (
    <div className="tc-unified-chart">
      <Odontogram
        data={data}
        selected={picked}
        onSelect={setPicked}
        canRecord={canRecord}
        onRecord={handleRecord}
        branches={branches}
        activeBranchId={activeBranchId}
      />
    </div>
  )
}

/** Dentist: Dental chart page with 100k+ scalable searchable patient picker (Rule 3.4). */
export function SearchablePatientPicker({ selectedPatient, onSelect, store }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [recentPatients, setRecentPatients] = useState([])

  useEffect(() => {
    prescriptionVisits().then(r => {
      if (r.ok && Array.isArray(r.data)) {
        const unique = [...new Map(r.data.map(v => [v.patient.id, v.patient])).values()]
        setRecentPatients(unique)
      }
    })
  }, [])

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    const timer = setTimeout(async () => {
      setLoading(true)
      const res = await searchPatients({ search: query.trim(), per_page: 25 })
      setLoading(false)
      if (res.ok && Array.isArray(res.data)) {
        setResults(res.data)
      } else {
        const q = query.trim().toLowerCase()
        const local = (store?.state?.patients || []).filter(p =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.patientCode || '').toLowerCase().includes(q) ||
          (p.phone || '').includes(q)
        )
        setResults(local)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query, store])

  const shown = query.trim().length >= 2 ? results : recentPatients

  return (
    <div className="searchable-patient-picker" style={{ marginBottom: '16px' }}>
      <Field label="Select or search patient" hint="Search 100,000+ clinic patients by name, code (PAT-0001), or mobile number">
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={query}
            placeholder="Search patient by name, patient code, or phone number…"
            onChange={e => setQuery(e.target.value)}
            style={{ width: '100%', paddingRight: '32px' }}
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setResults([]) }}
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </Field>

      {selectedPatient ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--surface-muted, #f8fafc)', border: '1px solid var(--line)', borderRadius: '8px', marginTop: '8px' }}>
          <div>
            <b style={{ fontSize: '15px' }}>{selectedPatient.name}</b>
            <span style={{ display: 'block', fontSize: '12px', color: 'var(--muted)' }}>
              {selectedPatient.patientCode || selectedPatient.id} {selectedPatient.phone ? `· ${selectedPatient.phone}` : ''}
            </span>
          </div>
          <Button size="sm" variant="ghost" onClick={() => onSelect(null)}>Change patient</Button>
        </div>
      ) : (
        <div style={{ marginTop: '8px', maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--line)', borderRadius: '8px', background: 'var(--surface)' }}>
          {loading && <p style={{ padding: '12px', margin: 0, color: 'var(--muted)', fontSize: '13px' }}>Searching patient database…</p>}
          {!loading && shown.length === 0 && (
            <p style={{ padding: '12px', margin: 0, color: 'var(--muted)', fontSize: '13px' }}>
              {query.trim().length >= 2 ? 'No patients found matching your search.' : 'Type at least 2 characters to search, or pick from recent visits below.'}
            </p>
          )}
          {!loading && shown.map(p => (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(p)}
              onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onSelect(p)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderBottom: '1px solid var(--line)',
                cursor: 'pointer',
              }}
              className="patient-picker-item"
            >
              <div>
                <b style={{ fontSize: '14px' }}>{p.name}</b>
                <span style={{ display: 'block', fontSize: '12px', color: 'var(--muted)' }}>
                  {p.patientCode || p.id} {p.phone ? `· ${p.phone}` : ''}
                </span>
              </div>
              <Button size="sm" variant="soft">Open Chart</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function DentalChartPage({ store }) {
  const toast = store?.toast || (() => {})
  const [selectedPatient, setSelectedPatient] = useState(null)
  return <div className="st-page">
    <PageHeader kicker="Clinical" title="Dental chart" text="Record what you find per tooth and surface. Each entry is kept; the latest one is the current chart. The system makes no diagnosis or suggestion."/>
    <Card>
      <SearchablePatientPicker selectedPatient={selectedPatient} onSelect={setSelectedPatient} store={store}/>
      {selectedPatient && <ChartView patientId={selectedPatient.id} canRecord toast={toast} store={store}/>}
    </Card>
  </div>
}
