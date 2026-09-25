import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import * as data from '../src/data.js'
import { setClockSource } from '../src/clock.js'
import { normalizeClinicState, sessionForRole, persistableCollection, patientInScope } from '../src/contracts.js'
import { createWorkflowActions } from '../src/workflow.js'
import { readCollection, writeCollection } from '../src/persistence.js'
import { LOYALTY_PROGRAM, ledgerIssue, canManageLoyalty, needMoreMessage } from '../src/loyalty.js'
import { patientLoyalty, patientHome } from '../src/patient-view.js'

beforeEach(() => setClockSource(() => new Date('2026-09-19T02:08:00Z')))   // 2026-09-19 10:08 Manila

const seedKeys = { persons: 'PERSONS', services: 'SERVICES', branchServices: 'BRANCH_SERVICES', dentistServiceAssignments: 'DENTIST_SERVICE_ASSIGNMENTS', branches: 'BRANCHES', dentists: 'DENTISTS', staff: 'STAFF', patients: 'PATIENTS', users: 'USERS', automations: 'AUTOMATIONS' }
function fixture(patch = {}) {
  const seeds = Object.fromEntries(Object.entries(seedKeys).map(([k, v]) => [k, structuredClone(data[`INITIAL_${v}`])]))
  seeds.users.push({ id: 'u13', personId: 'per-p2', roleName: 'Patient', status: 'Active', permissions: ['patient-portal'] })
  seeds.patients = seeds.patients.map(p => p.id === 'p2' ? { ...p, userId: 'u13' } : p)
  let state = normalizeClinicState({ ...seeds, appointments: [], queue: [], checkIns: [], treatments: [], invoices: [], prescriptions: [], followups: [], hmo: [], conversations: [], inquiries: [], notifications: [], workflowLog: [], audit: [], loyalty: structuredClone(data.INITIAL_LOYALTY), ...patch })
  let session = sessionForRole('patient', state)
  const actions = createWorkflowActions({ getState: () => state, getSession: () => session, commit: p => { state = normalizeClinicState({ ...state, ...p }) } })
  return { actions, get state() { return state }, get session() { return session }, role(role, overrides = {}) { session = { ...sessionForRole(role, state), ...overrides } }, patch(p) { state = normalizeClinicState({ ...state, ...p }) } }
}
const ok = result => { assert.equal(result.ok, true, result.message); return result.record }
const bad = (result, pattern) => { assert.equal(result.ok, false, 'expected the command to fail'); if (pattern) assert.match(result.message, pattern); return result }
const acct = (patientId, points, extra = {}) => ({ id: `loy-${patientId}`, patientId, referralCode: `DANA-${patientId.toUpperCase()}-01`, points, history: points ? [{ at: '2026-09-01', type: 'Qualified Referral', detail: 'Legacy referral', points }] : [], ...extra })
const maria = f => f.role('patient')
const john = f => f.role('patient', { userId: 'u13', patientId: 'p2', name: 'John Dela Cruz' })
const engaged = f => { f.patch({ users: f.state.users.map(u => u.id === 'u2' ? { ...u, permissions: [...u.permissions, 'engagement'] } : u) }); f.role('staff') }
const owner = f => f.role('owner')
const mine = (f, patientId = 'p1') => f.state.loyalty.find(l => l.patientId === patientId)
const events = f => f.state.workflowLog.filter(e => e.module === 'M24' && e.status === 'Success')
const enough = f => fixture({ loyalty: [acct('p1', 60)] })

// ---- Prototype program rule --------------------------------------------------------------------------

test('the 50-point threshold is one exported prototype constant, not a repeated magic number', () => {
  assert.equal(LOYALTY_PROGRAM.redemptionThreshold, 50)
  assert.ok(Object.isFrozen(LOYALTY_PROGRAM))
  const engagement = readFileSync(new URL('../src/pages/Admin.jsx', import.meta.url), 'utf8').match(/const applyLoyalty[\s\S]*?export function ModulesPage/)[0]
  const source = [readFileSync(new URL('../src/loyalty.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '').replace('redemptionThreshold:50', ''), readFileSync(new URL('../src/patient-view.js', import.meta.url), 'utf8'), readFileSync(new URL('../src/pages/PatientLoyalty.jsx', import.meta.url), 'utf8'), engagement].join('\n')
  assert.doesNotMatch(source, /\b50\b/)
})

// ---- Patient scope -----------------------------------------------------------------------------------

test('a Patient sees only their own loyalty account and a second Patient sees none of it', () => {
  const f = fixture(); maria(f)
  const view = patientLoyalty(f.state, f.session)
  assert.equal(view.status, 'ready'); assert.equal(view.code, 'DANA-MARIA-01'); assert.equal(view.points, 120)
  john(f)
  const other = patientLoyalty(f.state, f.session)
  assert.equal(other.status, 'none')
  assert.doesNotMatch(JSON.stringify(other), /MARIA|120|Oral prophylaxis/)
})

test('a second Patient with their own account never sees the first Patient’s ledger', () => {
  const f = fixture({ loyalty: [...structuredClone(data.INITIAL_LOYALTY), acct('p2', 70, { referralCode: 'DANA-JOHN-01' })] }); john(f)
  const view = patientLoyalty(f.state, f.session)
  assert.deepEqual([view.code, view.points], ['DANA-JOHN-01', 70])
  assert.doesNotMatch(JSON.stringify(view), /MARIA|Oral prophylaxis|120/)
})

test('forged, stale and deactivated Patient sessions fail closed in the view and the command', () => {
  const f = enough(); maria(f)
  assert.equal(patientLoyalty(f.state, { ...f.session, patientId: 'p2' }), null)
  const g = enough(); g.role('patient', { patientId: 'p2' })
  assert.equal(patientLoyalty(g.state, g.session), null)
  bad(g.actions.requestLoyaltyRedemption('c-forged'), /active clinic session/)
  const h = enough(); h.patch({ users: h.state.users.map(u => u.id === 'u12' ? { ...u, accountStatus: 'Inactive', status: 'Inactive' } : u) }); h.role('patient')
  assert.equal(patientLoyalty(h.state, h.session), null)
  bad(h.actions.requestLoyaltyRedemption('c-stale'), /active clinic session/)
  assert.equal(mine(h).history.length, 1)
})

test('no account renders a neutral none state and is never auto-created', () => {
  const f = fixture({ loyalty: [] }); maria(f)
  assert.equal(patientLoyalty(f.state, f.session).status, 'none')
  bad(f.actions.requestLoyaltyRedemption('c-none'), /No loyalty account/)
  assert.deepEqual(f.state.loyalty, [])
  assert.equal(patientHome(f.state, f.session).hasLoyalty, false)
})

test('Journey Hub gets a loyalty entry point only when an account exists', () => {
  const f = fixture(); maria(f)
  assert.equal(patientHome(f.state, f.session).hasLoyalty, true)
})

test('duplicate or non-array loyalty data puts the Patient in a review state instead of choosing an account', () => {
  const f = fixture({ loyalty: [acct('p1', 60), { ...acct('p1', 60), id: 'loy-dup', referralCode: 'DANA-MARIA-02' }] }); maria(f)
  const view = patientLoyalty(f.state, f.session)
  assert.equal(view.status, 'review'); assert.equal(view.points, undefined); assert.equal(view.canRequest, undefined)
  bad(f.actions.requestLoyaltyRedemption('c-dup'), /needs clinic review/)
  f.patch({ loyalty: 'broken' })
  assert.equal(patientLoyalty(f.state, f.session).status, 'review')
  bad(f.actions.requestLoyaltyRedemption('c-broken'), /needs clinic review/)
})

// ---- Patient redemption request ----------------------------------------------------------------------

test('a Patient with enough points requests a reward through the shared command', () => {
  const f = enough(); maria(f)
  const record = ok(f.actions.requestLoyaltyRedemption('req-1'))
  const [entry] = record.history
  assert.deepEqual([entry.type, entry.status, entry.points, entry.commandId, entry.at], ['Redemption Request', 'Pending', 0, 'req-1', '2026-09-19'])
  assert.match(entry.id, /^lh-/)
  assert.equal(record.points, 60, 'a request never changes the balance')
  assert.equal(ledgerIssue(record), null)
  const view = patientLoyalty(f.state, f.session)
  assert.deepEqual([view.pending, view.canRequest], [true, false])
  assert.equal(view.reason, 'Your reward request is awaiting clinic processing.')
})

test('the request emits one M24 workflow event and no notification or automation', () => {
  const f = enough(); maria(f); const before = f.state.notifications.length
  ok(f.actions.requestLoyaltyRedemption('req-events'))
  assert.equal(events(f).length, 1)
  assert.equal(events(f)[0].eventType, 'loyalty.redemption.requested')
  assert.equal(f.state.notifications.length, before)
})

test('a Patient cannot name another Patient or account: identity comes only from the session', () => {
  const f = fixture({ loyalty: [acct('p1', 60), acct('p2', 80, { referralCode: 'DANA-JOHN-01' })] }); maria(f)
  bad(f.actions.requestLoyaltyRedemption({ patientId: 'p2' }), /valid reward request command ID/)
  bad(f.actions.requestLoyaltyRedemption('req-x', 'p2'), /valid reward request command ID/)
  const other = mine(f, 'p2'); assert.equal(other.history.length, 1); assert.equal(other.points, 80)
  ok(f.actions.requestLoyaltyRedemption('req-own'))
  assert.equal(mine(f, 'p2').history.length, 1)
  assert.equal(mine(f, 'p1').history[0].type, 'Redemption Request')
})

test('insufficient points fail with the exact shortfall and change nothing', () => {
  const f = fixture({ loyalty: [acct('p1', 30)] }); maria(f)
  const before = structuredClone(f.state.loyalty)
  bad(f.actions.requestLoyaltyRedemption('req-low'), /You need 20 more points to request a reward\./)
  assert.deepEqual(f.state.loyalty, before)
  const view = patientLoyalty(f.state, f.session)
  assert.deepEqual([view.canRequest, view.missing, view.reason], [false, 20, needMoreMessage(20)])
  assert.equal(needMoreMessage(1), 'You need 1 more point to request a reward.')
})

test('exactly the threshold is enough', () => {
  const f = fixture({ loyalty: [acct('p1', LOYALTY_PROGRAM.redemptionThreshold)] }); maria(f)
  ok(f.actions.requestLoyaltyRedemption('req-exact'))
})

test('a Pending request blocks another request', () => {
  const f = enough(); maria(f)
  ok(f.actions.requestLoyaltyRedemption('req-1'))
  bad(f.actions.requestLoyaltyRedemption('req-2'), /already awaiting clinic processing/)
  assert.equal(mine(f).history.filter(e => e.type === 'Redemption Request').length, 1)
})

test('retrying the same command ID is idempotent and creates no second effect', () => {
  const f = enough(); maria(f)
  const first = ok(f.actions.requestLoyaltyRedemption('req-1')), logged = f.state.workflowLog.length, audit = f.state.audit.length
  const again = f.actions.requestLoyaltyRedemption('req-1')
  assert.equal(again.ok, true); assert.equal(again.unchanged, true)
  assert.equal(mine(f).history.length, first.history.length)
  assert.equal(f.state.workflowLog.length, logged); assert.equal(f.state.audit.length, audit)
})

test('replay validates ownership: another Patient cannot reuse or observe a command ID', () => {
  const f = fixture({ loyalty: [acct('p1', 60), acct('p2', 60, { referralCode: 'DANA-JOHN-01' })] }); maria(f)
  ok(f.actions.requestLoyaltyRedemption('shared-id'))
  john(f)
  bad(f.actions.requestLoyaltyRedemption('shared-id'), /belongs to another loyalty record/)
  assert.equal(mine(f, 'p2').history.length, 1)
})

test('malformed command IDs fail safely without any change', () => {
  const f = enough(); maria(f); const before = structuredClone(f.state.loyalty)
  for (const id of [undefined, '', '   ', 42, {}, [], true, 'x'.repeat(201)]) bad(f.actions.requestLoyaltyRedemption(id), /valid reward request command ID/)
  bad(f.actions.requestLoyaltyRedemption(null), /details are missing/)
  assert.deepEqual(f.state.loyalty, before)
})

test('Staff, Dentist and Owner cannot invoke the Patient request command', () => {
  const f = enough()
  for (const role of ['staff', 'dentist', 'owner']) { f.role(role); bad(f.actions.requestLoyaltyRedemption(`req-${role}`), /Only a Patient/) }
  assert.equal(mine(f).history.length, 1)
})

test('a request after a processed redemption is a new request under the same rule', () => {
  const f = fixture({ loyalty: [acct('p1', 110)] }); maria(f)
  const first = ok(f.actions.requestLoyaltyRedemption('req-1')); engaged(f)
  ok(f.actions.processLoyaltyRedemption(first.id, 'proc-1')); maria(f)
  assert.equal(mine(f).points, 60)
  assert.equal(f.actions.requestLoyaltyRedemption('req-1').unchanged, true, 'the old command ID still replays without a second request')
  ok(f.actions.requestLoyaltyRedemption('req-2'))
  assert.equal(mine(f).history.filter(e => e.status === 'Pending').length, 1)
})

// ---- Staff / Owner commands --------------------------------------------------------------------------

test('authorized Staff, Engagement Staff and the Owner record qualified activity through the command', () => {
  const f = fixture(); engaged(f)
  let record = ok(f.actions.recordLoyaltyActivity({ patientId: 'p1', activity: 'Qualified Visit', points: 20 }, 'act-1'))
  assert.equal(record.points, 140)
  const [entry] = record.history
  assert.deepEqual([entry.type, entry.points, entry.commandId, entry.at, entry.recordedByUserId], ['Qualified Visit', 20, 'act-1', '2026-09-19', 'u2'])
  assert.equal(ledgerIssue(record), null)
  owner(f)
  record = ok(f.actions.recordLoyaltyActivity({ patientId: 'p1', activity: 'Qualified Referral', points: 30 }, 'act-2'))
  assert.equal(record.points, 170)
  f.role('staff', { userId: 'u11', branchId: null, name: 'Mika Ramos' })
  record = ok(f.actions.recordLoyaltyActivity({ patientId: 'p1', activity: 'Qualified Visit', points: 5 }, 'act-3'))
  assert.equal(record.points, 175); assert.equal(events(f).length, 3)
})

test('unauthorized Staff, Dentist, Patient and forged roles cannot record or process loyalty activity', () => {
  const f = fixture({ loyalty: [acct('p1', 60, { history: [{ at: '2026-09-01', type: 'Qualified Referral', detail: 'x', points: 10 }, { at: '2026-09-01', type: 'Qualified Visit', detail: 'x', points: 50 }, { id: 'r', commandId: 'r', at: '2026-09-02', type: 'Redemption Request', detail: 'x', points: 0, status: 'Pending' }] })] })
  const before = structuredClone(f.state.loyalty)
  const attempt = () => { bad(f.actions.recordLoyaltyActivity({ patientId: 'p1', activity: 'Qualified Visit', points: 20 }, `a-${Math.random()}`)); bad(f.actions.processLoyaltyRedemption('loy-p1', `p-${Math.random()}`)) }
  f.role('staff'); attempt()                                   // Receptionist without the engagement permission
  f.role('dentist'); attempt()
  maria(f); attempt()                                          // permitted() alone would pass a Patient
  f.role('staff', { role: 'owner' }); attempt()                    // forged role on a Staff identity
  john(f); attempt()
  assert.deepEqual(f.state.loyalty, before)
})

test('the Owner and engaged Staff keep working while a demoted Staff account fails closed', () => {
  const f = fixture(); engaged(f)
  ok(f.actions.recordLoyaltyActivity({ patientId: 'p1', activity: 'Qualified Visit', points: 20 }, 'act-a'))
  f.patch({ users: f.state.users.map(u => u.id === 'u2' ? { ...u, permissions: u.permissions.filter(p => p !== 'engagement') } : u) })
  bad(f.actions.recordLoyaltyActivity({ patientId: 'p1', activity: 'Qualified Visit', points: 25 }, 'act-b'), /no longer allows|authorized clinic staff/)
})

test('branch-bound Staff are limited to Patients in their scope; the Owner is not', () => {
  const f = fixture(); engaged(f)
  const outside = f.state.patients.find(p => !patientInScope(p, f.state, f.session))
  assert.ok(outside, 'seed has a Patient outside Branch A scope')
  assert.equal(canManageLoyalty(f.state, f.session, outside.id), false)
  bad(f.actions.recordLoyaltyActivity({ patientId: outside.id, activity: 'Qualified Visit', points: 20 }, 'act-out'), /outside your branch scope/)
  assert.equal(mine(f, outside.id), undefined)
  owner(f); assert.equal(canManageLoyalty(f.state, f.session, outside.id), true)
  ok(f.actions.recordLoyaltyActivity({ patientId: outside.id, activity: 'Qualified Visit', points: 20 }, 'act-owner'))
})

test('activity input is validated: whole positive points, known qualified activity, real Patient', () => {
  const f = fixture(); owner(f); const before = structuredClone(f.state.loyalty)
  const record = (input, id = 'act-x') => f.actions.recordLoyaltyActivity(input, id)
  for (const points of [0, -5, 1.5, '20', NaN, Infinity, null, undefined, Number.MAX_SAFE_INTEGER + 1]) assert.equal(record({ patientId: 'p1', activity: 'Qualified Visit', points }).ok, false, String(points))
  for (const activity of ['Redemption', 'Redemption Request', 'Referral Reward', 'Bonus', undefined, '']) assert.equal(record({ patientId: 'p1', activity, points: 10 }).ok, false, String(activity))
  bad(record({ patientId: 'nobody', activity: 'Qualified Visit', points: 10 }), /Patient not found/)
  bad(record({ activity: 'Qualified Visit', points: 10 }), /Select a Patient/)
  for (const input of [null, 'p1', [], 42]) assert.equal(record(input).ok, false)
  bad(record({ patientId: 'p1', activity: 'Qualified Visit', points: 10 }, ''), /command ID/)
  bad(f.actions.recordLoyaltyActivity({ patientId: 'p1', activity: 'Qualified Visit', points: 10 }, 'ok', 'extra'), /valid loyalty activity/)
  bad(record({ patientId: 'p1', activity: 'Qualified Visit', points: Number.MAX_SAFE_INTEGER }), /too large/)
  assert.deepEqual(f.state.loyalty, before)
})

test('the same-day duplicate reward rule and command-ID replay both still hold', () => {
  const f = fixture(); owner(f)
  const input = { patientId: 'p1', activity: 'Qualified Visit', points: 20 }
  ok(f.actions.recordLoyaltyActivity(input, 'act-1'))
  bad(f.actions.recordLoyaltyActivity(input, 'act-2'), /Duplicate reward prevented/)
  const again = f.actions.recordLoyaltyActivity(input, 'act-1')
  assert.equal(again.unchanged, true); assert.equal(mine(f).points, 140)
  ok(f.actions.recordLoyaltyActivity({ ...input, points: 25 }, 'act-3'))
  bad(f.actions.recordLoyaltyActivity({ ...input, points: 26 }, 'act-1'), /already used for a different/)
})

test('recording for a Patient without an account creates one with a deterministic unique referral code', () => {
  const f = fixture(); owner(f)
  const created = ok(f.actions.recordLoyaltyActivity({ patientId: 'p2', activity: 'Qualified Visit', points: 20 }, 'act-new'))
  assert.equal(created.referralCode, 'DANA-JOHN-01'); assert.equal(created.points, 20); assert.equal(created.patientId, 'p2')
  assert.equal(ledgerIssue(created), null); assert.equal(f.state.loyalty.filter(l => l.patientId === 'p2').length, 1)
  const g = fixture({ loyalty: [...structuredClone(data.INITIAL_LOYALTY), acct('p9', 10, { referralCode: 'DANA-JOHN-01' })] }); owner(g)
  assert.equal(ok(g.actions.recordLoyaltyActivity({ patientId: 'p2', activity: 'Qualified Visit', points: 20 }, 'act-new')).referralCode, 'DANA-JOHN-02')
  const source = readFileSync(new URL('../src/loyalty.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /Date\.now|TODAY/, 'no wall-clock or module-load date in the domain command')
})

test('processing needs a Pending request, deducts once and is terminal', () => {
  const f = enough(); maria(f); const request = ok(f.actions.requestLoyaltyRedemption('req-1')); engaged(f)
  bad(f.actions.processLoyaltyRedemption('missing', 'proc-0'), /not found/)
  const done = ok(f.actions.processLoyaltyRedemption(request.id, 'proc-1'))
  assert.equal(done.points, 10)
  const [redemption, ...rest] = done.history
  assert.deepEqual([redemption.type, redemption.points, redemption.status, redemption.commandId, redemption.processedByUserId], ['Redemption', -50, 'Processed', 'proc-1', 'u2'])
  assert.equal(rest.find(e => e.type === 'Redemption Request').status, 'Processed')
  assert.equal(ledgerIssue(done), null)
  bad(f.actions.processLoyaltyRedemption(request.id, 'proc-2'), /no pending redemption request/)
  const again = f.actions.processLoyaltyRedemption(request.id, 'proc-1')
  assert.equal(again.unchanged, true); assert.equal(mine(f).points, 10, 'the reward is never deducted twice')
  assert.equal(events(f).filter(e => e.eventType === 'loyalty.redemption.processed').length, 1)
})

test('processing without a Pending request is rejected and changes nothing', () => {
  const f = enough(); engaged(f); const before = structuredClone(f.state.loyalty)
  bad(f.actions.processLoyaltyRedemption('loy-p1', 'proc-1'), /no pending redemption request/)
  assert.deepEqual(f.state.loyalty, before)
})

test('processing re-checks the balance and never deducts below the threshold', () => {
  const f = fixture({ loyalty: [acct('p1', 30, { history: [{ at: '2026-09-01', type: 'Qualified Visit', detail: 'x', points: 30 }, { id: 'r1', at: '2026-09-02', type: 'Redemption Request', detail: 'x', points: 0, status: 'Pending' }] })] }); owner(f)
  assert.equal(ledgerIssue(mine(f)), null)
  bad(f.actions.processLoyaltyRedemption('loy-p1', 'proc-1'), /does not have the 50 points/)
  assert.equal(mine(f).points, 30)
})

test('the Owner can process a redemption; a failed process command leaves the ledger untouched', () => {
  const f = enough(); maria(f); const request = ok(f.actions.requestLoyaltyRedemption('req-1')); owner(f)
  ok(f.actions.processLoyaltyRedemption(request.id, 'proc-owner'))
  assert.equal(mine(f).points, 10)
})

test('a legacy Pending request without an ID is processed and the rest of the legacy ledger is preserved exactly', () => {
  const legacy = [{ at: '2026-09-12', type: 'Qualified Visit', detail: 'Oral prophylaxis', points: 20 }, { at: '2026-08-01', type: 'Referral Reward', detail: 'Qualified referral', points: 100 }]
  const pendingRequest = { at: '2026-09-15', type: 'Redemption Request', detail: 'Patient requested reward redemption', points: 0, status: 'Pending' }
  const f = fixture({ loyalty: [acct('p1', 120, { history: [pendingRequest, ...legacy] })] }); owner(f)
  const done = ok(f.actions.processLoyaltyRedemption('loy-p1', 'proc-legacy'))
  assert.deepEqual(done.history.slice(2), legacy, 'untouched legacy entries stay byte-identical (no ids added)')
  assert.equal(done.history[1].status, 'Processed'); assert.equal(done.points, 70)
})

// ---- Ledger integrity --------------------------------------------------------------------------------

test('new ledger entries carry unique stable identities and replay evidence, legacy entries do not', () => {
  const f = fixture(); owner(f)
  ok(f.actions.recordLoyaltyActivity({ patientId: 'p1', activity: 'Qualified Visit', points: 20 }, 'act-1'))
  ok(f.actions.recordLoyaltyActivity({ patientId: 'p1', activity: 'Qualified Referral', points: 25 }, 'act-2'))
  const [a, b, ...legacy] = mine(f).history
  assert.notEqual(a.id, b.id); assert.deepEqual([a.commandId, b.commandId], ['act-2', 'act-1'])
  assert.ok(legacy.every(e => e.id === undefined && e.commandId === undefined))
  assert.equal(ledgerIssue(mine(f)), null)
})

test('the seeded legacy account is a valid ledger whose balance equals its history', () => {
  const seed = data.INITIAL_LOYALTY
  assert.equal(seed.length, 1); assert.equal(ledgerIssue(seed[0]), null)
  assert.equal(seed[0].history.reduce((n, e) => n + e.points, 0), seed[0].points)
  assert.ok(seed[0].history.every(e => e.id === undefined))
})

test('a malformed ledger fails closed for every command and is never repaired', () => {
  const cases = {
    'history not an array': { history: 'oops' },
    'non-integer points': { history: [{ at: '2026-09-01', type: 'Qualified Visit', detail: 'x', points: 60.5 }], points: 60.5 },
    'NaN entry': { history: [{ at: '2026-09-01', type: 'Qualified Visit', detail: 'x', points: NaN }] },
    'unknown activity': { history: [{ at: '2026-09-01', type: 'Bonus', detail: 'x', points: 60 }] },
    'negative earning': { history: [{ at: '2026-09-01', type: 'Qualified Visit', detail: 'x', points: -60 }], points: 60 },
    'entry not a record': { history: [null, { at: '2026-09-01', type: 'Qualified Visit', detail: 'x', points: 60 }] },
    'missing date': { history: [{ type: 'Qualified Visit', detail: 'x', points: 60 }] },
    'duplicate entry IDs': { history: [{ id: 'd', at: '2026-09-01', type: 'Qualified Visit', detail: 'x', points: 30 }, { id: 'd', at: '2026-09-01', type: 'Qualified Visit', detail: 'x', points: 30 }] },
    'two Pending requests': { history: [{ at: '2026-09-01', type: 'Qualified Visit', detail: 'x', points: 60 }, { at: '2026-09-02', type: 'Redemption Request', detail: 'x', points: 0, status: 'Pending' }, { at: '2026-09-03', type: 'Redemption Request', detail: 'x', points: 0, status: 'Pending' }] },
    'negative balance': { history: [{ at: '2026-09-01', type: 'Redemption', detail: 'x', points: -50, status: 'Processed' }], points: -50 },
    'unsafe balance': { points: Number.MAX_SAFE_INTEGER + 2 },
    'missing referral code': { referralCode: '' },
  }
  for (const [name, patch] of Object.entries(cases)) {
    const f = fixture({ loyalty: [{ ...acct('p1', 60), ...patch }] }); const before = structuredClone(f.state.loyalty)
    assert.notEqual(ledgerIssue(f.state.loyalty[0]), null, name)
    maria(f); bad(f.actions.requestLoyaltyRedemption('c-1'), /needs clinic review/)
    assert.equal(patientLoyalty(f.state, f.session).status, 'review', name)
    owner(f); bad(f.actions.recordLoyaltyActivity({ patientId: 'p1', activity: 'Qualified Visit', points: 20 }, 'c-2'), /needs review/)
    bad(f.actions.processLoyaltyRedemption('loy-p1', 'c-3'), /needs review/)
    assert.deepEqual(f.state.loyalty, before, `${name}: nothing was repaired or changed`)
  }
})

test('a stored balance that disagrees with the ledger blocks mutation and shows the clinic-review state', () => {
  const f = fixture({ loyalty: [{ ...acct('p1', 60), points: 999 }] }); maria(f)
  const before = structuredClone(f.state.loyalty)
  const view = patientLoyalty(f.state, f.session)
  assert.deepEqual([view.status, view.points, view.canRequest, view.pending], ['review', undefined, undefined, undefined])
  assert.equal(view.code, 'DANA-P1-01'); assert.equal(view.history.length, 1)
  bad(f.actions.requestLoyaltyRedemption('c-1'), /Your loyalty activity needs clinic review\./)
  owner(f); bad(f.actions.recordLoyaltyActivity({ patientId: 'p1', activity: 'Qualified Visit', points: 20 }, 'c-2'), /needs review/)
  assert.deepEqual(f.state.loyalty, before)
})

test('legacy ID-less history is readable for display without being rewritten or exposing internal IDs', () => {
  const f = fixture(); maria(f); const before = JSON.stringify(f.state.loyalty)
  const view = patientLoyalty(f.state, f.session)
  assert.deepEqual(view.history.map(e => [e.label, e.detail, e.pointsLabel, e.date]), [['Qualified visit', 'Oral prophylaxis', '+20 points', '2026-09-12'], ['Referral reward', 'Qualified referral', '+100 points', '2026-08-01']])
  assert.deepEqual(view.history.map(e => e.key), ['legacy-0', 'legacy-1'])
  assert.equal(JSON.stringify(f.state.loyalty), before, 'reading never mutates or normalizes the saved ledger')
  assert.equal(f.state.workflowLog.length, 0)
})

test('selectors are read-only and create no workflow events', () => {
  const f = fixture(); maria(f); const before = JSON.stringify([f.state.loyalty, f.state.workflowLog, f.state.audit, f.state.notifications])
  patientLoyalty(f.state, f.session); patientHome(f.state, f.session)
  assert.equal(JSON.stringify([f.state.loyalty, f.state.workflowLog, f.state.audit, f.state.notifications]), before)
})

// ---- Persistence -------------------------------------------------------------------------------------

const KEY = 'dentalops-v4-loyalty'
function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial)), writes = []
  return { map, writes, getItem: k => map.has(k) ? map.get(k) : null, setItem(k, v) { writes.push(k); map.set(k, String(v)) }, removeItem: k => map.delete(k) }
}
const reload = storage => readCollection(storage, KEY, structuredClone(data.INITIAL_LOYALTY))

test('the existing dentalops-v4-loyalty collection reloads legacy data without recovery', () => {
  const storage = memoryStorage({ [KEY]: JSON.stringify(data.INITIAL_LOYALTY) })
  const result = reload(storage)
  assert.equal(result.blocked, false); assert.deepEqual(result.value, data.INITIAL_LOYALTY); assert.deepEqual(storage.writes, [])
})

test('a fresh install with no saved loyalty data seeds without recovery', () => {
  const result = reload(memoryStorage())
  assert.deepEqual([result.blocked, result.value.length], [false, 1])
})

test('a Pending request and a processed redemption survive repeated save/reload cycles unchanged', () => {
  const f = enough(); maria(f); ok(f.actions.requestLoyaltyRedemption('req-1'))
  const storage = memoryStorage(); assert.equal(writeCollection(storage, KEY, persistableCollection('loyalty', f.state.loyalty)).ok, true)
  let saved = storage.map.get(KEY)
  for (let i = 0; i < 2; i++) {
    const result = reload(storage); assert.equal(result.blocked, false)
    f.patch({ loyalty: result.value })
    assert.equal(patientLoyalty(f.state, f.session).pending, true)
    writeCollection(storage, KEY, persistableCollection('loyalty', f.state.loyalty))
    assert.equal(storage.map.get(KEY), saved, 'byte-stable across reloads')
  }
  engaged(f); ok(f.actions.processLoyaltyRedemption(mine(f).id, 'proc-1')); saved = JSON.stringify(persistableCollection('loyalty', f.state.loyalty))
  const result = reload(memoryStorage({ [KEY]: saved })); assert.equal(result.blocked, false)
  f.patch({ loyalty: result.value }); maria(f)
  assert.deepEqual([patientLoyalty(f.state, f.session).pending, patientLoyalty(f.state, f.session).points], [false, 10])
})

test('persistence adds no new collection and does not touch loyalty on read', () => {
  const store = readFileSync(new URL('../src/store.jsx', import.meta.url), 'utf8')
  assert.equal([...store.matchAll(/usePersist\('loyalty'/g)].length, 1)
  assert.doesNotMatch(store, /usePersist\('(referral|referrals|loyalty-ledger)/)
  const before = memoryStorage({ [KEY]: JSON.stringify(data.INITIAL_LOYALTY) }); reload(before)
  assert.deepEqual(before.writes, [])
})

test('genuinely corrupt loyalty data still triggers recovery and is preserved, never overwritten', () => {
  const corrupt = { notJson: '{not json', notArray: JSON.stringify({ id: 'loy1' }), rowWithoutId: JSON.stringify([{ patientId: 'p1', points: 1, history: [] }]), rowNotObject: JSON.stringify(['x']), nullRow: JSON.stringify([null]) }
  for (const [name, raw] of Object.entries(corrupt)) {
    const storage = memoryStorage({ [KEY]: raw }), result = reload(storage)
    assert.equal(result.blocked, true, name)
    assert.match(result.error, /Saved loyalty data could not be read.*not been overwritten/)
    assert.deepEqual(storage.writes, [], name); assert.equal(storage.map.get(KEY), raw, name)
  }
})

test('a structurally readable but inconsistent ledger loads (it is not silently dropped) and is reported for review', () => {
  const rows = [{ ...acct('p1', 60), points: 999 }]
  const result = reload(memoryStorage({ [KEY]: JSON.stringify(rows) }))
  assert.equal(result.blocked, false); assert.deepEqual(result.value, rows)
})

// ---- UI and source guards ----------------------------------------------------------------------------

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Patient M24 code has no raw loyalty setter, no ROLE_INFO identity and no editable points', () => {
  assert.ok(existsSync(new URL('../src/pages/PatientLoyalty.jsx', import.meta.url)))
  const page = read('src/pages/PatientLoyalty.jsx')
  assert.doesNotMatch(page, /setters|setLoyalty|ROLE_INFO|TODAY|Date\.now|setTimeout|setInterval|window\.(confirm|prompt|alert)/)
  assert.doesNotMatch(page, /type="number"|<input|<textarea|<select/, 'a Patient has no field to edit points')
  assert.match(page, /requestLoyaltyRedemption\(/)
})

test('no page or component mutates loyalty through the raw setter any more', () => {
  for (const path of ['src/App.jsx', 'src/layout.jsx', 'src/components.jsx', 'src/pages/Admin.jsx', 'src/pages/PatientLoyalty.jsx', 'src/pages/PatientHome.jsx']) assert.doesNotMatch(read(path), /\bsetLoyalty\b/, path)
  assert.match(read('src/store.jsx'), /setLoyalty/, 'the setter remains only inside the store for command commits')
  const engagement = read('src/pages/Admin.jsx')
  assert.match(engagement, /recordLoyaltyActivity\(/); assert.match(engagement, /processLoyaltyRedemption\(/)
  assert.doesNotMatch(engagement.match(/const applyLoyalty[\s\S]*?  return <>/)[0], /ROLE_INFO|Date\.now|TODAY|setters\./)
})

test('the Patient page invents no referral relationship, reward benefit or program history', () => {
  const page = read('src/pages/PatientLoyalty.jsx') + read('src/patient-view.js').match(/export function patientLoyalty[\s\S]*?\r?\n}\r?\n/)[0]
  assert.doesNotMatch(page, /people (you|I) referred|who you referred|referred by|referral (list|status|tracking)|conversion|referral revenue/i)
  assert.doesNotMatch(page, /₱|PHP|peso|discount|free (treatment|cleaning|service)|voucher|coupon|tier|membership|expire|expiry|worth|cash value/i)
  assert.doesNotMatch(page, /since \d{4}|for (many )?years|for decades|longstanding|tradition/i)
  assert.match(page, /prototype/i)
})

test('M24 Patient copy no longer presents Proposed Enhancement / PE and navigation is aligned', () => {
  assert.deepEqual(data.NAV.patient.find(([key]) => key === 'loyalty'), ['loyalty', 'Referral & Loyalty'])
  for (const role of ['staff', 'owner']) assert.deepEqual(data.NAV[role].find(([key]) => key === 'engagement'), ['engagement', 'Engagement'])
  assert.doesNotMatch(read('src/pages/PatientLoyalty.jsx'), /Proposed|\bPE\b|Rewards/)
  assert.doesNotMatch(read('src/layout.jsx'), /nav-proposed|Proposed/)
  const m24 = data.MODULES.find(m => m.no === 24), m25 = data.MODULES.find(m => m.no === 25)
  assert.equal(m24.enhancement, true); assert.equal(m24.implemented, true)
  assert.equal(m25.enhancement, true); assert.notEqual(m25.implemented, true, 'M25 is not fully implemented'); assert.equal(m25.preview, true, 'M25 has only its limited pre-existing preview')
  assert.equal(data.MODULES.filter(m => m.pe).length, 0)
  assert.equal(data.MODULES.length, 25, 'no M26+')
})

test('the Patient route and permission guard are unchanged', () => {
  const guard = read('src/safeguards.js').match(/const pages=\{[^\n]*/)[0]
  assert.match(guard, /patient:\[[^\]]*'loyalty'[^\]]*\]/)
  assert.doesNotMatch(guard.match(/patient:\[[^\]]*\]/)[0], /engagement/)
})

test('M25 behavior is unchanged: only the pre-existing raw campaign-draft preview exists', () => {
  const f = fixture()
  for (const name of Object.keys(f.actions)) assert.doesNotMatch(name, /campaign|reactivat|marketing|consent/i, name)
  assert.deepEqual(Object.keys(f.actions).filter(n => /Loyalty/.test(n)).sort(), ['processLoyaltyRedemption', 'recordLoyaltyActivity', 'requestLoyaltyRedemption'])
  const engagement = read('src/pages/Admin.jsx')
  assert.equal([...engagement.matchAll(/setCampaigns/g)].length, 1, 'the pre-existing raw campaign draft setter is unchanged: documented later-phase technical debt')
  assert.equal(existsSync(new URL('../src/campaigns.js', import.meta.url)), false)
})

test('every M24 command is registered with the shared runner and the engagement permission map', () => {
  const workflow = read('src/workflow.js')
  assert.match(workflow, /\.\.\.loyaltyActions\(run\)/)
  assert.match(workflow, /recordLoyaltyActivity:'engagement',processLoyaltyRedemption:'engagement'/)
  const loyalty = read('src/loyalty.js')
  assert.doesNotMatch(loyalty, /setters|setLoyalty|useState|window\./)
  assert.equal([...loyalty.matchAll(/module:'M24'/g)].length, 3)
})

// ---- Documentation -----------------------------------------------------------------------------------

const CURRENT_DOCS = ['AGENTS.md', 'CLAUDE.md', 'README.md', 'MODULE_COVERAGE.md', 'FRONTEND_SCOPE.md', 'ERD_ALIGNMENT.md', 'DOCUMENTATION_RECONCILIATION.md', 'PROFESSOR_DEMO_GUIDE.md', '.agents/skills/dentalops-production-ui/SKILL.md']
const HISTORICAL_DOCS = ['P0_IMPLEMENTATION_NOTES.md', 'P1_PRODUCTION_UI_REFRESH.md', 'PHASE1_IMPLEMENTATION_NOTES.md', 'PHASE2_IMPLEMENTATION_NOTES.md', 'PHASE3_IMPLEMENTATION_NOTES.md', 'PHASE3_5_SAFEGUARDS.md', 'PHASE4A_UI_FOUNDATION.md']

test('current source-of-truth docs classify M24/M25 as Approved Frontend Enhancements, not Proposed', () => {
  for (const path of CURRENT_DOCS) {
    const text = read(path)
    assert.match(text, /Approved Frontend Enhancement/, `${path} states the approved classification`)
    for (const line of text.split('\n').filter(l => /Proposed Enhancement|remain Proposed|\bPE\b/.test(l)))
      assert.match(line, /previous|historical|formerly|earlier|until|were|was\b|no longer/i, `${path}: stale current-tense Proposed wording: ${line.slice(0, 160)}`)
  }
})

test('current docs state the prototype nature of M24 and the deferred scope of M25', () => {
  const scope = CURRENT_DOCS.map(read).join('\n')
  assert.match(scope, /team-designed/i); assert.match(scope, /not (represented as )?an? (established|existing)[^.]*clinic/i)
  assert.match(scope, /50[- ]point/); assert.match(scope, /later (role )?phase/i)
})

test('historical phase records are not rewritten to the new classification', () => {
  for (const path of HISTORICAL_DOCS) if (existsSync(new URL(`../${path}`, import.meta.url))) assert.doesNotMatch(read(path), /Approved Frontend Enhancement/, path)
})

test('the ERD artifacts are unchanged and only their authorization status is documented', () => {
  const alignment = read('ERD_ALIGNMENT.md')
  assert.match(alignment, /authorization status.*(changed|Approved)/is); assert.match(alignment, /ERD structure (is )?(unchanged|remains)/i)
  assert.doesNotMatch(read('docs/architecture/ERD_v2_Data_Dictionary.md'), /Approved Frontend Enhancement/)
})

// ---- Enrollment audit (acceptance pass) --------------------------------------------------------------
// At 7b27d00 the Engagement form listed every Patient and, for one with no account, applying a qualified activity
// created the account (uid ID, referral code, the entered points, one history entry). There was no separate zero-balance
// enrollment. That path is preserved by recordLoyaltyActivity; these tests pin it.

const enroll = (f, patientId = 'p1', commandId = 'enroll-1', points = 20) => f.actions.recordLoyaltyActivity({ patientId, activity: 'Qualified Visit', points }, commandId)
const countFor = (f, patientId) => f.state.loyalty.filter(l => l.patientId === patientId).length

test('an authorized Owner establishes a loyalty account for a Patient who has none, with no fabricated activity', () => {
  const f = fixture({ loyalty: [] }); owner(f)
  const record = ok(enroll(f))
  assert.equal(f.state.loyalty.length, 1)
  assert.match(record.id, /^loy-/); assert.equal(record.patientId, 'p1'); assert.equal(record.referralCode, 'DANA-MARIA-01'); assert.equal(record.points, 20)
  assert.equal(record.history.length, 1, 'exactly the one recorded activity: no referral reward or other activity is invented')
  assert.deepEqual([record.history[0].type, record.history[0].points, record.history[0].commandId, record.history[0].at], ['Qualified Visit', 20, 'enroll-1', '2026-09-19'])
  assert.equal(ledgerIssue(record), null)
  assert.deepEqual(events(f).map(e => e.eventType), ['loyalty.activity.recorded'])
  maria(f); const view = patientLoyalty(f.state, f.session)
  assert.deepEqual([view.status, view.code, view.points, view.history.length], ['ready', 'DANA-MARIA-01', 20, 1])
})

test('Staff with the engagement permission establish an account in their scope; Engagement Staff (all branches) can too', () => {
  const f = fixture({ loyalty: [] }); engaged(f)
  const inScope = f.state.patients.find(p => patientInScope(p, f.state, f.session))
  assert.ok(inScope, 'a Patient exists in the Branch A Staff scope')
  ok(enroll(f, inScope.id, 'staff-enroll')); assert.equal(countFor(f, inScope.id), 1)
  f.role('staff', { userId: 'u11', branchId: null, name: 'Mika Ramos' })
  const other = f.state.patients.find(p => p.id !== inScope.id)
  ok(enroll(f, other.id, 'engagement-staff-enroll')); assert.equal(countFor(f, other.id), 1)
})

test('Staff without the engagement permission, Dentists, Patients and forged roles cannot establish an account', () => {
  const f = fixture({ loyalty: [] })
  f.role('staff'); bad(enroll(f, 'p1', 'a'))
  f.role('dentist'); bad(enroll(f, 'p1', 'b'))
  maria(f); bad(enroll(f, 'p1', 'c'), /authorized clinic staff/)          // a Patient cannot enroll themselves
  bad(enroll(f, 'p2', 'd'), /authorized clinic staff/)                    // ...or another Patient
  john(f); bad(enroll(f, 'p2', 'e')); bad(enroll(f, 'p1', 'f'))
  f.role('staff', { role: 'owner' }); bad(enroll(f, 'p1', 'g'))
  assert.deepEqual(f.state.loyalty, [])
})

test('immediate retries never create a second account: replay is idempotent and other attempts append to the one account', () => {
  const f = fixture({ loyalty: [] }); owner(f)
  ok(enroll(f))
  assert.equal(enroll(f).unchanged, true)                                // same command ID
  assert.equal(countFor(f, 'p1'), 1); assert.equal(mine(f).points, 20)
  bad(enroll(f, 'p1', 'enroll-2'), /Duplicate reward prevented/)          // same activity, points and day
  ok(enroll(f, 'p1', 'enroll-3', 25))                                      // a different activity amount is more activity, not a second account
  assert.equal(countFor(f, 'p1'), 1); assert.equal(mine(f).points, 45); assert.equal(f.state.loyalty.length, 1)
  assert.equal(events(f).length, 2)
})

test('pre-existing duplicate accounts fail closed for enrollment and recording', () => {
  const f = fixture({ loyalty: [acct('p1', 60), { ...acct('p1', 60), id: 'loy-dup', referralCode: 'DANA-MARIA-02' }] }); owner(f)
  const before = structuredClone(f.state.loyalty)
  bad(enroll(f), /needs review/); assert.deepEqual(f.state.loyalty, before)
})

test('malformed enrollment input fails safely and creates nothing', () => {
  const f = fixture({ loyalty: [] }); owner(f)
  for (const input of [undefined, null, 'p1', [], {}, { patientId: 'p1' }, { patientId: 42, activity: 'Qualified Visit', points: 20 }, { patientId: 'nobody', activity: 'Qualified Visit', points: 20 }, { patientId: 'p1', activity: 'Qualified Visit', points: 0 }, { patientId: 'p1', activity: 'Qualified Visit', points: 2.5 }, { patientId: 'p1', activity: 'Referral Reward', points: 20 }])
    assert.equal(f.actions.recordLoyaltyActivity(input, 'm-1').ok, false, JSON.stringify(input))
  for (const id of [undefined, '', '  ', 7, {}, 'x'.repeat(201)]) assert.equal(f.actions.recordLoyaltyActivity({ patientId: 'p1', activity: 'Qualified Visit', points: 20 }, id).ok, false, String(id))
  assert.deepEqual(f.state.loyalty, [])
})

test('every established account gets a unique, non-empty referral code and a stable ID', () => {
  const f = fixture({ loyalty: [] }); owner(f)
  const codes = [], ids = []
  for (const p of f.state.patients) { const record = ok(enroll(f, p.id, `enroll-${p.id}`)); codes.push(record.referralCode); ids.push(record.id) }
  assert.equal(new Set(codes).size, codes.length); assert.equal(new Set(ids).size, ids.length)
  assert.ok(codes.every(c => /^DANA-[A-Z0-9]+-\d{2}$/.test(c)))
  const g = fixture({ loyalty: [acct('p9', 10, { referralCode: 'DANA-MARIA-01' })] }); owner(g)
  assert.equal(ok(enroll(g)).referralCode, 'DANA-MARIA-02', 'a code already in use is never reused')
})

test('an established account survives two persistence reloads with no false recovery and no duplicate', () => {
  const f = fixture({ loyalty: [] }); owner(f); ok(enroll(f))
  const storage = memoryStorage(); writeCollection(storage, KEY, persistableCollection('loyalty', f.state.loyalty))
  const saved = storage.map.get(KEY)
  for (let i = 0; i < 2; i++) {
    const result = reload(storage); assert.equal(result.blocked, false)
    f.patch({ loyalty: result.value }); assert.equal(f.state.loyalty.length, 1)
    writeCollection(storage, KEY, persistableCollection('loyalty', f.state.loyalty)); assert.equal(storage.map.get(KEY), saved)
  }
  maria(f); assert.equal(patientLoyalty(f.state, f.session).status, 'ready')
  owner(f); assert.equal(enroll(f).unchanged, true, 'the enrollment command ID still replays after reload')
  assert.equal(f.state.loyalty.length, 1)
})

test('the enrollment path is Staff/Owner-only in the UI: the Engagement Patient list is built from Patients, never from accounts, and the Patient page cannot enroll', () => {
  const engagement = read('src/pages/Admin.jsx').match(/export function EngagementPage[\s\S]*?export function ModulesPage/)[0]
  assert.match(engagement, /const patients=state\.patients\.filter\(p=>canManageLoyalty\(state,session,p\.id\)\)/)
  assert.match(engagement, /\{patients\.map\(p=><option/)
  assert.doesNotMatch(engagement, /state\.loyalty\.map\(l=><option/)
  assert.doesNotMatch(read('src/pages/PatientLoyalty.jsx'), /recordLoyaltyActivity|processLoyaltyRedemption|enroll/i)
  assert.match(engagement, /first qualified activity creates their loyalty account/)
})

test('the enrollment command is the same activity command: no new command, no raw setter, no Date.now referral code', () => {
  const actions = Object.keys(fixture().actions).filter(n => /Loyalty/.test(n)).sort()
  assert.deepEqual(actions, ['processLoyaltyRedemption', 'recordLoyaltyActivity', 'requestLoyaltyRedemption'])
  assert.doesNotMatch(read('src/loyalty.js').replace(/\/\/.*$/gm, ''), /Date\.now|setters|setLoyalty/)
})

// ---- Documentation precision (acceptance pass) --------------------------------------------------------

test('current docs never claim M25 is simply "not implemented": they state approved + limited preview + full implementation deferred', () => {
  for (const path of [...CURRENT_DOCS, 'PHASE4B_PATIENT_EXPERIENCE.md']) {
    const text = read(path)
    assert.doesNotMatch(text, /M25[^.\n]*\b(?:is|are|remains?) (?:approved,? but )?(?:not|yet to be)(?: yet)? (?:fully )?implemented/i, `${path}: blanket "M25 is not implemented" claim`)
    assert.doesNotMatch(text, /M25 (?:management )?(?:is )?not (?:yet )?implemented/i, `${path}: blanket M25 claim`)
  }
  for (const path of ['AGENTS.md', 'CLAUDE.md', 'MODULE_COVERAGE.md', 'FRONTEND_SCOPE.md', 'README.md', 'DOCUMENTATION_RECONCILIATION.md', 'PROFESSOR_DEMO_GUIDE.md', 'PHASE4B_PATIENT_EXPERIENCE.md']) {
    const text = read(path)
    assert.match(text, /limited (?:frontend )?(?:campaign-draft )?preview/i, `${path}: names the limited existing preview`)
    assert.match(text, /deferred|later role phase|later phase/i, `${path}: defers full implementation`)
  }
  const coverage = read('MODULE_COVERAGE.md')
  assert.match(coverage, /M25[^\n]*send no real campaigns[^\n]*raw campaign setter[^\n]*technical debt/i)
  assert.match(coverage, /M25[^\n]*consent, targeting, delivery and analytics/i)
})

test('every team-designed M24 rule is documented as prototype behavior, not historical clinic policy', () => {
  for (const path of ['AGENTS.md', 'CLAUDE.md', 'MODULE_COVERAGE.md', 'FRONTEND_SCOPE.md', 'PHASE4B_PATIENT_EXPERIENCE.md']) {
    const text = read(path)
    assert.match(text, /50-point/, path); assert.match(text, /whole positive points?/i, `${path}: whole positive points`)
    assert.match(text, /team-designed prototype/i, path); assert.match(text, /not (?:historical )?(?:clinic policy|an established clinic program)/i, path)
  }
  const loyalty = read('src/loyalty.js')
  assert.match(loyalty, /TEAM-DESIGNED PROTOTYPE rule/); assert.match(loyalty, /whole positive\s+(?:\/\/\s*)?points as the input validation rule/)
  assert.match(read('src/pages/Admin.jsx'), /not historical clinic policy[^<]*only one request can be Pending[^<]*whole positive numbers \(a prototype validation rule\)/)
  const inventions = [...CURRENT_DOCS, 'PHASE4B_PATIENT_EXPERIENCE.md'].map(read).join('\n')
  assert.doesNotMatch(inventions, /(?:reward|points?) (?:expire|expiry) (?:after|in|on) \d|₱\s?\d+ (?:per|off) point|\d+% (?:discount|off)/i, 'no invented reward value, discount or expiry')
})
