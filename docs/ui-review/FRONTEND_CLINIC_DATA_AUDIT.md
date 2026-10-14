# Frontend clinic-data audit (2026-10-15)

Rule: the frontend hard-codes no clinic facts (services, prices, branch details, hours, FAQs). Everything comes from the API.
The only allowed fallback is the clinic name and contact in `src/clinic-config.js` (shown when the server cannot be reached).

| Where | What was hard-coded | Now |
| --- | --- | --- |
| `src/clinic-config.js` → `clinic.branches` | The 3 branch names, addresses and map pins for the public website | **Removed.** The website loads them from `GET /api/public/branches` (`loadPublicBranches`). If the API is down it shows the clinic phone and email instead of a list. |
| `src/pages/PublicLocations.jsx` | "three clinic locations in Bocaue and Guiguinto", "Three locations · Bulacan" | Counts and places are derived from the loaded branches. |
| Patient portal (`src/patient/`) | — (built server-only) | Services, branches, hours, calendar, slots, appointments, invoices, notifications and the assistant all come from the API. Tested: `tests/patient-portal.test.js` bans `data.js`, `patient-view.js` and `store.state` there. |
| Clinic Assistant | — | Answers only on the server: the clinic's editable answers (`assistant_answers`) and live records. The frontend holds no FAQ text; the starter questions come from `GET /api/assistant`. |
| Owner, Staff and Dentist screens | Branches, services, dentists and staff | Loaded from the API at sign-in (`store.jsx` reference data, `fetchReferenceData`); prices come from M13 (`/api/service-prices`). |

## Still in the frontend (not shown to signed-in users as clinic facts)

- `src/data.js` is the legacy **local-mode seed** (`INITIAL_*`): it renders the offline demo, the render smoke test and many unit
  tests. With a clinic-server session, branches, services, dentists and staff are replaced by the API data before any screen
  renders. Its branch names now match the real ones (no "Branch A/B/C"). Removing it means rewriting the legacy local-state
  tests: listed as post-defense work.
- `src/contracts.js` uses `INITIAL_BRANCHES` only as a fallback to map an old record's branch *name* to its id (legacy records).
- `src/pages/Clinical.jsx` pre-selects "Dr. Dana Roxas Dental Clinic" as the preferred branch in the legacy local "new patient"
  form (local mode only; the server form uses the API branches).
- Labels and formatters (₱ formatting, weekday names, "Confirmed price (₱)" field labels) are not clinic facts.
