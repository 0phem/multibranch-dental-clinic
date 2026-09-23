import React, { useContext } from 'react'
import { Button, Card, Empty, Icon, Notice, ShellActionsContext, Status } from '../components.jsx'
import { dateLabel, displayTime } from '../logic.js'
import { patientHome, patientHomeMode, patientProfileGaps, queueSentence } from '../patient-view.js'
import { DefinitionList, RecordCard } from '../patient-ui.jsx'

const ATTENTION_ICON={hmo:'shield',followup:'followup',invoice:'receipt',prescription:'pill',message:'message',notification:'bell'}

function Hero({ hero, hasConversation, setPage }) {
  const message=hasConversation&&<Button variant="soft" icon="message" onClick={()=>setPage('messages')}>Message the clinic</Button>
  if(hero.kind==='queue'){
    const q=hero.queue
    return <>
      <div className="pt-hero-main"><h1 id="pt-hero-title">You’re checked in.</h1><p>{queueSentence(q)}</p><div className="row-actions"><Button icon="queue" onClick={()=>setPage('queue')}>View live queue</Button>{message}</div></div>
      <div className="pt-hero-card"><h2 className="pt-card-label">Your visit</h2><DefinitionList items={[{label:'Status',value:<Status>{q.status}</Status>},{label:'Place in line',value:q.position?`#${q.position}`:null},{label:'Estimated wait',value:q.waitMinutes!=null?`About ${q.waitMinutes} min`:null},{label:'Dentist',value:q.dentist},{label:'Service',value:q.service},{label:'Branch',value:q.branch}]}/></div>
    </>
  }
  if(hero.kind==='none')return <div className="pt-hero-main"><h1 id="pt-hero-title">Ready for your next dental visit?</h1><p>Choose a branch, service and time. Only available times are shown.</p><div className="row-actions"><Button icon="plusCalendar" onClick={()=>setPage('book')}>Book an appointment</Button>{message}</div></div>
  const a=hero.appointment, today=hero.kind==='today'
  return <>
    <div className="pt-hero-main"><h1 id="pt-hero-title">{today?'Your visit is today.':'Your next visit.'}</h1>
      <p>{today?`${a.service} at ${displayTime(a.start)} with ${a.dentist}.`:`${dateLabel(a.date)} at ${displayTime(a.start)} with ${a.dentist}.`}</p>
      {today&&<p className="pt-muted">The clinic records your arrival when you check in at the front desk.</p>}
      <div className="row-actions"><Button icon="calendar" onClick={()=>setPage('appointments',{entityId:a.id})}>View appointment</Button>{!today&&<Button variant="soft" icon="plusCalendar" onClick={()=>setPage('book')}>Book another visit</Button>}{message}</div></div>
    <div className="pt-hero-card"><h2 className="pt-card-label">{today?'Today’s visit':'Upcoming visit'}</h2><DefinitionList items={[{label:'Status',value:<Status>{a.status}</Status>},{label:'Service',value:a.service},{label:'When',value:`${dateLabel(a.date)} · ${displayTime(a.start)}`},{label:'Dentist',value:a.dentist},{label:'Branch',value:a.branch}]}/></div>
  </>
}

// A brand-new Patient with no care history yet: simpler than the returning Journey Hub, no booking form embedded,
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
  const shell=useContext(ShellActionsContext)
  const home=patientHome(store.state,store.session)
  const mode=patientHomeMode(store.state,store.session)
  if(!home)return <Notice tone="warning" title="We couldn’t confirm your account">Reopen your workspace, or ask the clinic to check your account access.</Notice>
  if(mode==='first-use')return <FirstUseHome home={home} gaps={patientProfileGaps(store.state,store.session)} setPage={setPage}/>
  const quick=[
    ['book','plusCalendar','Book a visit','Choose a branch, service and time'],
    ['appointments','calendar','Appointments','Upcoming and past visits'],
    ['prescriptions','pill','Prescriptions','Authorized by your Dentist'],
    ['billing','receipt','Receipts & payments','Issued invoices and receipts'],
    ['hmo','shield','HMO coverage','Documents and status'],
    ...(home.hasConversation?[['messages','message','Messages',home.unreadMessages?`${home.unreadMessages} unread`:'Your conversations']]:[]),
    ...(home.hasLoyalty?[['loyalty','gift','Referral & Loyalty','Your referral code and points']]:[]),
  ]
  return <div className="pt-home">
    <div className="pt-home-main">
      <section className="pt-hero" aria-labelledby="pt-hero-title">
        <span className="pt-eyebrow">{`${home.greeting}, ${home.firstName}`}</span>
        <div className="pt-hero-grid"><Hero hero={home.hero} hasConversation={home.hasConversation} setPage={setPage}/></div>
      </section>
      <Card title="Needs your attention" subtitle="Only things that need something from you" className="pt-section">
        {home.attention.length?<ul className="pt-attention">{home.attention.map(item=><li key={item.id}>
          <span className="pt-attention-icon" aria-hidden="true"><Icon name={ATTENTION_ICON[item.kind]||'activity'} size={18}/></span>
          <div><b>{item.title}</b><p>{item.detail}</p></div>
          <Button size="sm" variant="soft" onClick={()=>item.page?setPage(item.page,item.context):shell.openNotifications?.()}>{item.action}</Button>
        </li>)}</ul>:<p className="pt-clear"><Icon name="shield" size={18}/>You’re up to date. Nothing needs your attention right now.</p>}
      </Card>
      <Card title="Recent care" subtitle="Your latest completed visits" className="pt-section">
        {home.care.length?<div className="pt-list">{home.care.map(entry=><RecordCard key={entry.id} id={`care-${entry.id}`} title={entry.procedure||entry.services.join(', ')||'Completed visit'} subtitle={`${dateLabel(entry.date)} • ${entry.dentist}`} status="Completed" actions={entry.hasVisit&&<Button size="sm" variant="ghost" onClick={()=>setPage('appointments',{entityId:entry.appointmentId})}>View visit details</Button>}>
          <DefinitionList items={[{label:'Services',value:entry.services.join(', ')}]}/>
        </RecordCard>)}</div>:<Empty title="No completed visits yet" text="Your completed visits will appear here."/>}
      </Card>
    </div>
    <nav className="pt-home-aside" aria-label="Quick access">
      <h2 className="pt-card-label">Quick access</h2>
      <ul className="pt-quick">{quick.map(([page,icon,label,hint])=><li key={page}><button type="button" onClick={()=>setPage(page)}><span aria-hidden="true"><Icon name={icon} size={20}/></span><span><b>{label}</b><small>{hint}</small></span><Icon name="chevron" size={16}/></button></li>)}</ul>
    </nav>
  </div>
}
