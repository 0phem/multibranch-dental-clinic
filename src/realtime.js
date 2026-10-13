import { authorizeChannel } from './api-client.js'

// M17 realtime client (Laravel Reverb, Pusher protocol). Only PRIVATE channels are used and each subscription is authorized by the
// clinic server with the signed-in session (POST /api/broadcasting/auth) under the same rules as the HTTP API. Events are signals with
// identifiers only — never message text; on a signal the screen re-reads the server through the same endpoint the polling fallback
// uses. When the socket is unavailable (Reverb not running, network drop) screens keep working by polling; `state` says which.
//   state: 'idle' (not started) | 'disabled' (no Reverb configured) | 'connecting' | 'live' | 'reconnecting' | 'offline'
// The socket libraries are loaded on demand, only for a clinic-server session with Reverb configured.

let state = 'idle'
let echo = null
let starting = null
const listeners = new Set()
const channels = new Map() // name -> {count, channel}

function env(name) {
  try { return (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) || '' } catch { return '' }
}

export function realtimeConfig() {
  const key = env('VITE_REVERB_APP_KEY')
  if (!key) return null
  const scheme = env('VITE_REVERB_SCHEME') || 'http'
  const port = Number(env('VITE_REVERB_PORT')) || (scheme === 'https' ? 443 : 8080)
  return { key, host: env('VITE_REVERB_HOST') || 'localhost', port, tls: scheme === 'https' }
}

function setState(next) {
  if (state === next) return
  state = next
  listeners.forEach(fn => { try { fn(next) } catch { /* a listener never breaks the socket */ } })
}

export function realtimeState() { return state }

export function onRealtimeState(fn) {
  listeners.add(fn)
  fn(state)
  return () => listeners.delete(fn)
}

/** Pusher connection states mapped to what the screen says. */
export function mapConnectionState(current) {
  if (current === 'connected') return 'live'
  if (current === 'failed') return 'offline'
  if (current === 'initialized' || current === 'connecting') return state === 'live' ? 'reconnecting' : 'connecting'
  return 'reconnecting' // unavailable, disconnected
}

export function startRealtime() {
  const config = realtimeConfig()
  if (!config) { setState('disabled'); return Promise.resolve(null) }
  if (echo) return Promise.resolve(echo)
  if (starting) return starting
  setState('connecting')
  starting = Promise.all([import('laravel-echo'), import('pusher-js')]).then(([{ default: Echo }, { default: Pusher }]) => {
    const client = new Pusher(config.key, {
      wsHost: config.host, wsPort: config.port, wssPort: config.port, forceTLS: config.tls, enabledTransports: ['ws', 'wss'], cluster: 'mt1',
      channelAuthorization: {
        customHandler: ({ socketId, channelName }, callback) => {
          authorizeChannel(socketId, channelName).then(result => (result.ok ? callback(null, result.data) : callback(new Error('Channel not authorized'), null)))
        },
      },
    })
    echo = new Echo({ broadcaster: 'reverb', key: config.key, client })
    client.connection.bind('state_change', ({ current }) => setState(mapConnectionState(current)))
    setState(mapConnectionState(client.connection.state))
    return echo
  }).catch(() => { starting = null; setState('offline'); return null })
  return starting
}

/**
 * Subscribes to a private channel ('conversation.<id>', 'branch-inbox.<id>', 'user.<id>'; lower-case ids). Several screens may share
 * one channel; it is left when the last one unsubscribes. Handlers: { posted, changed, read } receive the event payload.
 */
export function subscribe(name, handlers) {
  let closed = false
  let bound = null
  startRealtime().then(instance => {
    if (!instance || closed) return
    const entry = channels.get(name) || { count: 0, channel: instance.private(name) }
    entry.count++
    channels.set(name, entry)
    bound = {
      posted: payload => handlers.posted?.(payload),
      changed: payload => handlers.changed?.(payload),
      read: payload => handlers.read?.(payload),
    }
    entry.channel.listen('.message.posted', bound.posted).listen('.conversation.changed', bound.changed).listen('.read.advanced', bound.read)
  })
  return () => {
    closed = true
    const entry = channels.get(name)
    if (!entry || !bound) return
    entry.channel.stopListening('.message.posted', bound.posted).stopListening('.conversation.changed', bound.changed).stopListening('.read.advanced', bound.read)
    if (--entry.count <= 0) { channels.delete(name); echo?.leave(name) }
  }
}

/** Sign-out: close the socket so nothing keeps listening for the previous account. */
export function stopRealtime() {
  channels.clear()
  try { echo?.disconnect() } catch { /* already closed */ }
  echo = null
  starting = null
  setState('idle')
}
