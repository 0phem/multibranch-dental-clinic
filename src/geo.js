// Nearest-branch geometry for Smart Find (Phase 4B.3C-1). Pure, framework-free math only.
//
// Canonical `branches` records have no latitude/longitude today (confirmed absent from `INITIAL_BRANCHES` in
// data.js) — no coordinate is invented here or anywhere in this pass. `nearestBranch` simply returns `null`
// whenever no branch carries real numeric coordinates, which is always true right now, so Smart Find's location
// step always degrades honestly to a manual branch picker. Once the client supplies real branch
// `latitude`/`longitude` (an additive, approved-future ERD field — see ERD_ALIGNMENT.md), this same function
// activates nearest-branch selection with no change to the Smart Find flow that calls it.
const toRad=deg=>deg*Math.PI/180

export function haversineKm(a, b) {
  if(!Number.isFinite(a?.lat)||!Number.isFinite(a?.lng)||!Number.isFinite(b?.lat)||!Number.isFinite(b?.lng))return Infinity
  const R=6371
  const dLat=toRad(b.lat-a.lat), dLng=toRad(b.lng-a.lng)
  const sa=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2
  return 2*R*Math.asin(Math.min(1,Math.sqrt(sa)))
}

// `branches` is the canonical Open-branch list; `coords` is `{lat,lng}` from the browser's geolocation API (or
// null). Returns the nearest branch that actually carries numeric coordinates, or `null` when no coordinates are
// available (today, always) or no `coords` was supplied (permission denied/unavailable) — never a guessed branch.
export function nearestBranch(branches, coords) {
  if(!coords||!Number.isFinite(coords.lat)||!Number.isFinite(coords.lng))return null
  const eligible=(branches||[]).filter(b=>b.status==='Open'&&Number.isFinite(b.latitude)&&Number.isFinite(b.longitude))
  if(!eligible.length)return null
  return [...eligible].sort((a,b)=>haversineKm(coords,{lat:a.latitude,lng:a.longitude})-haversineKm(coords,{lat:b.latitude,lng:b.longitude}))[0]
}
