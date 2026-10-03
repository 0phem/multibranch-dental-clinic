import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { clinicMapOptions } from './clinic-map-options.js'

// Imported only as the locations section approaches the viewport. No geocoding.
export function mountClinicMap(container, branches, onReady, onError) {
  const map=L.map(container,clinicMapOptions)
  let timer,resizeObserver,disposed=false
  const destroy=()=>{
    disposed=true
    clearTimeout(timer)
    resizeObserver?.disconnect()
    map.remove()
  }
  try {
    const bounds=L.latLngBounds(branches.map(b=>[b.latitude,b.longitude]))
    const fit=()=>{
      map.invalidateSize({pan:false})
      map.fitBounds(bounds,{padding:[70,90],maxZoom:14,animate:false})
    }
    fit()
    const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:19,keepBuffer:0,
    })
    const fail=()=>{if(!disposed){clearTimeout(timer);onError()}}
    timer=setTimeout(fail,12000)
    tiles.on('tileerror',fail)
    tiles.on('load',()=>{if(!disposed){clearTimeout(timer);onReady()}})
    tiles.addTo(map)
    for(const branch of branches){
      // The dot is anchored to the exact place coordinate. Only the numbered label
      // and its leader line move to keep the adjacent Bocaue locations readable.
      const content=document.createElement('span')
      content.className=`clinic-pin pin-${branch.number}`
      const dot=document.createElement('i')
      const label=document.createElement('b')
      label.textContent=branch.number
      content.append(dot,label)
      L.marker([branch.latitude,branch.longitude],{
        interactive:false,keyboard:false,
        icon:L.divIcon({className:'clinic-map-marker',html:content,iconSize:[0,0],iconAnchor:[0,0]}),
      }).addTo(map)
    }
    resizeObserver=new ResizeObserver(fit)
    resizeObserver.observe(container)
    return destroy
  } catch(error) {
    destroy()
    throw error
  }
}
