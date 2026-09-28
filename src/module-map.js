// Stable domain keys are the durable identity of recorded workflow/audit events and automation targets.
// Module numbers are presentation metadata derived from the current 25-module structure, so renumbering
// never rewrites what a stored record means. A multi-step handoff is written as 'treatment→hmo'.
export const DOMAIN_MODULE={
  identity:1,branch:2,personnel:3,patient:4,treatment:5,appointment:6,assistant:7,checkin:8,queue:9,capacity:10,
  billing:11,hmo:12,service:13,document:14,configuration:15,inquiry:16,messaging:17,notification:18,
  prescription:19,followup:20,analytics:21,audit:22,automation:23,loyalty:24,campaign:25,
}

// Records written before the canonical restructure stored module numbers from the OLD structure. They are read
// through this fixed table, never through current numbering: old M13/M14 were HMO request/follow-up (now M12),
// old M7 was Smart Scheduling (now M6), old M15 was workload (now M10) and old M22 was the dashboard (now M21).
export const LEGACY_MODULE_DOMAIN={
  1:'identity',2:'branch',3:'personnel',4:'patient',5:'treatment',6:'appointment',7:'appointment',8:'checkin',
  9:'queue',10:'capacity',11:'billing',12:'hmo',13:'hmo',14:'hmo',15:'capacity',16:'inquiry',17:'messaging',
  18:'notification',19:'prescription',20:'followup',21:'analytics',22:'analytics',23:'automation',24:'loyalty',25:'campaign',
}

const distinct=values=>values.filter((value,index)=>value!==values[index-1])

export function legacyModuleDomains(tag) {
  return distinct([...String(tag||'').matchAll(/M(\d+)/g)].map(match=>LEGACY_MODULE_DOMAIN[Number(match[1])]).filter(Boolean))
}

export function recordDomains(record) {
  if(typeof record?.domain==='string'&&record.domain)return record.domain.split('→').filter(domain=>DOMAIN_MODULE[domain])
  return legacyModuleDomains(record?.module)
}

export function moduleLabel(domains,separator='→') {
  return distinct((domains||[]).map(domain=>DOMAIN_MODULE[domain]).filter(Boolean)).map(no=>`M${no}`).join(separator)
}

export const eventModuleLabel=record=>moduleLabel(recordDomains(record))||'—'
export const ruleTargetLabel=rule=>moduleLabel(Array.isArray(rule?.targetDomains)?rule.targetDomains:legacyModuleDomains(rule?.targetModule),' / ')||'—'
