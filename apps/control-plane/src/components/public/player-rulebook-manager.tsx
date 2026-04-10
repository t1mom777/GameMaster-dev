'use client'

import { BookMarked, LoaderCircle, Trash2, Upload } from 'lucide-react'
import { startTransition, useEffect, useRef, useState, type FormEvent } from 'react'

type PlayerRulebook = {
  filename: string
  id: string
  ingestError: string
  lastIngestedAt: string | null
  status: string
  title: string
  updatedAt: string | null
}

type RulebookResponse = {
  rulebook: PlayerRulebook | null
}

function statusLabel(status: string): string {
  switch (status) {
    case 'ready':
      return 'Ready in rooms'
    case 'indexing':
      return 'Indexing'
    case 'error':
      return 'Needs attention'
    default:
      return 'Uploading'
  }
}

function formatTimestamp(input: string | null): string {
  if (!input) {
    return 'Just now'
  }

  const timestamp = new Date(input)
  if (Number.isNaN(timestamp.getTime())) {
    return 'Just now'
  }

  return timestamp.toLocaleString()
}

export function PlayerRulebookManager() {
  const [rulebook, setRulebook] = useState<PlayerRulebook | null>(null)
  const [title, setTitle] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  async function refreshRulebook() {
    setIsLoading(true)

    try {
      const response = await fetch('/api/gm/public/player-rulebook', {
        cache: 'no-store',
      })

      const payload = (await response.json()) as RulebookResponse & { message?: string }
      if (!response.ok) {
        throw new Error(payload.message || 'Unable to load your rulebook.')
      }

      setRulebook(payload.rulebook)
      setTitle(payload.rulebook?.title || '')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load your rulebook.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void refreshRulebook()
  }, [])

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedFile) {
      setMessage('Choose a PDF, Markdown, or plain text file first.')
      return
    }

    setIsSaving(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      if (title.trim()) {
        formData.append('title', title.trim())
      }

      const response = await fetch('/api/gm/public/player-rulebook', {
        body: formData,
        method: 'POST',
      })

      const payload = (await response.json()) as RulebookResponse & { message?: string }
      if (!response.ok) {
        throw new Error(payload.message || 'Unable to save your rulebook.')
      }

      setRulebook(payload.rulebook)
      setTitle(payload.rulebook?.title || title.trim())
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setMessage('Your rulebook is saved. It will follow you into rooms when you join.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save your rulebook.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    setIsDeleting(true)
    setMessage(null)

    try {
      const response = await fetch('/api/gm/public/player-rulebook', {
        method: 'DELETE',
      })
      const payload = (await response.json()) as RulebookResponse & { message?: string }

      if (!response.ok) {
        throw new Error(payload.message || 'Unable to remove your rulebook.')
      }

      setRulebook(null)
      setTitle('')
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setMessage('Your personal rulebook was removed.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to remove your rulebook.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <section className="rulebook-card">
      <div className="rulebook-card__header">
        <div>
          <p className="eyebrow">Your reference book</p>
          <h2>Bring your own rules into the room</h2>
        </div>
        <BookMarked size={18} />
      </div>

      <p className="rulebook-card__lede">
        Upload one personal rulebook. When you join a room, it becomes part of the active session
        context automatically.
      </p>

      {isLoading ? (
        <div className="status-line">
          <LoaderCircle className="spin" size={16} />
          Loading your rulebook status.
        </div>
      ) : rulebook ? (
        <div className="rulebook-state">
          <div>
            <span className={`pill ${rulebook.status === 'ready' ? 'pill--accent' : ''}`}>
              {statusLabel(rulebook.status)}
            </span>
            <strong>{rulebook.title}</strong>
            <p>{rulebook.filename || 'Uploaded document'}</p>
          </div>

          <dl className="rulebook-meta">
            <div>
              <dt>Updated</dt>
              <dd>{formatTimestamp(rulebook.updatedAt)}</dd>
            </div>
            <div>
              <dt>Indexed</dt>
              <dd>{rulebook.lastIngestedAt ? formatTimestamp(rulebook.lastIngestedAt) : 'Pending'}</dd>
            </div>
          </dl>

          {rulebook.ingestError && <div className="notice-card">{rulebook.ingestError}</div>}
        </div>
      ) : (
        <div className="notice-card notice-card--muted">
          No personal rulebook is attached yet. Upload one if you want your own book to follow you
          into sessions.
        </div>
      )}

      <form className="rulebook-form" onSubmit={handleUpload}>
        <label className="field">
          <span>Rulebook title</span>
          <input
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Personal rulebook"
            value={title}
          />
        </label>

        <label className="field">
          <span>File</span>
          <input
            accept=".pdf,.txt,.md,text/plain,text/markdown,application/pdf"
            onChange={(event) => {
              const nextFile = event.target.files?.[0] || null
              startTransition(() => {
                setSelectedFile(nextFile)
                if (!title.trim() && nextFile) {
                  setTitle(nextFile.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '))
                }
              })
            }}
            ref={fileInputRef}
            type="file"
          />
        </label>

        <div className="subtle-note">
          PDF, Markdown, or plain text. One book per player, up to 25 MB.
        </div>

        {message && <div className="notice-card">{message}</div>}

        <div className="inline-actions">
          <button className="button button--primary" disabled={isSaving} type="submit">
            {isSaving ? <LoaderCircle className="spin" size={18} /> : <Upload size={18} />}
            {rulebook ? 'Replace rulebook' : 'Upload rulebook'}
          </button>

          {rulebook && (
            <button
              className="button button--ghost"
              disabled={isDeleting}
              onClick={handleDelete}
              type="button"
            >
              {isDeleting ? <LoaderCircle className="spin" size={18} /> : <Trash2 size={18} />}
              Remove
            </button>
          )}
        </div>
      </form>
    </section>
  )
}
