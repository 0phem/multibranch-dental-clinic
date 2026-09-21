import React, { useEffect, useRef, useState } from 'react'
import { Button, Card, Empty, Notice, PageHeader } from '../components.jsx'
import { validDate } from '../clock.js'
import { dateLabel, uid } from '../logic.js'
import { LOYALTY_REVIEW_MESSAGE } from '../loyalty.js'
import { formatStamp, patientContext, patientLoyalty } from '../patient-view.js'
import { RecordCard } from '../patient-ui.jsx'

const NO_ACCOUNT=<Notice tone="warning" title="We couldn’t confirm your account">Reopen your workspace, or ask the clinic to check your account access.</Notice>
const plural=n=>`${n} ${n===1?'point':'points'}`

// M24 Referral & Loyalty for the signed-in Patient. Everything shown comes from the session-scoped selector; the only
// write is the shared request command. The reward itself, referred-Patient tracking and any money value are not modeled.
export function PatientLoyaltyPage({ store }) {
  const { state, actions, toast }=store, session=store.session
  const view=patientContext(state,session)?patientLoyalty(state,session):null
  const command=useRef({size:-1,id:''}), requested=useRef(false), pendingNote=useRef(null)
  const [error,setError]=useState(''), [copied,setCopied]=useState(''), [canCopy,setCanCopy]=useState(false)
  useEffect(()=>{setCanCopy(typeof navigator!=='undefined'&&!!navigator.clipboard?.writeText)},[])
  // The request button is replaced by the pending message: keep keyboard focus on the page instead of dropping it.
  useEffect(()=>{if(requested.current&&view?.pending){requested.current=false;pendingNote.current?.focus()}},[view?.pending])
  if(!view)return NO_ACCOUNT
  const threshold=view.threshold

  const request=()=>{
    // One command ID per ledger state: a rapid second click replays the same command instead of failing as a second request.
    if(command.current.size!==view.history.length)command.current={size:view.history.length,id:uid('reward')}
    const result=actions.requestLoyaltyRedemption(command.current.id)
    if(!result.ok){setError(result.message);return}
    setError('');requested.current=true
    toast(result.unchanged?'Your reward request was already sent.':'Reward request sent to the clinic.','success')
  }
  const copy=async()=>{
    try{await navigator.clipboard.writeText(view.code);setCopied('Referral code copied.')}
    catch{setCopied('Could not copy automatically. Select the code and copy it.')}
  }
  const when=value=>validDate(String(value).slice(0,10))?String(value).length>10?formatStamp(value):dateLabel(value):String(value||'')

  return <div className="pt-page pt-loyalty">
    <PageHeader kicker="More" title="Referral & Loyalty" text="Your referral code, your points and any reward request."/>
    <Notice tone="info" title="A prototype program">This is a prototype referral and loyalty program built for demonstration. Its rules are not an established clinic policy. Clinic staff record points after a qualified visit or referral. With {plural(threshold)} you can request a {threshold}-point reward, and the clinic processes each request. The reward itself is not defined in this prototype.</Notice>

    {view.status==='none'&&<Empty title="No referral & loyalty account yet" text="Your referral code and points appear here once the clinic records qualified activity for you."/>}

    {view.status==='review'&&<Notice tone="warning" title={LOYALTY_REVIEW_MESSAGE}>We can’t show a reliable point balance right now, so reward requests are unavailable. Ask the clinic to review your loyalty activity.</Notice>}

    {view.status!=='none'&&<div className="pt-loyalty-top">
      {view.status==='ready'&&<Card title="Your points" subtitle="Recorded by the clinic">
        <p className="pt-points"><b>{view.points}</b><span>{view.points===1?'point':'points'}</span></p>
        <progress className="pt-meter" max={threshold} value={Math.min(view.points,threshold)} aria-label={`Progress toward a ${threshold}-point reward`}/>
        <p className="pt-hint">{view.points>=threshold?`You have enough for a ${threshold}-point reward.`:`${view.points} of ${threshold} points toward a reward.`}</p>
        <h3 className="pt-card-label pt-top-gap">Request a reward</h3>
        {view.pending?<p className="pt-pending" role="status" tabIndex={-1} ref={pendingNote}><b>Awaiting clinic processing.</b> {view.pendingSince?`You requested this on ${when(view.pendingSince)}.`:'Your request has been sent.'}</p>:<>
          <Button icon="gift" disabled={!view.canRequest} aria-describedby="pt-reward-note" onClick={request}>{`Request ${threshold}-point reward`}</Button>
          <p id="pt-reward-note" className="pt-hint">{view.canRequest?'The clinic reviews and processes your request.':view.reason}</p>
        </>}
        {error&&<p className="pt-error" role="alert">{error}</p>}
      </Card>}
      {view.code&&<Card title="Your referral code" subtitle="Assigned to you by the clinic">
        <code className="pt-code">{view.code}</code>
        {canCopy&&<Button variant="soft" icon="file" onClick={copy}>Copy code</Button>}
        <p className="pt-hint" role="status">{copied}</p>
        <p className="pt-hint">Referred-Patient tracking is not available yet, so this page shows only the activity the clinic has recorded.</p>
      </Card>}
    </div>}

    {view.status!=='none'&&view.history.length>0&&<Card title="Activity history" subtitle="Newest first">
      <div className="pt-list">{view.history.map(entry=><RecordCard key={entry.key} title={entry.label} subtitle={entry.date?when(entry.date):null} status={entry.status} level={3}>
        {entry.detail&&<p className="pt-muted">{entry.detail}</p>}
        {entry.pointsLabel&&<p className="pt-entry-points">{entry.pointsLabel}</p>}
      </RecordCard>)}</div>
    </Card>}
    {view.status==='ready'&&!view.history.length&&<Card title="Activity history"><Empty title="No activity yet" text="Points the clinic records for you will be listed here."/></Card>}
  </div>
}
