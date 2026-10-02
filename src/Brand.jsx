import React from 'react'
import { clinic } from './clinic-config.js'

export function Brand({className=''}) {
  return <div className={`brand ${className}`.trim()}><img className="clinic-logo" src={clinic.logo} alt="" width="48" height="48"/><div><strong>{clinic.nameLine}</strong><span>{clinic.subtitle}</span></div></div>
}
