import React, { useEffect, useState } from 'react'
import { Button, Card } from '../components.jsx'
import { confirmNoShowFlag, dismissNoShowFlag, listNoShowFlags } from '../api-client.js'

/**
 * A2 front desk: today's possible no-shows in your branches, flagged by the system after the grace period (set by the Owner in
 * Administration → Automations). The system never marks a no-show by itself: Confirm runs the existing No-show command; Undo
 * keeps the appointment as it is (for example, the patient is in the waiting area). Refreshed every minute while visible.
 */
export function PossibleNoShows({ onChanged, toast = () => {} }) {
  const [rows, setRows] = useState([]), [busy, setBusy] = useState('')
  const load = () => listNoShowFlags().then(r => { if (r.ok) setRows(r.data || []) })
  useEffect(() => {
    load()
    const t = setInterval(() => { if (document.visibilityState === 'visible') load() }, 60000)
    return () => clearInterval(t)
  }, [])
  const act = async (flag, kind) => {
    setBusy(flag.id)
    const r = kind === 'confirm' ? await confirmNoShowFlag(flag.id) : await dismissNoShowFlag(flag.id)
    setBusy('')
    if (!r.ok) { toast(r.kind === 'validation' ? Object.values(r.errors || {})[0]?.[0] || r.message : r.message, 'warning'); return load() }
    toast(kind === 'confirm' ? `${flag.appointment?.patient || 'Appointment'} marked No-show.` : 'Flag removed. The appointment is unchanged.', 'success')
    setRows(list => list.filter(f => f.id !== flag.id))
    onChanged?.()
  }
  if (!rows.length) return null
  return <Card className="ns-card" title={`Possible no-shows (${rows.length})`} subtitle="Not checked in after the grace period. Confirm only after checking the waiting area.">
    <ul className="ns-list">
      {rows.map(f => <li key={f.id}>
        <div><b>{f.appointment?.patient}</b><span>{f.appointment?.time} · {f.appointment?.service} · {f.appointment?.branch} · {f.appointment?.code}</span></div>
        <div className="ns-actions">
          <Button size="sm" variant="danger" disabled={busy === f.id} onClick={() => act(f, 'confirm')}>Confirm no-show</Button>
          <Button size="sm" variant="ghost" disabled={busy === f.id} onClick={() => act(f, 'dismiss')}>Undo</Button>
        </div>
      </li>)}
    </ul>
  </Card>
}
