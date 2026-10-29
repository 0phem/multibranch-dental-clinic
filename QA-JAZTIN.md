# QA SLICE: JAZTIN (Backend)

> Self-contained slice of FINALS-QA-REVISIONS.md. Give Claude THIS file only, plus the context pack and the code files for the batch you are working on.
> **This file is the source of truth for Jaztin's status.** Update `status` fields and tick checkboxes here.
> Master reference: FINALS-QA-REVISIONS.md (assumptions, default decisions, full matrix, other members' work).

---

## Your 7-Day Plan

- [ ] **Day 1:** GEN-11 (soft delete + archive RBAC service; merge EOD, unblocks all delete UIs)
- [ ] **Day 2:** GEN-01, STF-06, DEN-11
- [ ] **Day 3:** STF-11, STF-13 (Q5 design must be approved before Day 3)
- [ ] **Day 4:** STF-08, DEN-13, OWN-12
- [ ] **Day 5:** STF-07 (Developer B B5 complete); DEN-03 still needs repro steps, OWN-10 support remains separate
- [ ] **Day 6:** Hardening: tests, audit logs, edge cases across all owned items (no new features)
- [ ] **Day 7:** Backend regression (RBAC, check-in, leave, schedules); final retest; sign-off

**Feature freeze at end of Day 5.** Days 6 and 7 are fixes and regression only.

<dependencies>
  <you_need_from_others>Joevan: OWN-11 (Day 4) for STF-07. Team: approval of Q4/Q5 defaults before Day 1-3; exact repro for DEN-03 before Day 5.</you_need_from_others>
  <others_need_from_you>Celin/Yzhekiel/Richmon: archive service (Day 1), automation (Day 2), check-in/walk-in (Day 3), leave logic (Day 4).</others_need_from_you>
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

**JAZ-1 (Automation and archive RBAC): items GEN-01, GEN-11, STF-06, DEN-11**
```text
Work ONLY on batch JAZ-1 (Automation and archive RBAC): GEN-01, GEN-11, STF-06, DEN-11.
Follow <claude_instructions> and the clarification protocol in this file.
Attached code: [attach the files from key_paths this batch touches]
Step 1: list your plan per ID and any blocking questions; wait for my go.
Step 2: implement one ID at a time.
Step 3: per ID report files changed, summary, how to test, acceptance pass/fail, not done.
```
**JAZ-2 (Check-in and walk-in automation): items STF-11, STF-13**
```text
Work ONLY on batch JAZ-2 (Check-in and walk-in automation): STF-11, STF-13.
Follow <claude_instructions> and the clarification protocol in this file.
Attached code: [attach the files from key_paths this batch touches]
Step 1: list your plan per ID and any blocking questions; wait for my go.
Step 2: implement one ID at a time.
Step 3: per ID report files changed, summary, how to test, acceptance pass/fail, not done.
```
**JAZ-3 (Schedules and leave logic): items STF-07, STF-08, DEN-03, DEN-13, OWN-12**
```text
Work ONLY on batch JAZ-3 (Schedules and leave logic): STF-07, STF-08, DEN-03, DEN-13, OWN-12.
Follow <claude_instructions> and the clarification protocol in this file.
Attached code: [attach the files from key_paths this batch touches]
Step 1: list your plan per ID and any blocking questions; wait for my go.
Step 2: implement one ID at a time.
Step 3: per ID report files changed, summary, how to test, acceptance pass/fail, not done.
```

For bug fixes, self-check before PR, and end-of-day status, use templates B, C, D in the master file (section 9).

---

# YOUR TASKS

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
- [x] STF-07 Operations: should have a status "doctor is on duty today" based on work schedules (Developer B B5)
- [x] STF-08 Leave: when only part of the day is checked, the until date and from date update (Developer B B3)
- [ ] DEN-03 My schedule: FIX DAH SHI (BUG)
- [x] DEN-13 My leave: same changes as staff (Developer B B3)
- [x] OWN-12 Leave request: same changes as staff (Developer B B3)

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
      - [x] Compute "Doctor is on duty today" from work schedules (account for leave and closed dates) (Developer B)
      - [x] Expose status in Operations; update daily (Developer B)
    </tasks>
    <acceptance>Operations shows correct on-duty status per doctor per branch.</acceptance>
    <evidence>Developer B B5: the existing work-schedules GET now includes a branch-scoped, read-only duty projection computed by WorkSchedules::minutes()/workingNow(), with Manila date and as-of time. Staff Operations shows each authorized Dentist/branch, an on/off badge, server refresh, empty/forbidden/error states and a clinic-day rollover refresh. Four scratch-guarded synthetic API tests passed (79 assertions) for weekly hours, breaks, closures, dated exceptions, full/partial approved leave, cross-branch scope, role authorization and Manila midnight; seven existing work-schedule tests passed (77 assertions). Rendered fictional fixture checks at 1440px and 390px found no overflow and verified branch filtering, refresh/failure states, recovery and date rollover without reload. See docs/STF07_B5_ACCEPTANCE.md. This status is Staff Operations acceptance, not a production release claim.</evidence>
  </revision>

  <revision id="STF-08" status="done" severity="high" owner="Jaztin">
    <tasks>
      - [x] Reproduce: with "only part of the day" checked, the From/Until dates update incorrectly
      - [x] Fix date and time handling for partial-day leave (single date, correct hours)
      - [x] Validate that Until is not before From
    </tasks>
    <hardening>Time zones, overlapping leave, past dates.</hardening>
    <acceptance>Partial-day leave saves correct dates and times.</acceptance>
    <evidence>Developer B B3: the existing form already derived one end date for partial leave, and the backend already rejected cross-day or reversed hours. Fixed the form overwriting a full-day end date on toggle, clarified that both times are on the selected date, and rejected empty times and past dates in the UI. Rendered Staff harness verified toggle, date change, restored full-day range, reversed-hour disable, and the single-day POST payload. Guarded LeaveTest passed 6 tests/106 assertions, including Manila timestamp persistence, overlap and past-date rejection.</evidence>
  </revision>

  <revision id="DEN-03" status="todo" severity="high" owner="Jaztin" support="Yzhekiel">
    <tasks>
      - [ ] Reproduce and identify the My schedule bug (details to be added by reporter)
      - [ ] Fix root cause and add a regression test
    </tasks>
    <needs_clarification>The QA note says only "FIX DAH SHI (BUG)". Add exact reproduction steps here.</needs_clarification>
    <acceptance>Bug no longer reproduces; regression test added.</acceptance>
  </revision>

  <revision id="DEN-13" status="done" severity="medium" owner="Jaztin" support="Yzhekiel">
    <tasks>
      - [x] Apply STF-08 (and related staff leave changes) to Dentist leave
    </tasks>
    <acceptance>Dentist leave matches staff behavior.</acceptance>
    <evidence>Developer B B3: Dentist reuses MyLeave. Rendered Dentist harness captured a single-day request with 10:30 to 12:00 hours and no approver controls. Guarded API test verified persisted +08:00 timestamps, Owner retrieval, approval, and existing booking-slot exclusion tests.</evidence>
  </revision>

  <revision id="OWN-12" status="done" severity="medium" owner="Jaztin" support="Richmon">
    <tasks>
      - [x] Apply the staff leave changes to Owner Leave requests
    </tasks>
    <acceptance>Owner leave requests match staff behavior.</acceptance>
    <evidence>Developer B B3: Owner remains an approver, not a requester. The backend already exposed can_decide and accepted authorized Owner decisions; the UI incorrectly hid the controls and described the page as read-only. Fixed the controls and text. Rendered Owner harness showed the stored date/time label and approval confirmation and captured the decide POST; guarded API test verified Owner list timestamps, both approval round trips, and Owner request denial. The B3 follow-up removed the requester's unauthorized approval attempt; successful creation now reports that an authorized approver can review it. Approval policy was unchanged.</evidence>
  </revision>

  <batch_verification>
    - [ ] Leave, schedule, and duty status tested together
    - [ ] Tests pass
  </batch_verification>
</batch>

</member_section>
