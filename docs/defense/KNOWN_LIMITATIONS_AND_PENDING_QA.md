# Known limitations and pending QA

## Current snapshot clarification (2026-10-30)

[B6 isolated report](https://github.com/ccadaverr/multibranch-dental-clinic/blob/4c993244416ec9b0530e1d16acfb6c9e471fac9c/docs/STF12_B6_WALKIN_ACCEPTANCE.md) now records synthetic API success (2 tests/33 assertions) and separate rendered fixture checks. Commit `4c993244416ec9b0530e1d16acfb6c9e471fac9c` is not in shared integration `010a386f147bed285c58821a0a2cc800c393982e`. This supersedes pending-B6-report wording in the earlier snapshot below; live browser-to-server and production acceptance remain unverified. A8 and B3-B5 also remain isolated. The [revised Word candidate](BPA_MODULES_UPDATED_OCT_22_2026_A9_REVIEW.docx) is REVIEW REQUIRED; [original](BPA_MODULES_UPDATED_OCT_22_2026.docx) unchanged.


Snapshot: 2026-10-29 (Asia/Manila). Prepared by Joevan. Read with the [feature matrix](FEATURE_ACCEPTANCE_MATRIX.md) and [demonstration runbook](SYSTEM_DEMONSTRATION_RUNBOOK.md). This register records evidence boundaries; it does not change clinic policy or authorize deployment.

## Release and evidence boundary

Shared integration was fetched and verified at **`010a386f147bed285c58821a0a2cc800c393982e`**. Accepted A8 **`179cfb4903f46648666d2dbdeb0b0d70b3829dd6`** is the A9 base but is not an ancestor of shared integration. B3, its follow-up fix, B4 and B5 commits listed in the matrix likewise are not ancestors. Their isolated acceptance must not be called shared or production acceptance. At the initial October 29 snapshot B6 was **Not yet verified**. The October 30 clarification above records its newly available isolated evidence; live browser-to-server and integrated acceptance remain unverified. Do not infer success from an in-progress task or candidate branch name.

A9 runs documentation checks only. Historical frontend, backend and rendered results are cited with their original scopes and synthetic-data limitations; they are not a new system-wide test run. No production readiness percentage or aggregate pass count is derived from stale tracker totals.

## Pending items to disclose

| Item | Current evidence and limitation | Next acceptance/decision needed |
| --- | --- | --- |
| STF-01 / GEN-14 calendar photos | B4 token/spacing polish is isolated. Day-appointment projection has no Patient profile-photo field; initials, three badges and +N do not satisfy photo-only previews. Master done conflicts with Celin TODO at A8 and remote B4 partial. | Reviewed photo source/privacy/API contract and rendered acceptance; do not invent photos. |
| STF-11 check-in | Existing admission remains distinct and Staff controlled. Auto-confirm, valid-ID enforcement and cancellation-reason workflow are not accepted merely because appointment data is valid. Master assignment flag and revision detail disagree. | Reviewed workflow/ID/cancellation policy plus authorized failure/race/notification tests. |
| STF-13 unified find/create | Existing search/registration paths are not the proposed atomic find/create/admit/queue flow. Tracker defaults conflict with proposed-design approval wording. | Explicit identity/duplicate/ID policy and endpoint contract; no automatic registration from A8 navigation. |
| GEN-11 archive/restore | Existing archive behavior does not accept a universal creator-based access rule or Owner access to clinical/private content. Master defaults are not clinic approval; hard deletes and append-only protections remain forbidden to weaken. | Entity-specific visibility, correction/restore and retention decisions; STF-25/DEN-16 dependent acceptance. |
| GEN-09 click reduction | A7 draft review→edit 2→1; isolated A8 appointment→record 2→1 and record→Patient-prefilled form 3→1 control activations. Prior selection can already make the old record path one click. B1 custom-value persistence is not a click reduction. | Broader check-in, appointment, record and prescription audit and independent acceptance; keep global TODO/partial. |
| Historical QueueTest failures | B4 tracker at `eeb8ecd` reports five full QueueTest failures outside its scoped change, including obsolete priority/status expectations. Three scoped queue tests passed; that does not make the full suite green. | Developer B/coordinator to reconcile expectations and rerun an appropriate integrated gate. A9 does not diagnose, waive or rewrite them. |
| B6 walk-in | Integrated B2 proves combobox behavior; its rendered admission returned off-shift 422. The newly fetched isolated B6 report records HTTP 201, persisted Visit/Queue identity, idempotency and denial tests on guarded synthetic scratch data, plus separate controlled rendered checks. | Live browser-to-scratch-server and coordinated integrated acceptance remain unverified; no production or policy promotion. |
| DEN-12 work hours | Master done vs Yzhekiel TODO; no matching item-specific A1–A8 acceptance established. | Rendered work-hours UI verification; do not use B3 leave acceptance as a substitute. |
| GEN-06 / DEN-03 | Bug descriptions lack sufficient reproduction. A7's assigned-queue import fix is specific, not proof that every unspecified schedule bug is solved. | Reproduction, affected build/context, regression evidence. |
| STF-21 Dentist switching | A2 messaging colors/search/scroll are accepted; active-Dentist selection and preserved-history semantics remain partial despite master done. | Reviewed assignment/history contract without widening private message access. |
| STF-07 / B5 duty | Isolated server-derived Staff duty has focused acceptance. Shared A7 does not include it; Dentist dashboard's separate badge is outside B5. | Coordinated integration and role-specific acceptance. Confirm actual clinic shifts; fallback profile hours remain estimated. |
| STF-08 / DEN-13 / OWN-12 | B3 partial-day and approval controls plus removal of requester self-approval attempt are isolated. Existing server denies unauthorized requester approval; the old UI call does not mean a request was auto-approved. | Integrate approved candidate through coordinator; verify request/approval/availability together. |
| OWN-10 / OWN-07–09 | Master/assignment done claims do not establish the full agreed schedule/calendar/photo behavior. Richmon entries remain TODO. | Resolve exact shared scope and item-specific acceptance. |
| GEN-10 notifications | Existing account-specific notification presentation is not full acceptance of redesign, archive action or delivery. | Recipient isolation and approved archive dependency; verify channels in the intended environment. |

## Financial and live workflow limits

OWN-01 A4/A5 use focused synthetic PostgreSQL reconciliation and rendered API fixtures. They do not prove deployed totals against production accounts, live payments/refunds, live receipt/email delivery or a legally compliant accounting close. Gross collections, refunds and net cash flow are distinct from profit and from the older paid-invoice KPI. The fixed Last 30 Days overview is independent of the detailed period selector. Weekly Mon–Sat excludes Sunday; an on-demand Saturday report is not a scheduled immutable artifact. See [A4](../OWN01_A4_ACCEPTANCE.md), [A5](../OWN01_A5_ACCEPTANCE.md) and the [illustrative showcase](OWNER_ANALYTICS_FEATURE_SHOWCASE.md).

No protected databases, real financial records or live providers were accessed in A9. Existing pending real-database migrations and live PayMongo/account requirements remain in [post-defense tasks](../POST_DEFENSE_TASKS.md). Hosting/service health and full authenticated workflows require environment-specific acceptance; this package is not a deployment certificate.

## Clinical, privacy and external-service limits

Prescriptions retain explicit Dentist decisions and issue confirmation; draft persistence/UI checks do not certify medication safety or automated dosing. Follow-up/recall wording and rules need the existing approval process. Leave balances, clinical amendments and broader record permissions must not be invented.

A1 accepts Patient-only Gemini authentication with mocked upstream responses, not live provider governance. Configured external AI can transmit free text/history; follow [assistant privacy](../ASSISTANT_PRIVACY.md). Owner oversight never authorizes reading Patient messages or unrestricted clinical content. Messaging search passed scoped tests; production-scale encrypted search, live transport and actual recipient delivery remain separate acceptance work.

## Presentation and tracker hygiene

All screenshots linked by this package use synthetic/illustrative data and are reused from committed evidence. Some are isolated component fixtures, not the full authenticated shell; native date/select appearance varies by browser. A8 counts dropdown selection as one control activation and excludes later booking confirmation. Do not advertise those counts as universal clicks or measured clinical time savings.

The matrix records all 68 QA IDs and discrepancies instead of rewriting checkboxes or ownership. For rows labelled Not yet verified, historical done flags are retained as claims, not erased or promoted. Historical module plans and old stack descriptions must not be repeated as current facts. Application source and current manifests precede historical implementation descriptions; clinic facts still require clinic evidence.

Academic amendment (2026-10-30): see [all-module reconciliation](ACADEMIC_DOCUMENT_RECONCILIATION.md) and the [DOCX section amendment](BPA_OCT22_A9_SECTION_AMENDMENT.md). Original dated acceptance evidence above is retained; no integration or policy promotion.
