'use client'

import { useState, type FormEvent } from 'react'

type SubmitState = 'idle' | 'saving' | 'saved' | 'error'

export function PrelaunchLeadForm() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [state, setState] = useState<SubmitState>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState('saving')
    setMessage('')

    const response = await fetch('/api/gm/prelaunch/leads', {
      body: JSON.stringify({
        email,
        name,
        source: 'kickstarter',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    }).catch(() => null)

    if (!response?.ok) {
      setState('error')
      setMessage('Could not save this email. Try again in a moment.')
      return
    }

    setState('saved')
    setMessage('You are on the Founder Access backup list.')
  }

  return (
    <form className="prelaunch-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>Email for Founder Access updates</span>
        <input
          autoComplete="email"
          disabled={state === 'saving' || state === 'saved'}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          type="email"
          value={email}
        />
      </label>
      <label className="field">
        <span>Name, optional</span>
        <input
          autoComplete="name"
          disabled={state === 'saving' || state === 'saved'}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
          type="text"
          value={name}
        />
      </label>
      <button className="button button--primary" disabled={state === 'saving' || state === 'saved'} type="submit">
        {state === 'saving' ? 'Saving...' : state === 'saved' ? 'Saved' : 'Join backup list'}
      </button>
      {message ? <p className={state === 'error' ? 'prelaunch-form__error' : 'prelaunch-form__success'}>{message}</p> : null}
    </form>
  )
}
