import React, { useEffect, useState } from 'react'
import { Brand } from './Brand.jsx'

export function LoadingIndicator({label='Opening your clinic portal…'}) {
  return <div className="startup-brand"><div aria-hidden="true"><Brand/><span className="startup-track"/></div><p role="status">{label}</p></div>
}

// Delay only the indicator. Unmount immediately when the real operation is ready; never delay content.
export function StartupLoading({compact=false,label}) {
  const [visible,setVisible]=useState(false)
  useEffect(()=>{const timer=setTimeout(()=>setVisible(true),150);return()=>clearTimeout(timer)},[])
  return <div className={compact?'route-loading':'startup-shell'} aria-busy="true">{visible&&<LoadingIndicator label={label}/>}</div>
}

export class ChunkBoundary extends React.Component {
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  render(){return this.state.failed?<div className="route-loading" role="alert"><div><p>This page could not be loaded. Check your connection and try again.</p><button type="button" className="btn primary md" onClick={()=>window.location.reload()}>Reload page</button></div></div>:this.props.children}
}
