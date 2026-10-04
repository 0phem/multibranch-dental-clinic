# M14 production-readiness audit and hardening — Patient Forms, Documents & Consent Management

Audit date: 2026-10-04 (Asia/Manila). No commit, push, merge, or M19/M20/M26 work.

## 1. Starting git state

Branch `feature/m14-documents-consent-production-hardening`, created from `471a721` ("feat(m4): harden patient records authority and privacy") on a clean tree synchronized with origin.

## 2. Evidence basis and boundaries

Interview Q16 identifies prescription as the main paper/manual item and says the other workflows are already digital. It supports secure document and form infrastructure. It does **not** establish consent-form types, mandatory forms, retention periods, signature or e-signature requirements, guardian rules, deletion rules, allowed file types or size limits. None of these was invented; each is listed in section 33 as a clinic question.

## 3. Architecture discovered

`documents` (ULID `public_id`, Patient FK, nullable Visit/HMO case/branch FKs, category, title, `file_path`, sanitized original filename, MIME, size, SHA-256, status Active/Archived/Retracted, uploader FK, retraction fields), `patient_consents` (type from a fixed list, version, Granted/Withdrawn, `signed_at`, recorder, optional document) and `document_extractions` (Draft/Reviewed/Rejected). `DocumentController`, `DocumentStorageService`, `TextExtractionService`, two resources and the `Document::visibleTo` read scope. Files are written to the Laravel `local` disk rooted at `storage/app/private`. The frontend has a Staff/Dentist documents tab in Patient Records and a Patient "Me" documents and consents section. There is no queue/job, no OCR, no external storage and no malware scanner.

## 4. Document authority before changes

Server rows and files were authoritative, but the authorization and validation around them were weak (all findings were reproduced by reading the code and are covered by tests that fail on the old behaviour):

- **Staff:** `visibleTo` included `OR branch_id IS NULL`, so any Staff account — **including one with no authorization branch scope** — could read, download and see the extracted text of every branchless document of every Patient. A Staff upload with no branch or Visit was allowed and created exactly such a document.
- **Dentist:** read every document of any Patient they had ever been the responsible Dentist for (`patient.visits`), and could upload for any Patient. Not an existing contract (see M4 §35).
- **Owner:** read everything and could upload; no contract establishes this.
- **Consents:** Staff, Dentist and Owner could list, record and withdraw consent for any Patient; a supporting document that did not belong to the Patient was silently ignored; duplicates were accepted; the consent scope method returned every record to Staff/Dentist.
- **Upload validation:** only the browser-reported or `finfo` MIME type was checked. The storage extension was taken from the client's filename. The sanitised name was not applied to the stored display name or title.
- **Identifiers:** the Visit, HMO case, branch and consent-document lookups still accepted the internal bigint id (`orWhere('id', …)`).
- **Failures:** the file was written inside the transaction but never removed on failure; the audit event was written after commit, so an audit failure left an uploaded document with no audit and a 500; retraction wrote the free-text reason into the audit payload; the upload payload logged the title.
- **Extraction:** images got a **fabricated** extraction ("Scanned Document: <title>…", confidence 0.75) built from the title and client metadata, and the "provider candidate" could come from the title. Native PDF extraction invented confidence 0.95/0.40 and could expand a compressed stream without a bound; an exception message was stored in the payload.
- **Delivery:** `local` disk had `serve => true`.
- **Privacy:** the list endpoint returned every extraction's full text and candidates; a Patient saw staff members' names as uploaders.
- **Frontend:** the UI claimed "Encrypted … integrity verification" (neither exists); a failed consent or document load became "No … found" (`.catch(() => [])`); it offered categories (`prescription_source`, `invoice_proof`) and a consent type (`procedure_specific`, `financial_agreement`) the server rejects; it mapped `row.uploader` and `extraction_method` while the API returns `uploaded_by` and `method`; the documents tab fell back to `patientCode`/the local id as the Patient identifier; Retract was shown on every document.

## 5. Document authority after changes

The Laravel server remains the sole authority. All reads, downloads, uploads, retractions and consent actions are decided server-side by `Document::visibleTo`, the upload rules and the Patient policy; the front end never builds a file URL and never falls back to local data.

## 6. Storage architecture

Private `local` disk only (`storage/app/private`), `serve` now **false** (no framework route can serve it; a test requests `/storage/...` and gets 404). The stored name is `documents/<patient public_id>/<ULID>.<ext>` with the extension taken from the *detected content type*; the client's filename is never part of a path and is reduced to a sanitised display name (separators, control characters and leading dots removed, length-limited). Database `file_path` is now unique. Downloads are authorized streams with `nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`, `no-store` and no path in any header or body; a missing object is `404 file_not_found` and a size mismatch is `409 storage_mismatch`. **No encryption at rest is configured by the application**; protection depends on host disk controls. No external/cloud storage is used.

## 7. Public identity model

Document, consent and extraction ids are public ULIDs; route binding resolves only `public_id` (a numeric id, a malformed value or an unknown ULID is 404). Patient references use the Patient `public_id` (M4). The **Visit** has a stable `public_id` contract (`VisitResource`), so the M14 Visit reference is now ULID-only (migrated from the numeric fallback); HMO case references are ULID-only; branches use `legacy_ref` or the ULID, never the bigint (M2).

## 8. Patient linkage

`patient_id` is required for Staff/Dentist uploads and must be a Patient public_id; for a Patient it is **prohibited** (422) and the owner is the signed-in account (previously silently overridden). A document's Visit and HMO case must belong to that Patient (422 mismatch).

## 9. Visit linkage

A Visit reference is a ULID. Staff and Dentist must be able to read that Visit under its own scope (`Visit::visibleTo`); a Patient may link only their own Visit. The Dentist rule ("responsible Dentist for that Visit") is the existing M5/M8 entitlement, used here rather than invented.

## 10. Role / access matrix (final)

| Action | Guest | Patient | Staff | Dentist | Owner |
| --- | --- | --- | --- | --- | --- |
| List | 401 | `GET /documents/mine`, own, not retracted | scoped (below) | only documents linked to a Visit they are responsible for | 403 |
| Metadata read | 401 | own | scoped | visit-linked | 403 |
| Download / view | 401 | own | scoped | visit-linked | 403 |
| Upload | 401 | own (owner not nameable) | requires a branch or Visit in their scopes; no scope → 403 | only to a Visit they are responsible for | 403 |
| Edit metadata / replace | none | none | none | none | none — not implemented; policy undecided |
| Retract (soft, audited, file kept) | 401 | own uploads only | scoped | own uploads only | 403 |
| Hard delete / archive | none | none | none | none | none — POLICY DECISION REQUIRED |
| Extraction request | automatic for text PDFs at upload; no endpoint | — | — | — | — |
| Extraction review | no endpoint exists (`Reviewed` is unreachable) | — | — | — | — |
| Consent list / record / withdraw | 401 | own (self-attested) | only when they may read that Patient's full profile (the M4 boundary: an appointment or Visit in their scopes) | 403 | 403 |

Staff scope: a document whose branch (or whose Visit's branch) is in the account's authorization scopes; a document with no branch and no Visit only for a Patient who has an appointment or Visit in those scopes; **no scope reaches nothing**. A retracted document is 410 for everyone. Owner and Dentist consent access and Owner document access fail closed and are POLICY DECISION REQUIRED. The Staff boundary reuses the conservative M4 technical rule and is not confirmed clinic policy.

## 11. Upload validation

Order: the file is valid; non-empty (`empty_file`); at most 10 MB; its **leading bytes must be a PDF, JPEG, PNG or WebP signature** and the server-detected MIME type must agree (`disallowed_mime_type` otherwise: renamed scripts, executables, SVG, a PDF named `.png`, a PNG named `.pdf`). The client Content-Type and extension are never trusted and the extension is derived from the detected type. Category and consent type are validated against enumerations. The narrowest set already in the repository (PDF, JPG, PNG, WebP; 10 MB) is preserved; widening it is a clinic decision. A file named `x.php.pdf` is stored as `<ULID>.pdf`; `../../etc/id card.pdf` is displayed as `id card.pdf`.

## 12. Download authorization

Authorization happens before any storage access (`Document::visibleTo`); non-owners get 403, retracted documents 410, a missing object 404, a size mismatch 409. The API never returns a path, key or permanent URL. A document is delivered `inline` only for the four validated types, under a sandboxing CSP.

## 13. IDOR / security findings

Fixed: Staff with no scope reading branchless documents; Dentist and Owner over-reach; consent management for any Patient; bigint/code acceptance for Visit, HMO case, branch and consent-document references; silent override of a Patient's named owner; client-controllable fields (the request now **rejects** with 422 `file_path`, `storage_key`, `checksum_sha256`, `mime_type`, `file_size_bytes`, `status`, `uploaded_by*`, `created_by`, `verified_by`, `retracted_*`, `public_id`, `id`, `extraction*`, `consent_status`, `created_at`/`updated_at`; `metadata` accepts only `provider` and `member_number`); path traversal in names; disk-served storage routes. Verified by tests: Patient A cannot read, download, list or retract Patient B's document (403); unknown/numeric/malformed ids are 404; a consent id under another Patient's URL is 404; guests are 401.

## 14. Privacy projection

Lists carry only metadata and an extraction **summary** (id, method, status, draft flag, confidence, time); extracted text and candidates appear only in the single-document response. A Patient sees only the uploader's account kind, never a staff name. No storage path, key, internal id or uploader user id is exposed.

## 15. Consent architecture

Consent exists as server records (Patient, a fixed `consent_type`, `version`, Granted/Withdrawn, `signed_at`, recorder, optional document). It is **self-attested or front-desk-recorded acknowledgement — not signature evidence**: there is no signature capture, form definition, wording, expiry or guardian flow. Hardened: authorization (above); a supporting document must be an active document of that Patient (422, previously ignored); a second active Granted consent of the same Patient/type/version is 409 `consent_already_granted` (it may be recorded again after withdrawal); grant and withdraw run in a transaction with the Patient/consent row locked and audit inside it; forged `status`, `signed_at`, `recorder` and `patient_id` are rejected. The fixed type list (general treatment, data privacy, HMO authorization, photography, minor treatment) predates this pass and is **not clinic-confirmed**. Consent as a legal record remains a production blocker.

## 16. Extraction / OCR architecture

Only **native text extraction from PDFs that contain a text layer** exists; the result is always a `Draft`, non-authoritative record with provenance (`source: document_text`, `human_reviewed: false`), no invented confidence (null), candidates (dates, a provider name, a member number) taken **from the extracted text only**, and a bounded decompression (5 MB per stream) with no exception text stored. Images and scanned PDFs get **no extraction** and the API says so (`text_extraction: unavailable_ocr_not_configured | no_text_layer`); the fabricated image "extraction" was removed. Nothing is ever applied to an HMO case, prescription, treatment, billing, Patient identity or consent (tested: an extracted "approve this case" text changes nothing). No language model processes documents; extracted text is rendered as plain text and is inert data. There is no review endpoint: who reviews extraction output is a clinic decision.

## 17. Malware scanning

None exists. The API reports `security_scan: not_performed` and the UI says files are type-checked but not scanned for malware. No document is labelled safe. Production needs a real scanner and a quarantine status before this can be called ready.

## 18. M4 boundary

M4 lists no document data and copies none; the Patient longitudinal index does not include documents (a client queries M14, which stays the authority). M14 uses M4's Patient `public_id` and its Staff full-profile boundary for consent access.

## 19. M12 boundary

M14 stores a document linked to a Visit-anchored HMO case by ULID (Staff must be able to read that case) and may produce a draft; it never transitions a case (tested: status and revision unchanged after a linked upload).

## 20. M19 readiness

M14 can store a prescription image/PDF and produce a draft for M19 to interpret; M14 does not model prescriptions. The `prescription_source` upload category the UI offered was removed because the server never accepted it; adding one is M19's/M14's joint decision.

## 21. M22 audit coverage

`document.uploaded` (category, MIME, size, checksum, whether a draft was created), `document.retracted` (only that a reason was recorded), `consent.granted`, `consent.withdrawn`. Upload and retraction audit now run **inside** the transaction (an audit failure rolls the upload back and removes the stored file). No title, filename, extracted text or contents enter a payload. Not audited: document reads/downloads and extraction events (a read-audit policy is undecided).

## 22. Browser-local / demo sources

None for documents: no localStorage/base64 documents, no fake URLs, no demo consents or extraction exist in the client. The only local-state defects were the swallowed-error empty states, the stale identifier fallback and the invalid option lists above (all fixed). Under a server session a failed load is an explicit "unavailable" state with Retry.

## 23. Database / schema changes

One forward-only migration `2026_10_12_000100_harden_document_integrity.php`: `documents.file_path` unique; `documents.patient_id` and `patient_consents.patient_id` foreign keys change from CASCADE to RESTRICT, so a Patient cannot be deleted out from under their clinical documents or consents. No row is changed or removed. It was exercised only on `dental_clinic_test` and **has not been applied to `dental_clinic`**; apply it before deploying this code. Behavioural note: documents previously visible to any Staff through a null branch become visible only through the scoped Patient relationship.

## 24. Files changed

Backend: `Document.php`, `PatientConsent.php`, `DocumentController.php`, `DocumentStorageService.php`, `TextExtractionService.php`, `DocumentResource.php`, `DocumentExtractionResource.php`, `config/filesystems.php`, `routes/api.php`, migration above. Frontend: `src/documents-api.js`, `src/pages/Clinical.jsx`, `src/pages/PatientMe.jsx`. Tests/tooling/docs: `DocumentManagementTest.php` (rewritten), `PatientRecordTest.php`, `AuditTrailTest.php`, `tests/documents-api.test.js` (new), `tests/m14-documents.test.js`, `scripts/m14-documents-browser-qa.mjs` (new), this report.

## 25. Tests added / changed

Backend, 38 document tests (previously 11) covering: content signatures (exe, PHP renamed `.pdf`, PDF named `.png`, PNG named `.pdf`, SVG), empty and oversized files, path-like and Unicode names, storage name and extension, forbidden fields and metadata allowlist, Patient owner not nameable, numeric/code/malformed references for Patient, Visit, branch and HMO case, the full role matrix (Staff scope/no scope/branchless, Dentist visit-tied, Owner none, Patient isolation, guests), private storage not served, missing/mismatched objects, storage-write failure, audit-failure rollback with no orphan file, idempotent replay and key reuse, PDF draft with text-only candidates, no fabricated image extraction, no-text-layer PDF, list-versus-detail extraction privacy, inert instruction-like text, retraction rules and audit minimality, upload audit minimality, HMO linkage with no state change, consent authorization/duplicates/forged fields/document linking/withdrawal, mine endpoints, FK restrict and unique path, projection privacy. Frontend, 6 new (mapping, enum parity with the server, explicit failures, idempotency key, download messages, screen source assertions) plus two updated legacy assertions. Updated: the M4 document-upload and consent-route tests (real PDF content, new Staff boundary) and the audit trail test (real JPEG content; reason not in payload).

## 26–32. Verification results

- Targeted M14 backend (`tests/Feature/Documents`): **38 passed / 336 assertions**.
- Cross-module: M4 (`tests/Feature/Patients`), M12 (`HmoTest`, `ConcurrentHmoDecisionTest`), M22 (`AuditTrailTest`) and the M5/M6/M8/M9/M11 suites ran as part of the full suite.
- Full backend: **421 passed / 3,619 assertions** (M4 checkpoint baseline 394 / 3,331; an earlier run in this pass had 2 failing tests that asserted the old behaviour and were updated).
- Targeted frontend (`documents-api`, `m14-documents`): **12 passed**. Full frontend: **704 passed**, zero failures/skips (previously 698).
- Render smoke: **16 passing groups**. Production build: **PASS**, initial JS 455.41 kB / 138.93 kB gzip; no dependency changes.
- Browser QA (`scripts/m14-documents-browser-qa.mjs`, installed Chrome, HTTP fixtures): **131 checks passed** across Staff, Dentist, Owner and Patient at 375, 430, 768, 1024 and 1440, **0 px overflow**. Verified: documents and consent lists load; a failed load is an explicit error with Retry and never an empty list; images report extraction unavailable (not fabricated); the draft viewer says "Draft — not verified" and renders candidates as text; upload categories equal the server's; a server refusal is explained and a successful upload reloads from the server with an Idempotency-Key and an authorized branch; a failed download is explained; Dentist has no upload/consent/retract controls and issues no consent request; Owner has no documents page; a Patient may retract only their own uploads; no encryption claim anywhere. The only console errors are the 404/422/500 fixture responses injected on purpose. Not physical-device, cross-browser, screen-reader or live-backend certification.
- `git diff --check`: **PASS**.

## 33. Unresolved clinic / policy questions (not answered here)

1. Which forms and consents are required, and who creates templates and versions?
2. Can Patients sign digitally; are e-signatures or handwritten signatures required; what counts as signature evidence?
3. Is guardian/minor consent needed?
4. Can a signed form or document be replaced or corrected (versioning)?
5. Who may archive or delete documents, and what is the retention and destruction schedule?
6. Should document reads and downloads be audited?
7. Which file types and maximum size does the clinic want?
8. Which categories may Patients upload themselves?
9. Which extraction outputs need Staff versus Dentist review, and who confirms them?
10. Owner access to documents and consents; Dentist access to consents; Dentist access beyond their own Visits.
11. Staff access to a Patient who has no appointment or Visit in their branches.

## 34. Remaining blockers

1. No consent policy: types, wording, signatures, expiry and guardian rules are undefined; current records are acknowledgements, not legal evidence.
2. No retention, archive or deletion policy (Retract is the only soft state; patients with documents cannot be deleted).
3. **No malware scanning** and no quarantine state.
4. No OCR; scanned documents have no text; no extraction review workflow or reviewer policy.
5. No encryption at rest or external/object storage by the application; no unreferenced-file sweeper (a crash between the file write and the database commit can leave an orphan; ordinary failures are cleaned up).
6. Owner, Dentist and Staff access boundaries above are conservative technical choices, not confirmed policy.
7. The additive migration has not been applied to `dental_clinic`.

## 35. Verdict

**Verdict B — not production-ready as a complete module.** The authorization, validation, private-storage, identifier, audit, failure-handling, extraction-honesty and frontend-honesty defects found were fixed and tested, and the server is the sole document authority. Verdict A is not available because consent, retention/deletion, signature/legal, allowed-format and reviewer policies are undefined, no malware scanner or OCR exists, and encryption/orphan-sweeping are not provided.

**Suggested process-document status for M14:** "Server-authoritative private document storage with content-validated uploads, role-scoped authorized access, soft audited retraction, draft-only native PDF text extraction, and acknowledgement-level consent records hardened and tested. Consent/signature, retention and deletion policy, malware scanning, OCR and extraction review remain open; Verdict B."
