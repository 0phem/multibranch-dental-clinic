import React from 'react'
import { Notice, PageHeader } from '../components.jsx'
import { dateLabel } from '../logic.js'
import { patientContext } from '../patient-view.js'
import { DefinitionList } from '../patient-ui.jsx'

// Phase 4B.3C-1 "Me": the Patient's mobile-nav destination for identity + the rest of the account. View-only —
// no editable field, no fake OTP. Real OTP-backed editing is future work once the backend foundation exists (see
// PHASE4B3_ONBOARDING_BOOKING.md); this page only reads the canonical Person/Patient record already used
// everywhere else (`patientContext`), never a second copy of it.
const NO_ACCOUNT=<Notice tone="warning" title="We couldn’t confirm your account">Reopen your workspace, or ask the clinic to check your account access.</Notice>

export function PatientMePage({ store, setPage }) {
  const { state }=store, session=store.session
  const ctx=patientContext(state,session)
  if(!ctx)return NO_ACCOUNT
  const branch=state.branches.find(b=>b.id===ctx.patient.preferredBranchId)
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
  </div>
}
