# Frontend Rebuild Scope

The approved source of truth is **Module Documentation v1.1 + ERD v2**. The rebuild is staged so workflow/data correctness is locked before visual polish.

## P0 — implemented in this package
- canonical PERSON-based identity projection;
- account → Staff/Dentist/Patient profile synchronization;
- canonical service catalog + branch-service + dentist-service assignments;
- stronger Smart Scheduling validation;
- branch/role operational scoping;
- queue-context Dentist Treatment entry;
- patient demographics read-only for Dentist;
- treatment-driven invoice/follow-up/prescription handoffs;
- billing state foundation without normal manual bill recreation;
- state-driven HMO foundation; and
- cross-module workflow/event logging foundation.

## P1 — approved next UI/UX rebuild
- mobile-first Patient app shell;
- appointment stepper and Smart Schedule experience;
- simplified Check-In presentation;
- role-specific queue actions and emergency-priority UX;
- Dentist treatment completion UX;
- Owner/Admin People & Access consolidation;
- charts, trends, comparisons and operational drill-downs;
- Automation Monitor; and
- removal of professor-only module-coverage navigation from the clinic-facing shell.

## P2 — approved enhancements
- global Notification Center + email-channel architecture;
- administrative chatbot with staff handoff;
- report/PDF presentation layer;
- HMO analytics visualization;
- inquiry SLA/conversion polish; and
- profile/detail UX.

## Not production backend functionality
The frontend still simulates or omits:
- password hashing/authentication sessions;
- server-side RBAC;
- database transactions/locking;
- protected health-data production controls;
- secure document storage;
- PayMongo verification/webhooks;
- HMO provider integrations;
- email/SMS/social provider delivery;
- background jobs/timers;
- immutable server audit logs; and
- real-time multi-user synchronization.

These integrations should enforce the approved ERD/workflow rather than redefine it.
