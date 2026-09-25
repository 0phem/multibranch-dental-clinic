import * as api from './api-client.js'

export function mapUserAccount(row) {
  return {
    id: row.id,
    personId: row.person_id,
    name: row.name || [row.first_name, row.last_name].filter(Boolean).join(' '),
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    email: row.email || '',
    phone: row.phone || '',
    role: row.role,
  }
}

export async function fetchUserAccounts() {
  const result = await api.listUserAccounts()
  return result.ok ? { ok: true, records: (result.data || []).map(mapUserAccount) } : result
}

export async function createUserAccountRemote(form) {
  const result = await api.createUserAccountRemote({
    first_name: form.firstName,
    last_name: form.lastName,
    email: form.email,
    phone: form.phone || null,
    role: form.role,
    password: form.password,
    password_confirmation: form.passwordConfirmation,
  })
  return result.ok ? { ok: true, record: mapUserAccount(result.data) } : result
}

export async function updateUserAccountRemote(id, form) {
  const result = await api.updateUserAccountRemote(id, {
    first_name: form.firstName,
    last_name: form.lastName,
    email: form.email,
    phone: form.phone || null,
  })
  return result.ok ? { ok: true, record: mapUserAccount(result.data) } : result
}

export async function deleteUserAccountRemote(id) {
  return api.deleteUserAccountRemote(id)
}
