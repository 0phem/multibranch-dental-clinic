import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { clinic, loadPublicBranches } from '../src/clinic-config.js'
import { clinicMapOptions } from '../src/clinic-map-options.js'
import { publicSections } from '../src/public-route.js'
const require=createRequire(import.meta.url)
const bundle=await build({entryPoints:['src/pages/PublicLocations.jsx'],bundle:true,write:false,platform:'node',format:'esm',loader:{'.css':'empty'},plugins:[{name:'react',setup(b){b.onResolve({filter:/^react$/},()=>({path:pathToFileURL(require.resolve('react')).href,external:true}))}}]})
const {LocationMap}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))
const html=renderToStaticMarkup(React.createElement(LocationMap,{branches:[{id:'b1',number:'01',name:'Branch record 1',address:'Address 1, Bulacan',latitude:14.8,longitude:120.9}]}))

test('the website keeps no branch list: names, addresses and pins come from GET /api/public/branches',async()=>{
  assert.equal(clinic.branches,undefined)
  const config=readFileSync('src/clinic-config.js','utf8')
  for(const fact of ['MacArthur','GD Plaza','14.80','120.92'])assert.ok(!config.includes(fact),fact)
  const original=globalThis.fetch
  try{
    globalThis.fetch=async url=>{assert.match(String(url),/\/api\/public\/branches$/);return new Response(JSON.stringify({data:[{id:'b1',number:'01',name:'Dr. Dana Roxas Dental Clinic',address:'#37, MacArthur Hwy, Bocaue, 3018 Bulacan',latitude:14.800254,longitude:120.9233274}]}),{status:200})}
    const ok=await loadPublicBranches()
    assert.equal(ok.ok,true);assert.deepEqual(ok.branches.map(b=>[b.number,b.name,b.latitude]),[['01','Dr. Dana Roxas Dental Clinic',14.800254]])
    globalThis.fetch=async()=>{throw new Error('offline')}
    assert.deepEqual(await loadPublicBranches(),{ok:false,branches:[]})
  }finally{globalThis.fetch=original}
})
test('place coordinates keep their public mapping evidence in the docs and the branch seeder',()=>{
  const doc=readFileSync('docs/BRANCH_LOCATIONS.md','utf8'),seeder=readFileSync('backend/database/seeders/RealBranchSeeder.php','utf8')
  for(const [lat,lng] of [['14.800254','120.9233274'],['14.7996762','120.9234564'],['14.8284409','120.8745988']]){assert.ok(doc.includes(lat)&&doc.includes(lng));assert.ok(seeder.includes(lat)&&seeder.includes(lng))}
  assert.equal((doc.match(/https:\/\/www.google.com\/maps\?cid=\d+/g)||[]).length,3)
})
test('map disables every interaction handler and control',()=>{
  for(const key of ['dragging','scrollWheelZoom','doubleClickZoom','boxZoom','keyboard','touchZoom','tapHold','zoomControl'])assert.equal(clinicMapOptions[key],false,key)
})
test('the map canvas is hidden from assistive technology, credits OpenStreetMap, and the branches section is a landing anchor',()=>{
  assert.match(html,/class="site-map-canvas" aria-hidden="true"><\/div>/)
  assert.match(html,/OpenStreetMap contributors/)
  assert.match(html,/1 location/)
  assert.ok(publicSections.has('branches'))
  assert.match(readFileSync('src/pages/PublicSite.jsx','utf8'),/can’t be shown right now\. Call/)
})
test('landing map has an isolated lazy import, failure state and teardown; no operational branch data',()=>{
  const section=readFileSync('src/pages/PublicLocations.jsx','utf8'),map=readFileSync('src/clinic-map.js','utf8')
  assert.match(section,/IntersectionObserver/)
  assert.match(section,/if\(!near\|\|!pinned.length\)return/)
  assert.match(section,/import\('\.\.\/clinic-map.js'\)/)
  assert.match(section,/\.catch\(\(\)=>\{if\(active\)setStatus\('error'\)\}\)/)
  assert.match(section,/Map unavailable/)
  assert.match(map,/tiles.on\('tileerror',fail\)/)
  assert.match(map,/resizeObserver\?\.disconnect\(\)/)
  assert.match(map,/map.remove\(\)/)
  assert.match(map,/L.marker\(\[branch.latitude,branch.longitude\]/)
  assert.doesNotMatch(section+map,/useClinic|api-client|StartupLoading/)
})
