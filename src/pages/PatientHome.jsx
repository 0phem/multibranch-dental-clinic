import React from 'react'
import { Button, Icon, Notice, Status } from '../components.jsx'
import { dateLabel, displayTime } from '../logic.js'
import { patientActionRequired, patientHome, patientHomeMode, patientProfileGaps, queueSentence } from '../patient-view.js'
import { DefinitionList } from '../patient-ui.jsx'

const ACTION_ICON={hmo:'shield',followup:'followup',invoice:'receipt'}

// Active visit → next appointment → primary booking CTA. Unchanged priority logic (patientHome's `hero.kind`);
// only the surrounding Home layout changed in Phase 4B.3C-1.
function Hero({ hero, hasConversation, setPage }) {
  const message=hasConversation&&<Button variant="soft" icon="message" onClick={()=>setPage('messages')}>Message the clinic</Button>
  if(hero.kind==='queue'){
    const q=hero.queue
    return <>
      <div className="pt-hero-main"><h1 id="pt-hero-title">You’re checked in.</h1><p>{queueSentence(q)}</p><div className="row-actions"><Button icon="queue" onClick={()=>setPage('queue')}>View live queue</Button>{message}</div></div>
      <div className="pt-hero-card"><h2 className="pt-card-label">Your visit</h2><DefinitionList items={[{label:'Status',value:<Status>{q.status}</Status>},{label:'Place in line',value:q.position?`#${q.position}`:null},{label:'Estimated wait',value:q.waitMinutes!=null?`Estimated ${q.waitMinutes} min`:null},{label:'Dentist',value:q.dentist},{label:'Service',value:q.service},{label:'Branch',value:q.branch}]}/></div>
    </>
  }
  if(hero.kind==='none')return <div className="pt-hero-main"><h1 id="pt-hero-title">Ready for your next dental visit?</h1><p>Choose a branch, service and time. Only available times are shown.</p><div className="row-actions"><Button icon="plusCalendar" onClick={()=>setPage('book')}>Book a visit</Button>{message}</div></div>
  const a=hero.appointment, today=hero.kind==='today'
  return <>
    <div className="pt-hero-main"><h1 id="pt-hero-title">{today?'Your visit is today.':'Your next visit.'}</h1>
      <p>{today?`${a.service} at ${displayTime(a.start)} with ${a.dentist}.`:`${dateLabel(a.date)} at ${displayTime(a.start)} with ${a.dentist}.`}</p>
      {today&&<p className="pt-muted">The clinic records your arrival when you check in at the front desk.</p>}
      <div className="row-actions"><Button icon="calendar" onClick={()=>setPage('appointments',{entityId:a.id})}>View visit</Button>{!today&&<Button variant="soft" icon="plusCalendar" onClick={()=>setPage('book')}>Book another visit</Button>}{message}</div></div>
    <div className="pt-hero-card"><h2 className="pt-card-label">{today?'Today’s visit':'Upcoming visit'}</h2><DefinitionList items={[{label:'Status',value:<Status>{a.status}</Status>},{label:'Service',value:a.service},{label:'When',value:`${dateLabel(a.date)} · ${displayTime(a.start)}`},{label:'Dentist',value:a.dentist},{label:'Branch',value:a.branch}]}/></div>
  </>
}

// A brand-new Patient with no care history yet: simpler than the returning Home, no booking form embedded,
// no fabricated metrics. Mode is derived from real appointment/care/prescription/invoice/follow-up/HMO state each
// render — there is no stored "onboarding complete" flag to fall out of sync.
function FirstUseHome({ home, gaps, setPage }) {
  const quick=[
    ...(home.hasConversation?[['messages','message','Messages',home.unreadMessages?`${home.unreadMessages} unread`:'Your conversations']]:[]),
    ...(home.hasLoyalty?[['loyalty','gift','Referral & Loyalty','Your referral code and points']]:[]),
  ]
  return <div className="pt-first-use">
    <section className="pt-first-use-hero motion-in" aria-labelledby="pt-hero-title">
      <span className="pt-eyebrow">{`${home.greeting}, ${home.firstName}`}</span>
      <h1 id="pt-hero-title">Need a visit?</h1>
      <p>Choose a branch, service and time that works for you. Only real available times are shown, and nothing is charged when you book — billing happens after a completed visit.</p>
      <div className="row-actions"><Button icon="plusCalendar" onClick={()=>setPage('book')}>Start booking</Button></div>
    </section>
    {gaps.length>0&&<Notice tone="info" title="Before your visit">{gaps.map(g=>g.message).join(' ')}</Notice>}
    {quick.length>0&&<nav className="pt-home-aside pt-first-use-aside" aria-label="Quick access">
      <ul className="pt-quick">{quick.map(([page,icon,label,hint])=><li key={page}><button type="button" onClick={()=>setPage(page)}><span aria-hidden="true"><Icon name={icon} size={20}/></span><span><b>{label}</b><small>{hint}</small></span><Icon name="chevron" size={16}/></button></li>)}</ul>
    </nav>}
  </div>
}

export function PatientHome({ store, setPage }) {
  const home=patientHome(store.state,store.session)
  const mode=patientHomeMode(store.state,store.session)
  if(!home)return <Notice tone="warning" title="We couldn’t confirm your account">Reopen your workspace, or ask the clinic to check your account access.</Notice>
  if(mode==='first-use')return <FirstUseHome home={home} gaps={patientProfileGaps(store.state,store.session)} setPage={setPage}/>
  const actionRequired=patientActionRequired(store.state,store.session)
  // Compact quick actions: only destinations NOT already in primary navigation (Home/Book/Visits/Me), and only
  // Messages/Referral & Loyalty when they genuinely apply — never a duplicate entry point.
  const quick=[
    ['billing','receipt','Payments','Issued invoices and receipts'],
    ['prescriptions','pill','Prescriptions','Authorized by your Dentist'],
    ['hmo','shield','HMO coverage','Documents and status'],
    ...(home.hasConversation?[['messages','message','Messages',home.unreadMessages?`${home.unreadMessages} unread`:'Your conversations']]:[]),
    ...(home.hasLoyalty?[['loyalty','gift','Referral & Loyalty','Your referral code and points']]:[]),
  ]
  return <div className="pt-home">
    <section className="pt-hero" aria-labelledby="pt-hero-title">
      <span className="pt-eyebrow">{`${home.greeting}, ${home.firstName}`}</span>
      <div className="pt-hero-grid"><Hero hero={home.hero} hasConversation={home.hasConversation} setPage={setPage}/></div>
    </section>
    <nav className="pt-home-quick" aria-label="Quick access">
      <ul className="pt-quick">{quick.map(([page,icon,label,hint])=><li key={page}><button type="button" onClick={()=>setPage(page)}><span aria-hidden="true"><Icon name={icon} size={20}/></span><span><b>{label}</b><small>{hint}</small></span><Icon name="chevron" size={16}/></button></li>)}</ul>
    </nav>
    {actionRequired.length>0&&<section className="pt-action-required" aria-label="Action required">
      <h2 className="pt-card-label">Action required</h2>
      <ul className="pt-attention">{actionRequired.map(item=><li key={item.id}>
        <span className="pt-attention-icon" aria-hidden="true"><Icon name={ACTION_ICON[item.kind]||'activity'} size={18}/></span>
        <div><b>{item.title}</b><p>{item.detail}</p></div>
        <Button size="sm" variant="soft" onClick={()=>setPage(item.page,item.context)}>{item.action}</Button>
      </li>)}</ul>
    </section>}
  </div>
}
