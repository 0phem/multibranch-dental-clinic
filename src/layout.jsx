import React from 'react'
import { NAV, ROLE_INFO } from './data.js'
import { Button, Status } from './components.jsx'

export function Login({ onLogin }) {
  const [selected,setSelected]=React.useState('owner')
  return <div className="login-shell">
    <section className="login-panel">
      <div className="brand big"><div className="brand-mark">D</div><div><strong>DentalOps</strong><span>Dr. Dana Roxas</span></div></div>
      <div className="eyebrow">FINAL FRONTEND PROTOTYPE • GROUP 3 • BSIT 3B</div>
      <h1>Multi-Branch Dental Clinic Operation System</h1>
      <p className="login-copy">Frontend-only final UI prototype mapped to the documented 25 modules. Choose a role to demonstrate the exact interface and permissions each user would see.</p>
      <div className="role-grid">
        {Object.entries(ROLE_INFO).map(([key,info])=><button key={key} className={`role-choice ${selected===key?'selected':''}`} onClick={()=>setSelected(key)}>
          <span className="role-icon">{key==='patient'?'P':key==='staff'?'S':key==='dentist'?'D':'A'}</span>
          <div><strong>{info.label}</strong><small>{info.subtitle}</small></div>
          {selected===key&&<span className="selected-check">✓</span>}
        </button>)}
      </div>
      <Button className="login-button" onClick={()=>onLogin(selected)}>Enter {ROLE_INFO[selected].label} Demo</Button>
      <div className="prototype-disclaimer"><b>Prototype scope:</b> No backend, database, real payment, HMO, or messaging service is connected. All screens are production-oriented UI demonstrations using local demo data.</div>
    </section>
    <aside className="login-visual">
      <div className="visual-kicker">25 MODULES • 4 ROLE EXPERIENCES • 3 BRANCHES</div>
      <h2>From booking to treatment, HMO, patient flow, and executive oversight.</h2>
      <div className="visual-stack">
        <div><span>01</span><b>Smart scheduling</b><small>Conflict-safe slot validation</small></div>
        <div><span>02</span><b>Live patient flow</b><small>Check-in, queues, wait & capacity</small></div>
        <div><span>03</span><b>Clinical workflow</b><small>Records, treatment & prescriptions</small></div>
        <div><span>04</span><b>Management intelligence</b><small>Analytics, automation & alerts</small></div>
      </div>
      <div className="visual-footer"><Status>Frontend-only</Status><span>Ready for professor demonstration</span></div>
    </aside>
  </div>
}

export function Shell({ role, page, setPage, onLogout, activeBranch, setActiveBranch, resetDemo, children }) {
  const info=ROLE_INFO[role]
  const nav=NAV[role]
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">D</div><div><strong>DentalOps</strong><span>Clinic Automation</span></div></div>
      <div className="role-card"><span>{role==='patient'?'P':role==='staff'?'S':role==='dentist'?'D':'A'}</span><div><small>Signed in as</small><b>{info.name}</b><em>{info.subtitle}</em></div></div>
      <nav>{nav.map(([key,label])=><button key={key} className={page===key?'active':''} onClick={()=>setPage(key)}><i/><span>{label}</span></button>)}</nav>
      <div className="sidebar-footer"><button onClick={resetDemo}>Reset demo data</button><button onClick={onLogout}>Log out</button></div>
    </aside>
    <main className="main-shell">
      <header className="topbar">
        <div className="topbar-context">
          <span className="system-live"><i/> Prototype data active</span>
          {role!=='patient'&&<label>Branch scope<select value={activeBranch} onChange={e=>setActiveBranch(e.target.value)}><option>All Branches</option><option>Branch A</option><option>Branch B</option><option>Branch C</option></select></label>}
        </div>
        <div className="top-actions"><div className="top-user"><span>{info.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</span><div><b>{info.name}</b><small>{info.subtitle}</small></div></div></div>
      </header>
      <div className="content">{children}</div>
    </main>
  </div>
}

export function ToastStack({ toasts }) {
  return <div className="toast-stack">{toasts.map(t=><div className={`toast ${t.tone||''}`} key={t.id}>{t.message}</div>)}</div>
}
