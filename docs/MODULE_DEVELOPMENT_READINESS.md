# Module Development Readiness

Updated October 12, 2026. Version 5.0. Finalized planning scope.

The agreed planning catalog contains 25 numbered modules, with five primary assignments per member. Scope and assignments are finalized for documentation. Implementation evidence and clinic-specific policy remain separate; this revision does not certify a working production system.

Roles are exactly Patient, Staff, Dentist and Owner. The stack remains React/Vite, Laravel 13, PostgreSQL and Sanctum. New development excludes HMO, inventory, a generic workflow-automation engine, rewards and marketing campaigns. PayMongo belongs to M23 Payment Management; email delivery to M18; informational AI to M7.

## Documentation status

The 25 names, module ownership, primary assignments, IPO boundaries and requested automation are finalized in this revision. All modules are dated October 12, 2026. This is a scope baseline; policy/configuration questions below are still open and must not be replaced by assumed defaults.

## Facts to settle before affected write workflows

- Actual branch days/hours and effects of closures or schedule changes on bookings.
- Actual Staff/Dentist shifts, branch and duty/service eligibility, and leave work-hour/rest limits.
- Leave types, coverage deadlines, multi-shift/partial coverage, withdrawal/cancellation, lost-coverage handling, private reason visibility and affected-booking rules. Owner-approved standing rules authorize automation; substitute consent never substitutes for missing policy.
- Actual dental-chart, treatment-plan, prescription and consent fields; clinical reviewer and amendment authority.
- Lab identities/case types, instruction fields, dispatch/receipt evidence, expected dates, Dentist acceptance/rework and fee handling.
- Handover initiator/recipient rights, minimal care packet, acknowledgment/acceptance, responsibility transition and decline/nonresponse/closure handling.
- Approved prices, adjustments, payment methods and incomplete payer-field handling. Refunds/partial payments stay unavailable unless already supported by reviewed policy.
- Messaging creation/routing and external inquiry permissions, especially current Owner restrictions.
- Notification channels, timing, templates, recipients, retry limits and actual delivery diagnostics.
- Entity-specific correction, archive/restore, retention and export authority. No universal hard delete or Owner access.
- Owner metric definitions including DQ-113 revenue date basis; no invented wait estimates or staffing thresholds.

## Engineering verification

Re-run only relevant checks in the actual checkout when a scoped implementation starts. Historical reported tests and browser fixtures do not prove current live integration. Verify PayMongo test-mode checkout/callback/reconciliation, actual recipient email receipt, constrained AI provider behavior, real Patient/Staff/Dentist/Owner flows, concurrent coverage acceptance/schedule publication and restore drills before production claims. TD-24 durable workers and TD-25 honest transport diagnostics remain open. Backup/recovery and service monitoring are deployment responsibilities even though not counted as numbered clinic modules.

## Recommended sequence

1. Reconcile local source and this planning catalog; resolve the identity transition map and policy register without modifying app code.
2. Complete M1 employee provisioning with the required M18 delivery foundation, then M2 calendars and M3 dated Staff/Dentist schedules using approved facts.
3. Complete M6 appointments/calendar/attendance, M8 Visits, M9 live queues and M18 notification delivery.
4. Build M15 leave/coverage only after its policy is configured; integrate roster and affected-booking handling without a generic rule engine.
5. Verify the existing financial foundation before separating M11 billing and M23 payments; complete PayMongo/receipt E2E.
6. Complete approved clinical fields and M10/M12/M19/M20; implement confirmed M24 lab and M25 handover workflows after their exact permissions/states are specified.
7. Finish M14/M16/M17/M7 integration and M21/M22 usability with authoritative records and approved access.

Keep all existing PI/DQ/TD identifiers and original Q1-Q32 answers. Module-specific fields above are open questions, not new numbered decisions. The word finalized refers to the catalog and documentation, not a production-launch certificate.
