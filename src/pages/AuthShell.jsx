import React from 'react'
import { Icon } from '../components.jsx'
import { clinic } from '../clinic-config.js'
import { PublicHeader, PublicFooter } from './PublicChrome.jsx'

// Create account, sign in, email verification and password reset share this layout: on desktop the value proposition on
// the left and the card on the right; on phones the card sits right below a short version of the value proposition.
const BENEFITS = [
  ['calendar', 'Book a visit at the branch near you, with only real open times'],
  ['wallet', 'Pay your invoice online and get your receipt by email'],
  ['message', 'Message the clinic front desk from your phone'],
]

export function AuthShell({ children }) {
  return <div className="lp-site public-auth">
    <PublicHeader/>
    <main id="public-main" tabIndex={-1} className="lp-auth auth-shell site-ready">
      <div className="lp-container lp-auth-grid">
        <section className="lp-auth-copy" aria-label="Why create an account">
          <p className="lp-eyebrow">{clinic.name}</p>
          <p className="lp-auth-title">Your dental visits, simpler online.</p>
          <ul>{BENEFITS.map(([icon, text]) => <li key={text}><span aria-hidden="true"><Icon name={icon} size={18}/></span>{text}</li>)}</ul>
          <p className="lp-muted"><Icon name="lock" size={14}/> Your account is protected by an email code, and your details are handled under the Data Privacy Act of 2012.</p>
        </section>
        <div className="lp-auth-side">
          <div className="auth-card lp-auth-card">{children}</div>
          <p className="lp-auth-help"><a href="#home">← Back to the clinic website</a> · Need help? <a href={`tel:${clinic.phoneE164}`}>Call the clinic</a></p>
        </div>
      </div>
    </main>
    <PublicFooter/>
  </div>
}
