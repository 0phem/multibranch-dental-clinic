import React, { useEffect, useRef, useState } from 'react'
import { clinic } from '../clinic-config.js'

export function LocationMap() {
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
  useEffect(()=>{
    if(!near)return
    let active=true,cleanup
    setStatus('loading')
    const timeout=setTimeout(()=>{if(active)setStatus('error')},12000)
    import('../clinic-map.js').then(({mountClinicMap})=>{
      if(!active)return
      cleanup=mountClinicMap(canvas.current,clinic.branches,
        ()=>{clearTimeout(timeout);if(active)setStatus(current=>current==='error'?current:'ready')},
        ()=>{if(active)setStatus('error')})
    }).catch(()=>{if(active)setStatus('error')})
    return()=>{active=false;clearTimeout(timeout);cleanup?.()}
  },[near])
  return <figure className={`site-location-map map-${status}`} ref={frame}>
    <div className="site-map-canvas" ref={canvas} aria-hidden="true"/>
    {status!=='ready'&&<div className="site-map-state"><span>{status==='error'?'Map unavailable':'Clinic locations'}</span><p>{status==='error'?'Find each clinic’s address below.':'Bocaue & Guiguinto, Bulacan'}</p></div>}
    <figcaption className="site-map-caption"><span>Three locations · Bulacan</span><span>© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></span></figcaption>
  </figure>
}

export function PublicLocations() {
  return <section id="locations" className="site-section site-locations" aria-labelledby="locations-title"><div className="site-container">
    <div className="site-section-heading"><div><span className="site-eyebrow">Our locations</span><h2 id="locations-title">Find a clinic near you.</h2></div><p>Visit one of our three clinic locations in Bocaue and Guiguinto, Bulacan.</p></div>
    <LocationMap/>
    <ol className="site-branch-list">{clinic.branches.map(branch=><li key={branch.id} className="site-branch-card">
      <span className="site-branch-number" aria-hidden="true">{branch.number}</span><div><h3><span className="sr-only">Location {branch.number}: </span>{branch.name}</h3><address>{branch.address}</address></div>
    </li>)}</ol>
  </div></section>
}
