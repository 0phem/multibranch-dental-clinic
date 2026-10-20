# Frontend Architecture & Role Map

> **Framework:** React 19.1 + Vite 7.1  
> **Styling:** Design A (Mint & Light Blue, Navy primary `#1865ac`, Accent `#0c9b8e`, clean borders, AA contrast)  
> **Mobile Target:** 390px (Mobile-First responsive up to 1440px desktop)  
> **Hash-Based Routing & Session Persistence:** URL hash navigation with stateful reload resilience (`#p/<page>`)

---

## 1. Role Experience Map

| Role | Primary Shell | Navigation Items | Accessible Pages |
| --- | --- | --- | --- |
| **Public / Guest** | Landing Page (`src/pages/PublicLanding.jsx`) | Branches, Services, Book, Log In, Sign Up | `home`, `services`, `branches`, `login`, `register`, `forgot-password`, `claim`, `intake-qr` |
| **Patient** | Patient Portal (`src/pages/Portal.jsx`) | Home, Book, My Visits, Menu (Messages, Family, Documents, Feedback, Me) | `patient-home`, `book`, `my-visits`, `messages`, `family`, `documents`, `feedback`, `me`, `teeth` |
| **Staff (Front Desk)** | Operations Shell (`src/layout.jsx`) | Check-In, Calendar, Queue, Visits, Invoices, Messages, Intake, Follow-Ups | `check-in`, `day-calendar`, `live-queue`, `visits`, `invoices`, `messages`, `intake-counter`, `followups`, `handovers` |
| **Dentist** | Clinical Shell (`src/layout.jsx`) | My Queue, Treatments, Dental Charts, Prescriptions, My Schedule, Leave | `dentist-queue`, `clinical-encounter`, `dental-chart`, `prescriptions`, `my-schedule`, `leave-requests`, `handovers` |
| **Owner / Admin** | Executive Shell (`src/layout.jsx`) | Overview, Branches, Schedules, Automations, Pricing, Branding, Audit, Assistant | `executive-overview`, `branches-admin`, `work-schedules`, `automations`, `pricing-admin`, `branding`, `audit-logs`, `assistant-admin` |

---

## 2. Page & API Interaction Catalog

### Public & Authentication
- **Landing Page (`PublicLanding.jsx`)**:
  - API: `GET /api/public/branches` (dynamic hours, phone, coordinates, closures).
  - State: Client-side distance ranking if user permits browser geolocation (coordinates never saved).
- **Registration (`PatientRegister.jsx`)**:
  - API: `POST /api/register` → `POST /api/register/verify-otp` → `POST /api/register/resend-otp`.
  - Feature: On-device PhilID QR scan or OCR photo prefill. No photo uploaded; name and DOB prefilled only.
- **Account Claim (`AccountClaim.jsx`)**:
  - API: `POST /api/account/claim/verify`.
  - Feature: Hardened 2-step verification for in-person counter records or minors turning 18.

### Patient Portal
- **Patient Home (`PatientHome.jsx`)**:
  - API: `GET /api/me`, `GET /api/appointments`, `GET /api/conversations`.
  - Content: Hero appointment card, actionable attention notices (issued invoices, overdue follow-ups, pending check-ins).
- **Booking Flow (`Book.jsx`)**:
  - API: `GET /api/services`, `GET /api/branches`, `GET /api/appointments/available-slots`, `POST /api/appointments`.
  - Logic: 1-flow stepped booking (Service → Branch → Dentist/Any Available → Date/Time → Review → Confirm).
- **Patient My Teeth (`Teeth.jsx`)**:
  - API: `GET /api/dental-charts/{patientId}`.
  - View: Simplified interactive read-only SVG tooth chart with healthy vs treated condition legend.
- **Messaging (`ServerMessages.jsx`)**:
  - API: `GET /api/conversations`, `POST /api/conversations/{id}/messages`.
  - Realtime: Laravel Echo listening on `private-conversation.{id}` with fallback polling (15s interval).

### Clinical & Front Desk
- **Check-In & Counter Registration (`CheckIn.jsx` & `CounterIntake.jsx`)**:
  - API: `GET /api/intake/counter-pending/{branch}`, `POST /api/intake/counter-confirm/{id}`, `POST /api/visits/check-in`, `POST /api/visits/walk-in`.
  - Behavior: Generates daily branch code; prints counter QR poster; admits walk-ins with service selection.
- **Dental Charting (`DentalChart.jsx`)**:
  - API: `GET /api/dental-charts/{patientId}`, `POST /api/dental-charts/{patientId}`.
  - Interaction: SVG dental arch (FDI default or Universal), tooth surface selection (M, O, D, B, L), status tagging, append-only history sheet.
- **Prescriptions (`ServerPrescriptions.jsx`)**:
  - API: `GET /api/prescriptions`, `POST /api/prescriptions`, `POST /api/prescriptions/{id}/void`, `GET /api/prescriptions/{id}/pdf`.
  - Controls: Multi-line free-text prescription editor with allergy check reminder; instant A4 PDF download.
- **Follow-Up Tasks (`ServerFollowups.jsx`)**:
  - API: `GET /api/followups`, `POST /api/followups`, `POST /api/followups/{id}/close`.
  - Feature: One-click "Book follow-up" prefills booking flow with patient, branch, and suggested service.

### Administration & Owner
- **Automations Management (`Automations.jsx`)**:
  - API: `GET /api/automation-settings`, `PUT /api/automation-settings/{key}`, `GET /api/message-templates`, `POST /api/message-templates/{key}/approve`.
  - Strict Rule: Automations (A1–A6) cannot be enabled without approved wording templates.
- **Work Schedules & Leave (`Staffing.jsx`)**:
  - API: `GET /api/work-schedules`, `PUT /api/work-schedules/{dentist}/weekly`, `GET /api/leave-requests`, `POST /api/leave-requests/{id}/approve`.
  - Behavior: Calculates dentist working slots ∩ branch operating hours − approved leave.
- **Audit Logs (`AuditTrail.jsx`)**:
  - API: `GET /api/audit-logs`, `GET /api/audit-logs/export`.
  - UI: Searchable table with CSV export; formula injection protection (`=`, `+`, `-`, `@` sanitized).

---

## 3. Client State & Storage Strategy

- **`src/store.jsx`**: Shared global state provider handling session credentials, toast alerts, and reactive caching.
- **`localStorage` Namespacing**: Uses key prefix `dentalops-v4-` for offline session caching and temporary drafts.
- **Network Resilience**:
  - Automatic CSRF cookie bootstrap via `GET /sanctum/csrf-cookie` prior to state-changing verbs (`POST`, `PUT`, `DELETE`).
  - Graceful fallback from WebSocket disconnections to HTTP polling.
