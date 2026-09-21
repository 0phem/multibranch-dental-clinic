// Do not overwrite unreadable saved data with demo seeds on the next effect.
export function readCollection(storage,key,seed) {
  try {
    const saved=storage.getItem(key)
    if(saved===null)return {value:seed,blocked:false,error:null}
    const parsed=JSON.parse(saved)
    if(!Array.isArray(parsed)||parsed.some(row=>!row||typeof row!=='object'||Array.isArray(row)||typeof row.id!=='string'||!row.id.trim()))throw new Error('Invalid collection')
    return {value:parsed,blocked:false,error:null}
  }catch{return {value:seed,blocked:true,error:`Saved ${key.replace('dentalops-v4-','')} data could not be read. It has not been overwritten. Recover the saved data before continuing.`}}
}
export function writeCollection(storage,key,value) {
  try{storage.setItem(key,JSON.stringify(value));return {ok:true}}
  catch{return {ok:false,message:'Changes are only in this open workspace because browser storage is unavailable or full. Do not refresh until storage is available.'}}
}
