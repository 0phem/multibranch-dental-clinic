import React from 'react'
import { Icon, Notice, PageHeader } from '../components.jsx'
import { dateLabel } from '../logic.js'
import { patientContext, patientLoyalty } from '../patient-view.js'
import { DefinitionList } from '../patient-ui.jsx'

// Phase 4B.3C-1 "Me": the Patient's mobile-nav destination for identity + the rest of the account. View-only —
// no editable field, no fake OTP. Real OTP-backed editing is future work once the backend foundation exists (see
// PHASE4B3_ONBOARDING_BOOKING.md); this page only reads the canonical Person/Patient record already used
// everywhere else (`patientContext`), never a second copy of it.
const NO_ACCOUNT=<Notice tone="warning" title="We couldn’t confirm your account">Reopen your workspace, or ask the clinic to check your account access.</Notice>

const SECONDARY=[
  ['messages','message','Messages','Your conversations with the clinic'],
  ['billing','receipt','Payments','Issued invoices and receipts'],
  ['hmo','shield','HMO coverage','Documents and status'],
  ['prescriptions','pill','Prescriptions','Authorized by your Dentist'],
  ['followups','followup','Follow-up care','Schedule a Dentist-recommended return visit'],
]

export function PatientMePage({ store, setPage }) {
  const { state }=store, session=store.session
  const ctx=patientContext(state,session)
  if(!ctx)return NO_ACCOUNT
  const branch=state.branches.find(b=>b.id===ctx.patient.preferredBranchId)
  const loyalty=patientLoyalty(state,session)
  const links=[...SECONDARY,...(loyalty&&loyalty.status!=='none'?[['loyalty','gift','Referral & Loyalty','Your referral code and points']]:[])]
  return <div className="pt-page">
    <PageHeader kicker="Your account" title="Me" text="Your profile information and the rest of your clinic account."/>
    <section className="pt-record" aria-labelledby="pt-me-profile-title">
      <header><div><h2 id="pt-me-profile-title" className="pt-record-title">Profile</h2><p className="pt-record-sub">This information is read-only for now.</p></div></header>
      <DefinitionList items={[
        {label:'Name',value:ctx.patient.name},
        {label:'Email',value:ctx.patient.email},
        {label:'Phone',value:ctx.patient.phone},
        {label:'Date of birth',value:ctx.patient.dob?dateLabel(ctx.patient.dob):null},
        {label:'Preferred branch',value:branch?.name},
      ]}/>
      <p className="pt-hint">Editing your profile will be available once secure, verified changes are supported. Contact the clinic if any of this needs to change now.</p>
    </section>
    <nav className="pt-home-aside" aria-label="More">
      <h2 className="pt-card-label">More</h2>
      <ul className="pt-quick">{links.map(([page,icon,label,hint])=><li key={page}><button type="button" onClick={()=>setPage(page)}><span aria-hidden="true"><Icon name={icon} size={20}/></span><span><b>{label}</b><small>{hint}</small></span><Icon name="chevron" size={16}/></button></li>)}</ul>
    </nav>
  </div>
}
