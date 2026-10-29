
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { QueuePage } from '/src/pages/PatientFlow.jsx'
import { ServerMessagesPage } from '/src/pages/ServerMessages.jsx'
import { clinicDate } from '/src/clock.js'
import { INITIAL_PERSONS, INITIAL_USERS } from '/src/data.js'
import '/src/styles.css'
import '/src/foundation.css'

const branch = { id: 'b1', name: 'Fictional Branch' }
const entry = { id: 'queue-1', patientId: 'p1', patientPublicId: 'public-p1', patientCode: 'PAT-100', patientName: 'Fictional Patient', branchId: 'b1', branch: branch.name, dentistId: 'd1', clinicDate: clinicDate(), status: 'Waiting', position: 1, queueNumber: 1, revision: 1, walkIn: true }
const conversation = { id: 'conversation-1', status: 'Open', patient: { id: 'public-p1', code: 'PAT-100', name: 'Fictional Patient' }, branch: { id: 'b1', name: branch.name } }
window.fetch = async url => ({ ok: true, status: 200, headers: {}, json: async () => String(url).includes('/messages') ? { data: [], meta: { next_cursor: null } } : { data: [conversation], meta: { next_cursor: null } } })
window.b4 = { failCall: false, events: [] }

function Harness() {
  const [queue, setQueue] = useState([entry])
  const [view, setView] = useState({ page: 'queue', context: null })
  const state = { users: INITIAL_USERS, persons: INITIAL_PERSONS, dentists: [{ id: 'd1', userId: 'u3', personId: 'per-d1', branchIds: ['b1'], name: 'Fictional Dentist' }], patients: [{ id: 'p1', name: 'Fictional Patient' }], staff: [], branches: [branch], queue, appointments: [], treatments: [], visits: [] }
  const session = { role: 'dentist', active: true, userId: 'u3', dentistId: 'd1', branchId: 'b1' }
  const store = { state, session, toast: (message, kind) => window.b4.events.push({ type: 'toast', message, kind }), appointmentFlow: { refresh: async () => {}, queueCommand: async (q, command, key) => {
    window.b4.events.push({ type: 'command', command, key, revision: q.revision })
    if (window.b4.failCall) return { ok: false, message: 'Stale queue revision' }
    setQueue(previous => previous.map(item => item.id === q.id ? { ...item, status: 'Called', revision: 2 } : item))
    return { ok: true }
  } } }
  const navigate = (page, context) => { window.b4.events.push({ type: 'navigate', page, context }); if (page === 'messages') setView({ page, context }) }
  return view.page === 'messages'
    ? <ServerMessagesPage role="dentist" store={store} initial={view.context}/>
    : <QueuePage role="dentist" activeBranch={branch.name} store={store} setPage={navigate}/>
}
createRoot(document.getElementById('root')).render(<Harness />)
