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
- [ ] STF-21 Messages: change the "add dentist" to "switch dentist"
- [ ] STF-22 Messages: use different chat bubble color for the sender and receiver
- [ ] STF-23 Messages: add search bar for messages
- [ ] STF-24 Messages: if not scrollable, make scrollable
- [ ] DEN-14 Messages: same changes as staff

**Batch RIC-3: Owner dashboard**
- [ ] OWN-01 Executive dashboard: add hoverable line graph + histogram. Line graph is hoverable and shows daily profit or revenue (choose the best term); histogram is the summary of the week, produced on Saturdays since it's the last opening day; make both hoverable with accurate revenue
- [ ] OWN-02 Branches: make the branch code a dropdown
- [ ] OWN-03 Branches: make the map pinnable instead of entering longitude and latitude
- [ ] OWN-04 Branches: fix UI (add colors)
- [ ] OWN-05 Make the closed option a button instead of checkbox
- [ ] OWN-06 Branches: make the services layout a 2x2 grid
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

  <revision id="STF-21" status="todo" severity="low" owner="Richmon">
    <tasks>
      - [ ] Rename the "Add dentist" action to "Switch dentist"
      - [ ] Make the behavior match the label (switch active conversation/dentist)
    </tasks>
    <acceptance>Label reads "Switch dentist" and switching works.</acceptance>
  </revision>

  <revision id="STF-22" status="todo" severity="medium" owner="Richmon">
    <tasks>
      - [ ] Use different chat bubble colors for sender and receiver (and alignment left/right)
      - [ ] Ensure text contrast passes in both
    </tasks>
    <acceptance>Sender and receiver bubbles are clearly distinct.</acceptance>
  </revision>

  <revision id="STF-23" status="todo" severity="medium" owner="Richmon" support="Joevan">
    <tasks>
      - [ ] Add a search bar for messages (shared search input from GEN-04)
      - [ ] (Joevan) Message search endpoint (by keyword and contact)
      - [ ] Highlight matches and show empty-state
    </tasks>
    <acceptance>Searching returns matching messages with highlights.</acceptance>
  </revision>

  <revision id="STF-24" status="todo" severity="medium" owner="Richmon">
    <tasks>
      - [ ] Make the message list/conversation scrollable when content overflows
      - [ ] Auto-scroll to the latest message
    </tasks>
    <acceptance>Long conversations and lists scroll correctly.</acceptance>
  </revision>

  <revision id="DEN-14" status="todo" severity="medium" owner="Richmon">
    <tasks>
      - [ ] Apply all STF-21 to STF-24 changes to the Dentist messages through shared components
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

  <revision id="OWN-01" status="todo" severity="high" owner="Richmon" support="Joevan">
    <tasks>
      - [ ] Line graph: daily revenue (recommended term; see Q2), hover tooltip shows exact date and amount
      - [ ] Histogram: weekly summary (per-day revenue Mon-Sat), generated on Saturday (last opening day), hover tooltip shows exact amount
      - [ ] Totals in tooltips must match billing records exactly
      - [ ] (Joevan) Aggregation endpoints for daily revenue and weekly summary; Saturday generation logic
      - [ ] Empty/loading/error states and responsive sizing
    </tasks>
    <acceptance>Both charts hoverable; values match billing data to the peso; histogram appears on Saturdays.</acceptance>
  </revision>

  <revision id="OWN-02" status="todo" severity="medium" owner="Richmon" support="Joevan">
    <tasks>
      - [ ] Change branch code input to a dropdown
      - [ ] (Joevan) Provide the allowed branch code list; prevent duplicates
    </tasks>
    <acceptance>Branch code is chosen from a dropdown; duplicates are blocked.</acceptance>
  </revision>

  <revision id="OWN-03" status="todo" severity="medium" owner="Richmon" support="Joevan">
    <tasks>
      - [ ] Replace longitude/latitude inputs with a pinnable map (click/drag pin)
      - [ ] Save coordinates automatically from the pin; show them read-only
      - [ ] (Joevan) Store/validate coordinates on the branch record
    </tasks>
    <acceptance>Branch location is set by pinning on the map; no manual lat/long entry.</acceptance>
  </revision>

  <revision id="OWN-04" status="todo" severity="medium" owner="Richmon">
    <tasks>
      - [ ] Branches UI: add colors per design tokens (cards, headers, statuses, actions)
    </tasks>
    <acceptance>Branches screen is colorful, readable, and consistent.</acceptance>
  </revision>

  <revision id="OWN-05" status="todo" severity="low" owner="Richmon">
    <tasks>
      - [ ] Replace the "Closed" checkbox with a button/toggle button with clear on/off state
    </tasks>
    <acceptance>Closed is a button with a clear active state.</acceptance>
  </revision>

  <revision id="OWN-06" status="todo" severity="low" owner="Richmon">
    <tasks>
      - [ ] Lay out services in a 2x2 grid; make it responsive
    </tasks>
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
