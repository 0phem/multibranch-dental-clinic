import React, { useEffect, useState } from 'react'
import { Card, Notice, PageHeader } from '../components.jsx'
import { dentistApproveMessageTemplate, listMessageTemplates } from '../api-client.js'
import { TemplateEditor } from './Automations.jsx'

/**
 * Dentist: approve the wording of health-related automated emails (recall, R2-11) and, for recall, the intervals shown with it.
 * The Owner writes the wording; a Dentist only reviews and approves it. Nothing is sent until both approved.
 */
export function WordingApprovalsPage({ store }) {
  const toast = store?.toast || (() => {})
  const [rows, setRows] = useState(null), [rules, setRules] = useState([]), [error, setError] = useState('')
  useEffect(() => { listMessageTemplates().then(r => { if (r.ok) { setRows(r.data || []); setRules(r.meta?.recall_rules || []) } else setError(r.message || 'Could not load the wording.') }) }, [])
  return <div className="cd-page">
    <PageHeader kicker="Dentist" title="Wording to approve" text="Automated emails that touch health need a Dentist’s approval before the clinic can send them."/>
    {error && <Notice tone="warning" title="Unavailable">{error}</Notice>}
    {(rows || []).map(t => <Card key={t.key} title={t.name} subtitle={t.dentist_approval ? `Approved by ${t.dentist_approval.by}` : 'Waiting for a Dentist’s approval'}>
      {t.key === 'recall_due' && <p className="au-desc">Recall intervals you approve with this wording: {rules.length ? rules.map(r => `${r.category} every ${r.months} months`).join('; ') : 'none set'}.</p>}
      <TemplateEditor template={t} toast={toast} canEdit={false} approveAction={dentistApproveMessageTemplate} onChanged={n => setRows(list => list.map(x => (x.key === n.key ? n : x)))}/>
    </Card>)}
    {rows && !rows.length && <p className="au-muted">Nothing needs your approval.</p>}
  </div>
}
