import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchAvailability } from './appointments-api.js'
import { addDays } from './clock.js'

// Server availability for a run of consecutive dates (M6 cutover). Every start time shown to a person comes from
// GET /api/appointments/availability — Patient: hourly and inside the server's booking window; Staff: the 30-minute
// grid. Nothing here is reserved, and the create command validates everything again.
export function useWindowAvailability({ branchId, serviceId, startDate, days = 14, patientPublicId = null, ignoreAppointmentId = null, dentistId = null, enabled = true }) {
  const [state, setState] = useState({ status: 'idle', byDate: {}, rules: null, error: '' })
  const token = useRef(0)
  const load = useCallback(async () => {
    if (!enabled || !branchId || !serviceId || !startDate) { setState({ status: 'idle', byDate: {}, rules: null, error: '' }); return }
    const current = ++token.current
    setState(previous => ({ ...previous, status: 'loading', error: '' }))
    const dates = Array.from({ length: days }, (_, offset) => addDays(startDate, offset))
    const results = await Promise.all(dates.map(date => fetchAvailability({ branchId, serviceId, date, patientPublicId, ignoreAppointmentId, dentistId })))
    if (current !== token.current) return
    const failure = results.find(result => !result.ok)
    if (failure) { setState({ status: 'error', byDate: {}, rules: null, error: failure.message }); return }
    setState({ status: 'ready', byDate: Object.fromEntries(results.map(result => [result.date, result.slots])), rules: results[0]?.rules || null, error: '' })
  }, [branchId, serviceId, startDate, days, patientPublicId, ignoreAppointmentId, dentistId, enabled])
  useEffect(() => { load() }, [load])
  return { ...state, reload: load }
}

/** Slots for one date (e.g. a date typed into a date field beyond the strip). */
export function useDayAvailability({ branchId, serviceId, date, patientPublicId = null, ignoreAppointmentId = null, dentistId = null, enabled = true }) {
  const window = useWindowAvailability({ branchId, serviceId, startDate: date, days: 1, patientPublicId, ignoreAppointmentId, dentistId, enabled: enabled && !!date })
  return { ...window, slots: window.byDate[date] || [] }
}

/** Flattened `{date,start,dentistId,dentist}` results for the date-strip/day-part helpers in patient-view.js. */
export const flattenSlots = byDate => Object.values(byDate || {}).flat()
