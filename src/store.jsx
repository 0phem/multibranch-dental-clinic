import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  INITIAL_BRANCHES, INITIAL_DENTISTS, INITIAL_STAFF, INITIAL_PATIENTS, INITIAL_APPOINTMENTS, INITIAL_QUEUE,
  INITIAL_TREATMENTS, INITIAL_INVOICES, INITIAL_HMO, INITIAL_INQUIRIES, INITIAL_CONVERSATIONS,
  INITIAL_NOTIFICATIONS, INITIAL_PRESCRIPTIONS, INITIAL_FOLLOWUPS, INITIAL_USERS, INITIAL_AUTOMATIONS,
  INITIAL_WORKFLOW_LOG, INITIAL_CAMPAIGNS, INITIAL_LOYALTY, INITIAL_AUDIT
} from './data.js'
import { uid, nowLabel } from './logic.js'

const ClinicContext=createContext(null)

function usePersist(key, initial) {
  const [value,setValue]=useState(()=>{
    try { const saved=localStorage.getItem(key); return saved?JSON.parse(saved):initial }
    catch { return initial }
  })
  useEffect(()=>{ try{localStorage.setItem(key,JSON.stringify(value))}catch{} },[key,value])
  return [value,setValue]
}

export function ClinicProvider({ children }) {
  const [branches,setBranches]=usePersist('dentalops-v2-branches',INITIAL_BRANCHES)
  const [dentists,setDentists]=usePersist('dentalops-v2-dentists',INITIAL_DENTISTS)
  const [staff,setStaff]=usePersist('dentalops-v2-staff',INITIAL_STAFF)
  const [patients,setPatients]=usePersist('dentalops-v2-patients',INITIAL_PATIENTS)
  const [appointments,setAppointments]=usePersist('dentalops-v2-appointments',INITIAL_APPOINTMENTS)
  const [queue,setQueue]=usePersist('dentalops-v2-queue',INITIAL_QUEUE)
  const [treatments,setTreatments]=usePersist('dentalops-v2-treatments',INITIAL_TREATMENTS)
  const [invoices,setInvoices]=usePersist('dentalops-v2-invoices',INITIAL_INVOICES)
  const [hmo,setHmo]=usePersist('dentalops-v2-hmo',INITIAL_HMO)
  const [inquiries,setInquiries]=usePersist('dentalops-v2-inquiries',INITIAL_INQUIRIES)
  const [conversations,setConversations]=usePersist('dentalops-v2-conversations',INITIAL_CONVERSATIONS)
  const [notifications,setNotifications]=usePersist('dentalops-v2-notifications',INITIAL_NOTIFICATIONS)
  const [prescriptions,setPrescriptions]=usePersist('dentalops-v2-prescriptions',INITIAL_PRESCRIPTIONS)
  const [followups,setFollowups]=usePersist('dentalops-v2-followups',INITIAL_FOLLOWUPS)
  const [users,setUsers]=usePersist('dentalops-v2-users',INITIAL_USERS)
  const [automations,setAutomations]=usePersist('dentalops-v2-automations',INITIAL_AUTOMATIONS)
  const [workflowLog,setWorkflowLog]=usePersist('dentalops-v2-workflow-log',INITIAL_WORKFLOW_LOG)
  const [campaigns,setCampaigns]=usePersist('dentalops-v2-campaigns',INITIAL_CAMPAIGNS)
  const [loyalty,setLoyalty]=usePersist('dentalops-v2-loyalty',INITIAL_LOYALTY)
  const [audit,setAudit]=usePersist('dentalops-v2-audit',INITIAL_AUDIT)
  const [toasts,setToasts]=useState([])

  const state={branches,dentists,staff,patients,appointments,queue,treatments,invoices,hmo,inquiries,conversations,notifications,prescriptions,followups,users,automations,workflowLog,campaigns,loyalty,audit}
  const setters={setBranches,setDentists,setStaff,setPatients,setAppointments,setQueue,setTreatments,setInvoices,setHmo,setInquiries,setConversations,setNotifications,setPrescriptions,setFollowups,setUsers,setAutomations,setWorkflowLog,setCampaigns,setLoyalty,setAudit}

  const toast=(message,tone='default')=>{
    const id=uid('toast'); setToasts(xs=>[...xs,{id,message,tone}]); setTimeout(()=>setToasts(xs=>xs.filter(x=>x.id!==id)),3200)
  }
  const log=(actor,action,module='M23')=>{
    setAudit(xs=>[{id:uid('aud'),at:nowLabel(),actor,action,module},...xs].slice(0,100))
  }
  const workflow=(module,event,result,status='Success')=>{
    setWorkflowLog(xs=>[{id:uid('log'),at:nowLabel(),module,event,result,status},...xs].slice(0,100))
  }
  const notify=(patientId,type,text,channel='Portal')=>{
    setNotifications(xs=>[{id:uid('n'),patientId,type,channel,text,status:'Delivered',createdAt:nowLabel(),read:false},...xs])
  }
  const resetDemo=()=>{
    Object.keys(localStorage).filter(k=>k.startsWith('dentalops-v2-')).forEach(k=>localStorage.removeItem(k))
    window.location.reload()
  }

  const value=useMemo(()=>({state,setters,toast,log,workflow,notify,resetDemo,toasts}),[state,toasts])
  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>
}

export function useClinic() {
  const ctx=useContext(ClinicContext)
  if (!ctx) throw new Error('useClinic must be used inside ClinicProvider')
  return ctx
}
