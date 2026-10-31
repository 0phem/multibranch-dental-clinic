# A12 shell and notification UI acceptance

2026-10-31, Asia/Manila. Developer A / Joevan. Local batch prepared for coordinator review; no commit, push, merge or deployment.

## Baseline and ownership

- Fetched `origin/integration/developer-a-b`; verified exact HEAD `ba9bc975bf70f5458bc7fd0d0956390c0ddbde71` before branching.
- Created `feature/joevan-a12-shell-notifications-20261031` directly from that baseline. Initial branch was `session/developer-a-ui-20261031`, HEAD `f8042d11a04c2b1ec26a10b443b80361edf28537`; tracked files were clean. No old branch was modified, stashed, reset or cleaned.
- Preserved pre-existing untracked `$config.txt`, `.agents/skills/motion/` and `.codex/` files. No secrets or `backend/.env` were read.
- Followed the explicit A12 implementation scope where older handoff/module documents describe earlier hosting, documentation-only or frontend-only phases. No module status or clinic-policy change is made.

Exact batch files:

| File | Change |
| --- | --- |
| `src/layout.jsx` | Scoped style import; current authorized page label; notification summary, list semantics, visible unread label, pending/failure feedback and duplicate pending-command guard |
| `src/notification-panel.css` | Scoped panel layout, readable groups and rows, action hierarchy, viewport-safe scroll area and empty/error presentation |
| `src/a12-shell-polish.css` | New shell-only navigation/header/focus/responsive styles, imported only by `layout.jsx` |
| `tests/a12-shell-polish.test.js` | Production-component SSR assertions and optional real-Chrome acceptance with fictional fixtures |
| `docs/A12_SHELL_UI_ACCEPTANCE.md` | This review and reproduction record |

All other tracked files are unchanged, including backend, authentication contracts, global styles, package manifests, QA trackers and clinic assets.

## Before / after design decisions

| Before | After / reason |
| --- | --- |
| Header identified the role workspace and branch, but no current destination | Two-level role/page context, derived from authorized navigation; server Live Queue label matches its navigation label. Branch context remains visible and Owner selection retains its existing callback |
| Legacy navigation included gradient scroll decoration, uppercase group labels and a fill-only active state | Flat navigation surface, sentence-case group headings, restrained blue fill plus an inset active marker; existing `aria-current` retained |
| Patient sidebar disappeared at 1024px while mobile shortcuts started at 768px | Existing Home / Book / Visits / Menu shortcuts now also cover 769–1024px, with bottom content clearance. No destination or permission added |
| Unread state used a dot and visually hidden prefix | Visible “Unread” label, pale blue surface and dot; screen-reader prefix retained without duplicating the visible label |
| Panel toolbar did not explain the displayed subset or command progress | Exact unread count, “Showing N of M,” recent/all pressed state and “Updating read status…” only during an actual command |
| Similar-weight row actions | Read action remains quiet; supported “View update” has stronger border/surface emphasis. Both retain 44px targets |
| Long content relied on the older nested popover height limit | Panel uses dynamic viewport bounds, fixed heading/toolbar and a contained, keyboard-focusable history region; removed the inherited inner height cap within this panel only |
| Empty/failure copy had little hierarchy | Calm empty illustration and workspace-qualified explanation; bounded, focusable error alert; retry uses the same action and clears the prior error |

Existing variables supply color, typography, spacing, radii, controls and focus. No global token changes, artwork changes, font download or dependency installation. The local Motion skill and connected Motion AI Kit were inspected. Motion is not installed in the application; the skill's CSS-versus-Motion guidance supports CSS for simple color feedback. Only short color transitions were added, with reduced-motion suppression. Native dialog behavior remains the interaction foundation.

## Functional preservation and limits

- Navigation still filters through `canAccessPage`; direct page guards and shared commands are unchanged. The new header does not label inaccessible pages.
- Staff/Dentist branch restrictions, Owner branch selection, recipient-specific badges, latest-eight/history ordering, Manila date grouping and canonical notification destinations remain intact.
- Reads still call `markNotificationRead` / `markAllNotificationsRead`. Navigation still awaits success and revalidates the latest identity/destination. Returned, thrown and rejected failures leave unread state intact and do not navigate. A ref prevents a second read submission during an outstanding command.
- Patient shortcuts, Menu, assistant gating, message unread counts and logout confirmation/cancellation retain their existing handlers. No clinical or financial workflow was changed.
- Notifications still project the scoped browser store. This batch does **not** wire the Laravel notification feed or establish server persistence, cross-device synchronization or live delivery. Empty state describes the current workspace. There is no artificial feed-loading state; pending feedback is limited to a real read command.
- GEN-11 archive/delete/retention remains blocked; no archive/delete controls or endpoints were added. Module statuses and process-document implementation-status lines remain unchanged. Paper M19 notification presentation is refined only; this is not a promotion of notification persistence/delivery acceptance.

## Verification

| Check | Result |
| --- | --- |
| A10/domain/shell: `node --test tests/notification-date-groups.test.js tests/phase3.test.js tests/production-shell.test.js` | 56 passed |
| Full frontend: `npm test` | 986 registered; 983 passed, 0 failed, 3 optional browser gates skipped |
| A12 with installed Playwright enabled | 3 SSR tests plus real-browser matrix; all 4 tests passed; 24 role/viewport cases |
| Existing A10 browser runner, temporary screenshot destination | Passed at 1440px and 390px |
| `npm run test:smoke` | All 16 PASS scenarios; existing React Table missing-key warnings remain visible |
| `npm run build` | Passed; existing >500kB chunk warning remains visible |
| `git diff --check` and changed-file/secret review | Passed; only the five authorized batch files changed/added |
| `scripts/predefense-check.sh` | Attempted through Git Bash; blocked before execution of application checks because `backend/vendor/autoload.php` is absent. Windows' WSL Bash also lacks `/bin/bash` |

No backend suite or database checks ran: Composer dependencies are absent, and backend changes/installations are outside A12. No database was accessed.

The normal full suite deliberately skips A12's browser gate unless `A12_PLAYWRIGHT_MODULE` points to an existing installation; the gate was separately enabled and executed. The other two optional skips are existing B8 browser gates. Browser fixtures call production `Shell`, `NotificationPanel`, `Modal` and successful `communicationActions`; pending/refused results are controlled fixture responses. All `/api/` requests are blocked, and no localStorage or real clinic account is used.

Browser coverage: all four roles at 375, 390, 430, 768, 1024 and 1440px. Phone heights are 844px; wider views are 900px. Checks cover long identity/branch labels, page/region horizontal overflow, keyboard skip link, keyboard navigation and header/active-state updates, mobile Menu/drawer dismissal and opener-focus return, Owner branch selection, notification Enter/Escape, keyboard focus visibility, native dialog focus containment, empty/read/unread states, 20-record history including long unbroken content, End-key scrolling, viewport bounds, read-all, pending disabling/status, refusal/throw/rejection/delayed failure and retry, reduced motion and safe logout cancellation. No browser page errors in the passing matrix.

Existing A10 browser coverage additionally checks 0/1/101 badges, exact accessible counts, hover/focus, latest eight, date headings, recipient exclusion, unauthorized destinations, successful View update, failure denial and session invalidation while a read command is pending. Existing assertions were not weakened or edited.

These are production-component checks with synthetic children, not an end-to-end authenticated backend or every-page visual certification. Headless installed Chrome only; no physical phone, screen reader, Firefox or Safari acceptance. Unrelated page content was not redesigned.

## Screenshots and reproduction

Generated evidence is outside the repository at `%TEMP%\a12-shell-ui-20261031\`. No screenshots are staged or committed. The directory contains `shell-{staff,dentist,owner,patient}-{1440,390}.png`, `notifications-{staff,dentist,owner,patient}-{1440,390}.png`, `notification-failure-390.png` and redirected A10 `panel-{1440,390}.png`.

Start with `shell-staff-1440.png`, `shell-owner-390.png`, `shell-patient-390.png`, `notifications-staff-1440.png`, `notifications-staff-390.png` and `notification-failure-390.png`. Existing baseline A10 screenshots remain unchanged in `docs/ui-review/notification-a10/` for historical comparison; fixtures/content differ, so they are not pixel comparisons. A12 screenshots contain fictional data only.

From the repository root, start Vite in one PowerShell terminal:

```powershell
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5178 --strictPort
```

In a second terminal, use the existing Playwright installation (no install):

```powershell
$env:A12_PLAYWRIGHT_MODULE = "$env:LOCALAPPDATA/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs"
$env:A12_SCREENSHOTS = "$env:TEMP/a12-shell-ui-20261031"
node --test tests/a12-shell-polish.test.js
```

If that cached installation moves, set `A12_PLAYWRIGHT_MODULE` to another already-installed `playwright/index.mjs`. The harness serves its virtual HTML through a browser route and loads the real source modules from Vite; no fixture file is written into the repository. Unset these two variables after browser acceptance when running the ordinary full Node suite.

To rerun A10 without overwriting tracked screenshots:

```powershell
$a12Evidence = Join-Path $env:TEMP 'a12-shell-ui-20261031'
$a12A10 = Join-Path $env:TEMP 'a12-a10-rendered.mjs'
(Get-Content tests/notification-a10-rendered.mjs -Raw).Replace('docs/ui-review/notification-a10', $a12Evidence.Replace('\','/')) | Set-Content -LiteralPath $a12A10
node $a12A10 "$env:LOCALAPPDATA/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs"
```

## Review stop

HEAD remains the shared baseline on the requested A12 branch. Two tracked files are modified and three authorized files are new; nothing is staged. Pre-existing untracked local configuration/skills remain. Coordinator review is the next step. No commit, push, merge or deploy has been performed.
