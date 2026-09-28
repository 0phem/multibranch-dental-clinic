import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createUserAccountRemote, fetchUserAccounts, updateUserAccountRemote } from '../src/user-management-bridge.js'
import { __resetCsrfCacheForTests } from '../src/api-client.js'

const source=readFileSync(new URL('../src/user-management-bridge.js',import.meta.url),'utf8')

test('User Management fetches a separate backend account collection and maps human fields',async()=>{
  const oldFetch=globalThis.fetch
  globalThis.fetch=async(url)=>new Response(JSON.stringify({data:[{id:'01jexampleuserpublicid0000',first_name:'Jamie',last_name:'Cruz',email:'jamie@example.com',phone:'+639171234567',role:'patient'}]}),{status:200,headers:{'Content-Type':'application/json'}})
  try {
    const result=await fetchUserAccounts()
    assert.equal(result.ok,true)
    assert.deepEqual(result.records[0],{id:'01jexampleuserpublicid0000',name:'Jamie Cruz',firstName:'Jamie',lastName:'Cruz',email:'jamie@example.com',phone:'+639171234567',role:'patient'})
  } finally { globalThis.fetch=oldFetch }
})

test('create and update bridge payloads never send role, title or password during update',()=>{
  assert.match(source,/first_name: form\.firstName/)
  assert.match(source,/password_confirmation: form\.passwordConfirmation/)
  const update=source.split('export async function updateUserAccountRemote')[1]
  assert.doesNotMatch(update,/role|title|password/i)
})

test('account update bridge sends only editable identity fields',async()=>{
  const oldFetch=globalThis.fetch
  const calls=[]
  globalThis.fetch=async(url,options={})=>{
    calls.push({url,options})
    if(String(url).endsWith('/sanctum/csrf-cookie'))return new Response(null,{status:204})
    return new Response(JSON.stringify({data:{id:'01jexampleuserpublicid0000',first_name:'Jamie',last_name:'Cruz',email:'jamie@example.com',phone:null,role:'patient'}}),{status:200,headers:{'Content-Type':'application/json'}})
  }
  try {
    __resetCsrfCacheForTests()
    const result=await updateUserAccountRemote('01jexampleuserpublicid0000',{firstName:'Jamie',lastName:'Cruz',email:'jamie@example.com',phone:''})
    assert.equal(result.ok,true)
    const patch=calls.find(c=>c.options.method==='PATCH')
    assert.match(String(patch.url),/\/api\/users\/01jexampleuserpublicid0000$/,'the account is addressed by its public id')
    const body=JSON.parse(patch.options.body)
    assert.deepEqual(body,{first_name:'Jamie',last_name:'Cruz',email:'jamie@example.com',phone:null})
  } finally { globalThis.fetch=oldFetch; __resetCsrfCacheForTests() }
})
