# Open items for the clinic (decisions we need from you)

Each item says what is open, why it matters, and what we recommend. Nothing below is invented in the system: until you decide,
the system either asks the front desk to handle it or uses a clearly labelled demo value. Engineering follow-ups are in
[`docs/POST_DEFENSE_TASKS.md`](../POST_DEFENSE_TASKS.md).

| # | Open item | Why it matters | Our recommendation |
| --- | --- | --- | --- |
| 1 | ~~Same phone number for branches 1 and 2~~ **Closed (R2-14, 2026-10-19)** | Clinic staff confirmed both branches share 0922 878 7341. | Kept as is. |
| 2 | **Branch 3 address and email** | "Unit 20 GD Plaza, Guiguinto, Bulacan" has no street, barangay or ZIP code, and no email was given (the email line is hidden; the assistant says none is on file). | Send the full address and, if there is one, the branch email. |
| 3 | **Dentist schedules** (holidays now handled) | Closed and holiday dates are built (Administration → Closed dates; holidays are suggestions the Owner confirms, R2-13). The dentists' shifts are still project values (about 9:00 AM–7:00 PM). | **Owner only:** send each dentist's real weekly hours (PI-06). |
| 4 | **Assistant answers: Owner sign-off** | Clinic staff confirmed the 9 answers on 2026-10-19 (R2); the three care answers now give no advice and need dentist-approved wording (R2-11). | The Owner signs `ASSISTANT_ANSWERS_FOR_CLINIC.pdf`; a Dentist writes the care answers. |
| 5 | **Staff-initiated conversations** | Today only a patient can start a conversation. | Allow Staff to start one for an existing patient (appointment follow-up), logged in the audit trail. |
| 6 | **Staff email alerts** | Staff see new messages in the app only. | Email the branch inbox when a message waits more than a set time (you choose the time). |
| 7 | **Reopening closed conversations** | A closed conversation cannot be reopened (unresolved policy). | The patient's new message starts a new conversation that links to the old one. |
| 8 | **Retention and data privacy owner (RA 10173)** | R2-12: "up to you". See [`DATA_RETENTION_PROPOSAL.md`](DATA_RETENTION_PROPOSAL.md) (proposal, every period configurable). | **Owner only:** name the Data Protection Officer and approve or change the periods after legal review. |
| 9 | **Duplicate-phone registration message** | When a new account matches an existing patient record, the sign-up says "An existing patient record may already match these details. Please contact the clinic." | Keep the wording (it reveals nothing); confirm who at the front desk links the account. |
| 10 | **BIR invoicing, payments and PayMongo** | R2-13: "I don't know"; billing is still on paper (R2-01). Optional BIR fields exist per branch. | **Owner only:** ask the accountant which document is the official receipt; connect the clinic's own PayMongo account. |
| 11 | **Partial payments and refunds** | Online payment is for the full balance only; refunds are not online. | Keep partial payments and refunds at the front desk for now; decide later if they should be online. |
| 12 | **Additional Owner accounts** | There is one Owner account. | Decide who else may administer (for example a branch manager) and with which rights. |
| 13 | **Merchant name on payments** | In test mode the payment page shows the developers' PayMongo account. | Each clinic connects its own verified PayMongo account, so the patient sees the clinic's name (docs/WHITE_LABEL_CHECKLIST.md). |
| 14 | ~~Appointment reminders~~ **Answered (R2-09)** | Reminder 60 minutes before; the Owner approves the wording. Built: the reminder ships off until the Owner approves its wording in Administration → Automations. | **Owner only:** approve the wording of each automated email. |
| 15 | **AI mode for the assistant** | Today the assistant runs in knowledge mode (nothing leaves the clinic's system). AI mode needs a data-processing agreement (docs/ASSISTANT_PRIVACY.md). | Stay in knowledge mode until your DPO approves AI mode. |
| 16 | **Privacy Policy and Terms of Use** | The website has both pages as drafts written from how the portal works, marked "to be confirmed by the clinic". | Have the clinic and its DPO review and approve the text; then mark it final. |
| 17 | **Recording agreement to the Terms** | Sign-up requires ticking "I agree to the Privacy Policy and Terms of Use", but the server does not yet store which version was accepted and when. | After item 16, store the accepted version and time with the account. |
| 18 | ~~Assistant answer 3 wording~~ **Answered (R2-18)** | Now: "Wednesdays and Thursdays are usually less busy. Saturdays can fill up fast, so book early." | Owner sign-off with item 4. |
| 19 | **Branch 3 full address and email** | Still not given (R2-14). | Send the street, barangay and ZIP code, and the branch email if any. |
| 20 | **Late-arrival workflow (proposed, R2-10 "suggest a workflow")** | Built as settings: "Are you on your way?" at 5 minutes (recommended), Late and end of queue at 10 (R2-07), release at 15 (R2-10, automatic), rebook email (recommended). | **Owner:** approve or change the minutes and the automatic release. |
| 21 | **Cancellation policy (proposed, R2-13 "recommend a policy")** | Built as settings: cancel online anytime; under 24 hours (R2-13) is a late cancellation; 3 late cancellations or no-shows in 6 months (recommended) mean front-desk confirmation for new online bookings; no fees. | **Owner:** approve or change the numbers. |
| 22 | **Overdue reminders and daily summary details (R2-11 "up to us")** | Days 3, 7 and 14 and 8:30 PM are our recommendation. | **Owner:** approve or change. |
| 23 | **Verified HMO list (R2-16)** | The list came with web-citation markers; it is loaded **not verified** and hidden from patients. | **Owner only:** confirm each HMO with the clinic, then mark it verified in Administration → Accepted HMOs. |
| 24 | **Daily opening/closing and cash reporting** | Not answered (Owner not present). | **Owner only:** say who opens and closes each day and how cash is reported. |
| 25 | **ID scans and minors without an ID (R2-12)** | All valid IDs are accepted and the image may be deleted after staff verify it; the respondent asked about minors. | **Owner:** decide how a minor is identified (for example a parent's or guardian's ID). |
| 26 | **Recall intervals** | Suggested "General Dentistry every 6 months", off until a Dentist approves wording and intervals (R2-11). | **Dentist:** approve or change the intervals. |
