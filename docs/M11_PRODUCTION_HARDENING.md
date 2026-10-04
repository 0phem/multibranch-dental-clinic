# M11 production-readiness audit and hardening — Billing, Payment & Receipt Management

Audit date: 2026-10-05 (Asia/Manila). No commit, push, merge, or other-module business work. No partial payment, discount, tax, refund, void, cancellation, credit or receipt-format policy was invented.

## 1. Starting git state

Branch `feature/m11-billing-production-hardening`, created from `8424244` ("feat(m22): harden audit integrity privacy and activity access") on a clean tree synchronized with origin.

## 2. M11 architecture discovered

Server tables: `invoices` (ULID `public_id`, one invoice per Treatment, `numeric(12,2)` money, status CHECK Draft/Review/Issued/Paid, an amounts CHECK), `invoice_lines` (immutable price snapshots referencing the M13 `service_price_id`), `invoice_histories`, `payments` (one per invoice) and `receipts` (one per payment) — the last three append-only by trigger. `BillingService` (all arithmetic in integer cents, row locks, expected-revision checks), `BillingController` (named commands, `Idempotency-Key` required, persisted in `command_keys`), `PayMongoService`/`PayMongoController` (hosted checkout + webhook). The Staff/Patient screens read the server; the Owner and Dentist have no billing screen. M12 supplies the `HmoFinancialGate`; M13 the price resolver; M22 the audit store.

## 3. Financial authority before / after

Before: the Staff-recorded path was sound (server arithmetic, full payment only, row locks, idempotency, M12 gate, M13 snapshots). The **online-payment path was not**: a signed-looking webhook alone could mark an invoice Paid without an amount, session, event-type or provider check, and several defaults and fallbacks fabricated success (section 18–23). After: one shared server check (`BillingService::payableBalance`) decides whether an invoice can take money for the Staff payment, the checkout and the provider settlement; the provider path settles only a verified, session-bound, amount-exact capture and records every provider event so nothing captured can silently disappear.

## 4. Invoice model

One Invoice per completed post-cutover Treatment; Patient, Visit and branch derive from the Treatment's Visit. Lines carry the M13 price version and a quantity × unit snapshot. The client submits no total, balance, state or relationship: every one of those fields is now **rejected with 422** if supplied on any command (section 17).

## 5. Invoice state machine

Draft → Review (Staff) → Issued (Staff; M12 gate; may become Paid at issue for full HMO coverage) → Paid (full payment). Verified by tests: stale `expected_revision` is 409; a transition from the wrong state is 422 `invalid_invoice_state`; Paid is terminal (a second payment is 422 `already_paid`; re-issue is refused); no endpoint patches a state field. No Void/Cancelled/Refunded state exists or was added.

## 6. Financial arithmetic

Money is `numeric(12,2)` end to end; PHP uses integer-cent arithmetic (`cents()`, `add/sub/mul/min`); the API returns decimal **strings**. New tests prove the float traps stay exact (19.99 × 2 = 39.98, 0.29 × 2 = 0.58, 33.33 × 2, 1,234,567.89 × 2) and a partial HMO coverage (251.00 − 100.10 = 150.90). **Fixed:** the checkout amount was `(int) round((float) $balance * 100)` — a binary float; it is now whole centavos from the decimal string (tested with 0.29 → 29). Provider amounts are compared as integer centavos. Payment amounts must match `^\d+(\.\d{1,2})?$` (negative, zero, exponent, sign, hex, comma and 3-decimal forms are 422).

## 7. M13 price integration

Unchanged and verified: price resolution uses the Treatment's clinic date and branch; an invoice line stores the resolved version and unit price; an unavailable price is a 422 (no reference-fee fallback). A later M13 price version (tested) does not change an existing invoice's lines or totals.

## 8. M12 financial gate

`payableBalance` consults the server gate: unresolved claims hold issue and payment (not Draft/Review); Approved coverage is capped at gross; Rejected/Withdrawn coverage is zero; a changed HMO outcome since issue is 409 `financial_state_changed`. **New:** the same check now runs **before a checkout session is created** (a held invoice cannot start an online payment) and again when a provider capture is applied (an HMO hold that appears after checkout leaves the captured payment on record as "Needs review").

## 9. Full-HMO behaviour

Preserved and tested: full approved coverage settles the invoice at issue as `Paid`, `paid_amount = 0`, `settlement_type = full_hmo_coverage`, with **no Payment and no Receipt**, and a new audit event `billing.invoice_settled_by_hmo`. A new database CHECK states the invariant (a settlement type is only valid on a Paid invoice with nothing paid and nothing owed).

## 10. Payment model

One Payment per invoice, full balance only (the unique `invoice_id` and `payments_amount_positive_check` enforce it). Staff record Cash, Card/POS, Bank Transfer or E-Wallet after an external collection (a reference is required except for Cash); the provider path records `PayMongo (<METHOD>)` with the provider payment id. **Fixed:** the method label took any provider-supplied string (it could overflow the 30-character column and fail the settlement); it is now an allowlisted label. A payment's actor is a real user: the Staff member, or the person who initiated the checkout session (recorded on the session) — never a guessed user.

## 11. Receipt model

One Receipt per real Payment, same amount and method, unique sequence number, append-only. Tests confirm no Receipt for full-HMO settlement, none for a refused provider capture, and that a Patient sees only their own receipts without internal ids.

## 12. Concurrency

Existing real-process tests (two payments, issue/issue, create/create) remain green. Added invariants: `payments_provider_reference_unique` (one provider payment id settles one payment), `payment_provider_events.provider_event_id` unique (a concurrent duplicate delivery cannot double-process), the event row is locked while it is processed, and the invoice row lock serializes the Staff and provider paths.

## 13. Idempotency

Draft, review, issue and payment already require an `Idempotency-Key` (replay returns the original result; a reused key with a different request is 409). **Added:** a replayed Staff payment writes one Payment, one Receipt and one audit event (tested); provider events are de-duplicated by the provider's event id and a new event id for the same captured payment is idempotent.

## 14. Authorization matrix

| Surface | Guest | Patient | Staff (branch scope) | Dentist | Owner |
| --- | --- | --- | --- | --- | --- |
| Invoice list `/invoices` | 401 | 403 (uses `/mine`) | scoped | 403 | all (read) |
| Invoice detail | 401 | own | scoped | 403 | read |
| Create draft / review / issue / pay | 401 | 403 | in scope only | 403 | 403 (read-only) |
| Receipts | 401 | own (`/receipts/mine`) | via invoice | 403 | via invoice |
| Start online payment | 401 | own invoice | in scope | 403 | **403** (was allowed) |
| Webhook | signature only | — | — | — | — |
| Provider-event worklist `/billing/provider-events` | 401 | 403 | scoped, read-only | 403 | all, read-only |

Owner payment initiation was removed (Owner is read-only in the existing contract). Whether the Owner should stay read-only is an open policy question.

## 15. Branch scope

Staff mutate only in the invoice's branch scope (zero-scope Staff and other-branch Staff are 403 for show, review, issue, pay, checkout and the worklist). Patient identity stays cross-branch; no branch ownership of Patients is assumed.

## 16. IDOR

Verified: Patient B cannot read A's invoice or receipts; numeric ids, malformed and unknown ULIDs are 404 on every invoice route including the checkout route; a Patient cannot start a payment for another Patient's invoice; Staff of another branch are 403.

## 17. Mass-assignment

Every command now rejects (422, not ignored) client-supplied `status`, `total`, `subtotal`, `gross_amount`, `hmo_coverage_amount`, `patient_responsibility_amount`, `amount_due`, `balance`, `paid_amount`, `settlement_type`, `receipt_number`, `provider_status`, `provider_transaction_id`, `created_by`, `paid_by`, `patient_id`, `branch_id`, `lines`, timestamps, `revision`, `id`, `public_id` and more; the checkout also rejects `success_url`, `cancel_url`, `amount`, `currency`. Tested on create, review, issue, payment and checkout; the invoice is unchanged afterwards.

## 18. PayMongo architecture

Hosted checkout. The server creates a session with **`POST {host}/v2/checkout_sessions`** (the version the provider recommends for new integrations) using HTTP Basic auth (secret key as username, empty password), integer-centavo PHP line items, the invoice's public id as `reference_number`, server-built return URLs and the **explicitly configured** `payment_method_types`, and records the session (provider session id, invoice, exact amount, initiator, mode-checked `livemode`). The browser pays on the provider's page. The provider calls the public webhook; the server verifies the signature, stores the event, binds it to its own session, reads the session back with **`GET {host}/v1/checkout_sessions/{id}`** (the retrieval path the provider documents; the response carries `reference_number`, `livemode` and `payments[]` with `id`, `status`, `amount`, `currency`), compares everything, and only then settles. Defence in depth: the inbound event and the provider's own record must agree, and the project does not settle from the webhook alone (the provider's quick-start marks an order paid directly from the webhook; this integration deliberately does not).

## 19. Provider secret handling and configuration

**Defects fixed earlier in this pass:** publicly known default secrets (`pk_test_sample`, `sk_test_sample`, `whsec_sample`) and a `test_mock_valid` signature bypass in local/testing environments are removed. There are **no defaults**: `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET`, `PAYMONGO_MODE` and `PAYMONGO_PAYMENT_METHOD_TYPES` must all be set or the integration answers `503 payment_not_configured` (tested, including a source scan for the old strings). **Final gate:** `PAYMONGO_MODE` (`test` or `live`) is required and must agree with the secret key's own prefix (`sk_test_` / `sk_live_`) — a live key with `test` mode (or the reverse) fails closed. `PAYMONGO_PAYMENT_METHOD_TYPES` is a comma-separated list of the methods enabled on the merchant's PayMongo account; the previous hard-coded `gcash, paymaya, card, grab_pay` list was removed because availability depends on the merchant account and no capability may be assumed. `PAYMONGO_BASE_URL` is the API host (a trailing `/v1` or `/v2` is ignored). No secret appears in the frontend, API responses, audit payloads or committed fixtures (tests use obviously fake values).

## 20. Webhook verification (exact semantics)

Implemented exactly as the provider's current documentation (docs.paymongo.com, webhook setup/verification) describes, and **no other layout is accepted**:

1. The header is `Paymongo-Signature: t=<timestamp>,te=<test signature>,li=<live signature>`. It is split on commas; every component must be `name=value` with `name` ∈ {`t`, `te`, `li`}; a repeated component, an unknown component, a component without `=`, a missing or non-numeric `t`, or a missing/non-64-hex signature for this endpoint's mode is refused.
2. The signed string is **`t + "." + raw request body`** — the unmodified raw bytes (`$request->getContent()`), never a parsed or re-serialized JSON. (The first pass of this module also accepted an HMAC of the raw body **without** the timestamp; that was not the documented scheme and is removed. A body-only HMAC is now refused — tested.)
3. HMAC-SHA256 with the endpoint's webhook secret, compared with `hash_equals` (constant time), before any parsing or database write.
4. **`te` is compared on a test-mode endpoint and `li` on a live-mode endpoint**, selected by the explicitly configured `PAYMONGO_MODE`, not by anything read from the body; the other component may be empty. A valid test signature presented to a live endpoint (and the reverse: swapped components) is refused.
5. After verification, the event's own `livemode` flag must equal the endpoint's mode, otherwise it is refused (400) and nothing is stored; the session read back from the provider must also be in that mode.
6. The provider documents no timestamp tolerance, so none was invented; replay protection is event-id de-duplication (section 21).

Tests (31 in `PayMongoPaymentTest`): correct test signature; correct live signature; wrong `te`; wrong `li`; swapped test/live; body-only HMAC; modified raw body (including trailing byte and pretty-printed re-serialization); modified and non-numeric timestamp; missing `t`, missing `te`, empty and short/non-hex signatures; duplicate `te`/`t`; unknown component; component without `=`; mode/key mismatch; event mode mismatch; no/empty header; the old `test_mock_valid` literal; malformed JSON body with a valid signature. The event type is allowlisted (`checkout_session.payment.paid` is the only one acted on; everything else is stored as Ignored and acknowledged), and the invoice named inside an event is never used to find an invoice.

## 21. Webhook replay

Every verified event is stored by its provider event id before it is acted on. A replayed event returns its recorded outcome and changes nothing; a new event id for the same captured payment settles nothing twice (one Payment, Receipt, audit event and ledger event; tested); a **second capture** for an already-paid invoice (two open checkout pages) is recorded as `Duplicate` for refund review, never silently ignored. No timestamp tolerance is applied: the provider's current documentation, as retrieved, specifies none (see section 39).

## 22. External-payment reconciliation

The provider's capture is an external side effect that no database transaction can undo. Design: store the verified event first (committed), then settle in one transaction with the status update. A capture that cannot be applied automatically stays on record — `Needs review` with a reason (`unknown_checkout_session`, `amount_mismatch`, `reference_mismatch`, `livemode_mismatch`, `event_provider_payment_disagree`, `provider_reports_not_paid`, `provider_reports_no_payment`, `unverifiable_payment`, `provider_confirmation_refused`, `hmo_financial_hold`, `invalid_invoice_state`, `financial_state_changed`) or `Duplicate` — and raises a **critical** `billing.provider_payment_unreconciled` audit event with identifiers and a decimal-safe amount only; **no local settlement is faked**. If the provider cannot be asked (5xx/429/timeout) the event stays `Received` and the endpoint answers 503 so the provider retries (the provider documents up to 12 retries with exponential backoff and a 30-second timeout). A read-only worklist (`GET /billing/provider-events`) lists unresolved events. **PRODUCTION BLOCKER — PAYMENT RECONCILIATION GAP (partial):** no payment is ever dropped, but there is no resolution workflow (review screen, refund or manual settlement) and no scheduled re-processing of events left `Received`; resolving a `Needs review` or `Duplicate` event is a manual, out-of-system step until the clinic defines it.

## 23. Browser redirect authority

**Defect fixed:** the Patient billing page displayed "Payment Successful — your payment has been received and your invoice is settled" whenever the URL contained `?payment=success`, i.e. a person could read a fake settlement from a link. The page now shows "Confirming your payment" (the invoice stays payable), re-asks the server about the returned invoice through the project's visible-refresh primitive for a bounded time, and shows "Payment received" **only** when the server reports that invoice Paid; otherwise it ends with "Payment not confirmed yet… your invoice stays unpaid until we are confirmed". The frontend never writes a Paid status or a receipt (source-tested; browser-tested including a success redirect against an Issued invoice). The checkout return URLs are built by the server from the configured SPA origin; a client-supplied URL is rejected (it previously allowed an arbitrary redirect target).

## 24. M22 audit integration

Added, inside the authoritative transaction: `billing.invoice_issued` and `billing.invoice_settled_by_hmo` at issue, `billing.payment_recorded` for every payment (Staff and provider), and the critical `billing.provider_payment_unreconciled`. Payloads carry public ids' invoice/receipt numbers, decimal-string amounts, the method and the settlement type — no provider reference, credential or raw payload (tested). A Staff payment and its audit event commit or roll back together (tested with a failing audit). The provider path keeps the M22 rule: a captured payment is never undone by a local audit failure. The old online-payment audit call used a stale signature inside a swallow-all `catch` and wrote nothing (fixed in M22); the receipt e-mail failure is now reported instead of silently ignored.

## 25. Browser-local / demo findings

The Staff and Patient billing screens read the server in the browser; a failed load was a bare message (Staff) or an error without recovery (Patient). Both now show an explicit error **with Retry**, no invoices and no demo records (verified in the browser). Legacy browser invoices remain read-only presentation data in non-server (demo/SSR) contexts only. The Owner and Dentist have no billing screen. Frontend arithmetic is presentation only; every amount shown is the server's string. The 502 gateway message ("No payment was started.") is now shown to the Patient instead of a generic outage text.

## 26. Database / schema changes

One forward-only migration `2026_10_14_000100_harden_m11_payment_integrity.php`: tables `payment_checkout_sessions` and `payment_provider_events`; a partial unique index on provider payment references; and four `NOT VALID` CHECK constraints (a Paid invoice is fully settled; a settlement type is only the Paid/zero full-HMO case; a payment and a receipt are never ≤ 0). `NOT VALID` binds every new or changed row without blocking deployment on legacy rows. No existing row is changed. Tested only on `dental_clinic_test`; **not applied to `dental_clinic`**.

## 27. Security findings (summary)

Critical: publicly known default webhook secret; environment-conditional signature bypass; webhook trusted any event type and the event's invoice reference with no session, amount or provider confirmation; fabricated "simulated" checkout sessions on any provider failure (including in production with an unset or test-prefixed key); fake settlement shown from a URL parameter. High: client-chosen redirect URLs; Owner able to start payments; float centavo conversion; live-mode signatures rejected by the `te ?? li` selection; a placeholder `patient@example.test` e-mail sent to the provider for Patients without an address; internal exception text returned from the webhook. Medium: silently ignored forged fields; no audit for Staff payments and issue; no DB invariants for settlement; HMO hold not checked at checkout.

## 28. Files changed

Backend: `BillingService.php`, `BillingController.php`, `PayMongoService.php`, `PayMongoController.php`, `config/services.php`, `config/app.php`, `routes/api.php`, models `PaymentCheckoutSession.php` and `PaymentProviderEvent.php`, the migration above. Frontend: `src/pages/PatientCare.jsx`, `src/pages/FinanceCommunication.jsx`, `src/api-client.js`. Tests/tooling/docs: `PayMongoPaymentTest.php` (rewritten), `BillingHardeningTest.php` (new), `tests/billing-ui.test.js` (new), `tests/m11-paymongo.test.js`, `scripts/m11-billing-browser-qa.mjs` (new), this report.

## 29. Tests added / changed

Backend: PayMongo/provider (26 tests, previously 9): checkout with server-built URLs and integer centavos, awkward amounts, forbidden client fields, Patient/Staff/Owner/Dentist/other-Patient boundaries, numeric/malformed ids, unpayable and HMO-held invoices, provider failure/timeout/malformed/insecure responses (no simulation), missing credentials, no placeholder/bypass strings in source, signature failures and all documented layouts, malformed body, settlement bound to our session with forged fields ignored, audit and ledger events, replay and duplicate-event idempotency, ignored event types, unknown sessions, amount/currency mismatch, provider confirmation required, provider outage with retry, second capture as Duplicate, HMO hold after checkout, no internal leak, failing audit/ledger never undoing a captured payment, database invariants, provider-reference uniqueness, and the read-only worklist. Billing hardening (12 tests): exact decimals, partial HMO arithmetic, historical price stability, amount validation, forged-field rejection on every command, the full role/branch matrix, IDOR/receipt isolation, public-id-only resolution, safe audit events, audit replay, audit atomicity, full-HMO audit/terminal state. Existing Billing/Concurrent/Pricing/HMO suites unchanged and green.
Frontend (+5): checkout payload and failure handling, redirect-is-not-proof, error/retry and no local authority, command endpoints. One legacy source assertion (`Payment Successful`) was replaced by the new banner contract.

## 30–38. Verification results

- Targeted M11 backend: `Billing` + `Payment` directories **53 passed** (BillingHardening 12, PayMongo 26, existing Billing 15 incl. concurrency).
- Cross-module regression: M12 (`Hmo`), M13 (`Pricing`), M22 (`Audit`), M4, M14, M5/M6/M8/M9 inside the full suite — all passing.
- Full backend: **495 passed / 4,633 assertions** (M22 checkpoint 458 / 3,927; 486 / 4,493 before the final gate).
- Targeted frontend (`billing-ui`, `m11-paymongo`): passing. Full frontend: **718 passed**, zero failures/skips (711 before).
- Render smoke: **16 passing groups**. Production build: **PASS**, initial JS 455.43 kB class (no dependency change).
- Browser QA (`scripts/m11-billing-browser-qa.mjs`, installed Chrome, HTTP fixtures; no real provider contacted): **156 checks**, Patient/Staff/Owner/Dentist at 375, 430, 768, 1024, 1440, **0 px overflow**. Verified: a success redirect shows "Confirming…" and never "Payment received" until the server reports Paid; a refused checkout is explained and the browser is not redirected; a failed load shows an error with Retry and no invoices (Patient and Staff); a real receipt shows for a real payment and full-HMO coverage shows none; Staff review/issue controls appear only for Staff, no demo records; Owner and Dentist have no billing navigation and a Dentist issues no invoice request. The only console errors are the injected 500/502 responses.
- `git diff --check`: **PASS**.

## 39. Official provider-documentation verification status

**DOCUMENTATION COMPATIBILITY — confirmed now** (docs.paymongo.com, read through a summarizing fetch tool and a documentation search; wording below is what those pages state): the webhook header structure `t`/`te`/`li`; the signed string `t + "." + raw body`; HMAC-SHA256 with the endpoint secret; `te` for test and `li` for live; constant-time comparison; raw body preserved; event-id de-duplication required for financial handlers; retries up to 12 times, 200–209 stops them; Hosted Checkout `POST /v2/checkout_sessions` recommended for new integrations; HTTP Basic auth with the secret key; line-item amounts in centavos with `currency`; the event name `checkout_session.payment.paid`; a session resource with `reference_number`, `livemode` and `payments[]` (`id`, `status`, `amount`, `currency`); the create response carries `id`, `checkout_url`, `livemode`; payment-method availability depends on the merchant account. **Documentation points to confirm in a real account:** the retrieval path is documented as `GET /v1/checkout_sessions/{id}` while creation is v2 (no v2 retrieval path was found); the exact `checkout_session.payment.paid` payload (the integration does not depend on it beyond optional agreement checks); the correct `payment_method_types` for the merchant.

**LIVE PROVIDER VERIFICATION REQUIRED — not done.** No request, session, payment or webhook has been exercised against a real PayMongo test or live account; everything above is documentation compatibility plus automated mocks. If a v2 session cannot be read back through the documented v1 path, or the real event/session shapes differ, the integration fails safe (captures are kept as `Needs review`; nothing is settled on an unconfirmed payment), but automatic settlement would not work until verified. A controlled test-mode run (checkout → pay → webhook → settlement → replay → mismatch) must precede any production claim.

## 40. Unresolved policy questions (not answered here)

1. Are partial or split payments allowed? 2. Which payment methods are accepted in-system and which are Staff-recorded after external collection? 3. Are discounts supported, and who approves them? 4. What are the cancellation/void and refund policies (including a duplicate capture)? 5. May receipts be reissued or reprinted, and is a special numbering/format required? 6. Should the Owner stay read-only for billing? 7. What should happen when online payment succeeds externally but local reconciliation is delayed or needs review, and who resolves it? 8. How long may a checkout session stay payable? 9. Is a Patient-chosen amount (deposit/over-payment) ever allowed?

## 41. Remaining blockers

1. Provider behaviour unverified against live PayMongo (section 39).
2. Reconciliation is record-only: no review UI, refund or manual-settlement workflow, and no scheduled retry of events left `Received`.
3. Refund/void/partial/discount/tax policy undefined (outside the implemented scope).
4. Staff-recorded Card/POS, Bank and E-Wallet payments are manual entries, not provider-verified.
5. Receipt format/numbering/reprint policy undefined.
6. Deployment: real PayMongo credentials and webhook secret must be configured (no defaults exist), a shared cache/HTTPS endpoint is required, and the migration must be applied deliberately (it has not been applied to `dental_clinic`).

## 42. Verdict

**Verdict B — not production-ready as a complete module.** The server-side invoice arithmetic, state machine, branch/IDOR boundaries, idempotency, audit participation and database invariants are hardened and tested, and the online-payment path was rebuilt so that a browser redirect, an unsigned or mis-typed event, a forged reference or a wrong amount can no longer settle an invoice and no captured payment can silently disappear. Verdict A is not available because the provider semantics could not be conclusively validated against PayMongo itself, reconciliation has no resolution workflow, and refund/void/partial-payment policy is undefined.

**Suggested process-document status for M11:** "Server-authoritative invoices, decimal-safe full-payment settlement, receipts and full-HMO settlement hardened and tested; online payment settles only from a signature-verified, session-bound, provider-confirmed, amount-exact event with durable event records. Provider verification against live PayMongo, reconciliation resolution workflow, and refund/void/partial-payment/discount policy remain open; Verdict B."

## 43. Final pre-checkpoint gate (invoice paging, signature semantics, Hosted Checkout compatibility)

**Invoice-list behaviour before.** `GET /invoices` (Staff/Owner) and `GET /invoices/mine` (Patient) returned the newest 200 rows with `limit(200)` and no way to reach older ones — older financial records were silently hidden. **Final design.** Both endpoints are keyset-paginated, newest first by the internal id (deterministic), with `per_page` 1–100 (default 50) and `cursor` = the public id of the last row seen; the response carries `meta.per_page` and `meta.next_cursor` (null on the last page). Authorization (`Invoice::visibleTo` / the Patient's own id) is applied first; optional narrowing filters are `status` (Draft/Review/Issued/Paid), and for Staff/Owner `branch_id` (legacy_ref or ULID; unknown or numeric → 422) and `patient_id` (public ULID only). A filter can never widen a scope (Staff of another branch get nothing for any branch/patient filter; a Patient may not pass `patient_id`/`branch_id`). An unknown or foreign cursor yields an empty page and leaks nothing; an invoice created mid-paging never shifts or repeats rows (tested: 5–6 invoices, page sizes 1–2, complete walk, no repeats/omissions). **Frontend:** the Patient and Staff billing pages load 25/50 at a time, show "Showing N invoices. Older invoices are available." or "That is all …", offer "Load older invoices", merge pages without duplicates, and show a recoverable "Older invoices unavailable — Retry" that keeps what is loaded. The payment-return confirmation now asks the server for the one returned invoice (`GET /invoices/{id}`), independent of paging.

**Hosted Checkout compatibility.** Create: `POST /v2/checkout_sessions`; Basic auth with the secret key; `currency` PHP; integer centavos; the event handled is `checkout_session.payment.paid` only; the session is read back with the documented retrieval path and must match on: session id (our recorded session), invoice reference (`reference_number` equals our invoice's public id, and the event's own reference when present), `livemode`, a payment with `status = paid`, a payment id, an integer amount equal to the recorded balance in centavos, and a present currency equal to PHP. When the event reports payments, its paid payment must be the one the provider reports. A missing currency or amount is "unverifiable", never assumed. Payment methods come only from configuration (section 19).

**Webhook retry semantics.** Repeated delivery of one event id returns the recorded outcome and creates no second Payment, Receipt, audit event or ledger event (tested); the event row is locked while processed, the invoice row lock serializes settlement, and `payments_provider_reference_unique` is the last guard, so an event being processed cannot race itself into duplicate financial state.

**NOT VALID constraints.** `invoices_paid_settled_check`, `invoices_settlement_type_check`, `payments_amount_positive_check` and `receipts_amount_positive_check` are created `NOT VALID` so that PostgreSQL **enforces them on every new or changed row** (tested: a violating write is refused and `pg_constraint.convalidated` is false) without scanning, and being blocked by, any legacy row at deployment. Because they are unvalidated they are **not** presented as proof of historical integrity. Before validating them in each environment, list violators read-only — e.g. `select id from invoices where status='Paid' and paid_amount <> patient_responsibility_amount;`, `… where settlement_type is not null and not (settlement_type='full_hmo_coverage' and status='Paid' and paid_amount=0 and patient_responsibility_amount=0);`, `select id from payments where amount <= 0;`, `select id from receipts where amount <= 0;` — resolve any rows through an approved correction, then run `ALTER TABLE … VALIDATE CONSTRAINT …` (a share-update-exclusive lock, no table rewrite). No historical data was modified here.

**Gate verification.** Targeted: `Payment` 32 tests, `Billing` 31 tests (pagination 4 new) passing; full backend **495 passed / 4,633 assertions**; frontend **718 passed**; smoke **16 groups**; build **PASS**; browser QA **156 checks** (Patient/Staff/Owner/Dentist at 375/430/768/1024/1440, 0 px overflow) including reaching a second page, a failed next page with Retry, older invoices not omitted, and the success redirect remaining non-authoritative; `git diff --check` **PASS**. Remaining blockers are unchanged except that the 200-row cap and the signature/endpoint-version questions are closed: live provider verification, the missing reconciliation resolution workflow, refund/void/partial/discount/tax policy, Staff-recorded external payments being manual, and deployment configuration (including the four PayMongo variables and the migration, which has not been applied to `dental_clinic`). **Final M11 verdict remains B.**

## 44. Second pre-checkpoint gate (receipt paging, Checkout Session multiplicity, verification freshness)

**Receipts before.** `GET /receipts/mine` returned the newest 200 receipts with no paging. **Now:** same keyset style as the invoice lists — newest first by internal id, `per_page` 1–100 (default 50), `cursor` = a receipt **public** id, `meta.per_page` and `meta.next_cursor` (null on the last page); only the Patient's own receipts are reachable; an unknown or another Patient's cursor yields exactly the same empty page as any unknown cursor (the cursor lookup is itself scoped to the Patient), so it reveals nothing; malformed `per_page`/`cursor` → 422; no internal ids are exposed. Receipt numbering and reprint policy are untouched. The Patient billing page has **no** consumer of this endpoint: it shows each receipt through its paged invoice list (section 43, "Load older invoices", recoverable error), so older receipts are reachable that way; `myBillingReceipts` now accepts the same paging parameters for any future consumer. No demo receipt fallback exists.

**Checkout Session multiplicity — finding.** Before this gate **multiple simultaneously usable sessions were possible**: `createCheckoutSession` neither locked the invoice nor looked at existing sessions, so a double click, a retry or two tabs created sessions A and B, each a real, payable hosted page; paying both produced a second real capture that could only be classified Duplicate / Needs review. The provider documents no automatic expiry for a session.

**Mitigation (local, no invented lifetime, no undocumented endpoint).**
1. Creation runs in a transaction under a `lockForUpdate` on the invoice row, and re-checks payability (Paid, non-Issued and HMO-held invoices are still refused) after the lock.
2. If an `Open` session for the invoice already exists **and its recorded amount equals the current exact balance**, the **same** hosted page (stored `checkout_url`) is returned and the provider is not called again — repeated initiation yields one logical payable opportunity.
3. If the balance no longer matches, the old session is marked `Superseded` locally and a new one is created.
4. A partial unique index `payment_checkout_sessions_one_open_per_invoice (invoice_id) WHERE status='Open'` makes a second open local session impossible even if the application logic were bypassed. A provider failure rolls the transaction back: no session is recorded and the next attempt is a clean retry.
5. The Patient Pay button was already disabled while a checkout is being created; browser QA confirms repeated activation sends one request.

**Remaining external-session limitation.** Closing a provider session requires the provider's expire operation, which this integration does not call (not verified as supported for v2-created sessions, so not invented). Therefore a session left open **at the provider** after the invoice is paid, or one `Superseded` locally after a balance change, can still be paid by someone holding its URL. The local system will not apply such a payment twice: it keeps the event, marks it Duplicate / Needs review, raises the critical `billing.provider_payment_unreconciled` audit event, and fabricates neither a refund nor a reconciliation. Resolving a genuine duplicate capture remains **POLICY DECISION REQUIRED** (refund policy) and the reconciliation workflow is still absent (blocker). The migration was edited in place (still unapplied to `dental_clinic`), adding the `checkout_url` column, the `Superseded` status and the partial unique index.

**Provider status.** DOCUMENTATION COMPATIBILITY (accepted): create `POST /v2/checkout_sessions`, retrieve `GET /v1/checkout_sessions/{id}`, event `checkout_session.payment.paid`, signature `t.rawbody` HMAC-SHA256 with `te` (test) / `li` (live), retries require idempotent handlers. **LIVE PROVIDER VERIFICATION REQUIRED** is retained: real webhook shape for the account, retrieval of v2-created sessions, enabled payment methods, real redirect/webhook timing and real duplicate/retry behaviour are unverified. NOT VALID constraints: unchanged and still documented as not proving historical integrity (pre-validation queries and the future `VALIDATE CONSTRAINT` step in section 43).

**Tests added.** Backend: receipt paging (order, no gaps/repeats, bounds, public cursor, foreign-cursor indistinguishability, role refusal); repeated initiation returns one session and one provider call; DB refuses a second open session; changed balance supersedes; provider failure leaves no session and retries cleanly; Paid invoice / settlement then initiation refused; HMO change after a session refuses re-initiation; a real three-process concurrent initiation test (`tests/Support/concurrent_checkout.php`, provider faked in-process) yields one open session and one logical checkout. Frontend: receipt paging params and the disabled Pay button. Browser QA gains the single-request-on-repeated-activation check.

**Final verification (this gate, final test tree).** Full backend **503 passed / 4,708 assertions**; targeted Payment+Billing 70 passed (includes the concurrency test); full frontend 719 passed; smoke 16 groups; build PASS; browser QA 161 checks, 0 failures, 0 px overflow; `git diff --check` PASS. Verdict remains **B**.
