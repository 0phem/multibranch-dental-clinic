import React, { useEffect, useRef, useState } from 'react'
import { Brand } from '../Brand.jsx'
import { Icon } from '../components.jsx'
import { clinic } from '../clinic-config.js'

export const publicLinks=[['home','Home'],['about','About'],['features','Features'],['portal','Patient Portal'],['locations','Locations'],['contact','Contact']]

export function PublicHeader() {
  const [open,setOpen]=useState(false)
  const toggle=useRef(null),header=useRef(null)
  const select=()=>{
    setOpen(false)
    if(open)toggle.current?.focus()
  }
  useEffect(()=>{
    const close=()=>setOpen(false)
    const outside=event=>{if(!header.current?.contains(event.target)){
      if(header.current?.querySelector('nav')?.contains(document.activeElement))toggle.current?.focus()
      close()
    }}
    window.addEventListener('hashchange',close)
    document.addEventListener('pointerdown',outside)
    return()=>{window.removeEventListener('hashchange',close);document.removeEventListener('pointerdown',outside)}
  },[])
  return <header className="site-header" ref={header} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false)}} onKeyDown={event=>{if(event.key==='Escape'){setOpen(false);toggle.current?.focus()}}}>
    <a href="#public-main" className="site-skip">Skip to content</a>
    <div className="site-header-inner">
      <a className="site-brand-link" href="#home" aria-label={`${clinic.name} home`} onClick={()=>setOpen(false)}><Brand/></a>
      <button ref={toggle} type="button" className="site-menu-toggle" aria-label={open?'Close navigation':'Open navigation'} aria-expanded={open} aria-controls="public-navigation" onClick={()=>setOpen(!open)}><Icon name={open?'x':'menu'}/></button>
      <nav id="public-navigation" className={`site-navigation ${open?'is-open':''}`} aria-label="Public navigation">
        <div className="site-nav-links">{publicLinks.map(([id,label])=><a key={id} href={`#${id}`} onClick={select}>{label}</a>)}</div>
        <div className="site-account-links"><a href="#sign-in" onClick={select}>Sign In</a><a className="site-button" href="#create-account" onClick={select}>Create Account <Icon name="arrow" size={16}/></a></div>
      </nav>
    </div>
  </header>
}

export function PublicFooter() {
  return <footer className="site-footer"><div className="site-container site-footer-grid">
    <div className="site-footer-brand"><a href="#home" aria-label={`${clinic.name} home`}><Brand/></a><p>Your clinic. Your visits.<br/>One connected Patient Portal.</p></div>
    <div><h2>Explore</h2><nav aria-label="Footer navigation">{publicLinks.map(([id,label])=><a key={id} href={`#${id}`}>{label}</a>)}</nav></div>
    <div><h2>Your account</h2><a href="#sign-in">Sign In</a><a href="#create-account">Create Account</a></div>
    <div className="site-footer-contact"><h2>Contact the clinic</h2><a href={`tel:${clinic.phoneE164}`}>{clinic.phoneDisplay}</a><a href={`mailto:${clinic.email}`}>{clinic.email}</a><p>{clinic.city}</p></div>
  </div><div className="site-container site-footer-bottom"><span>© {new Date().getFullYear()} {clinic.name}. All rights reserved.</span><span>Patient Portal</span></div></footer>
}
