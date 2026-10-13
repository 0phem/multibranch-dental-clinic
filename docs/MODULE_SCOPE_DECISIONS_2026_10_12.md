# October 12 Module Scope Decisions

Updated October 12, 2026. The user's final planning catalog has 25 primary modules, five assignments each, and no extra numbered security, monitoring, backup, intake or expense modules.

## Requirement provenance

- Original interview Q1-Q32 supplies existing digital forms/records, arrival-to-treatment/payment/next-booking flow, long queues, scheduling conflicts and centralized multi-branch use.
- The 20-answer follow-up supplies PI-01 Owner employee-account approval, PI-02 email invitations, PI-05 variable branch assignments, PI-06 Owner Dentist schedules, PI-08 no fixed Dentist minimum, PI-13 available Dentist arrival assignment, PI-14 shared hours, PI-15 Owner closures, PI-21 case-by-case lateness, PI-24/25 waiting/front-desk visibility, PI-29 booking updates, PI-31 appointment reminders, PI-38 handwritten/printed prescriptions and PI-42/43 Messenger/Owner external replies. These choices do not resolve the additional blank detail prompts.
- PI-30 was Other on the scan. The user previously explained Other as all listed channels. This supports the reported channel list, not official API integration or a delivery schedule.
- User confirmation October 12 at 19:14 Asia/Manila: external lab work is performed and tracked manually. This justifies M24 Lab Cases.
- User confirmation October 12 at 19:14 Asia/Manila: care handoffs between Dentists/branches are coordinated beyond appointment changes, informally by calls/messages. This justifies M25 Patient Handovers; external specialist referrals are not established by that answer.
- User leave rule confirmed October 12: Dentist/Staff requests show eligible overtime replacements; requester coordinates; exact substitute confirmation is required before leave proceeds. The agreed design automatically approves only after all required coverage and configured rules pass; no separate per-request Owner approval is inserted by default.
- Earlier verbal/project requests remain calendar views, factual live waitlists, attendance responses and Patient/Staff notifications, Owner analytics, audit search, archive/restore and name history.

## Scope decisions

M1 includes security and personnel reference data; M3 Work Schedules includes Staff/Dentist rosters. M15 Leave Management replaces the numbered Backup and Recovery proposal. Backups and service monitoring remain required production operations. M11 Billing Management and M23 Payment Management separate proposed responsibilities but preserve current combined financial safeguards. M16 inquiries and M17 private conversations stay separate. Documents have a full private file lifecycle; images, OCR and consent evidence are capabilities within the relevant owners. Feedback remains a supporting private Visit feature with historical M26 retained.

Dental Charts and Treatment Plans are adopted project modules whose exact clinical fields still need the clinic formats. A form, vendor reference or assigned module number is not proof of clinic approval of every field/permission.

HMO, inventory, general workflow automation, rewards and campaigns are outside new development. Unadopted standalone intake and expense proposals are not part of the catalog.

## Policy register treatment

Do not renumber or repurpose historical PI/DQ/TD module references. Append these facts as dated provenance and map them to final planning names. Do not mark compound questions answered because one multiple-choice answer was selected. DQ-72, DQ-113, TD-24 and TD-25 and other unresolved decisions retain their identifiers and status until actually resolved.
