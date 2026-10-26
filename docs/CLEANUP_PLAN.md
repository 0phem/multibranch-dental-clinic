# Codebase Cleanup & File Audit Plan

> **Scope**: Pre-development audit of all unnecessary, dead, redundant, and temporary files in the repository.  
> **Status**: Audit Completed — Pending User Approval for Deletion.  
> **Safety Rule**: No files are deleted until reviewed and approved. Deletion must occur via Git in logical commits with automated test verification (`npm test`, `npm run test:smoke`, `npm run build`). Append-only tables, migrations, database records, and defense documents (`docs/defense/*`) are strictly protected.

---

## 1. Executive Summary

A comprehensive repository audit was conducted across the frontend (`src/`, `public/`, `tests/`), backend (`backend/app/`, `backend/routes/`, `backend/tests/`, `backend/storage/`), root directory, and utility scripts (`scripts/`).

A total of **78+ candidate files** totaling over **7 MB** of dead code, temporary scratch scripts, unrouted controllers, outdated reports, and generated test log artifacts were identified and categorized by safety level.

| Category | Item Count | Total Size (Approx.) | Risk Level | Recommendation |
| :--- | :---: | :---: | :---: | :--- |
| **1. Scratch & Temporary Files** | 68 files | ~6.0 MB | **Zero Risk** | Safe to delete immediately |
| **2. Retired Frontend Code & Dead Fixtures** | 5 files | ~25 KB | **Low Risk** | Delete after confirming test suite isolation |
| **3. Retired Backend Controllers & Tests** | 8 files | ~65 KB | **Medium Risk** | Retire cleanly; resolves 32 legacy PHPUnit test failures |
| **4. Historical Reports & Outdated Docs** | 7 files | ~70 KB | **Low Risk** | Safe to archive or remove from root |
| **5. Environment & Boilerplate Files** | 3 files | ~2 KB | **Zero Risk** | Remove or move to documentation |

---

## 2. Category 1: Scratch & Temporary Files (Zero Risk — Immediate Cleanup)

These files are ad-hoc script runs, prompt logs, and test output XMLs left behind by prior assistant runs. They are not referenced by any application code or build pipelines.

| File / Directory | Location | Size | Reason & Verification Evidence |
| :--- | :--- | :---: | :--- |
| `scratch/` (directory) | Root (`scratch/*`) | 62 files (~460 KB) | Ad-hoc Python, JSON, and text scratch files from past coding sessions. Untracked and gitignored. None are referenced by Vite, npm, or composer. |
| `scratch_4c_5a_prompt.txt` | Root | 15.4 KB | Prompt snippet from batch 4C/5A work left in repository root. Work has already been integrated and committed. |
| `junit_batch4b.xml` | `backend/` | 828 KB | Raw JUnit XML output from PHPUnit run. |
| `junit_batch5a.xml` | `backend/` | 828 KB | Raw JUnit XML output from PHPUnit run. |
| `junit_z1.xml` | `backend/` | 732 KB | Raw JUnit XML output from PHPUnit run. |
| `junit_test.xml` | `backend/` | 1.3 KB | Raw JUnit XML output from PHPUnit run. |
| `phpunit-junit.xml` | `backend/storage/logs/` | 828 KB | Log output XML. |
| `phpunit-run1.xml` | `backend/storage/logs/` | 828 KB | Log output XML. |
| `phpunit-run2.xml` | `backend/storage/logs/` | 828 KB | Log output XML. |
| `test-junit.xml` | `backend/storage/logs/` | 828 KB | Log output XML. |
| `phpunit-test.xml` | `backend/storage/logs/` | 1.3 KB | Log output XML. |
| `.phpunit.result.cache` | `backend/` | ~1 KB | PHPUnit local cache artifact. |

---

## 3. Category 2: Retired Frontend Code & Fixtures (Low Risk)

These files are completely disconnected from the active React application graph (`main.jsx` & `App.jsx`) and are not imported by any active route.

| File | Type | Size | Status & Evidence |
| :--- | :--- | :---: | :--- |
| `src/pages/Feedback.jsx` | Component | 4.8 KB | **Dead Component**. M26 Feedback was retired when scope was aligned to the official 25-module paper. Line 360 in `src/App.jsx` explicitly retired the route (`// feedback retired`). Not imported by `App.jsx`. |
| `src/feedback-api.js` | API Helper | 1.3 KB | **Dead API Module**. Only imported by `src/pages/Feedback.jsx`. Not referenced anywhere else. |
| `src/geo.js` | Helper | 1.5 KB | **Orphaned Helper**. Zero imports across all `src/` components. Only referenced in two legacy unit tests (`patient-booking-ux2.test.js`, `phase4b3c1-patient-ux.test.js`). |
| `tests/live-ui.fixture.html` | QA Fixture | 279 B | **Unused QA Fixture**. Standalone HTML file for manual browser rendering. Zero references in `package.json`, Vite configuration, or test scripts. |
| `tests/live-ui.fixture.jsx` | QA Fixture | 10.7 KB | **Unused QA Fixture**. Used only by `live-ui.fixture.html`. |
| `scripts/m26-feedback-browser-qa.mjs` | Script | 9.7 KB | **Dead Browser QA Script**. Tests retired `/api/feedback/*` routes using Playwright mocks. |
| `scripts/m23-automation-browser-qa.mjs` | Script | 11.4 KB | **Dead Browser QA Script**. Tests retired `/api/automation/snapshot` routes from the superseded automation engine. |

---

## 4. Category 3: Retired Backend Controllers, Endpoints & Tests (Medium Risk)

When scope was consolidated to the official 25 modules, endpoints for M26 Feedback and the old M23 Automation Monitor were removed from `backend/routes/api.php`. However, the controllers and tests remained, causing **32 legacy test failures**.

| File | Type | Lines / Size | Reason & Verification Evidence |
| :--- | :--- | :---: | :--- |
| `backend/app/Http/Controllers/FeedbackController.php` | Controller | 120 lines | **Unrouted Controller**. Zero occurrences in `backend/routes/api.php` or `backend/routes/web.php`. |
| `backend/app/Http/Requests/Feedback/SubmitFeedbackRequest.php` | Request | ~40 lines | Only used by `FeedbackController.php`. |
| `backend/app/Http/Resources/FeedbackVisit.php` | Resource | ~30 lines | Only used by `FeedbackController.php`. |
| `backend/app/Http/Resources/PatientFeedbackResource.php` | Resource | ~30 lines | Only used by `FeedbackController.php`. |
| `backend/app/Services/Feedback/FeedbackService.php` | Service | ~80 lines | Only used by `FeedbackController.php` and `PatientFeedback` model. |
| `backend/app/Http/Controllers/AutomationController.php` | Controller | 210 lines | **Unrouted Controller**. Former M23 Automation Monitor controller. Replaced by `AutomationSettingsController.php` (M18) and owner-facing wording approvals. Zero occurrences in `backend/routes/api.php`. |
| `backend/app/Http/Requests/Automation/AutomationSnapshotRequest.php` | Request | ~25 lines | Only used by `AutomationController.php`. |
| `backend/app/Http/Requests/Automation/DispatchAutomationRequest.php` | Request | ~25 lines | Only used by `AutomationController.php`. |
| `backend/tests/Feature/Feedback/FeedbackTest.php` | Test | 12 tests | **Failing Legacy Suite**. Tests unrouted `/api/feedback` endpoints (12 failures). |
| `backend/tests/Feature/Feedback/ConcurrentFeedbackTest.php` | Test | 2 tests | **Failing Legacy Suite**. Tests unrouted `/api/feedback` endpoints (2 failures). |
| `backend/tests/Feature/Automation/AutomationControlTest.php` | Test | 5 tests | **Failing Legacy Suite**. Tests unrouted `/api/automation` endpoints (5 failures). |
| `backend/tests/Feature/Automation/AutomationTruthfulnessTest.php` | Test | 13 tests | **Failing Legacy Suite**. Tests unrouted `/api/automation` endpoints (13 failures). |
| `backend/tests/Unit/ExampleTest.php` | Test | 16 lines | **Boilerplate Laravel Test**. Contains only `$this->assertTrue(true)`. |
| `backend/tests/Feature/ExampleTest.php` | Test | 19 lines | **Boilerplate Laravel Test**. Checks default Laravel welcome route (`/`). |

> [!NOTE]
> Retiring or archiving these 4 legacy test suites will cleanly resolve 32 out of the 34 legacy failures reported in `HANDOFF.md` section 8, aligning backend test suites 100% with operative API routes.

---

## 5. Category 4: Historical Reports & Outdated Root Docs (Low Risk)

Several root-level markdown documents are historical development reports or superseded pre-phase specifications that create clutter and confuse onboarding.

| File | Location | Size | Reason & Verification Evidence |
| :--- | :--- | :---: | :--- |
| `JOEVAN_HANDOFF_COMPLETION_REPORT.md` | Root | 22.5 KB | Historical completion report from October 1, 2026 for a past developer milestone. Safe to archive into `docs/handoff/archive/`. |
| `M1_PUBLIC_SITE_COMPLETION.md` | Root | 13.3 KB | Feature branch completion report for public website milestone. Information is preserved in commit history. |
| `FINAL_UI_AUDIT.md` | Root | 2.1 KB | Header explicitly states: *"Historical pre-Phase-1 rebuild audit... See Documentation Reconciliation for current status"*. Outdated. |
| `CLAUDE_START_HERE.md` | Root | 1.2 KB | Superseded by `HANDOFF.md` and `AGENTS.md`. |
| `IMPROVEMENT.md` | Root | 9.8 KB | Unstructured historical improvement suggestions from early phases. |
| `docs/M26_PRODUCTION_FOUNDATION.md` | `docs/` | 18.8 KB | Specification for retired M26 Feedback module. |
| `docs/DEVELOPMENT_CHECKPOINT_2026_10_13.md` | `docs/` | 2.4 KB | Stale milestone checkpoint from October 13, 2026. |

---

## 6. Category 5: Environment & OS-Specific Artifacts

| File | Location | Size | Reason & Verification Evidence |
| :--- | :--- | :---: | :--- |
| `start.command` | Root | 103 B | macOS double-click bash script (`cd $(dirname $0); npm run dev`). Not required for project execution. |
| `backend/run_tests.ps1` | `backend/` | 11 lines | Local PowerShell script with hardcoded path to an individual user's WinGet PHP executable. Gitignored. |
| `backend/run_phpunit.ps1` | `backend/` | 14 lines | Local PowerShell script with hardcoded WinGet path. Gitignored. |

---

## 7. Clarifications: Operative Files Confirmed Essential (DO NOT DELETE)

During the audit, the following files were closely scrutinized and confirmed as **actively required**:

1. **`backend/app/Services/Automation/WorkflowAutomationService.php`**:  
   *Assessment*: Even though `AutomationController` is unrouted, `WorkflowAutomationService` is actively invoked by `BillingService.php` line 134 to record audit and lifecycle system events in `system_events`. **Must be retained**.
2. **`public/images/logo.png` & `public/images/logo-with-name.png`**:  
   *Assessment*: Official clinic branding artwork. SHA-256 hashes are verified by `scripts/render-smoke.mjs`. **Protected by project rules**.
3. **`backend/storage/cacert.pem`**:  
   *Assessment*: Required by local PHP cURL to verify SSL certificates when interacting with external APIs (PayMongo, Resend, Gemini). **Must be retained**.
4. **All Defense Documents in `docs/defense/*`**:  
   *Assessment*: Defense presentation runbooks, Q&A sheets, and PDFs. **Strictly protected under `AGENTS.md` non-negotiable rules**.

---

## 8. Proposed Execution Plan (Awaiting User Sign-Off)

Once approved by the user, cleanup will proceed in isolated, logical Git batches:

1. **Batch A (Immediate Scratch & Logs Cleanup)**:
   - Remove `scratch/` directory contents.
   - Remove `scratch_4c_5a_prompt.txt`.
   - Remove leftover `.xml` files in `backend/` and `backend/storage/logs/`.
   - Verify: `git status` clean of untracked scratch clutter.
2. **Batch B (Dead Frontend Fixtures & Unused Files)**:
   - Remove `tests/live-ui.fixture.html` and `tests/live-ui.fixture.jsx`.
   - Remove `src/pages/Feedback.jsx` and `src/feedback-api.js`.
   - Remove `scripts/m26-feedback-browser-qa.mjs` and `scripts/m23-automation-browser-qa.mjs`.
   - Verify: `npm test`, `npm run test:smoke`, `npm run build`.
3. **Batch C (Retired Backend Controllers & Legacy Suites)**:
   - Archive or remove `FeedbackController.php`, `AutomationController.php`, and their dedicated request classes.
   - Quarantine or archive the 4 legacy test suites (`FeedbackTest`, `ConcurrentFeedbackTest`, `AutomationControlTest`, `AutomationTruthfulnessTest`) to resolve test suite status.
   - Remove boilerplate `ExampleTest.php` files.
   - Verify: Full PHPUnit test suite.
4. **Batch D (Documentation Hygiene)**:
   - Move historical completion notes (`JOEVAN_HANDOFF_COMPLETION_REPORT.md`, `M1_PUBLIC_SITE_COMPLETION.md`, `FINAL_UI_AUDIT.md`) into a structured `docs/archive/` folder or delete as approved.
