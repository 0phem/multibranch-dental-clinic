# Dress rehearsal (October 15, 2026, about 01:30–03:10, Philippine time)

Run on the demo database `dental_clinic_demo` through the real running stack (`scripts/demo-start.sh` with the ngrok tunnel,
queue worker, scheduler and Reverb). Browser steps were driven by Playwright in Chrome at phone size (patient) and desktop
size (Staff, Owner). PayMongo **test mode** only. The demo data was reset afterwards (`scripts/demo-reset.sh`).

## Timings

| Step (DEMO_SCRIPT.md) | Result | Time |
| --- | --- | --- |
| Pre-demo check (`predefense-check.sh`) | All PASS; one expected WARN (9 assistant drafts) | 20 s |
| 2 Register a new alias, to the code page | OK; the code email was handed to Gmail 8 s later | 6 s |
| 2 Sign in after verification → welcome Home | OK (verified earlier with the real code for `+new1` and `+new2`) | 3 s |
| 3 Book with location → success | OK; nearest branch recommended "Closest to you, earliest slot…" | 6 s |
| 3 Confirmation email | Handed to Gmail 3 s after booking | 3 s |
| 4 Assistant, two questions | OK ("Bukas ba kayo sa Linggo?", next appointment) | 2 s |
| 5 Staff sign-in; patient message; Staff reply | OK; the reply appeared on the patient's phone **1.5 s** after Send, without reloading | 11 s |
| 6 Bea → Billing → Review and pay → PayMongo | OK | 17 s |
| 6 GCash test payment → back in the portal | OK: E-Wallets → GCash → Continue → Pay → Authorize Test Payment | 25 s |
| 6 "Payment received" (verified webhook through the tunnel) | OK; invoice INV-2026-000006 marked Paid | 30 s after paying |
| 6 Payment Receipt email with PDF | Handed to Gmail 10 s after settlement | 10 s |
| 7 Owner: change the Primary colour, save | OK | 6 s |
| 7 Owner: edit, save and confirm the HMO answer; test it | OK | 3 s |
| 8 Owner: Audit Trail | OK; the assistant answer edits are listed | 4 s |

The clicking and waiting take about 2½ minutes in total; with speaking, the 14-minute plan has room.

## What failed, was slow or looked wrong, and what was done

| Finding | Fixed? |
| --- | --- |
| **"Review and pay" looked unstyled inside the new patient portal** (it reuses the old screen, whose styles only applied under the old shell) | **Fixed**: the reused screens (Review and pay, Messages, Feedback, Documents) are wrapped in the old patient style scope. Re-checked: styled correctly. |
| **Demo script claimed the brand colour changes the portal**; it changes emails and PDFs only | **Fixed** in DEMO_SCRIPT.md step 7: change the colour, then open Bea's Invoice PDF. |
| PayMongo flow needed exact clicks (methods are grouped under "E-Wallets") | **Fixed** in DEMO_SCRIPT.md step 6 with the verified clicks. The unverified card-number fallback was removed. |
| PayMongo page shows the developers' account name, not the clinic's | Not fixable in test mode: open item 13 (each clinic connects its own PayMongo account). Say it if asked. |
| Owner audit shows "Demo Demo Owner" while the Owner header shows "Dana Roxas" (old shell's local name) | Not fixed (old Owner/Staff shell, demo account names). After the defense: show the server's name in the header. |
| The first rehearsal pass reported the email checks and the payment as failed | Rehearsal-script errors (wrong column name; the Pay button's name starts with a lock icon), not system failures; re-run passed. |
| The running API is the old single-worker start (the 4-worker change needs a restart of `demo-start.sh`) | Restart `demo-start.sh` before the defense; then run `predefense-check.sh`. |

## Not rehearsed automatically

- Typing the email code for a brand-new alias (it arrives in your inbox): done by hand earlier with `+new1` and `+new2`; both
  verified and signed in correctly.
- Reading the emails in Gmail: only checked that each email was handed to Gmail (`mail_dispatches` status
  `transport_accepted`). Open them in Gmail during your own rehearsal.
- Fallbacks (screen recording, `/dev/mail`, Staff cash payment): available, not timed.
