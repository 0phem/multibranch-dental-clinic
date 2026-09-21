# Multi-Branch Dental Clinic Operation System

## Project

React/Vite frontend for a multi-branch dental clinic operations platform.

Four product experiences:
- Patient
- Staff
- Dentist
- Owner/Admin

This repository is the canonical implementation.

## Clinic branding

Official clinic identity:

**Dr. Dana E. Roxas**
**Dental Clinic**

"Dental Clinic" is the supporting/subtitle line. The application must not present itself to users as "DentalOps".

The authoritative identity is the **text** above, rendered as real accessible HTML. Logo artwork never substitutes for it.

Clinic assets (browser paths in parentheses):

- `public/images/logo.png` (`/images/logo.png`): the approved compact clinic logo and the current primary application branding asset. Render it beside the clinic-name text on the login/welcome surface, the sidebar and the phone navigation drawer. It is decorative next to that text, so it takes an empty alt.
- `public/images/logo-with-name.png` (`/images/logo-with-name.png`): supplied full artwork/lockup. Preserve it unchanged. Its embedded wording ("DANA ROXAS / DENTAL CLINIC", another Dentist's name and a services line) does not match the authoritative identity, so it is not rendered in the primary shell or login. Use it only where the client explicitly approves that usage and its embedded wording is appropriate.

Neither asset may be redrawn, regenerated, destructively recolored, cropped or replaced. Adjust only display size and layout in CSS. `scripts/render-smoke.mjs` records SHA-256 hashes of both files and fails if either changes; update the hashes only when the client supplies a replacement.

Stable internal identifiers keep their existing names and are not user-facing brand: the `dentalops-v4-` localStorage namespace, the `dentalops-production-ui` skill and the npm package name. Do not rename storage keys without a reviewed migration; that would strand existing saved workspaces. See BRANDING_ALIGNMENT.md.

## Read before substantial work

Use these as project context:

- README.md
- ERD_ALIGNMENT.md
- FRONTEND_SCOPE.md
- MODULE_COVERAGE.md
- PROFESSOR_DEMO_GUIDE.md
- P0_IMPLEMENTATION_NOTES.md
- P1_PRODUCTION_UI_REFRESH.md
- PHASE1_IMPLEMENTATION_NOTES.md
- PHASE2_IMPLEMENTATION_NOTES.md
- PHASE3_IMPLEMENTATION_NOTES.md
- PHASE3_5_SAFEGUARDS.md
- BRANDING_ALIGNMENT.md (official clinic identity, assets and retained internal identifiers)
- DOCUMENTATION_RECONCILIATION.md (current conflicts and unresolved policies)
- docs/architecture/ERD_v2_Data_Dictionary.md

Approved requirements, module meanings and ERD concepts precede implementation evidence. If documentation conflicts with current tested behavior, classify and report the conflict rather than rewriting requirements to fit code. Historical phase notes retain their original context.

## Core business rules

- Patient interface is mobile-first.
- Check-In remains a distinct, fast admission event.
- Dentist My Queue contains only the logged-in dentist's queue.
- Skip, no-show, temporarily away, return-to-queue, and emergency priority are Staff-controlled. Preserve the explicit Phase 1 Owner administrative command exceptions documented in DOCUMENTATION_RECONCILIATION.md; oversight does not grant clinical/payment/HMO processing authority.
- Treatment opens from exact encounter/queue context.
- Never automate diagnosis, treatment decisions, medication selection, prescription decisions, or follow-up clinical decisions.
- Billing depends on actual completed treatment/procedures.
- Messages and Notifications are separate.
- M23 is cross-module orchestration logic.
- Do not expose 25-Module Coverage in production navigation.
- M24 and M25 are **Approved Frontend Enhancements** (client-authorized; previously recorded as Proposed Enhancements). M24 (Referral & Loyalty) is an implemented prototype whose program rules (the 50-point redemption threshold, one Pending request at a time, each request processed once, the same-day duplicate-reward check) and validation rule (whole positive points) are team-designed prototype rules for demonstration, not historical clinic policy or an established clinic program; its writes go through the shared commands in `src/loyalty.js`. M25 (Marketing & Reactivation) is approved. A limited frontend preview/demo exists today (the Engagement campaign-draft form): it sends no real campaigns and still writes through the earlier raw campaign setter, which is known technical debt. Full Staff/Owner management behavior, a safe command architecture, marketing consent, targeting, delivery and analytics are deferred to a later role phase. Neither may block core care operations. See PHASE4B_PATIENT_EXPERIENCE.md.
- This is frontend-only until explicitly changed. Do not invent backend infrastructure.

## Architecture rules

Prefer stable IDs as relationships.

Derive display values from canonical entities when practical.

Avoid duplicate identity and branch names becoming independent sources of truth.

Critical lifecycle transitions should use shared workflow/store actions rather than page-specific raw collection mutations.

Important commands should be idempotent.

Preserve exact encounter context across workflows.

Revalidate current actor/profile/permissions, branch scope, record state and canonical links in shared commands; hidden controls are not enforcement. Keep finalized care and payment evidence protected. Use the centralized Manila clock and existing persistence/legacy safeguards; never rebase saved history. Keep Messages participants and Notification recipients identity-specific. Do not invent unresolved clinic policies. Frontend validation is not authoritative backend security.

## Quality gate

Before completing implementation work:

- run `git diff --check`
- run `npm test`
- run `npm run test:smoke`
- run `npm run build`

Do not leave known regressions.

Do not commit or push unless explicitly requested.

## UI work

For substantial UI/UX implementation, use the `dentalops-production-ui` skill.

The objective is production-quality healthcare SaaS UI, not academic-demo styling.
