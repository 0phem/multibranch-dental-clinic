import * as api from './api-client.js'
import { normalizeFailure } from './appointments-api.js'

// M26 client (foundation only, Patient only). Laravel/PostgreSQL is the ONLY authority for feedback in a clinic-server session. There is no
// reviewer API or screen: reviewer authority is not approved. A feedback entry is free
// text about one of the Patient's own COMPLETED visits. There is no rating, category, anonymity, status, reply, publication or marketing
// field, and the browser stores nothing. Text stays a plain string and is rendered as text, never HTML.

export const MAX_FEEDBACK = 2000

export const mapVisit = row => ({ id: row.id, date: row.date, services: Array.isArray(row.services) ? row.services : [] })
export const mapMine = row => ({ id: row.id, visit: mapVisit(row.visit || {}), body: row.body ?? '', submittedAt: row.submitted_at })

async function page(call, map, cursor, size) {
  const result = await call({ per_page: size, ...(cursor ? { cursor } : {}) })
  if (!result.ok) return normalizeFailure(result)
  return { ok: true, rows: (result.data || []).map(map), nextCursor: result.meta?.next_cursor ?? null }
}

export const loadEligibleVisits = cursor => page(api.eligibleFeedbackVisits, mapVisit, cursor, 25)
export const loadMyFeedback = cursor => page(api.myFeedback, mapMine, cursor, 25)

/** One Idempotency-Key per send attempt: reuse it when retrying the same text so a lost response never stores it twice. */
export async function submit(visitId, body, key) {
  const text = String(body ?? '').trim()
  if (!visitId) return { ok: false, kind: 'validation', message: 'Choose the visit your feedback is about.' }
  if (!text) return { ok: false, kind: 'validation', message: 'Write your feedback first.' }
  if (text.length > MAX_FEEDBACK) return { ok: false, kind: 'validation', message: `Keep your feedback under ${MAX_FEEDBACK} characters.` }
  const result = await api.submitFeedback({ visit_id: visitId, body: text }, key)
  return result.ok ? { ok: true, row: mapMine(result.data) } : normalizeFailure(result)
}
