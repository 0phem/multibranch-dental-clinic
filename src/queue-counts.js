import { clinicDate } from './clock.js'

// M9 live-queue counts for the clinic-server views. Counts are plain tallies of the server QueueEntry statuses; they
// carry no wait estimate, workload percentage, capacity threshold or Healthy/Attention judgement (none is approved).
//
// Combined counts (a Patient is counted in exactly one status):
//   awaiting = Waiting + Called + Treatment Ready   (the positional queue the server numbers; the Patient is present and not yet in treatment)
//   active   = awaiting + Temporarily Away          (every entry the server still holds open for the day)
// Served (treatment has started) and the historical Completed / Cancelled / No-show are not counted.

/** The server GET /api/queue row cap (QueueController index). A response this long may be cut off: it is never shown as complete. */
export const SERVER_QUEUE_ROW_CAP = 500

export const AWAITING_STATUSES = ['Waiting', 'Called', 'Treatment Ready']
export const ACTIVE_STATUSES = [...AWAITING_STATUSES, 'Temporarily Away']

export const isTruncatedQueueResponse = rows => Array.isArray(rows) && rows.length >= SERVER_QUEUE_ROW_CAP

/** Tally today's entries. `branchId` null = every branch the (server-scoped) response contains. */
export function countQueue(queue, { branchId = null, branchName = null, date = clinicDate() } = {}) {
  const out = { waiting: 0, called: 0, treatmentReady: 0, away: 0, awaiting: 0, active: 0 }
  for (const q of Array.isArray(queue) ? queue : []) {
    if (!q || q.clinicDate !== date) continue
    if ((branchId || branchName) && !((branchId && q.branchId === branchId) || (branchName && q.branch === branchName))) continue
    if (q.status === 'Waiting') out.waiting++
    else if (q.status === 'Called') out.called++
    else if (q.status === 'Treatment Ready') out.treatmentReady++
    else if (q.status === 'Temporarily Away') out.away++
    else continue
  }
  out.awaiting = out.waiting + out.called + out.treatmentReady
  out.active = out.awaiting + out.away
  return out
}

/**
 * Whether queue counts may be shown as numbers. Zero is only ever shown from a successful, complete response for the
 * current Asia/Manila clinic day. Offline demo sessions have no server queue ('demo').
 * @returns {{mode:'demo'|'loading'|'error'|'stale'|'incomplete'|'ready', message:string}}
 */
export function queueVisibility({ session, status, snapshot, today = clinicDate() }) {
  if (!session?.serverUserId) return { mode: 'demo', message: '' }
  if (status === 'error') return { mode: 'error', message: 'Live queue counts are unavailable because the clinic records could not be loaded.' }
  if (!snapshot) return { mode: 'loading', message: 'Loading the live queue…' }
  if (snapshot.date !== today) return { mode: 'stale', message: 'Live queue counts are out of date for today and are refreshing.' }
  if (snapshot.truncated) return { mode: 'incomplete', message: `The clinic server returned the maximum ${SERVER_QUEUE_ROW_CAP} queue entries, so the list may be cut off. Counts are not shown.` }
  return { mode: 'ready', message: '' }
}

/**
 * Latest-request-wins gate for overlapping refreshes. A response may be applied only while its token is still current;
 * `invalidate()` (sign-out, session change) makes every in-flight response stale. Without it a slow older response could
 * overwrite a newer one, or a signed-out session's response could repopulate the store.
 */
export function createLatestGate() {
  let current = 0
  return { begin: () => ++current, isCurrent: token => token === current, invalidate: () => { current++ } }
}
