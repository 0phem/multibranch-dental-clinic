// M17 composer state per conversation. Each conversation keeps its OWN draft text and its own Idempotency-Key, so switching
// conversations can never carry a draft (or a retry key) from one Patient's thread into another's. A send always names the
// conversation it was written for; the key is reused only for a retry of the same text in the same conversation.
import { commandKey } from './appointments-api.js'

export function createDrafts(makeKey = commandKey) {
  const drafts = new Map()
  const entry = id => {
    if (!drafts.has(id)) drafts.set(id, { text: '', key: makeKey() })
    return drafts.get(id)
  }
  return {
    text: id => (id ? entry(id).text : ''),
    /** Editing changes the text, so a later send is a new request with a new key. */
    setText(id, text) { if (!id) return; const d = entry(id); if (d.text !== text) drafts.set(id, { text, key: makeKey() }) },
    /** The request to send now: conversation, text and key captured together at the moment of sending. */
    snapshot(id) { const d = entry(id); return { conversationId: id, text: d.text, key: d.key } },
    /** After a confirmed send of exactly this snapshot: clear that conversation's draft only. */
    sent(snapshot) { const d = drafts.get(snapshot.conversationId); if (d && d.key === snapshot.key) drafts.set(snapshot.conversationId, { text: '', key: makeKey() }) },
    clear(id) { drafts.delete(id) },
  }
}
