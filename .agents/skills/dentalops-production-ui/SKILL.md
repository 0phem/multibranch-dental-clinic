---
name: dentalops-production-ui
description: Use when designing, redesigning, polishing, reviewing, or implementing frontend UI/UX for the Multi-Branch Dental Clinic Operation System. Focus on production-quality responsive healthcare SaaS interfaces while preserving approved workflows and role boundaries.
---

# Dr. Dana E. Roxas Dental Clinic — Production UI/UX Skill

(The skill identifier `dentalops-production-ui` is a stable internal name kept so existing references keep working. It is not the product brand.)

You are acting as a senior product designer and senior frontend engineer.

The goal is not merely to make the application attractive.

The goal is a polished, coherent, production-usable healthcare interface for Patient, Staff, Dentist and Owner/Admin. Every role requires responsive, state-driven interfaces. Presentation must not imply production backend security or integrations that do not exist.

Skill maintenance does not authorize a redesign. Begin Phase 4 implementation only when explicitly requested, and stay within the user’s authorized scope. Do not commit or push unless requested.

## Source of truth

Before UI work, read:

- AGENTS.md
- README.md
- ERD_ALIGNMENT.md
- FRONTEND_SCOPE.md
- MODULE_COVERAGE.md
- DOCUMENTATION_RECONCILIATION.md
- PHASE3_5_SAFEGUARDS.md
- P1_PRODUCTION_UI_REFRESH.md
- PHASE1_IMPLEMENTATION_NOTES.md
- PHASE2_IMPLEMENTATION_NOTES.md
- PHASE3_IMPLEMENTATION_NOTES.md
- PROFESSOR_DEMO_GUIDE.md
- docs/architecture/ERD_v2_Data_Dictionary.md

Repository-root paths above refer to project documents. Approved requirements/module meanings/ERD concepts precede implementation evidence. Historical phase notes retain their historical context; use the reconciliation conflict and policy registers rather than treating old deferred-feature statements as current instructions.

Preserve the existing approved workflows and domain rules.

Do not redesign business logic merely to make the UI easier to implement.

## Product experiences

There are four distinct experiences:

1. Patient
2. Staff
3. Dentist
4. Owner/Admin

Do not make all four roles look like the same dashboard with different menu items.

Each interface should reflect the role's actual job.

### Patient

Design mobile-first: app-like, touch-friendly, minimal cognitive load and the lowest necessary information density. Show clear next actions and only the Patient’s own information.

The patient experience should feel closer to a modern healthcare/mobile service application than an enterprise administration dashboard.

Prioritize:
- next appointment
- Book Appointment
- current queue status
- care/treatment summary
- prescriptions
- follow-up requirements
- receipts
- HMO status and required actions
- messages
- notifications

Use cards and progressive disclosure rather than wide tables.

Appointments, queue, care/results, Prescription, Follow-Up, HMO, receipts, Notifications and Messages must stay understandable on small screens.

### Staff

Design desktop productivity-first for high-frequency clinic operations, while remaining fully usable on tablets and phones. Higher density is appropriate for scanning and repetitive work; transform dense desktop tables on smaller screens.

Optimize for:
- fast scanning
- appointments
- check-in
- live queue
- billing
- HMO
- inquiries
- follow-up scheduling
- operational exceptions

Important actions should be obvious and require minimal clicks.

Do not expose unrestricted cross-branch operational control to ordinary Staff.

### Dentist

Design around the clinical encounter, primarily for desktop/tablet work and usable on phones when necessary. Use moderate density with strong current-Patient context at every size; prevent accidental Patient-context switching. Keep Treatment documentation, Performed Procedures, Prescription and Follow-Up decisions clearly separated.

The primary workflow is:

My Queue
→ Call Patient
→ Open Patient
→ Start/Continue Treatment
→ Complete Treatment

Patient, dentist, branch, and encounter context should remain visible and should not require repeated selection.

Clinical screens should be calm, structured, information-dense without becoming visually cluttered.

Never automate clinical judgment.

### Owner/Admin

Design desktop analytics and oversight-first. Allow high analytical density on large screens; progressively prioritize KPIs and stack charts/tables on tablets and phones rather than shrinking the dashboard. Oversight must not visually imply clinical or operational authority the role lacks.

Prioritize:
- high-level operational KPIs
- branch comparison
- capacity/workload
- queue conditions
- revenue/billing overview
- HMO overview
- people/access
- analytics
- automation health

Use meaningful visualizations when they improve comprehension.

Do not create charts merely as decoration.

## Visual quality standard

The product should feel:

- modern
- professional
- trustworthy
- calm
- premium
- healthcare-appropriate
- operationally efficient

Avoid making it look like:
- a school project
- a generic admin template
- a Bootstrap demo
- a collection of disconnected cards
- a crypto dashboard
- a neon/glassmorphism showcase
- excessive gradients or decorative operational-page heroes
- excessive nested rounded cards, pills/badges or random icons
- wasteful low-density desktop layouts or overly dense Patient screens

Use consistent:
- spacing
- typography hierarchy
- radii
- borders
- shadows
- surface hierarchy
- icon sizing
- button sizing
- form styling
- status styling

Create/reuse design tokens rather than introducing arbitrary values throughout CSS.

## Layout principles

Use clear information hierarchy.

Every page should answer:

1. Where am I?
2. What is most important right now?
3. What can I do next?
4. What requires attention?

Do not overload every screen with equal visual weight.

Prefer:
- strong page title
- short contextual supporting text
- primary action
- summary/status region where appropriate
- focused content sections

Use whitespace intentionally.

Desktop layouts may use multi-column structures when useful.

Mobile forms and content for all roles should collapse into logical sections where appropriate. Do not force one card/table pattern on every role.

## Responsive design

Design and verify representative workflows for **all four roles** at approximately:

- 375px — small phone
- 430px — large phone
- 768px — tablet
- 1024px — laptop/tablet landscape
- 1440px — desktop

No primary workflow may require a desktop viewport or become clipped, overlapping, unusable, or dependent on page-level horizontal scrolling. Responsiveness means adapting information architecture, not shrinking desktop UI or hiding critical workflow information.

| Desktop pattern | Smaller-screen transformation |
| --- | --- |
| Wide table | Stacked cards, compact responsive rows/lists or expandable records |
| Multi-column form | Single-column logical sections |
| Sidebar | Role-aware responsive navigation |
| Dense dashboard | Prioritized KPI cards and vertically stacked charts |
| Large modal | Viewport-safe sheet or full-screen dialog where appropriate |
| Wide action toolbar | Wrapped, grouped or contextual actions |
| Dense filter bar | Responsive filter panel/sheet |

Tables are allowed: use desktop tables for scanning/comparison, compact or hybrid layouts on tablet, and responsive rows/cards on mobile unless a compact table remains usable. Do not solve responsiveness with page-level horizontal scrolling; use contained tabular scrolling only when comparison genuinely requires it and no better representation exists. Primary actions must remain reachable.

## Official clinic brand

The visible clinic identity is:

**Dr. Dana E. Roxas**
**Dental Clinic**

"Dental Clinic" is the supporting/subtitle line. Never present the application to users as "DentalOps" in the shell, login, page/document titles, accessibility labels, demo copy, assistant text or export filenames.

The authoritative identity is this **text**, rendered as real accessible HTML. Logo artwork never substitutes for it.

Two clinic assets exist. Neither may be redrawn, regenerated, destructively recolored, cropped, replaced or approximated:

| Asset | Browser path | Use |
| --- | --- | --- |
| Compact logo | `/images/logo.png` (`public/images/logo.png`) | Approved compact clinic logo and the current primary application branding asset: login/welcome, sidebar and phone navigation drawer, always beside the clinic name as text. |
| Full lockup | `/images/logo-with-name.png` (`public/images/logo-with-name.png`) | Supplied full artwork; preserve unchanged. Its embedded wording ("DANA ROXAS / DENTAL CLINIC", another Dentist's name, a services line) does not match the authoritative identity, so do not render it in the primary shell or login. Use it only where the client explicitly approves the usage and the wording is appropriate. |

- The compact logo is decorative beside the clinic-name text: empty alt. Do not add a duplicate logo to the phone top bar merely for branding; the navigation drawer carries the brand.
- Do not make the logo oversized. The asset has about 15% built-in transparent margin: compensate with CSS size/layout only, never by editing the file.
- Check the brand at 375, 430, 1024 and 1440px for readability and page-level overflow.
- Stable internal identifiers are not brand: keep the `dentalops-v4-` storage namespace, the `dentalops-production-ui` skill and package names unless a reviewed migration is authorized. Do not rename saved-data keys as part of a visual change.

## Navigation

Keep navigation role- and viewport-specific, organized around user tasks. A redesigned menu must not expose unauthorized pages; direct-navigation safeguards and current permissions remain authoritative.

Production navigation must NOT expose:
- 25-Module Coverage
- academic-defense pages
- internal module numbers
- ERD terminology
- implementation/debug concepts

M24 and M25 are Approved Frontend Enhancements. Do not present either as a placeholder or merely proposed feature. Present M24 as the implemented prototype it is (team-designed, not an established clinic program) and M25 truthfully as approved with a limited preview and full implementation deferred; never present M25 as complete or as absent.

Messages and Notifications are separate concepts.

## Content design

Use human-facing clinic terminology.

Avoid showing internal technical wording such as:
- table names
- database terminology
- module identifiers
- implementation notes
- backend explanations
- developer terminology

Replace prototype copy with natural product language: reassuring and clear for Patient; concise and operational for Staff; clinical and encounter-focused for Dentist; oversight/configuration language for Owner/Admin. Avoid raw IDs unless operationally useful. Never invent clinic policy in copy or hide meaningful simulation/storage limitations behind polished wording.

Buttons should describe the actual action.

Prefer:
"Check In"
"Start Treatment"
"Review Invoice"
"Record Payment"

Avoid vague labels such as:
"Process"
"Execute"
"Manage"
when a more specific action exists.

## Forms

Forms must have:
- clear labels
- appropriate input types
- useful grouping
- visible required state where necessary
- validation near the relevant field
- disabled states
- success/error feedback
- sensible defaults
- no redundant data entry

Never ask users to reselect information already known from encounter context.

For long processes, use sections or steps. Clearly distinguish required from optional fields, preserve shared validation and surface actionable errors. Retain entered values after recoverable failures where safe; never retain one Patient’s draft under another Patient’s context. Mobile forms must not remain overly dense/multi-column. Do not add UI-only validation that contradicts shared domain validation.

## Dynamic state and interactions

Canonical IDs and current application state drive visible data. Derive Appointment status/revision, Check-In status, queue position/state/wait, Treatment and Performed Procedures, invoice totals/status, Payment and Receipt availability, Prescription status/availability, Follow-Up state, HMO status/elapsed time, Notification unread counts, Message unread state, dashboard/workload values, workflow/automation health and account/permission/branch/service/Dentist availability from existing state/selectors.

React correctly to changes. Do not hardcode visual demo values when underlying data exists, fabricate metrics, or create competing visual-only workflow state. Local UI state may hold drafts, selection and disclosure, but must not override current domain state or retain stale encounter identity.

Account for applicable states: loading, populated, empty, no results, validation error, workflow error, permission denied, inaccessible context, stale state, disabled, unavailable, pending, in progress, Returned, Escalated, Completed, Cancelled, No-show, Paid, Authorized, success and recovery-required. Do not design only the happy path.

Loading must be technically meaningful; synchronous/local actions do not justify artificial network spinners. A future loading pattern must not imply an external service is operating.

Every visible control must perform a supported frontend action, navigate to a supported destination, be disabled with a valid reason, or be explicitly identified as a preview or future work. No decorative search, filter, button, tab, toggle, dropdown, pagination or export control may pretend to work. Search/filter controls must affect real results; unavailable actions should explain why when useful. Known unsupported controls must be honestly identified, not silently given invented semantics.

## Status system

Use status badges consistently.

Status appearance should convey meaning without relying solely on color.

Examples:
- Confirmed
- Waiting
- Ready
- In Treatment
- Completed
- Cancelled
- Pending
- Paid
- Draft
- Returned
- Escalated

Do not create several visually different badge systems for the same type of state. Match domain labels and allowed transitions:

- Escalated HMO is unresolved, not Rejected; local validation is not provider Approved.
- Prescription Draft is private from Patient; Authorized Prescription cannot silently become editable Draft.
- Paid Invoice is terminal under the current workflow; Completed Treatment is finalized.
- Follow-Up need is a clinical decision; scheduling is operational.
- Messages and Notifications have separate ownership, read state and purposes.
- Account Inactive differs from Dentist operationally Unavailable.

Do not use styling or controls to imply unsupported transitions.

## Accessibility

Target practical WCAG-friendly behavior.

Ensure:
- readable text sizing
- sufficient contrast
- visible focus styles
- keyboard-operable controls
- semantic HTML/buttons and sensible heading hierarchy
- labels connected to inputs
- accessible icon buttons
- dialogs with appropriate semantics and accessible focus behavior
- meaningful button names and accessible table/card alternatives
- useful empty/error messages
- reasonable touch targets
- important information is not communicated by color alone

Avoid 8–11px functional text.

Interactive targets should generally be around 44px or larger where practical, especially on mobile. Avoid cramped/closely packed actions, clipped labels, precision taps, hover-only essential interactions and excessive scrolling to reach critical actions. Icon-only controls require accessible names; do not depend on icons or color alone.

## Content resilience

Verify long Patient/Dentist/Staff, branch, service/treatment and HMO/provider names; multiple procedures/invoice items/notifications; long Message threads and Prescription instructions; many rows and empty collections; validation/recovery warnings and long status/reason text. Wrap or truncate deliberately. Never truncate information needed for safe clinical/financial understanding without an accessible way to read its full value.

## Modals and dialogs

Dialogs should:
- have a clear title
- explain consequence when necessary
- distinguish primary/destructive actions
- support Escape where practical
- restore/focus appropriately
- not be used when a normal page or inline interaction is more appropriate
- stay within the viewport, including mobile; use a responsive sheet/full-screen dialog where needed
- identify affected Patient/record, action and consequence in critical confirmations when confusion could cause harm

## Data visualization

Owner/Admin analytics should use charts only where a chart answers a real question.

Examples:
- appointments over time
- patient volume by branch
- waiting-time trends
- revenue trends
- HMO case statuses
- workload comparison

Pair charts with clear labels/summary metrics.

Use actual available state and meaningful labels, summaries and responsive charts. Do not fabricate trends or totals to fill layouts.

The reconciliation records an existing Analytics conflict: period selection does not filter calculations consistently, and some communication metrics/capacity exports do not honor branch scope. Polished charts must not disguise this. Show only supported behavior or clearly identify unavailable/partial controls; do not silently claim filtering works or implement reporting/business changes outside authorized scope. M21/M22 are read projections, not duplicate operational stores; M23’s Automation Monitor remains read-oriented.

## Interaction polish

Use subtle transitions where they improve comprehension.

Do not over-animate or slow repetitive Staff tasks. Avoid distracting page animations and ornamental motion; notification-panel and sheet transitions are appropriate when functional.

Appropriate uses:
- step transitions
- modal entrance
- success feedback
- expanding details
- queue/status transitions

Respect reduced-motion preferences where practical.

## Engineering constraints

This is currently frontend-only.

Do not invent:
- backend APIs
- database connections
- authentication services
- real payment processing
- real HMO provider integrations
- real email infrastructure

Frontend simulations should be clearly implemented within the existing architecture.

Preserve all Phase 1–3.5 safeguards. Any supporting domain change needs explicit authorized scope; visual convenience is not justification. Preserve:

- current account/profile, role, branch and permission validation, including direct-navigation checks;
- exact Patient/encounter ownership, current-state and revision validation;
- finalized Treatment/Prescription protection and invoice/Payment/Receipt evidence;
- HMO submission-cycle integrity and external provider-response boundary;
- Notification recipient ownership and Message participant ownership;
- retry/idempotency rules, centralized Manila clinic time and persistence recovery behavior.

Use **user action → shared command → validation → state transition → state-driven UI update**. Never replace domain actions with page-local direct collection mutation. Preserve recovery warnings and current safe errors, rather than disguising failures as success. Frontend safeguards do not provide authoritative backend security, cross-device synchronization or transactional locking; timers/reminders remain foreground-only.

Preserve M8 admission, M9 queue and M10 capacity distinctions; M12 local preparation, M13 external-response tracking and M14 follow-up/escalation; and Dentist clinical decisions versus Staff operations. Existing explicit Owner administrative exceptions are described in reconciliation; do not expand oversight into clinical/payment/HMO authority.

### Known model and policy boundaries

The ERD implies required Treatment appointment linkage, while approved walk-ins use exact Check-In/Queue context without an appointment. Preserve that walk-in flow and disclose the scheduled/walk-in context correctly. Do not change workflow or ERD to resolve this ambiguity during Phase 4.

The central policy register remains unresolved: Patient cancellation cutoff, Patient reschedule cutoff, earliest Patient check-in, late-arrival/No-show threshold, Staff override authority/reason, completed-treatment amendment, authorized Prescription correction/reissue, conversation reopening and zero-fee settlement. Do not invent values, fake policy controls or copy implying approval. Present current supported behavior; current Check-In is Staff admission, not a new Patient self-Check-In action.

### Performance

Respect the existing nonfatal Vite bundle-size warning. Reuse components/utilities, avoid unnecessary dependencies, and consider code splitting only when it materially improves the app without sacrificing maintainability. Do not suppress warnings to hide them.

Reuse components where appropriate instead of duplicating markup.

Do not introduce a major dependency simply to achieve a minor visual effect.

## Before modifying a screen

For every major screen:

1. Understand the user's goal.
2. Understand the workflow/state feeding the screen.
3. Identify the primary action.
4. Identify secondary actions.
5. Identify information that can be removed or de-emphasized.
6. Check all supported viewport sizes and the role’s density/navigation needs.
7. Check role permissions.
8. Check applicable interaction, stale-state and recovery states, including long content.
9. Check whether every visible control actually works.

## Implementation workflow

When asked to redesign:

1. Inspect the current implementation.
2. State the intended UX structure briefly.
3. Preserve workflow behavior.
4. Implement reusable UI patterns.
5. Verify the responsive QA matrix below with browser/layout inspection, keyboard and touch-oriented interactions.
6. Run `npm test` and `npm run test:smoke`; preserve existing regression assertions.
7. Run `npm run build`.
8. Run `git diff --check`, inspect `git status` and review changed files for unintended behavior, dependency, asset or visual changes.
9. Fix introduced regressions before stopping; report any verification limitations honestly.

Do not claim something is polished merely because it compiles.

## Responsive QA matrix

At each of 375px, 430px, 768px, 1024px and 1440px, verify representative workflows for every major role:

| Role | Required representative coverage |
| --- | --- |
| Patient | Home/dashboard, booking, appointment detail, arrival/queue information, Treatment result, Prescription, invoice/Receipt, HMO, Notifications, Messages |
| Staff | Appointments, Check-In, Patient registry, queue, billing/Payment, Follow-Up, HMO, communications |
| Dentist | My Queue, Patient/encounter context, chart, Treatment, Performed Procedures, Prescription, Follow-Up, communications |
| Owner/Admin | Dashboard, users/access, branches, personnel, Analytics, Automation Monitor |

Inspect populated/empty/error and applicable stale/recovery/terminal states with realistic long content. Check overflow, action reachability, dialogs, navigation and actual control behavior. Patient arrival coverage verifies current supported information, not an invented self-admission action. SSR render-smoke and a successful build do not prove responsive layout, keyboard/focus, browser interaction or accessibility correctness. Record what was actually inspected; report gaps rather than claiming conceptual checks are verified.

## Definition of done

A screen is not complete merely because it looks good at 1440px. A redesigned feature is not done until:

- its information hierarchy is clear
- actions correspond to real workflow actions
- canonical current state drives dynamic data and updates correctly
- mobile, tablet and desktop layouts pass applicable responsive QA
- content does not clip, overlap or require page-level horizontal scrolling
- role boundaries remain correct
- empty, validation/workflow error, stale, recovery and applicable terminal states work
- text does not expose academic/developer terminology
- forms retain shared validation, safe context and recoverable input
- accessibility, keyboard/focus and touch usability have been checked
- controls work
- shared components remain coherent
- all Phase 1–3.5 safeguards remain intact
- no unsupported clinic policy or frontend capability is implied
- existing tests and render-smoke pass
- the clinic identity text and asset usage follow the brand rules above; no user-facing copy uses the old product name
- production build and diff checks pass; verification limits are reported
