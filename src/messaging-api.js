import * as api from './api-client.js'
import { normalizeFailure } from './appointments-api.js'

// M17 client. Laravel/PostgreSQL is the ONLY authority for conversations and messages in a clinic-server session. These are in-app
// human messages: nothing here sends SMS/e-mail/social messages, and "unread" only means not yet opened in this application. The
// sender is the signed-in account (the server derives it); the browser stores nothing and decides no access.

export const MAX_MESSAGE = 2000
const PAGE_SIZE = 30

export function mapConversation(row) {
  return {
    id: row.id,
    server: true,
    context: row.context ?? '',
    status: row.status,
    revision: row.revision,
    patientName: row.patient?.name ?? '',
    patientCode: row.patient?.code ?? '',
    branchName: row.branch?.name ?? '',
    participants: (row.participants || []).map(p => ({ name: p.name ?? '', role: p.role ?? '' })),
    unread: Number.isInteger(row.unread) ? row.unread : 0,
    lastMessageAt: row.last_message_at ?? null,
    closed: row.status === 'Closed',
  }
}

/** Message text stays a plain string: React renders it as text, never HTML. */
export function mapMessage(row) {
  return { id: row.id, body: row.body ?? '', senderName: row.sender?.name ?? '', senderRole: row.sender?.role ?? '', mine: row.mine === true, sentAt: row.sent_at }
}

export async function loadConversations(cursor = null) {
  const result = await api.listConversations({ per_page: 25, ...(cursor ? { cursor } : {}) })
  if (!result.ok) return normalizeFailure(result)
  return { ok: true, rows: (result.data || []).map(mapConversation), nextCursor: result.meta?.next_cursor ?? null }
}

/** Newest-first page (the server order). `cursor` continues to OLDER messages; a failed page is an error, never a shorter history. */
export async function loadMessages(conversationId, cursor = null) {
  const result = await api.listConversationMessages(conversationId, { per_page: PAGE_SIZE, ...(cursor ? { cursor } : {}) })
  if (!result.ok) return normalizeFailure(result)
  return { ok: true, rows: (result.data || []).map(mapMessage), nextCursor: result.meta?.next_cursor ?? null }
}

/** Authoritative in-application counts. A failure is returned as a failure — never as zero. */
export async function loadConversationSummary() {
  const result = await api.conversationSummary()
  if (!result.ok) return normalizeFailure(result)
  const d = result.data || {}
  const n = v => (Number.isInteger(v) && v >= 0 ? v : null)
  if (n(d.conversations) === null || n(d.unread_conversations) === null) return { ok: false, kind: 'server', message: 'The message count is unavailable.' }
  return { ok: true, conversations: d.conversations, open: n(d.open), unread: d.unread_conversations }
}

/** One Idempotency-Key per send attempt: reuse it when retrying the same text so a lost response never posts twice. */
export async function sendMessage(conversationId, body, key) {
  const text = String(body ?? '').trim()
  if (!text) return { ok: false, kind: 'validation', message: 'Write a message first.' }
  if (text.length > MAX_MESSAGE) return { ok: false, kind: 'validation', message: `Keep a message under ${MAX_MESSAGE} characters.` }
  const result = await api.sendConversationMessage(conversationId, text, key)
  return result.ok ? { ok: true, message: mapMessage(result.data) } : normalizeFailure(result)
}

/** Records that this participant has seen the conversation up to `upToMessageId` (the newest message DISPLAYED). Forward-only on the server. */
export async function markRead(conversationId, upToMessageId) {
  if (!upToMessageId) return { ok: true, skipped: true }
  const result = await api.markConversationRead(conversationId, upToMessageId)
  return result.ok ? { ok: true } : normalizeFailure(result)
}

export async function closeConversation(conversation, key) {
  const result = await api.closeConversation(conversation.id, { expected_revision: conversation.revision }, key)
  return result.ok ? { ok: true } : normalizeFailure(result)
}
