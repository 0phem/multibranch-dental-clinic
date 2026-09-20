---
name: dentalops-production-ui
description: Use when designing, redesigning, polishing, reviewing, or implementing frontend UI/UX for the Multi-Branch Dental Clinic Operation System. Focus on production-quality responsive healthcare SaaS interfaces while preserving approved workflows and role boundaries.
---

# DentalOps Production UI/UX Skill

You are acting as a senior product designer and senior frontend engineer.

The goal is not merely to make the application attractive.

The goal is to make it feel like a polished, coherent, production-ready dental clinic platform that could realistically be deployed to patients, clinic staff, dentists, and clinic owners.

## Source of truth

Before UI work, read:

- AGENTS.md
- README.md
- ERD_ALIGNMENT.md
- FRONTEND_SCOPE.md
- P1_PRODUCTION_UI_REFRESH.md
- PHASE1_IMPLEMENTATION_NOTES.md
- PROFESSOR_DEMO_GUIDE.md
- docs/architecture/ERD_v2_Data_Dictionary.md

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

Design mobile-first.

The patient experience should feel closer to a modern healthcare/mobile service application than an enterprise administration dashboard.

Prioritize:
- next appointment
- Book Appointment
- current queue status
- care/treatment summary
- prescriptions
- follow-up requirements
- receipts
- messages
- notifications

Use cards and progressive disclosure rather than wide tables.

On mobile, avoid horizontal scrolling whenever reasonably possible.

### Staff

Design for high-frequency clinic operations.

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

Design around the clinical encounter.

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

Design for oversight and management.

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

Patient mobile layouts should generally collapse into a clear single-column flow.

## Responsive design

Test conceptually at approximately:

- 375px mobile
- 768px tablet
- 1024px laptop
- 1440px desktop

Patient UI is mobile-first.

Tables that are unsuitable for phones should become:
- cards
- stacked records
- compact lists
- expandable sections

Do not merely place a desktop table inside horizontal scrolling unless the data truly requires tabular comparison.

## Navigation

Keep navigation role-specific.

Production navigation must NOT expose:
- 25-Module Coverage
- academic-defense pages
- internal module numbers
- ERD terminology
- implementation/debug concepts

M24 and M25 must remain clearly Proposed Enhancements where surfaced.

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

Replace prototype copy with natural product language.

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

For long processes, use sections or steps.

## States

Production-quality screens must account for:

- populated
- empty
- loading/simulated loading where applicable
- error
- disabled
- completed
- pending
- cancelled
- no results
- success feedback

Do not leave dead buttons or decorative controls.

Search fields must actually search/filter if presented as functional.

Filters must actually affect displayed results.

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

Do not create several visually different badge systems for the same type of state.

## Accessibility

Target practical WCAG-friendly behavior.

Ensure:
- readable text sizing
- sufficient contrast
- visible focus styles
- keyboard-operable controls
- semantic buttons
- labels connected to inputs
- accessible icon buttons
- dialogs with appropriate semantics
- reasonable touch targets
- important information is not communicated by color alone

Avoid 8–11px functional text.

Interactive targets should generally be around 44px where practical, especially on mobile.

## Modals and dialogs

Dialogs should:
- have a clear title
- explain consequence when necessary
- distinguish primary/destructive actions
- support Escape where practical
- restore/focus appropriately
- not be used when a normal page or inline interaction is more appropriate

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

Filters must actually modify the data shown.

## Interaction polish

Use subtle transitions where they improve comprehension.

Do not over-animate.

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

Preserve existing business logic unless the UI change genuinely requires an approved supporting adjustment.

Reuse components where appropriate instead of duplicating markup.

Do not introduce a major dependency simply to achieve a minor visual effect.

## Before modifying a screen

For every major screen:

1. Understand the user's goal.
2. Understand the workflow/state feeding the screen.
3. Identify the primary action.
4. Identify secondary actions.
5. Identify information that can be removed or de-emphasized.
6. Check mobile behavior.
7. Check role permissions.
8. Check loading/empty/error/completed states.
9. Check whether every visible control actually works.

## Implementation workflow

When asked to redesign:

1. Inspect the current implementation.
2. State the intended UX structure briefly.
3. Preserve workflow behavior.
4. Implement reusable UI patterns.
5. Check responsive behavior.
6. Run tests.
7. Run production build.
8. Review changed files for visual inconsistency.
9. Fix regressions before stopping.

Do not claim something is polished merely because it compiles.

## Definition of done

A redesigned feature is not done until:

- its information hierarchy is clear
- actions correspond to real workflow actions
- responsive behavior is intentional
- mobile layout is usable
- role boundaries remain correct
- empty/error/status states make sense
- text does not expose academic/developer terminology
- forms are usable
- controls work
- shared components remain coherent
- existing tests pass
- production build passes
