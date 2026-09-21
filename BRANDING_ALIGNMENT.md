# Branding alignment

Applied on `chore/clinic-branding` from `3197cd6` (Fix dentist service assignment persistence reload), before Phase 4B. This is a presentation/identity change only: no workflow, business rule, ERD, module (M1–M25), persistence or dependency change.

## Authoritative clinic identity

**Dr. Dana E. Roxas**
**Dental Clinic**

"Dental Clinic" is the supporting/subtitle line. The identity is real accessible HTML text; logo artwork never substitutes for it. The application no longer presents itself to users as "DentalOps".

## Clinic assets

Neither asset is ever redrawn, regenerated, recolored, cropped or replaced. Both are byte-identical to what was supplied; `scripts/render-smoke.mjs` records their SHA-256 hashes and fails if either changes (update the hashes only when the client supplies a replacement).

| Asset | Browser path | Treatment |
| --- | --- | --- |
| `public/images/logo.png` (446×448) | `/images/logo.png` | Approved compact clinic logo and the **current primary branding asset**. Rendered beside the clinic-name text on the login page, the desktop sidebar and the phone navigation drawer. Decorative next to that text, so its alt is empty. |
| `public/images/logo-with-name.png` (632×316) | `/images/logo-with-name.png` | Supplied full artwork. **Preserved unchanged and not rendered.** Its embedded wording does not match the authoritative identity (see below), so it is used only if the client approves a specific usage. |

`logo.png` has about 15% built-in transparent margin; the login layout offsets it in CSS so its artwork aligns with the copy below. The file is not altered.

### Why the lockup is not rendered

Inspection showed its embedded artwork reads "DANA ROXAS / DENTAL CLINIC", with no "Dr." and no "E.", and also includes a second Dentist's name and a services line. It therefore does not match the authoritative identity. It stays in `public/images/` because it is a supplied clinic asset. Whether it is reissued or approved as-is for some placement is a client decision.

## Visible changes

| Where | Before | After |
| --- | --- | --- |
| Login/welcome | Compact logo + "DentalOps / Clinic workspace" | Compact logo + "Dr. Dana E. Roxas / Dental Clinic" (text, scaled up for the login surface) |
| Desktop sidebar | Logo + "DentalOps / Clinic workspace" | Compact logo + "Dr. Dana E. Roxas / Dental Clinic" |
| Phone navigation drawer | No brand | Same compact brand at the top (its accessible text reads "Dr. Dana E. Roxas Dental Clinic"). The phone top bar intentionally gets no duplicate logo. |
| Browser/document title | "DentalOps — Multi-Branch Dental Clinic UI Prototype" | "Dr. Dana E. Roxas Dental Clinic" |
| Assistant panel title | "DentalOps Assistant" | "Clinic Assistant" |
| Export filenames (Owner reports) | `dentalops-branch-capacity.csv`, `dentalops-hmo-report.csv` | `branch-capacity.csv`, `hmo-report.csv` |
| Demo seed email addresses (Owner → People & Team) | `…@dentalops.demo` | `…@clinic.demo` |

### Demo email decision

Only the seed data changed, so fresh or reset demo workspaces get `@clinic.demo`. No migration was introduced and saved user/workspace emails are not rewritten. **Existing saved demo workspaces may retain legacy `@dentalops.demo` addresses** until a separately reviewed compatibility migration or a demo reset. Those stored values are demo data, not application/product branding.

## Deliberately retained

| Identifier | Why it stays |
| --- | --- |
| `dentalops-v4-*` localStorage keys (`store.jsx`, `persistence.js`) and the tests/smoke that use them | Renaming would strand every existing saved workspace without a reviewed migration. Not user-facing. |
| `dentalops-production-ui` skill name/directory, `package.json` / `package-lock.json` name | Stable internal identifiers referenced by tooling and instructions; the skill heading and body use the clinic identity. |
| `docs/architecture/` ERD artifacts (data dictionary title, SVG title) | Approved ERD artifacts, unchanged by instruction. |
| `P1_PRODUCTION_UI_REFRESH.md`, `PHASE4A_UI_FOUNDATION.md` | Historical records of what existed at the time. |

## Files changed

`src/layout.jsx`, `src/foundation.css`, `src/data.js` (seed email domain only), `src/pages/Admin.jsx` (export filenames only), `index.html`, `scripts/render-smoke.mjs`, `AGENTS.md`, `.agents/skills/dentalops-production-ui/SKILL.md`, `README.md`, and this file. `public/images/logo-with-name.png` is the newly supplied asset.

## Verification

- `git diff --check` clean; `npm test` 305/305 (unchanged); `npm run test:smoke` 11 scenarios pass (one added: brand alignment); `npm run build` succeeds with the existing Vite chunk-size warning left visible.
- The brand smoke scenario checks that the login and every role's shell render `/images/logo.png` with the exact text "Dr. Dana E. Roxas" / "Dental Clinic"; that referenced images exist; that both assets exist and match their recorded SHA-256 hashes; the document title; and that neither rendered UI nor presentation source uses the old product name. It does not require the lockup to be rendered and does not assert internal identifiers. Deliberate regressions (wrong login logo, wrong name text, modified asset bytes, old name in the assistant title or an export filename) each fail it.
- Headless Chrome at 375, 430, 1024 and 1440px: no page-level horizontal overflow on the login or the Staff shell; the logo loads and the clinic text is legible at each width; the phone drawer shows the brand. Other roles reuse the same shell brand component but were not each screenshotted.

## Open items for review

- Client decision on the supplied lockup (wording, or approved placement).
- The seed Owner persona is still "Dr. Dana Roxas" (illustrative seed data); no middle initial was added.
- No favicon was added.
