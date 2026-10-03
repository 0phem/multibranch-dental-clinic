# Public locations and focused authentication refinement

Review date: 2026-10-03. Starting checkpoint: `5ea5e92e4f86f828d3a3fb84db27c7d8f34da812`, branch `feature/m1-auth-premium-registration-ux`. Initial status was clean and matched origin. No commit or push performed.

This is a presentation refinement, preserving the existing public website and server-backed M1 authentication. Historical frontend-only descriptions in README, CLAUDE.md and the UI skill predate that implementation; they were not rewritten. No backend application code, operational branch records, authorization, scheduling, billing, HMO, payment, documents, analytics, audit or automation logic changed. Official image assets are unchanged.

## AUTH — requested items 1–7

1. **Previous design critique:** Browser inspection at 1440px and 375px found a dominant teal promotional panel on desktop, duplicate clinic branding and feature claims competing with the actual form. Mobile had excessive empty space, tiny registration group headings, inconsistent field rhythm and an undifferentiated OTP field.
2. **Removed:** the secondary clinic brand, “Care, thoughtfully connected.” headline, portal description, and the three appointments/messages/billing feature bullets. Also removed the duplicate verification error notice; the error is now announced once next to its field.
3. **Login:** a centered 500px card (418px inner region), Patient Portal eyebrow, Welcome back heading, explicit Email/Password labels, aligned Show/Hide, full-width sign-in action, account transition, and quiet website-return/contact links outside the card. Public header/footer retained.
4. **Register:** a separate 760px card with semantic fieldsets/legends for Personal information, Contact information and Account security. Name and password pairs use two columns where space permits. Email and phone have full rows. Exact email helper, required DOB, international normalization and both password controls remain. Searchable country selection supports arrows, Home/End on options, Enter and Escape; the phone input is associated with its label, hint and errors.
5. **Verification:** restrained shield mark, clear title, separately masked destination, prominent single six-digit input with numeric keyboard and OTP autocomplete, expiry hint, one primary action, email-return action and existing resend/cooldown controls. Reload recipient recovery remains. No OTP/server/session rules were changed.
6. **Desktop QA:** rendered and inspected Login/Register/Verification, including masked and recovery verification, grouping, errors and controls. Registration is visibly wider than Login. Forms remain the visual focal point.
7. **Mobile QA:** single-column forms; country search/selection/typing, DOB entry, both password toggles, server validation, account transition and OTP/resend behavior exercised. No horizontal overflow at 375/430px. Form inputs use 16px text; controls have practical touch targets and visible focus.

## LOCATIONS — requested items 8–18

8. **Implementation:** one plain Leaflet map with OpenStreetMap raster tiles, below the existing final CTA and above the unchanged Contact section. Three numbered markers match three semantic address cards.
9. **Dependency:** `leaflet` 1.9.4; no React-Leaflet, geocoding service, keys or paid API. Playwright is an optional QA tool supplied via `PLAYWRIGHT_MODULE`, not a shipped dependency.
10–12. **Verified coordinates, methods and final configuration:** `src/clinic-config.js` contains the following immutable public presentation records, with `id`, `number`, `name`, `address`, `latitude`, `longitude` and `source`. They are not M2 operational branch records.

| ID / number | Exact supplied public name | Exact supplied address | Latitude | Longitude | Current place source |
| --- | --- | --- | --- | --- | --- |
| `bocaue-37` / 01 | Dr. Dana Roxas Dental Clinic | #37, MacArthur Hwy, Bocaue, 3018 Bulacan | 14.800254 | 120.9233274 | [Google Maps place](https://www.google.com/maps?cid=15251005469195418416) |
| `bocaue-cardinal` / 02 | Roxas - Cardinal Dental Center | 67 MacArthur Hwy, Wakas, Bocaue, 3018 Bulacan | 14.7996762 | 120.9234564 | [Google Maps place](https://www.google.com/maps?cid=166116950672724786) |
| `guiguinto-gd-plaza` / 03 | Roxas Dental Clinic Guiguinto | Unit 20 GD Plaza, Guiguinto, Bulacan | 14.8284409 | 120.8745988 | [Google Maps place](https://www.google.com/maps?cid=9281875676794275970) |

Verification was done at development time, not at visitor runtime:

- Each named Google Maps place was opened in Chrome; the visible place name and full address matched the supplied data. The location tuple was read from that place's `APP_INITIALIZATION_STATE` record adjacent to its name and feature ID, not inferred from the viewport center or a town centroid. Decimal `cid` links above are lossless conversions of the source feature IDs.
- 01: feature `0x3397ad5b4b7ede5d:0xd3a674abc2eebb30`, displayed plus code `RW2F+48`. Visually checked along MacArthur Highway near 7-Eleven Wakas. [Waze's exact named listing](https://www.waze.com/live-map/directions/dr.-dana-roxas-dental-clinic-1-manila-north-rd-37-bocaue?to=place.w.79233172.792462792.21851981) independently locates the clinic at 37 Manila North Road; its pin (14.800347328, 120.923202514) is slightly different. The current Google place pin is used, without averaging.
- 02: feature `0x3397adef6c7200b5:0x24e2a7c8c04d332`, displayed plus code `QWXF+V9`. Visually checked just south of 01 along the same highway. [ClinicFinderPH's matching listing](https://www.clinicfinderph.com/clinic/roxas---cardinal-dental-center) links directly to the identical latitude/longitude through its Google Maps directions action.
- 03: feature `0x339653d586290bc9:0x80cfd8c024a94882`, displayed plus code `RVHF+9R`, explicitly listed within GD Plaza. Visually checked beside MacArthur Highway west of the Guiguinto River. [PuertoParrot's exact-name/address listing](https://www.puertoparrot.com/service/show/bulacan/guiguinto/87006/roxas-dental-clinic-guiguinto) has an older nearby pin (14.8286179, 120.8747708); the current Google place pin is used. The delivered overview shows Guiguinto northwest of the two Bocaue locations, matching the source maps.

No hours, branch phone numbers, services, schedules, parking claims, legal group name or “main branch” designation were added. Central public contact details remain `tel:+639228787341` and `mailto:danaroxas.dentalclinic@gmail.com`.

13. **Interaction settings:** dragging, scrollWheelZoom, doubleClickZoom, boxZoom, keyboard, touchZoom, tapHold and zoomControl are all false. Markers are noninteractive and non-keyboard; canvas has `pointer-events:none` and `aria-hidden=true`. Attribution is a visible, usable OpenStreetMap contributors link outside the hidden canvas. Page scrolling and page accessibility remain independent of the map.
14. **Lazy loading:** IntersectionObserver with a 240px approach margin triggers the map JS/CSS import and then tile loading. Nothing requests map code or tiles at the homepage hero or on auth routes. No global startup loader is involved. Fixed 420px desktop / 360px tablet / 340px small-phone frames avoid load-related layout shift. Observers, timers and Leaflet instances are cleaned up on unmount, including StrictMode replay and navigation during import.
15. **Fallback:** import rejection, initialization errors, tile failures or a 12-second load timeout produce “Map unavailable” inside the same frame. The three address cards always render independently. Both chunk and tile failures were injected in browser QA.
16. **Desktop QA:** all pins/cards visible; numbers match; tile basemap and source positions visually cross-checked. Wheel, drag, double-click, keyboard and synthetic pinch leave the map view unchanged.
17. **Mobile QA:** map spans content width; address cards stack; all labels remain within the frame at all five widths. Wheel over the map scrolls the page. The map has no focusable descendants.
18. **Bocaue label readability:** 01 is above its exact coordinate and 02 below its exact coordinate, each with a leader line. The place coordinates are about 66 metres apart. Only labels are offset; no geographic positions are altered. Browser checks assert the numbered labels do not overlap at any tested width.

## QUALITY — requested items 19–36

19–23. `document.documentElement.scrollWidth - document.documentElement.clientWidth`:

| Width | Home / locations | Login | Register | Verification |
| --- | --- | --- | --- | --- |
| 375px | 0 | 0 | 0 | 0 |
| 430px | 0 | 0 | 0 | 0 |
| 768px | 0 | 0 | 0 | 0 |
| 1024px | 0 | 0 | 0 | 0 |
| 1440px | 0 | 0 | 0 | 0 |

Open country menus, masked verification/errors and map fallbacks were also checked for zero overflow.

24. **Console:** zero unexpected console or JavaScript runtime errors. The live signed-out session check produces expected `/api/me` 401 entries. The fixture suite intentionally produces 401/422 and blocked tile/chunk request entries (33 in the development pass); these are reported separately, not counted as application exceptions.
25. **Targeted backend:** `php artisan test tests/Feature/Auth`: 41 passed, 214 assertions.
26. **Full backend:** `php artisan test`: 337 passed, 2,842 assertions. The user explicitly authorized the existing test harness to rebuild only `dental_clinic_test`. No development database reset was performed. The shell's Herd PHP initially failed before running tests due to an incompatible local dylib; the suites passed with the existing MAMP PHP 8.3.30 runtime and a non-login shell.
27. **Targeted auth/frontend:** 25 passed across `m1-registration-verification.test.js` (5) and `public-auth-site.test.js` (20). An old source assertion requiring marketing-panel copy was updated to preserve shared-shell/branding/responsiveness coverage and assert removal of that panel. Earlier tests otherwise retained.
28. **Targeted map/frontend:** `public-locations.test.js`: 5 passed. Covers exact configuration, unique IDs, recorded coordinates, disabled handlers, independent semantic addresses, lazy loading/fallback/teardown boundaries. Browser tests cover actual rendered failure and interaction behavior.
29. **Full frontend:** `npm test`: 680 passed, zero failures/skips.
30. **Smoke:** `node scripts/render-smoke.mjs`: 16 passing scenario groups, including 42 initial role/page renders and unchanged branding asset hashes.
31. **Build:** `npm run build` passed; no chunk-size warning in this build.
32. **Bundle impact:**

| Asset | Starting checkpoint | Refined build | Difference |
| --- | --- | --- | --- |
| Initial JS | 451.01 kB / 137.50 kB gzip | 453.68 kB / 138.41 kB gzip | +2.67 kB / +0.91 kB gzip |
| Initial CSS | 134.05 kB / 24.73 kB gzip | 139.10 kB / 25.67 kB gzip | +5.05 kB / +0.94 kB gzip |
| Deferred map JS (Leaflet + adapter/options) | — | 150.71 kB / 43.83 kB gzip | Separate lazy chunk |
| Deferred map CSS | — | 15.61 kB / 6.46 kB gzip | Separate lazy chunk |
| Phone JS | 193.34 kB / 50.01 kB gzip | 193.34 kB / 50.01 kB gzip | Unchanged |

The baseline was built from an isolated `git archive` of the required checkpoint with the installed toolchain, without touching the working tree.

A separate minified Leaflet-only measurement is 149.48 kB / 43.28 kB gzip; the shipped map chunk also includes the adapter/options.

Map tile image transfer varies by viewport/cache/network and is not included in JS/CSS sizes. The public location cards and observer shell are small initial presentation code; Leaflet itself is deferred.

33. **Diff check:** `git diff --check` passed.
34. **Changed files:**

- Dependency: `package.json`, `package-lock.json`.
- Auth UI/styles: `src/layout.jsx` (Login only), `src/pages/AuthShell.jsx`, `src/pages/PatientRegister.jsx`, `src/pages/EmailVerification.jsx`, `src/foundation.css`, `src/public-site.css`.
- Public locations: `src/clinic-config.js`, `src/clinic-map-options.js`, `src/clinic-map.js`, `src/pages/PublicLocations.jsx`, `src/pages/PublicSite.jsx`, `src/pages/PublicChrome.jsx`, `src/public-route.js`.
- Tests/QA: `tests/m1-registration-verification.test.js`, `tests/public-auth-site.test.js`, `tests/public-locations.test.js`, `scripts/public-auth-locations-qa.mjs`.
- Evidence: this document.

35. **Git status:** changes remain uncommitted on `feature/m1-auth-premium-registration-ux`; HEAD remains the required checkpoint. No commit or push.
36. **Limitations:** Chrome automation and visual inspection, not physical-device, Safari/Firefox or screen-reader certification. Browser auth mutation tests use isolated HTTP fixtures to avoid sending real emails or creating real accounts; real OTP/session rules are covered by the backend suite. Map visibility depends on external OpenStreetMap tiles; address information does not. Coordinates are verified public mapping records, not a clinic-survey measurement.

## Reproducible browser QA

`node scripts/public-auth-locations-qa.mjs` uses Playwright from a local installation (`PLAYWRIGHT_MODULE` may name its absolute module path). Set `QA_CDP_URL` to reuse a debugging Chrome, or install Playwright's Chromium for direct launch. `QA_BASE_URL` defaults to Vite on localhost:5173; `QA_OUTPUT` controls the artifact directory. It does not require backend mail delivery or any test-account credentials.

Development and production-preview passes: **165 checks passed each**, zero unexpected console/runtime errors (33 development / 30 initial production expected network errors from intentional fixtures; 39 in the final capture pass). Screenshots/results are outside the repository under `/tmp/clinic-refinement/browser/`. The earlier live-backend, read-only viewport pass and source-map verification captures are in `/tmp/clinic-refinement/`. Production-preview results are in `/tmp/clinic-refinement/production-browser/`; the final rerun against the latest build and corrected full-section screenshot capture also passes all 165 checks, with results and review images in `/tmp/clinic-refinement/final-browser/`.

The tests exercise the real rendered components and page transitions with fixture HTTP responses. They assert all five viewport matrices, country keyboard/typing and Escape focus, DOB errors, password toggles, masked destination, resend cooldown/retry, login/account/return transitions, map lazy-load isolation, numbered label geometry, inert map gestures, real section/contact destinations and both failure modes. Screenshot capture disables motion to avoid capturing a sticky header midway through smooth scrolling.

## Module/process-document boundary

M1's responsibilities, server authority, OTP/session limits and implementation status are unchanged; only its public entry presentation and form accessibility were refined. A status line may note “Focused responsive Login, Registration and Email Verification UI; existing server-backed authentication preserved.” Locations is public presentation data, not a new M2 capability. No other module status line requires a change; no `.docx` or shared contract was edited.

Verdict: **A — safe to review for checkpoint**, subject to the documented browser/provider limitations.
