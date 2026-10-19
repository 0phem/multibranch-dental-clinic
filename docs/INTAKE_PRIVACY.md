# Registration intake: privacy notes (RA 10173)

How the counter registration, the ID scan and the parent/guardian profiles handle personal data. Interview basis: R2-03 (paper
form retyped by staff), R2-05 (about 15 minutes), R2-08 (separate branch databases), R2-12 (ID images may be deleted after staff
verify; minors without an ID). Retention periods are a proposal awaiting the Owner and DPO (`docs/defense/DATA_RETENTION_PROPOSAL.md`).

## What is collected at the counter, and why

| Field | Why | Required |
| --- | --- | --- |
| First and last name | Your patient record and receipts are yours | Yes |
| Date of birth | Tells patients apart; under 18 needs a parent or guardian | Yes |
| Sex | As on the clinic's paper form | No |
| Mobile number | The front desk reaches you about your visit | Yes |
| Email | Confirmations, and an online account later | No (many walk-ins do not verify an email on the spot) |
| Address | Your patient record | No |
| Emergency contact (name, mobile) | Who we call if something happens during your visit | Yes |
| Children or dependents (name, birth date, relationship) | A guardian registers and manages them | Only if added |

The form says why for each field, links to the Privacy Policy, and needs a consent tick (stored with its version and time on the
registration). A guardian consents for each dependent. Nothing else is asked; no clinical or medical history is collected here.

## The ID scan

- **Optional.** Registration never depends on it; a failed or skipped scan just means typing.
- **Consent first:** the patient is told what is read (name and birth date only), that it only fills the form, and that the photo
  is not kept.
- **On the device:** the photo is read in the patient's browser (PhilID QR with jsQR; otherwise on-device OCR with Tesseract.js,
  whose files are served by the clinic site, not a third-party CDN). The pixels are cleared right after reading.
- **Never uploaded, never stored:** no ID image and no ID number is sent to the server. The server refuses an ID number or image
  field even if a page sent one by mistake. A test registers after a scan and searches every database table, the application
  log and the email outbox for the ID number and image data: nothing is found (`backend/tests/Feature/Intake/IntakeTest.php`).
- **What is stored:** which ID type was scanned and which form fields came from it (to show staff), until staff confirm the
  registration; then only on the patient record: ID type, "verified in person by [staff] on [date]". The last 4 characters are
  kept only if the Owner turns that on (off by default).
- **ID upload for remote pre-verification** is not available in this release (the setting is shown as off and cannot be turned
  on). If it is built later it must be encrypted in private storage, never emailed or logged, and deleted at verification or
  after 7 days (setting).

## Pending registrations

A counter registration is stored encrypted until the front desk confirms it. On confirmation (or cancellation, or expiry at the
end of the clinic day) the form data is removed from the registration row: it now lives only in the patient record.

## Duplicates across branches (R2-08)

Before creating a patient, staff see possible existing records from any branch (same name and birth date, plus the same phone
or email) with "Record found from Branch X" and choose "Use this record" or create a new one. Nothing is merged automatically.
The public page never shows whether a record exists.

## Minors and guardians (R2-12)

- Under 18 (computed in Asia/Manila) cannot self-register; a parent or guardian registers them as a dependent.
- A dependent needs no ID or email; the guardian's ID is the one checked in person.
- The guardian books, receives reminders, gets invoices and pays for the dependent; consent is recorded per dependent.
- At 18 the guardian or the clinic can invite the dependent to claim their own account (email code). When they activate it,
  every guardian link ends and the guardian loses access (audited). History stays with the patient.
- Staff can link an existing child record to a guardian (audited).

## Open questions for the Owner and DPO

How long pending and confirmed intake data, consent records and ID-check records are kept; whether to keep the last 4 ID
characters; whether a guardian's access should end automatically at 18 even without a claim.
