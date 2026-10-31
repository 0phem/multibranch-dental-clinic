# Known limitations and pending QA

## A11 merged-state assessment (2026-10-31, Asia/Manila)

Joevan reconciled this document on `session/developer-a-ui-20261031` at **`85a9552bf5544c73db6bde9f7b01792a5cf9cb0a`**. Local `integration/developer-a-b` and cached `origin/integration/developer-a-b` match that commit; A11 performed no fetch or branch update. Ancestry confirms **A8, B3 (including its follow-up), B4, B5, B6, B7 and A10 are included**. Integration establishes code ancestry, not a new runtime pass, deployment approval or production readiness.

Historical context: the October 29 A9 snapshot used integration `010a386` and had not reviewed B6 results. Its October 30 clarification recorded B6 synthetic API success (2 tests/33 assertions) and separate rendered checks, while A8/B3-B6 were absent from that older integration. Those absence claims are superseded for `85a9552`; original dated test results and fixture limits remain historical evidence. Affected current entries below are reconciled without changing original QA ownership or module traceability.

[B7](../DEN12_B7_WORK_HOURS_ACCEPTANCE.md) supplies scoped Work Hours presentation acceptance; [A10](../GEN10_A10_NOTIFICATION_ACCEPTANCE.md) supplies partial notification presentation acceptance. **B8 is a separate concurrent Developer B batch whose evidence has not been reviewed here; no B8 completion or integrated frontend acceptance is claimed.** A11 reruns no application suites, browser workflows or database checks. The [revised Word candidate](BPA_MODULES_UPDATED_OCT_22_2026_A9_REVIEW.docx) remains REVIEW REQUIRED; [original](BPA_MODULES_UPDATED_OCT_22_2026.docx) unchanged.


Original A9 snapshot: 2026-10-29 (Asia/Manila). Prepared by Joevan. Read with the [feature matrix](FEATURE_ACCEPTANCE_MATRIX.md) and [demonstration runbook](SYSTEM_DEMONSTRATION_RUNBOOK.md). This register records evidence boundaries; it does not change clinic policy or authorize deployment.

## Release and evidence boundary

A11 verified the merged baseline and ancestry listed in the [matrix](FEATURE_ACCEPTANCE_MATRIX.md). A8/B3-B7/A10 are no longer absent from shared integration. Historical A9 assessed `010a386`; its results remain scoped to their fixtures and synthetic data, not a fresh integrated or production pass.

A9 and A11 perform documentation checks only. Historical frontend, backend and rendered counts must not be added together or treated as new system-wide results. B8 is concurrent and unreviewed; no production readiness percentage or acceptance promotion follows from its assignment.

## Pending items to disclose

| Item | Current evidence and limitation | Next acceptance/decision needed |
| --- | --- | --- |
| STF-01 / GEN-14 calendar photos | B4 token/spacing polish is integrated. Day-appointment projection has no Patient profile-photo field; initials, three badges and +N do not satisfy photo-only previews. Master done conflicts with Celin TODO at A8 and historical B4 partial. | Reviewed photo source/privacy/API contract and rendered acceptance; do not invent photos. |
| STF-11 check-in | Existing admission remains distinct and Staff controlled. Auto-confirm, valid-ID enforcement and cancellation-reason workflow are not accepted merely because appointment data is valid. Master assignment flag and revision detail disagree. | Reviewed workflow/ID/cancellation policy plus authorized failure/race/notification tests. |
| STF-13 unified find/create | Existing search/registration paths are not the proposed atomic find/create/admit/queue flow. Tracker defaults conflict with proposed-design approval wording. | Explicit identity/duplicate/ID policy and endpoint contract; no automatic registration from A8 navigation. |
| GEN-11 archive/restore | Existing archive behavior does not accept a universal creator-based access rule or Owner access to clinical/private content. Master defaults are not clinic approval; hard deletes and append-only protections remain forbidden to weaken. | Entity-specific visibility, correction/restore and retention decisions; STF-25/DEN-16 dependent acceptance. |
| GEN-09 click reduction | A7 draft review→edit 2→1; merged A8 appointment→record 2→1 and record→Patient-prefilled form 3→1 control activations. Prior selection can already make the old record path one click. B1 custom-value persistence is not a click reduction. | Broader check-in, appointment, record and prescription audit and independent acceptance; keep global TODO/partial. |
| Historical QueueTest failures | B4 tracker at `eeb8ecd` reports five full QueueTest failures outside its scoped change, including obsolete priority/status expectations. Three scoped queue tests passed; that does not make the full suite green. | Developer B/coordinator to reconcile expectations and rerun an appropriate integrated gate. A11 does not diagnose, waive or rewrite them; code integration does not establish that they passed. |
| B6 walk-in | Integrated B2 proves combobox behavior; its rendered admission returned off-shift 422. The merged [B6 report](../STF12_B6_WALKIN_ACCEPTANCE.md) records HTTP 201, persisted Visit/Queue identity, idempotency and denial tests on guarded synthetic scratch data, plus separate controlled rendered checks. | Live browser-to-scratch-server and coordinated integrated acceptance remain unverified; no production or policy promotion. |
| DEN-12 work hours | Historical master/member discrepancy is superseded for scoped UI by merged [B7](../DEN12_B7_WORK_HOURS_ACCEPTANCE.md): 23 focused tests, 390/1440 controlled roster checks, weekday/branch/time layout, closures, estimated hours and dated branch duty/unavailable states. | Preserve fixture limits: no new Laravel authorization/write verification, real roster confirmation or B8 acceptance. B7 screenshots were local/untracked; no committed before screenshot. |
| GEN-06 / DEN-03 | Bug descriptions lack sufficient reproduction. A7's assigned-queue import fix is specific, not proof that every unspecified schedule bug is solved. | Reproduction, affected build/context, regression evidence. |
| STF-21 Dentist switching | A2 messaging colors/search/scroll are accepted; active-Dentist selection and preserved-history semantics remain partial despite master done. | Reviewed assignment/history contract without widening private message access. |
| STF-07 / B5 duty | Merged [B5](../STF07_B5_ACCEPTANCE.md) server-derived Staff duty has focused acceptance; Dentist dashboard's separate badge remains outside B5/B7 Work Hours acceptance. | Merged-state role-specific acceptance remains pending. Confirm actual clinic shifts; fallback profile hours remain estimated. |
| STF-08 / DEN-13 / OWN-12 | B3 partial-day and approval controls plus removal of requester self-approval attempt are integrated. Existing server denies unauthorized requester approval; the old UI call does not mean a request was auto-approved. | Verify merged request/approval/availability together; no new result is established by A11 or unreviewed B8. |
| OWN-10 / OWN-07–09 | Master/assignment done claims do not establish the full agreed schedule/calendar/photo behavior. Richmon entries remain TODO. | Resolve exact shared scope and item-specific acceptance. |
| GEN-10 notifications | Merged [A10](../GEN10_A10_NOTIFICATION_ACCEPTANCE.md) partially accepts presentation: 56 focused tests and fictional Shell/panel rendering at 1440/390, sorting/latest eight, keyboard/focus, wrapping and read-command failure/identity checks. Panel still uses scoped browser-store commands; API wrappers are not a wired server feed. | No server persistence, cross-device read synchronization, full delivery or network-load acceptance. Archive/delete/restore remains restricted by GEN-11; read-all is not deletion. Verify channels separately. |

## Financial and live workflow limits

OWN-01 A4/A5 use focused synthetic PostgreSQL reconciliation and rendered API fixtures. They do not prove deployed totals against production accounts, live payments/refunds, live receipt/email delivery or a legally compliant accounting close. Gross collections, refunds and net cash flow are distinct from profit and from the older paid-invoice KPI. The fixed Last 30 Days overview is independent of the detailed period selector. Weekly Mon–Sat excludes Sunday; an on-demand Saturday report is not a scheduled immutable artifact. See [A4](../OWN01_A4_ACCEPTANCE.md), [A5](../OWN01_A5_ACCEPTANCE.md) and the [illustrative showcase](OWNER_ANALYTICS_FEATURE_SHOWCASE.md).

No protected databases, real financial records or live providers were accessed in A9. Existing pending real-database migrations and live PayMongo/account requirements remain in [post-defense tasks](../POST_DEFENSE_TASKS.md). Hosting/service health and full authenticated workflows require environment-specific acceptance; this package is not a deployment certificate.

## Clinical, privacy and external-service limits

Prescriptions retain explicit Dentist decisions and issue confirmation; draft persistence/UI checks do not certify medication safety or automated dosing. Follow-up/recall wording and rules need the existing approval process. Leave balances, clinical amendments and broader record permissions must not be invented.

A1 accepts Patient-only Gemini authentication with mocked upstream responses, not live provider governance. Configured external AI can transmit free text/history; follow [assistant privacy](../ASSISTANT_PRIVACY.md). Owner oversight never authorizes reading Patient messages or unrestricted clinical content. Messaging search passed scoped tests; production-scale encrypted search, live transport and actual recipient delivery remain separate acceptance work.

## Presentation and tracker hygiene

All screenshots linked by this package use synthetic/illustrative data and are reused from committed evidence. Some are isolated component fixtures, not the full authenticated shell; native date/select appearance varies by browser. A8 counts dropdown selection as one control activation and excludes later booking confirmation. Do not advertise those counts as universal clicks or measured clinical time savings.

The matrix records all 68 QA IDs and discrepancies instead of rewriting checkboxes or ownership. For rows labelled Not yet verified, historical done flags are retained as claims, not erased or promoted. Historical module plans and old stack descriptions must not be repeated as current facts. Application source and current manifests precede historical implementation descriptions; clinic facts still require clinic evidence.

Academic amendment (2026-10-30): see [all-module reconciliation](ACADEMIC_DOCUMENT_RECONCILIATION.md) and the [DOCX section amendment](BPA_OCT22_A9_SECTION_AMENDMENT.md). This dated A9 amendment remains historical; original acceptance evidence and policy boundaries are retained. Current merged ancestry is assessed separately in A11 above.

A11 verification scope: Git ancestry, current source entry points and original acceptance reports reviewed; local Markdown targets, commit/blob references, QA catalog preservation and diff boundaries checked. No application suites, browser sessions, database commands, deployment or B8 acceptance performed.
