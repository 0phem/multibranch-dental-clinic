# Dentist UI A6 acceptance

Developer: **Joevan / Developer A**, 2026-10-29 (Asia/Manila). Original QA owner remains **Yzhekiel**. Branch: `feature/joevan-dentist-ui-a6-rapid-20261029`, from development integration `848669b6bef655802389430f79d1698e9bbe3c0e`.

## Professor demonstration summary

Dentist Clinic Home now has a clearer heading, larger summary values and readable schedule/task text. The prescription license input and Save button align and adapt to a phone. Wording review separates subject, message, review context and the formatted email preview, with clear approval states and usable actions. Existing medicine-name selection, separate dosage, red removal controls and labelled follow-up colors were verified rather than rebuilt.

These are presentation improvements to existing workflows. They do not choose medicines, suggest a dose, approve wording automatically or change clinical decisions.

## Results and before/after

| QA | Result | Existing behavior and A6 change |
| --- | --- | --- |
| DEN-06 | COMPLETE — existing verified | Local common choices are medicine names; backend `PrescriptionController` supplies Owner-configured `common_medicines` strings separately from dosage. Verified the actual select with local names and a synthetic server name, blank dosage after name selection, custom medicine/dosage save, reload and edit. No medication catalog or dosing rule changed. |
| DEN-07 | COMPLETE — existing verified | `variant="danger"` already renders red. Verified normal, hover and keyboard-focus text contrast at least 4.5:1, visible focus and removal of only the selected line without form submission. Button is `type="button"`; no removal-specific disabled state currently exists. No styling or behavior change needed. |
| DEN-08 | COMPLETE — fixed | Explicit prescription-scoped flex layout prevents form styling from stretching the license Save control. Input and Save are 44px high, bottom-aligned on desktop; the action wraps below the input on a phone. Busy Save is disabled; successful/failed mocked API feedback and retained input verified. No license persistence or issued-prescription field changes. |
| DEN-09 | COMPLETE — existing verified | Open (amber), Contacted (blue), Booked (green), Closed (neutral), and separate Overdue (red) already have distinct labelled badges. Verified five distinct fills and text contrast at least 4.5:1. No new Done status, state transition or booking change. |
| DEN-01 | COMPLETE — fixed | Previous rules under `.dentist-command-grid` missed the schedule/task cards outside that grid. New `.dentist-home` scope covers all five requested areas: 26–34px main heading, 30px stat values, 15px stat captions, 22–28px next-patient name, 16px schedule/task primary text and 14px supporting text. Mobile rows/actions wrap. Counts, queue selection and navigation logic remain unchanged. |
| DEN-15 | COMPLETE — fixed | Reuses read-only `TemplateEditor`; shared Automations stays unchanged. Adds scoped 44px actions, clearer subject/body/preview spacing, revision and Dentist-review status, loading indicator, error/retry and unmount-safe initial loading. The editor remounts on revision/approval changes so stale content/error does not survive a successful review. Success feedback correctly describes Dentist review and the existing need for both approvals. |

## Role and permission considerations

No backend endpoint, authorization, branch scope, state machine, dispatch rule or prescribing logic changed. Existing prescription writing/license card remain Dentist-only; Staff/Owner views remain as before. Wording edits/test-send remain unavailable to the Dentist. The existing `dentist-approve` request sends `expected_revision` and requires explicit action. A mocked 409 does not approve; a successful response shows review complete and removes the approval control.

Read-only route inspection confirms wording listing/preview accepts Owner or Dentist, editing/Owner approval/test-send is Owner-only and `dentist-approve` is Dentist-only. Existing frontend role regression tests passed. No new server authorization acceptance or production governance validation is claimed.

Backend common names are configurable free-text strings under the existing names contract, not a medical terminology database. The default migration supplies an empty list and configuration validates string length/list shape. No real clinic configuration was queried and no unsafe dosage-stripping heuristic was introduced; Owner-entered catalog content still needs normal clinical governance.

## Actual tests and rendered evidence

```text
node --test tests/m19-prescriptions.test.js tests/m20-followups.test.js tests/automations.test.js tests/interview-r2.test.js tests/own01-dashboard-charts.test.js
28 passed; 0 failed

npm.cmd run build
Passed; existing bundle-size warning

node --check tests/dentist-ui-a6-rendered.mjs
git diff --check
Passed
```

Playwright MCP executed exported `runDentistA6(page)` from `tests/dentist-ui-a6-rendered.mjs` against Vite localhost:5178 and `tests/fixtures/dentist-ui-a6.html`. It intercepts every API/CSRF request. Both Section A and Section B passed all **four viewport/preference combinations**: **1440px/light, 1440px/dark, 390px/light, 390px/dark**. Additional wording empty, initial error/retry and preview error/retry cases passed.

Verified interactions include names/dosage separation, custom draft save/reload/edit, non-submitting red removal, 44px license alignment/busy/error/success, labelled status contrast, dashboard sizes/count/navigation, read-only sandboxed preview, manual revision-bound approval and refusal of stale approval. No horizontal document overflow in the tested clinical, home or wording views. Successful approval clears earlier errors. Screenshots were visually inspected for desktop typography/license alignment and the mobile wording layout.

**Theme boundary:** this checkout has no separate application dark theme or theme toggle. Browser dark OS preference retains the existing light application palette. Both preferences were exercised; this does not claim a newly implemented dark palette or global theme acceptance.

## Screenshots — Illustrative test data

All screenshots show synthetic fixture records, explicit **Illustrative test data** banners and no real Patient identities, license or financial information. Native fixture navigation is test scaffolding, not an application redesign.

| Screen | Desktop 1440px | Mobile 390px |
| --- | --- | --- |
| Clinic Home | [Desktop](defense/assets/dentist-ui-a6/home-1440.png) | [Mobile](defense/assets/dentist-ui-a6/home-390.png) |
| Prescription/license | [Desktop](defense/assets/dentist-ui-a6/clinical-1440.png) | [Mobile](defense/assets/dentist-ui-a6/clinical-390.png) |
| Follow-up status colors | [Desktop](defense/assets/dentist-ui-a6/followups-1440.png) | [Mobile](defense/assets/dentist-ui-a6/followups-390.png) |
| Wording review/preview | [Desktop](defense/assets/dentist-ui-a6/wording-1440.png) | [Mobile](defense/assets/dentist-ui-a6/wording-390.png) |

## Safety, ownership and limitations

No database tests or database connections were needed: API contracts and persistence behavior are exercised with deterministic browser mocks. No scratch environment was created, no protected database touched and no real emails sent. Reload acceptance means reading the saved synthetic API projection, not proven live PostgreSQL persistence. Existing backend behavior was not reimplemented.

No edits to Developer B's queue, staffing, leave, calendar, messaging files/tests or QA trackers. No edits to shared components, foundation CSS, layout, App routing, shared Automations, A5 Analytics files, scheduling or backend controllers. Styles are scoped to the three assigned screens. `QA-YZHEKIEL.md` changes only the six assigned entries and their summary checkboxes; original owner metadata remains intact.

Focused UI acceptance is complete. Full-suite/integration regression, live authenticated production acceptance and comprehensive accessibility certification remain outside this batch. No module maturity promotion or production release is claimed. The batch preserves existing clinical, financial and automation governance limitations and is published for review only.
