import * as api from './api-client.js'

// M7 Patient assistant client. The clinic server owns the provider credential, the instructions, the approved knowledge and every
// safety check; this module only sends the Patient's typed message and maps the answer. It never calls a language-model provider,
// never holds a key, never fabricates an answer when the server fails and never retries by itself (a retry costs money and is the
// Patient's choice).

export const MAX_MESSAGE = 500

/** Mapped server answer: text, outcome category, whether the Patient should contact the clinic, and the knowledge ids used. */
export function mapAnswer(data) {
  return {
    answer: typeof data?.answer === 'string' ? data.answer : '',
    outcome: typeof data?.outcome === 'string' ? data.outcome : 'answered',
    handoff: data?.handoff_required === true,
    sources: Array.isArray(data?.sources) ? data.sources : [],
  }
}

/**
 * @returns {Promise<{ok:true,answer:string,outcome:string,handoff:boolean,sources:string[]}|{ok:false,kind:string,message:string,retryAfter?:number}>}
 */
export async function ask(message) {
  const text = String(message ?? '').trim()
  if (text.length < 2) return { ok: false, kind: 'validation', message: 'Type a question for the assistant.' }
  if (text.length > MAX_MESSAGE) return { ok: false, kind: 'validation', message: `Keep your question under ${MAX_MESSAGE} characters.` }
  const result = await api.askAssistant(text)
  if (result.ok) {
    const mapped = mapAnswer(result.data)
    return mapped.answer ? { ok: true, ...mapped } : { ok: false, kind: 'server', message: 'The assistant could not answer right now. Please try again, or contact the clinic.' }
  }
  if (result.kind === 'rate_limited') return { ok: false, kind: 'rate_limited', retryAfter: Number(result.retry_after) || 60, message: result.message || 'Please wait a moment and try again.' }
  return { ok: false, kind: result.kind || 'server', message: result.message || 'The assistant could not answer right now. Please try again, or contact the clinic.' }
}
