# Open items for the clinic (decisions we need from you)

Each item says what is open, why it matters, and what we recommend. Nothing below is invented in the system: until you decide,
the system either asks the front desk to handle it or uses a clearly labelled demo value. Engineering follow-ups are in
[`docs/POST_DEFENSE_TASKS.md`](../POST_DEFENSE_TASKS.md).

| # | Open item | Why it matters | Our recommendation |
| --- | --- | --- | --- |
| 1 | **Same phone number for branches 1 and 2** | The clinic gave 0922 878 7341 for both Dr. Dana Roxas Dental Clinic and Roxas - Cardinal Dental Center. It is kept as given. | Confirm it is really shared and not a copy-paste; if Cardinal has its own number, the Owner changes it in Administration → Branches. |
| 2 | **Branch 3 address and email** | "Unit 20 GD Plaza, Guiguinto, Bulacan" has no street, barangay or ZIP code, and no email was given (the email line is hidden; the assistant says none is on file). | Send the full address and, if there is one, the branch email. |
| 3 | **Holidays and dentist schedules** | Hours are now real (Mon–Fri 8:00 AM–8:00 PM, Sat 8:00 AM–5:00 PM, Sun closed). There is no holiday calendar (PI-15), and the dentists' shifts in the system are still project values (about 9:00 AM–7:00 PM), so online times start later and end earlier than the branch hours. | Send each dentist's working days and hours (PI-06); for holidays, message patients through the front desk until a closure calendar is built. |
| 4 | **Assistant answers to confirm** | 9 draft answers were written from the interview and the portal's behaviour (Administration → Assistant answers). Patients see them already. | Read each one, correct it, press Confirm. Add the questions patients ask on Messenger most often. |
| 5 | **Staff-initiated conversations** | Today only a patient can start a conversation. | Allow Staff to start one for an existing patient (appointment follow-up), logged in the audit trail. |
| 6 | **Staff email alerts** | Staff see new messages in the app only. | Email the branch inbox when a message waits more than a set time (you choose the time). |
| 7 | **Reopening closed conversations** | A closed conversation cannot be reopened (unresolved policy). | The patient's new message starts a new conversation that links to the old one. |
| 8 | **Message retention (RA 10173)** | How long messages, assistant usage logs and documents are kept is not decided. | Keep messages for the same period as dental records; delete assistant usage logs after 12 months; your Data Protection Officer confirms. |
| 9 | **Duplicate-phone registration message** | When a new account matches an existing patient record, the sign-up says "An existing patient record may already match these details. Please contact the clinic." | Keep the wording (it reveals nothing); confirm who at the front desk links the account. |
| 10 | **BIR invoicing requirements** | Invoices and receipts are not yet confirmed against BIR rules (registered name, TIN, serial numbers, ATP). Optional BIR fields exist per branch. | Ask your accountant which document is the official receipt and what must be printed; until then label system receipts as acknowledgment receipts. |
| 11 | **Partial payments and refunds** | Online payment is for the full balance only; refunds are not online. | Keep partial payments and refunds at the front desk for now; decide later if they should be online. |
| 12 | **Additional Owner accounts** | There is one Owner account. | Decide who else may administer (for example a branch manager) and with which rights. |
| 13 | **Merchant name on payments** | In test mode the payment page shows the developers' PayMongo account. | Each clinic connects its own verified PayMongo account, so the patient sees the clinic's name (docs/WHITE_LABEL_CHECKLIST.md). |
| 14 | **Appointment reminders** | PI-31: the clinic reminds patients for every appointment. The system sends confirmation and change emails, not reminders. | Decide how far ahead (for example the day before) and by which channel; we then automate it. |
| 15 | **AI mode for the assistant** | Today the assistant runs in knowledge mode (nothing leaves the clinic's system). AI mode needs a data-processing agreement (docs/ASSISTANT_PRIVACY.md). | Stay in knowledge mode until your DPO approves AI mode. |
| 16 | **Privacy Policy and Terms of Use** | The website has both pages as drafts written from how the portal works, marked "to be confirmed by the clinic". | Have the clinic and its DPO review and approve the text; then mark it final. |
| 17 | **Recording agreement to the Terms** | Sign-up requires ticking "I agree to the Privacy Policy and Terms of Use", but the server does not yet store which version was accepted and when. | After item 16, store the accepted version and time with the account. |
| 18 | **Assistant answer 3 wording** | "Weekends are usually busier…" while Sunday is closed. | Confirm a safer wording, for example: "Saturdays are usually busier, especially from October to February." |

