# FINALS QA REVISIONS

> Final QA revision tracker, split by team member, with a task list per assignee and batches for development.
> Written for humans and for Claude. Hand Claude **one member + one batch** at a time.
> Original wording is preserved from the QA notes (only obvious typos fixed). `!!!` = flagged by the team as must-fix.

<qa_revisions project="[PROJECT NAME]" stage="finals" last_updated="[YYYY-MM-DD]">

---

## 1. Overview

<overview>
  <purpose>Resolve all QA findings across General, Staff, Dentist, and Owner dashboards before finals.</purpose>
  <sources>
    <source id="GEN" name="General revisions" count="14"/>
    <source id="STF" name="Staff dashboard" count="25"/>
    <source id="DEN" name="Dentist dashboard" count="16"/>
    <source id="OWN" name="Owner dashboard" count="13"/>
  </sources>
  <tracks>
    <track id="uiux" name="UI/UX" members="Celin, Yzhekiel, Richmon"/>
    <track id="backend" name="Functions / Backend / Logic Hardening" members="Jaztin, Joevan"/>
  </tracks>
  <totals total="68" done="13" in_progress="1" todo="53" blocked="1"/>
  <timeline>7 days. Feature freeze end of Day 5. Days 6 and 7 are fixes and regression.</timeline>
  <files>Master: FINALS-QA-REVISIONS.md. Per-member slices: QA-CELIN.md, QA-YZHEKIEL.md, QA-RICHMON.md, QA-JAZTIN.md, QA-JOEVAN.md. Give Claude ONE slice at a time.</files>
</overview>

---

## 2. Assumptions and Open Questions (read first)

<assumptions>
  <note>The QA notes only named one owner (DEN-03 -> Jaztin). All other assignments below are proposed by track and workload. Reassign by editing the owner field and moving the task line.</note>
  <note>Item IDs are `SOURCE-NN` using the numbering in the QA notes. The Dentist list had two items numbered 14; the second (Archives and Records) is numbered DEN-16 here.</note>
  <note>"Dr Dana" is treated as the top-level admin/owner role for archive RBAC (see GEN-11).</note>
</assumptions>

<open_questions>
  <q id="Q1" item="OWN-10">"Work schedule: same changes as the staff" - the Staff list has no Work Schedule section. Confirm which staff items apply (likely STF-08 Leave logic and STF-07 duty status).</q>
  <q id="Q2" item="OWN-01">Line graph: show daily revenue or daily profit? Recommendation: daily revenue (profit needs expense data). Weekly histogram is generated on Saturdays (last opening day); confirm it summarizes Mon-Sat per-day revenue.</q>
  <q id="Q3" item="STF-19">HMO list: Intellicare, Avega, InLife iCare, eTiQa, Dental Network. Confirm spellings and whether the list is final.</q>
  <q id="Q4" item="GEN-11">Confirm RBAC matrix: Dr Dana sees all archived items; Staff sees only staff-created items; Dentist sees only dentist-created items.</q>
  <q id="Q5" item="STF-13">Walk-in redesign was marked "let's brainstorm". A proposed flow is included in the item; approve or adjust before building.</q>
</open_questions>

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

## 3. Assignment Matrix

| ID | Title | Primary | Support | Flag |
|----|-------|---------|---------|:----:|
| GEN-01 | Approvals automated, fewer inputs | Jaztin | Celin | !!! |
| GEN-02 | Clear filters -> "X" | Celin | | !!! |
| GEN-03 | Notif button no outline | Celin | | !!! |
| GEN-04 | Search icon UI anomaly | Celin | | !!! |
| GEN-05 | Remove everything about kiosk | Joevan | Celin | !!! |
| GEN-06 | Fix dropdowns bug | Yzhekiel | | !!! |
| GEN-07 | "Other" -> "specify" | Yzhekiel | Jaztin | done |
| GEN-08 | Consistent UI across dashboards | Richmon | All UI | !!! |
| GEN-09 | Fewer clicks / easier navigation | Richmon | | !!! |
| GEN-10 | Notifications redesign | Celin | Joevan | !!! |
| GEN-11 | Delete = archive + Archives RBAC | Jaztin | Celin | !!! |
| GEN-12 | Readable, reasonable button sizes | Yzhekiel | | !!! |
| GEN-13 | Refresh button as icon | Celin | | !!! |
| GEN-14 | Calendar: avatars, 3 max, "+N" | Richmon | | !!! |
| STF-01 | Appointment calendar UI fix | Celin | Richmon | |
| STF-02 | Appointments search filter UI | Celin | | |
| STF-03 | Dental chart moving-teeth anomaly | Yzhekiel | | |
| STF-04 | ID selection "other valid ID" | Yzhekiel | Jaztin | done |
| STF-05 | Dental chart overall summary | Yzhekiel | Joevan | |
| STF-06 | Handovers automated | Jaztin | Yzhekiel | |
| STF-07 | "Doctor is on duty today" status | Jaztin | Celin | done |
| STF-08 | Leave: part-of-day date bug | Jaztin | | done |
| STF-09 | Closed dates search filter UI | Celin | | |
| STF-10 | Check in: remove double refresh | Celin | | |
| STF-11 | Check in: auto-confirm + cancel w/ reasons | Jaztin | Celin | done |
| STF-12 | Walk-in search: merge textbox + dropdown | Celin | | |
| STF-13 | Walk-in admission automation | Jaztin | Celin | |
| STF-14 | Live queue: remove statuses | Joevan | Celin | done |
| STF-15 | Live queue: remove urgent priority | Joevan | Celin | done |
| STF-16 | Live queue: clickable row, no open chart | Celin | | |
| STF-17 | Live queue: call + message icons | Celin | Joevan | |
| STF-18 | Billing: invoice -> payment method | Joevan | Celin | done |
| STF-19 | HMO providers | Joevan | Celin | done |
| STF-20 | Social inquiries: remove branch dropdown | Joevan | Celin | done |
| STF-21 | Messages: add dentist -> switch dentist | Richmon | | |
| STF-22 | Messages: sender/receiver bubble colors | Richmon | | |
| STF-23 | Messages: search bar | Richmon | Joevan | |
| STF-24 | Messages: make scrollable | Richmon | | |
| STF-25 | Archive and records: view action UI | Celin | | |
| DEN-01 | Clinic home: bigger texts | Yzhekiel | | |
| DEN-02 | My schedule: date layout | Yzhekiel | | |
| DEN-03 | My schedule: bug | Jaztin | Yzhekiel | |
| DEN-04 | Dental chart: moving-teeth anomaly | Yzhekiel | | |
| DEN-05 | Dental chart: add top view | Yzhekiel | | |
| DEN-06 | Prescription: remove dosage from dropdown | Yzhekiel | | |
| DEN-07 | Prescription: remove-medicine red | Yzhekiel | | |
| DEN-08 | Prescription: save button size | Yzhekiel | | |
| DEN-09 | Follow up care: status colors | Yzhekiel | | |
| DEN-10 | Patient records: "other" -> specify + example | Yzhekiel | | |
| DEN-11 | Handover: same as staff | Jaztin | Yzhekiel | |
| DEN-12 | My work hours: fix UI | Yzhekiel | | |
| DEN-13 | My leave: same as staff | Jaztin | Yzhekiel | done |
| DEN-14 | Messages: same as staff | Richmon | | |
| DEN-15 | Wording to approve: buttons, preview, UI | Yzhekiel | | |
| DEN-16 | Archives and records: same as staff | Celin | | |
| OWN-01 | Executive dashboard: line graph + histogram | Richmon | Joevan | |
| OWN-02 | Branches: branch code dropdown | Richmon | Joevan | |
| OWN-03 | Branches: pinnable map | Richmon | Joevan | |
| OWN-04 | Branches: fix UI (colors) | Richmon | | |
| OWN-05 | Closed option as button | Richmon | | |
| OWN-06 | Branches: services 2x2 grid | Richmon | | |
| OWN-07 | Appointment calendar: same as staff | Richmon | | |
| OWN-08 | Appointment calendar: grey past days (all dashboards) | Richmon | | |
| OWN-09 | Appointment details layout | Richmon | | |
| OWN-10 | Work schedule: same as staff | Richmon | Jaztin | done |
| OWN-11 | Work schedule: add Staff option | Joevan | Richmon | done |
| OWN-12 | Leave request: same as staff | Jaztin | Richmon | done |
| OWN-13 | Live queue by branch: same | Joevan | Celin | done |

---

## 4. Conventions

<conventions>
  <status_values>todo | in_progress | in_review | done | blocked | wontfix</status_values>
  <severity_values>
    <value name="critical">Breaks a core flow, data loss, security hole, or crash.</value>
    <value name="high">Major feature misbehaves, bug, or flagged !!! by the team.</value>
    <value name="medium">Noticeable issue or UX friction.</value>
    <value name="low">Polish or minor consistency.</value>
  </severity_values>
  <id_format>SOURCE-NN (GEN, STF, DEN, OWN)</id_format>
  <same_as_rule>"Same as staff" items must reuse the shared component/logic built for the staff item. Do not rebuild separately.</same_as_rule>
  <batch_rule>Finish and verify a batch before starting the next. Update status as you go, in your own slice file.</batch_rule>
</conventions>

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

---

## 6. Project Context Pack

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
- [x] Final list of remaining live queue statuses (STF-14)
- [ ] Screenshots or screen recordings for UI anomalies: GEN-04, GEN-06, STF-03/DEN-04
- [ ] Branches and test accounts ready for every role

---

## 7. Working Agreement

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

## 8. Seven-Day Plan

<seven_day_plan>
  <rule>Ordered by dependencies. Day 1 foundations unblock everyone. Feature freeze at end of Day 5.</rule>
</seven_day_plan>

### Day 1
**Team exit criteria:** Foundations merged: design tokens (GEN-08), shared calendar (GEN-14), archive/RBAC service (GEN-11), kiosk gone (GEN-05), queue model (STF-14/15), shared dropdown/button/filter/search/notif/refresh components.

- [ ] **Celin** (UI/UX): GEN-02, GEN-03, GEN-04, GEN-13 (shared X-clear, notif, search, refresh components; merge EOD)
- [ ] **Yzhekiel** (UI/UX): GEN-06, GEN-12 (shared dropdown + button components; merge EOD)
- [ ] **Richmon** (UI/UX): GEN-08 (tokens + style guide), GEN-14 (shared calendar); merge EOD, unblocks everyone
- [ ] **Jaztin** (Backend): GEN-11 (soft delete + archive RBAC service; merge EOD, unblocks all delete UIs)
- [ ] **Joevan** (Backend): GEN-05 (kiosk removal), STF-14, STF-15 (queue model; merge EOD for Celin)

### Day 2
**Team exit criteria:** Automation and endpoints delivered: approvals (GEN-01), handovers, notification/search/summary endpoints, dental chart fixed.

- [ ] **Celin** (UI/UX): STF-02, STF-09, STF-10; start GEN-10 UI skeleton with mock data
- [ ] **Yzhekiel** (UI/UX): GEN-07, STF-03, DEN-04 (shared dental chart fix)
- [ ] **Richmon** (UI/UX): OWN-07, OWN-08, OWN-09; start GEN-09 click audit
- [ ] **Jaztin** (Backend): GEN-01, STF-06, DEN-11
- [ ] **Joevan** (Backend): GEN-10 backend (notifications), STF-23 search endpoint, STF-05 summary endpoint

### Day 3
**Team exit criteria:** Check-in/walk-in logic, Messages, live queue UI, patient record UI done.

- [ ] **Celin** (UI/UX): GEN-10 (integrate Joevan endpoints + GEN-11 archive), STF-12, STF-16, STF-17
- [ ] **Yzhekiel** (UI/UX): STF-04, DEN-10, DEN-05, STF-05 UI (needs Joevan summary endpoint from Day 2)
- [ ] **Richmon** (UI/UX): STF-21, STF-22, STF-23 (needs Joevan search Day 2), STF-24, DEN-14
- [ ] **Jaztin** (Backend): STF-11, STF-13 (Q5 design must be approved before Day 3)
- [x] **Joevan** (Backend): STF-20, STF-18, STF-19, OWN-13

### Day 4
**Team exit criteria:** Dentist screens, Owner branches, leave/schedule logic, charts data endpoints merged.

- [ ] **Celin** (UI/UX): STF-01 (uses GEN-14), STF-25, DEN-16; STF-11 cancel modal UI (after Jaztin Day 3)
- [ ] **Yzhekiel** (UI/UX): DEN-01, DEN-02, DEN-06, DEN-07, DEN-08
- [ ] **Richmon** (UI/UX): OWN-04, OWN-05, OWN-06, OWN-10 (needs Q1 default)
- [ ] **Jaztin** (Backend): STF-08, DEN-13, OWN-12
- [x] **Joevan** (Backend): OWN-01 endpoints, OWN-02/OWN-03 data, OWN-11 (all merged by end of Day 4)

### Day 5
**Team exit criteria:** FEATURE COMPLETE. Every revision implemented. Feature freeze after today.

- [ ] **Celin** (UI/UX): Support UI: STF-13 walk-in, STF-07 badge, STF-18/19/20, OWN-13, GEN-05 UI leftovers
- [ ] **Yzhekiel** (UI/UX): DEN-09, DEN-12, DEN-15 (needs GEN-01 from Day 2)
- [ ] **Richmon** (UI/UX): OWN-01, OWN-02, OWN-03 (needs Joevan endpoints by end of Day 4); apply GEN-09 reductions
- [ ] **Jaztin** (Backend): STF-07 (needs Joevan OWN-11), DEN-03 (needs repro steps), OWN-10 support
- [ ] **Joevan** (Backend): Tests + hardening on all owned items; migrations dry-run on a copy of data

### Day 6
**Team exit criteria:** No new features. Hardening, integration bugs, consistency pass. All open blockers cleared.

- [ ] **Celin** (UI/UX): Integration bug fixes; consistency pass on owned components (no new features)
- [ ] **Yzhekiel** (UI/UX): Support UI: DEN-03, DEN-11, DEN-13 (after Jaztin); integration bug fixes
- [ ] **Richmon** (UI/UX): Support UI: OWN-11, OWN-12; cross-dashboard consistency audit (GEN-08 final)
- [ ] **Jaztin** (Backend): Hardening: tests, audit logs, edge cases across all owned items (no new features)
- [ ] **Joevan** (Backend): Bug fixes; performance check on chart queries (no new features)

### Day 7
**Team exit criteria:** Full regression across all three dashboards. Final sign-off.

- [ ] **Celin** (UI/UX): Full regression on Staff dashboard; final retest; sign-off
- [ ] **Yzhekiel** (UI/UX): Full regression on Dentist dashboard + dental chart; final retest; sign-off
- [ ] **Richmon** (UI/UX): Full regression on Owner dashboard + calendars; final retest; sign-off
- [ ] **Jaztin** (Backend): Backend regression (RBAC, check-in, leave, schedules); final retest; sign-off
- [ ] **Joevan** (Backend): Backend regression (queue, billing, HMO, kiosk search); final retest; sign-off

---

## 9. Prompt Templates

Use these with Claude. Paste the context pack and ONE slice, never the whole master file.

### A. Start a batch
```text
You are helping me finish QA revisions for [PROJECT].

CONTEXT PACK:
[paste filled context pack]

TASK FILE (my slice):
[paste QA-<NAME>.md, or the batch block you are working on]

Work ONLY on batch {BATCH_ID}: {ITEM_IDS}.
Follow <claude_instructions> and the clarification protocol.
Attached code: {FILES}

Step 1: Before coding, list your plan per revision ID and any questions that block you. Stop and wait if a question blocks you.
Step 2: After I say go, implement one revision ID at a time.
Step 3: For each ID report: files changed, what changed, how to test, acceptance results (pass/fail), and anything not done.
```

### B. Fix a bug found in testing
```text
Revision {ID} failed this acceptance check: "{CHECK}".
What I see: {OBSERVED}. Expected: {EXPECTED}. Steps: {STEPS}. Screenshot/log: {ATTACHMENT}.
Find the root cause first, explain it in two sentences, then fix it. Do not change anything outside {ID}'s scope. Add a regression test where possible.
```

### C. Self-check before PR
```text
Review my changes for batch {BATCH_ID} against every <acceptance> line and the <batch_verification> checklist in the task file.
List each check as pass/fail/unverified with evidence. Flag anything I changed outside scope, missing states (hover, focus, disabled, loading, error), missing RBAC checks, and any leftover hard delete or "kiosk" reference.
```

### D. End-of-day status
```text
Here is my slice file and today's merged changes.
Update the status field of each revision (todo / in_progress / in_review / done / blocked), tick completed task checkboxes, and return the updated file plus a 5-line summary: done, in progress, blocked, risks for tomorrow.
```

---

## 10. Definition of Done

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

# PART A: UI/UX TRACK

---

## Celin

<member_section name="Celin" track="uiux" primary_count="14">

<task_list>
**Batch CEL-1: Global UI components**
- [x] GEN-02 !!! All clear filters should be replaced with "X"
- [x] GEN-03 !!! Notif button should not have an outline
- [x] GEN-04 !!! Search icon: UI anomaly
- [x] GEN-13 !!! Make the refresh button as an icon
- [ ] GEN-10 !!! Notifications: make the notifications button better and its function such as delete button, and segregation of dates in notification so it's not cluttered

**Batch CEL-2: Staff dashboard UI**
- [x] STF-01 Appointment calendar UI fix (spacing, color)
- [x] STF-02 Appointments, search filter UI fix
- [x] STF-09 Closed dates: search filter UI fix
- [x] STF-10 Check in: remove the double refresh
- [x] STF-12 Check in: make the search filter for walk in patient efficient (make the find patient textbox and patient dropdown into one)
- [x] STF-16 Live queue: remove the open chart and just make the column clickable
- [x] STF-17 Live queue: make the "call patient" icon and add message icon
- [x] STF-25 Archive and records: fix view action UI

**Batch CEL-3: Dentist follow-through**
- [x] DEN-16 Archives and Records: same changes as staff

**Support tasks (UI side of other members' items)**
- [ ] GEN-01 (support Jaztin): remove redundant approval inputs from forms once automation is in
- [ ] GEN-05 (support Joevan): remove kiosk UI entries, menus, and labels
- [ ] GEN-11 (support Jaztin): archive view/restore UI, replace delete wording with "Archive"
- [x] STF-07 (support Jaztin): "Doctor is on duty today" badge UI
- [ ] STF-11 (support Jaztin): cancel-appointment button + reason dropdown modal
- [ ] STF-13 (support Jaztin): walk-in screen UI after brainstorm approval
- [x] STF-14/15 (support Joevan): remove deleted statuses/priority from queue UI
- [ ] STF-18/19/20 (support Joevan): payment method label, HMO list UI, branch dropdown removal
- [x] OWN-13 (support Joevan): apply live queue changes to by-branch view
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

  <revision id="STF-01" status="done" severity="medium" owner="Celin" support="Richmon">
    <tasks>
      - [x] Fix spacing in the appointment calendar
      - [x] Fix colors (use design tokens; keep contrast readable)
      - [x] Align with the shared calendar layout from GEN-14 (profile photo only, 3 max, "+N")
    </tasks>
    <acceptance>Calendar spacing and colors consistent with the design system and GEN-14.</acceptance>
  </revision>

  <revision id="STF-02" status="done" severity="medium" owner="Celin">
    <tasks>
      - [x] Fix Appointments search filter UI (alignment, spacing, field sizes)
      - [x] Use shared search input (GEN-04) and "X" clear (GEN-02)
    </tasks>
    <acceptance>Search filter is aligned and consistent with other filters.</acceptance>
  </revision>

  <revision id="STF-09" status="done" severity="medium" owner="Celin">
    <tasks>
      - [x] Fix Closed dates search filter UI
      - [x] Use shared search input and "X" clear
    </tasks>
    <acceptance>Closed dates filter matches the Appointments filter style.</acceptance>
  </revision>

  <revision id="STF-10" status="done" severity="medium" owner="Celin">
    <tasks>
      - [x] Find the two refresh controls/triggers on Check in
      - [x] Remove the duplicate; keep one icon refresh (GEN-13)
    </tasks>
    <acceptance>Check in has a single refresh and it works.</acceptance>
  </revision>

  <revision id="STF-12" status="done" severity="medium" owner="Celin">
    <tasks>
      - [x] Merge the "find patient" textbox and the patient dropdown into one searchable combobox
      - [x] Type-ahead results (name/phone), keyboard navigable, selects patient in one step
    </tasks>
    <acceptance>One field finds and selects a walk-in patient; the separate dropdown is gone.</acceptance>
  </revision>

  <revision id="STF-16" status="done" severity="medium" owner="Celin">
    <tasks>
      - [x] Remove the "Open chart" button/column from Live queue
      - [x] Make the row (column) clickable to open the chart; add hover/cursor state
    </tasks>
    <acceptance>Clicking a queue row opens the chart; no "Open chart" button remains.</acceptance>
  </revision>

  <revision id="STF-17" status="done" severity="medium" owner="Celin" support="Joevan">
    <tasks>
      - [x] Replace the "Call patient" text button with a call icon
      - [x] Add a message icon that opens a message to that patient
      - [x] Tooltips + aria-labels on both; reasonable tap size
    </tasks>
    <acceptance>Queue rows show call and message icons; both work.</acceptance>
  </revision>

  <revision id="STF-25" status="done" severity="medium" owner="Celin">
    <tasks>
      - [x] Fix the "view" action UI in Archive and records (button/icon size, alignment, label)
      - [x] Ensure it works with the RBAC-filtered archive from GEN-11
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
  <revision id="DEN-16" status="done" severity="medium" owner="Celin">
    <tasks>
      - [x] Apply the STF-25 changes to the Dentist Archives and Records
      - [x] Reuse the same component; dentist sees only dentist-created archives (GEN-11)
    </tasks>
    <acceptance>Dentist archives match staff UI and are RBAC-scoped.</acceptance>
  </revision>
  <batch_verification>
    - [ ] Dentist archive view matches staff view
  </batch_verification>
</batch>

</member_section>

---

## Yzhekiel

<member_section name="Yzhekiel" track="uiux" primary_count="17">

<task_list>
**Batch YZH-1: Global form and button fixes**
- [ ] GEN-06 !!! Fix dropdowns bug [BLOCKED: no reproducible case, waiting for the reporter]
- [ ] GEN-07 !!! If the choice is "other" add "specify"
- [x] GEN-12 !!! Fix the buttons (make the buttons readable and reasonable sizes)

**Batch YZH-2: Dental chart and patient record**
- [x] STF-03 Patient record: dental chart moving teeth anomaly
- [ ] STF-04 Patient record: patient summary: ID selection (when the choice is "other valid ID" there should be a "please specify") [PARTIAL: frontend specify field added; backend persistence pending]
- [x] STF-05 Patient record suggestion: overall summary of the dental chart instead of clicking the tooth one by one
- [x] DEN-04 Dental chart: dental chart moving teeth anomaly
- [x] DEN-05 Dental chart: add top view
- [x] DEN-10 Patient Records: if the choice is "other" add "specify" and add example

**Batch YZH-3: Dentist dashboard screens**
- [x] DEN-01 Clinic Home: make the texts bigger
- [x] DEN-02 My schedule: fix the date layout
- [x] DEN-06 Prescription: remove the dosage from the medicine dropdown
- [x] DEN-07 Prescription: make the remove medicine color red
- [x] DEN-08 Prescription: fix the save button size from the license number on my prescription
- [x] DEN-09 Follow up care: add color to the status
- [x] DEN-12 My work hours: fix the UI
- [x] DEN-15 Wording to approve: fix the button sizes, change the preview and make the UI consistent

**Support tasks**
- [ ] DEN-03 (support Jaztin): UI after the schedule bug is fixed
- [ ] STF-06 / DEN-11 (support Jaztin): handover UI after approval is removed
- [ ] DEN-13 (support Jaztin): leave UI changes
- [ ] STF-04 / GEN-07 (support Jaztin): server-side validation for required "specify"
</task_list>

<batch id="YZH-1" name="Global form and button fixes" priority="high">
  <goal>Dropdowns, "other/specify" fields, and buttons are reliable and consistent everywhere.</goal>
  <depends_on>GEN-08 preferred</depends_on>

  <revision id="GEN-06" status="blocked" blocked_reason="no reproducible case, waiting for the reporter" severity="high" owner="Yzhekiel">
    <tasks>
      - [ ] Reproduce and list all dropdown bugs (not opening, clipping, wrong value, not closing, z-index)
      - [ ] Fix in one shared dropdown component and apply to all dashboards
      - [ ] Verify selection, clearing, keyboard use, and scroll behavior
    </tasks>
    <acceptance>All dropdowns open, select, close, and clip correctly on every dashboard.</acceptance>
  </revision>

  <revision id="GEN-07" status="todo" severity="high" owner="Yzhekiel" support="Jaztin">
    <note>SelectWithOther exists in src/components.jsx and is used in Clinical.jsx (NewPatientModal), but other forms (e.g. Join.jsx, Family.jsx) still lack the specify field, and server-side validation is pending.</note>
    <tasks>
      - [ ] Find every dropdown that has an "Other" choice
      - [ ] When "Other" is chosen, show a required "Specify" text field (with placeholder example)
      - [ ] (Jaztin) Validate server-side: if "Other", specify text is required; store both values
      - [ ] Hide and clear the field when another option is selected
    </tasks>
    <acceptance>Every "Other" reveals a required "Specify" field; saving without it is blocked.</acceptance>
  </revision>

  <revision id="GEN-12" status="done" severity="high" owner="Yzhekiel">
    <tasks>
      - [x] Audit buttons for unreadable text, tiny or oversized sizes
      - [x] Define button sizes (sm/md/lg), minimum tap size, and readable font size
      - [x] Apply across all dashboards via shared button component
    </tasks>
    <acceptance>All buttons are readable, reasonably sized, and consistent.</acceptance>
  </revision>

  <batch_verification>
    - [ ] Spot-check forms on all three dashboards
    - [ ] Mobile and desktop widths
  </batch_verification>
</batch>

<batch id="YZH-2" name="Dental chart and patient record" priority="high">
  <goal>Dental chart is stable and richer; patient record forms handle "other" correctly.</goal>
  <depends_on>YZH-1</depends_on>

  <revision id="STF-03" status="done" severity="high" owner="Yzhekiel">
    <tasks>
      - [x] Reproduce the "moving teeth" anomaly (teeth shift/jump on hover, click, or render)
      - [x] Fix layout so teeth positions are fixed (no reflow on state/selection change)
      - [x] Fix in the shared dental chart component (also covers DEN-04)
    </tasks>
    <acceptance>Teeth never move when interacted with or when data loads.</acceptance>
  </revision>

  <revision id="STF-04" status="done" severity="medium" owner="Yzhekiel" support="Jaztin">
    <tasks>
      - [x] Patient summary ID selection: when "Other valid ID" is chosen, show "Please specify"
      - [x] Make it required; reuse GEN-07 pattern
    </tasks>
    <acceptance>"Other valid ID" shows a required "Please specify" field.</acceptance>
  </revision>

  <revision id="STF-05" status="done" severity="medium" owner="Yzhekiel" support="Joevan">
    <tasks>
      - [x] Add an overall dental chart summary view (all teeth with findings/treatments in one list)
      - [x] Group by condition/treatment; tapping an entry highlights the tooth
      - [x] (Joevan) Endpoint that returns chart data aggregated per patient
    </tasks>
    <acceptance>User can see the whole chart summary without clicking teeth one by one.</acceptance>
  </revision>

  <revision id="DEN-04" status="done" severity="high" owner="Yzhekiel">
    <tasks>
      - [x] Apply the STF-03 fix on the Dentist dental chart (same component)
    </tasks>
    <acceptance>No moving teeth in the dentist dental chart.</acceptance>
  </revision>

  <revision id="DEN-05" status="done" severity="medium" owner="Yzhekiel">
    <tasks>
      - [x] Add a top (occlusal) view toggle to the dental chart
      - [x] Tooth selection and findings stay in sync between views
    </tasks>
    <acceptance>Dentist can switch to top view and record findings there.</acceptance>
  </revision>

  <revision id="DEN-10" status="done" severity="medium" owner="Yzhekiel">
    <tasks>
      - [x] Patient Records: if the choice is "Other", show a "Specify" field
      - [x] Add an example placeholder text in the specify field
    </tasks>
    <acceptance>Every "Other" in Patient Records shows "Specify" with an example.</acceptance>
  </revision>

  <batch_verification>
    - [ ] Chart tested on staff and dentist views
    - [ ] Summary matches the per-tooth data
  </batch_verification>
</batch>

<batch id="YZH-3" name="Dentist dashboard screens" priority="medium">
  <goal>Dentist screens are readable and consistent.</goal>
  <depends_on>YZH-1</depends_on>

  <revision id="DEN-01" status="done" severity="medium" owner="Yzhekiel">
    <tasks>
      - [x] Increase text sizes on Clinic Home (headings, stats, list text)
    </tasks>
    <acceptance>Clinic Home text is clearly larger and readable.</acceptance>
  </revision>

  <revision id="DEN-02" status="done" severity="medium" owner="Yzhekiel">
    <tasks>
      - [x] Fix the My schedule date layout (alignment, order, spacing, format)
    </tasks>
    <acceptance>Dates are clearly laid out and consistent.</acceptance>
  </revision>

  <revision id="DEN-06" status="done" severity="medium" owner="Yzhekiel">
    <tasks>
      - [x] Remove the dosage text from the medicine dropdown options
    </tasks>
    <acceptance>Medicine dropdown shows only medicine names.</acceptance>
  </revision>

  <revision id="DEN-07" status="done" severity="low" owner="Yzhekiel">
    <tasks>
      - [x] Make the "remove medicine" control red (default and hover states)
    </tasks>
    <acceptance>Remove medicine is clearly red.</acceptance>
  </revision>

  <revision id="DEN-08" status="done" severity="medium" owner="Yzhekiel">
    <tasks>
      - [x] Fix the Save button size near the license number on My prescription
      - [x] Match the standard button size from GEN-12
    </tasks>
    <acceptance>Save button is correctly sized and aligned with the license number field.</acceptance>
  </revision>

  <revision id="DEN-09" status="done" severity="medium" owner="Yzhekiel">
    <tasks>
      - [ ] Add status colors in Follow up care (e.g. pending, done, overdue) with text labels
    </tasks>
    <acceptance>Each status has a distinct color plus label, readable in light and dark.</acceptance>
  </revision>

  <revision id="DEN-12" status="done" severity="medium" owner="Yzhekiel">
    <tasks>
      - [x] Fix the My work hours UI (layout, spacing, day rows, time inputs)
    </tasks>
    <acceptance>Work hours screen is clean and consistent with the design system.</acceptance>
  </revision>

  <revision id="DEN-15" status="done" severity="medium" owner="Yzhekiel">
    <tasks>
      - [x] Fix button sizes on Wording to approve
      - [x] Change the preview (clearer layout of the wording being approved)
      - [x] Make the UI consistent with the rest of the dentist dashboard
      - [x] Align with GEN-01 (fewer approval inputs)
    </tasks>
    <acceptance>Buttons are sized correctly, preview is improved, UI is consistent.</acceptance>
  </revision>

  <batch_verification>
    - [ ] Full dentist dashboard click-through
    - [ ] Text readable at all widths
  </batch_verification>
</batch>

</member_section>

---

## Richmon

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
- [x] STF-21 Messages: change the "add dentist" to "switch dentist"
- [x] STF-22 Messages: use different chat bubble color for the sender and receiver
- [x] STF-23 Messages: add search bar for messages
- [x] STF-24 Messages: if not scrollable, make scrollable
- [x] DEN-14 Messages: same changes as staff

**Batch RIC-3: Owner dashboard**
- [ ] OWN-01 Executive dashboard: add hoverable line graph + histogram. Line graph is hoverable and shows daily profit or revenue (choose the best term); histogram is the summary of the week, produced on Saturdays since it's the last opening day; make both hoverable with accurate revenue
- [x] OWN-02 Branches: make the branch code a dropdown
- [x] OWN-03 Branches: make the map pinnable instead of entering longitude and latitude
- [x] OWN-04 Branches: fix UI (add colors)
- [x] OWN-05 Make the closed option a button instead of checkbox
- [x] OWN-06 Branches: make the services layout a 2x2 grid
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

  <revision id="OWN-07" status="done" severity="medium" owner="Richmon">
    <tasks>
      - [x] Apply the staff calendar changes (STF-01 + GEN-14) to the Owner appointment calendar via the shared component
    </tasks>
    <acceptance>Owner calendar matches the staff calendar.</acceptance>
  </revision>

  <revision id="OWN-08" status="done" severity="medium" owner="Richmon">
    <tasks>
      - [x] Grey out past days in the shared calendar component
      - [x] Keep past appointments viewable; apply to ALL dashboards
    </tasks>
    <acceptance>Past days are greyed out on Staff, Dentist, and Owner calendars.</acceptance>
  </revision>

  <revision id="OWN-09" status="done" severity="medium" owner="Richmon">
    <tasks>
      - [x] Redesign appointment details layout (patient, time, dentist, service, status)
      - [x] Group info logically; consistent spacing; clear primary actions
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

  <revision id="STF-21" status="done" severity="low" owner="Richmon">
    <tasks>
      - [x] Rename the "Add dentist" action to "Switch dentist"
      - [x] Make the behavior match the label (switch active conversation/dentist)
    </tasks>
    <acceptance>Label reads "Switch dentist" and switching works.</acceptance>
  </revision>

  <revision id="STF-22" status="done" severity="medium" owner="Richmon">
    <tasks>
      - [x] Use different chat bubble colors for sender and receiver (and alignment left/right)
      - [x] Ensure text contrast passes in both
    </tasks>
    <acceptance>Sender and receiver bubbles are clearly distinct.</acceptance>
  </revision>

  <revision id="STF-23" status="done" severity="medium" owner="Richmon" support="Joevan">
    <tasks>
      - [x] Add a search bar for messages (shared search input from GEN-04)
      - [x] (Joevan) Message search endpoint (by keyword and contact)
      - [x] Highlight matches and show empty-state
    </tasks>
    <acceptance>Searching returns matching messages with highlights.</acceptance>
  </revision>

  <revision id="STF-24" status="done" severity="medium" owner="Richmon">
    <tasks>
      - [x] Make the message list/conversation scrollable when content overflows
      - [x] Auto-scroll to the latest message
    </tasks>
    <acceptance>Long conversations and lists scroll correctly.</acceptance>
  </revision>

  <revision id="DEN-14" status="done" severity="medium" owner="Richmon">
    <tasks>
      - [x] Apply all STF-21 to STF-24 changes to the Dentist messages through shared components
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

  <revision id="OWN-02" status="done" severity="medium" owner="Richmon" support="Joevan">
    <tasks>
      - [x] Change branch code input to a dropdown
      - [x] (Joevan) Provide the allowed branch code list; prevent duplicates
    </tasks>
    <acceptance>Branch code is chosen from a dropdown; duplicates are blocked.</acceptance>
  </revision>

  <revision id="OWN-03" status="done" severity="medium" owner="Richmon" support="Joevan">
    <tasks>
      - [x] Replace longitude/latitude inputs with a pinnable map (click/drag pin)
      - [x] Save coordinates automatically from the pin; show them read-only
      - [x] (Joevan) Store/validate coordinates on the branch record
    </tasks>
    <acceptance>Branch location is set by pinning on the map; no manual lat/long entry.</acceptance>
  </revision>

  <revision id="OWN-04" status="done" severity="medium" owner="Richmon">
    <tasks>
      - [x] Branches UI: add colors per design tokens (cards, headers, statuses, actions)
    </tasks>
    <acceptance>Branches screen is colorful, readable, and consistent.</acceptance>
  </revision>

  <revision id="OWN-05" status="done" severity="low" owner="Richmon">
    <tasks>
      - [x] Replace the "Closed" checkbox with a button/toggle button with clear on/off state
    </tasks>
    <acceptance>Closed is a button with a clear active state.</acceptance>
  </revision>

  <revision id="OWN-06" status="done" severity="low" owner="Richmon">
    <tasks>
      - [x] Lay out services in a 2x2 grid; make it responsive
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

---

# PART B: FUNCTIONS / BACKEND / LOGIC HARDENING TRACK

---

## Jaztin

<member_section name="Jaztin" track="backend" primary_count="11">

<task_list>
**Batch JAZ-1: Automation and archive RBAC**
- [ ] GEN-01 !!! Make sure all approvals are automations and lessen the inputs
- [ ] GEN-11 !!! Make sure that every delete is just archived and in Dr Dana archives, so archives will have an RBAC: for Dr Dana all deletions, for staff only staff things, and dentist as well
- [ ] STF-06 Handovers: make the handover automated (remove the approval)
- [ ] DEN-11 Handover: same as staff

**Batch JAZ-2: Check-in and walk-in automation**
- [ ] STF-11 Check in: confirmations should be automated but there should be an option to cancel it. Make sure staff requires the patient to provide a valid ID; there should be an option to cancel the appointment, and after clicking cancel appointment the reason dropdown should pop up with predefined reasons such as "no valid ID presented" and other reasons
- [ ] STF-13 Check in: in walk in admission there shouldn't be an existing registered patient and new patient registration; we want everything to be automated, let's brainstorm revisions for this

**Batch JAZ-3: Schedules and leave logic**
- [x] STF-07 Operations: should have a status "doctor is on duty today" based on work schedules
- [ ] STF-08 Leave: when only part of the day is checked, the until date and from date update
- [ ] DEN-03 My schedule: FIX DAH SHI (BUG)
- [ ] DEN-13 My leave: same changes as staff
- [ ] OWN-12 Leave request: same changes as staff

**Support tasks**
- [ ] GEN-07 (support Yzhekiel): server-side "specify required when Other" validation
- [ ] STF-04 (support Yzhekiel): validate "other valid ID" specify field
- [ ] OWN-10 (support Richmon): work schedule logic if Q1 requires it
</task_list>

<batch id="JAZ-1" name="Automation and archive RBAC" priority="high">
  <goal>Approvals and handovers run automatically; nothing is hard-deleted; archives are role-scoped.</goal>
  <depends_on>none (GEN-11 unblocks several UI items)</depends_on>

  <revision id="GEN-01" status="todo" severity="high" owner="Jaztin" support="Celin">
    <tasks>
      - [ ] Inventory every approval step and manual input in the system
      - [ ] Convert approvals into automatic rules (auto-approve when conditions are met; log the decision)
      - [ ] Remove redundant inputs; prefill from existing data
      - [ ] Keep an audit log of every automated approval
    </tasks>
    <hardening>Duplicate triggers, rule failures falling back safely, permission checks, audit trail.</hardening>
    <acceptance>No manual approval remains where automation is possible; fields are reduced; each automated decision is logged.</acceptance>
  </revision>

  <revision id="GEN-11" status="todo" severity="critical" owner="Jaztin" support="Celin">
    <tasks>
      - [ ] Replace all hard deletes with soft delete (archive) with deleted_by, deleted_at, deleted_role
      - [ ] Archive RBAC: Dr Dana sees all archived items and can restore/permanently remove; Staff sees only archives created by staff; Dentist sees only archives created by dentists (confirm in Q4)
      - [ ] Enforce RBAC server-side on list, view, and restore endpoints
      - [ ] Show everything archived in Dr Dana's archives
      - [ ] Make sure notifications delete (GEN-10) uses this logic
    </tasks>
    <hardening>Authorization bypass via direct ID access, cascading references, restore conflicts, audit log.</hardening>
    <acceptance>No record is permanently deleted by normal users; each role sees only permitted archives; Dr Dana sees all.</acceptance>
  </revision>

  <revision id="STF-06" status="todo" severity="medium" owner="Jaztin" support="Yzhekiel">
    <tasks>
      - [ ] Remove the approval step from Handovers; auto-complete on submit
      - [ ] Notify the receiving party and log the handover
    </tasks>
    <acceptance>Handover completes without approval and is logged.</acceptance>
  </revision>

  <revision id="DEN-11" status="todo" severity="medium" owner="Jaztin" support="Yzhekiel">
    <tasks>
      - [ ] Apply STF-06 logic to Dentist handovers using the same service
    </tasks>
    <acceptance>Dentist handovers match staff behavior.</acceptance>
  </revision>

  <batch_verification>
    - [ ] Each role tested against the archive RBAC matrix
    - [ ] Tests pass; no hard delete paths remain
  </batch_verification>
</batch>

<batch id="JAZ-2" name="Check-in and walk-in automation" priority="high">
  <goal>Check-in and walk-in admissions are automated with minimal staff input.</goal>
  <depends_on>JAZ-1</depends_on>

  <revision id="STF-11" status="todo" severity="high" owner="Jaztin" support="Celin">
    <tasks>
      - [ ] Auto-confirm check-in when appointment details are valid
      - [ ] Require staff to confirm the patient presented a valid ID before completing check-in
      - [ ] Add "Cancel appointment" option on check-in
      - [ ] After cancel, show a reason dropdown with predefined reasons, including "No valid ID presented" and other reasons
      - [ ] If "Other" is chosen, require "Specify" (GEN-07)
      - [ ] Cancel updates appointment status and notifies relevant users; log the reason
    </tasks>
    <hardening>Double check-in, check-in on cancelled appointments, wrong-branch check-in, race between staff users.</hardening>
    <acceptance>Check-in auto-confirms; ID presence enforced; cancel requires a reason that is stored.</acceptance>
  </revision>

  <revision id="STF-13" status="todo" severity="high" owner="Jaztin" support="Celin">
    <proposed_design status="needs approval (Q5)">
      One "Walk-in" screen: a single search/combobox (name or phone). If the patient exists, select and continue. If not, an inline "Add as new" reveals only the minimum fields (name, contact, ID type with "Other" specify). Submitting auto-creates the record, auto-checks-in, and auto-places them in the live queue. No separate "existing" vs "new patient registration" screens.
    </proposed_design>
    <tasks>
      - [ ] Remove the separate "existing registered patient" and "new patient registration" paths from walk-in admission
      - [ ] Implement unified find-or-create walk-in endpoint with duplicate detection (name + phone/birthdate)
      - [ ] Auto-create patient, auto check-in, auto-add to live queue in one transaction
      - [ ] Require valid ID info consistent with STF-11
    </tasks>
    <hardening>Duplicate patients, partial failure (patient created but not queued), validation of required minimum fields.</hardening>
    <acceptance>Walk-in is a single automated flow; no duplicate patients; patient ends up in queue.</acceptance>
  </revision>

  <batch_verification>
    - [ ] Appointment and walk-in flows tested end to end
    - [ ] Duplicate and failure cases tested
  </batch_verification>
</batch>

<batch id="JAZ-3" name="Schedules and leave logic" priority="high">
  <goal>Schedules, leave, and duty status are correct and consistent for Staff, Dentist, and Owner.</goal>
  <depends_on>none</depends_on>

  <revision id="STF-07" status="done" severity="medium" owner="Jaztin" support="Celin">
    <tasks>
      - [ ] Compute "Doctor is on duty today" from work schedules (account for leave and closed dates)
      - [ ] Expose status in Operations; update daily
    </tasks>
    <acceptance>Operations shows correct on-duty status per doctor per branch.</acceptance>
  </revision>

  <revision id="STF-08" status="todo" severity="high" owner="Jaztin">
    <tasks>
      - [ ] Reproduce: with "only part of the day" checked, the From/Until dates update incorrectly
      - [ ] Fix date and time handling for partial-day leave (single date, correct hours)
      - [ ] Validate that Until is not before From
    </tasks>
    <hardening>Time zones, overlapping leave, past dates.</hardening>
    <acceptance>Partial-day leave saves correct dates and times.</acceptance>
  </revision>

  <revision id="DEN-03" status="todo" severity="high" owner="Jaztin" support="Yzhekiel">
    <tasks>
      - [ ] Reproduce and identify the My schedule bug (details to be added by reporter)
      - [ ] Fix root cause and add a regression test
    </tasks>
    <needs_clarification>The QA note says only "FIX DAH SHI (BUG)". Add exact reproduction steps here.</needs_clarification>
    <acceptance>Bug no longer reproduces; regression test added.</acceptance>
  </revision>

  <revision id="DEN-13" status="todo" severity="medium" owner="Jaztin" support="Yzhekiel">
    <tasks>
      - [ ] Apply STF-08 (and related staff leave changes) to Dentist leave
    </tasks>
    <acceptance>Dentist leave matches staff behavior.</acceptance>
  </revision>

  <revision id="OWN-12" status="todo" severity="medium" owner="Jaztin" support="Richmon">
    <tasks>
      - [ ] Apply the staff leave changes to Owner Leave requests
    </tasks>
    <acceptance>Owner leave requests match staff behavior.</acceptance>
  </revision>

  <batch_verification>
    - [ ] Leave, schedule, and duty status tested together
    - [ ] Tests pass
  </batch_verification>
</batch>

</member_section>

---

## Joevan

<member_section name="Joevan" track="backend" primary_count="8">

<task_list>
**Batch JOE-1: Kiosk removal**
- [x] GEN-05 !!! Remove everything about kiosk

**Batch JOE-2: Live queue and branch scoping**
- [x] STF-14 Live queue: remove (waiting, called, treatment ready, temporarily away)
- [x] STF-15 Live queue: remove the urgent queue priority
- [x] STF-20 Social Inquiries: Record and Inquiry: remove the dropdown for choosing branch
- [x] OWN-13 Live queue by branch: same

**Batch JOE-3: Billing, HMO, and schedules**
- [x] STF-18 Billing and payment: remove the invoice and replace the text with payment method
- [x] STF-19 HMO providers (Intellicare, Avega, InLife iCare, eTiQa, and Dental Network)
- [x] OWN-11 Work schedule: add staff as option so it's dentist and staff

**Support tasks**
- [ ] GEN-10 (support Celin): notifications grouped-by-date and soft-delete endpoints
- [x] STF-05 (support Yzhekiel): aggregated dental chart summary endpoint
- [x] STF-23 (support Richmon): message search endpoint
- [x] OWN-01 (support Richmon): daily revenue and weekly summary endpoints
- [x] OWN-02 / OWN-03 (support Richmon): branch code list and coordinates storage
</task_list>

<batch id="JOE-1" name="Kiosk removal" priority="high">
  <goal>No trace of the kiosk remains in code, data, routes, or UI.</goal>
  <depends_on>none</depends_on>

  <revision id="GEN-05" status="done" severity="high" owner="Joevan" support="Celin">
    <tasks>
      - [x] Search the entire codebase for "kiosk" (routes, pages, components, APIs, DB tables/columns, enums, config, env, docs, seeds, tests)
      - [x] Remove or migrate each reference; handle existing data safely (migration + backup)
      - [x] (Celin) Remove kiosk menu items, buttons, labels, and settings from the UI
      - [x] Make sure queue and check-in flows still work without kiosk-originated entries
    </tasks>
    <hardening>Broken references, orphaned records, dead routes returning errors, migration rollback plan.</hardening>
    <acceptance>A repo-wide search for "kiosk" returns nothing; app builds and all flows pass.</acceptance>
  </revision>

  <batch_verification>
    - [x] Repo-wide search returns no matches (excluding historical/unalterable records)
    - [x] Build, tests, and migrations pass
  </batch_verification>
</batch>

<batch id="JOE-2" name="Live queue and branch scoping" priority="high">
  <goal>Simplified live queue model and automatic branch scoping.</goal>
  <depends_on>JOE-1</depends_on>

  <revision id="STF-14" status="done" severity="medium" owner="Joevan" support="Celin">
    <tasks>
      - [x] Remove the statuses: Waiting, Called, Treatment ready, Temporarily away
      - [x] Migrate existing queue entries to the remaining statuses; update status enums/validation
      - [x] Confirm with the team what the remaining queue statuses are before migration
      - [x] Make rollback in migration 2026_11_16_000500 loss-safe: aborts before DDL/data changes if unrepresentable statuses (Cancelled, No-show) exist; faithfully maps In Queue, In Treatment, Done; preserves append-only queue_entry_history untouched without rewriting history or disabling triggers (verified by QueueMigrationRollbackSafetyTest; migration unexecuted)
    </tasks>
    <acceptance>Removed statuses no longer exist in data or UI; existing entries are migrated cleanly.</acceptance>
  </revision>

  <revision id="STF-15" status="done" severity="medium" owner="Joevan" support="Celin">
    <tasks>
      - [x] Remove the urgent queue priority from data, logic, sorting, and UI
      - [x] Queue order becomes first-come-first-served
      - [x] Update queue priority test assertions in QueueTest.php for supported Priority value (statically verified)
    </tasks>
    <acceptance>No urgent priority anywhere; queue order is by arrival.</acceptance>
  </revision>

  <revision id="STF-20" status="done" severity="medium" owner="Joevan" support="Celin">
    <tasks>
      - [x] Social Inquiries (Record and Inquiry): remove the branch selection dropdown
      - [x] Auto-scope to the user's branch from the session
    </tasks>
    <acceptance>No branch dropdown; records are saved under the user's branch.</acceptance>
  </revision>

  <revision id="OWN-13" status="done" severity="medium" owner="Joevan" support="Celin">
    <tasks>
      - [x] Apply STF-14, STF-15, STF-16, STF-17 to Live queue by branch (owner view keeps the branch filter)
    </tasks>
    <acceptance>Owner live queue by branch matches staff queue behavior.</acceptance>
  </revision>

  <batch_verification>
    - [x] Queue tested across branches
    - [x] No leftover removed statuses or priority
  </batch_verification>
</batch>

<batch id="JOE-3" name="Billing, HMO, and schedules" priority="medium">
  <goal>Billing and HMO data are correct; work schedules support dentists and staff.</goal>
  <depends_on>none</depends_on>

  <revision id="STF-18" status="done" severity="medium" owner="Joevan" support="Celin">
    <tasks>
      - [x] Billing and payment: remove the "Invoice" text/option
      - [x] Replace it with "Payment method" (field and label)
      - [x] Confirm payment method options with the team (e.g. cash, card, HMO)
    </tasks>
    <acceptance>No "Invoice" wording; Payment method is shown and saved.</acceptance>
  </revision>

  <revision id="STF-19" status="done" severity="medium" owner="Joevan" support="Celin">
    <tasks>
      - [x] Add HMO providers: Intellicare, Avega, InLife iCare, eTiQa, Dental Network (see Q3)
      - [x] Store as a managed list (not hard-coded) and use in billing and patient records
    </tasks>
    <acceptance>All five HMO providers are selectable in billing and patient records.</acceptance>
  </revision>

  <revision id="OWN-11" status="done" severity="medium" owner="Joevan" support="Richmon">
    <tasks>
      - [x] Add "Staff" as a selectable option in Work schedule alongside Dentist
      - [x] Support schedules for both roles; feed STF-07 duty status
    </tasks>
    <hardening>Role-based permissions, overlapping schedules.</hardening>
    <acceptance>Work schedule can be set for dentists and staff.</acceptance>
  </revision>

  <batch_verification>
    - [x] Billing flow tested with each HMO and payment method
    - [x] Staff and dentist schedules save correctly
  </batch_verification>
</batch>

</member_section>

---

## 11. Cross-Track Dependencies

<cross_track_dependencies>
  <dependency ui="CEL GEN-10 delete button" backend="JAZ GEN-11" contract="Soft-delete/archive endpoint + RBAC"/>
  <dependency ui="CEL GEN-10 date groups" backend="JOE GEN-10 support" contract="Notifications grouped by date"/>
  <dependency ui="CEL STF-16/17" backend="JOE STF-14/15" contract="Final queue statuses and ordering"/>
  <dependency ui="CEL STF-12 / JAZ STF-13" backend="JAZ STF-13" contract="Find-or-create patient endpoint"/>
  <dependency ui="YZH STF-05" backend="JOE STF-05 support" contract="Aggregated chart summary response shape"/>
  <dependency ui="RIC OWN-01" backend="JOE OWN-01 support" contract="Daily revenue and weekly summary response shape"/>
  <dependency ui="RIC OWN-03" backend="JOE OWN-03 support" contract="Coordinate fields on branch"/>
  <dependency ui="RIC STF-23" backend="JOE STF-23 support" contract="Message search API"/>
</cross_track_dependencies>

---

## 12. Progress Summary

| Member | Track | Primary | Todo | In Progress | In Review | Done | Blocked |
|--------|-------|:-------:|:----:|:-----------:|:---------:|:----:|:-------:|
| Celin | UI/UX | 14 | 10 | 0 | 0 | 4 | 0 |
| Yzhekiel | UI/UX | 17 | 9 | 0 | 0 | 7 | 1 |
| Richmon | UI/UX | 18 | 16 | 0 | 0 | 2 | 0 |
| Jaztin | Backend | 11 | 11 | 0 | 0 | 0 | 0 |
| Joevan | Backend | 8 | 8 | 0 | 0 | 0 | 0 |
| **Total** | | **68** | **54** | 0 | 0 | **13** | **1** |

---

## 13. Daily Log and Blockers

### Blockers
| # | Day | Raised by | Item | Blocked on | Owner of fix | Status |
|---|-----|-----------|------|------------|--------------|--------|
| 1 | Day 1 | Yzhekiel | GEN-06 | No reproducible case in native selects or cards; waiting for reporter reproduction | Yzhekiel | open |

### Daily log
| Day | Done today | In progress | Risks for tomorrow | Logged by |
|-----|------------|-------------|--------------------|-----------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |
| 7 | | | | |

---

## 14. Final Sign-Off

<final_signoff>
  - [ ] All 68 revisions done and verified
  - [ ] All !!! items confirmed fixed on Staff, Dentist, and Owner dashboards
  - [ ] No hard deletes remain; archive RBAC verified for Dr Dana, Staff, Dentist
  - [ ] Repo-wide search for "kiosk" returns nothing
  - [ ] Open questions Q1-Q5 resolved
  - [ ] Full regression pass on core flows (appointments, check-in, queue, billing, prescriptions, messages)
  - [ ] Final QA re-test approved by: [name] on [date]
</final_signoff>

</qa_revisions>
