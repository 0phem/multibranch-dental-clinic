# QA SLICE: YZHEKIEL (UI/UX)

> Self-contained slice of FINALS-QA-REVISIONS.md. Give Claude THIS file only, plus the context pack and the code files for the batch you are working on.
> **This file is the source of truth for Yzhekiel's status.** Update `status` fields and tick checkboxes here.
> Master reference: FINALS-QA-REVISIONS.md (assumptions, default decisions, full matrix, other members' work).

---

## Your 7-Day Plan

- [ ] **Day 1:** GEN-06, GEN-12 (shared dropdown + button components; merge EOD)
- [ ] **Day 2:** GEN-07, STF-03, DEN-04 (shared dental chart fix)
- [ ] **Day 3:** STF-04, DEN-10, DEN-05, STF-05 UI (needs Joevan summary endpoint from Day 2)
- [ ] **Day 4:** DEN-01, DEN-02, DEN-06, DEN-07, DEN-08
- [ ] **Day 5:** DEN-09, DEN-12, DEN-15 (needs GEN-01 from Day 2)
- [ ] **Day 6:** Support UI: DEN-03, DEN-11, DEN-13 (after Jaztin); integration bug fixes
- [ ] **Day 7:** Full regression on Dentist dashboard + dental chart; final retest; sign-off

**Feature freeze at end of Day 5.** Days 6 and 7 are fixes and regression only.

<dependencies>
  <you_need_from_others>Richmon: tokens (Day 1). Joevan: STF-05 summary endpoint (Day 2). Jaztin: GEN-01 (Day 2), DEN-03/11/13 logic (Day 2-5).</you_need_from_others>
  <others_need_from_you>Everyone: shared dropdown + button components (Day 1). Dental chart fix (Day 2).</others_need_from_you>
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

**YZH-1 (Global form and button fixes): items GEN-06, GEN-07, GEN-12**
```text
Work ONLY on batch YZH-1 (Global form and button fixes): GEN-06, GEN-07, GEN-12.
Follow <claude_instructions> and the clarification protocol in this file.
Attached code: [attach the files from key_paths this batch touches]
Step 1: list your plan per ID and any blocking questions; wait for my go.
Step 2: implement one ID at a time.
Step 3: per ID report files changed, summary, how to test, acceptance pass/fail, not done.
```
**YZH-2 (Dental chart and patient record): items STF-03, STF-04, STF-05, DEN-04, DEN-05, DEN-10**
```text
Work ONLY on batch YZH-2 (Dental chart and patient record): STF-03, STF-04, STF-05, DEN-04, DEN-05, DEN-10.
Follow <claude_instructions> and the clarification protocol in this file.
Attached code: [attach the files from key_paths this batch touches]
Step 1: list your plan per ID and any blocking questions; wait for my go.
Step 2: implement one ID at a time.
Step 3: per ID report files changed, summary, how to test, acceptance pass/fail, not done.
```
**YZH-3 (Dentist dashboard screens): items DEN-01, DEN-02, DEN-06, DEN-07, DEN-08, DEN-09, DEN-12, DEN-15**
```text
Work ONLY on batch YZH-3 (Dentist dashboard screens): DEN-01, DEN-02, DEN-06, DEN-07, DEN-08, DEN-09, DEN-12, DEN-15.
Follow <claude_instructions> and the clarification protocol in this file.
Attached code: [attach the files from key_paths this batch touches]
Step 1: list your plan per ID and any blocking questions; wait for my go.
Step 2: implement one ID at a time.
Step 3: per ID report files changed, summary, how to test, acceptance pass/fail, not done.
```

For bug fixes, self-check before PR, and end-of-day status, use templates B, C, D in the master file (section 9).

---

# YOUR TASKS

<member_section name="Yzhekiel" track="uiux" primary_count="17">

<task_list>
**Batch YZH-1: Global form and button fixes**
- [ ] GEN-06 !!! Fix dropdowns bug [BLOCKED: no reproducible case, waiting for the reporter]
- [ ] GEN-07 !!! If the choice is "other" add "specify"
- [x] GEN-12 !!! Fix the buttons (make the buttons readable and reasonable sizes)

**Batch YZH-2: Dental chart and patient record**
- [x] STF-03 Patient record: dental chart moving teeth anomaly
- [x] STF-04 Patient record: patient summary: ID selection (when the choice is "other valid ID" there should be a "please specify")
- [x] STF-05 Patient record suggestion: overall summary of the dental chart instead of clicking the tooth one by one
- [x] DEN-04 Dental chart: dental chart moving teeth anomaly
- [x] DEN-05 Dental chart: add top view
- [x] DEN-10 Patient Records: if the choice is "other" add "specify" and add example

**Batch YZH-3: Dentist dashboard screens**
- [ ] DEN-01 Clinic Home: make the texts bigger
- [ ] DEN-02 My schedule: fix the date layout
- [ ] DEN-06 Prescription: remove the dosage from the medicine dropdown
- [ ] DEN-07 Prescription: make the remove medicine color red
- [ ] DEN-08 Prescription: fix the save button size from the license number on my prescription
- [ ] DEN-09 Follow up care: add color to the status
- [ ] DEN-12 My work hours: fix the UI
- [ ] DEN-15 Wording to approve: fix the button sizes, change the preview and make the UI consistent

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

  <revision id="DEN-01" status="todo" severity="medium" owner="Yzhekiel">
    <tasks>
      - [ ] Increase text sizes on Clinic Home (headings, stats, list text)
    </tasks>
    <acceptance>Clinic Home text is clearly larger and readable.</acceptance>
  </revision>

  <revision id="DEN-02" status="todo" severity="medium" owner="Yzhekiel">
    <tasks>
      - [ ] Fix the My schedule date layout (alignment, order, spacing, format)
    </tasks>
    <acceptance>Dates are clearly laid out and consistent.</acceptance>
  </revision>

  <revision id="DEN-06" status="todo" severity="medium" owner="Yzhekiel">
    <tasks>
      - [ ] Remove the dosage text from the medicine dropdown options
    </tasks>
    <acceptance>Medicine dropdown shows only medicine names.</acceptance>
  </revision>

  <revision id="DEN-07" status="todo" severity="low" owner="Yzhekiel">
    <tasks>
      - [ ] Make the "remove medicine" control red (default and hover states)
    </tasks>
    <acceptance>Remove medicine is clearly red.</acceptance>
  </revision>

  <revision id="DEN-08" status="todo" severity="medium" owner="Yzhekiel">
    <tasks>
      - [ ] Fix the Save button size near the license number on My prescription
      - [ ] Match the standard button size from GEN-12
    </tasks>
    <acceptance>Save button is correctly sized and aligned with the license number field.</acceptance>
  </revision>

  <revision id="DEN-09" status="todo" severity="medium" owner="Yzhekiel">
    <tasks>
      - [ ] Add status colors in Follow up care (e.g. pending, done, overdue) with text labels
    </tasks>
    <acceptance>Each status has a distinct color plus label, readable in light and dark.</acceptance>
  </revision>

  <revision id="DEN-12" status="todo" severity="medium" owner="Yzhekiel">
    <tasks>
      - [ ] Fix the My work hours UI (layout, spacing, day rows, time inputs)
    </tasks>
    <acceptance>Work hours screen is clean and consistent with the design system.</acceptance>
  </revision>

  <revision id="DEN-15" status="todo" severity="medium" owner="Yzhekiel">
    <tasks>
      - [ ] Fix button sizes on Wording to approve
      - [ ] Change the preview (clearer layout of the wording being approved)
      - [ ] Make the UI consistent with the rest of the dentist dashboard
      - [ ] Align with GEN-01 (fewer approval inputs)
    </tasks>
    <acceptance>Buttons are sized correctly, preview is improved, UI is consistent.</acceptance>
  </revision>

  <batch_verification>
    - [ ] Full dentist dashboard click-through
    - [ ] Text readable at all widths
  </batch_verification>
</batch>

</member_section>
