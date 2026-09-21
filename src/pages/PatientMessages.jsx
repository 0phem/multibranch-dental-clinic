import React, { useEffect, useRef, useState } from 'react'
import { Button, Empty, Field, Notice, PageHeader, Status } from '../components.jsx'
import { uid } from '../logic.js'
import { formatStamp, patientContext, patientConversations, resolveTarget } from '../patient-view.js'

// Messages are participant-based conversations. Notifications are a separate system and never appear here.
export function PatientMessagesPage({ store, context }) {
  const { state, actions, toast }=store, session=store.session
  const target=resolveTarget(state,session,'messages',context)
  const [selected,setSelected]=useState(target)
  const [returnId,setReturnId]=useState(null)
  const [text,setText]=useState('')
  const command=useRef(uid('reply')), heading=useRef(null), moved=useRef(false)
  const conversations=patientConversations(state,session)
  const convo=conversations.find(c=>c.id===selected)
  useEffect(()=>{if(target)setSelected(target)},[target])
  // Opening an existing conversation marks it read through the shared command.
  useEffect(()=>{
    if(!convo?.unread)return
    const result=actions.markConversationRead(convo.id)
    if(!result.ok)toast(result.message,'warning')
  },[convo?.id,convo?.unread])
  useEffect(()=>{
    if(moved.current&&selected)heading.current?.focus()
    if(!selected&&returnId){document.getElementById(`msg-item-${returnId}`)?.focus();setReturnId(null)}
    moved.current=true
  },[selected])
  if(!patientContext(state,session))return <Notice tone="warning" title="We couldn’t confirm your account">Reopen your workspace, or ask the clinic to check your account access.</Notice>

  const open=id=>{setSelected(id);setText('');command.current=uid('reply')}
  const back=()=>{setReturnId(selected);setSelected(null)}
  const send=event=>{
    event.preventDefault()
    const result=actions.replyToConversation(convo.id,text,command.current)
    if(!result.ok)return toast(result.message,'warning')
    setText('');toast('Message sent.','success')
  }
  return <div className="pt-page is-wide">
    <PageHeader kicker="Your care" title="Messages" text="Conversations with your clinic team. Reminders and updates are in Notifications."/>
    {!conversations.length?<Empty title="No conversations" text="No messages from the clinic yet."/>:<div className={`pt-messages ${convo?'has-thread':''}`.trim()}>
      <section className="pt-list-pane" aria-labelledby="pt-conv-heading">
        <h2 id="pt-conv-heading" className="pt-card-label">Conversations</h2>
        <ul className="pt-conv-list">{conversations.map(c=><li key={c.id}><button id={`msg-item-${c.id}`} type="button" aria-current={c.id===selected?'true':undefined} onClick={()=>open(c.id)}>
          <span className="pt-conv-title"><b>{c.title}</b>{c.unread&&<span className="pt-unread">Unread</span>}</span>
          <small>{c.context}</small>
          <Status>{c.status}</Status>
        </button></li>)}</ul>
      </section>
      {convo?<section className="pt-thread-pane" aria-labelledby="pt-thread-title">
        <div className="pt-thread-head">
          <Button variant="ghost" size="sm" className="pt-back" onClick={back}>‹ All conversations</Button>
          <h2 id="pt-thread-title" ref={heading} tabIndex={-1}>{convo.title}</h2>
          <p>{convo.role?`${convo.role} • `:''}{convo.context}</p>
        </div>
        <div className="pt-thread" role="log" aria-label="Messages in this conversation">{convo.messages.map(m=><div className={`pt-bubble ${m.mine?'mine':''}`.trim()} key={m.id}><small>{m.mine?'You':m.sender}</small><p>{m.text}</p><span>{formatStamp(m.at)}</span></div>)}</div>
        {convo.canReply?<form className="pt-compose" onSubmit={send}>
          <Field label="Your message"><textarea value={text} placeholder="Write a message…" onChange={event=>{setText(event.target.value);command.current=uid('reply')}}/></Field>
          <Button type="submit" icon="arrow">Send message</Button>
        </form>:<Notice>This conversation is closed. You can read it, but it can’t receive new messages.</Notice>}
      </section>:<section className="pt-thread-pane pt-thread-empty"><Empty title="Select a conversation" text="Choose a conversation to read it."/></section>}
    </div>}
  </div>
}
