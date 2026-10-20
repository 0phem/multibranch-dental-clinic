# API Route Catalog: Multi-Branch Dental Clinic System

All routes are prefixed with `/api` unless otherwise noted.
Authentication is handled via **Laravel Sanctum cookie session** (`auth:sanctum`).
Route access is guarded by `role:<role1>,<role2>` middleware and `EnsureAccountAccess`.

---

## 1. Authentication, Identity & Accounts (M1)

| Method | Path | Middleware | Description | Rate Limit |
| --- | --- | --- | --- | --- |
| `POST` | `/api/register` | `guest` | Patient self-registration with OTP | 5/hr per email+IP |
| `POST` | `/api/register/verify-otp` | `guest` | Verify 6-digit registration OTP | 5 tries max |
| `POST` | `/api/register/resend-otp` | `guest` | Resend registration verification OTP | 60s cooldown |
| `POST` | `/api/login` | `guest` | Session-cookie authentication | Standard |
| `POST` | `/api/logout` | `auth:sanctum` | Invalidate authenticated session | — |
| `GET` | `/api/me` | `auth:sanctum` | Get current user profile, role, patient code | — |
| `POST` | `/api/password/forgot` | `guest` | Request password reset OTP | 5/hr per email+IP |
| `POST` | `/api/password/reset` | `guest` | Reset password using verified code | — |
| `POST` | `/api/email/request-change` | `auth:sanctum` | Request email change code | Password required |
| `POST` | `/api/email/confirm-change` | `auth:sanctum` | Verify new email with OTP | Old email alerted |
| `POST` | `/api/invitations` | `auth:sanctum, role:owner` | Owner invites new staff/dentist | 72h expiration |
| `POST` | `/api/account/claim/verify` | `guest` | Claim existing patient record with code | Enumeration-safe |
| `POST` | `/api/account/claim/link` | `auth:sanctum, role:staff` | Generate 24h staff one-time claim link | Audited |

---

## 2. Branches & Operational Hours (M2)

| Method | Path | Middleware | Description | Rate Limit |
| --- | --- | --- | --- | --- |
| `GET` | `/api/public/branches` | `public` | Public list of branches, coordinates, hours | — |
| `GET` | `/api/branches` | `auth:sanctum` | Detailed branch list with internal scopes | — |
| `PUT` | `/api/branches/{id}` | `auth:sanctum, role:owner` | Update branch contact, address, BIR details | — |
| `GET` | `/api/branches/{id}/closures` | `auth:sanctum` | List branch scheduled closure/holiday dates | — |
| `POST` | `/api/branches/{id}/closures` | `auth:sanctum, role:owner` | Schedule closure; trigger reschedule alerts | Audited |
| `DELETE` | `/api/branches/{id}/closures/{closure}` | `auth:sanctum, role:owner` | Cancel closure date | Audited |

---

## 3. Work Schedules, Leave & Handovers (M3, M15, M25)

| Method | Path | Middleware | Description | Rate Limit |
| --- | --- | --- | --- | --- |
| `GET` | `/api/work-schedules` | `auth:sanctum, role:staff,dentist,owner` | List weekly rosters per branch/dentist | — |
| `PUT` | `/api/work-schedules/{dentist}/weekly` | `auth:sanctum, role:staff,owner` | Set weekly schedule; notify affected visits | 60/min |
| `POST` | `/api/work-schedules/{dentist}/exceptions` | `auth:sanctum, role:staff,owner` | Add single-day shift override | 30/min |
| `GET` | `/api/leave-requests` | `auth:sanctum` | List leave requests (role-scoped) | — |
| `POST` | `/api/leave-requests` | `auth:sanctum, role:staff,dentist` | Submit leave request with encrypted note | — |
| `POST` | `/api/leave-requests/{id}/approve` | `auth:sanctum, role:owner` | Approve leave; prompt visit reschedules | Audited |
| `POST` | `/api/leave-requests/{id}/decline` | `auth:sanctum, role:owner` | Decline leave request | Audited |
| `GET` | `/api/handovers` | `auth:sanctum, role:staff,dentist` | List inter-branch patient handovers | — |
| `POST` | `/api/handovers` | `auth:sanctum, role:staff,dentist` | Create handover with 60-day bounded access | Audited |
| `POST` | `/api/handovers/{id}/acknowledge` | `auth:sanctum, role:staff,dentist` | Acknowledge handover and activate access | Audited |

---

## 4. Patient Intake & Counter Registration (M1, M4, M8)

| Method | Path | Middleware | Description | Rate Limit |
| --- | --- | --- | --- | --- |
| `GET` | `/api/intake/counter-code/{branch}` | `auth:sanctum, role:staff` | Retrieve today's daily 4-digit branch code | — |
| `POST` | `/api/intake/counter-register` | `guest` | Patient self-registration via QR counter poster | 10/min per IP |
| `GET` | `/api/intake/counter-pending/{branch}` | `auth:sanctum, role:staff` | Front desk list of pending counter intake | — |
| `POST` | `/api/intake/counter-confirm/{id}` | `auth:sanctum, role:staff` | Staff verify ID and admit patient to queue | Audited |

---

## 5. Appointments & Booking (M6)

| Method | Path | Middleware | Description | Rate Limit |
| --- | --- | --- | --- | --- |
| `GET` | `/api/appointments/available-slots` | `public / auth:sanctum` | Compute open slots (hours ∩ schedule − leave) | — |
| `POST` | `/api/appointments` | `auth:sanctum` | Book appointment with anti-overlap guard | 20/min |
| `GET` | `/api/appointments` | `auth:sanctum` | List appointments (role-scoped) | — |
| `GET` | `/api/appointments/{id}` | `auth:sanctum` | Detailed appointment card with treatment links | — |
| `POST` | `/api/appointments/{id}/reschedule` | `auth:sanctum` | Reschedule appointment to new date/time | Audited |
| `POST` | `/api/appointments/{id}/cancel` | `auth:sanctum` | Cancel booking; track late cancellation | Audited |
| `POST` | `/api/waitlist` | `auth:sanctum, role:patient` | Join waitlist for full booked day | 20/min |
| `GET` | `/api/waitlist/mine` | `auth:sanctum, role:patient` | Patient's active waitlist entries | — |

---

## 6. Visits & Queue Management (M8, M9)

| Method | Path | Middleware | Description | Rate Limit |
| --- | --- | --- | --- | --- |
| `GET` | `/api/visits` | `auth:sanctum, role:staff,dentist,owner` | Daily visit registry per branch | — |
| `POST` | `/api/visits/check-in` | `auth:sanctum, role:staff,owner` | Check in booked patient; generate queue # | — |
| `POST` | `/api/visits/walk-in` | `auth:sanctum, role:staff,owner` | Check in walk-in patient; assign dentist | — |
| `GET` | `/api/queue` | `auth:sanctum, role:staff,dentist,owner` | Live queue status per branch and dentist | — |
| `POST` | `/api/queue/{id}/call` | `auth:sanctum, role:dentist,staff` | Call next patient in queue | Broadcast |
| `POST` | `/api/queue/{id}/move-to-end` | `auth:sanctum, role:staff` | Late arrival (10+ min) reposition to end | Audited |

---

## 7. Treatments & Dental Charts (M5, M10)

| Method | Path | Middleware | Description | Rate Limit |
| --- | --- | --- | --- | --- |
| `POST` | `/api/visits/{visit}/treatment` | `auth:sanctum, role:dentist` | Start treatment for visit encounter | Attending dentist |
| `PUT` | `/api/treatments/{id}` | `auth:sanctum, role:dentist` | Update procedures, notes, draft status | — |
| `POST` | `/api/treatments/{id}/complete` | `auth:sanctum, role:dentist` | Finalize treatment; lock append-only | Irreversible |
| `GET` | `/api/dental-charts/{patientId}` | `auth:sanctum` | Get patient dental chart history & teeth states | Role-scoped |
| `POST` | `/api/dental-charts/{patientId}` | `auth:sanctum, role:dentist` | Append tooth observation (32 adult/20 primary) | Append-only DB |

---

## 8. Prescriptions & Follow-Ups (M19, M20)

| Method | Path | Middleware | Description | Rate Limit |
| --- | --- | --- | --- | --- |
| `POST` | `/api/prescriptions` | `auth:sanctum, role:dentist` | Issue prescription; sequential RX number | Gapless lock |
| `GET` | `/api/prescriptions` | `auth:sanctum` | List prescriptions (role-scoped) | — |
| `GET` | `/api/prescriptions/{id}/pdf` | `auth:sanctum` | Download A4 PDF prescription | — |
| `POST` | `/api/prescriptions/{id}/void` | `auth:sanctum, role:dentist` | Void prescription with required reason | Audited |
| `GET` | `/api/followups` | `auth:sanctum, role:staff,dentist,owner` | Follow-up worklist (Open/Contacted/Booked) | — |
| `POST` | `/api/followups` | `auth:sanctum, role:dentist,staff` | Create patient follow-up task | — |
| `POST` | `/api/followups/{id}/close` | `auth:sanctum, role:staff,dentist` | Close task with required explanation note | Audited |

---

## 9. Billing & Payment Gateway (M11, M23)

| Method | Path | Middleware | Description | Rate Limit |
| --- | --- | --- | --- | --- |
| `GET` | `/api/invoices` | `auth:sanctum` | List invoices (role-scoped) | — |
| `POST` | `/api/invoices` | `auth:sanctum, role:staff,owner` | Generate draft invoice from treatment lines | — |
| `POST` | `/api/invoices/{id}/issue` | `auth:sanctum, role:staff,owner` | Issue invoice; lock line items; email PDF | Immutable |
| `GET` | `/api/invoices/{id}/pdf` | `auth:sanctum` | Download invoice or payment receipt PDF | — |
| `POST` | `/api/payments/checkout-session` | `auth:sanctum` | Create PayMongo Checkout Session (centavos) | Idempotent |
| `POST` | `/api/webhooks/paymongo` | `guest` (Signature check) | Process PayMongo payment webhook | 5-min tolerance |

---

## 10. Real-Time Patient Messaging (M17)

| Method | Path | Middleware | Description | Rate Limit |
| --- | --- | --- | --- | --- |
| `GET` | `/api/conversations` | `auth:sanctum` | List conversations (Owner cannot view patient) | — |
| `POST` | `/api/conversations` | `auth:sanctum, role:patient` | Start conversation with branch front desk | 5/hr |
| `GET` | `/api/conversations/{id}/messages` | `auth:sanctum` | Get conversation thread messages | — |
| `POST` | `/api/conversations/{id}/messages` | `auth:sanctum` | Post message; encrypt body; broadcast WSS | 20/min |

---

## 11. Clinic Assistant (M7)

| Method | Path | Middleware | Description | Rate Limit |
| --- | --- | --- | --- | --- |
| `POST` | `/api/assistant/ask` | `auth:sanctum` | Ask Clinic Assistant question | 6/min, 40/day |
| `GET` | `/api/assistant/answers` | `auth:sanctum, role:owner` | Owner manage FAQ question-answer catalog | — |
| `PUT` | `/api/assistant/answers/{id}` | `auth:sanctum, role:owner` | Update FAQ answer wording | Audited |

---

## 12. Automations & Settings (M18)

| Method | Path | Middleware | Description | Rate Limit |
| --- | --- | --- | --- | --- |
| `GET` | `/api/automation-settings` | `auth:sanctum, role:owner` | View automations A1–A6 state and timings | — |
| `PUT` | `/api/automation-settings/{key}` | `auth:sanctum, role:owner` | Toggle automation or edit configuration | Requires approved wording |
| `GET` | `/api/message-templates` | `auth:sanctum, role:owner` | View message templates and approval status | — |
| `POST` | `/api/message-templates/{key}/approve` | `auth:sanctum, role:owner` | Approve wording; unlock automation activation | Audited |

---

## 13. Audit Trails & Reports (M21, M22)

| Method | Path | Middleware | Description | Rate Limit |
| --- | --- | --- | --- | --- |
| `GET` | `/api/audit-logs` | `auth:sanctum, role:owner` | Query append-only audit trail with filters | — |
| `GET` | `/api/audit-logs/export` | `auth:sanctum, role:owner` | Export audit trail as CSV (formula sanitized) | — |
| `GET` | `/api/analytics/executive` | `auth:sanctum, role:owner` | Executive metrics, clinic load, revenues | — |
| `GET` | `/api/analytics/workload` | `auth:sanctum, role:staff,owner` | Staff calendar workload counts | — |
