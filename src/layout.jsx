import React from 'react'
import { NAV, ROLE_INFO } from './data.js'
import { Button, Icon, Status } from './components.jsx'

const NAV_ICONS={
  dashboard:'home',book:'plusCalendar',appointments:'calendar',schedule:'calendar',checkin:'checkin',queue:'queue',capacity:'activity',
  patients:'users',treatment:'tooth',billing:'receipt',hmo:'shield',inquiries:'message',messages:'message',prescriptions:'pill',followups:'followup',
  branches:'building',team:'users',analytics:'chart',users:'shield',automation:'settings',engagement:'sparkles',loyalty:'gift',modules:'file'
}

const GROUPS={
  patient:[['Overview',['dashboard']],['Your care',['book','appointments','queue','prescriptions','followups']],['Communication',['messages','billing','loyalty']]],
  staff:[['Today',['dashboard','appointments','checkin','queue','capacity']],['Patients & finance',['patients','billing','hmo']],['Communication',['inquiries','messages','followups','engagement']]],
  dentist:[['Today',['dashboard','schedule','queue']],['Clinical',['patients','treatment','prescriptions','followups']],['Communication',['messages']]],
  owner:[['Overview',['dashboard','analytics']],['Operations',['branches','team','capacity','hmo']],['Administration',['users','automation','engagement']]],
}

function navGroups(role){
  const lookup=Object.fromEntries(NAV[role].map(([key,label])=>[key,label]))
  return GROUPS[role].map(([title,keys])=>[title,keys.filter(k=>lookup[k]).map(k=>[k,lookup[k]])]).filter(([,items])=>items.length)
}

export function Login({ onLogin }) {
  const [selected,setSelected]=React.useState('patient')
  const info=ROLE_INFO[selected]
  return <div className="login-shell">
    <section className="login-panel">
      <div className="login-brand-row">
        <div className="brand big"><div className="brand-mark"><Icon name="tooth" size={21}/></div><div><strong>DentalOps</strong><span>Multi-Branch Dental Clinic</span></div></div>
        <span className="secure-pill"><Icon name="shield" size={14}/> Secure workspace</span>
      </div>
      <div className="login-copy-wrap">
        <div className="eyebrow">Clinic operations, simplified</div>
        <h1>One connected workspace for every clinic journey.</h1>
        <p className="login-copy">Appointments, patient flow, clinical work, billing, HMO, communication and executive oversight — designed around the person using it.</p>
      </div>
      <div className="role-switcher" aria-label="Choose demo role">
        {Object.entries(ROLE_INFO).map(([key,role])=><button key={key} className={`role-choice ${selected===key?'selected':''}`} onClick={()=>setSelected(key)}>
          <span className="role-icon"><Icon name={key==='patient'?'user':key==='staff'?'users':key==='dentist'?'tooth':'chart'} size={19}/></span>
          <div><strong>{role.label}</strong><small>{role.subtitle}</small></div>
          {selected===key&&<span className="selected-check">✓</span>}
        </button>)}
      </div>
      <Button className="login-button" icon="arrow" onClick={()=>onLogin(selected)}>Continue as {info.label}</Button>
      <div className="prototype-disclaimer"><span>Demo environment</span> Frontend-only data is used for presentation. Production integrations are represented but not connected.</div>
    </section>
    <aside className="login-visual">
      <div className="login-glow one"/><div className="login-glow two"/>
      <div className="visual-card hero-preview">
        <div className="visual-kicker">Today • Branch A</div>
        <div className="preview-head"><div><span>Good morning</span><h2>Clinic flow at a glance</h2></div><div className="preview-avatar">DR</div></div>
        <div className="preview-metrics"><div><b>14</b><span>Appointments</span></div><div><b>03</b><span>Waiting</span></div><div><b>18m</b><span>Avg. wait</span></div></div>
        <div className="preview-list"><div><i className="done"/><span><b>09:30</b> Maria Santos • Cleaning</span><em>In chair</em></div><div><i/><span><b>10:15</b> Jason Cruz • Consultation</span><em>Next</em></div><div><i/><span><b>11:00</b> Bea Lim • Restoration</span><em>Confirmed</em></div></div>
      </div>
      <div className="visual-stack compact"><div><span><Icon name="calendar" size={18}/></span><b>Smart scheduling</b><small>Only valid, available slots</small></div><div><span><Icon name="activity" size={18}/></span><b>Live patient flow</b><small>Queue and wait visibility</small></div><div><span><Icon name="chart" size={18}/></span><b>Executive intelligence</b><small>Trends, alerts and drill-downs</small></div></div>
      <div className="visual-footer"><Status>System ready</Status><span>Designed for three connected branches</span></div>
    </aside>
  </div>
}

function NotificationPanel({role,store,onClose}){
  const {state,setters}=store
  const pid=ROLE_INFO.patient.patientId
  const items=role==='patient'?state.notifications.filter(n=>n.patientId===pid):state.notifications
  const visible=items.slice(0,8)
  const markAll=()=>{
    if(role==='patient') setters.setNotifications(xs=>xs.map(n=>n.patientId===pid?{...n,read:true}:n))
    else setters.setNotifications(xs=>xs.map(n=>({...n,read:true})))
  }
  return <div className="notification-popover">
    <div className="notification-popover-head"><div><span>Notifications</span><small>Operational updates and reminders</small></div><button className="icon-btn" onClick={onClose}><Icon name="x" size={17}/></button></div>
    <div className="notification-toolbar"><button onClick={markAll}>Mark all as read</button></div>
    <div className="notification-scroll">{visible.length?visible.map(n=><div className={`notification-row ${n.read?'':'unread'}`} key={n.id}><span className="notification-dot"/><div><b>{n.type}</b><p>{n.text}</p><small>{n.createdAt} • {n.channel}</small></div></div>):<div className="notification-empty">You're all caught up.</div>}</div>
  </div>
}

function ClinicAssistant({role}){
  const [open,setOpen]=React.useState(false)
  const [answer,setAnswer]=React.useState('')
  const quick=role==='patient'?['How do I book?','What do I need for HMO?','How does the queue work?']:['Show workflow help','Explain this dashboard','How are alerts prioritized?']
  const reply=q=>{
    const map={
      'How do I book?':'Open Book Appointment, choose a branch and service, then pick any validated available slot. Smart Schedule can also suggest options for you.',
      'What do I need for HMO?':'Your HMO case shows any missing requirements. Upload or submit the listed documents before the request can move to provider verification.',
      'How does the queue work?':'After check-in, you receive a live queue position and estimated wait. You’ll be notified when you are next.',
      'Show workflow help':'Use the page actions for the current task. The system automatically handles cross-module handoffs where configured.',
      'Explain this dashboard':'This dashboard prioritizes the work and exceptions that need your attention right now.',
      'How are alerts prioritized?':'Operational alerts are surfaced by urgency, waiting time, HMO thresholds, failed automations, and role responsibility.'
    }
    setAnswer(map[q]||'I can help with clinic navigation and workflow questions. Clinical diagnosis and treatment decisions always stay with a dentist.')
  }
  return <>
    <button className="assistant-fab" onClick={()=>setOpen(v=>!v)} aria-label="Open clinic assistant"><Icon name="robot" size={22}/></button>
    {open&&<div className="assistant-panel"><div className="assistant-head"><div className="assistant-avatar"><Icon name="robot" size={19}/></div><div><b>DentalOps Assistant</b><small>Clinic navigation & workflow help</small></div><button className="icon-btn" onClick={()=>setOpen(false)}><Icon name="x" size={16}/></button></div><div className="assistant-body"><div className="assistant-bubble">Hi! I can help you navigate the clinic system. I won’t diagnose conditions or make treatment decisions.</div>{answer&&<div className="assistant-bubble answer">{answer}</div>}<div className="assistant-quick">{quick.map(q=><button key={q} onClick={()=>reply(q)}>{q}</button>)}</div></div></div>}
  </>
}

export function Shell({ role, page, setPage, onLogout, activeBranch, setActiveBranch, resetDemo, store, children }) {
  const info=ROLE_INFO[role]
  const [mobileOpen,setMobileOpen]=React.useState(false)
  const [notificationsOpen,setNotificationsOpen]=React.useState(false)
  const pid=ROLE_INFO.patient.patientId
  const unread=role==='patient'?store.state.notifications.filter(n=>n.patientId===pid&&!n.read).length:store.state.notifications.filter(n=>!n.read).length
  const groups=navGroups(role)
  const mobilePatientNav=[['dashboard','Home'],['appointments','Visits'],['book','Book'],['queue','Queue'],['messages','Messages']]
  const selectPage=key=>{setPage(key);setMobileOpen(false)}
  return <div className={`app-shell role-${role}`}>
    <aside className={`sidebar ${mobileOpen?'open':''}`}>
      <div className="sidebar-brand"><div className="brand"><div className="brand-mark"><Icon name="tooth" size={19}/></div><div><strong>DentalOps</strong><span>Clinic Operation System</span></div></div><button className="mobile-close icon-btn" onClick={()=>setMobileOpen(false)}><Icon name="x" size={19}/></button></div>
      <div className="role-card"><span>{info.name.split(' ').map(x=>x[0]).filter(Boolean).slice(0,2).join('')}</span><div><small>{info.label}</small><b>{info.name}</b><em>{role==='owner'?'All branches':activeBranch}</em></div></div>
      <nav className="main-nav">{groups.map(([title,items])=><div className="nav-group" key={title}><span className="nav-group-label">{title}</span>{items.map(([key,label])=><button key={key} className={page===key?'active':''} onClick={()=>selectPage(key)}><Icon name={NAV_ICONS[key]||'home'} size={18}/><span>{label}</span>{page===key&&<i/>}</button>)}</div>)}</nav>
      <div className="sidebar-footer"><button onClick={resetDemo}><Icon name="settings" size={16}/>Reset demo data</button><button onClick={onLogout}><Icon name="logout" size={16}/>Log out</button></div>
    </aside>
    {mobileOpen&&<div className="mobile-scrim" onClick={()=>setMobileOpen(false)}/>} 
    <main className="main-shell">
      <header className="topbar">
        <div className="topbar-left"><button className="mobile-menu icon-btn" onClick={()=>setMobileOpen(true)}><Icon name="menu" size={21}/></button><div className="topbar-context"><span className="system-live"><i/> Live demo workspace</span>{role==='owner'&&<label className="branch-scope"><span>Branch</span><select value={activeBranch} onChange={e=>setActiveBranch(e.target.value)}><option>All Branches</option>{store.state.branches.map(b=><option key={b.id}>{b.name}</option>)}</select></label>}{(role==='staff'||role==='dentist')&&<div className="branch-lock"><small>Assigned branch</small><b>{activeBranch}</b></div>}</div></div>
        <div className="top-actions"><button className="top-icon-btn" onClick={()=>setNotificationsOpen(v=>!v)} aria-label="Notifications"><Icon name="bell" size={19}/>{unread>0&&<span className="notification-count">{Math.min(unread,9)}</span>}</button><div className="top-user"><span>{info.name.split(' ').map(x=>x[0]).filter(Boolean).slice(0,2).join('')}</span><div><b>{info.name}</b><small>{info.subtitle}</small></div><Icon name="chevron" size={14}/></div></div>
        {notificationsOpen&&<NotificationPanel role={role} store={store} onClose={()=>setNotificationsOpen(false)}/>} 
      </header>
      <div className="content">{children}</div>
    </main>
    {role==='patient'&&<nav className="patient-mobile-nav">{mobilePatientNav.map(([key,label])=><button key={key} className={page===key?'active':''} onClick={()=>setPage(key)}><Icon name={NAV_ICONS[key]||'home'} size={20}/><span>{label}</span></button>)}</nav>}
    <ClinicAssistant role={role}/>
  </div>
}

export function ToastStack({ toasts }) {
  return <div className="toast-stack">{toasts.map(t=><div className={`toast ${t.tone||''}`} key={t.id}><span className="toast-icon">{t.tone==='success'?'✓':t.tone==='warning'?'!':'i'}</span><span>{t.message}</span></div>)}</div>
}
