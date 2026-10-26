# QA SLICE: CELIN (UI/UX)

> Self-contained slice of FINALS-QA-REVISIONS.md. Give Claude THIS file only, plus the context pack and the code files for the batch you are working on.
> **This file is the source of truth for Celin's status.** Update `status` fields and tick checkboxes here.
> Master reference: FINALS-QA-REVISIONS.md (assumptions, default decisions, full matrix, other members' work).

---

## Your 7-Day Plan

- [ ] **Day 1:** GEN-02, GEN-03, GEN-04, GEN-13 (shared X-clear, notif, search, refresh components; merge EOD)
- [ ] **Day 2:** STF-02, STF-09, STF-10; start GEN-10 UI skeleton with mock data
- [ ] **Day 3:** GEN-10 (integrate Joevan endpoints + GEN-11 archive), STF-12, STF-16, STF-17
- [ ] **Day 4:** STF-01 (uses GEN-14), STF-25, DEN-16; STF-11 cancel modal UI (after Jaztin Day 3)
- [ ] **Day 5:** Support UI: STF-13 walk-in, STF-07 badge, STF-18/19/20, OWN-13, GEN-05 UI leftovers
- [ ] **Day 6:** Integration bug fixes; consistency pass on owned components (no new features)
- [ ] **Day 7:** Full regression on Staff dashboard; final retest; sign-off

**Feature freeze at end of Day 5.** Days 6 and 7 are fixes and regression only.

<dependencies>
  <you_need_from_others>Richmon: GEN-08 tokens + GEN-14 calendar (Day 1). Jaztin: GEN-11 archive service (Day 1), STF-11/13 (Day 3). Joevan: STF-14/15 queue model (Day 1), notification endpoints (Day 2).</you_need_from_others>
  <others_need_from_you>Everyone: shared X-clear, notif button, search input, refresh icon (Day 1).</others_need_from_you>
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

**CEL-1 (Global UI components): items GEN-02, GEN-03, GEN-04, GEN-13, GEN-10**
```text
Work ONLY on batch CEL-1 (Global UI components): GEN-02, GEN-03, GEN-04, GEN-13, GEN-10.
Follow <claude_instructions> and the clarification protocol in this file.
Attached code: [attach the files from key_paths this batch touches]
Step 1: list your plan per ID and any blocking questions; wait for my go.
Step 2: implement one ID at a time.
Step 3: per ID report files changed, summary, how to test, acceptance pass/fail, not done.
```
**CEL-2 (Staff dashboard UI): items STF-01, STF-02, STF-09, STF-10, STF-12, STF-16, STF-17, STF-25**
```text
Work ONLY on batch CEL-2 (Staff dashboard UI): STF-01, STF-02, STF-09, STF-10, STF-12, STF-16, STF-17, STF-25.
Follow <claude_instructions> and the clarification protocol in this file.
Attached code: [attach the files from key_paths this batch touches]
Step 1: list your plan per ID and any blocking questions; wait for my go.
Step 2: implement one ID at a time.
Step 3: per ID report files changed, summary, how to test, acceptance pass/fail, not done.
```
**CEL-3 (Dentist follow-through): items DEN-16**
```text
Work ONLY on batch CEL-3 (Dentist follow-through): DEN-16.
Follow <claude_instructions> and the clarification protocol in this file.
Attached code: [attach the files from key_paths this batch touches]
Step 1: list your plan per ID and any blocking questions; wait for my go.
Step 2: implement one ID at a time.
Step 3: per ID report files changed, summary, how to test, acceptance pass/fail, not done.
```

For bug fixes, self-check before PR, and end-of-day status, use templates B, C, D in the master file (section 9).

---

# YOUR TASKS

<member_section name="Celin" track="uiux" primary_count="14">

<task_list>
**Batch CEL-1: Global UI components**
- [x] GEN-02 !!! All clear filters should be replaced with "X"
- [x] GEN-03 !!! Notif button should not have an outline
- [x] GEN-04 !!! Search icon: UI anomaly
- [x] GEN-13 !!! Make the refresh button as an icon
- [ ] GEN-10 !!! Notifications: make the notifications button better and its function such as delete button, and segregation of dates in notification so it's not cluttered

**Batch CEL-2: Staff dashboard UI**
- [ ] STF-01 Appointment calendar UI fix (spacing, color)
- [ ] STF-02 Appointments, search filter UI fix
- [ ] STF-09 Closed dates: search filter UI fix
- [ ] STF-10 Check in: remove the double refresh
- [ ] STF-12 Check in: make the search filter for walk in patient efficient (make the find patient textbox and patient dropdown into one)
- [ ] STF-16 Live queue: remove the open chart and just make the column clickable
- [ ] STF-17 Live queue: make the "call patient" icon and add message icon
- [ ] STF-25 Archive and records: fix view action UI

**Batch CEL-3: Dentist follow-through**
- [ ] DEN-16 Archives and Records: same changes as staff

**Support tasks (UI side of other members' items)**
- [ ] GEN-01 (support Jaztin): remove redundant approval inputs from forms once automation is in
- [ ] GEN-05 (support Joevan): remove kiosk UI entries, menus, and labels
- [ ] GEN-11 (support Jaztin): archive view/restore UI, replace delete wording with "Archive"
- [ ] STF-07 (support Jaztin): "Doctor is on duty today" badge UI
- [ ] STF-11 (support Jaztin): cancel-appointment button + reason dropdown modal
- [ ] STF-13 (support Jaztin): walk-in screen UI after brainstorm approval
- [ ] STF-14/15 (support Joevan): remove deleted statuses/priority from queue UI
- [ ] STF-18/19/20 (support Joevan): payment method label, HMO list UI, branch dropdown removal
- [ ] OWN-13 (support Joevan): apply live queue changes to by-branch view
</task_list>

<batch id="CEL-1" name="Global UI components" priority="high">
  <goal>Shared controls (filters, notif, search, refresh) look and behave consistently on every dashboard.</goal>
  <depends_on>GEN-08 (design tokens) preferred</depends_on>

  <revision id="GEN-02" status="done" severity="high" owner="Celin">
    <tasks>
      - [x] Find every "Clear filters" / "Clear" control across all dashboards
      - [x] Replace each with an "X" icon button (shared component)
      - [x] Add tooltip/aria-label "Clear filters"; only show when a filter is active
    </tasks>
    <acceptance>"X" appears everywhere clear-filter existed; clicking resets filters; no text "Clear filters" remains.</acceptance>
  </revision>

  <revision id="GEN-03" status="done" severity="high" owner="Celin">
    <tasks>
      - [x] Remove the outline/border on the notification button in all dashboards
      - [x] Keep an accessible focus indicator that is not a heavy outline (e.g. subtle focus ring on keyboard focus only)
    </tasks>
    <acceptance>Notif button has no outline in default, hover, and click states on every dashboard.</acceptance>
  </revision>

  <revision id="GEN-04" status="done" severity="high" owner="Celin">
    <tasks>
      - [x] Reproduce the search icon anomaly (alignment, overlap with text, size, clipping)
      - [x] Fix icon position/size inside every search input; make one shared search input component
    </tasks>
    <acceptance>Search icon is aligned, not overlapping typed text, and identical on all dashboards.</acceptance>
  </revision>

  <revision id="GEN-13" status="done" severity="medium" owner="Celin">
    <tasks>
      - [x] Replace every text "Refresh" button with a refresh icon button
      - [x] Add tooltip + aria-label; show a spin/loading state while refreshing
    </tasks>
    <acceptance>No text refresh buttons remain; icon triggers refresh with visible loading state.</acceptance>
  </revision>

  <revision id="GEN-10" status="todo" severity="high" owner="Celin" support="Joevan">
    <tasks>
      - [ ] Redesign the notifications button (badge count, no outline per GEN-03, clear hover state)
      - [ ] Add a delete button per notification (uses archive logic from GEN-11, not hard delete)
      - [ ] Segregate notifications by date (Today, Yesterday, Earlier / by date headers) so the list is not cluttered
      - [ ] (Joevan) Provide notifications endpoint grouped/sorted by date and a soft-delete endpoint
      - [ ] Add mark-as-read and "clear all" only if it does not add clutter
    </tasks>
    <acceptance>Notifications grouped under date headers; each can be removed (archived); button looks consistent and outline-free.</acceptance>
  </revision>

  <batch_verification>
    - [ ] Checked on Staff, Dentist, and Owner dashboards
    - [ ] Mobile / tablet / desktop widths
    - [ ] Keyboard focus visible and no new console errors
  </batch_verification>
</batch>

<batch id="CEL-2" name="Staff dashboard UI" priority="medium">
  <goal>Staff screens (calendar, filters, check-in, live queue, archives) are clean and faster to use.</goal>
  <depends_on>CEL-1, GEN-14, STF-14, STF-15</depends_on>

  <revision id="STF-01" status="todo" severity="medium" owner="Celin" support="Richmon">
    <tasks>
      - [ ] Fix spacing in the appointment calendar
      - [ ] Fix colors (use design tokens; keep contrast readable)
      - [ ] Align with the shared calendar layout from GEN-14 (profile photo only, 3 max, "+N")
    </tasks>
    <acceptance>Calendar spacing and colors consistent with the design system and GEN-14.</acceptance>
  </revision>

  <revision id="STF-02" status="todo" severity="medium" owner="Celin">
    <tasks>
      - [ ] Fix Appointments search filter UI (alignment, spacing, field sizes)
      - [ ] Use shared search input (GEN-04) and "X" clear (GEN-02)
    </tasks>
    <acceptance>Search filter is aligned and consistent with other filters.</acceptance>
  </revision>

  <revision id="STF-09" status="todo" severity="medium" owner="Celin">
    <tasks>
      - [ ] Fix Closed dates search filter UI
      - [ ] Use shared search input and "X" clear
    </tasks>
    <acceptance>Closed dates filter matches the Appointments filter style.</acceptance>
  </revision>

  <revision id="STF-10" status="todo" severity="medium" owner="Celin">
    <tasks>
      - [ ] Find the two refresh controls/triggers on Check in
      - [ ] Remove the duplicate; keep one icon refresh (GEN-13)
    </tasks>
    <acceptance>Check in has a single refresh and it works.</acceptance>
  </revision>

  <revision id="STF-12" status="todo" severity="medium" owner="Celin">
    <tasks>
      - [ ] Merge the "find patient" textbox and the patient dropdown into one searchable combobox
      - [ ] Type-ahead results (name/phone), keyboard navigable, selects patient in one step
    </tasks>
    <acceptance>One field finds and selects a walk-in patient; the separate dropdown is gone.</acceptance>
  </revision>

  <revision id="STF-16" status="todo" severity="medium" owner="Celin">
    <tasks>
      - [ ] Remove the "Open chart" button/column from Live queue
      - [ ] Make the row (column) clickable to open the chart; add hover/cursor state
    </tasks>
    <acceptance>Clicking a queue row opens the chart; no "Open chart" button remains.</acceptance>
  </revision>

  <revision id="STF-17" status="todo" severity="medium" owner="Celin" support="Joevan">
    <tasks>
      - [ ] Replace the "Call patient" text button with a call icon
      - [ ] Add a message icon that opens a message to that patient
      - [ ] Tooltips + aria-labels on both; reasonable tap size
    </tasks>
    <acceptance>Queue rows show call and message icons; both work.</acceptance>
  </revision>

  <revision id="STF-25" status="todo" severity="medium" owner="Celin">
    <tasks>
      - [ ] Fix the "view" action UI in Archive and records (button/icon size, alignment, label)
      - [ ] Ensure it works with the RBAC-filtered archive from GEN-11
    </tasks>
    <acceptance>View action is clear, correctly sized, and opens the archived record.</acceptance>
  </revision>

  <batch_verification>
    - [ ] Full staff dashboard click-through
    - [ ] Check-in, queue, and archive flows work end to end
  </batch_verification>
</batch>

<batch id="CEL-3" name="Dentist follow-through" priority="low">
  <depends_on>STF-25</depends_on>
  <revision id="DEN-16" status="todo" severity="medium" owner="Celin">
    <tasks>
      - [ ] Apply the STF-25 changes to the Dentist Archives and Records
      - [ ] Reuse the same component; dentist sees only dentist-created archives (GEN-11)
    </tasks>
    <acceptance>Dentist archives match staff UI and are RBAC-scoped.</acceptance>
  </revision>
  <batch_verification>
    - [ ] Dentist archive view matches staff view
  </batch_verification>
</batch>

</member_section>
