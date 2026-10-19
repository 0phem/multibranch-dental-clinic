// A random id this browser keeps for the counter registration's rate limits (per device, not only per shared guest Wi-Fi IP).
// It identifies nothing about the person and is never sent anywhere else.
export function deviceId() {
  try {
    let id = localStorage.getItem('intake-device')
    if (!id) { id = (crypto.randomUUID?.() || String(Math.random()).slice(2)).replace(/[^A-Za-z0-9-]/g, ''); localStorage.setItem('intake-device', id) }
    return id
  } catch { return 'no-storage' }
}
