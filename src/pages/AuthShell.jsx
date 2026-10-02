import React from 'react'
import { Brand } from '../Brand.jsx'
import { clinic } from '../clinic-config.js'
import { PublicHeader, PublicFooter } from './PublicChrome.jsx'

export function AuthShell({children,wide=false}) {
  return <div className="public-auth"><PublicHeader/><main id="public-main" tabIndex={-1} className={`auth-shell site-ready ${wide?'auth-shell-wide':''}`}>
    <aside className="auth-intro" aria-label="Patient portal introduction">
      <Brand className="auth-brand"/>
      <div className="auth-intro-copy">
        <span className="auth-kicker">Patient Portal</span>
        <h2>Care, thoughtfully connected.</h2>
        <p>Manage appointments, follow clinic updates, and keep your billing and receipts in one place.</p>
        <ul>
          <li>Appointments and visit details</li>
          <li>Clinic updates and messages</li>
          <li>Billing and receipt history</li>
        </ul>
      </div>
      <a href="#home" className="auth-home-link">← Return to the clinic website</a>
    </aside>
    <section className="auth-form-side">
      <Brand className="auth-mobile-brand"/>
      <div className="auth-card">{children}<p className="auth-support">Need help? <a href={`tel:${clinic.phoneE164}`}>Contact the clinic</a> in {clinic.city}.</p></div>
    </section>
  </main><PublicFooter/></div>
}
