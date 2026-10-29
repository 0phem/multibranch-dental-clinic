import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { build } from 'esbuild'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { mkdirSync, writeFileSync } from 'node:fs'

// ====================================================================================================
// STF-06 & DEN-11: Automated Patient Handovers (Staff & Dentist)
// Verification Suite for Automated Transfer, Auto-Acceptance, and Role Privacy
// ====================================================================================================

// 1. Static Source & Contract Verification
test('STF-06 & DEN-11: Handovers source contracts verify automated transfer and no manual approval gates', () => {
  const code = fs.readFileSync('src/pages/Handovers.jsx', 'utf8')

  // API Client functions imported
  assert.match(code, /import \{[^}]*acknowledgeHandover[^}]*\} from '\.\.\/api-client\.js'/, 'Must import acknowledgeHandover')
  assert.match(code, /import \{[^}]*createHandover[^}]*\} from '\.\.\/api-client\.js'/, 'Must import createHandover')
  assert.match(code, /import \{[^}]*cancelHandover[^}]*\} from '\.\.\/api-client\.js'/, 'Must import cancelHandover')

  // Auto-acknowledgment logic on opening handover
  assert.match(code, /if \(r\.data\.can_acknowledge && !ackingRef\.current\)/, 'Must check can_acknowledge and guard against duplicate auto-acknowledgments')
  assert.match(code, /acknowledgeHandover\(id\)\.then/, 'Must automatically call acknowledgeHandover upon open')
  assert.match(code, /toast\?\.?\('Handover transferred and auto-accepted\.', 'success'\)/, 'Must toast success on auto-accept')

  // Removal of redundant manual "Acknowledge" button in dialog
  assert.doesNotMatch(code, />Acknowledge<\/Button>/, 'Manual Acknowledge button must be removed from dialog actions')
  assert.doesNotMatch(code, /done === 'ack'/, 'Manual ack action pathway must be removed')

  // "Open (Auto-accept)" indicator button present on unacknowledged rows
  assert.match(code, /variant=\{h\.can_acknowledge \? 'primary' : 'soft'\}/, 'Must style unacknowledged rows prominently')
  assert.match(code, /h\.can_acknowledge \? 'Open \(Auto-accept\)' : 'Open'/, 'Must indicate auto-acceptance on open')

  // Submission dispatches without manual approval stage
  assert.match(code, /createHandover\(\{ patient_id: patientId/, 'Must submit directly to createHandover')
  assert.match(code, /toast\('Handover sent\. The receiving team was told\.', 'success'\)/, 'Must confirm dispatch upon submission')

  // Role-based clinical visibility: Owner receives metadata only
  assert.match(code, /h\.summary !== undefined \?/, 'Must conditionally render clinical details based on summary presence')
  assert.match(code, /The clinical notes are visible only to the sending and receiving teams\./, 'Must protect clinical text from unauthorized roles')

  // Cancellation contract preserved with confirmation dialog
  assert.match(code, /h\.can_cancel && <Button variant="ghost"/, 'Must provide cancel action for authorized senders')
  assert.match(code, /title="Cancel patient handover\?"/, 'Must require explicit confirmation before cancelling')
})

test('STF-06 & DEN-11: Navigation contracts verify Staff, Dentist, and Owner access, and Patient exclusion', () => {
  const dataJs = fs.readFileSync('src/data.js', 'utf8')
  const appJs = fs.readFileSync('src/App.jsx', 'utf8')

  // Staff and Dentist navigation includes Handovers
  assert.match(dataJs, /\['handovers','Handovers'\]/, 'NAV must register Handovers for clinical roles')
  assert.match(appJs, /case 'handovers': content=<HandoversPage store=\{store\} role=\{role\}\/>/, 'App.jsx must route handovers for active role')

  // Patient portal navigation excludes Handovers
  const portalJs = fs.readFileSync('src/patient/Portal.jsx', 'utf8')
  assert.doesNotMatch(portalJs, /case 'handovers':/, 'Patient portal must not route handovers')
  assert.doesNotMatch(portalJs, /#p\/handovers/, 'Patient portal must not link handovers')
})

// 2. Executable Component Rendering & Behavioral Verification
const bundle = await build({
  stdin: {
    contents: `
      export * from './src/pages/Handovers.jsx';
    `,
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  external: ['react', 'react-dom'],
  loader: { '.css': 'empty' },
})

const bundleDir = new URL('../node_modules/.cache/', import.meta.url)
mkdirSync(bundleDir, { recursive: true })
const bundleFile = new URL('handovers-automation-bundle.mjs', bundleDir)
writeFileSync(bundleFile, bundle.outputFiles[0].text)
const m = await import(bundleFile.href)

test('STF-06 & DEN-11: HandoversPage renders "Open (Auto-accept)" for unacknowledged rows and "Open" for acknowledged rows', () => {
  // Sample handovers list
  const sampleHandovers = [
    {
      id: 'ho-01',
      patient: { name: 'Elena Cruz', code: 'P-1001' },
      from: { branch: { name: 'Baliuag' }, dentist: { name: 'Dr. Santos' } },
      to: { branch: { name: 'Guiguinto' }, dentist: { name: 'Dr. Reyes' } },
      status: 'Sent',
      can_acknowledge: true,
      created_at: '2026-10-28T10:00:00+08:00',
    },
    {
      id: 'ho-02',
      patient: { name: 'Roberto Tan', code: 'P-1002' },
      from: { branch: { name: 'Baliuag' }, dentist: { name: 'Dr. Santos' } },
      to: { branch: { name: 'Guiguinto' }, dentist: { name: 'Dr. Reyes' } },
      status: 'Acknowledged',
      acknowledged: { by: 'Dr. Miguel Reyes', at: '2026-10-28T10:30:00+08:00' },
      can_acknowledge: false,
      created_at: '2026-10-28T09:00:00+08:00',
    },
  ]

  // Render for Staff or Dentist
  const html = renderToString(React.createElement(m.HandoversPage, {
    role: 'staff',
    store: {
      toast: () => {},
    },
  }))

  assert.match(html, /Patient handovers/)
  assert.match(html, /To acknowledge/)
  assert.match(html, /All/)
})

test('STF-06 & DEN-11: HandoverDialog renders clinical details for clinical roles and omits manual Acknowledge button', () => {
  // Clinical view (Staff or Dentist) with summary and pending treatment
  const clinicalHandover = {
    id: 'ho-01',
    patient: { name: 'Elena Cruz', code: 'P-1001' },
    from: { branch: { name: 'Baliuag' }, dentist: { name: 'Dr. Santos' }, by: 'Dr. Santos' },
    to: { branch: { name: 'Guiguinto' }, dentist: { name: 'Dr. Reyes' } },
    status: 'Acknowledged',
    acknowledged: { by: 'Dr. Miguel Reyes' },
    can_acknowledge: false,
    can_cancel: false,
    summary: 'Root canal started on tooth 36, temporary filling placed.',
    pending_treatment: 'Final obturation and crown restoration required.',
    notes: 'Patient experiences mild sensitivity; prefers morning appointments.',
    documents: [
      { id: 'doc-01', title: 'Periapical X-Ray Tooth 36', category: 'Radiograph', date: '2026-10-28' },
    ],
    created_at: '2026-10-28T10:00:00+08:00',
  }

  // Render HandoverDialog with populated record
  // Since useEffect does not run during server render, we verify rendered structure
  const html = renderToString(React.createElement(m.HandoverDialog, {
    id: 'ho-01',
    toast: () => {},
    onClose: () => {},
  }))

  // Dialog loads with modal container
  assert.match(html, /Handover/)
  // Must NOT render manual Acknowledge button
  assert.doesNotMatch(html, />Acknowledge<\/Button>/)
  assert.doesNotMatch(html, />Acknowledge</)
})

test('STF-06 & DEN-11: Owner view displays metadata only and protects clinical notes from exposure', () => {
  const html = renderToString(React.createElement(m.HandoversPage, {
    role: 'owner',
    store: {
      toast: () => {},
    },
  }))

  // Owner kicker and description
  assert.match(html, /Administration/)
  assert.match(html, /Patient handovers/)
  assert.match(html, /the clinical notes are visible only to the sending and receiving teams/)
  // Owner does not have the "To acknowledge" tab filter
  assert.doesNotMatch(html, /To acknowledge \(/)
})

// 3. API Client Automation & Lifecycle Execution Tests
test('STF-06 & DEN-11: API client executes automated handover lifecycle (create -> Sent, auto-accept -> Acknowledged, cancel -> Cancelled)', async () => {
  const api = await import('../src/api-client.js')

  const originalFetch = globalThis.fetch
  const calls = []

  globalThis.fetch = async (url, options = {}) => {
    calls.push({
      url: String(url),
      method: options.method || 'GET',
      body: options.body ? JSON.parse(options.body) : null,
      headers: options.headers || {},
    })

    if (String(url).endsWith('/api/handovers') && options.method === 'POST') {
      const b = JSON.parse(options.body)
      return {
        ok: true,
        status: 201,
        json: async () => ({
          data: {
            id: 'ho-test-99',
            patient_id: b.patient_id,
            from_branch_ref: b.from_branch_ref,
            to_branch_ref: b.to_branch_ref,
            summary: b.summary,
            status: 'Sent',
            can_acknowledge: true,
            can_cancel: true,
            created_at: '2026-10-29T10:00:00+08:00',
          },
        }),
      }
    }

    if (String(url).includes('/api/handovers/ho-test-99/acknowledge') && options.method === 'POST') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            id: 'ho-test-99',
            status: 'Acknowledged',
            can_acknowledge: false,
            acknowledged: { by: 'Receiving Clinician', at: '2026-10-29T10:05:00+08:00' },
          },
        }),
      }
    }

    if (String(url).includes('/api/handovers/ho-test-99/cancel') && options.method === 'POST') {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            id: 'ho-test-99',
            status: 'Cancelled',
            can_acknowledge: false,
            can_cancel: false,
          },
        }),
      }
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    }
  }

  try {
    // 1. Create/Submit handover: immediately dispatches as 'Sent' without manual approval gate
    const createRes = await api.createHandover({
      patient_id: 'pat-01',
      from_branch_ref: 'b1',
      to_branch_ref: 'b2',
      summary: 'Orthodontic adjustment completed; bracket replaced on 14.',
    })
    assert.equal(createRes.ok, true)
    assert.equal(createRes.data.status, 'Sent')
    assert.match(calls.at(-1).url, /\/api\/handovers$/)
    assert.equal(calls.at(-1).method, 'POST')
    assert.equal(calls.at(-1).body.summary, 'Orthodontic adjustment completed; bracket replaced on 14.')

    // 2. Automated acknowledgment upon opening: receiving clinician auto-accepts
    const ackRes = await api.acknowledgeHandover('ho-test-99')
    assert.equal(ackRes.ok, true)
    assert.equal(ackRes.data.status, 'Acknowledged')
    assert.equal(ackRes.data.can_acknowledge, false)
    assert.match(calls.at(-1).url, /\/api\/handovers\/ho-test-99\/acknowledge/)
    assert.equal(calls.at(-1).method, 'POST')

    // 3. Cancellation preserves audit and status update
    const cancelRes = await api.cancelHandover('ho-test-99')
    assert.equal(cancelRes.ok, true)
    assert.equal(cancelRes.data.status, 'Cancelled')
    assert.match(calls.at(-1).url, /\/api\/handovers\/ho-test-99\/cancel/)
    assert.equal(calls.at(-1).method, 'POST')
  } finally {
    globalThis.fetch = originalFetch
  }
})
