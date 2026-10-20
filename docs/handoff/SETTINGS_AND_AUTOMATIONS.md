# Settings & Automations: Multi-Branch Dental Clinic System

Authoritative catalog of clinic configurations, default parameters, and the 6 automated scheduled workflows.

---

## 1. Owner-Configurable Settings Catalog

| Category | Setting Key | Default Value | Origin | Who May Modify |
| --- | --- | --- | --- | --- |
| **Branding** | `clinic_name` | Dr. Dana E. Roxas Dental Clinic | Clinic Official | Owner Only |
| **Branding** | `clinic_support_email` | danaroxas.dentalclinic@gmail.com | Clinic Confirmed | Owner Only |
| **Branding** | `clinic_support_phone` | 0922 878 7341 | Clinic Confirmed | Owner Only |
| **Scheduling** | `appointment_reminder_minutes` | `60` | Clinic Interview (R2-09) | Owner Only |
| **Scheduling** | `late_threshold_minutes` | `10` | Clinic Interview (R2-07) | Owner Only |
| **Scheduling** | `auto_release_minutes` | `15` | Clinic Interview (R2-10) | Owner Only |
| **Scheduling** | `cancellation_window_hours` | `24` | Clinic Interview (R2-13) | Owner Only |
| **Scheduling** | `late_cancellation_limit` | `3` (in 6 months) | Recommended (Engineering) | Owner Only |
| **Scheduling** | `booking_hold_minutes` | `15` | Recommended (Engineering) | Owner Only |
| **Clinical** | `tooth_numbering_system` | `FDI` (11-48) | Recommended (Engineering) | Owner / Dentist |
| **Intake** | `claim_link_expiration_hours`| `24` | Recommended (Engineering) | Owner Only |
| **Staffing** | `handover_access_days` | `60` | Recommended (Engineering) | Owner Only |
| **Billing** | `overdue_reminder_days` | `[3, 7, 14]` | Recommended (Engineering) | Owner Only |
| **Billing** | `statutory_discount_percent` | `20%` (Senior/PWD) | Philippine Law (RA 9994/10754) | Locked by Law |

---

## 2. Automations Catalog (A1 to A6)

All automations are managed in **Administration → Automations**.  
**Hard Safety Gate:** An automation cannot be turned on until the Owner approves the email template wording.

### Automation A1: Appointment Reminders
- **Trigger:** Scheduled cron checking upcoming confirmed appointments.
- **Timing:** 60 minutes prior to appointment start time (Asia/Manila).
- **Idempotency Key:** `automation:reminder:apt_{id}:60m` (guarantees exactly one delivery per appointment).
- **Email Template:** `appointment_reminder` (includes "I'll be there" and "I can't make it" single-use signed action links).
- **Default State:** Switched OFF until Owner approves template wording.

### Automation A2: Late Arrival & Slot Release Flow
- **Trigger:** Chronological check of checked-in status after scheduled appointment start.
- **Timing:**
  - **T+5 min:** Sends *"Are you on your way?"* notification email.
  - **T+10 min:** Moves patient to end of queue upon check-in.
  - **T+15 min:** Releases slot and sends rebooking invitation.
- **Idempotency Key:** `automation:late_release:apt_{id}`.
- **Email Template:** `late_arrival_checkin` and `slot_released_rebook`.
- **Default State:** Switched OFF until Owner approves template wording.

### Automation A3: Overdue Invoice Reminders
- **Trigger:** Nightly cron evaluating unpaid issued invoices.
- **Timing:** Day 3, Day 7, and Day 14 following invoice issuance.
- **Idempotency Key:** `automation:invoice_overdue:inv_{id}:day_{3|7|14}`.
- **Email Template:** `invoice_overdue_notice` (includes payment link and PDF attachment).
- **Default State:** Switched OFF until Owner approves template wording.

### Automation A4: Preventive Care Recall Reminders
- **Trigger:** Periodic evaluation of completed visits for recall intervals (e.g. 6-month cleaning).
- **Timing:** 180 days post-treatment.
- **Idempotency Key:** `automation:recall:patient_{id}:service_{code}`.
- **Email Template:** `preventive_recall_notice`.
- **Default State:** Switched OFF (requires clinical sign-off by dentists).

### Automation A5: Waitlist & Freed Slot Move-Up Offers
- **Trigger:** Event-driven upon appointment cancellation or late slot release.
- **Timing:** Immediate upon slot release.
- **Priority Cascade:**
  1. Patients booked later on the same day (first to accept wins).
  2. Active waitlist entries for that branch and date.
- **Idempotency Key:** `automation:freed_offer:slot_{id}:offer_{patient_id}`.
- **Email Template:** `freed_slot_moveup_offer`.
- **Default State:** Switched OFF until Owner approves template wording.

### Automation A6: Owner Daily Executive Summary
- **Trigger:** Nightly scheduler at **8:30 PM (Asia/Manila)**.
- **Audience:** Clinic Owner only (`owner@example.test`).
- **Content:** Aggregated operational metrics:
  - Completed appointments per branch.
  - Walk-in vs booked counts.
  - Late arrivals, cancellations, and released slots.
  - Gross revenue issued and paid (centavos).
  - **Privacy:** Aggregate counts and metrics only; zero patient names or clinical details.
- **Idempotency Key:** `automation:owner_daily_summary:{date}`.
- **Default State:** Switched OFF until Owner approves template wording.
