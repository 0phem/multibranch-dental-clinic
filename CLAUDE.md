# Dr. Dana E. Roxas Dental Clinic — Claude Code Instructions

## Canonical authority

`AGENTS.md` is the canonical engineering instruction source for this repository.

Always read and follow `AGENTS.md` before substantive work.

Always read and follow `CLAUDE_OPERATING_MODE.md` before substantive work. It supplements `AGENTS.md` and this file with evidence labels, interview boundaries and Patient product rules, and applies to every agent.

Claude Code and Codex/Astra must follow the same project architecture, business rules, workflow semantics, safeguards, branding rules, phase boundaries, testing discipline, and Git discipline.

If this file appears to conflict with `AGENTS.md`, project documentation, tests, or established behavior, STOP and report the conflict rather than silently choosing one.

## Project

Project:

**Multi-Branch Dental Clinic Operation System**

Authoritative visible clinic identity:

**Dr. Dana E. Roxas**
**Dental Clinic**

Current implementation:

- React
- Vite
- frontend-local persistence
- no production backend yet

Backend implementation is a separately authorized future phase.

Do not begin backend work unless explicitly instructed.

## Required context

Before substantial work, read the files relevant to the task.

Always start with:

- `AGENTS.md`
- `README.md`

For architecture or requirement work, also inspect:

- `FRONTEND_SCOPE.md`
- `MODULE_COVERAGE.md`
- `ERD_ALIGNMENT.md`
- `DOCUMENTATION_RECONCILIATION.md`

For workflow or safeguard work, inspect:

- `PHASE1_IMPLEMENTATION_NOTES.md`
- `PHASE2_IMPLEMENTATION_NOTES.md`
- `PHASE3_IMPLEMENTATION_NOTES.md`
- `PHASE3_5_SAFEGUARDS.md`

For current UI work, inspect:

- `PHASE4A_UI_FOUNDATION.md`
- `PHASE4B_PATIENT_EXPERIENCE.md`
- `PHASE4B3_ONBOARDING_BOOKING.md`
- `BRANDING_ALIGNMENT.md`
- `.agents/skills/dentalops-production-ui/SKILL.md`

For UI tasks, follow the existing project UI skill even though it lives under `.agents/`.

Historical phase documents may preserve historical wording intentionally. Do not rewrite history merely to make old documents appear current.

## Source-of-truth order

When deciding behavior, use this order:

1. Explicit current task instructions
2. `AGENTS.md`
3. Reconciled project documentation
4. Phase safeguards and implementation notes
5. Existing tested domain behavior
6. UI presentation

`CLAUDE_OPERATING_MODE.md` supplements `AGENTS.md` and this file with evidence labels, interview boundaries and Patient product rules; read and follow it alongside them. For what the clinic actually said, `docs/process/CLINIC_INTERVIEW_QA.md` (Q1–Q32) is authoritative, and the v1.1 process document under `docs/process/` (when present) is canonical documentation for module names, owners and scope — see `CLAUDE_OPERATING_MODE.md`'s "Three kinds of truth."

Do not change approved business behavior merely because another implementation is easier.

If the ERD, documentation, tests, and implementation disagree, identify the conflict instead of silently resolving it.

## Approved module architecture

Preserve M1–M25.

Do not invent new business modules merely because technical infrastructure is added.

Important separations include:

- M8 Check-In
- M9 Queue
- M10 Wait / Capacity
- M12 HMO requirements / local preparation
- M13 HMO submission / provider response
- M14 HMO follow-up / escalation
- M17 Messages
- M18 Notifications
- M21 Analytics
- M22 Owner Dashboard
- M23 Workflow Automation

M24 and M25 are Approved Frontend Enhancements (previously recorded as Proposed Enhancements). M24 (Referral & Loyalty) is an implemented prototype whose program rules (the 50-point redemption threshold, one Pending request at a time, each request processed once, the same-day duplicate-reward check) and validation rule (whole positive points) are team-designed prototype rules for demonstration, not historical clinic policy or an established clinic program; its writes go through the shared commands in `src/loyalty.js`. M25 (Marketing & Reactivation) is approved. A limited frontend preview/demo exists today (the Engagement campaign-draft form): it sends no real campaigns and still writes through the earlier raw campaign setter, which is known technical debt. Full Staff/Owner management behavior, a safe command architecture, marketing consent, targeting, delivery and analytics are deferred to a later role phase. Neither may block core care operations.

Do not add M26+ or begin M25 management work unless explicitly authorized.

Infrastructure such as authentication, database access, APIs, caching, email, queues, audit logging, and payments does not automatically become a new business module.

## Core workflow semantics

Preserve these distinctions.

### Treatment

Clinical treatment decisions belong to the Dentist.

Completed Treatment is finalized under the currently approved policy.

Do not invent arbitrary reopening or editing behavior.

### Prescription

Prescription Draft is private.

Prescription requires explicit Dentist authorization.

Authorized Prescription is finalized under the current approved policy.

Never auto-prescribe.

### Billing

Approved flow:

Treatment completion
→ actual performed procedures
→ Draft invoice
→ Staff Review
→ Issue
→ Payment
→ Receipt

Do not create arbitrary invoices detached from this workflow.

Paid is terminal under the current frontend policy.

### Follow-up

Clinical follow-up decision belongs to the Dentist.

Operational scheduling may be performed by Staff.

Clinical decision and scheduling are different responsibilities.

### HMO

M12:
local requirements and preparation

M13:
submission and externally received provider outcome

M14:
timestamp-driven follow-up, contact, and escalation

Never collapse these meanings:

- local HMO preparation != provider approval
- Escalated != Approved
- Escalated != Rejected
- Returned may be corrected and resubmitted
- escalation must not fabricate provider outcomes

### Communications

Messages != Notifications.

Messages are participant-based two-way communication.

Notifications are identity-specific event-driven records.

Do not merge their state or unread semantics.

### Accounts

Inactive account != operationally unavailable Dentist.

Identity/account state and operational availability are separate concepts.

## Canonical relationships

Canonical IDs and relationships remain authoritative.

Preserve:

- Patient ownership
- branch scope
- Staff/Dentist assignment
- Dentist/service compatibility
- appointment relationships
- Check-In relationships
- queue relationships
- exact encounter context
- Treatment relationships
- invoice/patient/treatment relationships
- Prescription/patient/treatment/Dentist relationships
- HMO case cycles
- Message participants
- Notification recipients

Do not infer authoritative relationships from display text.

Do not silently invent missing relationships.

## Phase 3.5 safeguards

Do not weaken safeguards established in Phase 3.5.

Preserve:

- identity validation
- account/profile/role validation
- permissions
- branch scope
- stale/forged session protection
- appointment revision protection
- admitted/terminal appointment protection
- exact encounter validation
- completed Treatment protection
- stale Treatment drafts
- Prescription authorization/finalization protection
- stale Prescription drafts
- payment/receipt evidence
- Paid terminal state
- HMO cycle integrity
- provider-response evidence
- current-cycle validation
- identity-specific Notifications
- participant-specific Messages
- malformed input safety
- persistence recovery
- CSV formula-injection protection
- explicit Patient arrival selection
- shared authoritative commands

Visual components must not replace shared workflow commands with direct state mutation.

## Persistence safety

Saved Workspace Recovery is intentional protection.

Do not fix persistence problems by:

- automatically clearing localStorage
- silently replacing unreadable data
- returning empty collections
- globally weakening validation
- silently dropping malformed records
- overwriting corrupt saved data

Compatibility migrations must be:

- deterministic
- idempotent
- relationship-safe
- non-destructive where practical

Genuinely corrupt data must continue to trigger recovery.

Existing `dentalops-v4-*` storage names are compatibility identifiers.

Do not rename them merely because visible branding changed.

## Unresolved policies

Do NOT invent behavior for these unresolved clinic-policy areas:

1. Patient cancellation cutoff
2. Patient reschedule cutoff
3. earliest Check-In
4. late-arrival / No-show threshold
5. Staff override authority / reason
6. completed-Treatment amendments
7. authorized Prescription correction / reissue
8. conversation reopening
9. zero-fee invoice settlement

If implementation requires one of these, report:

`POLICY DECISION REQUIRED`

Do not guess values or permissions.

## Known limitations

### Analytics

Some analytics period filtering and branch scoping remain incomplete.

Do not fabricate filtered metrics or present unsupported filters as functional.

### Walk-ins

The frontend supports approved walk-in workflows.

The ERD still contains an appointment/Treatment modeling ambiguity for eventual backend constraints.

Do not remove walk-in support to simplify implementation.

Do not alter the ERD without explicit approval.

### Security

Frontend safeguards are not production backend security.

Do not describe client-side checks as authoritative backend authorization.

## Clinic branding

Authoritative visible identity:

**Dr. Dana E. Roxas**
**Dental Clinic**

Official assets:

`public/images/logo.png`

- current primary branding asset
- compact/symbol use
- browser path `/images/logo.png`

`public/images/logo-with-name.png`

- supplied full artwork
- preserve unchanged
- use only where explicitly approved
- browser path `/images/logo-with-name.png`

The supplied full artwork does not exactly match the authoritative application identity.

Do not edit it to make it match.

Never redraw, regenerate, destructively recolor, destructively crop, or replace either supplied asset.

Stable internal names such as:

- `dentalops-v4-*`
- `dentalops-production-ui`
- historical artifact titles

may remain for compatibility.

They are not the visible clinic identity.

## UI rules

For UI work, follow:

`.agents/skills/dentalops-production-ui/SKILL.md`

Representative widths:

- 375px
- 430px
- 768px
- 1024px
- 1440px

All roles must remain usable:

- Patient
- Staff
- Dentist
- Owner/Admin

Role priorities:

Patient:
mobile-first, calm, low cognitive load

Staff:
desktop-productivity-first, scan-friendly, high-frequency workflow support, fully responsive

Dentist:
encounter-centric, unmistakable Patient context, desktop/tablet optimized, phone usable

Owner/Admin:
analytics and oversight oriented, appropriately dense on desktop, responsive elsewhere

Responsive design means adapting information architecture rather than merely shrinking desktop layouts.

## State-driven UI

Canonical application state drives visual state.

Do not fabricate:

- workflow statuses
- metrics
- provider decisions
- clinical results
- payments
- fake asynchronous loading

Every visible control must:

- perform a real action
- navigate somewhere valid
- be legitimately disabled
- explain an unavailable state when appropriate
- or be clearly labeled Proposed/Future

Do not create decorative fake controls.

## Accessibility

Preserve or improve:

- semantic HTML
- keyboard access
- visible focus
- labels
- logical headings
- accessible dialogs
- approximately 44px touch targets where practical
- non-color-only status communication
- viewport-safe overlays
- long-content wrapping
- reduced-motion behavior

Do not remove accessibility behavior for visual convenience.

## Working method

For each task:

1. Verify Git state.
2. Read relevant context.
3. Explore existing implementation.
4. Trace authoritative state/actions.
5. Identify safeguards and affected tests.
6. Identify conflicts or assumptions.
7. Plan when work is architectural or high-risk.
8. Make the smallest coherent change.
9. Add regression tests where appropriate.
10. Run verification.
11. Review the diff.
12. Report exactly what changed.
13. Stop at the requested phase boundary.

Do not automatically continue into the next phase.

## Explore → Plan → Code

For complex work:

EXPLORE
→ understand current behavior

PLAN
→ identify implementation, risks, and decisions

REVIEW
→ obtain approval when requested

CODE
→ implement only approved scope

VERIFY
→ tests, browser QA, and diff review

REPORT
→ provide precise final state

Use Plan Mode before high-risk work including:

- backend architecture
- database/schema design
- authentication
- authorization
- persistence architecture
- concurrency
- PayMongo integration
- HMO integrations
- ERD changes
- workflow changes
- major refactors
- deployment architecture

Do not implement while a task explicitly requires plan approval.

## Prompt contract

Task prompts may use sections such as:

- `<context>`
- `<objective>`
- `<explore_first>`
- `<invariants>`
- `<constraints>`
- `<implementation>`
- `<edge_cases>`
- `<verification>`
- `<regression_tests>`
- `<report>`
- `<stop>`

Treat them as a task contract.

## Multi-agent discipline

This repository may be worked on by:

- Claude Code
- Codex/Astra

Only one agent should actively modify the same working tree/task at a time.

Before work, check:

```bash
git status
git branch --show-current
git log -1 --oneline
```

Never overwrite another agent's uncommitted work.

Use separate Git branches or worktrees for genuinely parallel work.

## Git safety

Never, unless explicitly authorized for the specific task:

- discard unrelated changes
- reset the repository
- rewrite history
- force push
- delete branches
- stash another agent's work
- commit
- push

When instructed to leave work uncommitted, leave it uncommitted.

The reviewer decides when a checkpoint is committed.

## Testing

Unless task instructions say otherwise, final verification should include:

```bash
git diff --check
npm test
npm run test:smoke
npm run build
git status
```

Do not weaken legitimate tests merely to get a passing result.

For bug fixes, reproduce the actual failure path before fixing it when practical.

Then verify:

- the exact failure is corrected
- nearby safeguards remain intact
- legitimate failure cases still fail safely

Browser-visible changes should be checked in a browser where practical.

## Performance

Do not add dependencies without a clear need.

The project has a known nonfatal Vite bundle-size warning.

Do not suppress it merely to make build output appear clean.

## Backend boundary

Do not begin backend implementation without explicit authorization.

Future backend work will use a separately reviewed architecture covering areas such as:

- Laravel
- PostgreSQL
- authentication
- RBAC
- database transactions
- concurrency
- idempotency
- audit logging
- Redis / queues
- email
- PayMongo
- object storage
- security
- backups
- observability
- deployment

Do not introduce partial or fake backend infrastructure into the current frontend implementation.

## Final report expectations

For substantial tasks, report:

- starting checkpoint
- files changed
- investigation findings
- implementation decisions
- safeguards preserved
- tests added/updated
- previous/final test totals
- smoke result
- build result
- browser verification
- known limitations
- final Git status

Explicitly state whether:

- business rules changed
- ERD changed
- module architecture changed
- dependencies changed
- backend work occurred
- commit occurred
- push occurred

## Stop conditions

STOP rather than guess when a task requires a decision that is:

- clinically ambiguous
- clinic-policy dependent
- inconsistent with project documentation
- inconsistent with the approved ERD
- destructive to saved data
- security-sensitive
- outside the requested phase

The system must evolve through reviewed, reversible checkpoints rather than uncontrolled broad changes.
