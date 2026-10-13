# Module Identity Transition Map

Updated October 12, 2026. Version 5.0. Finalized planning scope.

The agreed planning catalog contains 25 numbered modules, with five primary assignments per member. Scope and assignments are finalized for documentation. Implementation evidence and clinic-specific policy remain separate; this revision does not certify a working production system.

Roles are exactly Patient, Staff, Dentist and Owner. The stack remains React/Vite, Laravel 13, PostgreSQL and Sanctum. New development excludes HMO, inventory, a generic workflow-automation engine, rewards and marketing campaigns. PayMongo belongs to M23 Payment Management; email delivery to M18; informational AI to M7.

## Mapping

| Existing identity or earlier proposal | Final planning ownership |
| --- | --- |
| Historical M1 and M3 personnel | M1 accounts/personnel; M3 dated Staff/Dentist schedules; M15 leave/coverage |
| Historical M10 flow/capacity | M9 factual live queue; M21 historical reporting. New M10 charting uses a new clinical identity. |
| Historical composite M11 billing/payments | M11 planned billing and M23 planned payments share current financial safeguards until reviewed separation. |
| Historical M12 HMO and earlier attendance proposal | Legacy HMO remains legacy; attendance is M6; new M12 Treatment Plans must not reuse HMO records. |
| Historical M14 documents/consent | M14 protected file lifecycle; consent meaning stays with the authorized care workflow. |
| Historical M15 policy/configuration | M2 hours/closures and domain-owned settings; new M15 Leave Management has separate records. |
| Historical M23 automation recorder | Retain historical evaluations; no new generic executor. New M23 Payments derives from the existing M11 payment responsibility. |
| Historical M24 rewards and M25 campaigns | Excluded from new development; new M24 Lab Cases and M25 Handovers require new domain identities. |
| Historical M26 private feedback | Retain private Patient-only records and permissions; feedback is a supporting Visit feature in the new catalog, not a deleted database domain. |
| Standalone authentication, monitoring and backup proposals | Security stays with M1/cross-cutting enforcement; monitoring and tested backup/recovery remain required production operations. |

## Required transition work

Inspect the actual checkout, registry/domain keys, APIs, models, migrations, saved histories and existing tests. Record each actual identity and proposed destination before any code change. Display-number updates must not relabel historical HMO, automation, reward, campaign or feedback data. Do not infer current domain keys from names in this document.

Keep current financial locks, HMO holds, authorized clinical access, immutable care/payment evidence and four-role enforcement. Separating M11/M23 is an ownership design, not approval to split transactions or duplicate settlement authority. New Treatment Plans, Leave, Lab Cases and Handovers need distinct records and reviewed contracts. Patient/Staff/Dentist/Owner capabilities are explicit; Owner is not a clinical superuser.

Legacy M26 private feedback stays retained and Patient-only. Folding feedback into a Visit feature is presentation scope, not a migration or permission grant. Protected ERD/data-dictionary artifacts are not rewritten by this pack.

## Superseded planning names and assignments (added 2026-10-12)

The table lists the **earlier planning structure** (the 26-module list in `CLAUDE_OPERATING_MODE.md` §4 as it stood before the 25-module catalog, with its September/October 4 owners) against the final catalog. "Changed" marks a different name, owner or meaning. A **new meaning** means the number now names a different domain; records saved under the old meaning keep it (see `LEGACY_MODULE_DOMAIN`).

| No. | Earlier planning name (owner) | Final catalog name (owner) | Change |
| --- | --- | --- | --- |
| M1 | User & Access Management (Licanda) | User Management (Licanda) | Name |
| M2 | Multi-Branch Clinic Management (Licanda) | Branch Management (Licanda) | Name |
| M3 | Dentist & Staff Management (Licanda) | Work Schedules (Licanda) | Narrower: dated rosters; employee profiles move to M1 |
| M4 | Patient Records Management (Ecal) | Patient Records (Ecal) | Name |
| M5 | Treatment & Clinical Workflow Management (Ecal) | Treatment Management (Ecal) | Name |
| M6 | Appointment Booking & Smart Scheduling Management (Alejo) | Appointment Management (Alejo) | Name; attendance responses added |
| M7 | Patient AI Support & Clinic Knowledge Management (Alejo) | AI Chatbot (Delos Santos) | Name and **owner** |
| M8 | Patient Arrival & Check-In Management (Alejo) | Patient Visits (Alejo) | Name |
| M9 | Patient Queue Management (Alejo) | Patient Queue (Alejo) | Name |
| M10 | Patient Flow, Capacity & Wait-Time Management (Alejo) | Dental Charts (Ecal) | **New meaning and owner** |
| M11 | Billing, Payment & Receipt Management (Ecal) | Billing Management (Delos Santos) | Name and **owner**; payments planned under M23 |
| M12 | HMO Case, Coverage & Follow-Up Management (Delos Santos) | Treatment Plans (Alejo) | **New meaning and owner**; HMO is legacy |
| M13 | Service, Procedure & Pricing Management (Licanda) | Services and Pricing (Licanda) | Name |
| M14 | Patient Forms, Documents & Consent Management (Delos Santos) | Document Management (Millar) | Name and **owner**; consent stays with the care workflow |
| M15 | Clinic Policy & Operational Configuration Management (Licanda) | Leave Management (Licanda) | **New meaning** |
| M16 | Social Media & External Inquiry Management (Millar) | Patient Inquiries (Millar) | Name |
| M17 | Unified Patient Messaging Management (Millar) | Patient Messaging (Millar) | Name |
| M18 | Transactional Notification & Reminder Management (Millar) | Notifications (Millar) | Name |
| M19 | Digital Prescription Management (Ecal) | Prescriptions (Ecal) | Name |
| M20 | Clinical Follow-Up & Recall Management (Ecal) | Patient Follow-Up (Alejo) | Name and **owner** |
| M21 | Operational Analytics & Executive Intelligence (Delos Santos) | Reports and Analytics (Delos Santos) | Name |
| M22 | Audit Trail & Activity Monitoring Management (Delos Santos) | Audit Logs (Delos Santos) | Name |
| M23 | Workflow Automation & Exception Management (Delos Santos) | Payment Management (Delos Santos) | **New meaning**; the automation recorder is retained historically |
| M24 | Referral & Loyalty Management, Proposed Enhancement (Millar) | Lab Cases (Millar) | **New meaning**; rewards excluded |
| M25 | Marketing Campaign & Patient Reactivation Management, Proposed Enhancement (Millar) | Patient Handovers (Ecal) | **New meaning and owner**; campaigns excluded |
| M26 | Patient Feedback & Service Quality Management, Group 3 shared (no member owner) | not a numbered module | Retained as a private Patient-only supporting Visit feature |

Earlier counts ("26 modules", "no M27+", "five primary modules per member for M1–M25 plus a shared M26") and earlier assignments are superseded by 25 modules and five assignments per member (M1/M2/M3/M13/M15 Licanda; M6/M8/M9/M12/M20 Alejo; M4/M5/M10/M19/M25 Ecal; M7/M11/M21/M22/M23 Delos Santos; M14/M16/M17/M18/M24 Millar). Checked against `MODULE_CATALOG.json`, `MODULE_COVERAGE.md` and the blueprint headings: 25 of 25 titles and owners agree.

### Which parts of each guidance document are superseded

| Document | Superseded (planning names, numbers, owners, counts only) | Still operative |
| --- | --- | --- |
| `CLAUDE.md` | "Canonical module architecture" (the 26-module list, the M24/M25 paragraph, the M26 paragraph, "no M27+") and the M-number labels inside it | Core workflow semantics (treatment, prescription, billing, follow-up, HMO, communications, accounts), canonical relationships, Phase 3.5 safeguards, persistence safety, unresolved policies, branding, UI, accessibility, testing, Git safety, backend boundary |
| `AGENTS.md` | The "canonical 26-module structure" bullet and the M24/M25 Proposed-Enhancement bullet under Core business rules | Every other business rule, architecture rule and quality gate; the deterministic-scheduling, one-HMO-lifecycle and OCR-is-a-draft rules keep their meaning under their runtime identities |
| `CLAUDE_OPERATING_MODE.md` | §4 (module table, owners, M24/M25/M26 paragraphs and the "26 modules" count) and the module framing of §9 | §1–§3 (evidence labels, interview boundaries), §5–§8 (roles, booking rules, honest UI, seed data), §10 (stop conditions); §9's "do not invent stacking/eligibility/reuse" rules |
| `ERD_ALIGNMENT.md` | Its module-number column and "canonical 25/26-module" headings, read as historical runtime numbering | The ERD-to-frontend/backend mappings and the protected-ERD rules |
| `docs/architecture/CONTRACTS.md` | Module numbers in section titles (for example "M12 HMO", "M19 Prescriptions", "M18 Delivery") are the **historical runtime identities** | All contracts, state machines and the dependency graph, unchanged |
| `docs/FOLLOW_UP_INTERVIEW_AND_POLICY_DEPENDENCY_MAP.md` | None of its identifiers; its module references are historical (section 3E) | All PI/DQ/TD identifiers and statuses |

## Source-verified runtime key to planning module mapping (added 2026-10-12)

Verified on 2026-10-12 against `src/module-map.js` (`DOMAIN_MODULE`, `LEGACY_MODULE_DOMAIN`), `backend/app/Models`, `backend/database/migrations` and `backend/routes/api.php` at the checked-out commit (`da86ef9` plus uncommitted documentation). **`src/module-map.js` and `LEGACY_MODULE_DOMAIN` were not changed.** "Backing" is what exists on the server today.

| Runtime key | Runtime number today | Backing today | Planned destination |
| --- | --- | --- | --- |
| `identity` | 1 | `users`, `persons`, session `auth_version`, `user_branch_scopes` | M1 |
| `branch` | 2 | `branches` (open/close time, status; no calendar or closures) | M2 |
| `personnel` | 3 | `staff_profiles`, `dentist_profiles`, `dentist_branches`, `dentist_service_assignments` (flat shift/availability fields) | M1 employee profile; M3 dated roster (not built); leave to M15 (not built) |
| `patient` | 4 | `patients` on `persons` | M4 |
| `treatment` | 5 | `treatments`, procedure lines, append-only history | M5 |
| `appointment` | 6 | `appointments`, history, command keys | M6; attendance responses not built |
| `assistant` | 7 | Stateless server adapter, no table | M7 |
| `checkin` | 8 | `visits`, history | M8 |
| `queue` | 9 | `queue_entries`, `dentist_queues`, history | M9 |
| `capacity` | 10 | No backend table; client estimators in `src/logic.js` | Live counts to M9, historical reporting to M21; the estimators are unapproved |
| `billing` | 11 | `invoices`, lines, `payments`, `receipts`, checkout sessions, provider events | M11 charges and planned M23 payments; **not split** — one transactional authority |
| `hmo` | 12 | `hmo_cases`, memberships, case events | Legacy; excluded from new work; **not** Treatment Plans |
| `service` | 13 | `services`, `branch_services`, `service_prices` | M13 |
| `document` | 14 | `documents`, `document_extractions`, `patient_consents` | M14 file lifecycle; consent meaning stays with the authorised care workflow |
| `configuration` | 15 | No table; settings are code constants | M2 hours and domain-owned settings; new M15 Leave is a separate domain |
| `inquiry` | 16 | `inquiries`, history | M16 |
| `messaging` | 17 | `conversations`, participants, messages | M17 |
| `notification` | 18 | **No backend table**; browser-local collection; four synchronous mailables | M18 (server-side intent/dispatch/attempt records not built) |
| `prescription` | 19 | **No backend table or route**; browser-local; server holds only `prescription_required` on `treatments` | M19 (server record not built) |
| `followup` | 20 | **No backend table or route**; browser-local; server holds the follow-up fields on `treatments` | M20 (server obligation not built) |
| `analytics` | 21 | Read layer, no table | M21 |
| `audit` | 22 | `audit_logs` | M22 |
| `automation` | 23 | `workflow_rules`, `system_events`, `automated_actions` (evaluation recorder) | Retained historically; **not** Payment Management |
| `loyalty` | 24 | Browser-local only, no table | Excluded legacy; **not** Lab Cases |
| `campaign` | 25 | Browser-local only, no table | Excluded legacy; **not** Patient Handovers |
| `feedback` | 26 | `patient_feedback` | Retained private Patient-only record; supporting Visit feature |

Compound handoff keys such as `treatment→billing` keep reading each side through this table. **Planned domains with no runtime key yet:** dental chart (M10), treatment plan (M12), leave (M15), payment (M23), lab case (M24), handover (M25). No key name is proposed here; do not infer one. Before any display renumbering: `eventModuleLabel` and `ruleTargetLabel` render module numbers from `DOMAIN_MODULE`, and pre-restructure records are read through `LEGACY_MODULE_DOMAIN`, so changing a number silently relabels stored events; tests in `tests/module-map.test.js`, `tests/m26-feedback.test.js` and the registry-metadata tests assert the current structure and must change in the same reviewed step.
