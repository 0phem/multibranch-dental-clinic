import React from 'react'
import { NAV, ROLE_INFO } from './data.js'
import { visibleNotifications, notificationDestination } from './phase3-contracts.js'
import { sessionForRole } from './contracts.js'
import { canAccessPage } from './safeguards.js'
import { Button, ConfirmDialog, Field, Icon, Modal, Notice, ShellActionsContext } from './components.jsx'
import { patientConversations } from './patient-view.js'

const useLayoutEffectSafe=typeof window==='undefined'?React.useEffect:React.useLayoutEffect

const NAV_ICONS={
  dashboard:'home',book:'plusCalendar',appointments:'calendar',schedule:'calendar',checkin:'checkin',queue:'queue',capacity:'activity',
  patients:'users',treatment:'tooth',billing:'receipt',hmo:'shield',inquiries:'message',messages:'message',prescriptions:'pill',followups:'followup',
  branches:'building',team:'users',analytics:'chart',users:'shield',automation:'settings',engagement:'sparkles',loyalty:'gift',modules:'file',me:'user'
}

const GROUPS={
  // Primary Patient destinations only (Phase 4B.3C-1): Home/Book/Visits/Messages/Payments/Me. Queue is contextual
  // (reached from Home's active-visit card, not a permanent nav item). HMO/Prescriptions/Follow-ups/Referral &
  // Loyalty remain fully reachable pages (see `pages` in safeguards.js and Me's secondary links) — they are just
  // not primary navigation destinations.
  patient:[['Overview',['dashboard']],['Booking',['book','appointments']],['Communication',['messages']],['Account',['billing','me']]],
  staff:[['Today',['dashboard','appointments','checkin','queue','capacity']],['Patients & finance',['patients','billing','hmo']],['Communication',['inquiries','messages','followups','engagement']]],
  dentist:[['Today',['dashboard','schedule','queue']],['Clinical',['patients','treatment','prescriptions','followups']],['Communication',['messages']]],
  owner:[['Overview',['dashboard','analytics']],['Operations',['branches','team','capacity','hmo']],['Administration',['users','automation','engagement']]],
}

function navGroups(role){
  const lookup=Object.fromEntries(NAV[role].map(([key,label])=>[key,label]))
  return GROUPS[role].map(([title,keys])=>[title,keys.filter(k=>lookup[k]).map(k=>[k,lookup[k]])]).filter(([,items])=>items.length)
}

// Authoritative clinic identity is the text "Dr. Dana E. Roxas" / "Dental Clinic", set beside the official compact
// logo (decorative, so empty alt). Never redraw or recolor the logo. logo-with-name.png is a supplied asset whose
// embedded wording differs from this identity, so it is intentionally not rendered.
export function Brand({className=''}){
  return <div className={`brand ${className}`.trim()}><img className="clinic-logo" src="/images/logo.png" alt="" width="48" height="48"/><div><strong>Dr. Dana E. Roxas</strong><span>Dental Clinic</span></div></div>
}

// Real sign-in for every role (Backend Foundation 1B): the backend's GET /api/me determines role after a
// successful login, so one email+password form serves Patient/Staff/Dentist/Owner alike — there is no client
// role picker to trust or forge. `onLogin(email,password)` is expected to return a Promise resolving to
// `{ok:true}` or `{ok:false, message}` (see App.jsx / api-client.js); this component owns only its own
// submitting/error UI state, never the auth result itself.
export function Login({ onLogin, onShowRegister }) {
  const [email,setEmail]=React.useState('')
  const [password,setPassword]=React.useState('')
  const [showPassword,setShowPassword]=React.useState(false)
  const [submitting,setSubmitting]=React.useState(false)
  const [error,setError]=React.useState('')
  const submit=async event=>{
    event.preventDefault()
    if(submitting)return
    setError('')
    setSubmitting(true)
    const result=await onLogin(email,password)
    setSubmitting(false)
    if(!result?.ok)setError(result?.message||'Something went wrong. Try again.')
  }
  return <main className="login-shell">
    <section className="login-panel" aria-labelledby="login-title">
      <Brand className="brand-login"/>
      <div className="login-copy-wrap"><div className="eyebrow">Welcome to your clinic workspace</div><h1 id="login-title">Welcome back</h1><p className="login-copy">Sign in to manage your visit or continue the clinic’s day.</p></div>
      <form onSubmit={submit} noValidate>
        <Field label="Email" required><input type="email" autoComplete="email" value={email} onChange={e=>{setEmail(e.target.value);setError('')}}/></Field>
        <Field label="Password" required><input type={showPassword?'text':'password'} autoComplete="current-password" value={password} onChange={e=>{setPassword(e.target.value);setError('')}}/></Field>
        <label className="show-password"><input type="checkbox" checked={showPassword} onChange={e=>setShowPassword(e.target.checked)}/> Show password</label>
        {error&&<Notice tone="warning" title="Couldn’t sign in">{error}</Notice>}
        <Button type="submit" className="login-button" icon="arrow" disabled={submitting}>{submitting?'Signing in…':'Sign in'}</Button>
      </form>
      {onShowRegister&&<p className="login-register-link">New patient? <button type="button" className="text-link" onClick={onShowRegister}>Create an account</button></p>}
    </section>
    <aside className="login-visual" aria-label="Workspace overview"><span className="eyebrow">One continuous care journey</span><h2>A clearer day.<br/>For everyone.</h2><p>From the first appointment to the next visit, keep the right information with the right people.</p><ol className="login-journey"><li><b>Plan a visit</b><span>Appointments and arrival</span></li><li><b>Coordinate care</b><span>Queue and the clinical encounter</span></li><li><b>Keep in touch</b><span>Receipts, follow-up and communication</span></li></ol><small>Clinical decisions stay with the Dentist.</small></aside>
  </main>
}

export function NotificationPanel({role,store,onClose,setPage}){
  const {state,actions,toast}=store
  const session=store.session||sessionForRole(role,state)
  const items=visibleNotifications(state,session)
  const [all,setAll]=React.useState(false)
  const visible=all?items:items.slice(0,8)
  const mark=id=>{const result=actions.markNotificationRead(id);if(!result.ok)toast(result.message,'warning');return result.ok}
  const open=n=>{const destination=notificationDestination(state,session,n);if(destination&&mark(n.id)){setPage(destination.page,destination.context);onClose()}}
  return <Modal open title="Notifications" subtitle="Your updates and reminders" onClose={onClose} className="notification-dialog"><div className="notification-popover">
    <div className="notification-toolbar"><button onClick={()=>{const result=actions.markAllNotificationsRead();if(!result.ok)toast(result.message,'warning')}} disabled={!items.some(n=>!n.read)}>Mark my notifications read</button><button onClick={()=>setAll(v=>!v)}>{all?'Recent only':`View all (${items.length})`}</button></div>
    <div className="notification-scroll">{visible.length?visible.map(n=><div className={`notification-row ${n.read?'':'unread'}`} key={n.id}><span className="notification-dot"/><div><b>{!n.read&&<span className="sr-only">Unread: </span>}{n.title}</b><p>{n.body}</p><small>{n.createdAt} • {n.legacy?'Historical demo record':n.channel}</small><div className="row-actions">{!n.read&&<button onClick={()=>mark(n.id)}>Mark read</button>}{notificationDestination(state,session,n)&&<button onClick={()=>open(n)}>View update</button>}</div></div></div>):<div className="notification-empty">You're all caught up.</div>}</div>
  </div></Modal>
}

// Phase 4B.3C-1 / Pass 1 remediation: the Clinic Assistant is Patient-only (Shell renders it only for
// role==='patient' — see Shell below), so this component no longer needs a non-patient variant. It's a
// floating circular FAB using the approved compact clinic logo, with strict controlled-open a11y behavior
// (focus enters the panel on open, Escape/close returns focus to the FAB) since it is the Patient's own
// only trigger. CSS (`patient.css`/`foundation.css`) positions `.assistant-fab.is-patient` above the
// mobile bottom navigation and, via a `:has()` rule, above a sticky booking footer when one is present —
// see PHASE4B3_ONBOARDING_BOOKING.md.
function ClinicAssistant({open,onOpenChange}){
  const panel=React.useRef(null)
  React.useEffect(()=>{if(open)panel.current?.focus()},[open])
  const closeToTrigger=()=>{onOpenChange(false);document.getElementById('clinic-assistant-fab')?.focus()}
  const [answer,setAnswer]=React.useState('')
  const quick=['How do I book?','What do I need for HMO?','How does the queue work?']
  const reply=q=>{
    const map={
      'How do I book?':'Open Book, choose Smart Find or Manual booking, then pick any validated available slot. A Dentist is assigned automatically.',
      'What do I need for HMO?':'Your HMO case lists missing requirements. You can record document metadata; clinic staff checks local requirements. This app does not upload files or contact the provider.',
      'How does the queue work?':'After Staff records your arrival, your Home shows your position and an estimated wait from this workspace’s current data.',
    }
    setAnswer(map[q]||'I can help with clinic navigation and workflow questions. Clinical diagnosis and treatment decisions always stay with a dentist.')
  }
  return <>
    <button id="clinic-assistant-fab" type="button" className="assistant-fab is-patient" onClick={()=>onOpenChange(!open)} aria-expanded={open} aria-controls="clinic-assistant-panel" aria-label={open?"Close clinic help":"Open clinic help"}>
      <img src="/images/logo.png" alt="" width="26" height="26"/>
    </button>
    {open&&<div className="assistant-panel is-sheet" id="clinic-assistant-panel" ref={panel} tabIndex={-1} role="region" aria-label="Clinic Assistant" onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();closeToTrigger()}}}><div className="assistant-head"><div className="assistant-avatar"><Icon name="robot" size={19}/></div><div><b>Clinic Assistant</b><small>Clinic navigation & workflow help</small></div><button className="icon-btn" aria-label="Close clinic help" onClick={closeToTrigger}><Icon name="x" size={16}/></button></div><div className="assistant-body"><div className="assistant-bubble">Hi! I can help you navigate the clinic system. I won’t diagnose conditions or make treatment decisions.</div>{answer&&<div className="assistant-bubble answer">{answer}</div>}<div className="assistant-quick">{quick.map(q=><button key={q} onClick={()=>reply(q)}>{q}</button>)}</div></div></div>}
  </>
}

// Patient mobile Menu (the bottom nav's 4th item, replacing "Me" as a permanent destination). Reuses Modal
// for accessible dialog/focus-trap behavior; the CSS class alone makes it read as a bottom sheet on mobile,
// not the Staff/Dentist/Owner-styled workspace drawer. Pass 1 remediation: a curated, grouped directory
// (Bookings / Communications / Account) rather than a flat secondary-page list — HMO, Prescriptions,
// Follow-ups and Referral & Loyalty are intentionally not repeated here; they remain reachable via My
// Profile's own "More" section (`PatientMe.jsx`'s `SECONDARY`, unchanged). Logout is visually separated at
// the bottom and only *requests* logout (see Shell's logout-confirmation dialog) — it never logs out directly.
const MENU_GROUPS=[
  ['Bookings',[['book','plusCalendar','Book Appointment'],['appointments','calendar','Visits']]],
  ['Communications',[['messages','message','Messages']]],
  ['Account',[['billing','receipt','Receipts & Payments'],['me','user','My Profile']]],
]
export function PatientMenuSheet({ open, onClose, setPage, name, unreadMessages=0, onRequestLogout }) {
  const go=page=>{onClose();setPage(page)}
  return <Modal open={open} title="Menu" onClose={onClose} className="patient-menu-dialog">
    <div className="patient-menu">
      {name&&<div className="patient-menu-identity"><b>{name}</b></div>}
      {MENU_GROUPS.map(([heading,items])=><div className="patient-menu-group" key={heading}>
        <h3 className="patient-menu-heading">{heading}</h3>
        <ul className="patient-menu-list">{items.map(([page,icon,label])=><li key={page}><button type="button" onClick={()=>go(page)}>
          <span aria-hidden="true"><Icon name={icon} size={18}/></span><span>{label}</span>
          {page==='messages'&&unreadMessages>0&&<span className="pt-nav-badge"><span aria-hidden="true">{unreadMessages}</span><span className="sr-only">, {unreadMessages} unread</span></span>}
        </button></li>)}</ul>
      </div>)}
      <button type="button" className="patient-menu-logout" onClick={()=>{onClose();onRequestLogout()}}>
        <span aria-hidden="true"><Icon name="logout" size={18}/></span><span>Log out</span>
      </button>
    </div>
  </Modal>
}

export function Shell({ role, page, setPage, onLogout, activeBranch, setActiveBranch, resetDemo, store, children }) {
  const info=ROLE_INFO[role]
  const [mobileOpen,setMobileOpen]=React.useState(false)
  const [notificationsOpen,setNotificationsOpen]=React.useState(false)
  const [resetOpen,setResetOpen]=React.useState(false)
  const [assistantOpen,setAssistantOpen]=React.useState(false)
  const [patientMenuOpen,setPatientMenuOpen]=React.useState(false)
  const [logoutConfirmOpen,setLogoutConfirmOpen]=React.useState(false)
  const session=store.session||sessionForRole(role,store.state)
  const account=store.state.users.find(u=>u.id===session?.userId)
  const name=account?.name||session?.name||info.label
  const initials=name.split(' ').map(x=>x[0]).filter(Boolean).slice(0,2).join('')
  const unread=visibleNotifications(store.state,session).filter(n=>!n.read).length
  const groups=navGroups(role).map(([title,items])=>[title,items.filter(([key])=>canAccessPage(store.state,session,key))]).filter(([,items])=>items.length)
  const unreadMessages=role==='patient'?patientConversations(store.state,session).filter(c=>c.unread).length:0
  const shellActions=React.useMemo(()=>({openNotifications:()=>setNotificationsOpen(true)}),[])
  const firstPage=React.useRef(true)
  // Patient page changes start at the top with focus on the main landmark. Deep-linked records focus themselves afterwards.
  useLayoutEffectSafe(()=>{
    if(role!=='patient')return
    if(firstPage.current){firstPage.current=false;return}
    window.scrollTo?.(0,0)
    document.getElementById('main-content')?.focus({preventScroll:true})
  },[page,role])
  // Exactly four primary mobile destinations: Home, Book, Visits, Menu. "Me" is no longer a permanent bottom-
  // nav destination — Profile and everything else (Messages, Payments, HMO, Prescriptions, Follow-ups,
  // Referral & Loyalty) live in the Menu sheet (PatientMenuSheet), reached through the 4th slot below.
  const mobilePatientNav=[['dashboard','Home'],['book','Book'],['appointments','Visits']].filter(([key])=>canAccessPage(store.state,session,key))
  const selectPage=key=>{if(canAccessPage(store.state,session,key))setPage(key);setMobileOpen(false)}
  React.useEffect(()=>{
    const media=window.matchMedia('(min-width: 1025px)')
    const close=()=>{if(media.matches)setMobileOpen(false)}
    media.addEventListener('change',close)
    return ()=>media.removeEventListener('change',close)
  },[])
  const navigation=<><div className="role-card"><span aria-hidden="true">{initials}</span><div><small>{info.label}</small><b>{name}</b><em>{role==='owner'?'Branch oversight':activeBranch}</em></div></div>
    <nav className="main-nav" aria-label={`${info.label} navigation`}>{groups.map(([title,items])=><div className="nav-group" key={title}><span className="nav-group-label">{title}</span>{items.map(([key,label])=><button type="button" key={key} aria-current={page===key?'page':undefined} className={page===key?'active':''} onClick={()=>selectPage(key)}><Icon name={NAV_ICONS[key]||'home'} size={18}/><span>{label}</span></button>)}</div>)}</nav>
    <div className="sidebar-footer"><button onClick={()=>{setMobileOpen(false);setResetOpen(true)}}><Icon name="settings" size={16}/>Reset demo data</button><button onClick={onLogout}><Icon name="logout" size={16}/>Log out</button></div></>
  return <ShellActionsContext.Provider value={shellActions}><div className={`app-shell role-${role}`}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="sidebar"><div className="sidebar-brand"><Brand/></div>{navigation}</aside>
    <Modal open={mobileOpen} title="Your workspace" onClose={()=>setMobileOpen(false)} className="navigation-dialog"><div className="sidebar-brand"><Brand/></div>{navigation}</Modal>
    <div className="main-shell">
      <header className="topbar">
        <div className="topbar-left">{role!=='patient'&&<button className="mobile-menu icon-btn" aria-label="Open navigation" aria-haspopup="dialog" aria-expanded={mobileOpen} onClick={()=>setMobileOpen(true)}><Icon name="menu" size={21}/></button>}<div className="topbar-context"><span className="workspace-label">{info.label} workspace</span>{role==='owner'&&<label className="branch-scope"><span>Branch</span><select value={activeBranch} onChange={e=>setActiveBranch(e.target.value)}><option>All Branches</option>{store.state.branches.map(b=><option key={b.id}>{b.name}</option>)}</select></label>}{(role==='staff'||role==='dentist')&&<div className="branch-lock"><small>Assigned branch</small><b>{activeBranch}</b></div>}</div></div>
        <div className="top-actions"><button className="top-icon-btn" aria-haspopup="dialog" aria-expanded={notificationsOpen} onClick={()=>setNotificationsOpen(true)} aria-label={`Notifications${unread?`, ${unread} unread`:''}`}><Icon name="bell" size={20}/>{unread>0&&<span aria-hidden="true" className="notification-count">{unread>99?'99+':unread}</span>}</button><div className="top-user"><span aria-hidden="true">{initials}</span><div><b>{name}</b><small>{info.label}</small></div></div></div>
      </header>
      <main id="main-content" tabIndex={-1} className="content">{children}</main>
    </div>
    {notificationsOpen&&<NotificationPanel role={role} store={store} setPage={setPage} onClose={()=>setNotificationsOpen(false)}/>}
    {role==='patient'&&<nav className="patient-mobile-nav" aria-label="Patient shortcuts">
      {mobilePatientNav.map(([key,label])=><button key={key} aria-current={page===key?'page':undefined} className={page===key?'active':''} onClick={()=>selectPage(key)}><Icon name={NAV_ICONS[key]||'home'} size={20}/><span>{label}</span>{key==='messages'&&unreadMessages>0&&<span className="pt-nav-badge"><span aria-hidden="true">{unreadMessages}</span><span className="sr-only">, {unreadMessages} unread</span></span>}</button>)}
      <button type="button" aria-haspopup="dialog" aria-expanded={patientMenuOpen} onClick={()=>setPatientMenuOpen(true)}><Icon name="menu" size={20}/><span>Menu</span>{unreadMessages>0&&<span className="pt-nav-badge"><span aria-hidden="true">{unreadMessages}</span><span className="sr-only">, {unreadMessages} unread</span></span>}</button>
    </nav>}
    {role==='patient'&&<PatientMenuSheet open={patientMenuOpen} onClose={()=>setPatientMenuOpen(false)} setPage={setPage} name={name} unreadMessages={unreadMessages} onRequestLogout={()=>setLogoutConfirmOpen(true)}/>}
    <Modal open={resetOpen} title="Reset demo workspace?" subtitle="This clears local demo changes for every role in this browser and restores the sample records." onClose={()=>setResetOpen(false)}><div className="row-actions"><Button variant="ghost" onClick={()=>setResetOpen(false)}>Keep my changes</Button><Button variant="danger" onClick={()=>{setResetOpen(false);resetDemo()}}>Reset demo data</Button></div></Modal>
    {role==='patient'&&<ConfirmDialog open={logoutConfirmOpen} title="Log out?" tone="default" confirmLabel="Log out" cancelLabel="Cancel" className="patient-logout-dialog" onConfirm={()=>{setLogoutConfirmOpen(false);onLogout()}} onCancel={()=>setLogoutConfirmOpen(false)}>
      Are you sure you want to log out of your account?
    </ConfirmDialog>}
    {role==='patient'&&<ClinicAssistant open={assistantOpen} onOpenChange={setAssistantOpen}/>}
  </div></ShellActionsContext.Provider>
}

export function ToastStack({ toasts }) {
  return <div className="toast-stack" role="status" aria-live="polite" aria-atomic="false">{toasts.map(t=><div className={`toast ${t.tone||''}`} key={t.id}><span className="toast-icon">{t.tone==='success'?'✓':t.tone==='warning'?'!':'i'}</span><span>{t.message}</span></div>)}</div>
}
