# DentalOps — Final Frontend UI Prototype

**Project:** Web-Based Multi-Branch Dental Clinic Operations and Automation System  
**Client:** Dr. Dana Roxas, Clinic Owner  
**Course:** Business Process Automation  
**Team:** Group 3 — BSIT 3B

This folder contains the **final frontend-only React prototype** for the documented 25-module system. It is intentionally designed to show the professor/client what the finished system would look and feel like **before backend, database, authentication server, external APIs, or infrastructure are added**.

## What is included

- Four main role experiences: **Patient, Staff, Dentist, Owner/Admin**
- Role-specific sidebars, dashboards, worklists, forms, tables, status badges, alerts, filters, modals, drill-downs and operational actions
- All **25 documented modules** represented in the UI
- Modules **24 and 25 always marked Proposed Enhancement (PE)**
- Production-oriented frontend workflows using browser demo data/localStorage
- Smart appointment validation: branch status/hours, service availability, dentist branch assignment, dentist shift, overlapping appointments and alternative slots
- Scheduled patient check-in and explicit walk-in registration
- Privacy-safe patient queue versus operational staff/dentist queue
- Dynamic wait/capacity views and cross-branch alternatives
- Role-aware centralized patient records
- Dentist treatment workflow, clinical notes, prescription authorization and follow-up task handoff
- Patient-only bills/receipts versus staff billing/payment controls
- HMO verification, eligibility, missing requirements, submission, timer follow-up, provider response recording and escalation
- Social inquiry tracking, conversion linkage, unified patient conversations, operational notifications and failed-delivery retry
- Executive dashboard, analytics/report export, branch/team configuration, user/permission UI and workflow automation control
- Optional referral/loyalty and marketing/reactivation PE screens
- Module coverage screen for professor defense

## Run on macOS / Windows / Linux

You need Node.js installed.

```bash
npm install
npm run dev
```

Then open the Vite URL shown in Terminal, normally:

```text
http://localhost:5173
```

On macOS you can also double-click `start.command`.

## Important scope

This is a **frontend prototype**, not a production deployment. The UI intentionally simulates production behavior, but it does **not** include:

- real password authentication or secure sessions
- backend RBAC enforcement
- database transactions
- PH health-data security implementation / production compliance controls
- encrypted file storage
- real payment posting
- HMO provider API connections
- SMS/email/social media provider integrations
- real-time websockets
- concurrency/locking
- server-generated audit logs
- automated backend jobs/timers

The frontend is structured so those services can replace the current local demo state later without redesigning the role experiences.

## Demo data

Names, dentists, appointments, invoices, HMO records, queue records and amounts are **illustrative prototype data**. They are not claims from the client interview unless explicitly present in the process documentation.

Use **Reset demo data** in the sidebar to restore the original prototype state.

See `MODULE_COVERAGE.md` and `PROFESSOR_DEMO_GUIDE.md` for the defense walkthrough.
