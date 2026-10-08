# Follow-Up Interview and Policy Dependency Map

**Status:** documentation only, reconciled revision (2026-10-06). Branch `feature/m26-feedback-production-foundation`, HEAD `3b04ee9`. No executable code, migration, configuration or test was changed by this document. Nothing in it is clinic policy: every unresolved item is an open question. Evidence labels follow `CLAUDE_OPERATING_MODE.md` §2 (Interview fact / Project design decision / Technical choice / POLICY DECISION REQUIRED).

This revision replaces the first draft. The first draft was built from excerpts and truncated report sections; this one was rebuilt from a full read of every source below and a comparison of every question against the complete interview (Q1–Q32).

## 1. Purpose and source completeness

### 1.1 Purpose

One authoritative post-hardening document for (a) the stakeholder follow-up interview, (b) the team/deployment decisions that are **not** for the clinic, (c) the dependency map and the order of the next work, and (d) the return passes on hardened modules once answers exist.

### 1.2 Sources read in full

| Source | Read |
| --- | --- |
| `CLAUDE.md` (repository; 661 lines) and the parent `/Downloads/CLAUDE.md` | Full |
| `CLAUDE_OPERATING_MODE.md` (189 lines) | Full |
| `AGENTS.md` (111 lines) | Full |
| `MODULE_COVERAGE.md` (97 lines) | Full |
| `docs/architecture/CONTRACTS.md` (417 lines) | Full |
| `DOCUMENTATION_RECONCILIATION.md` (185 lines) | Full |
| `PHASE3_5_SAFEGUARDS.md` (112 lines) | Full |
| `ERD_ALIGNMENT.md` (114 lines) | Full |
| `docs/process/CLINIC_INTERVIEW_QA.md` (Q1–Q32, 133 lines) | Full |
| Module registry: `src/data.js` `MODULES` (read for module metadata) and `src/module-map.js` (35 lines) | Registry/metadata sections full; the rest of `data.js` read only where cited (automation rules, branches, follow-up demo rows) |
| Hardening/foundation reports M1 (166), M2 (151), M4 (202), M5 (69), M7 (107), M11 (207), M13 (96), M14 (168), M16 (103), M17 (132), M22 (159), M26 (116 lines) | Full, every section |

Code read to verify provenance claims (not whole-repository reads): `backend/app/Services/Automation/WorkflowAutomationService.php` (full), `AutomationController.php` (full), `backend/app/Models/HmoCase.php` and `HmoCaseService.php` (constants/escalation gate), `AnalyticsService.php` and `AnalyticsController.php` (cited lines), `backend/database/migrations/2026_10_08_000100_create_automation_tables.php` (seed rules), `src/communication.js` (reminders), `src/logic.js` (capacity/wait), `src/workflow.js` (treatment handoff adapter), `src/phase3-contracts.js`, `src/data.js`, `backend/routes/api.php`, `DentistProfileResource.php`.

Not read (not required by the task and not relied on): `FRONTEND_SCOPE.md`, `README.md`, `BACKEND_INTEGRATION.md`, `PROFESSOR_DEMO_GUIDE.md`, phase notes P0–PHASE4B, `docs/architecture/ERD_v2_Data_Dictionary.md` (cited only through `ERD_ALIGNMENT.md` and the M26 report). Statements about the `.docx` process document are taken from `CLAUDE_OPERATING_MODE.md`; the `.docx` itself was not opened.

### 1.3 Source precedence applied

1 canonical architecture/contracts → 2 explicit interview answers → 3 reviewed hardened-module decisions → 4 current implementation → 5 project documentation → 6 prototype/demo behaviour → 7 historical documents. A prototype value is evidence of prior design, never clinic policy.

### 1.4 Vocabulary

**Classification (exactly one per item):** POLICY · PRODUCT · INTEGRATION · DEPLOYMENT · CONTRACT MIGRATION · ENGINEERING.

**Status:** ANSWERED (settled by the interview or a canonical contract; removed from the interview) · PARTIALLY ANSWERED (facts known; a decision remains) · UNRESOLVED (clinic decision needed) · TEAM DECISION (not a clinic-interview question).

**Answer format for every clinic question** — record exactly one of: **(a)** a stated rule (value and owner), **(b)** "No formal policy — keep human judgment", **(c)** "Not decided yet — owner and date". Option (b) is always acceptable and must not be pressed toward a number. Ask one decision at a time, without suggesting example values.

**Who to put in the room** (Interview Q25 answered "Yes" to speaking with others): the Owner (Q3) for rules and approvals; a receptionist (Q27: booking, check-in, billing, follow-up) for daily workflow; a Dentist for clinical items; an assistant for treatment preparation (Q15). Each primary section names its respondent.

## 2. Current checkpoint ledger

| Module | Branch | Commit |
| --- | --- | --- |
| M1 | (earlier) | `ba573e4` |
| M2 | (earlier) | `e847cc4` |
| M4 | (earlier) | `471a721` |
| M14 | (earlier) | `b006ac9` |
| M22 | (earlier) | `8424244` |
| Canonical-26 doc sync | (earlier) | `7a5dd41` |
| M11 | `feature/m11-billing-production-hardening` | `e24d4fc` |
| M5 | `feature/m5-treatment-production-hardening` | `a7bdb39` |
| M13 | `feature/m13-pricing-production-hardening` | `849cfe0` |
| M7 | `feature/m7-patient-ai-support-production-hardening` | `e7c2d80` |
| M16 | `feature/m16-external-inquiry-production-hardening` | `7364dd1` |
| M17 | `feature/m17-patient-messaging-production-hardening` | `12f6824` |
| M26 | `feature/m26-feedback-production-foundation` | `3b04ee9` |

All twelve hardened/foundation modules (M1, M2, M4, M5, M7, M11, M13, M14, M16, M17, M22, M26) are Verdict B: blockers are policy, external or contract items. M6, M8, M9 and M12 are server-authoritative from earlier phases and are outside this consolidation except where they consume a decision below. Not yet hardened: M3, M10, M15, M18, M19, M20, M23, M21 (last), M24 and M25 (PE). The registry marks M21, M22 and M23 `implemented: true`; section 11 records why that flag overstates M23.

## 3. Known facts from Q1–Q32

Interview source: Dr. Dana Roxas, clinic owner (`CLINIC_INTERVIEW_QA.md`). "Limit" states what the answer does **not** establish. Nothing here is reinterpreted into a policy.

| Q | Established fact | Limit (not established) | Used by |
| --- | --- | --- | --- |
| Q1 | Operating since 1981; general dentistry, orthodontics, oral surgery, radiographic imaging | No fees or durations for any service | M13, M6 |
| Q2 | 3 branches: 2 in Bocaue, 1 in Guiguinto | Which branch is which; names/phones/hours | M2 |
| Q3 | Dr. Roxas is the Owner and does management and decision-making | Who holds delegated authority | M1, M15 |
| Q4 | 12 Dentists and 7 staff (a mix of assistants and receptionists) | Staff per branch; titles' permissions | M3 |
| Q5 | "At least 2 dentists per day per clinic" | Whether it is an enforced minimum or a usual pattern | M3, M10 |
| Q6 | Some days feel short-staffed because the clinic accommodates as many patients as it can | No staffing threshold | M10 |
| Q7 | At least 10–20 patients per day | Conflicts with Q8 in scale; per-branch split unknown | M10, M21 |
| Q8 | About 30–50 patients per week; no monthly figure | See Q7 | M10, M21 |
| Q9 | Patient base has grown; no percentage | — | M21 |
| Q10 | Weekends busier, especially October–February | No hours or capacity numbers | M10, M15 |
| Q11 | About ₱15,000 daily | Not a pricing input | — |
| Q12 | Cleaning ₱1,000–₱1,500; Extraction ₱10,000–₱15,000; Filling ₱800–₱2,000 | What the extraction range covers (flagged unexplained) | M13, M11 |
| Q13–Q14 | Costs; about ₱1,400/month current software | Not a system requirement | — |
| Q15 | A patient is assigned to a dentist at the patient lounge; assistants prepare equipment; treatment is performed; the next appointment is arranged during payment. The final phrase was incomplete | Whether the Dentist can be reassigned at arrival; who exactly arranges the next appointment (Q27 says the receptionist) | M6, M8, M9, M20 |
| Q16 | Forms from booking to payment are digitized; prescription is the only identified paper exception | How prescriptions are written/handed over | M19, M14 |
| Q17 | Records and treatment history are in digital software | Format, volume, whether to bring them into the new system | M4, M5 |
| Q18 | The current software is liked because it is centralized across branches | — | M4 (one identity across branches) |
| Q19 | Long patient queues cause the most delay | — | M9, M10 |
| Q20 | Scheduling conflicts are the most frequent mistake | — | M6 (conflict prevention) |
| Q21 | Most frequent complaint is long waiting time | — | M10, M26 |
| Q22 | HMO adds a step and HMO companies can take a long time to respond | No response time or follow-up interval | M12, M23 |
| Q23 | The one thing to automate/fix: HMO contacting and online messaging on the clinic's social media | What "HMO contacting" involves; which social pages | M12, M16, M17, M18, M23 |
| Q24–Q26 | Would adopt a digital booking/scheduling/records system; other team members should be consulted; open to a follow-up conversation | — | This interview |
| Q27 | Booking, check-in, billing and follow-up: receptionist. Treatment: Dentist with assistant | Who does HMO contacting; who handles messages | M3, M20 |
| Q28 | Booking needs patient information, chief complaint, available time and Dentist schedule | — | M6 |
| Q29 | Appointments are fixed; treatment duration and treatment decisions are case by case | What "fixed" means for cutoffs; how booked time relates to variable duration | M6, M10, M13, M15 |
| Q30 | A learning curve for everyone adopting digital software | — | Rollout |
| Q31 | Internet is reliable; the day-to-day troubleshooter was not specified | Who administers the system day to day | M1, M15 |
| Q32 | "Better" = shorter wait times and more real-time updates in booking and to patients prior to treatments | No update list, timing or channel | M10, M18 |

**The interview does not provide** (`CLAUDE_OPERATING_MODE.md` §3): X-ray fee or duration, other service fees or durations, reminder or HMO follow-up timings, loyalty or referral economics, refund rules, online-payment policy, OTP policy. Branch opening hours, holidays, cancellation/reschedule/check-in/no-show rules, retention periods, consent forms and prescription validity are likewise absent. **Known unresolved interview items:** Q7 vs Q8 volumes; the Q12 extraction range; whether the Dentist can be reassigned at arrival (Q15).

**Current rules that are project decisions, not interview facts** (so they do not settle any clinic question): Patient online booking window of tomorrow through one month later with hourly starts; no Patient Dentist choice; Patient cancellation until the scheduled start; the 12-hour HMO follow-up value; the M24 50-point rule; the in-app 24-hour appointment reminder and 35-minute queue-delay update.

## 4. Primary follow-up interview

Questions that unlock M3, M1 privileged provisioning, M15, M10, M18, M19, M20 and M23, the cross-cutting decisions that reopen several hardened modules, the nine unresolved central policies (P1–P9 in `CLAUDE.md`), and the M24/M25 approval gates. Table columns: **Ask** (clinic-facing wording) · **Class · Status** · **Affects** · **Evidence → why still needed** · **Safe behaviour if the answer is "No formal policy — keep human judgment"**. "Today" means the current, tested behaviour of the system.

### First follow-up session — high-priority questions

A practical first sitting of about twenty questions, reusing existing identifiers only (no new decisions; the other primary questions stay in sections 4.1–4.10 for later sessions). Suggested respondents: the Owner plus one receptionist, with a Dentist for the last block. Ask in plain language, one at a time, without example values; "No formal policy — keep human judgment" is always an acceptable answer. Nothing below is a recorded clinic answer.

| Block (what it unlocks) | IDs | Plain-language prompt |
| --- | --- | --- |
| People and branches (M3) | PI-05 | "Who works at which branch — does anyone move between branches?" |
| | PI-06 | "Who decides each Dentist's working days and hours?" |
| | PI-08 | "You said at least two Dentists each day at each clinic: is that a rule or how it usually works out?" |
| | PI-09 | "What does a receptionist do, and what does an assistant do? Does an assistant ever book or bill?" |
| | PI-13 | "When a patient arrives, who decides which Dentist sees them, and can that change that day?" |
| New staff access (M1 provisioning) | PI-01 | "Who decides that a new staff member may use the system?" |
| | PI-02 | "How should a new staff member get their first sign-in and prove it is them?" |
| Hours and controls (M15) | PI-14 | "What are each branch's opening hours, day by day?" |
| | PI-15 | "Who decides holidays and days a branch is closed?" |
| | PI-21 | "How late can a patient be before you treat the visit as missed, and who decides?" |
| Waiting and flow (M10) | PI-24 | "When is a branch 'too busy' — how long a wait, how many people, or just your judgement?" |
| | PI-25 | "When that happens, who needs to know and what do they do?" |
| Talking to patients (M18) | PI-29 | "What should patients be told, and when, before their treatment?" |
| | PI-30 | "How do you contact patients today — call, text, Messenger, something else?" |
| | PI-31 | "Do you remind patients about appointments now? How, and who does it?" |
| HMO and social messages (Q23) | PI-32 | "After you send a claim to an HMO, how long before you follow up?" |
| | PI-34 | "Walk us through how you contact HMOs today and what takes the most effort." |
| | PI-42 | "Which social media pages do patients message you on?" |
| | PI-43 | "Who answers those messages, one person or one per branch?" |
| Prescriptions (M19, Dentist) | PI-38 | "Walk us through how a prescription is written and given to the patient today." |

### 4.1 Accounts and personnel — respondent: Owner (with a receptionist for PI-06, PI-07, PI-13)

Unlocks M3 and the M1 privileged-provisioning return pass.

| ID | Ask | Class · Status | Affects | Evidence → why still needed | If no formal policy |
| --- | --- | --- | --- | --- | --- |
| PI-01 | Who at the clinic decides that a new Dentist, assistant, receptionist or additional Owner may start using the system? | POLICY · PARTIALLY ANSWERED | M1, M3 | Q3: the Owner decides management matters. M1 deferred privileged provisioning pending an approved activation policy; no delegation is defined → fixes who may authorize provisioning. | Provisioning stays disabled; accounts are created only by the Owner, one at a time (today). |
| PI-02 | When a new staff member joins, how should they receive their first sign-in and confirm it is really them? | POLICY · UNRESOLVED | M1 | M1 §9–10 and §29–30: activation/credential delivery, expiry and recovery were deliberately not invented; no invitation or default password exists → blocks Staff/Dentist/Owner provisioning. | No self-service activation; no default or emailed temporary passwords; hand-over only by an Owner-supervised method recorded outside the system until agreed. |
| PI-03 | If someone leaves or must be locked out, who decides, and who may restore their access? | POLICY · PARTIALLY ANSWERED | M1, M3 | Owner-only audited suspend/restore commands exist as a technical boundary, not an approved policy → confirm or widen. | Owner-only (today). |
| PI-04 | Who handles day-to-day system help at the clinic, for example a forgotten password or a mistyped name? | POLICY · UNRESOLVED | M1, M15 | Q31 did not specify the day-to-day person → determines whether anyone besides the Owner needs an administrative role (no fifth role may be added). | Requests go to the Owner; no delegated administrator. |
| PI-05 | Does each Dentist and staff member work at one branch, or do some move between branches? Which ones? | POLICY · PARTIALLY ANSWERED | M3, M2, M6, M10, M1 | Q2/Q4 give counts only. CONTRACTS §1: operational assignment and authorization branch scope are stored separately and one never implies the other → defines each person's assignment and whether scope must differ. | Each person has one recorded branch; no cross-branch authority is implied. |
| PI-06 | Who sets each Dentist's working days and hours, and who may change them? | POLICY · UNRESOLVED | M3, M6, M10 | Q28: the Dentist schedule is a booking input. Today shift/availability are flat fields edited by the Owner; no dated roster exists (MODULE_COVERAGE M3) → defines schedule ownership. | Owner edits only (today); no roster or approval flow is built. |
| PI-07 | When a scheduled Dentist cannot come in, what do you do, and who decides? | POLICY · UNRESOLVED | M3, M6, M10 | Q5/Q6 (minimum Dentists; short-staffed days). No absence or replacement process exists → defines what the system may record. | The system records the Dentist as unavailable only; no automatic replacement or rebooking; staff contact patients manually. |
| PI-08 | You said there are at least two Dentists at each clinic each day. Should the system warn when fewer are scheduled, or is that only how the clinic usually runs? | POLICY · PARTIALLY ANSWERED | M3, M10 | Q5 states the pattern, not whether it is enforced → decides whether M10/M23 may evaluate it at all. | Informational only; no warning, block or alert. |
| PI-09 | What does each job title (receptionist, dental assistant) do in the system? Does an assistant ever book, check in or bill? | POLICY · PARTIALLY ANSWERED | M3, M1 | Q4/Q27: receptionist books, checks in, bills, follows up; assistant supports treatment. CONTRACTS §1 and OPERATING_MODE §5: a title is never a permission → decides whether any permission must change (a separate, explicit change). | No permission changes; titles remain labels. |
| PI-10 | Which professional details must be kept for each Dentist (for example license numbers, specialty) and shown on documents? | POLICY · UNRESOLVED | M3, M19 | CONTRACTS §4: PRC/PTR/signature configuration is planned, not modelled; today only demo-format `license_no` and `specialty` exist → defines the credential fields. Legal sufficiency is TD-13, not asked here. | Keep only the fields in use; no claim that output is regulation-compliant. |
| PI-11 | Who checks a Dentist's credentials and keeps them current, for example when a license expires? | POLICY · UNRESOLVED | M3, M19 | No verification or expiry handling exists → determines whether expiry can block anything. | The Owner records manually; expiry never blocks or authorizes automatically. |
| PI-12 | Who decides which services each Dentist may perform, and should changes be kept as history? | POLICY · UNRESOLVED | M3, M13, M5, M6 | Eligibility rows are consumed by M5 and M6 but their governance was not hardened (M13 §18–21) → defines who edits and whether history is required. | Owner edits only (today); no approval or history workflow. |
| PI-13 | When a patient arrives, who decides which Dentist sees them, and can that change on the same day? | POLICY · PARTIALLY ANSWERED | M6, M8, M9, M10, M3 | Q15: assignment at the patient lounge. OPERATING_MODE §3 lists reassignment at arrival as an unresolved interview question → decides whether a change flow is ever needed. | The deterministic assignment stands; any change is a staff decision made outside the system. |

### 4.2 Branches — respondent: Owner

| ID | Ask | Class · Status | Affects | Evidence → why still needed | If no formal policy |
| --- | --- | --- | --- | --- | --- |
| PI-14 | What are each branch's opening hours for each day of the week? | POLICY · UNRESOLVED | M2, M6, M8, M15, M7, M18 | Q2/Q10 give no hours; the 09:00–18:00 / 10:00–19:00 values are demo configuration labelled unconfirmed (M2) → blocks truthful M6/M8 hours and any hours shown to patients or the assistant. | Hours stay labelled unconfirmed; the assistant states no hours (today). |
| PI-15 | Who decides holidays or days a branch is closed, and how far ahead is that known? | POLICY · UNRESOLVED | M2, M6, M15 | M2: no closure/holiday infrastructure; none was invented → defines the closure source. | The Owner changes branch status manually; no holiday calendar. |
| PI-16 | If a branch has to close, what happens to patients already booked and to patients already checked in? | POLICY · UNRESOLVED | M2, M6, M8 | M2 §Database: scheduled Check-In does not re-check branch Open status; the lifecycle effect was not invented → defines the transition effects. | Staff contact patients manually; nothing is cancelled or moved automatically. |
| PI-17 | Besides the Owner, may anyone change a branch's details or opening status? | POLICY · PARTIALLY ANSWERED | M2 | Owner-only updates are retained; broader delegation was not granted (M2) → confirm or widen. | Owner only (today). |

### 4.3 Scheduling rules and capacity — respondent: Owner and receptionist

Unlocks M15 and M10. Context: Q29 says appointments are "fixed" and treatment duration is case by case; it does not state any cutoff.

| ID | Ask | Class · Status | Affects | Evidence → why still needed | If no formal policy |
| --- | --- | --- | --- | --- | --- |
| PI-18 | Until when may a patient cancel their own appointment? (P1) | POLICY · PARTIALLY ANSWERED | M6, M15 | Today online cancellation stops at the scheduled start — a project decision, not interview evidence (CONTRACTS §6) → confirm or set the clinic's cutoff. | Keep today's behaviour; staff handle late cancellations case by case. |
| PI-19 | Until when may a patient move their own appointment to another time? (P2) | POLICY · PARTIALLY ANSWERED | M6, M15 | Reschedule changes only date/time, same Dentist, until admission; no lead time is clinic-confirmed → confirm or set. | Keep today's behaviour; staff handle exceptions. |
| PI-20 | How early before the appointment time may a patient be checked in? (P3) | POLICY · PARTIALLY ANSWERED | M8, M15 | Today: any time on the appointment day (Asia/Manila), by Staff; no early window is approved → confirm or set. | Staff discretion on the day. |
| PI-21 | How late may a patient arrive before the appointment is treated as missed, and who decides? (P4) | POLICY · UNRESOLVED | M8, M9, M15 | No-show is a manual same-day Staff decision with no lateness threshold (CONTRACTS state machine) → blocks any timed suggestion. | Manual Staff decision; no automatic no-show and no grace period shown as policy. |
| PI-22 | When may a receptionist make an exception to these rules, and does anyone need to approve it? (P5) | POLICY · UNRESOLVED | M6, M8, M15 | Override authority is undefined; Owner administrative exceptions are inherited, not confirmed (DOC_RECON). | No override feature; exceptions are handled by people outside the system. |
| PI-23 | A treatment's length varies case by case. How should a booking decide how much time to set aside, and what if it runs over? | POLICY · PARTIALLY ANSWERED | M6, M10, M13, M15 | Q29 (duration is case by case); the interview gives no per-service durations; `duration_minutes` is project configuration → defines what a booked slot means. | Slot length stays a labelled unconfirmed estimate; overruns are handled by staff on the day. |
| PI-24 | What counts as "too busy" at a branch: a length of wait, a number of people waiting, or staff judgement? | POLICY · PARTIALLY ANSWERED | M10, M23, M18, M21 | Q19/Q21/Q32: waiting is the top delay and complaint, but no definition exists. The 35-minute wait and 80/80/75 load thresholds are project values (section 7) → decides whether any alert may use a number. | No numeric alert; waiting is shown as information; staff judge when it is too busy. |
| PI-25 | When a branch is too busy, who should be told, and what should they do (for example, direct patients to another branch)? | POLICY · UNRESOLVED | M10, M23, M18 | M10 shows cross-branch alternatives read-only with no automatic reassignment (MODULE_COVERAGE) → defines recipients and any redirect step. | Shown on staff screens only; no automatic alert or redirection. |
| PI-26 | Do any of these rules differ between your three branches? | POLICY · UNRESOLVED | M15, M10, M2 | M2 lists branch-specific capacity as an unresolved M10/M15 input → decides whether configuration must be branch-scoped. | One clinic-wide set; no per-branch variation. |
| PI-27 | How many patients does each branch usually see in a day, including weekends? Your earlier answers were 10–20 per day and 30–50 per week. | PRODUCT · PARTIALLY ANSWERED | M10, M21 | Q7 vs Q8 conflict (known unresolved); Q10 weekends busier → a clarification that sizes capacity expectations, not a rule. | No volume baseline is stated by the system. |
| PI-28 | Who may change the clinic's operating settings (including any automatic rules) later, and from what date does a change apply? | POLICY · UNRESOLVED | M15, M23, M10 | M15 is "validated, versioned, effective-dated Owner settings" in design only; settings are code constants today → defines governance of every configurable value. | Settings stay fixed in code; no editor is built. |

### 4.4 Notifications and reminders (M18) — respondent: receptionist and Owner

Boundary preserved: M17 is human conversation, M18 is system transactional delivery, M25 is marketing. The clinic is **not** asked to choose providers (TD-18).

| ID | Ask | Class · Status | Affects | Evidence → why still needed | If no formal policy |
| --- | --- | --- | --- | --- | --- |
| PI-29 | Which updates should patients receive from the clinic? You said patients should be updated before treatment. | POLICY · PARTIALLY ANSWERED | M18, M10, M6, M11, M20 | Q32 names "real-time updates in booking and to patients prior to treatments" but no list or timing → defines the transactional event list. | In-app notifications only for events already implemented; no new automatic messages. |
| PI-30 | How do you contact patients today: phone call, text message, Messenger or another way? Does each branch do it differently? | PRODUCT · UNRESOLVED | M18, M16, M17, M25 | The interview names no channel except social messaging (Q23) → decides which delivery channels are worth building. | In-app only; the system never claims external delivery. |
| PI-31 | Do you remind patients about appointments today? How long before, and who does it? | POLICY · UNRESOLVED | M18, M6, M15 | OPERATING_MODE §3: reminder timings are not provided. The in-app 24-hour reminder is a prototype value (DOC_RECON: cadence needs client confirmation) → defines reminder timing. | The in-app reminder stays labelled a demonstration value; no timing is presented as clinic policy. |

### 4.5 HMO and automation (M12 interaction, M23) — respondent: receptionist and Owner

| ID | Ask | Class · Status | Affects | Evidence → why still needed | If no formal policy |
| --- | --- | --- | --- | --- | --- |
| PI-32 | After a claim is sent to an HMO company, how long do you normally wait before following up? | POLICY · PARTIALLY ANSWERED | M12, M23, M18, M15, M21 | Q22: responses are slow (no duration); Q23: HMO contacting is the part to automate. The 12-hour value is a project value, "not evidence of an insurer-specific SLA" (DOC_RECON; MODULE_COVERAGE) → every overdue/escalation label depends on it. | Elapsed pending time is shown without an "overdue" judgement; escalation is a Staff-recorded action; the 12-hour gate stays labelled a demonstration value. |
| PI-33 | Is that waiting time the same for every HMO company? | POLICY · UNRESOLVED | M12, M15, M23 | No provider directory or per-provider rule exists (ERD_ALIGNMENT HMO_PROVIDERS) → decides whether timing is per provider. | One value or none; no per-provider rules. |
| PI-34 | Please describe how HMO contacting works today: who contacts the HMO, by what means, and which part takes the most effort. | PRODUCT · UNRESOLVED | M12, M18, M23 | Q23 names it the top automation target; the means and owner were not stated (Q27 does not cover HMO contact) → needed before anything is automated. | Contacts are recorded manually by Staff; nothing is sent to an HMO. |
| PI-35 | Who is responsible for chasing an HMO, and who should be told when a case is overdue? | POLICY · PARTIALLY ANSWERED | M12, M18, M23 | Q27: follow-up is the receptionist's, but HMO chasing is not stated → defines recipients. | Responsibility stays with the Staff member who recorded the submission; no alert. |
| PI-36 | When should an unanswered HMO case be escalated, and to whom? | POLICY · UNRESOLVED | M12, M23 | Escalated is an attention state, never an insurer decision (CONTRACTS §8); today escalation needs the 12-hour value and a recorded contact → defines the trigger and recipient. | Escalation stays a manual Staff action; never presented as an outcome. |
| PI-37 | Which routine steps may happen automatically (for example, creating a task after a step) and which must always be a person's decision? | POLICY · UNRESOLVED | M23 (all rules), M20, M12, M18 | Approved M23 scope: "No automation timing or clinic policy is invented"; clinical decisions are never automated → bounds every M23 rule. | Automation is limited to recording and notifying; every decision stays with a person. |

### 4.6 Prescription and follow-up (M19, M20) — respondent: Dentist and receptionist

| ID | Ask | Class · Status | Affects | Evidence → why still needed | If no formal policy |
| --- | --- | --- | --- | --- | --- |
| PI-38 | Please walk us through how a prescription is written and handed to the patient today. | PRODUCT · PARTIALLY ANSWERED | M19, M14, M3, M18 | Q16: prescription is the only paper step. How it is produced and given is not recorded → shapes the printable output (CONTRACTS §10 makes it first-class). | Dentist-entered draft plus explicit authorization; the printed copy is the pharmacy-facing document; no claim a digital copy replaces it. |
| PI-39 | If a prescription must be corrected after the Dentist has signed it, what do you do today? (P7) | POLICY · UNRESOLVED | M19 | CLAUDE.md unresolved item 7; CONTRACTS: correction/reissue is TBD before M19 → blocks any post-authorization change. | Authorized prescriptions stay unchanged; no correction or reissue flow. |
| PI-40 | When a patient needs to come back, when is the next appointment arranged and by whom? | POLICY · PARTIALLY ANSWERED | M20, M6, M11 | Q15 (arranged during payment) and Q27 (follow-up by the receptionist) are consistent, but Q15's final phrase was incomplete → confirms the Staff-schedules step without inventing a trigger. | The Dentist records the need; Staff schedule it through the booking rules; nothing is booked automatically. |
| PI-41 | Does the clinic call patients back for routine check-ups or cleanings even when no Dentist asked for a follow-up? | PRODUCT · UNRESOLVED | M20, M25, M18 | "Recall intervals are not modeled" (MODULE_COVERAGE M20); the "6 months" and "7 days" values exist only as demo rows (`src/data.js`) → decides whether recall exists at all. | No recall automation; no interval is created or implied. |

### 4.7 Messaging and inquiries (M16, M17) — respondent: receptionist and Owner

Q23 makes online messaging a top priority; today no conversation-creation command exists, so Patients and Staff see an honest empty state.

| ID | Ask | Class · Status | Affects | Evidence → why still needed | If no formal policy |
| --- | --- | --- | --- | --- | --- |
| PI-42 | Which social media pages or online channels do patients message you on today? | POLICY · PARTIALLY ANSWERED | M16, M17, M18, M7 | Q23 mentions "the clinic's social media" without naming pages; the Facebook/Instagram/Website taxonomy is prototype-derived and "official channel policy unconfirmed" (M16) → defines the official channels. | Staff log inquiries manually; the source is labelled "reported by Staff". |
| PI-43 | Who answers those messages today: one person, or one person per branch? | POLICY · UNRESOLVED | M16, M17 | Assigned-to-recorder visibility is a technical boundary, not approved ownership (M16 §7) → defines ownership/routing. | Each inquiry is visible only to the Staff member who recorded it, in their branch (today). |
| PI-44 | How quickly do you aim to reply, and when would a message count as late? | POLICY · UNRESOLVED | M16, M17, M23, M21 | No response-time or overdue rule exists (M16/M17 blockers) → blocks any overdue label or alert. | No overdue label; no response-time claim. |
| PI-45 | May a patient start a conversation with the clinic inside the system, or only reply to one? | POLICY · UNRESOLVED | M17, M16, M7, M26 | No creation command exists; adding one is a shared-contract change (CONTRACTS State machines) → unlocks creation. | No creation; honest empty state remains. |
| PI-46 | Who should receive a new patient conversation: a shared inbox, the branch, or a named person? | POLICY · UNRESOLVED | M17, M16, M7, M26 | Participant-and-branch visibility is a technical boundary; no routing rule exists (M17 §11–13) → defines recipients. | No routing; nothing is created. |
| PI-47 | Who may close a conversation, and may a closed one be reopened? (P8) | POLICY · PARTIALLY ANSWERED | M17 | Staff/Dentist participants may close — carried over from the prototype and flagged CLINIC POLICY CONFIRMATION REQUIRED; reopening is unresolved (CLAUDE.md item 8) → confirm or change. | Staff/Dentist participants close (today); no reopening; a new conversation is started instead. |

### 4.8 Records, privacy and finance cross-cutting — respondent: Owner, a Dentist, a receptionist

These reopen several hardened modules at once.

| ID | Ask | Class · Status | Affects | Evidence → why still needed | If no formal policy |
| --- | --- | --- | --- | --- | --- |
| PI-48 | What may the Owner see about an individual patient: identity only, contact details, clinical notes, documents and consents, billing? | POLICY · UNRESOLVED | M4, M5, M14, M11, M22 | Owner is held to the identity tier (M4), operational summary (M5), no documents or consents (M14); each was a conservative technical choice → one answer reopens four modules. | Owner stays at today's tiers. |
| PI-49 | May a Dentist open a patient's record when that patient is not currently in their care, and for how long after a visit? | POLICY · UNRESOLVED | M4, M14, M5 | Generic Dentist access fails closed (M4 §35); only workflow-specific access exists → defines longitudinal Dentist access. | No generic access; workflow-linked access only (today). |
| PI-50 | May a receptionist open the full record of a patient who has no booking at their branch, such as someone just registered at the front desk? | POLICY · UNRESOLVED | M4, M14, M8 | A just-registered walk-in is identity-only until an appointment or Visit exists (M4 §32–33; M14 §33) → affects the front-desk walk-in flow. | Identity tier only (today). |
| PI-51 | Should the new system include the patient records you already keep in your current software? Which parts? | PRODUCT · UNRESOLVED | M4, M5, M14, M1 | Q17/Q18: records are digital in a centralized system. No import exists and clinical history has no server model (M4 §33) → decides whether any import is built. | Start without imported history; nothing is imported. |
| PI-52 | How long must patient records and uploaded documents be kept, and what happens to them afterwards? | POLICY · UNRESOLVED | M4, M14, M5 | No retention rule exists; Retract is the only soft state (M14 §34). Legal requirements are TD-14, not asked here → defines the clinic's practice. | Keep everything; nothing is deleted or purged (today). |
| PI-53 | Which medical and dental history items must be recorded for every patient? | POLICY · UNRESOLVED | M4, M5 | Clinical history has no server model; in a server session Dentists cannot record allergies or history at all (M4 §20, §33) → blocks M4 Verdict A. | No history fields are collected on the server until answered. |
| PI-54 | After a treatment is marked complete, can it be corrected? Who may do it, and how is the original kept? (P6) | POLICY · UNRESOLVED | M5, M11, M19 | CLAUDE.md item 6; completed treatments are read-only by trigger → blocks any amendment. | Completed treatments stay read-only. |
| PI-55 | When an invoice total is zero, how should it be closed? (P9) | POLICY · UNRESOLVED | M11 | CLAUDE.md item 9; the system never fabricates a payment → blocks zero-fee settlement. | Stays open for staff review; no payment is recorded. |

### 4.9 Service and price facts — respondent: Owner

OPERATING_MODE §8 requires these at the follow-up interview; nothing may be invented before.

| ID | Ask | Class · Status | Affects | Evidence → why still needed | If no formal policy |
| --- | --- | --- | --- | --- | --- |
| PI-56 | What are the fee and the usual time for radiographic imaging (X-ray)? | POLICY · PARTIALLY ANSWERED | M13, M6, M11 | Q1 lists it as a service; OPERATING_MODE §8: no Radiographic Imaging service until the clinic gives fee and duration → blocks adding the service. | The service is not added; no price is shown. |
| PI-57 | You gave ₱10,000–₱15,000 for extraction. What does that range cover (simple or surgical, per tooth or per case)? | POLICY · PARTIALLY ANSWERED | M13, M11 | Q12 is flagged unexplained; the seeded Tooth Extraction fee is not reconciled and must not change (OPERATING_MODE §8) → needed before an extraction price is confirmed. | No confirmed extraction price; "No confirmed price" shown. |
| PI-58 | What are the fee and usual duration of orthodontic and oral-surgery services and any other service you offer? | POLICY · PARTIALLY ANSWERED | M13, M6, M11 | Q1 names the services; Q12 prices only cleaning, extraction and filling; `reference_fee_php` is never a price (M13) → needed to confirm any price or duration. | No confirmed price; durations stay labelled unconfirmed. |

### 4.10 Approval gates for Proposed Enhancements

Neither feature is client-requested (OPERATING_MODE §4). Detail questions stay deferred until a "yes".

| ID | Ask | Class · Status | Affects | Evidence → why still needed | If no formal policy |
| --- | --- | --- | --- | --- | --- |
| PI-59 | Does the clinic want a referral or loyalty program in the production system? | PRODUCT · UNRESOLVED | M24, M11 | PE; the 50-point rule is team-designed. OPERATING_MODE §9 records an approved *direction* (10% off a first referred eligible completed visit; the referrer rewarded after that visit is completed and paid; no self-referral) that is a team design, not a clinic statement → a "no" keeps M24 a prototype. | M24 stays a labelled prototype; nothing is built. |
| PI-60 | Does the clinic want marketing or reactivation campaigns in the production system? | PRODUCT · UNRESOLVED | M25, M18, M20 | PE; only a non-sending preview exists, with known raw-setter debt → a "no" keeps M25 a non-sending preview. | M25 stays a non-sending preview. |

## 5. Deferred / module-specific questions

Ask these when the owning module is about to be completed or returned to. They are still real clinic decisions; none is answered by the interview. Same columns as section 4. Rows under 5.12 and 5.13 are **conditional**: ask only after a "yes" to PI-59 or PI-60.

### 5.1 Branches and patient records (M2, M4)

| ID | Ask | Class · Status | Affects | Evidence → why still needed | If no formal policy |
| --- | --- | --- | --- | --- | --- |
| DQ-01 | Which phone number should patients call at each branch? | POLICY · UNRESOLVED | M2, M7, M18 | Existing branch phones are demo values `(02) 8123 100x` (M2) → needed before any number is shown as clinic contact. | No phone is presented as confirmed. |
| DQ-02 | Which personal details may a patient correct themselves? | POLICY · UNRESOLVED | M4 | Today none; Staff edit an allowlist (M4 §11, §32.1) → opens Patient self-edit. | Patients edit nothing; Staff only. |
| DQ-03 | If a patient's medical or dental history is wrong, who corrects it and how is the original kept? | POLICY · UNRESOLVED | M4, M5 | No clinical history model yet (see PI-53); correction workflow undefined (M4 §32.2) → needed once history exists. | No correction path; none is built. |
| DQ-04 | When should two patient records count as the same person (same phone, same name and birth date)? | POLICY · UNRESOLVED | M4 | Only exact email is blocked in walk-in and edit; phone/name duplicates are allowed (M4 §8) → defines the duplicate rule. | No new duplicate blocking; staff judge. |
| DQ-05 | Who may merge two records of the same patient? | POLICY · UNRESOLVED | M4 | No merge exists; none was invented (M4 §31) → defines merge authority. | No merge capability. |

### 5.2 Treatment and clinical (M5)

| ID | Ask | Class · Status | Affects | Evidence → why still needed | If no formal policy |
| --- | --- | --- | --- | --- | --- |
| DQ-06 | Which notes must a Dentist enter before a treatment can be marked complete? | POLICY · UNRESOLVED | M5 | Today only a procedure summary and at least one valid procedure line are required (M5 §39.1) → defines mandatory fields. | Keep today's minimum. |
| DQ-07 | May another Dentist continue or take over a treatment that someone else started? | POLICY · UNRESOLVED | M5, M9 | Only the responsible Dentist/author may act; another Dentist is refused (M5 §7–10) → defines takeover. | No takeover. |
| DQ-08 | May receptionists and assistants read a Dentist's clinical notes, or only the procedure and status? | POLICY · PARTIALLY ANSWERED | M5, M4 | Staff in scope read the clinical record today (existing decision Q-T6, M5 §39.5) → confirm or narrow. | Today's read access stays. |
| DQ-09 | Should tooth numbers or surfaces be recorded for each service? | PRODUCT · UNRESOLVED | M5 | M5 §39.6; no such field → decides the procedure-line shape. | Not recorded. |
| DQ-10 | Should a planned treatment be recorded separately from what was actually performed? | PRODUCT · UNRESOLVED | M5, M11 | M5 §39.7; billing depends on actual performed lines (CLAUDE.md) → decides whether a plan object exists. | Only performed procedures are recorded. |
| DQ-11 | Must a signed consent be on file before certain procedures start? | POLICY · UNRESOLVED | M5, M14 | M5 §39.8; M14 consents are acknowledgements, not signature evidence (M14 §15) → decides whether consent can block treatment. | Consent never blocks treatment. |

### 5.3 Patient assistant (M7)

| ID | Ask | Class · Status | Affects | Evidence → why still needed | If no formal policy |
| --- | --- | --- | --- | --- | --- |
| DQ-12 | Who approves what the Patient assistant may tell patients, and who keeps that content up to date? | POLICY · UNRESOLVED | M7 | Knowledge is four repository-authored navigation texts plus service names; no owner or draft/publish process (M7 §6–7, §39.1–2) → defines content authority. | Content changes only through code review. |
| DQ-13 | Which instructions before or after a procedure, if any, may the assistant share? | POLICY · UNRESOLVED | M7, M5 | M7 §39.9; such questions are refused whole today → decides whether any approved text exists. | The assistant refuses and hands over to staff. |
| DQ-14 | May the assistant show a patient their own appointment details? | POLICY · UNRESOLVED | M7, M6 | No Patient context is sent or shown (M7 §8, §39.3) → decides personalised answers. | No patient-specific answers. |
| DQ-15 | In which situations must the assistant pass the patient to a person? | POLICY · UNRESOLVED | M7, M17 | Handoff only points to Messages; no ticket exists (M7 §21–22, §39.5) → defines triggers. | Today's refusal and "contact the clinic staff" wording. |
| DQ-16 | Who reviews how well the assistant is working? | POLICY · UNRESOLVED | M7 | No quality-metrics store or reviewer (M7 §24, §39.7) → needed before metrics are kept. | Only category log lines; no review. |
| DQ-17 | Should staff see when the assistant handed a patient over? | PRODUCT · UNRESOLVED | M7, M17 | M7 §39.8; depends on a conversation-creation command → decides handoff visibility. | No handoff record. |

### 5.4 Billing and payments (M11)

| ID | Ask | Class · Status | Affects | Evidence → why still needed | If no formal policy |
| --- | --- | --- | --- | --- | --- |
| DQ-18 | Are partial or split payments allowed? | POLICY · UNRESOLVED | M11 | One full payment per invoice (M11 §10, §40.1) → opens partial settlement. | Full payment only. |
| DQ-19 | Which payment methods does the clinic accept, and which does staff record after collecting them outside the system? | POLICY · UNRESOLVED | M11 | Staff-recorded Card/POS, Bank and E-wallet are manual entries; interview has no payment-method policy (OPERATING_MODE §3) → defines the method list. | Today's Staff-recorded list stays. |
| DQ-20 | Does the clinic want patients to pay online at all? | PRODUCT · UNRESOLVED | M11 | The interview gives no online-payment policy (OPERATING_MODE §3); a PayMongo path is built but unverified (TD-07) → decides whether the path is switched on. | Online payment stays unconfigured (it answers 503 without credentials). |
| DQ-21 | Does the clinic give discounts? Who approves them? | POLICY · UNRESOLVED | M11, M13, M24 | Not modelled; referral discount direction is a team design (OPERATING_MODE §9) → defines discounts. | No discounts. |
| DQ-22 | Are listed prices VAT-inclusive, and is tax shown on receipts? | POLICY · UNRESOLVED | M11, M13 | M13 §36.9; no tax model → defines tax treatment. | No tax lines. |
| DQ-23 | May an invoice be voided or cancelled? Who decides? | POLICY · UNRESOLVED | M11 | No Void/Cancelled state (M11 §5) → defines voiding. | No void. |
| DQ-24 | Are refunds given, including when a payment was collected twice? Who approves them? | POLICY · UNRESOLVED | M11 | Duplicate captures are recorded for review, never refunded (M11 §21, §44) → defines refunds. | No refund feature; duplicates stay "needs review". |
| DQ-25 | May a receipt be reprinted or reissued, and is a special numbering or format required? | POLICY · UNRESOLVED | M11 | Numbering `RCT-YYYY-######` is a technical choice (M11 §11, §40.5) → defines reprint/format. | No reprint feature; numbering unchanged. |
| DQ-26 | After how long is an unpaid invoice considered overdue, and who follows up? | POLICY · UNRESOLVED | M11, M18, M23 | No overdue timing exists in code (audit of backend and `src`); OPERATING_MODE §7 forbids "overdue" without due-date data → defines timing. | No "overdue" wording anywhere. |
| DQ-27 | Who checks the payment provider's records against the clinic's, and how often? | POLICY · UNRESOLVED | M11 | Reconciliation is record-only with no resolution workflow (M11 §22, §40.7) → defines ownership. | A manual, out-of-system review. |
| DQ-28 | Should the Owner remain read-only for billing? | POLICY · PARTIALLY ANSWERED | M11 | Owner payment initiation was removed; Owner is read-only in the existing contract (M11 §14, §40.6) → confirm. | Read-only (today). |
| DQ-29 | May a patient pay a different amount than the balance, such as a deposit? | POLICY · UNRESOLVED | M11 | Payment must equal the balance (M11 §40.9) → decides deposits/overpayment. | Exact balance only. |

### 5.5 Services and pricing (M13)

| ID | Ask | Class · Status | Affects | Evidence → why still needed | If no formal policy |
| --- | --- | --- | --- | --- | --- |
| DQ-30 | Who may add, rename or retire a service? | POLICY · UNRESOLVED | M13, M3 | No create/edit/deactivate endpoint exists (M13 §3–5, §36.1) → defines catalog authority. | No catalog editing. |
| DQ-31 | Who may set or change a price, and does anyone need to approve it? | POLICY · PARTIALLY ANSWERED | M13 | Q3 shows the Owner decides management matters but not pricing; Owner-only price versions exist as the safest choice (M13 §13) → confirm. | Owner only (today). |
| DQ-32 | Do prices differ between branches? | POLICY · UNRESOLVED | M13, M11 | A branch price mechanism exists (M13 §36.4) → decides whether it is used. | One base price. |
| DQ-33 | Do prices differ by Dentist? | POLICY · UNRESOLVED | M13 | No Dentist-level pricing exists (M13 §36.5) → decides a new dimension. | No Dentist pricing. |
| DQ-34 | How far ahead may a new price be set? | POLICY · UNRESOLVED | M13 | No upper bound on future-dated versions (M13 §37) → decides a horizon. | No horizon limit beyond "not in the past". |
| DQ-35 | May a price already in effect be corrected afterwards? | POLICY · UNRESOLVED | M13, M11 | Past prices are immutable; only a future version may be retracted (M13 §8, §36.7) → decides retroactive correction. | Immutable (today). |
| DQ-36 | Does the clinic offer packages or bundles? | PRODUCT · UNRESOLVED | M13, M11 | M13 §36.12; not modelled → decides scope. | No packages. |
| DQ-37 | Should patients see exact prices, ranges or no prices online? | POLICY · UNRESOLVED | M13, M7 | No Patient price API exists (M13 §36.10); the assistant refuses price questions (M7) → decides display. | No patient-facing prices; the assistant refuses. |

### 5.6 Forms, documents and consent (M14)

| ID | Ask | Class · Status | Affects | Evidence → why still needed | If no formal policy |
| --- | --- | --- | --- | --- | --- |
| DQ-38 | Which forms and consents are required, and who creates and changes them? | POLICY · UNRESOLVED | M14, M5 | The consent type list is a pre-existing technical list, not clinic-confirmed (M14 §15, §33.1) → defines templates. | The existing acknowledgement records only. |
| DQ-39 | Is a typed or drawn signature acceptable, or must a signature be on paper? | POLICY · UNRESOLVED | M14 | Consent records are acknowledgements, not signature evidence (M14 §15, §33.2) → defines evidence. | No signature claim. |
| DQ-40 | Is a parent or guardian's consent needed for minors? | POLICY · UNRESOLVED | M14 | A `minor_treatment` type exists unconfirmed (M14 §15, §33.3) → defines guardian flow. | No guardian workflow. |
| DQ-41 | Can a signed form or document be replaced or corrected later? | POLICY · UNRESOLVED | M14 | Retract is the only soft state; edit/replace is not implemented (M14 §10, §33.4) → defines versioning. | No replace; retract only. |
| DQ-42 | Which file types and maximum size do you want? | POLICY · PARTIALLY ANSWERED | M14 | PDF, JPG, PNG, WebP at 10 MB is the narrowest existing set (M14 §11, §33.7) → confirm or widen. | Today's set. |
| DQ-43 | Which documents may patients upload themselves? | POLICY · UNRESOLVED | M14 | Patient upload categories (M14 §33.8) → defines patient uploads. | Today's categories. |
| DQ-44 | Who may archive or delete a document? | POLICY · UNRESOLVED | M14 | No archive or hard delete exists (M14 §10, §33.5) → defines authority. | Retract only. |
| DQ-45 | Who reviews text read from documents, and who confirms it? | POLICY · UNRESOLVED | M14, M12, M19 | Extraction output is always a draft; no review endpoint exists (M14 §16, §33.9) → defines reviewers. | No review workflow; drafts stay drafts. |
| DQ-46 | May a Dentist see or record a patient's consent? | POLICY · UNRESOLVED | M14, M5 | Dentist consent access fails closed (M14 §10, §33.10) → defines Dentist consent role. | Fails closed (today). |

### 5.7 Inquiries and conversations (M16, M17)

| ID | Ask | Class · Status | Affects | Evidence → why still needed | If no formal policy |
| --- | --- | --- | --- | --- | --- |
| DQ-47 | May an inquiry be handed to another receptionist? Who may do it? | POLICY · UNRESOLVED | M16, M17 | No reassignment command (M16 §7, §36.4) → defines reassignment. | No reassignment. |
| DQ-48 | When does an inquiry become a conversation with a patient, and who continues it? | POLICY · UNRESOLVED | M16, M17 | The prototype's conversion-to-conversation handoff was not carried over (M16 §10; M17 §25) → defines the handoff. | No handoff; conversion only links an existing appointment. |
| DQ-49 | How should someone who is not yet a patient be linked to a patient record? | POLICY · UNRESOLVED | M16, M4 | Inquiries start with no patient; linking happens only through an existing appointment (M16 §9, §36.10) → defines identity matching. | Only the existing explicit link. |
| DQ-50 | May Dentists answer external inquiries? | POLICY · UNRESOLVED | M16 | Owner and Dentist are denied (M16 §14–15, §36.11) → defines access. | Fails closed. |
| DQ-51 | Should staff record that they replied outside the system? | PRODUCT · PARTIALLY ANSWERED | M16 | "Responded" is a status flag only (M16 §6, §36.13) → confirm the meaning. | Status flag only. |
| DQ-52 | Who may escalate an overdue inquiry or conversation, and to whom? | POLICY · UNRESOLVED | M16, M17, M23 | No SLA, overdue or escalation exists (M16 §37; M17 §43) → depends on PI-44. | No escalation. |
| DQ-53 | May a Dentist take part in, or start, a patient conversation? | POLICY · PARTIALLY ANSWERED | M17 | Dentist participants with a branch link are allowed because the prototype had them (M17 §11–13, §42.5) → confirm. | Participant-and-branch only (today). |
| DQ-54 | May the Owner read or reply to patient conversations? | POLICY · UNRESOLVED | M17 | "Owner oversight grants no participation" (MODULE_COVERAGE M17; M17 §13) → defines oversight. | Fails closed. |
| DQ-55 | Are attachments needed in conversations? | PRODUCT · UNRESOLVED | M17, M14 | None by design; would consume M14 (M17 §42.12) → decides scope. | No attachments. |
| DQ-56 | May a sent message be edited or removed? | POLICY · UNRESOLVED | M17 | Messages are immutable by database trigger (M17 §15, §42.11) → defines edit/delete. | Immutable. |
| DQ-57 | Should patients or staff see read receipts? | PRODUCT · UNRESOLVED | M17 | No cross-user receipts exist; unread is per participant only (M17 §45, §42.14) → decides receipts. | No receipts. |
| DQ-58 | Will texts, emails or social replies feed the same conversation? | PRODUCT · UNRESOLVED | M17, M18, M16 | No external channels (M17 §42.15) → decides channel unification and any M18 dependency. | In-app only. |

### 5.8 Notifications (M18)

| ID | Ask | Class · Status | Affects | Evidence → why still needed | If no formal policy |
| --- | --- | --- | --- | --- | --- |
| DQ-59 | During which hours may patients be contacted? | POLICY · UNRESOLVED | M18, M15 | No contact-hours rule exists → defines quiet hours. | In-app only; no hours. |
| DQ-60 | If a message could not be delivered, who is told and what do they do? | POLICY · UNRESOLVED | M18, M23 | The demo failure log ("SMS provider unavailable") is not real delivery (`src/data.js` log4) → defines failure handling. | No external delivery is claimed. |
| DQ-61 | Which messages must a patient always receive, and which may a patient switch off? | POLICY · UNRESOLVED | M18, M25 | Transactional reminders stay separate from M25 marketing (MODULE_COVERAGE) → defines opt-out boundary. | Only in-app transactional records. |
| DQ-62 | Who approves the wording of standard messages? | POLICY · UNRESOLVED | M18 | No templates owner → defines wording authority. | Existing in-app wording only. |
| DQ-63 | Which staff roles should see which notifications? | POLICY · PARTIALLY ANSWERED | M18 | Identity-specific recipients exist; role routing was not approved (CONTRACTS; PHASE3_5 safeguards) → confirm. | Recipient-specific only (today). |

### 5.9 Prescription and follow-up detail (M19, M20)

| ID | Ask | Class · Status | Affects | Evidence → why still needed | If no formal policy |
| --- | --- | --- | --- | --- | --- |
| DQ-64 | Does a prescription expire, and after how long? | POLICY · UNRESOLVED | M19 | No expiry rule in code; none in the interview → defines validity. Legal rules are TD-13. | No expiry is shown or enforced. |
| DQ-65 | Does the clinic use standard prescription templates or common medication lists, and who keeps them? | PRODUCT · UNRESOLVED | M19, M3 | CONTRACTS §10 Path B: a Dentist-selected template; the system never chooses a medication → decides whether templates exist. | No templates; Dentist enters everything. |
| DQ-66 | What must appear on a printed prescription (clinic header, license details, signature)? | POLICY · UNRESOLVED | M19, M3 | CONTRACTS §10: layout plans these but never labels output "legally compliant" until verified → defines the layout. | No "compliant" label. |
| DQ-67 | Should paper or scanned prescriptions be read into a draft? Who must check the draft? | PRODUCT · UNRESOLVED | M19, M14 | Q16 says prescriptions are the paper step; OCR output is draft-only and human-confirmed (CONTRACTS §9–10) → decides whether Path C is built. | No OCR path; drafts only by Dentist entry. |
| DQ-68 | When a prescription is issued, how does the patient receive a copy (printed only, or also a digital copy)? | PRODUCT · UNRESOLVED | M19, M18 | A digital copy is not claimed to replace the printed one; delivery goes through M18 later (CONTRACTS §10–11) → decides delivery. | Printed copy; in-app read-only copy only. |
| DQ-69 | How does a Dentist tell the receptionist today that a patient needs a follow-up? | PRODUCT · UNRESOLVED | M20, M5 | Q27 (follow-up is the receptionist's) but the handover is not described → confirms the task flow. | The Dentist's recorded decision creates the task (today). |
| DQ-70 | For routine recall, which treatments or patients, what interval, and who decides it? | POLICY · UNRESOLVED | M20 | Conditional on PI-41; recall intervals are not modelled (MODULE_COVERAGE M20). | No interval invented. |
| DQ-71 | If a follow-up date passes without a booking, what should happen and who does it? | POLICY · UNRESOLVED | M20, M18 | The follow-up state machine has no lapse rule; reminders are TBD (CONTRACTS) → defines lapse handling. | The task stays Open; staff chase manually. |
| DQ-72 | May patients book their own follow-up? | POLICY · PARTIALLY ANSWERED | M20, M6 | Documents conflict: OPERATING_MODE §5 and MODULE_COVERAGE M20 allow own-Patient scheduling; MODULE_COVERAGE M6 says Patients do not self-schedule clinical follow-ups → resolve by clinic decision (section 13). | Staff schedule (today's M6 rule). |
| DQ-73 | How long before a follow-up date should a patient be reminded? | POLICY · UNRESOLVED | M20, M18 | "Recall intervals and reminders are TBD" (CONTRACTS) → defines timing. | No reminder timing claimed. |

### 5.10 Reporting (M21) and audit (M22)

| ID | Ask | Class · Status | Affects | Evidence → why still needed | If no formal policy |
| --- | --- | --- | --- | --- | --- |
| DQ-74 | Which numbers do you want to watch regularly? You said "better" means shorter waits and real-time updates. | PRODUCT · PARTIALLY ANSWERED | M21, M10, M18 | Q32 is qualitative; no metric definitions exist → asked last, after domain rules settle. | Only metrics with authoritative sources; unsupported ones show "Unavailable". |
| DQ-75 | Should reports break results down by branch, by Dentist, or by service? | PRODUCT · UNRESOLVED | M21, M26 | M26 §40.18; M2 notes a branch-reference defect in M21 (section 11) → defines attribution. | Branch-level aggregates only where authoritative. |
| DQ-76 | Who may review the audit history? Should the Owner see Staff and Dentist activity, and should anyone see their own? | POLICY · PARTIALLY ANSWERED | M22 | Owner-only is the existing contract (M22 §9, §36.1) → confirm. | Owner only (today). |
| DQ-77 | Should looking at a patient record, or opening a document, be written down (who looked, when)? | POLICY · UNRESOLVED | M22, M4, M14 | Reads are not audited (M22 §17, §19; M4 §32.7; M14 §33.6) → defines read-audit. | No read auditing. |
| DQ-78 | May the audit history be exported, and by whom? | POLICY · PARTIALLY ANSWERED | M22 | A bounded Owner-only CSV export exists as a kept capability (M22 §21) → confirm. | Owner-only (today). |
| DQ-79 | Do you need the device address (IP) and browser of staff recorded, and who may see it? | POLICY · PARTIALLY ANSWERED | M22 | Captured and shown to the Owner today; necessity open (M22 §8, §36.5) → confirm. | Captured and Owner-visible (today). |
| DQ-80 | Which events, if any, should raise an alert, and to whom? | POLICY · UNRESOLVED | M22, M23 | No alerting exists (M22 §37.3) → defines alerts. | No alerts. |

### 5.11 Retention (cross-module; one decision per data type)

PI-52 covers patient records and documents. Legal minimums are TD-14.

| ID | Ask | Class · Status | Affects | Evidence → why still needed | If no formal policy |
| --- | --- | --- | --- | --- | --- |
| DQ-81 | How long must audit history be kept, and how is it archived? | POLICY · UNRESOLVED | M22 | Unbounded growth; DB forbids deletion (M22 §22) → defines retention. | Keep everything. |
| DQ-82 | How long must messages and inquiries be kept? | POLICY · UNRESOLVED | M16, M17 | RESTRICT foreign keys; no period invented (M16 §39; M17 §24) → defines retention. | Keep everything. |
| DQ-83 | Should conversations with the Patient assistant be kept at all, and for how long? | POLICY · UNRESOLVED | M7 | None are stored (M7 §19) → decides whether to start storing. | Not stored. |
| DQ-84 | How long must patient feedback be kept? | POLICY · UNRESOLVED | M26 | RESTRICT keys; no period (M26 §14, §40.15) → defines retention. | Keep everything. |
| DQ-85 | How long should notifications remain visible to a recipient? | POLICY · UNRESOLVED | M18 | No retention rule exists → defines visibility window. | No expiry. |

### 5.12 Automation failure handling (M23)

| ID | Ask | Class · Status | Affects | Evidence → why still needed | If no formal policy |
| --- | --- | --- | --- | --- | --- |
| DQ-86 | When an automatic step fails, who is told and who fixes it? | POLICY · UNRESOLVED | M23, M18 | M23 scope includes "retry / exception → human intervention" (MODULE_COVERAGE) but no owner is defined → defines exception ownership. | Failures show on the Owner monitor only. |

### 5.13 Patient feedback (M26)

M26 stays a Patient-only foundation until these are answered. The Owner is **not** assumed to be the reviewer.

| ID | Ask | Class · Status | Affects | Evidence → why still needed | If no formal policy |
| --- | --- | --- | --- | --- | --- |
| DQ-87 | May feedback be given about any completed visit, or only certain ones? | POLICY · PARTIALLY ANSWERED | M26 | Implemented only as "own completed Visit" (M26 §7) → defines eligibility. | Own completed visits (today). |
| DQ-88 | One feedback per visit or several? | POLICY · UNRESOLVED | M26 | No uniqueness was invented (M26 §9) → defines multiplicity. | Several allowed (today). |
| DQ-89 | Is there a time limit after the visit for giving feedback? | POLICY · UNRESOLVED | M26 | Open question (M26 §7) → defines the window. | No limit. |
| DQ-90 | Should feedback include a rating, and on what scale? | PRODUCT · UNRESOLVED | M26, M21 | No scale exists (M26 §11–13) → decides rating. | Free text only. |
| DQ-91 | Should feedback have categories? Which? | PRODUCT · UNRESOLVED | M26, M21 | Word only in the intended lifecycle (M26 §3) → decides categories. | No categories. |
| DQ-92 | Should a patient be able to give feedback anonymously? | PRODUCT · UNRESOLVED | M26 | Not offered; ownership is authenticated (M26 §3, §11–13) → decides anonymity. | Not anonymous. |
| DQ-93 | Who reviews feedback? | POLICY · UNRESOLVED | M26 | "Owner review" is intended-lifecycle text only; Owner access was removed (M26 §16) → blocks any reviewer access. | No reviewer; submissions stay factual records. |
| DQ-94 | May receptionists see feedback? | POLICY · UNRESOLVED | M26 | Fails closed (M26 §15) → defines Staff visibility. | Fails closed. |
| DQ-95 | May a Dentist see feedback about themselves or their patients? | POLICY · UNRESOLVED | M26 | Fails closed (M26 §15, §40.7) → defines Dentist visibility. | Fails closed. |
| DQ-96 | Which statuses should feedback have, and what makes it need action? | POLICY · UNRESOLVED | M26, M23 | New/Reviewed/Action Required/Resolved are "intended lifecycle" only (M26 §17) → defines statuses. | No statuses. |
| DQ-97 | When feedback needs a response, who replies and through which channel? | POLICY · UNRESOLVED | M26, M17, M18 | No reply or M17 handoff exists (M26 §18) → defines service recovery. | No reply; the Patient screen points to Messages. |
| DQ-98 | How quickly must feedback be acted on, and who escalates? | POLICY · UNRESOLVED | M26, M23 | No SLA (M26 §40.12) → defines timing. | No timing claimed. |
| DQ-99 | Should the patient see whether their feedback was reviewed or resolved? | PRODUCT · UNRESOLVED | M26 | The patient has no way to see status; none exists (M26 §41) → decides visibility. | No status shown. |
| DQ-100 | May a patient edit or withdraw submitted feedback? | POLICY · UNRESOLVED | M26 | Immutable by trigger; CORRECTION / WITHDRAWAL POLICY REQUIRED (M26 §14, §45) → defines correction. | Immutable. |
| DQ-101 | May any feedback be used publicly, and with what consent? | POLICY · UNRESOLVED | M26, M25 | No testimonial or public-use field (M26 §3, §18–21) → defines publication. | Never public. |

### 5.14 Referral and loyalty detail (M24) — conditional on PI-59 = yes

| ID | Ask | Class · Status | Affects | Evidence → why still needed | If no formal policy |
| --- | --- | --- | --- | --- | --- |
| DQ-102 | Who qualifies to earn a reward, and for what? | POLICY · UNRESOLVED | M24 | Prototype rules are team-designed (MODULE_COVERAGE M24) → defines qualification. | Prototype only. |
| DQ-103 | What is a reward worth, and what limits apply? | POLICY · UNRESOLVED | M24, M11 | No benefit value is modelled; interview provides no loyalty economics (OPERATING_MODE §3) → defines economics. | No value defined. |
| DQ-104 | May a reward be combined with HMO coverage or other discounts? | POLICY · UNRESOLVED | M24, M11, M12 | OPERATING_MODE §9: do not invent stacking → defines combination. | No stacking. |
| DQ-105 | Which services qualify, and may a referral code be reused? | POLICY · UNRESOLVED | M24 | OPERATING_MODE §9: do not invent eligible-service or code-reuse rules → defines both. | No rule invented. |
| DQ-106 | Who approves a redemption, and how is it applied to an invoice? | POLICY · UNRESOLVED | M24, M11 | A typed code alone never applies a discount (OPERATING_MODE §9) → defines approval. | Nothing applied. |
| DQ-107 | Do patients need to agree to program terms? | POLICY · UNRESOLVED | M24, M14 | No terms/consent exists → defines consent. | No program for patients. |

### 5.15 Marketing and reactivation detail (M25) — conditional on PI-60 = yes

| ID | Ask | Class · Status | Affects | Evidence → why still needed | If no formal policy |
| --- | --- | --- | --- | --- | --- |
| DQ-108 | Who approves each campaign before it is sent? | POLICY · UNRESOLVED | M25 | Full management deferred until consent and targeting are designed (MODULE_COVERAGE M25) → defines approval. | Nothing is sent. |
| DQ-109 | Which patients may be contacted, and what consent is needed? | POLICY · UNRESOLVED | M25, M18 | No marketing consent exists → defines eligibility. | Nothing is sent. |
| DQ-110 | How does a patient opt out, and how is it recorded? | POLICY · UNRESOLVED | M25, M18 | No opt-out exists → defines opt-out. | Nothing is sent. |
| DQ-111 | How often may a patient be contacted? | POLICY · UNRESOLVED | M25 | No frequency rule → defines limits. | Nothing is sent. |
| DQ-112 | What results do you want to see from a campaign? | PRODUCT · UNRESOLVED | M25, M21 | No analytics defined → defines measures. | No campaign analytics. |

## 6. Team / deployment / integration decisions (not for the clinic interview)

Do not take these to the clinic. Each has status TEAM DECISION. Where the class is POLICY, the team prepares the question and the Owner signs off afterwards; the clinic is not asked to define the law or the vendor.

| ID | Item | Class | Affects | Evidence | Needed because |
| --- | --- | --- | --- | --- | --- |
| TD-01 | Apply the nine unapplied migrations to non-test databases deliberately, in order: M1 `2026_10_09_000100`, M2 `2026_10_10_000100`, M4 `2026_10_11_000100`, M14 `2026_10_12_000100`, M22 `2026_10_13_000100`, M11 `2026_10_14_000100`, M16 `2026_10_15_000100`, M17 `2026_10_16_000100`, M26 `2026_10_17_000100` | DEPLOYMENT | M1, M2, M4, M14, M22, M11, M16, M17, M26 | Each report: tested only on `dental_clinic_test`; "not applied to `dental_clinic`". M5, M7, M13 add none | The new code needs these tables/columns; M1 sessions require re-login after `auth_version` |
| TD-02 | Plan and run `VALIDATE CONSTRAINT` for the four M11 `NOT VALID` constraints after listing violators read-only | DEPLOYMENT | M11 | M11 §43 | They are not proof of historical integrity until validated |
| TD-03 | One shared cache store for every instance (database or Redis) for the M1, M7, M17, M26 limiters and the M22 access-denied bound | DEPLOYMENT | M1, M7, M17, M22, M26 | M1 §6–8; M7 §17–18; M17 §45; M22 §12a; M26 §26 | Per-instance caches multiply the limits |
| TD-04 | HTTPS and secure cookies, exact trusted Sanctum/frontend origins, `APP_DEBUG=false`, a real non-logging mail transport | DEPLOYMENT | M1 | M1 §29–30 | Registration/OTP and sessions depend on it; production OTP rejects log/array transports |
| TD-05 | The application database role must not own M22 tables or be a superuser | DEPLOYMENT | M22 | M22 §37.4 | Otherwise it could drop the append-only triggers |
| TD-06 | Production bootstrap: replace the demo b1/b2/b3 rows and seeders with the real three branches (names, addresses, phone, hours), decide the row-to-location mapping (the former draft's mapping question), and seed real services without demo fees | DEPLOYMENT | M2, M13, M3 | M2 §Approved public locations and §Intentional non-changes; `BranchSeeder` refuses production | Mapping was "unconfirmed; defer"; do not insert three more rows beside referenced legacy rows |
| TD-07 | Controlled live verification of PayMongo: create `POST /v2/checkout_sessions`, read back `GET /v1/checkout_sessions/{id}`, real webhook shape, enabled payment methods, redirect/webhook timing | INTEGRATION | M11 | M11 §39, §44 | Everything so far is documentation compatibility plus mocks |
| TD-08 | PayMongo account, credentials, `PAYMONGO_MODE`, `PAYMONGO_PAYMENT_METHOD_TYPES` and the webhook endpoint/secret | INTEGRATION | M11 | M11 §19 (no defaults; 503 when unset) | Online payment cannot start without them (and only if DQ-20 is yes) |
| TD-09 | Provider session expiry: whether a v2-created session can be expired, and a policy for sessions left open at the provider | INTEGRATION | M11 | M11 §44 | Superseded/left-open sessions can still be paid |
| TD-10 | Scheduled re-processing of provider events left `Received`, and the resolution tooling for `Needs review`/`Duplicate` events (after DQ-24 and DQ-27) | ENGINEERING | M11 | M11 §22, §41.2 | No payment is dropped, but nothing resolves them |
| TD-11 | Permanent AI vendor approval and live provider verification (model, credentials, real-network behaviour) | INTEGRATION | M7 | M7 §4, §40 | Anthropic is accepted only as first/reference adapter; all tests are mocked |
| TD-12 | Privacy/data-processing review of sending Patient-typed assistant messages to an external provider, and the Patient notice wording | POLICY | M7 | M7 §8: no notice exists; no legal wording was invented | Required before live enablement |
| TD-13 | Regulatory research: Philippine prescription output requirements (credentials, signature, validity, any controlled-drug rules) | POLICY | M19, M3 | CONTRACTS §4, §10: no output is called "legally compliant" until verified | The clinic is not asked to define law; DQ-64 and DQ-66 ask only about clinic practice |
| TD-14 | Regulatory research: legal minimum retention and data-privacy obligations for patient, document, audit and message records | POLICY | M4, M14, M22, M16, M17, M26 | M4 §32.8; M14 §34; M22 §22 | Informs, but does not replace, PI-52 and DQ-81–85 |
| TD-15 | OCR provider selection, privacy review and cost | INTEGRATION | M14, M19, M12 | CONTRACTS §9: no cloud OCR/document provider is approved | Required before any scanned-document extraction |
| TD-16 | Malware scanning with a quarantine state | DEPLOYMENT | M14 | M14 §17, §34.3 | The API reports `security_scan: not_performed` |
| TD-17 | Encryption at rest or object storage, and an unreferenced-file sweeper | DEPLOYMENT | M14 | M14 §6, §34.5 | Protection currently depends on host disk controls |
| TD-18 | External messaging platform choices: Facebook/Instagram APIs for M16, SMS and email providers for M18/M17 | INTEGRATION | M16, M17, M18, M25 | M16 §4–5 (none integrated or approved); CONTRACTS §11 (never claim external delivery without a provider) | The clinic answers PI-30 and PI-42 (what it uses), not which API to integrate |
| TD-19 | Add a ULID `public_id` to Service (shared-contract migration touching every module and the frontend) | CONTRACT MIGRATION | M13, M5, M6, M11 | M13 §3–5, §37 | Services are exposed only by the frozen `legacy_ref` bridge |
| TD-20 | Retire `legacy_ref` and the temporary branch-name uniqueness once consumers use IDs; fix the M21 numeric-reference mismatch | CONTRACT MIGRATION | M2, M21, M3 | M2 §Findings 2, §Database; CONTRACTS §1 | Name-based selectors remain |
| TD-21 | Replace the demo-bound identity bridge and the browser-local `persons`/`patients`/`users` collections with a server-issued profile projection and a deliberate compatibility-data migration | CONTRACT MIGRATION | M1, M4, M3 | M1 §29–30; M4 §35 | Not a general production identity system |
| TD-22 | ERD/contract housekeeping needing explicit approval: the data dictionary's "PE feedback record" wording, regeneration of the ERD images, Visit-anchored prescription wording, vNext candidates (`BOOKING_DRAFTS`, `dentist_assignment_method`) | CONTRACT MIGRATION | M26, M19, M6, M14 | ERD_ALIGNMENT; DOC_RECON C2; CONTRACTS §10 | CLAUDE.md: do not alter the ERD without explicit approval |
| TD-23 | Extend M22 emission to module-local histories (M5, M6, M8, M9, M12, M13, Staff-recorded M11) | ENGINEERING | M22 and those modules | M22 §14, §37.2 | There is no unified cross-module trail |
| TD-24 | Background execution infrastructure (queue/worker) for M18 delivery jobs and M23 execution | DEPLOYMENT | M18, M23 | MODULE_COVERAGE M23 ("no … background worker"); CLAUDE.md backend list (Redis/queues) | Reminders, retries and automatic follow-ups cannot run without it |

## 7. M23 automation provenance

Scope: every seeded and prototype automation rule, every numeric/timing constant that behaves like policy, and a search of backend and frontend source for others (patterns: `const … = <number>`, hours/minutes/days arithmetic, thresholds, intervals). The search covered `backend/app`, `backend/config`, `backend/database` and `src` (`.php`, `.js`, `.jsx`). No other automation rule exists in the backend: the six seeded rules are the only `workflow_rules` rows.

### 7.1 What the backend M23 actually does

`WorkflowAutomationService` records a `system_events` row and, for every active rule whose `trigger_event` equals the event type, writes an `automated_actions` row with a status and a **text summary** (`resolveRuleOutcome`, lines 138–241), then an M22 event. It creates no invoice, task, notification, route or profile. The only caller of `recordEvent` outside the service is `BillingService` (`billing.payment_received`), which matches **none** of the six triggers. The only other path is the Owner's `POST /automation/dispatch` (manual evaluation) with an Owner-supplied payload. Therefore the thresholds below are evaluated on Owner-typed numbers; no system event produces them.

### 7.2 Rule-by-rule provenance

| Rule | Trigger | Threshold / timing | Action as written | What the backend code does | Code source | Stakeholder evidence | Authority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 `R1_APPT_LIFECYCLE` | `appointment.lifecycle.changed` | none | Reserve or release slot; update calendar; notify patient | Always Success: "calendar reservation and notification dispatch staged"; nothing is reserved, calendared or sent | Seed migration `2026_10_08_000100…`; `WorkflowAutomationService.php:143–152`; prototype `src/data.js` `INITIAL_AUTOMATIONS` r1 | Q20 (scheduling conflicts) and Q32 (real-time booking updates) support the intent, not any timing. Slot reservation is M6's deterministic database logic, not M23 | Intent: interview-supported. Behaviour: unsupported claim (section 11, E-4) |
| R2 `R2_HMO_FOLLOWUP_REMINDER` | `hmo.pending.timer.updated` | **≥ 12 hours** pending (payload `pending_hours`) | Create follow-up task and notify HMO coordinator | Warning text "Follow-up task staged for coordinator" at ≥ 12; no task and no notification exist | Seed; `WorkflowAutomationService.php:154–172` (literal 12); the real due time and escalation gate use `HmoCase::FOLLOW_UP_HOURS = 12` (`HmoCase.php:23,91`; `HmoCaseService.php:205–212`); frontend `src/phase3-contracts.js:12`, `src/hmo-presentation.js:8`; Owner label `src/pages/Admin.jsx:527` | Q22 (slow responses), Q23 (HMO contacting is the top automation target). No duration stated | The value is a **project decision, unconfirmed** (MODULE_COVERAGE M12; DOC_RECON: "not evidence of an insurer-specific SLA"). Three independent code constants plus rule text carry the same value |
| R3 `R3_CAPACITY_ALERT` | `patientflow.capacity.updated` | **wait > 35 minutes** OR "branch load > threshold" | Alert front desk/owner; show cross-branch capacity | Warning at `estimated_wait_minutes > 35` only; the "branch load" half of the written condition is not implemented; nothing is alerted | Seed; `WorkflowAutomationService.php:174–192` (literal 35) | Q19/Q21/Q32 (waiting is the top delay/complaint) support caring about waits; no number | Value: project decision, unconfirmed. Condition text vs code mismatch (E-4) |
| R4 `R4_TREATMENT_DOWNSTREAM` | `clinical.treatment.completed` | none | Create billing, prescription, or follow-up task as applicable | Success text always lists "Draft invoice created" and adds "prescription obligation staged" / "Recall / follow-up obligation staged" **only when the caller's payload carries `prescription_required` / `followup_required`**; creates nothing | Seed; `WorkflowAutomationService.php:194–212`; the real handoff is `src/workflow.js:158–184` (`reconcileTreatmentHandoffs`) and the server Staff invoice command | Q27 (billing and follow-up are the receptionist's; treatment is the Dentist's) | See 7.4: the frontend adapter keys off a Dentist-documented flag; the backend rule does not enforce Dentist origin |
| R5 `R5_MESSAGE_ROUTING` | `communication.message.received` | none | Route to responsible staff queue | Always Success: "routed to responsible branch staff inbox"; M17 has no routing and no creation command | Seed; `WorkflowAutomationService.php:214–221` | Q23 (online messaging) supports the intent; who answers is unknown (PI-43, PI-46) | Intent: interview-supported. Behaviour: unsupported claim (E-4). Routing rule: POLICY |
| R6 `R6_USER_PROFILE_SYNC` | `access.user.changed` | none | Create or synchronize linked STAFF_PROFILES | Always Success: "account synchronised with … profile"; M1 deliberately has no privileged provisioning | Seed; `WorkflowAutomationService.php:223–232` | None | Unsupported claim (E-4); depends on PI-01/PI-02 and M3 |

### 7.3 Other numeric constants that behave like policy (comprehensive search)

Each is classified independently. Wait-estimation formulas and alert thresholds are different things and are **not** called contradictory here.

| Constant | Where | Used for | Stakeholder evidence | Authority |
| --- | --- | --- | --- | --- |
| 12 hours | See R2 | HMO due time, escalation gate, dashboards, Owner label | Q22/Q23 (no number) | Project decision, unconfirmed |
| 35 minutes (alert) | `WorkflowAutomationService.php:176` | M23 R3 warning | None | Project decision, unconfirmed |
| 35 minutes (overloaded flag) | `src/logic.js:82` (`estimate >= 35`) | M10 "overloaded" display | None | Project decision, unconfirmed |
| 35 minutes (patient update) | `src/communication.js:115` (`35*60000` since arrival) | Foreground "Queue waiting update" notification | Q32 supports waiting updates, not 35 | Project decision, unconfirmed (DOC_RECON names it a foundation) |
| 24 hours | `src/communication.js:106–108` | Foreground appointment reminder | None (OPERATING_MODE §3: no reminder timings) | Project decision, unconfirmed |
| Branch load thresholds 80 / 80 / 75 | `src/data.js:117–119`; `BranchSeeder`; `branches.capacity_threshold` (1–100) | M10 overloaded; M21 branch data | None; M2: "capacity assumptions" unconfirmed | Demo configuration |
| Default threshold 80 | `src/logic.js:81`; `AnalyticsService.php:266` (`?: 80`) | Fallback when none is set | None | Technical choice (invented fallback) |
| Wait estimate (M10, client) | `src/logic.js`: per-entry `typical` default 30 min, active-treatment factor 0.55, minimum 5, unavailable-Dentist floor 30; branch `(waiting ÷ Dentists) × 22 + ready × 8`; workload weights 1.2 / 1.4 / 0.65, divisor ×4, cap 140 | Queue and capacity displays | Q29: duration is case by case; no values | Technical choice |
| Wait estimate (M21, server) | `AnalyticsService.php:267` (`active queue × 15`) | Branch performance "estimated wait" | None | Technical choice |
| Follow-up "7 days", "6 months" | `src/data.js:200–201`; campaign `camp1` | Demo follow-up rows and a campaign draft | None | Demo data, never a clinic rule |
| Patient booking window; start grids | CONTRACTS §6; `SchedulingService.php:31–33` (60 / 30 minutes) | M6 | Q28/Q29 give inputs, not the window | Project decision (frozen contract) |
| 5-minute arrival skew | `src/safeguards.js:29` | Clock tolerance | None | Technical choice |
| Date-range caps 184 days; list window 90 days back / 93 ahead; paging 100 | controllers; `src/appointments-api.js:29–30` | Query bounds | None | Technical choice |
| Rate limits: M1 login 5/min, registration 30/min; M7 6/min, 60/hr; M17 20/min, 200/hr; M26 5/min, 30/hr; M22 denial writes 5/60 s | configs and providers | Abuse bounds | None | Technical choices, "not clinic policy" (each report) |
| OTP: 10-minute expiry, 5 attempts, resend limits | `RegisteredPatientController.php:61`; `EmailVerificationController.php:107`; M1 §6–8 | Verification | OPERATING_MODE §3: OTP policy not provided | Technical choice |
| Upload 10 MB; inflation cap 5 MB | `DocumentStorageService.php:38`; `TextExtractionService.php:21` | M14 | None | Technical choice |

Observation, not a finding: M10 (client) and M21 (server) use different estimators for a branch's estimated wait, so the same branch can show different numbers in the two views. This was read, not executed; settle it when M10 and M21 are done (DQ-74, PI-24).

### 7.4 R4 — administrative follow-up or clinical decision?

**What the code shows (source inspection):**

- The `followup_required` and `prescription_required` flags are Treatment fields entered in the Dentist's documentation and read as recorded facts (`DocumentTreatmentRequest.php:27–28`; `TreatmentResource.php:77`; M5 §23–25; `src/treatments-api.js:63`).
- The **current frontend** adapter creates an Open follow-up task only when that flag is true on a completed server Treatment (`src/workflow.js:172`); a prescription only logs "Dentist authorization required" when `prescriptionRequired` is true (`workflow.js:177`). Nothing is scheduled or prescribed; Staff schedule through M6.
- The **backend R4 rule** takes `followup_required` / `prescription_required` from whatever payload the caller supplies, and today the only caller is the Owner's manual dispatch (`AutomationController::dispatch`), which accepts an arbitrary payload array.

**What this does and does not establish.** Current frontend behaviour depends on a Dentist-documented flag. That is **not** a secure, Dentist-authorized clinical follow-up command: the backend does not check that a follow-up event originates from a Dentist's recorded decision, and no existing code proves it does. R4 therefore creates no obligation today (it only writes text), but a future emitter or a manual payload could present a non-Dentist-origin follow-up as if it were established. **Classification:** a domain-authority guard requirement for the M20 and M23 passes — any follow-up task must be created by a command that verifies a Dentist-recorded follow-up on the same Treatment, never from a caller-supplied payload, a rule or a recall list. The word "Recall" in R4's text blurs M20 follow-up with recall, and the unconditional "Draft invoice created" is a separate honesty finding (E-4). Not fixed here.

### 7.5 What is missing for M23

No rule has clinic authority for its number or timing. The authority questions are PI-24, PI-25, PI-32 to PI-37, PI-28 and DQ-86; the background infrastructure is TD-24.

## 8. Dependency map

```
M3 Dentist & Staff Management (workforce authority)
   ├─► M1  privileged provisioning: Person/profile linkage, activation, branch-scope assignment, last-Owner protection
   │        └─► TD-21 identity-bridge replacement
   ├─► M6  Dentist/service eligibility, assignment, availability, absence handling
   ├─► M10 workforce availability (M10 consumes; never owns identity)
   └─► M19 Dentist professional/credential data (CONTRACTS §4)

M15 Clinic Policy & Operational Configuration (typed, validated, effective-dated, branch-scoped, versioned)
   ├─► M6  cancellation/reschedule cutoffs, override authority (PI-18, PI-19, PI-22)
   ├─► M8  earliest check-in, late/no-show (PI-20, PI-21)
   ├─► M10 busy definition, thresholds (PI-24..26)
   ├─► M18 reminder timing, contact hours (PI-31, DQ-59)
   ├─► M23 numeric thresholds (PI-32, PI-24)
   └─► M2  hours/holidays/closures once decided (PI-14..16); M2 keeps identity only

M17 conversation creation + routing (PI-45, PI-46)  ──► M16 inquiry→conversation handoff
M17 + M18 ──► M20 reminders;  M17 ──► M26 service recovery;  M7 ──► M17 handoff
M18 delivery (TD-18, TD-24) is needed only for external channels; in-app delivery stands alone

M14 documents ──► M19 paper/scanned prescription draft (OCR draft-only, TD-15) ──► Dentist authorization
M14 ──► M12 HMO document drafts ──► Staff confirmation

M24 / M25 (PE) require PI-59 / PI-60 = yes first; M25 also needs M18 consent/opt-out and M15 targeting

Finalized domain sources (M5, M11, M12, M13, M14, M16, M17, M19, M20, M26) ──► M21 (read layer; last)
```

| To unlock | Blocking decisions | Can proceed under existing policy |
| --- | --- | --- |
| M3 | PI-05–PI-13 (and PI-09 titles) | Foundations with no policy value (profile linkage without activation) |
| M1 provisioning | PI-01–PI-04 plus M3 | The commands and tests skeleton, disabled |
| M15 | PI-14–PI-28 | The configuration container (typed, validated, effective-dated, audited), with today's values labelled unconfirmed |
| M10 | PI-24–PI-27, PI-06–PI-08, PI-13, PI-26 | Aggregate calculation from existing queue and availability data |
| M18 | PI-29–PI-31, DQ-59–DQ-63, TD-18, TD-24 | In-app transactional records for events already implemented |
| M19 | PI-38, PI-39, PI-10, PI-11, DQ-64–DQ-68, TD-13 | The existing Dentist-entered draft and explicit authorization |
| M20 | PI-40, PI-41, DQ-69–DQ-73 | Dentist decision → Open task → Staff schedule through M6 |
| M23 | PI-24, PI-25, PI-32–PI-37, PI-28, DQ-86, TD-24 | The rule registry, event ledger and audit, with unconfirmed values labelled |

## 9. Hardened-module revisit map

Each row: the decisions that reopen the module → what fails closed or stays a technical boundary today → what becomes buildable after the answer. Order within a return pass follows section 10.

| Module | Decisions | Fails closed / technical boundary today | Unlocked after the answer |
| --- | --- | --- | --- |
| M1 | PI-01–PI-04, PI-09, TD-21, TD-04 | Owner creates Patients only; no Staff/Dentist/Owner provisioning, invitation, activation or default password; demo-bound identity bridge; suspend/restore Owner-only | Privileged provisioning with unique Person/profile linkage, activation and recovery policy, branch-scope assignment, extended last-Owner protection; server-issued profile projection |
| M2 | PI-14–PI-17, PI-05, PI-26, TD-06, TD-20, DQ-01 | Operating hours labelled unconfirmed; no closure/holiday data; Owner-only updates; no public M2 endpoint; Check-In does not re-check branch status | Real branch bootstrap; weekday hours; closure calendar; closure effects on bookings/Visits; delegation; truthful public projection |
| M4 | PI-48–PI-53, PI-27, DQ-02–DQ-05 | Owner at identity tier; Dentist generic access 403; just-registered walk-in identity-only; no clinical history model; no import; duplicates other than exact email allowed | Owner/Dentist/Staff access tiers; clinical history model and correction; import; duplicate and merge rules |
| M5 | PI-48, PI-53, PI-54, DQ-06–DQ-11, DQ-08 | Completed Treatment read-only; only the responsible Dentist authors; Staff read the clinical record; only a summary and one line required | Amendment with retained original; mandatory fields; takeover; note visibility; tooth numbers; plan vs performed |
| M7 | DQ-12–DQ-17, DQ-37, DQ-83, PI-45, PI-46, TD-11, TD-12 | Navigation knowledge only; hours, prices, instructions and branches refused whole; no Patient context; handoff only points to Messages | Approved knowledge and owner; instruction texts; handoff into M17; quality review; live provider enablement |
| M11 | PI-55, DQ-18–DQ-29, TD-07–TD-10, TD-02 | Full payment only; no void/refund/discount/tax/deposit; Owner read-only; record-only reconciliation; online payment needs credentials | Zero-fee settlement; partial/split; refunds and voids; discounts and tax; reprint; reconciliation workflow; online enablement |
| M13 | PI-56–PI-58, DQ-30–DQ-37, TD-19 | No confirmed price for any service; no catalog create/edit/retire; Owner-only price versions; no patient price display; no packages; Services exposed by `legacy_ref` | Confirmed prices and durations (including X-ray); catalog authority; approval flow; price display; packages; Service `public_id` |
| M14 | PI-48–PI-52, DQ-38–DQ-46, TD-15–TD-17 | Acknowledgement-level consents only; retract only; no scanning/OCR/review; Owner and Dentist consent access closed | Consent templates and signatures; guardian flow; retention/archival; extraction review; scanning |
| M16 | PI-42–PI-44, DQ-47–DQ-52, TD-18 | Manual Staff capture; assigned-recorder visibility; no SLA/escalation; no handoff; Owner/Dentist denied | Official channels; routing/reassignment; SLA and escalation; handoff to M17; integration if chosen |
| M17 | PI-45–PI-47, DQ-53–DQ-58, DQ-82 | No creation command (empty state); participant-and-branch visibility; Staff/Dentist close; no reopen; no attachments | Conversation creation and routing; Dentist/Owner roles; reopening; attachments; external channels |
| M22 | DQ-76–DQ-81, TD-05, TD-23 | Owner-only; no read audit; no alerts; no retention; module-local histories not unified | Read auditing; retention/archival; alerts; export/visibility rules; unified coverage |
| M26 | DQ-84, DQ-87–DQ-101, PI-45, PI-46 | Patient-only immutable text; no reviewer, rating, category, status, reply or aggregate | Reviewer access; rating/category; statuses and Action Required; service recovery; correction; M21 aggregates |

## 10. Recommended post-interview order

**Order preserved:** 1 M3 → 2 M1 privileged-provisioning return pass → 3 M15 → 4 M10 → 5 M18 → 6 M19 → 7 M20 → 8 M23 → 9 M24 if approved → 10 M25 if approved → 11 return passes → 12 M21 last.

Why the full evidence still supports it:

- **M3 first:** it is the only source of workforce identity, availability and credentials; M1 provisioning (it needs a profile to link), M10 (availability), M6 (eligibility) and M19 (credentials) all read it. Nothing in the complete sources reverses this.
- **M1 provisioning second:** it requires M3 profiles and PI-01–PI-04; it is the sole path to real Staff, Dentist and Owner accounts.
- **M15 third:** it supplies the typed, effective-dated values (cutoffs, thresholds, reminder timing) that M10, M18 and M23 would otherwise hard-code. If most of PI-18–PI-26 are answered "No formal policy", M15 shrinks to a small container and M10/M18 can start sooner — re-evaluate after the interview.
- **M10 before M18:** Q32's pre-treatment wait updates need M10's estimates and the PI-24 definition.
- **M18 before M19/M20:** M20 reminders and M19 copy delivery consume M18; in-app delivery needs no provider.
- **M19 and M20 are independent** of each other; each needs M3 and M18.
- **M23 after M20:** it executes handoffs between finalized sources; its rules need PI-32–PI-37 and the M12/M10/M18/M20 outputs. The M23 return pass also owns the fixes for E-4 and E-5.
- **M24/M25 never block core care** and wait for PI-59/PI-60.
- **M21 last:** it aggregates only finalized sources; its E-1–E-3 fixes belong to its own pass.

**One sequencing refinement inside step 11 (not a reordering):** Q23 names HMO contacting and online messaging as the clinic's top automation target. Within the return passes, take the **M17/M16 handoff and creation pass** (PI-42–PI-47) and the **M12 HMO follow-up pass** (PI-32–PI-36, with M18/M23) first, ahead of the M4/M5/M11/M13/M14/M22/M26 returns, because those are the clinic's stated priority and none of the others is on M21's critical path. M12 is outside the twelve hardened modules but is the home of the HMO lifecycle.

## 11. Engineering defects requiring separate review

Not fixed here. A finding is ENGINEERING only if it is wrong regardless of clinic policy. This replaces the first draft's statement that no defect was found.

**No defect was identified in the twelve checkpointed modules (M1, M2, M4, M5, M7, M11, M13, M14, M16, M17, M22, M26) by this read-only inspection.** Five findings sit in M21 and M23, which are not yet hardened. Each is a **finding from source inspection, pending targeted runtime verification** (a request or test that reproduces it) before remediation; E-2 and E-3 are contract violations visible directly in the source, while E-1, E-4 and E-5 should be reproduced first. They are kept as five separate engineering review items and are deferred to the M21 and M23 technical passes.

| ID | Module | Finding | Evidence | Why it is wrong regardless of policy | Suggested pass |
| --- | --- | --- | --- | --- | --- |
| E-1 | M21 | The branch filter is silently ignored for the legacy branch references the frontend sends | `AnalyticsController.php:28–30,61–63` casts `branch_id` with `(int)`; "b1" becomes 0, which is falsy, so `if ($branchId)` in `AnalyticsService.php:101,121,141,150,162,178` skips the filter. M2 §Database also records the mismatch | A report presented as branch-filtered shows all branches | M21 |
| E-2 | M21 | Internal bigint branch ids are returned | `AnalyticsService.php:193,270` (`'branch_id' => $branchId / $b->id`) | CONTRACTS §1: internal bigint keys are never exposed | M21 |
| E-3 | M21 | Money is summed and rounded as floating point | `AnalyticsService.php:112–115,174,255,275` (`(float)` sums, `round()`) | CONTRACTS §2: financial arithmetic never uses floating point | M21 |
| E-4 | M23 | Rule results assert actions that nothing performs: "Draft invoice created" (always, R4), "follow-up task staged" (R2), "routed to … inbox" (R5), "account synchronised" (R6), "calendar reservation and notification dispatch staged" (R1); R3's written condition includes "branch load" but only wait time is evaluated; R4 text says "Recall / follow-up" for a follow-up | `WorkflowAutomationService.php:143–232`; the seed `condition_description`/`action_description` | Success/Warning rows and M22 events state work that did not happen (honest-UI rule, CLAUDE.md "do not fabricate workflow statuses") | M23 |
| E-5 | M21, M23 | "No data" is shown as 100%: automation health defaults to 100 with zero actions, appointment completion rate to 100 with no terminal appointments | `WorkflowAutomationService.php:262`; `AnalyticsService.php:137,188`; `src/pages/Admin.jsx:463` | Unavailable must never be shown as a success value | M21, M23 |

Documentation, not code: the registry marks M23 `implemented: true` ("automated actions") while `MODULE_COVERAGE.md` says "Implemented frontend … no … background worker" and the code only records events and runs Owner-dispatched evaluations (section 13, item 2). Correct the wording in the M23 pass.

Not engineering defects (policy or provenance): the 12-hour, 35-minute, 24-hour and 80/80/75 values; the two wait estimators; the three independent code constants carrying the 12-hour value. Known, already documented limitations carried unchanged: TD-10, TD-23.

## 12. Human-judgment defaults

If the clinic answers **"No formal policy — keep human judgment"**, the system must: not fabricate automation; not fabricate thresholds; keep the human decision point; and implement only enough support to **record and execute** the human decision. It must say that an item needs staff judgement rather than show a computed or invented value.

| Area | The system supports | The system must not |
| --- | --- | --- |
| Clinical follow-up (PI-40, PI-41, DQ-70–DQ-73) | A Dentist-recorded follow-up decision creating an Open task that Staff schedule through M6 | Create a follow-up from a rule, an interval or a recall list; treat a recall interval as a clinical decision |
| Replacement staffing (PI-07, PI-08) | Recording a Dentist as unavailable | Auto-assign a replacement, auto-rebook, or enforce "two Dentists" |
| Capacity overrides and "too busy" (PI-24, PI-25) | Showing waiting information; Staff action recorded | Raise numeric alerts or redirect patients automatically |
| HMO escalation (PI-32, PI-36) | Showing elapsed time; Staff recording contacts and escalation | Label cases "overdue"/"escalate" from an unconfirmed number; present Escalated as an outcome |
| Feedback service recovery (DQ-93–DQ-98) | Storing the Patient's feedback as an immutable record | Assign reviewers, statuses or replies; expose feedback to any role |
| Prescription correction (PI-39) | Keeping an authorized prescription unchanged | Edit, reissue or restore a draft |
| Late arrival and no-show (PI-21) | A manual Staff No-show before arrival | Mark a no-show by timer |
| Staff override (PI-22) | Nothing | Any override capability |
| Completed-treatment amendment (PI-54) | Read-only completed records | Reopen or edit |
| Conversation reopening (PI-47) | Closed is final; a new conversation is started | Reopen |
| Zero-fee invoice (PI-55) | Leaving it open for staff review | Fabricate a payment to mark it Paid |
| Reminders and notifications (PI-29–PI-31) | In-app records for implemented events | Claim SMS/email delivery or any reminder timing as clinic policy |

## 13. Source and reconciliation notes

### 13.1 Counts

| Measure | Count |
| --- | --- |
| Questions in the first draft | 134 (132 distinct: draft A-01 and A-02 repeated H-01 and S-10/S-11) |
| Primary follow-up interview (PI-01–PI-60) | 60 (23 PARTIALLY ANSWERED, 37 UNRESOLVED) |
| Deferred / module-specific (DQ-01–DQ-112) | 112 (13 PARTIALLY ANSWERED, 99 UNRESOLVED); 11 of them (DQ-102–DQ-112) are conditional on the M24/M25 gates |
| **Distinct clinic decisions** | **172** (60 + 112) |
| Team / deployment / integration decisions (TD-01–TD-24) | 24 — **separate from, and not counted inside, the 172** (not for the clinic) |
| Old draft questions removed because already answered | 6 (P-05, C-07, C-08, C-11, S-06, S-13) |
| Old draft questions moved to TEAM | 8 (P-12, R-14, C-13, B-17, N-03, I-02, I-16, K-05) |
| Old draft questions merged as duplicates | 6 (P-04, S-12, B-12, A-01, A-02, A-05) |
| Old draft questions carried forward (kept, narrowed or split) | 114 |
| New decisions added from fully read sources | 37 (PI 10 + DQ 27) |
| Items narrowed by an interview or contract fact (status PARTIALLY ANSWERED) | 36 (23 PI + 13 DQ) |

The distinct-decision count rose from 134 because compound draft questions were split to one decision each, and because the full sources contained decisions the excerpts had hidden. The **primary interview is 60 short questions for three respondent types (Owner, receptionist, Dentist)**, not a single sitting; sections 4.1–4.10 can be taken as separate sessions.

### 13.2 Removed because already answered

| ID | Old question | Settled by |
| --- | --- | --- |
| AN-01 | Which roles the system uses (draft P-05) | CONTRACTS §1 (exactly Patient, Staff, Dentist, Owner; titles are labels); Q4, Q27. The residual — what an assistant may do — is PI-09 |
| AN-02 | Whether completion creates follow-up automatically (draft C-07) | `CLAUDE.md` "Clinical follow-up decision belongs to the Dentist"; M5 §39.9 (today: no) |
| AN-03 | Who may issue a prescription (draft C-08) | `CLAUDE.md` Prescription; CONTRACTS §10 (explicit Dentist authorization). Credentials are PI-10 |
| AN-04 | Whether the clinic still uses paper prescriptions (draft C-11) | Q16. The residual — how it is produced and handed over — is PI-38 |
| AN-05 | How far ahead patients may book (draft S-06) | CONTRACTS §6 frozen window (project decision; M15 may later make it configurable, no clinic question needed) |
| AN-06 | Whether patients should see wait-time information (draft S-13) | Q19, Q21, Q32 (direction is wanted). What to tell them is PI-29 |

Also settled and therefore never asked: who handles booking, check-in, billing and follow-up (Q27); what a booking needs (Q28); that records are centralized across branches (Q18); that Patient identity is one record across branches (M4); that Owner oversight is not a clinical role (DOC_RECON).

### 13.3 Draft-to-final mapping (all 134)

**Personnel/branch (P):** P-01→PI-01 · P-02→PI-02 · P-03→PI-03 · P-04→merged PI-01 · P-05→AN-01 · P-06→PI-05 · P-07→PI-10, PI-11 · P-08→PI-06 · P-09→PI-12 · P-10→PI-07, PI-08 · P-11→PI-17 · P-12→TD-06 · P-13→PI-14 · P-14→PI-15, PI-16.

**Records/privacy (R):** R-01→DQ-02 · R-02→PI-53, DQ-03 · R-03→PI-48 · R-04→PI-49 · R-05→PI-50 · R-06→DQ-04, DQ-05 · R-07→DQ-77 · R-08→PI-52 and DQ-81–DQ-85 · R-09→DQ-38 · R-10→DQ-39 · R-11→DQ-40 · R-12→DQ-42 · R-13→DQ-44 · R-14→TD-16 · R-15→DQ-76, DQ-78 · R-16→DQ-81 · R-17→DQ-80 · R-18→DQ-79.

**Clinical (C):** C-01→DQ-06 · C-02→PI-54 · C-03→DQ-07 · C-04→DQ-08 (Owner part in PI-48) · C-05→DQ-09, DQ-10 · C-06→DQ-11 · C-07→AN-02 · C-08→AN-03 · C-09→PI-39 · C-10→DQ-64 · C-11→AN-04 · C-12→DQ-67, DQ-45 · C-13→TD-15 · C-14→PI-41, DQ-70 · C-15→DQ-71 · C-16→DQ-72.

**Scheduling (S):** S-01→PI-18 · S-02→PI-19 · S-03→PI-20 · S-04→PI-21 · S-05→PI-22 · S-06→AN-05 · S-07→PI-23 · S-08→PI-28 · S-09→PI-26 · S-10→PI-24 · S-11→PI-25 · S-12→merged PI-25 · S-13→AN-06.

**Billing/pricing (B):** B-01→DQ-18 · B-02→DQ-19 · B-03→DQ-21 · B-04→DQ-22 · B-05→DQ-23 · B-06→DQ-24 · B-07→DQ-25 · B-08→PI-55 · B-09→DQ-26 · B-10→DQ-27 · B-11→DQ-30, DQ-31 · B-12→merged DQ-31 · B-13→DQ-32, DQ-33 · B-14→DQ-34 · B-15→DQ-36 · B-16→DQ-37 · B-17→TD-08 (the product question became DQ-20).

**HMO (H):** H-01→PI-32 · H-02→PI-33 · H-03→PI-35 · H-04→PI-36.

**Notifications (N):** N-01→PI-29 · N-02→PI-30 · N-03→TD-18 · N-04→PI-31 · N-05→DQ-59 · N-06→DQ-61 · N-07→DQ-60 · N-08→DQ-62 · N-09→DQ-63 · N-10→DQ-85.

**Messaging/assistant (I):** I-01→PI-42 · I-02→TD-18 · I-03→PI-43, PI-46 · I-04→DQ-47 · I-05→PI-44, DQ-52 · I-06→DQ-48 · I-07→PI-45 · I-08→DQ-53, DQ-54 · I-09→PI-47 · I-10→DQ-55, DQ-56 · I-11→DQ-82 · I-12→DQ-12 · I-13→DQ-15 · I-14→DQ-14 (pricing part in DQ-37) · I-15→DQ-16, DQ-83 · I-16→TD-11, TD-12.

**Feedback (F):** F-01→DQ-87, DQ-88 · F-02→DQ-90, DQ-91 · F-03→DQ-93, DQ-94, DQ-95 · F-04→DQ-96 · F-05→DQ-98 · F-06→DQ-97 · F-07→DQ-100 · F-08→DQ-84 · F-09→DQ-101 · F-10→DQ-75.

**Automation (A):** A-01→merged PI-32 · A-02→merged PI-24, PI-25 · A-03→PI-37 · A-04→DQ-86 · A-05→merged PI-28.

**Loyalty/marketing (L, K):** L-01→PI-59 · L-02→DQ-102 · L-03→DQ-103 · L-04→DQ-106 · L-05→DQ-107 · K-01→PI-60 · K-02→DQ-108 · K-03→DQ-109 · K-04→DQ-110 · K-05→TD-18 · K-06→DQ-112.

### 13.4 Decisions deduplicated by decision, not by module

One question now serves every module it affects: operating hours (PI-14, once, for M2/M6/M8/M15/M7/M18); busy definition and alerts (PI-24/PI-25, replacing the M10, M23 and M18 copies); HMO timing (PI-32, replacing H-01 and A-01); settings governance (PI-28, replacing the M15 and M23 copies); price authority (DQ-31, replacing two draft items); price display to patients (DQ-37, replacing the M13 and M7 copies); conversation close/reopen (PI-47, replacing I-09 and P8); retention is one decision **per data type** (PI-52, DQ-81–DQ-85), not per module; reviewer/visibility questions are one per audience (DQ-93–DQ-95).

### 13.5 New decisions added from fully read sources

- **Interview-derived (Q1–Q32):** PI-04 (Q31), PI-13 (Q15 and OPERATING_MODE §3), PI-27 (Q7 vs Q8), PI-34 (Q23), PI-38 (Q16), PI-40 (Q15/Q27), PI-51 (Q17/Q18), PI-56, PI-57, PI-58 (Q1, Q12, OPERATING_MODE §8), DQ-74 (Q32).
- **From previously truncated report sections:** M7 — DQ-13, DQ-17; M11 — DQ-28, DQ-29; M13 — DQ-35; M16 — DQ-49, DQ-50, DQ-51; M17 — DQ-57, DQ-58; M26 — DQ-89, DQ-92, DQ-99.
- **From the canonical documents:** DQ-01 (M2 demo phones), DQ-20 (OPERATING_MODE §3: no online-payment policy), DQ-41, DQ-43, DQ-46 (M14), DQ-65, DQ-66, DQ-68 (CONTRACTS §10–11), DQ-69, DQ-73 (CONTRACTS follow-up), DQ-104, DQ-105 (OPERATING_MODE §9), DQ-111 (M25).

### 13.6 Documentation conflicts and stale wording found (reported, not edited)

1. **Follow-up self-scheduling:** `MODULE_COVERAGE.md` M6 says Patients do not self-schedule clinical follow-ups (an approved transitional rule); M20 and `CLAUDE_OPERATING_MODE.md` §5 allow a Patient to schedule a Dentist-requested follow-up. Recorded as DQ-72; canonical precedence favours the M6 transitional rule until M20 is hardened.
2. **M23 status:** the registry says `implemented: true` ("automated actions"); `MODULE_COVERAGE.md` says "Implemented frontend … no … background worker"; the code records events and runs Owner-dispatched evaluations only (section 7.1).
3. **Module count in older headers:** `ERD_ALIGNMENT.md` line 3 still says "canonical 25-module structure" and `CLINIC_INTERVIEW_QA.md` line 5 says "canonical modules are M1–M25"; the canonical count is 26.
4. **"Approved" M24 direction:** `CLAUDE_OPERATING_MODE.md` §9 calls the 10% referral discount an "approved direction" while §4 says M24 is not client-requested. It is treated here as a team design direction, not a clinic statement (PI-59, DQ-102–DQ-107).
5. **Protected ERD wording:** the data dictionary's "PE feedback record" row is historical (already recorded in `ERD_ALIGNMENT.md`); changing it needs explicit approval (TD-22).

### 13.7 Limits of this revision

Findings in section 11 and the provenance in section 7 come from reading code; none was executed. Test and build suites were not rerun because no executable file changed. The `.docx` process document and the ERD data dictionary were not opened. Question wording is a proposal for the interviewer, not a script to be read aloud with example values.
