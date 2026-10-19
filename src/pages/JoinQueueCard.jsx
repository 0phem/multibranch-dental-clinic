import React, { useState } from 'react'
import { Button, Notice } from '../components.jsx'

/**
 * Patient Home after "I have an account" on the counter page: join today's queue with the front-desk code. Shown only when the
 * patient came from a branch's counter link in this browser tab.
 */
export function JoinQueueCard() {
  const [branch] = useState(() => { try { return sessionStorage.getItem('join-branch') } catch { return null } })
  const [open, setOpen] = useState(false)
  if (!branch) return null
  return <section className="pp-card pp-fade join-card" aria-label="Join today’s queue">
    <Notice tone="info" title="At the clinic now?">Join today’s queue with the code shown at the front desk.</Notice>
    {open ? <JoinLazy branch={branch}/> : <Button onClick={() => setOpen(true)}>Join today’s queue</Button>}
  </section>
}

function JoinLazy({ branch }) {
  const [Comp, setComp] = useState(null), [done, setDone] = useState(null)
  if (!Comp) import('./Join.jsx').then(m => setComp(() => m.AccountJoin))
  if (done) return <Notice tone="success" title="You’re on today’s list">{done.message} Reference <b>{done.reference}</b>. Show your ID at the front desk.</Notice>
  return Comp ? <Comp branch={branch} code="" onDone={setDone}/> : <p role="status">Loading…</p>
}
