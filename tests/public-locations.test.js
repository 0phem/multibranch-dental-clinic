import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'
import { build } from 'esbuild'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { clinic } from '../src/clinic-config.js'
import { clinicMapOptions } from '../src/clinic-map-options.js'
import { publicSections } from '../src/public-route.js'
const require=createRequire(import.meta.url)
const bundle=await build({entryPoints:['src/pages/PublicLocations.jsx'],bundle:true,write:false,platform:'node',format:'esm',loader:{'.css':'empty'},plugins:[{name:'react',setup(b){b.onResolve({filter:/^react$/},()=>({path:pathToFileURL(require.resolve('react')).href,external:true}))}}]})
const {PublicLocations}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))
const html=renderToStaticMarkup(React.createElement(PublicLocations))

test('three unique public branch records preserve exact supplied names and addresses',()=>{
  assert.equal(clinic.branches.length,3)
  assert.equal(new Set(clinic.branches.map(b=>b.id)).size,3)
  assert.deepEqual(clinic.branches.map(b=>[b.number,b.name,b.address]),[
    ['01','Dr. Dana Roxas Dental Clinic','#37, MacArthur Hwy, Bocaue, 3018 Bulacan'],
    ['02','Roxas - Cardinal Dental Center','67 MacArthur Hwy, Wakas, Bocaue, 3018 Bulacan'],
    ['03','Roxas Dental Clinic Guiguinto','Unit 20 GD Plaza, Guiguinto, Bulacan'],
  ])
})
test('place coordinates retain recorded mapping evidence, without moving adjacent Bocaue pins',()=>{
  assert.deepEqual(clinic.branches.map(b=>[b.latitude,b.longitude]),[
    [14.800254,120.9233274],[14.7996762,120.9234564],[14.8284409,120.8745988],
  ])
  for(const b of clinic.branches)assert.match(b.source,/^https:\/\/www.google.com\/maps\?cid=\d+$/)
})
test('map disables every interaction handler and control',()=>{
  for(const key of ['dragging','scrollWheelZoom','doubleClickZoom','boxZoom','keyboard','touchZoom','tapHold','zoomControl'])assert.equal(clinicMapOptions[key],false,key)
})
test('semantic addresses render before map loading and remain outside its hidden canvas',()=>{
  assert.equal((html.match(/<address>/g)||[]).length,3)
  assert.equal((html.match(/class="site-branch-card"/g)||[]).length,3)
  assert.match(html,/class="site-map-canvas" aria-hidden="true"><\/div>/)
  for(const b of clinic.branches){assert.ok(html.includes(b.name));assert.ok(html.includes(b.address))}
  assert.match(html,/OpenStreetMap contributors/)
  assert.ok(publicSections.has('locations'))
})
test('landing map has an isolated lazy import, failure state and teardown; no operational branch data',()=>{
  const section=readFileSync('src/pages/PublicLocations.jsx','utf8'),map=readFileSync('src/clinic-map.js','utf8')
  assert.match(section,/IntersectionObserver/)
  assert.match(section,/if\(!near\)return/)
  assert.match(section,/import\('\.\.\/clinic-map.js'\)/)
  assert.match(section,/\.catch\(\(\)=>\{if\(active\)setStatus\('error'\)\}\)/)
  assert.match(section,/Map unavailable/)
  assert.match(map,/tiles.on\('tileerror',fail\)/)
  assert.match(map,/resizeObserver\?\.disconnect\(\)/)
  assert.match(map,/map.remove\(\)/)
  assert.match(map,/L.marker\(\[branch.latitude,branch.longitude\]/)
  assert.doesNotMatch(section+map,/useClinic|api-client|StartupLoading/)
})
