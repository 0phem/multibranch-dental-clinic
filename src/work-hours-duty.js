// Presentation only. The work-schedule API's dated, branch-scoped projection is authoritative.
export function dutyForBranch(duty, dentistId, branchId, today) {
  if (duty?.date !== today || !Array.isArray(duty?.rows)) return 'unknown'
  const row = duty.rows.find(item => item.dentist_id === dentistId && item.branch_id === branchId)
  return row?.on_duty_today === true ? 'on' : row?.on_duty_today === false ? 'off' : 'unknown'
}
