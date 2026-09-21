import { dentistServiceAssignmentId } from './data.js'

const ASSIGNMENTS_KEY='dentalops-v4-dentist-service-assignments'
const text=value=>typeof value==='string'&&!!value.trim()
const isRow=row=>!!row&&typeof row==='object'&&!Array.isArray(row)

// Assignments saved before they had a canonical ID hold only the Dentist/Service pair. Derive the
// ID from that pair. Rows that already have an `id` are untouched; anything else malformed falls
// through to the normal recovery check rather than being repaired or dropped.
function withAssignmentIds(rows) {
  if(!Array.isArray(rows))return rows
  return rows.map(row=>isRow(row)&&!('id' in row)&&text(row.dentistId)&&text(row.serviceId)?{id:dentistServiceAssignmentId(row.dentistId,row.serviceId),...row}:row)
}
// A Dentist may hold a Service at most once, and IDs must be unique. Duplicates or ambiguous IDs are
// not guessed at or merged; they need recovery.
function validAssignments(rows) {
  const ids=new Set(),pairs=new Set()
  return rows.every(row=>{
    const pair=JSON.stringify([row.dentistId,row.serviceId])
    const valid=text(row.dentistId)&&text(row.serviceId)&&(row.isAuthorized===undefined||typeof row.isAuthorized==='boolean')&&!ids.has(row.id)&&!pairs.has(pair)
    ids.add(row.id);pairs.add(pair)
    return valid
  })
}

// Do not overwrite unreadable saved data with demo seeds on the next effect.
export function readCollection(storage,key,seed) {
  try {
    const saved=storage.getItem(key)
    if(saved===null)return {value:seed,blocked:false,error:null}
    const parsed=JSON.parse(saved)
    const rows=key===ASSIGNMENTS_KEY?withAssignmentIds(parsed):parsed
    if(!Array.isArray(rows)||rows.some(row=>!row||typeof row!=='object'||Array.isArray(row)||typeof row.id!=='string'||!row.id.trim())||key===ASSIGNMENTS_KEY&&!validAssignments(rows))throw new Error('Invalid collection')
    return {value:rows,blocked:false,error:null}
  }catch{return {value:seed,blocked:true,error:`Saved ${key.replace('dentalops-v4-','')} data could not be read. It has not been overwritten. Recover the saved data before continuing.`}}
}
export function writeCollection(storage,key,value) {
  try{storage.setItem(key,JSON.stringify(value));return {ok:true}}
  catch{return {ok:false,message:'Changes are only in this open workspace because browser storage is unavailable or full. Do not refresh until storage is available.'}}
}
