import React, { useEffect, useRef, useState } from 'react'

export function LocationMap({ branches = [] }) {
  const frame=useRef(null),canvas=useRef(null)
  const [status,setStatus]=useState('waiting')
  const [near,setNear]=useState(false)
  useEffect(()=>{
    if(!('IntersectionObserver' in window)){setNear(true);return}
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){setNear(true);observer.disconnect()}
    },{rootMargin:'240px'})
    observer.observe(frame.current)
    return()=>observer.disconnect()
  },[])
  const pinned=branches.filter(b=>b.latitude!==null&&b.longitude!==null)
  useEffect(()=>{
    if(!near||!pinned.length)return
    let active=true,cleanup
    setStatus('loading')
    const timeout=setTimeout(()=>{if(active)setStatus('error')},12000)
    import('../clinic-map.js').then(({mountClinicMap})=>{
      if(!active)return
      cleanup=mountClinicMap(canvas.current,pinned,
        ()=>{clearTimeout(timeout);if(active)setStatus(current=>current==='error'?current:'ready')},
        ()=>{if(active)setStatus('error')})
    }).catch(()=>{if(active)setStatus('error')})
    return()=>{active=false;clearTimeout(timeout);cleanup?.()}
  },[near,pinned.length])
  return <figure className={`site-location-map map-${status}`} ref={frame}>
    <div className="site-map-canvas" ref={canvas} aria-hidden="true"/>
    {status!=='ready'&&<div className="site-map-state"><span>{status==='error'?'Map unavailable':'Clinic locations'}</span><p>{status==='error'?'Find each clinic’s address below.':places(branches)}</p></div>}
    <figcaption className="site-map-caption"><span>{branches.length?`${branches.length} location${branches.length===1?'':'s'}`:'Our locations'}</span><span>© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></span></figcaption>
  </figure>
}

const places=branches=>{const cities=[...new Set(branches.map(b=>b.address.split(',').map(p=>p.trim()).filter(Boolean).slice(-2).join(', ')).filter(Boolean))];return cities.slice(0,3).join(' · ')||'Find a clinic near you'}
