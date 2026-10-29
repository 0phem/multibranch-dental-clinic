import React from 'react'
import { createRoot } from 'react-dom/client'
import { CheckInPage } from '/src/pages/PatientFlow.jsx'
import '/src/styles.css'
import '/src/foundation.css'

const patient = { id: '01FICTIONALPATIENTPUBLICID0001', patientCode: 'PAT-B6-001', name: 'Fictional Ada Patient', phone: '+639170000001' }
const state = {
  appointments: [], visits: [], queue: [], users: [], patients: [patient],
  branches: [{ id: 'b1', name: 'Fictional Main Branch', status: 'Open' }],
  services: [{ id: 'svc1', name: 'Fictional Consultation', status: 'Active' }],
  branchServices: [{ branchId: 'b1', serviceId: 'svc1', active: true }],
  dentists: [{ id: 'd1', name: 'Fictional Dentist', available: true, branchIds: ['b1'] }],
  dentistServiceAssignments: [{ dentistId: 'd1', serviceId: 'svc1', isAuthorized: true }],
}
window.stf12 = { calls: [], messages: [], result: { ok: true, queued: true, queueNumber: 1 } }
// Unrelated dashboard panels load their own lists. Keep this fixture isolated from a live clinic API.
window.fetch = async (url) => ({ ok: true, status: 200, json: async () => ({
  data: String(url).includes('front-desk/today')
    ? { settings: null, late: [], replies: [], released: [], free_times: [], confirmations: [] }
    : [],
}) })
const store = {
  state,
  session: { role: 'staff', branchId: 'b1', branchScopes: ['b1'] },
  directoryPatients: [patient],
  toast: (message, tone) => window.stf12.messages.push({ message, tone }),
  appointmentFlow: {
    searchPatients: async () => {},
    refresh: async () => {},
    walkIn: async (form, key) => { window.stf12.calls.push({ form, key }); return window.stf12.result },
  },
}
createRoot(document.getElementById('root')).render(<CheckInPage store={store} context={{ mode: 'walkin' }} setPage={() => {}} />)
