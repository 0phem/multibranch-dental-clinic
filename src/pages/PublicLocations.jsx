import React, { useEffect, useRef, useState } from 'react'
import { clinic, loadPublicBranches } from '../clinic-config.js'

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

/** The branch cards. Exported for tests: the website itself has no built-in branch list. */
export function BranchList({ branches }) {
  return <ol className="site-branch-list">{branches.map(branch=><li key={branch.id} className="site-branch-card">
    <span className="site-branch-number" aria-hidden="true">{branch.number}</span><div><h3><span className="sr-only">Location {branch.number}: </span>{branch.name}</h3><address>{branch.address}</address></div>
  </li>)}</ol>
}

export function PublicLocations() {
  // The clinic's open branches come from the clinic records (GET /api/public/branches); only the contact is a built-in fallback.
  const [state,setState]=useState({status:'loading',branches:[]})
  useEffect(()=>{let live=true;loadPublicBranches().then(r=>{if(live)setState({status:r.ok?'ready':'error',branches:r.branches})});return()=>{live=false}},[])
  const {status,branches}=state
  return <section id="locations" className="site-section site-locations" aria-labelledby="locations-title"><div className="site-container">
    <div className="site-section-heading"><div><span className="site-eyebrow">Our locations</span><h2 id="locations-title">Find a clinic near you.</h2></div><p>{branches.length?`Visit one of our ${branches.length} clinic locations.`:'Visit one of our clinic locations.'}</p></div>
    <LocationMap branches={branches}/>
    {status==='loading'&&<p className="site-branch-loading" role="status">Loading our locations…</p>}
    {status==='error'&&<p className="site-branch-loading" role="status">Our locations can’t be shown right now. Call <a href={`tel:${clinic.phoneE164}`}>{clinic.phoneDisplay}</a> or email <a href={`mailto:${clinic.email}`}>{clinic.email}</a> and we’ll help you find the nearest clinic.</p>}
    {status==='ready'&&<BranchList branches={branches}/>}
  </div></section>
}
