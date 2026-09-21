# Phase 4A — UI foundation and responsive shell

## Scope and baseline

Built on `cc7f79b` (Update production UI skill for Phase 4), with a clean starting tree, 260 passing domain/regression tests, passing render-smoke and passing Vite build. Applied the project-specific `dentalops-production-ui` skill. This phase establishes shared presentation; it does not complete the role-specific redesigns.

## Visual system

`src/foundation.css` defines reusable typography, spacing, weights, surfaces, borders, radii, status colors, focus, shadows, control sizes and shell dimensions. System fonts avoid a new font dependency. Restrained blue/neutral surfaces replace shell decoration and fabricated login metrics. Patient content has a narrower maximum width and more generous card spacing; operational roles retain denser desktop layouts.

The foundation loads after existing page CSS. This is an incremental migration: later role phases should adopt these tokens and retire superseded page styles as they migrate, rather than add competing overrides. Breakpoints are documented in the stylesheet: 640px for record/form transformation, 768px for phone navigation, and 1024px for the drawer shell.

## Shell and navigation

- Desktop uses a persistent sidebar, current account identity, branch context and global Notifications access.
- Tablet/phone uses a keyboard-accessible navigation dialog. Patient also retains five task shortcuts. Assigned branch information and Owner branch selection remain visible on phones.
- Existing task groups are filtered through `canAccessPage`; route and shared-command authorization remain authoritative. The academic module catalog is not added to navigation. Existing M24/M25 entries remain explicitly Proposed.
- Notification counts and records remain recipient-specific and use current selectors/actions. The panel offers recent/all history and read actions, with accessible dialog behavior.
- Reset demo data now asks for confirmation explaining the impact across local roles; cancellation leaves data intact. The existing reset action is unchanged.

## Shared components and accessibility

- Buttons default to `type="button"`; explicit submit buttons retain form submission. Controls generally target 44px minimum height, with visible keyboard focus.
- Fields associate hints/errors with their input, expose required/invalid states, and preserve caller-owned values and shared validation. No new clinic validation policy is introduced.
- Cards use section headings; a skip link targets the main content. Notices/errors and toasts expose status announcements. Toggle views expose their selected state.
- Tables retain semantic column headers and captions. Below 640px, records become labeled rows/cards without hiding field values. Text wraps, including long content. Desktop tables remain available for comparison and scanning.
- Native modal dialogs provide background inertness and focus containment. Escape/close/backdrop dismissal invokes the existing close handler; focus returns to the opener. The dialog body scrolls within viewport limits. Navigation and Notifications use the same primitive.
- Status text remains visible rather than relying on color. Escalated HMO uses an attention treatment distinct from Rejected; local validation is informational. No domain status or transition is changed.
- Reduced-motion preferences suppress decorative transitions. Accessible labels accompany icon controls. This foundation is not an accessibility certification; screen-reader and device QA remain necessary.

## Official logo

The shell and login use the existing `/images/logo.png` asset with contained proportions and alternative text. `public/images/logo.png` is unchanged; no replacement or recoloring was created.

## State and safeguards

Visible identity, branch, notification count, permissions and workflow results derive from existing application state. No network loaders, fake metrics, backend services or new operational stores were introduced. Shared workflow commands, canonical relationships, encounter ownership, revisions, finalization, financial evidence, HMO cycles, message participation, notification ownership, clinic clock and persistence safeguards remain unchanged.

## Verification

- All 260 existing automated domain/regression tests retained and passing.
- Expanded render-smoke covers field semantics/value retention, button types, responsive table markup, distinct status treatments, dialog labels, official logo, skip link and permission-filtered navigation, alongside existing role/phase/recovery scenarios.
- Local headless Chrome checked login and all four role shells at 375, 430, 768, 1024 and 1440px, plus 190 authorized page scans. No page-level horizontal overflow or runtime exceptions were observed. Notification dialogs stayed within the viewport, focus entered correctly, Escape restored focus, and responsive navigation opened successfully.
- Additional phone checks verified visible Staff/Owner branch controls, reset confirmation/cancellation without changing local data, native dialog keyboard traversal, and a 640-character table value wrapping without horizontal overflow. Native Tab traversal did not reach underlying page controls; this is not a substitute for cross-browser/screen-reader testing.
- Browser checks use an isolated temporary profile and temporary scripts/screenshots outside the repository; no browser dependency was added. These checks do not constitute full end-to-end workflow or physical-device coverage.
- Production build passes: JavaScript 507.73 kB (146.64 kB gzip), CSS 85.57 kB (16.35 kB gzip). Its existing nonfatal chunk-size warning remains visible. No dependency changes or warning suppression.

## Files

| File | Purpose |
| --- | --- |
| `src/foundation.css` | Shared tokens, shell, controls and responsive transformations |
| `src/main.jsx` | Load foundation after existing page styles |
| `src/components.jsx` | Accessible shared fields, tables, dialogs, statuses and controls |
| `src/layout.jsx` | Responsive role shell, logo/login, notification surface and reset confirmation |
| `scripts/render-smoke.mjs` | Additional foundation assertions without weakening earlier checks |
| `PHASE4A_UI_FOUNDATION.md` | Scope, implementation and verification record |

## Known limitations and next-phase inputs

- **Pre-existing reload defect discovered during browser QA:** all 21 `INITIAL_DENTIST_SERVICE_ASSIGNMENTS` rows lack an `id`, while `readCollection` requires an ID on every persisted row. Saving fresh seed data and reloading therefore produces the saved-workspace recovery screen. `src/data.js`, `src/persistence.js` and `src/store.jsx` are unchanged from the protected baseline. This is not a UI regression; it needs a separately reviewed persistence compatibility fix that preserves the composite Dentist/service relationship and existing saved data. The passing domain/SSR checks do not cover this exact browser seed/reload path. Responsive scans used a fresh, isolated local profile; they do not establish reload correctness.
- Role-specific pages retain much of their earlier layout/copy. Their detailed information density, chart labels, encounter context presentation and interactions still require the authorized Patient/Staff/Dentist/Owner passes (4B–4E).
- Analytics period filtering and some branch scoping remain incomplete as documented in `DOCUMENTATION_RECONCILIATION.md`. No filter or chart behavior was fabricated or repaired here.
- The walk-in/ERD appointment relationship remains a backend modeling question; the approved frontend walk-in workflow is preserved.
- All nine unresolved policy decisions remain unresolved. Presentation must not invent cutoff, grace, override, amendment, reopening or zero-fee settlement rules.
- Backend authorization, real HMO/payment/email integrations, cross-device synchronization and background scheduling remain absent. Current login is explicitly a local demo workspace.
- The stylesheet migration is intentionally partial. Later phases should consolidate legacy page styling, use the shared components and preserve action/selector contracts.
- Phase 4F/final QA should cover real devices and browsers, screen readers, keyboard-only journeys, zoom, realistic long/empty/error/recovery content and end-to-end interactions for each role. Recheck all five viewport targets after each role pass.

Stop after Phase 4A. No Phase 4B implementation, business-rule/ERD changes, official-document reconciliation, commit or push is included in this work.
