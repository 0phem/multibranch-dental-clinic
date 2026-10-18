import { useEffect, useState } from 'react'
import { loadPublicBranches, loadPublicList } from '../clinic-config.js'

// Public website data, loaded once per page view and shared by every section (branches, services, confirmed FAQ).
// States: {status: 'loading' | 'ready' | 'error', rows}. Nothing is invented when the server cannot be reached.
const cache = new Map()
const loaders = {
  branches: () => loadPublicBranches().then(r => ({ ok: r.ok, rows: r.branches })),
  services: () => loadPublicList('services'),
  faq: () => loadPublicList('faq'),
}

export function usePublicData(kind) {
  const [state, setState] = useState(() => cache.get(kind)?.result || { status: 'loading', rows: [] })
  useEffect(() => {
    let live = true
    let entry = cache.get(kind)
    if (!entry) {
      entry = { promise: loaders[kind]().then(r => (entry.result = { status: r.ok ? 'ready' : 'error', rows: r.rows || [] })) }
      cache.set(kind, entry)
      entry.promise.then(result => { if (result.status === 'error') cache.delete(kind) }) // try again on the next visit
    }
    entry.promise.then(result => { if (live) setState(result) })
    return () => { live = false }
  }, [kind])
  return state
}

/** Google Maps directions to a branch: its stored coordinates when present, otherwise its address as given. */
export const directionsUrl = branch => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(branch.latitude != null && branch.longitude != null ? `${branch.latitude},${branch.longitude}` : branch.address)}`

/** "0922 878 7341" -> "+639228787341" for tel: links. */
export const telHref = phone => { const d = String(phone || '').replace(/[^0-9+]/g, ''); return `tel:${d.startsWith('+') ? d : d.startsWith('0') ? `+63${d.slice(1)}` : d}` }
