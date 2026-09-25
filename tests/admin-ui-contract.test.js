import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source=readFileSync(new URL('../src/pages/Admin.jsx',import.meta.url),'utf8')
const administration=readFileSync(new URL('../src/administration.js',import.meta.url),'utf8')
const users=source.match(/export function UsersPage[\s\S]*?export function ModulesPage/)[0]
const team=source.match(/export function TeamPage[\s\S]*?export function AnalyticsPage/)[0]

test('M1 User Management exposes canonical creation roles only',()=>{
  assert.match(users,/title="User Management"/)
  assert.match(users,/value="patient"/)
  assert.match(users,/Staff \(temporarily unavailable\)/)
  assert.match(users,/Dentist \(temporarily unavailable\)/)
  assert.doesNotMatch(users,/Owner.*option|value="owner"/)
})

test('Create Account form has no Username or Branch Scope field and Owner is not a creation option',()=>{
  const createCard=users.split('title="Create user account"')[1].split('</Card>')[0]
  assert.doesNotMatch(createCard,/label="Username"/)
  assert.doesNotMatch(createCard,/label="Branch scope"/i)
  assert.doesNotMatch(createCard,/Owner/)
})

test('Patient is selectable/creatable while Staff and Dentist are visible but disabled',()=>{
  assert.match(users,/option value="patient">Patient/)
  assert.match(users,/option value="staff" disabled/)
  assert.match(users,/option value="dentist" disabled/)
})

test('account creation defaults status through the existing action and does not ask for status',()=>{
  assert.doesNotMatch(users,/label="Account status"/)
  assert.match(users,/Initial Password/)
  assert.match(users,/Confirm Password/)
  assert.doesNotMatch(users,/Temporary Password/)
  assert.doesNotMatch(users,/actions\.createUserAccount/)
})

test('User Management has no unsupported account or personnel fields',()=>{
  for(const label of ['Username','Middle Name','Branch Scope','Staff title','License Number','Specialty','Specialization'])assert.doesNotMatch(users,new RegExp(`label="${label}`))
  assert.match(users,/Edit/)
  assert.match(users,/Delete/)
  assert.match(users,/Role and personnel information are read-only/)
})

test('Owner and Patient identity forms contain only first and last name',()=>{
  assert.doesNotMatch(users,/Middle Name|middleName|middle_name/)
  const registration=readFileSync(new URL('../src/pages/PatientRegister.jsx',import.meta.url),'utf8')
  assert.doesNotMatch(registration,/Middle Name|middleName|middle_name/)
  assert.match(registration,/first_name/)
  assert.match(registration,/last_name/)
  assert.doesNotMatch(administration,/middleName|middle_name/)
})

test('Owner-facing copy does not expose schema identifiers',()=>{
  for(const label of ['BRANCH_SERVICES','STAFF_PROFILES','user_id','staff_type','license_no','specialization','PERSONS','USERS','PATIENTS\.patient_code']){
    assert.doesNotMatch(source,new RegExp(label),label)
  }
  assert.match(source,/Branch services/)
  assert.match(team,/License Number • Specialty • Linked Account/)
})

test('Staff editor remains separate from Dentist-only fields',()=>{
  assert.match(team,/label="Staff title"/)
  const staff=team.split('title="Edit staff profile"')[1].split('</Modal>')[0]
  assert.doesNotMatch(staff,/License Number|Specialty|licenseNo|specialization/)
})

test('Owner phone control has a fixed country code and bounded numeric input',()=>{
  assert.match(users,/phone-field-code[^>]*aria-hidden="true"[^>]*>\{DEFAULT_COUNTRY\.dial\}/)
  assert.match(users,/type="tel" inputMode="numeric" aria-label="Mobile number"/)
  assert.match(users,/maxLength=\{DEFAULT_COUNTRY\.digits\}/)
  assert.match(users,/sanitizePhoneInput\(e\.target\.value\)/)
})

test('User Management edit keeps the phone contract and role read-only',()=>{
  const edit=users.split('title="Edit user account"')[1].split('</Modal>')[0]
  assert.match(edit,/maxLength=\{DEFAULT_COUNTRY\.digits\}/)
  assert.match(edit,/value=\{editPhoneLocal\}/)
  assert.match(users,/normalizePhoneNumber\(DEFAULT_COUNTRY\.dial,editPhoneLocal\)/)
  assert.match(edit,/Role cannot be changed from User Management\./)
  assert.match(edit,/readOnly disabled/)
})
