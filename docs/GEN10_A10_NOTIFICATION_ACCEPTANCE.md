# GEN-10 A10 notification presentation acceptance

2026-10-30, Asia/Manila. Original QA owner: **Celin**; support and A10 implementer/reviewer: **Joevan**. **PARTIAL**: independent presentation scope passed; notification archive/delete remains restricted by GEN-11.

## Branch and boundaries

Source branch: `feature/joevan-gen10-notification-ui-a10-20261030`, stacked on accepted A9 `258302683394b037e85580c7a9d4cca8ba5be790`, retaining A8 ancestry. Shared integration remains `010a386f147bed285c58821a0a2cc800c393982e`. No application shell/routing refactor, backend change, database access, delivery-policy change, new notification type or integration/deployment.

## Existing features verified versus actual changes

| Area | Existing behavior verified | Actual A10 change |
| --- | --- | --- |
| Bell | No decorative border; visible hover fill; focus-visible outline; descriptive unread label; no badge at zero, 1 and multiple exact counts, 101 displayed as 99+ with exact accessible count; opens via Enter/click and closes via button/Escape with focus restored | None; existing bell and shell markup retained |
| Date headings | Today, Yesterday, historical labelled dates and Date unavailable | Sort valid timestamps newest first before grouping; preserve source order for ties and unknown dates, place unknown dates last |
| Recent/all | View all / Recent only retains complete scoped history | Select latest eight after sorting, rather than first eight source records |
| Panel | Existing modal, unread dot/text and empty state | Scoped wrapping, line spacing/dividers, toolbar alignment, 44px action targets, focus/hover styles and inline action-failure alert |
| Reads/navigation | Existing recipient, branch and destination selectors; exact canonical context; scoped one/all read commands | Await command result, handle returned/rejected failures, disable read actions while pending, and recheck latest identity/destination after an awaited action before navigation |

The source collection is not guaranteed newest-first: `visibleNotifications` filters without sorting, and local persisted/history/event collections may arrive in different orders. The previous group helper preserved first-seen groups and the panel sliced before grouping. New regression input is deliberately oldest-first, with interleaved unknown dates; no event timestamp or stored history is rewritten.

Current offset timestamps are parsed as instants; historical offset-free `YYYY-MM-DD HH:mm` / ISO-local strings are interpreted as Manila wall time. UTC crossing 16:00 groups on the next Manila day. Offset variants, fractional seconds, invalid calendar/time/offset values, missing timestamps and equal instants are tested. Sorting returns original item objects in a new array and does not mutate input.

## Actual verification

- `node --test tests/notification-date-groups.test.js tests/phase3.test.js tests/production-shell.test.js`: **56 passed, 0 failed**. Includes date labels/sorting, latest eight, stable equal timestamps, input immutability, invalid offsets and midnight crossing, existing recipient-specific one/all read, canonical/forged navigation context and existing role guards.
- `node tests/notification-a10-rendered.mjs <path-to-playwright/index.mjs>`: **1440px and 390px passed** using installed Chrome, Vite port 5178 and the actual Shell/NotificationPanel with fictional data. Checks zero/one/15/101 counts, border/hover/focus styles, Enter/Escape/focus return, date order, latest eight, View all/Recent only, long unbroken title/body, no page or panel horizontal overflow, 44px action heights, other-recipient exclusion, unauthorized destination suppression, one/all read updates, successful keyboard navigation, synchronous/asynchronous/thrown failure feedback and no navigation after session invalidation during a pending command. No browser page errors observed.
- Production build passed with the existing large-chunk warning. `git diff --check` passed. No full application suite or database-writing tests were run; this scope required none.

The rendered fixture invokes the existing `communicationActions` for successful reads. Failure/pending scenarios are controlled fixture results, not server failures. API requests are blocked in the fixture; no real Patient records, recipients or provider calls are used.

## Screenshots — fictional notifications

- [Desktop 1440px](ui-review/notification-a10/panel-1440.png)
- [Phone 390px](ui-review/notification-a10/panel-390.png)

Screenshots use the production shell and modal with synthetic Staff identity and fictional notifications. Long content remains available through the panel's existing vertical scroll area. They do not demonstrate server notification delivery or clinical data.

## Read-state/server acceptance boundary

The current panel reads `store.state.notifications` through `visibleNotifications` and calls the existing scoped browser-store `communicationActions`. The Laravel API wrappers `listNotifications`, `readNotification` and `readAllNotifications` exist in `src/api-client.js`, but this panel/store does not wire them into a server notification feed. A10 preserves that contract and does **not** claim server persistence, cross-device read synchronization, complete live-event delivery or network-load availability acceptance. An empty scoped store produces the existing empty state; it is not proof that the server has no updates. Returned/rejected read failures produce an alert and no success/navigation. Backend identity/branch permissions and notification APIs remain unchanged.

## Remaining restrictions and handoff

- No Delete, archive, soft-delete endpoint, Clear All deletion, retention change, migration or GEN-11 implementation. **Mark my notifications read is not deletion.**
- GEN-10 remains PARTIAL; archive/restore policy and any server-feed integration require separately authorized work. Full production notification acceptance and broader role/viewport accessibility certification are not established here.
- Changes are limited to notification helper, NotificationPanel/import, scoped CSS, focused tests/fixture, this evidence and the GEN-10 entry in QA-CELIN. A9 academic/Word documents, Developer B sources/trackers and branches are untouched.
- After publishing A10, stop. Coordinator should use the A10 branch based on the exact A9 SHA above; no automatic integration or deployment. No A11 selected.
