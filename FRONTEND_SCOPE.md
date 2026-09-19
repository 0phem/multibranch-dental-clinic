# Frontend Prototype Scope

The screens are designed as the target production user experience, but browser demo state is not a substitute for production infrastructure.

## Accurate at UI/process level
- role separation and navigation
- module ownership boundaries
- field visibility and staff-vs-dentist clinical access concept
- booking/scheduling validation experience
- queue states and patient privacy
- capacity/exception presentation
- HMO provider-response recording model
- treatment → prescription/follow-up handoff
- management dashboard/analytics structure
- PE separation

## Deliberately simulated
- authentication
- secure authorization enforcement
- live dentist/branch availability
- database persistence and transactions
- wait-time prediction model
- real payment posting
- HMO API/provider responses
- SMS/email/social platform delivery
- background timers/jobs
- file/document storage
- real audit logging

The backend phase should connect these screens to authoritative server-side rules rather than replacing the frontend information architecture.
