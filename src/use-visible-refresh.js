import { useEffect, useRef } from 'react'

// M9 refresh strategy (decision Q7): a modest 30-second refresh only while a queue screen is mounted and the document
// is visible. It stops on unmount, pauses while the tab is hidden (and refreshes once when it becomes visible again),
// and stops when inactive (e.g. no session after it was invalidated). No websockets in this wave. The latest refresh
// function is kept in a ref, so store re-renders never reset the timer.
export const QUEUE_REFRESH_MS = 30000

export function useVisibleRefresh(refresh, { active = true, intervalMs = QUEUE_REFRESH_MS } = {}) {
  const latest = useRef(refresh)
  latest.current = refresh
  useEffect(() => {
    if (!active || typeof document === 'undefined') return undefined
    const run = () => { if (document.visibilityState !== 'hidden') latest.current?.() }
    const timer = setInterval(run, intervalMs)
    const onVisible = () => { if (document.visibilityState === 'visible') latest.current?.() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [active, intervalMs])
}
