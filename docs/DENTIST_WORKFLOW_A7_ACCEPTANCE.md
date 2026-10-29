# Dentist workflow A7 acceptance

2026-10-29 (Asia/Manila). Implementer: Joevan. QA ownership remains Yzhekiel (DEN-02) and Richmon (GEN-09). Technical UI choices, not new clinic policy.

A6 was normally fast-forwarded from `848669b6bef655802389430f79d1698e9bbe3c0e` to `b46fa230f9f9335ec929f143eac0c7f08e2377f0`; remote SHA independently verified. A7 starts at that commit.

## DEN-02: complete for scoped rendered acceptance

Before: date controls shared the page-header aside; date identification depended on the compact native input and lower card heading. Timeline columns cramped long names and time ranges on phones.

After: a dedicated date navigation section shows the weekday and full Manila date. Previous/Today/Next form one group; labelled date input and Refresh remain adjacent on desktop and wrap on phones. Timeline stacks time above visit details on phones; names wrap and status labels remain separate. Empty date input cannot invalidate navigation. Past appointments remain viewable. Fixed the missing `isTodayQueue` import revealed by an assigned queue fixture.

## GEN-09: limited Dentist improvement; global status remains TODO

Counts measured using rendered production components and synthetic API responses at 1440px and 390px; no typing, scrolling or network waits count as clicks. These are interaction counts, not measured clinical time savings.

| Starting screen | Intended outcome | Before | After | Finding |
| --- | --- | ---: | ---: | --- |
| My Clinical Schedule | View adjacent day | 1 | 1 | Already efficient; retained |
| My Clinical Schedule on another date | Return to today | 1 | 1 | Already efficient; retained |
| Prescription list | Edit existing draft | 1 | 1 | Existing Edit draft retained |
| Open prescription draft review dialog | Edit that same draft | 2 | 1 | Close then Edit draft replaced by direct Edit draft |

The shortcut appears only for a Dentist when the fetched record is Draft and `can_edit`. It opens the existing editor, which reloads the record through the existing API. Save/issue controls, explicit issue confirmation, custom fields, revision validation, issued locking, void authority and license Save layout are unchanged. No clinical API or prescribing automation was added.

## Evidence

- `node --test tests/m19-prescriptions.test.js tests/clock.test.js`: 10 passed.
- `tests/dentist-workflow-a7-rendered.mjs` via Playwright MCP against Vite port 5178: passed at 1440px and 390px. Checks Previous/Today/Next, month/year boundaries both directions, calendar input, Refresh callback, past appointment visibility, sorted times, Pending filter, other-Dentist exclusion, walk-ins, keyboard Enter, 44px toolbar targets, page overflow and direct draft editing with custom values preserved.
- `node scripts/render-smoke.mjs`: passed; existing React list-key warning.
- Production build passed; existing bundle-size warning. `git diff --check` passed.
- All data synthetic. No database connections, backend tests or predefense environment checks were run; no verified disposable PostgreSQL environment was needed. Full suites intentionally omitted per batch instructions.

| View | Before | After |
| --- | --- | --- |
| Desktop schedule | [1440px](ui-review/dentist-a7/before-1440.png) | [1440px](ui-review/dentist-a7/after-1440.png) |
| Phone schedule | [390px](ui-review/dentist-a7/before-390.png) | [390px](ui-review/dentist-a7/after-390.png) |
| Existing draft editor | Existing editor retained | [Desktop](ui-review/dentist-a7/edit-1440.png), [phone](ui-review/dentist-a7/edit-390.png) |

Baseline schedule captures omit assigned queue entries because the pre-existing missing import crashed that case. Final fixture includes walk-ins, long names, several statuses, unsorted source times and another Dentist's excluded appointment. Screenshots render actual page components and production CSS in a labelled fixture, not the full authenticated shell. Native date input formatting follows browser locale; the selected-date heading uses explicit en-PH and Asia/Manila.

## Boundaries and remaining limitations

Zero Developer B file overlap. App, layout, components, global styles, Owner Analytics and backend unchanged. Appointment eligibility, assignments, booking and queue transitions unchanged. GEN-09 broader check-in, appointment, patient-record and prescription acceptance remains pending independent review. Hosted end-to-end acceptance, backend enforcement and intermediate viewport acceptance are not claimed here. GitHub CLI/PR connector unavailable; use the published branch comparison to open a development-integration PR. No merge or deployment authorized for A7.
