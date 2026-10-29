# QA SLICE: RICHMON (UI/UX)

> Self-contained slice of FINALS-QA-REVISIONS.md. Give Claude THIS file only, plus the context pack and the code files for the batch you are working on.
> **This file is the source of truth for Richmon's status.** Update `status` fields and tick checkboxes here.
> Master reference: FINALS-QA-REVISIONS.md (assumptions, default decisions, full matrix, other members' work).

---

## Your 7-Day Plan

- [ ] **Day 1:** GEN-08 (tokens + style guide), GEN-14 (shared calendar); merge EOD, unblocks everyone
- [ ] **Day 2:** OWN-07, OWN-08, OWN-09; start GEN-09 click audit
- [ ] **Day 3:** STF-21, STF-22, STF-23 (needs Joevan search Day 2), STF-24, DEN-14
- [ ] **Day 4:** OWN-04, OWN-05, OWN-06, OWN-10 (needs Q1 default)
- [ ] **Day 5:** OWN-01, OWN-02, OWN-03 (needs Joevan endpoints by end of Day 4); apply GEN-09 reductions
- [ ] **Day 6:** Support UI: OWN-11, OWN-12; cross-dashboard consistency audit (GEN-08 final)
- [ ] **Day 7:** Full regression on Owner dashboard + calendars; final retest; sign-off

**Feature freeze at end of Day 5.** Days 6 and 7 are fixes and regression only.

<dependencies>
  <you_need_from_others>Joevan: STF-23 search endpoint (Day 2), OWN-01/02/03 endpoints (Day 4). Answer to Q1 for OWN-10.</you_need_from_others>
  <others_need_from_you>Everyone: tokens + style guide + shared calendar (Day 1). Celin needs calendar for STF-01.</others_need_from_you>
</dependencies>

---

## Project Context Pack

<context_pack status="FILL BEFORE DAY 1">
  <stack>frontend: [framework] | backend: [framework] | database: [db] | hosting: [where]</stack>
  <repo>url: [repo url] | default branch: [main] | package manager: [npm/yarn/pnpm]</repo>
  <key_paths>
    staff_dashboard: [path]
    dentist_dashboard: [path]
    owner_dashboard: [path]
    shared_components: [path]
    dental_chart_component: [path]
    calendar_component: [path]
    api_routes: [path]
    db_schema_and_migrations: [path]
    auth_and_rbac: [path]
    notifications: [path]
    live_queue: [path]
  </key_paths>
  <commands>run: [cmd] | test: [cmd] | lint: [cmd] | build: [cmd] | migrate: [cmd]</commands>
  <roles>Owner (Dr Dana), Dentist, Staff. Confirm exact role names used in code.</roles>
  <test_accounts>owner: [..] | dentist: [..] | staff: [..]</test_accounts>
  <design_reference>[Figma link or screenshots folder]</design_reference>
  <attach_rule>When prompting Claude, attach the actual files from key_paths that the batch touches. Claude must not invent file paths, endpoints, or field names; if one is missing, it asks.</attach_rule>
</context_pack>

### Before Day 1 checklist
- [ ] Context pack filled in
- [ ] Open questions Q1 to Q5 answered, or the default decisions accepted
- [ ] Exact reproduction steps for DEN-03 (otherwise it is a blocker)
- [ ] Final list of remaining live queue statuses (STF-14)
- [ ] Screenshots or screen recordings for UI anomalies: GEN-04, GEN-06, STF-03/DEN-04
- [ ] Branches and test accounts ready for every role

---

## Working Agreement

<working_agreement>
  <source_of_truth>Each member updates status ONLY in their own slice file (QA-<NAME>.md). This master file is the reference; the lead syncs the Progress Summary at the end of each day. This avoids merge conflicts in one shared file.</source_of_truth>
  <shared_component_owners>
    Design tokens, style guide, calendar: Richmon
    Dropdown, buttons, dental chart: Yzhekiel
    Search input, X-clear filter, notif button, refresh icon, notifications UI: Celin
    Soft delete + archive RBAC service, approval automation: Jaztin
    Live queue model, branch scoping, notification/search/chart endpoints: Joevan
    Rule: do not edit a component you do not own. Log the request in the Blockers table instead.
  </shared_component_owners>
  <git>
    Branch: qa/<member>-<batch-id> (example: qa/jaztin-JAZ-1)
    One commit per revision ID, message: [ID] short title
    PR per batch; title: [BATCH] name; description lists IDs and acceptance results
    Foundation PRs (Day 1) are merged first; everyone rebases before starting Day 2
  </git>
  <cadence>
    15-minute sync at the start of each day: yesterday done, today plan, blockers.
    Feature freeze at end of Day 5. Days 6 and 7 are fixes and regression only.
    Any item not done by end of Day 5 is escalated to the lead at the Day 6 sync.
  </cadence>
</working_agreement>

---

<default_decisions>
  <note>If no answer is given before Day 1, Claude and the team proceed with these defaults. Anything marked CONFIRM is a proposal, not a fact from the QA notes.</note>
  <d id="Q1" item="OWN-10">Owner Work schedule reuses the staff schedule component and logic (STF-07, STF-08) and manages both dentists and staff (OWN-11).</d>
  <d id="Q2" item="OWN-01">Line graph = daily revenue. Histogram = per-day revenue Monday to Saturday, generated on Saturday.</d>
  <d id="Q3" item="STF-19">Provider names exactly as typed: Intellicare, Avega, InLife iCare, eTiQa, Dental Network.</d>
  <d id="Q4" item="GEN-11">RBAC as stated: Dr Dana sees all archives; Staff sees staff-created only; Dentist sees dentist-created only.</d>
  <d id="Q5" item="STF-13">Proposed walk-in design is accepted as written in the item.</d>
  <d id="STF-14" item="STF-14">CONFIRM: remaining queue statuses = In queue, In treatment, Done (keep any cancelled/no-show status that already exists).</d>
  <d id="STF-18" item="STF-18">Do not invent payment methods. Keep the existing options and only replace the "Invoice" wording with "Payment method".</d>
  <d id="DEN-03" item="DEN-03">BLOCKER until exact reproduction steps are added. Do not start without them.</d>
</default_decisions>

---

## 5. Instructions for Claude

<claude_instructions>
  1. Work only on the member and batch the user names. Read the whole batch first.
  2. Check `depends_on`. Build shared components once and reuse them across dashboards.
  3. Fix items in order. Stay within each item's scope and say so when you touch anything else.
  4. Satisfy every acceptance line before marking an item done. Flag anything unclear instead of guessing.
  5. UI standards: responsive (mobile/tablet/desktop), all states (hover, focus, active, disabled, loading, error), keyboard accessible, consistent with the shared design tokens.
  6. Backend standards: server-side validation, RBAC on every protected action, explicit error handling, no duplicate submissions, soft-delete only (see GEN-11), no secrets in logs.
  7. After the batch, run the batch verification and summarize changes per ID.
  8. Clarification protocol: if an item has `needs_clarification`, an unapproved `proposed_design`, or you lack a required file, stop and ask before coding. Never invent file paths, endpoints, or field names; find them in the attached code or ask.
  9. Keep changes small: one revision ID per commit, message `[ID] short title`. Do not edit components owned by another member (see Working Agreement); describe the needed change instead.
  10. Report format per ID: files changed, summary, how to test, acceptance results (pass/fail), and anything not done.
  11. Respect the schedule: do the ID order in the 7-day plan; flag any item that cannot finish that day.
</claude_instructions>

<global_dependencies>
  GEN-11 (archive + RBAC) must land before any delete UI is changed (STF-25, DEN-16, GEN-10 delete button).
  GEN-08 (design tokens) should land first so other UI work uses shared styles.
  GEN-14 (calendar component) feeds STF-01, OWN-07, OWN-08, OWN-09.
  STF-14/15 (queue model) must land before STF-16/17 and OWN-13.
  GEN-01 (approval automation) feeds STF-06, STF-11, DEN-15.
</global_dependencies>

---

## Definition of Done

<definition_of_done>
  A revision is `done` only when ALL are true:
  - [ ] Every task checkbox is ticked and every acceptance line passes
  - [ ] Works on Staff, Dentist, and Owner dashboards where the item applies ("same as" items reuse the shared component)
  - [ ] UI items: checked at mobile, tablet, desktop; all states present (hover, focus, disabled, loading, error); uses design tokens
  - [ ] Backend items: server-side validation, RBAC enforced, errors handled, tests added, no hard delete, no secrets in logs
  - [ ] No new console errors; build, lint, and tests pass
  - [ ] PR reviewed by one other member
  - [ ] Status set to done in the owner's slice file
</definition_of_done>

---

## Ready-to-Paste Prompts for Your Batches

Paste the context pack + this file, then use the prompt for the batch you are on.

**RIC-1 (Design system and calendar): items GEN-08, GEN-09, GEN-14, OWN-07, OWN-08, OWN-09**
```text
Work ONLY on batch RIC-1 (Design system and calendar): GEN-08, GEN-09, GEN-14, OWN-07, OWN-08, OWN-09.
Follow <claude_instructions> and the clarification protocol in this file.
Attached code: [attach the files from key_paths this batch touches]
Step 1: list your plan per ID and any blocking questions; wait for my go.
Step 2: implement one ID at a time.
Step 3: per ID report files changed, summary, how to test, acceptance pass/fail, not done.
```
**RIC-2 (Messages): items STF-21, STF-22, STF-23, STF-24, DEN-14**
```text
Work ONLY on batch RIC-2 (Messages): STF-21, STF-22, STF-23, STF-24, DEN-14.
Follow <claude_instructions> and the clarification protocol in this file.
Attached code: [attach the files from key_paths this batch touches]
Step 1: list your plan per ID and any blocking questions; wait for my go.
Step 2: implement one ID at a time.
Step 3: per ID report files changed, summary, how to test, acceptance pass/fail, not done.
```
**RIC-3 (Owner dashboard): items OWN-01, OWN-02, OWN-03, OWN-04, OWN-05, OWN-06, OWN-10**
```text
Work ONLY on batch RIC-3 (Owner dashboard): OWN-01, OWN-02, OWN-03, OWN-04, OWN-05, OWN-06, OWN-10.
Follow <claude_instructions> and the clarification protocol in this file.
Attached code: [attach the files from key_paths this batch touches]
Step 1: list your plan per ID and any blocking questions; wait for my go.
Step 2: implement one ID at a time.
Step 3: per ID report files changed, summary, how to test, acceptance pass/fail, not done.
```

For bug fixes, self-check before PR, and end-of-day status, use templates B, C, D in the master file (section 9).

---

# YOUR TASKS

<member_section name="Richmon" track="uiux" primary_count="18">

<task_list>
**Batch RIC-1: Design system and calendar**
- [x] GEN-08 !!! Make the UI consistent to all dashboards
- [ ] GEN-09 !!! Lessen the amount of clicks for users for easier navigation
- [x] GEN-14 !!! Make all calendar UI layout (appointments as only profile photo, 3 max displayable, any extra appointments will display as e.g. +2)
- [ ] OWN-07 Appointment calendar: same changes as staff
- [ ] OWN-08 Appointment calendar: make the past days greyed out (apply the same changes to all dashboards)
- [ ] OWN-09 Appointment calendar: make the appointment details layout better

**Batch RIC-2: Messages**
- [ ] STF-21 Messages: label already implemented; switch-to-new Dentist verified by Joevan; history/active-assignment semantics remain partial (see RIC-2 evidence).
- [x] STF-22 Messages: existing sender/receiver colors and alignment verified by Joevan in rendered browser checks.
- [x] STF-23 Messages: server search of authorized encrypted history, paginated matching-message view and safe highlights implemented/tested by Joevan.
- [x] STF-24 Messages: existing scroll containers verified; prepend position and new-arrival behavior corrected/tested by Joevan.
- [x] DEN-14 Messages: shared search/scroll/bubbles verified for Dentist, preserving Staff-only participant management.

**Batch RIC-3: Owner dashboard**
- [x] OWN-01 Owner Analytics: daily gross-collections line chart and Mon–Sat histogram connected to authoritative payment/refund APIs; exact tooltips/table, branch/period filters and Saturday status verified by Joevan (A4). See docs/OWN01_A4_ACCEPTANCE.md for on-demand/preview semantics.
- [x] OWN-02 Branches: existing dropdown and server/database uniqueness verified by Joevan (A3).
- [x] OWN-03 Branches: pin lifecycle, missing-location display and visual anchoring fixed; click/drag and coordinate persistence verified by Joevan (A3).
- [x] OWN-04 Branches: existing cards/status colors retained; scoped token contrast/focus/responsiveness verified by Joevan (A3).
- [x] OWN-05 Existing weekday Open/Closed button, last-open-day safeguard and persistence verified by Joevan (A3).
- [x] OWN-06 Existing services 2x2 desktop/single-column phone layout and service toggle verified by Joevan (A3).
- [ ] OWN-10 Work schedule: same changes as the staff (see Q1)

**Support tasks**
- [ ] GEN-08: review every other UI member's PRs against the design tokens
- [ ] OWN-11 (support Joevan): add "Staff" option UI to Work schedule
- [ ] OWN-12 (support Jaztin): Owner leave request UI
- [ ] STF-01 (support Celin): share the calendar component
</task_list>

<batch id="RIC-1" name="Design system and calendar" priority="high">
  <goal>One consistent design system and one shared calendar component used by all dashboards.</goal>
  <depends_on>none (do first; unblocks other UI members)</depends_on>

  <revision id="GEN-08" status="done" severity="high" owner="Richmon">
    <tasks>
      - [x] Audit all dashboards for inconsistent colors, spacing, typography, radii, and components
      - [x] Define shared design tokens (colors, spacing, type scale, radii) and shared components
      - [x] Apply to Staff, Dentist, and Owner dashboards; publish a short style guide in the repo
    </tasks>
    <acceptance>All dashboards share the same tokens and components with no visible style drift.</acceptance>
  </revision>

  <revision id="GEN-09" status="todo" severity="high" owner="Richmon">
    <tasks>
      - [ ] Map the most common user flows and count clicks for each
      - [ ] Reduce clicks (shortcuts, default selections, inline actions, fewer modals/steps)
      - [ ] Record before/after click counts per flow
    </tasks>
    <acceptance>Key flows (check-in, appointments, patient record, prescriptions) require measurably fewer clicks.</acceptance>
  </revision>

  <revision id="GEN-14" status="done" severity="high" owner="Richmon">
    <tasks>
      - [x] Build one shared calendar component for all dashboards
      - [x] Appointments display as profile photo only (avatar)
      - [x] Show a maximum of 3 avatars per day; extras collapse to "+N" (e.g. +2)
      - [x] Clicking "+N" or an avatar reveals the full list/details
    </tasks>
    <acceptance>Every calendar shows max 3 avatars per day with a "+N" overflow.</acceptance>
  </revision>

  <revision id="OWN-07" status="todo" severity="medium" owner="Richmon">
    <tasks>
      - [ ] Apply the staff calendar changes (STF-01 + GEN-14) to the Owner appointment calendar via the shared component
    </tasks>
    <acceptance>Owner calendar matches the staff calendar.</acceptance>
  </revision>

  <revision id="OWN-08" status="todo" severity="medium" owner="Richmon">
    <tasks>
      - [ ] Grey out past days in the shared calendar component
      - [ ] Keep past appointments viewable; apply to ALL dashboards
    </tasks>
    <acceptance>Past days are greyed out on Staff, Dentist, and Owner calendars.</acceptance>
  </revision>

  <revision id="OWN-09" status="todo" severity="medium" owner="Richmon">
    <tasks>
      - [ ] Redesign appointment details layout (patient, time, dentist, service, status)
      - [ ] Group info logically; consistent spacing; clear primary actions
    </tasks>
    <acceptance>Appointment details are clear and easy to scan.</acceptance>
  </revision>

  <batch_verification>
    - [ ] Calendar checked on all three dashboards
    - [ ] Style guide reviewed by all UI members
  </batch_verification>
</batch>

<batch id="RIC-2" name="Messages" priority="medium">
  <goal>Messages are easy to read, search, and scroll on staff and dentist dashboards.</goal>
  <depends_on>GEN-08</depends_on>

  <!-- Implementing developer: Joevan, authorized reassignment, 2026-10-29. See docs/RIC2_MESSAGING_ACCEPTANCE.md. -->
  <revision id="STF-21" status="partial" severity="low" owner="Richmon" implementer="Joevan">
    <tasks>
      - [x] Rename the "Add dentist" action to "Switch dentist" (already implemented, rendered verified)
      - [ ] Make the behavior match the label completely: switch to another eligible Dentist verified; existing deletion of non-author participant rows and timestamp-based active assignment remain unresolved. No participant/history mutation was introduced in this batch.
    </tasks>
    <acceptance>Label reads "Switch dentist" and switching works.</acceptance>
  </revision>

  <revision id="STF-22" status="done" severity="medium" owner="Richmon" implementer="Joevan">
    <tasks>
      - [x] Use different chat bubble colors for sender and receiver (and alignment left/right): existing styles verified
      - [x] Ensure text contrast passes in both: computed body and metadata contrast >= 4.5:1 in browser fixture
    </tasks>
    <acceptance>Sender and receiver bubbles are clearly distinct.</acceptance>
  </revision>

  <revision id="STF-23" status="done" severity="medium" owner="Richmon" support="Joevan" implementer="Joevan">
    <tasks>
      - [x] Existing shared search input now calls debounced server search, retaining drafts/selection
      - [x] Existing endpoints extended for authorized contact/metadata and encrypted message-body search, including older pages
      - [x] Safe highlights, empty/error states and paginated matching-message view verified
    </tasks>
    <acceptance>Searching returns matching messages with highlights.</acceptance>
  </revision>

  <revision id="STF-24" status="done" severity="medium" owner="Richmon" implementer="Joevan">
    <tasks>
      - [x] Existing overflow containers rendered verified at 390px/1440px with 25 conversations and 60 messages
      - [x] Latest-message scrolling retained for readers at bottom; history readers keep position with new-message indicator; older-page prepend preserves position
    </tasks>
    <acceptance>Long conversations and lists scroll correctly.</acceptance>
  </revision>

  <revision id="DEN-14" status="done" severity="medium" owner="Richmon" implementer="Joevan">
    <tasks>
      - [x] Shared search, bubbles, scroll and keyboard input rendered verified for Dentist; actual backend participation/branch permissions tested. Switch dentist remains Staff-only; STF-21 semantic limitations remain explicit.
    </tasks>
    <acceptance>Dentist messages match staff messages.</acceptance>
  </revision>

  <batch_verification>
    - [ ] Send/receive tested on both dashboards
    - [ ] Search and scroll work with long histories
  </batch_verification>
</batch>

<batch id="RIC-3" name="Owner dashboard" priority="high">
  <goal>Owner sees accurate hoverable analytics and a cleaner branch management UI.</goal>
  <depends_on>RIC-1; Joevan data endpoints for OWN-01, OWN-02, OWN-03</depends_on>

  <revision id="OWN-01" status="done" severity="high" owner="Richmon" support="Joevan" implementer="Joevan">
    <tasks>
      - [x] Owner Analytics daily gross-collections line chart follows current branch/report period; hover/focus/tap shows exact date, collections, refunds and net cash flow; accessible table provided
      - [x] Six-day Mon–Sat histogram appears on Saturday as in progress, with finalized status only from the existing server flag after Saturday. Earlier viewing requires explicit in-progress preview; historical week date selection supported
      - [x] API decimal amounts retained; BigInt-centavo validation/display reconciles gross/refunds/net without floating-point money accumulation; synthetic partial-refund records verified
      - [x] Existing daily/weekly endpoints and API clients reused; financial aggregation and authorization unchanged. Saturday summary is read-only/on-demand, not a new scheduled immutable-report job
      - [x] Loading/empty/error/retry, current-scope remounting, delayed-response rejection and 1440px/390px rendered acceptance passed
    </tasks>
    <evidence>A4: docs/OWN01_A4_ACCEPTANCE.md. Backend 5 tests/84 assertions; frontend 25 tests; rendered desktop/mobile and timing/error scenarios passed. Campaign example figures are excluded from authenticated financial reporting. No live financial data used.</evidence>
    <evidence>A5 (Joevan): added fixed Last 30 Days collections/arrival comparisons and scoped outstanding cards; weekly gross bars plus signed net line/markers. 30 focused Node tests and 6 PostgreSQL tests/96 assertions passed; 1440px/390px Playwright interaction, stale-response, baseline and retry cases passed. Synthetic screenshots and professor showcase: docs/defense/OWNER_ANALYTICS_FEATURE_SHOWCASE.md; technical evidence: docs/OWN01_A5_ACCEPTANCE.md. No production financial acceptance or immutable Saturday close claimed; A4 semantics preserved.</evidence>
    <acceptance>Both charts hoverable; values match billing data to the peso; histogram appears on Saturdays.</acceptance>
  </revision>

  <revision id="OWN-02" status="done" severity="medium" owner="Richmon" support="Joevan" implementer="Joevan">
    <tasks>
      - [x] Existing ALLOWED_BRANCH_CODES dropdown verified; in-use codes disabled; existing non-preset code preserved
      - [x] Existing server uniqueness validation and PostgreSQL unique constraint verified; valid code persists and reopens
    </tasks>
    <evidence>A3: docs/OWNER_BRANCH_A3_ACCEPTANCE.md; no code-list policy or new branch-creation flow invented.</evidence>
    <acceptance>Branch code is chosen from a dropdown; duplicates are blocked.</acceptance>
  </revision>

  <revision id="OWN-03" status="done" severity="medium" owner="Richmon" support="Joevan" implementer="Joevan">
    <tasks>
      - [x] Existing map retained; removed coordinate-driven teardown, loaded required Leaflet CSS and corrected double pin anchoring
      - [x] Click/drag updates read-only form coordinates; Publish saves them; missing locations show no invented pin
      - [x] Existing server coordinate validation/persistence verified; saved coordinates reopen correctly
    </tasks>
    <evidence>A3: actual Leaflet browser interaction at 1440px/390px plus isolated PostgreSQL coordinate round trip; no real clinic location changed.</evidence>
    <acceptance>Branch location is set by pinning on the map; no manual lat/long entry.</acceptance>
  </revision>

  <revision id="OWN-04" status="done" severity="medium" owner="Richmon" implementer="Joevan">
    <tasks>
      - [x] Existing cards/statuses/actions retained; branch-code badge uses existing brand tokens, keyboard focus/selection clarified, phone form layout scoped; computed badge/status contrast >= 4.5:1 verified
    </tasks>
    <evidence>A3: Owner rendered fixture at 1440px/390px; shared components and global styles unchanged.</evidence>
    <acceptance>Branches screen is colorful, readable, and consistent.</acceptance>
  </revision>

  <revision id="OWN-05" status="done" severity="low" owner="Richmon" implementer="Joevan">
    <tasks>
      - [x] Existing Open/Closed weekday button verified with aria-pressed and new weekday-specific accessible name; final operating day disabled; Publish persists weekday hours without changing branch operational status
    </tasks>
    <evidence>A3: browser weekday toggle/disabled-state check plus real PostgreSQL hours round trip.</evidence>
    <acceptance>Closed is a button with a clear active state.</acceptance>
  </revision>

  <revision id="OWN-06" status="done" severity="low" owner="Richmon" implementer="Joevan">
    <tasks>
      - [x] Existing two-column grid verified as 2x2 with four active services at 1440px and one column at 390px; existing server-confirmed service toggle and Owner-only write permission verified
    </tasks>
    <evidence>A3: rendered element geometry and isolated PostgreSQL service-toggle acceptance; no global grid rewrite.</evidence>
    <acceptance>Services display in a 2x2 grid on desktop.</acceptance>
  </revision>

  <revision id="OWN-10" status="todo" severity="medium" owner="Richmon" support="Jaztin">
    <tasks>
      - [ ] Apply the relevant staff changes to Owner Work schedule (needs Q1 answer)
    </tasks>
    <acceptance>Work schedule matches the agreed staff changes.</acceptance>
  </revision>

  <batch_verification>
    - [ ] Chart values reconciled against billing records
    - [ ] Branch create/edit tested with map pin and dropdown
  </batch_verification>
</batch>

</member_section>

## A7 GEN-09 partial evidence (2026-10-29)

Implementer: Joevan; QA owner remains Richmon. Global GEN-09 remains TODO. Rendered Dentist draft review to editing reduced from 2 clicks (Close, Edit draft) to 1 (Edit draft). Schedule adjacent-day/Today and list-to-edit already take 1 click and remain unchanged. No clinical decisions or confirmation removed. See [measurement and limitations](docs/DENTIST_WORKFLOW_A7_ACCEPTANCE.md).

## A8 GEN-09 partial Staff evidence (2026-10-29)

Implementer: Joevan; original QA owner: Richmon. Global GEN-09 remains TODO. Synthetic rendered appointment to exact Patient record: 2 to 1 control activations; selected Patient record to Patient-prefilled booking form: 3 to 1. Existing Patient selection state can reduce the old path already; no universal saving or production acceptance is claimed. Service/time selection and explicit booking confirmation remain required. See [A8 acceptance](docs/GEN09_A8_STAFF_WORKFLOW_ACCEPTANCE.md).
