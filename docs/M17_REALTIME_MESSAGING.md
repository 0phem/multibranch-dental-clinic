# M17 messaging: front-desk routing, realtime, encryption at rest, offline alert

Priority 2 of the Phase 2 plan (decisions 3, 4 and 5). Engineering defaults are marked as such; none is clinic policy.

## Routing and access (decisions 3 and 4)

| Who | Can see / reply | Notes |
| --- | --- | --- |
| Patient | Their own conversations | Starts one with `POST /api/conversations` (branch + first message, Idempotency-Key). Their open conversation at that branch is reused. The default branch is the branch of their latest visit or appointment, else their preferred branch (`GET /api/conversations/start-options`). |
| Staff | Every conversation of a branch in their authorization scope | The first Staff reply becomes the participant of record (`conversations.assigned_user_id`, set once by the database). Other branch Staff still see and can reply. Staff cannot start conversations (no approved rule). |
| Dentist | Only conversations where branch Staff added them (`POST /api/conversations/{id}/participants`) | They must be Active and assigned to that branch. |
| Owner | Nothing | Refused by the role middleware, the model rule and the channel rules. |

A Patient's view lists only the participant of record and any Dentist, not every Staff member who opened the thread.

## Realtime (Laravel Reverb)

- **Private channels** (`routes/channels.php`), authorized at `POST /api/broadcasting/auth` with the same session checks as the API:
  - `conversation.{id}`: anyone who can read that conversation over HTTP.
  - `branch-inbox.{branch}`: Staff scoped to that branch.
  - `user.{id}`: the account itself.

  The list endpoint returns the inbox channels each person may join (`meta.channels`).
- **Events are signals with identifiers only.** No message text, sender name or Patient detail ever goes over the socket.
  - `message.posted`
  - `conversation.changed` (started, assigned, participant added, closed)
  - `read.advanced`: sent only to the reader's own channel, because read state is never shown to others.

  They are sent after the database commit, never for a rolled-back change or an idempotent replay. A broadcast failure is logged and never fails the request.
- **Polling fallback.** On a signal, or every 10 s while the socket is not live (60 s safety poll otherwise), the screen reads `GET /api/conversations/{id}/messages?after=<last id>`. Socket and polling therefore show the identical projection.
- **Status chip:** Live / Connecting… / Reconnecting — checking every 10 s / Updates every 10 s (no Reverb configured).

## Encryption at rest (decision 5)

- New messages store only `conversation_messages.body_encrypted`, written by the Laravel encrypter (AES-256-CBC with a MAC, key `APP_KEY`). `body` is plain text only for rows written before this change, until they are converted.
- Message text is never stored in plain form anywhere else:
  - Idempotency records keep the response without the text; it is re-attached from the encrypted row.
  - The request fingerprint is an HMAC.
  - Events, the email alert and M22 audit carry no text.
- In transit: HTTPS for the API and `wss` for Reverb in production. There is no end-to-end encryption, and there is no search over message content.
- Messages stay immutable. The trigger allows one narrow change, swapping or re-encrypting the body columns, and only inside a transaction that sets `app.m17_body_migration = 'on'`. Only the commands below do that.

### Converting existing messages (`dental_clinic` has 0 messages today)

```
php artisan messages:encrypt-bodies --dry-run
php artisan messages:encrypt-bodies
```

The command is batched and resumable (it only picks rows still in plain text). It re-reads each row to verify it before writing, and also removes text from old idempotency records.

### Key rotation

1. Put the current key in `APP_PREVIOUS_KEYS` (comma-separated) and set a new `APP_KEY`.
2. Restart the API, worker and Reverb.
3. Run `php artisan messages:encrypt-bodies --rotate`. If it stops, resume with `--from-id=<last id>`.
4. When it finishes, remove the old key from `APP_PREVIOUS_KEYS`.

Rotating `APP_KEY` also signs everyone out and invalidates queued encrypted jobs; plan it outside clinic hours. Keep the key in a password manager: **a lost key means the messages cannot be read.**

### Rollback plan

- Preferred: restore the pre-migration backup.
- Otherwise:
  1. `php artisan messages:decrypt-bodies --force` writes plain text back.
  2. `php artisan migrate:rollback --step=1`.

  The rollback refuses while any message is still encrypted.
- Rehearsed on `dental_clinic_m17_isolated` (2026-10-13), with 25 plain messages written at the old schema:
  - **Conversion:** migrated, then a dry run (25 pending), then converted in batches of 10; a re-run converted 0.
  - **Raw table:** no plain text left.
  - **Rotation:** re-encrypted all 25. The new key alone reads them; the old key alone is refused.
  - **Rollback:** refused while rows were encrypted. After `decrypt-bodies --force` the rollback succeeded, with all 25 plain messages intact.

## Offline email alert (M18)

When the clinic writes and the Patient has not been in the app for 90 s (`MESSAGING_ONLINE_SECONDS`, from a 45 s heartbeat while a tab is visible), one `message_alert` intent is queued through the retryable outbox.

- At most one per conversation per 15 minutes (`MESSAGING_ALERT_COOLDOWN_MINUTES`), decided under the conversation lock.
- Skipped (superseded) if the Patient has already read that message by the time the worker runs.
- The email says only "You have a new message from {clinic}" with a sign-in link. It never contains the message, the sender, the branch or any clinical detail.
- Preview: `/dev/mail/message-alert`.
- Staff are not emailed: they work in the app, and a staff alert policy is an open item.

## Running it

| Process | Command |
| --- | --- |
| API | `cd backend && php artisan serve` (port 8000) |
| Frontend | `npm run dev` (port 5173). Root `.env.local` holds `VITE_REVERB_*`. |
| Queue worker (codes, alerts, receipts) | `cd backend && php artisan queue:work --queue=mail,default` |
| Scheduler (due-mail sweeper) | `cd backend && php artisan schedule:work` |
| Reverb | `cd backend && php artisan reverb:start` (port 8080; `REVERB_*` in `backend/.env`; only the frontend origin may connect) |

Without Reverb everything still works by polling.

Isolated end-to-end evidence: `scripts/m17-isolated-realtime.mjs` (17 checks: live both ways, Branch B refused over HTTP and the socket, no plain text in the database, polling takes over when the socket stops).
