# Multi-Branch Dental Clinic Operation System

## Project

React/Vite frontend for a multi-branch dental clinic operations platform.

Four product experiences:
- Patient
- Staff
- Dentist
- Owner/Admin

This repository is the canonical implementation.

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
- docs/architecture/ERD_v2_Data_Dictionary.md

If documentation conflicts with current tested behavior, identify the conflict rather than silently rewriting architecture.

## Core business rules

- Patient interface is mobile-first.
- Check-In remains a distinct, fast admission event.
- Dentist My Queue contains only the logged-in dentist's queue.
- Skip, no-show, temporarily away, return-to-queue, and emergency priority are Staff-controlled.
- Treatment opens from exact encounter/queue context.
- Never automate diagnosis, treatment decisions, medication selection, prescription decisions, or follow-up clinical decisions.
- Billing depends on actual completed treatment/procedures.
- Messages and Notifications are separate.
- M23 is cross-module orchestration logic.
- Do not expose 25-Module Coverage in production navigation.
- M24 and M25 remain Proposed Enhancements.
- This is frontend-only until explicitly changed. Do not invent backend infrastructure.

## Architecture rules

Prefer stable IDs as relationships.

Derive display values from canonical entities when practical.

Avoid duplicate identity and branch names becoming independent sources of truth.

Critical lifecycle transitions should use shared workflow/store actions rather than page-specific raw collection mutations.

Important commands should be idempotent.

Preserve exact encounter context across workflows.

## Quality gate

Before completing implementation work:

- run `npm test`
- run `npm run build`

Do not leave known regressions.

Do not commit or push unless explicitly requested.

## UI work

For substantial UI/UX implementation, use the `dentalops-production-ui` skill.

The objective is production-quality healthcare SaaS UI, not academic-demo styling.
