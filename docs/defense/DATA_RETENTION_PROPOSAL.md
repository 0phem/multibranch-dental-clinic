# Data retention and privacy: proposal

> **Proposal only. It needs the Owner's and the Data Protection Officer's approval and a legal review before anything is
> built.** The clinic staff answered "up to you" (interview R2-12, 2026-10-19), and the Owner has not decided. Nothing below is
> implemented as a deletion rule today: the system currently keeps records and refuses deletes (see `MODULES_FINAL.md`, "Data
> retention").

## Basis

The Data Privacy Act of 2012 (RA 10173) asks that personal data be collected for a declared purpose, kept accurate, and kept
only as long as needed for that purpose (or as another law requires), then disposed of securely. It also asks for a named Data
Protection Officer (DPO). We make no other legal claim here; how long dental, tax and payment records must be kept is for the
clinic's lawyer and accountant to confirm.

## Proposed periods (every one an Owner setting)

| Data | Where in the system | Proposed period | Why | After the period |
| --- | --- | --- | --- | --- |
| Dental records (visits, treatments, charts) | M11, M13 | **To be set by the DPO and legal review** (no number proposed) | Clinical records may have their own legal minimum | Archive, then dispose securely |
| Invoices, receipts, payments, and archives | M21, M23 | **To be set with the accountant** (BIR) | Tax records have their own rules (R2-13: Owner to answer) | Archive, then dispose |
| ID scan prefill at registration (on-device OCR) | M1, M8 | **Delete as soon as Staff verify the ID**; keep only "verified by, on" | R2-12: on-device prefill only, zero raw ID storage | Immediate on-device discard |
| Patient messages | M18 | Same as dental records (proposal) | Messages can contain care context | Archive with the record |
| Assistant usage log (no message text) | M17 | 12 months (proposal) | Only to improve answers and spot misuse | Delete |
| Email delivery log (no message body) | M19 | 24 months (proposal) | Proves an email was sent | Delete |
| Audit trail | M25 | Same as the longest record it covers (proposal) | Accountability | Archive |
| Patient answers to email links, freed-time offers, waitlist | M6, M7, M10 | 24 months (proposal) | Operations and the Owner's counts | Delete |
| HMO provider and member number on the profile | M11 | Until the patient removes it or the account is closed | Information for the front desk only | Delete |
| Closed accounts | M1 | Soft delete now; personal data removed after the dental-record period (proposal) | Records must still be traceable | Anonymise |

## Open questions for the Owner and DPO

1. Who is the clinic's Data Protection Officer?
2. Which periods above do you approve, change or need a lawyer to confirm?
3. How is a minor identified at registration when they have no ID (R2-12)? We suggest a parent's or guardian's ID.
4. Who handles a patient's request to see, correct or delete their data, and in how many days?

## What we would build after approval

A retention setting per row above (Owner page, audited), a nightly job that archives or deletes only what is past its period
and only where the database allows it, and a report of what was disposed of (counts, no personal data). Until then, nothing is
deleted automatically.
