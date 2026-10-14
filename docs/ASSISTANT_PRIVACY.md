# Clinic Assistant: privacy and data sent to Anthropic

Status: **open item for the clinic** (data privacy decision). This describes what the system does today; it is not legal advice.

## Two modes (`ASSISTANT_MODE` in backend/.env)

| Mode | When | Where the answer comes from | Does any patient text leave the system? |
| --- | --- | --- | --- |
| **Knowledge** (current decision) | `ASSISTANT_MODE=knowledge`, or `auto` with no key, or whenever the AI fails | The clinic's own editable answers (Administration → Assistant answers) and live clinic records, matched on the clinic server | **No.** Nothing a patient types is sent anywhere. |
| AI (optional, later) | `ASSISTANT_MODE=ai` or `auto`, with `ANTHROPIC_API_KEY` set | Anthropic's Claude API, called **from the clinic server only** (the key never reaches the browser), grounded in the same answers and records | Yes: see below. |

The portal shows a line under the chat. In knowledge mode: "Automated assistant. For anything not covered, talk to the front
desk." In AI mode: "AI-generated answers can be wrong. Not medical advice."

In both modes, emergency, medical-advice, off-topic and data-extraction messages get a fixed answer from the server first, with
no AI call. The assistant never books, cancels or pays: it shows buttons only.

## What is sent to Anthropic in AI mode

With each question the server sends:

- **Instructions:** the clinic name, today's date and the clinic phone number.
- **The chat:** the patient's message and up to 6 earlier messages of the same chat. This is free text the patient typed: it may contain anything the patient chooses to write, including health information.
- **Tool results the model asks for:**
  - the clinic's services (name, category, description, duration; no prices);
  - its branches (name, address, hours, appointment days) and the clinic's contact phone and email;
  - the clinic's own written answers that match the question (`search_clinic_answers`);
  - open appointment times;
  - **the signed-in patient's own** appointments (service, branch, dentist, date and time, status);
  - **the signed-in patient's own** invoices (number, status, amounts, issue date).

What is **not** sent:

- the patient's name, email, phone, birth date or address (unless they type it themselves);
- any other patient's data;
- passwords, keys or internal identifiers.

The tools take no patient identifier: they always read the signed-in account, so the model cannot fetch anyone else's records.

## What is stored

- The clinic server stores **no question and no answer**. `assistant_usage` keeps one row per question: the user, the date, the mode (AI or knowledge), the outcome category, which kind of answer was used (for example `knowledge:my_balance`), the tool names, token counts and response time. This is used for the daily cap and for monitoring.
- The clinic's answers (`assistant_answers`) are clinic information, not patient data. Every change by the Owner is in the audit trail (field names only).
- Anthropic's handling of API inputs and outputs, including retention, is governed by the clinic's agreement and Anthropic's API terms. The clinic should confirm the current retention and training terms for its account before go-live.

## RA 10173 (Data Privacy Act of 2012): items for the clinic to decide

1. **Lawful basis and notice.** Patients' own appointment and billing data, and anything they type, goes to a third-party processor abroad. The clinic's privacy notice should say so, and the portal should explain it before first use (a short notice is shown under the chat today).
2. **Sensitive personal information.** Health-related information is sensitive personal information under RA 10173. Decide whether patients should be asked not to type health details, or whether AI mode should be limited to non-personal questions.
3. **Processing agreement.** Put a data processing agreement in place with the provider, covering cross-border transfer, retention and security.
4. **Data Protection Officer.** The clinic's DPO should review this flow and record it in the clinic's processing inventory.
5. **Opt-out.** Knowledge mode works without sending anything out; the clinic may choose to run without a key.

Until these are decided, the setting for live patients is knowledge mode (`ASSISTANT_MODE=knowledge`): nothing a patient types leaves the clinic's system. This is the current decision (2026-10-14).
