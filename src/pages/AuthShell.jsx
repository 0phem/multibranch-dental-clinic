import React from 'react'
import { clinic } from '../clinic-config.js'
import { PublicHeader, PublicFooter } from './PublicChrome.jsx'

export function AuthShell({children,wide=false}) {
  return <div className="public-auth"><PublicHeader/><main id="public-main" tabIndex={-1} className={`auth-shell site-ready ${wide?'auth-shell-wide':''}`}>
    <div className="auth-form-side">
      <div className="auth-card">{children}</div>
      <div className="auth-context">
        <a href="#home" className="auth-home-link">← Back to the clinic website</a>
        <p className="auth-support">Need help? <a href={`tel:${clinic.phoneE164}`}>Contact the clinic</a></p>
      </div>
    </div>
  </main><PublicFooter/></div>
}
