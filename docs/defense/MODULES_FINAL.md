# Final Module List for the Defense (Official 25-Module Paper Alignment)

Historical module classification baseline: 2026-10-22, retained to align with the group's official paper `BPA_MODULES_UPDATED_OCT_20_2026.docx` and `BPA_MODULES_UPDATED_OCT_22_2026.docx` (25 modules total, with each member owning an exact block of 5 connected modules). The original implementation claims were recorded on `feat/auth-messaging-paymongo`; they are not a new live-production acceptance statement. A status is never higher than what the code and tests prove.

**Status words:**
- **Implemented**: Historical module-level classification for a server-backed tested core; not acceptance of every proposed subfeature or a production certification.
- **Partial**: The core works and is tested; specific extensions or clinic policy decisions are pending.
- **Planned**: Designed in the paper architecture, scheduled on the post-defense roadmap.

Test paths are under `backend/tests/Feature/` unless they start with `tests/` (frontend). Verbatim clinic interview evidence (Q, PI, R2) is documented in [`INTERVIEW_EVIDENCE.md`](INTERVIEW_EVIDENCE.md).

---

## Old-to-New Module Traceability Table (Official 25-Module Architecture)

Traceability between the older internal catalog and the official 25-module paper:

| Paper No. | Official Module Name | Owner | Old Internal Number / Feature Mapping | Implementation Status |
| :---: | :--- | :--- | :--- | :--- |
| **M1** | User Management | Licanda | Old M1 (accounts, OTP, roles, claim) | Partial |
| **M2** | Branch Management | Licanda | Old M2 (branches, hours, closed dates, contacts) | Implemented |
| **M3** | Staff Management | Licanda | Old M3 Work Schedules + Old M15 Leave Management | Implemented |
| **M4** | Service Management | Licanda | Old M13 Services & Pricing, consultation-first | Partial |
| **M5** | Clinic Policy Management | Licanda | Owner settings (late/cancellation, reminders, branding, templates) | Implemented |
| **M6** | Appointment Management | Alejo | Old M6 (one-flow booking, availability, PayMongo pay-at-booking) | Implemented |
| **M7** | Attendance Management | Alejo | Paper M7 (attendance replies, late arrivals, no-show flags) | Implemented |
| **M8** | Check-In Management | Alejo | Old M8 (check-in, walk-ins, counter QR self-registration) | Implemented |
| **M9** | Queue Management | Alejo | Old M9 (queue numbers, state transitions, late resequencing) | Implemented |
| **M10** | Patient Flow Management | Alejo | Calendar daily load, freed-slot move-up offers, waitlist | Implemented |
| **M11** | Patient Records Management | Ecal | Old M4 Patient Records + Old M25 Patient Handovers | Implemented |
| **M12** | Document Management | Ecal | Old M14 (documents, intake consent, ID scan prefill) | Partial |
| **M13** | Treatment Management | Ecal | Old M5 Treatment Management + Old M10 SVG Dental Chart | Implemented |
| **M14** | Prescription Management | Ecal | Old M19 (server prescriptions, issuing, A4 PDF) | Implemented |
| **M15** | Follow-Up Management | Ecal | Old M20 (server follow-up tasks, recall reminders) | Implemented |
| **M16** | Social Media Management | Millar | Old M16 (inquiries, campaign tracking) | Partial |
| **M17** | AI Chatbot Management | Millar | Old M7 (clinic assistant, Google Gemini AI gemini-1.5-flash with knowledge fallback) | Implemented |
| **M18** | Messaging Management | Millar | Old M17 (encrypted patient messaging, branch routing) | Implemented |
| **M19** | Notification Management | Millar | Old M18 (outbox, reminder emails, in-app notifications) | Implemented |
| **M20** | Marketing Management | Millar | Promotion & referral code attribution (?promo= / ?ref=), campaign conversion tracking | Implemented |
| **M21** | Billing Management | Delos Santos | Old M11 Billing + Old M23 PayMongo + 20% Senior/PWD discount | Implemented |
| **M22** | Loyalty Management | Delos Santos | Proposed enhancement (ledger-backed loyalty points & rewards) | Partial |
| **M23** | Archives & Historical Records Management | Delos Santos | Cross-branch historical care and receipt archive, patient portal (#p/archives), restore/export | Implemented |
| **M24** | Analytics Management | Delos Santos | Old M21 (Owner metrics, promotions & campaign tracking, daily summary email counts) | Implemented |
| **M25** | Audit Management | Delos Santos | Old M22 (append-only database audit trail, policy and archive actions, CSV export) | Implemented |

---

## Summary

| State | Count | Modules |
| --- | :---: | --- |
| **Implemented** | **20** | M2, M3, M5, M6, M7, M8, M9, M10, M11, M13, M14, M15, M17, M18, M19, M20, M21, M23, M24, M25 |
| **Partial** | **5** | M1, M4, M12, M16, M22 |
| **Mock only** | **0** | — (All mock prototypes replaced by server implementations) |
| **Planned / Roadmap** | **—** | Treatment plans, lab cases, Facebook Graph API insights, formal BIR accreditation |

---

## Detailed Module Breakdown (Official 25 Modules)

### Block 1: Licanda — Governance & Practice Foundations (M1–M5)

| Module | Status | What Works Today | Evidence | Interview Basis |
| :--- | :---: | :--- | :--- | :--- |
| **M1 User Management** | Partial | Patient self-registration with 6-digit email OTP; password reset; employee invitations by email; four roles enforced at database and middleware levels (`patient`, `staff`, `dentist`, `owner`). On-device ID scan prefill (name and DOB only, zero image/ID storage). Secure account claiming. *Pending*: multiple Owner accounts, 2FA. | `Auth/*`, `Identity/EmployeeInvitationTest`, `RbacTest`, `Intake/IntakeTest`, `tests/intake.test.js` | PI-01, PI-02, R2-03, R2-12 |
| **M2 Branch Management** | Implemented | Three real clinic branches (Bocaue Main, Bocaue Annex, Guiguinto) with contacts, map positions, operating hours per weekday. Owner branch config. Holiday/closed date calendar with affected appointment reschedule flows (never cancels). Public landing page branch directory. | `Reference/*`, `Appointments/BranchHoursTest`, `Reference/PublicBranchesTest`, `tests/landing.test.js` | Q2, PI-14, PI-15, R2-08, R2-13 |
| **M3 Staff Management** | Implemented | Weekly work schedules per dentist, branch, and weekday with break intervals and exceptions (unifies old M3 & M15). Leave requests (vacation, sick, other) with Owner approval, leave calendar strip, conflict detection with suggested cover, and zero-cancellation reschedule notices. | `Staffing/WorkSchedulesTest`, `Staffing/LeaveTest`, `tests/staffing.test.js` | PI-05, PI-06, PI-08 |
| **M4 Service Management** | Partial | Clinical procedure services with durations, branch availability, versioned pricing. Consultation-first enforcement for complex procedures (e.g. braces). *Pending*: final clinic-approved price list and installment terms. | `Pricing/*`, `Automations/InterviewRoundTwoTest`, `tests/m13-pricing.test.js` | Q1, Q12, R2-13, R2-17 |
| **M5 Clinic Policy Management** | Implemented | Centralized Owner settings for reminder intervals, late arrival tolerances, cancellation limits, overdue invoice notices, recall periods, and brand colours/logo. Template wording approval required before any automation is activated; full audited configuration history. | `Automations/InterviewRoundTwoTest`, `Automations/AutomationsTest`, `tests/branding.test.js` | R2-09, R2-11 |

---

### Block 2: Alejo — Patient Flow & Scheduling (M6–M10)

| Module | Status | What Works Today | Evidence | Interview Basis |
| :--- | :---: | :--- | :--- | :--- |
| **M6 Appointment Management** | Implemented | Conflict-free online booking (real availability, double-booking database guard, Sunday closure). PayMongo pay-at-booking integration (GCash, Maya, card) with 15-minute slot hold, webhook-only confirmation, automatic refund for cancellation $\ge 24$h, discretionary refund for $< 24$h/no-show, and deposit credited to visit invoice. | `Appointments/*`, `Payment/AppointmentBookingPaymentTest`, `tests/patient-portal.test.js` | Q20, Q27, Q28, Q29, PI-29, R2-02, R2-13, Section 22 |
| **M7 Attendance Management** | Implemented | 60-minute pre-visit reminders with signed single-use "I'll be there" / "I can't make it" actions. 5/10/15-minute late-arrival progression with front-desk undo. No-show tracking requiring staff confirmation after 3 occurrences in 6 months; late cancellation tracking. | `Automations/AutomationsTest`, `Automations/InterviewRoundTwoTest`, `Visits/*` | R2-07, R2-09, R2-10, R2-13 |
| **M8 Check-In Management** | Implemented | Counter check-in of booked patients and walk-ins. Counter QR self-registration with daily code; on-device ID scan prefill (no image stored); cross-branch duplicate record detection with staff confirmation into the dentist queue. | `Visits/*`, `Intake/IntakeTest`, `tests/intake.test.js` | Q15, PI-13, PI-21, R2-03, R2-06 |
| **M9 Queue Management** | Implemented | Authoritative server queue numbering and state machine (`Arrived` $\to$ `In Treatment` $\to$ `Served`). Late-arriving patients resequenced to end of queue with audited staff override. Dedicated dentist and patient-facing queue displays. | `Queue/*`, `Automations/InterviewRoundTwoTest`, `tests/production-shell.test.js` | Q19, Q21, PI-24, PI-25, R2-07 |
| **M10 Patient Flow Management** | Implemented | Staff and Owner day/week/month calendar load analysis showing booked minutes against dentist capacity. Freed-slot move-up offers (offered first to later booked patients, then waitlist, then walk-ins). Dynamic waitlist notifications. | `Automations/InterviewRoundTwoTest`, `tests/m6-staff-day-calendar.test.js` | R2-02, R2-10 |

---

### Block 3: Ecal — Clinical Records & Treatment Care (M11–M15)

| Module | Status | What Works Today | Evidence | Interview Basis |
| :--- | :---: | :--- | :--- | :--- |
| **M11 Patient Records Management** | Implemented | Shared patient chart across all branches, audited demographic edits, cross-branch duplicate matching. Inter-branch patient handovers (summary, pending procedures, document references) with time-limited read authorization and audit logging. | `Patients/PatientRecordTest`, `ConcurrentPatientRecordTest`, `Staffing/HandoverTest`, `tests/staffing.test.js` | Q17, Q28, R2-03, R2-06, R2-08 |
| **M12 Document Management** | Partial | Secure document upload and download with signed URLs, versioned patient consent at registration, document retraction with reason instead of deletion. On-device ID prefill drafts. *Pending*: production text extraction pipelines. | `Documents/DocumentManagementTest`, `tests/intake.test.js` | Q16 |
| **M13 Treatment Management** | Implemented | Visit-linked treatment entry by treating dentist, append-only trigger locking on completion, automated draft invoice creation. Interactive SVG Dental Chart supporting 32 adult and 20 primary teeth (FDI/Universal), condition marking, tooth history, and patient portal view. *Planned*: multi-phase treatment plans, lab cases. | `Treatments/TreatmentTest`, `Charts/DentalChartTest`, `tests/m10-dental-chart.test.js` | Q15, Q17, Q27, Q29, PI-09 |
| **M14 Prescription Management** | Implemented | Server-authoritative prescription workflow replacing earlier browser mock. Free-text medication lines (drug, dosage, frequency, duration, instructions), allergy warning check, atomic sequential numbering (`RX-YYYY-000001`), voiding with reason, downloadable A4 PDF with clinic header, license number, and signature line. | `Prescriptions/PrescriptionTest`, `Prescriptions/ConcurrentPrescriptionTest`, `tests/m19-prescriptions.test.js` | Q16, PI-38 |
| **M15 Follow-Up Management** | Implemented | Server follow-up tasks generated from completed treatments or created by staff/dentists. Lifecycle tracking (`Open` $\to$ `Contacted` $\to$ `Booked` $\to$ `Closed`), automatic closure on rebooking, front-desk worklist with overdue alerts, and recall reminders with Owner/dentist wording sign-off. | `Followups/FollowupTest`, `tests/m20-followups.test.js` | Q15, Q27, R2-11 |

---

### Block 4: Millar — Patient Engagement & Communications (M16–M20)

| Module | Status | What Works Today | Evidence | Interview Basis |
| :--- | :---: | :--- | :--- | :--- |
| **M16 Social Media Management** | Partial | Staff-recorded inquiry log with channel attribution, assignee, and resolution outcome. Campaign tracking links (`?ref=...`) measuring bookings and accounts. *Planned*: Facebook Page Graph API insights and live Messenger webhook integration post-defense. | `Inquiries/*`, `tests/production-shell.test.js` | PI-42, PI-43 |
| **M17 AI Chatbot Management** | Implemented | Clinic Assistant powered by Google Gemini AI (`gemini-1.5-flash`) with curated clinic knowledge fallback operating on approved clinic answers and live schedule data. Supports English, Filipino, and Taglish; safely handles unknown questions by routing to front desk; refuses clinical diagnosis and third-party data leakage. | `Assistant/AssistantKnowledgeTest`, `Assistant/AssistantTest`, `tests/public-auth-site.test.js` | Q23, PI-42, PI-43 |
| **M18 Messaging Management** | Implemented | Real-time encrypted communication between patients and branch front desk. Automatic branch routing based on active bookings; offline email notifications with zero message body exposure; Owner access restricted for patient confidentiality. | `Messaging/*`, `tests/production-shell.test.js` | PI-30, PI-42, PI-43 |
| **M19 Notification Management** | Implemented | Reliable outbox dispatch engine with automatic retry progression (up to 4 attempts), dead-letter handling, idempotent message keys, real-time in-app notifications, and strict Owner wording approval gating. | `Mail/*`, `Automations/AutomationsTest`, `tests/production-shell.test.js` | PI-29, PI-31, R2-07, R2-09, R2-11 |
| **M20 Marketing Management** | Implemented | Campaign link and referral code attribution (`?promo=...` / `?ref=...`), patient acquisition conversion tracking into Analytics dashboard, week-over-week performance comparisons, and re-booking reminders. | `Analytics/*`, `Automations/AutomationsTest` | HANDOFF Section 20 |

---

### Block 5: Delos Santos — Financials, Automation & Accountability (M21–M25)

| Module | Status | What Works Today | Evidence | Interview Basis |
| :--- | :---: | :--- | :--- | :--- |
| **M21 Billing Management** | Implemented | Automated invoice generation from completed treatment procedures; Staff review and issue flow; PayMongo hosted checkout (GCash, Maya, card); webhook-driven payment settlement; booking deposit credit deduction; **20% Senior Citizen and PWD statutory discount (RA 9994 / RA 10754)** with ID type and number validation; PDF invoices and receipts; overdue payment notices. | `Billing/BillingTest`, `Payment/PayMongoPaymentTest`, `Payment/AppointmentBookingPaymentTest`, `tests/production-shell.test.js` | Q27, Section 21, Section 22 |
| **M22 Loyalty Management** | Partial | Proposed enhancement: Double-entry referral and loyalty point ledger engine; balance calculation; reward catalog; patient redemption request flow. *Pending*: final clinic-wide points redemption policy confirmation. | `tests/phase4b2-loyalty.test.js`, `src/pages/Loyalty.jsx` | HANDOFF Section 20, 21 |
| **M23 Archives & Historical Records Management** | Implemented | Cross-branch archive and retrieval for completed visit summaries, issued prescriptions, settled receipts, and inactive patient/HMO records. Dedicated self-service patient portal archives view (`#p/archives`) with downloadable PDF receipts and records; Staff/Dentist/Owner dashboard with search, type/branch/date filtering, record restore, and compliance CSV export. | `Archives/*`, `tests/m23-archives.test.js`, `src/pages/ArchivesPage.jsx`, `src/patient/pages/Archives.jsx` | Q17, R2-08, R2-12 |
| **M24 Analytics Management** | Implemented | Executive Owner metrics: daily patient volume, revenue, branch load, late arrival counts, slot refill attribution, promotions & campaign performance tracking, and automated daily summary email (aggregate counts only). A4/A5 development acceptance adds branch/period daily gross/refund/net charts, weekly gross-bar/net-line views and exact tables/tooltips; fixed current/prior 30-day gross/visit comparisons are independent of the detailed period selector. Custom arbitrary ranges/forensic exports and production financial acceptance are not established by these enhancements. | [A4](../OWN01_A4_ACCEPTANCE.md), [A5](../OWN01_A5_ACCEPTANCE.md), `Analytics/*`, `Automations/AutomationsTest`, `tests/production-shell.test.js` | Q32, R2-11 |
| **M25 Audit Management** | Implemented | Append-only database audit trail enforced by database triggers; tracks logins, financial transactions, configuration changes, policy and archive actions, and patient record access (field names only, no PHI values); Owner inspection modal and forensic CSV export. | `Audit/*`, `tests/m22-audit-trail.test.js` | Section 20 |

---

## Data Retention & Security Architecture (RA 10173 Compliance)

| Module Category | Database Retention Mechanism | Status |
| :--- | :--- | :---: |
| **M1 Accounts & Profiles** | Soft delete (`users.deleted_at`); active sessions revoked immediately; audit trail retains actor and timestamp. | Implemented |
| **M6, M8, M9, M13, M14, M21, M23, M25 Records** | Append-only tables protected by database triggers. The database refuses `DELETE` and unauthorized `UPDATE` statements on completed treatments, issued prescriptions, invoices, payments, historical archive indexes, and audit logs. | Implemented |
| **M12 Patient Documents** | Retraction with mandatory reason instead of deletion; audit log records retraction metadata. | Implemented |
| **Intake ID Scans** | Processed strictly on the client device (PhilID QR, passport MRZ, on-device OCR); zero raw image or ID number upload/storage. | Implemented |
| **Historical Archives (M23)** | Append-only and soft-archive retention across visits, prescriptions, receipts, and profiles; patient self-service retrieval via `#p/archives`. | Implemented |

## Development evidence reconciliation (2026-10-30, Asia/Manila)

The 20 Implemented / 5 Partial baseline classifications above are retained, not recalculated or promoted by UI enhancements. They are historical module-level classifications, not certification that every described subfeature, policy or production workflow passed. A9 checked the 25-row inventory; it did not rerun all module tests. Current manifests: Laravel ^13.17, React ^19.1.1. Shared integration remains `010a386f147bed285c58821a0a2cc800c393982e`. A8 is accepted but isolated; B3/B4/B5 and B6 are not promoted to shared acceptance. Read these qualifications alongside every earlier What Works Today row.

| Official module | Retained baseline | Demonstrated enhancement / process qualification | Acceptance and remaining limit | Evidence |
| --- | --- | --- | --- | --- |
| M1 User Management | Partial | Patient-only Gemini authorization revalidates the authenticated account and linked Patient profile for JSON/SSE requests. | Integrated development; persisted synthetic authorization checks passed. Live provider governance remains pending. | [A1/Wave 1](../../docs/INTEGRATION_WAVE_20261029.md) |
| M2 Branch Management | Implemented | Owner selects a nonduplicate branch code, edits existing contact details, moves the map pin and explicitly publishes coordinates/hours. Weekday Open/Closed remains separate from operational branch status; service tiles adapt to desktop/phone. | Integrated development; synthetic PostgreSQL and rendered acceptance. Update-only scope, not a new branch-registration API; live map tiles and missing Guiguinto email remain outside acceptance. | [A3](../../docs/OWNER_BRANCH_A3_ACCEPTANCE.md) |
| M3 Staff Management | Implemented | Partial-day leave uses a single date and explicit hours; Owner approval/decline remains authorized. Staff Operations receives branch-scoped server duty facts distinguishing on-duty-today from working-now, including breaks, closures, exceptions and approved leave. | Implemented on feature branches, not integrated. B3 also removes the denied requester self-approval attempt. B5 fallback profile hours are estimated; real rosters and leave entitlement policy remain pending. | [B3/B5](../../docs/defense/FEATURE_ACCEPTANCE_MATRIX.md) |
| M4 Service Management | Partial | No A1-A8 or B3-B5 change to service pricing or eligibility policy is established. | Existing Partial classification retained; final clinic prices remain pending. | [Baseline retained](../../docs/defense/FEATURE_ACCEPTANCE_MATRIX.md) |
| M5 Clinic Policy Management | Implemented | Dentist reviews read-only health-related wording and formatted preview, then explicitly approves the current revision; error/retry and approval status remain visible. | Integrated development UI acceptance; no automated clinical approval or newly approved clinic policy. | [A6](../../docs/DENTIST_UI_A6_ACCEPTANCE.md) |
| M6 Appointment Management | Implemented | Dentist schedule shows the full Manila date with grouped Previous/Today/Next/calendar/Refresh and responsive time hierarchy. Staff appointment rows can open the exact accessible Patient record; Patient records can open the existing booking form with only authoritative Patient identity prefilled. | A7 integrated; A8 accepted on feature branch, not integrated. B4 calendar polish is isolated; Patient profile-photo contract remains missing. No service/Dentist auto-selection, availability bypass or automatic booking; explicit confirmation remains. | [A7/A8/B4](../../docs/GEN09_A8_STAFF_WORKFLOW_ACCEPTANCE.md) |
| M7 Attendance Management | Implemented | No A1-A8 or B3-B5 change to attendance thresholds or cancellation policy is accepted. | Historical timing defaults remain subject to the existing clinic-policy approvals; no new AS-IS claim. | [Baseline retained](../../docs/defense/FEATURE_ACCEPTANCE_MATRIX.md) |
| M8 Check-In Management | Implemented | Supported Other ID values persist after validation. Walk-in search uses one keyboard-accessible combobox, exact directory identity, clear/empty handling and a single visible Refresh. | B1/B2 integrated, supported intake/combobox scope only. B2 admission returned off-shift 422; B6 now reports isolated guarded API success and separate rendered fixture acceptance, not live browser-to-server or integrated acceptance. STF-11 auto-confirm/ID/cancel reasons and STF-13 unified find/create require reviewed policy. Historical kiosk descriptions are not reaccepted by A9. | [B1/B2/B6](../../docs/INTEGRATION_WAVE_20261029.md) |
| M9 Queue Management | Implemented | Queue row click/Enter/Space opens exact encounter context. Call uses the existing server command with stale-revision feedback; Message resolves an existing authorized thread by public Patient and branch IDs. | Implemented on feature branch, not integrated. Five historical full QueueTest failures remain reported; scoped passing tests do not clear them. No new conversation-start or clinical authority. | [B4](../../docs/defense/FEATURE_ACCEPTANCE_MATRIX.md) |
| M10 Patient Flow Management | Implemented | Calendar spacing, focus and selection use existing design tokens; previews show at most three badges and a +N control. | Implemented on feature branch, not integrated. Initials do not satisfy the requested Patient profile-photo requirement; no new capacity or wait-estimate policy. | [B4](../../docs/defense/FEATURE_ACCEPTANCE_MATRIX.md) |
| M11 Patient Records Management | Implemented | Staff opens the exact accessible server Patient record from an authorized appointment and can open a Patient-prefilled AppointmentForm from that record. Identity resolution uses verified public IDs, never names or guessed browser IDs. | Accepted on feature branch, not integrated. Destination/API scope remains enforced; unsupported legacy booking is disabled with guidance. No universal full clinical-record access or archive/merge authority. | [A8](../../docs/GEN09_A8_STAFF_WORKFLOW_ACCEPTANCE.md) |
| M12 Document Management | Partial | Existing on-device draft ID prefill and supported Other details do not add a production extraction or new document storage contract. | Partial classification retained; no A9 expansion of consent, image retention or document access policy. | [B1 supporting intake](../../docs/INTEGRATION_WAVE_20261029.md) |
| M13 Treatment Management | Implemented | Exact encounter context remains required for treatment; schedule presentation changes do not automate diagnosis, chart decisions, procedures or completion. | No new treatment-domain API/policy. Broad clinical workflow production acceptance is not claimed. | [A7 supporting schedule](../../docs/DENTIST_WORKFLOW_A7_ACCEPTANCE.md) |
| M14 Prescription Management | Implemented | Dentist saves/reloads/edits custom medicine, dosage, frequency and duration drafts. Medicine-name selection does not supply dosage. From an open editable draft review, Edit draft opens the existing editor directly; license Save, remove action and issue confirmation retain explicit behavior. | Integrated development; B1 synthetic persistence and A6/A7 rendered acceptance. Review-to-edit 2 to 1 clicks; issuing locks and voiding remains authorized. No medication automation or interaction certification. Allergy review is a prompt, not a claim that a complete clinical allergy source is always available. | [B1/A6/A7](../../docs/DENTIST_WORKFLOW_A7_ACCEPTANCE.md) |
| M15 Follow-Up Management | Implemented | Follow-up worklist shows distinct labelled Open/Contacted/Booked/Closed/Overdue states; supported booking flow remains unchanged. | Integrated UI acceptance only; recall rules and health wording require existing approvals and actual delivery is not inferred. | [A6](../../docs/DENTIST_UI_A6_ACCEPTANCE.md) |
| M16 Social Media Management | Partial | No new social-provider integration or campaign delivery is introduced. | Existing Partial classification retained; external channel integrations remain separate work. | [Baseline retained](../../docs/defense/FEATURE_ACCEPTANCE_MATRIX.md) |
| M17 AI Chatbot Management | Implemented | Gemini JSON/SSE routes require Patient authentication, active account revalidation and a linked Patient profile before provider processing; denied roles cannot trigger upstream work. | Integrated synthetic persisted authorization acceptance, not live AI activation approval. Configured provider transmission/governance remains pending independently of the main assistant mode. | [A1](../../QA-JOEVAN.md) |
| M18 Messaging Management | Implemented | Authorized conversation history has role-distinct bubbles, scoped search, older-history loading and preserved scrolling. Queue Message can resolve an existing matching authorized Patient/branch thread. | A2 integrated; B4 queue shortcut isolated. STF-21 active-Dentist/history switching remains partial; attachments/reopening/Staff initiation are not newly approved. Live transport and production-scale encrypted search remain separate acceptance. | [A2/B4](../../docs/RIC2_MESSAGING_ACCEPTANCE.md) |
| M19 Notification Management | Implemented | Workflow notices and errors reflect actual command results and remain account-specific; Messages and Notifications stay separate. | No acceptance of the entire GEN-10 redesign, archive actions or live delivery from these UI checks. | [A1-A8 supporting feedback](../../docs/defense/FEATURE_ACCEPTANCE_MATRIX.md) |
| M20 Marketing Management (PE) | Implemented | Campaign tracking and proposed consent/targeting/delivery are distinct. No A1-A8 or B3-B5 batch establishes the full campaign lifecycle. | Proposed enhancement boundaries preserved; no promotion of prototype rules or marketing automation to confirmed clinic policy. | [Baseline retained](../../docs/defense/FEATURE_ACCEPTANCE_MATRIX.md) |
| M21 Billing Management | Implemented | Reports consume authoritative payment/refund evidence without changing charge, issue, settlement or refund rules. Use Payment Receipt terminology. | No production payment/refund or accounting-close acceptance from synthetic reporting tests. Existing financial policy and authority remain unchanged. | [A4/A5 supporting analytics](../../docs/defense/FEATURE_ACCEPTANCE_MATRIX.md) |
| M22 Loyalty Management (PE) | Partial | Existing whole-point ledger/redemption demonstration does not establish a clinic loyalty program. | Partial/proposed enhancement classification retained; 50-point and reward rules remain team-designed prototype rules, not confirmed clinic policy. | [Baseline retained](../../docs/defense/FEATURE_ACCEPTANCE_MATRIX.md) |
| M23 Archives & Historical Records Management | Implemented | Existing history retrieval/export remains distinct from universal creator-based archive/restore permissions. | No new archive/restore approval. Append-only, soft-archive and private clinical/message restrictions remain; STF-25/DEN-16 acceptance still unresolved. | [GEN-11 boundary](../../docs/defense/FEATURE_ACCEPTANCE_MATRIX.md) |
| M24 Analytics Management | Implemented | Owner inspects branch/period daily gross collections, refunds and net cash flow with exact tooltips and accessible tables. Weekly Mon-Sat gross bars and signed net line share an axis. Fixed current/prior 30-day gross and visit comparisons are independent of the detailed period selector; outstanding balances have no prior snapshot comparison. | Integrated development with synthetic PostgreSQL reconciliation and rendered acceptance. Collections are not profit; Saturday is an on-demand calendar report, not an immutable scheduled artifact. No production financial reconciliation/live delivery claim; historical export/digest descriptions are not reaccepted. | [A4/A5](../../docs/OWN01_A5_ACCEPTANCE.md) |
| M25 Audit Management | Implemented | Existing sanitized audit evidence remains append-only; UI shortcuts do not authorize disclosure of private clinical text or change audit policy. | No new universal audit-completeness or production compliance certification from A9. | [Baseline retained](../../docs/defense/FEATURE_ACCEPTANCE_MATRIX.md) |

Archive/restore and historical financial descriptions do not approve unresolved GEN-11 or private-content access. Marketing (M20) and Loyalty (M22) proposed-enhancement boundaries remain intact. The original DOCX is unchanged; its [revised review candidate](BPA_MODULES_UPDATED_OCT_22_2026_A9_REVIEW.docx) is structurally validated but REVIEW REQUIRED pending visual validation. Use the [validation record](BPA_A9_REVIEW_VALIDATION.md), [exact amendment](BPA_OCT22_A9_SECTION_AMENDMENT.md) and the [all-module crosswalk](ACADEMIC_DOCUMENT_RECONCILIATION.md).
