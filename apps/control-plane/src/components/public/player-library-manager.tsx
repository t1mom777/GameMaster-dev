'use client'

import { BookCopy, LoaderCircle, PencilLine, ShieldPlus, Star, Trash2, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

type LibraryBook = {
  filename: string
  id: string
  ingestError: string
  isActive: boolean
  isPrimary: boolean
  kind: string
  lastIngestedAt: string | null
  status: string
  title: string
  updatedAt: string | null
}

type LibraryResponse = {
  books: LibraryBook[]
  primaryBookId: string | null
  supportingCount: number
}

function statusLabel(status: string): string {
  switch (status) {
    case 'ready':
      return 'Ready'
    case 'indexing':
      return 'Indexing'
    case 'error':
      return 'Needs attention'
    default:
      return 'Uploading'
  }
}

function roleLabel(book: LibraryBook): string {
  return book.isPrimary ? 'Primary rulebook' : 'Supporting book'
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

export function PlayerLibraryManager() {
  const [books, setBooks] = useState<LibraryBook[]>([])
  const [title, setTitle] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedRole, setSelectedRole] = useState<'primary-rulebook' | 'supporting-book'>('primary-rulebook')
  const [replaceDocumentId, setReplaceDocumentId] = useState('')
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const activeBooks = useMemo(() => books.filter((book) => book.isActive), [books])
  const readyBooks = useMemo(() => books.filter((book) => book.isActive && book.status === 'ready'), [books])
  const hasPendingBooks = useMemo(
    () => books.some((book) => book.status === 'uploaded' || book.status === 'indexing'),
    [books],
  )

  async function refreshLibrary(options?: { silent?: boolean }) {
    if (!options?.silent) {
      setIsLoading(true)
    }

    try {
      const response = await fetch('/api/gm/public/player-library', {
        cache: 'no-store',
      })

      const payload = (await response.json()) as LibraryResponse & { message?: string }
      if (!response.ok) {
        throw new Error(payload.message || 'Unable to load your game library.')
      }

      setBooks(payload.books || [])
      setRenameDrafts(
        Object.fromEntries((payload.books || []).map((book) => [book.id, book.title])),
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load your game library.')
    } finally {
      if (!options?.silent) {
        setIsLoading(false)
      }
    }
  }

  useEffect(() => {
    void refreshLibrary()
  }, [])

  useEffect(() => {
    if (!hasPendingBooks) {
      return
    }

    const interval = window.setInterval(() => {
      void refreshLibrary({ silent: true })
    }, 4000)

    return () => window.clearInterval(interval)
  }, [hasPendingBooks])

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedFile) {
      setMessage('Choose a PDF, Markdown, or plain text book first.')
      return
    }

    setIsSaving(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('role', selectedRole)
      if (title.trim()) {
        formData.append('title', title.trim())
      }
      if (replaceDocumentId) {
        formData.append('documentId', replaceDocumentId)
      }

      const response = await fetch('/api/gm/public/player-library', {
        body: formData,
        method: 'POST',
      })

      const payload = (await response.json()) as LibraryResponse & { message?: string }
      if (!response.ok) {
        throw new Error(payload.message || 'Unable to update your library.')
      }

      setBooks(payload.books || [])
      setRenameDrafts(
        Object.fromEntries((payload.books || []).map((book) => [book.id, book.title])),
      )
      setSelectedFile(null)
      setReplaceDocumentId('')
      setSelectedRole('supporting-book')
      setTitle('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      setMessage(
        replaceDocumentId
          ? 'Your book was replaced. Indexing will refresh the active game automatically.'
          : 'Your book was added. Indexing will refresh the active game automatically.',
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update your library.')
    } finally {
      setIsSaving(false)
    }
  }

  async function patchLibrary(body: Record<string, unknown>, successMessage: string, documentId: string) {
    setBusyId(documentId)
    setMessage(null)

    try {
      const response = await fetch('/api/gm/public/player-library', {
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'PATCH',
      })

      const payload = (await response.json()) as LibraryResponse & { message?: string }
      if (!response.ok) {
        throw new Error(payload.message || 'Unable to update the book.')
      }

      setBooks(payload.books || [])
      setRenameDrafts(
        Object.fromEntries((payload.books || []).map((book) => [book.id, book.title])),
      )
      setMessage(successMessage)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update the book.')
    } finally {
      setBusyId(null)
    }
  }

  async function removeBook(documentId: string) {
    setBusyId(documentId)
    setMessage(null)

    try {
      const response = await fetch('/api/gm/public/player-library', {
        body: JSON.stringify({
          documentId,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'DELETE',
      })

      const payload = (await response.json()) as LibraryResponse & { message?: string }
      if (!response.ok) {
        throw new Error(payload.message || 'Unable to remove the book.')
      }

      setBooks(payload.books || [])
      setRenameDrafts(
        Object.fromEntries((payload.books || []).map((book) => [book.id, book.title])),
      )
      setMessage('The book was removed from your library and game context.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to remove the book.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="library-card">
      <div className="library-card__header">
        <div>
          <p className="eyebrow">Your library</p>
          <h2>Rulebooks and supporting books</h2>
        </div>
        <BookCopy size={18} />
      </div>

      <p className="library-card__lede">
        Keep one primary rulebook and any number of supporting books. Active books are synced into
        your personal game automatically before voice play starts.
      </p>

      {hasPendingBooks && (
        <div className="status-line">
          <LoaderCircle className="spin" size={16} />
          Indexing is still running. This panel refreshes automatically.
        </div>
      )}

      <div className="library-metrics">
        <div>
          <span>Books</span>
          <strong>{books.length}</strong>
        </div>
        <div>
          <span>Active</span>
          <strong>{activeBooks.length}</strong>
        </div>
        <div>
          <span>Ready</span>
          <strong>{readyBooks.length}</strong>
        </div>
      </div>

      {isLoading ? (
        <div className="status-line">
          <LoaderCircle className="spin" size={16} />
          Loading your library.
        </div>
      ) : books.length ? (
        <div className="library-list">
          {books.map((book) => (
            <article className="library-item" key={book.id}>
              <div className="library-item__topline">
                <span className={`pill ${book.isPrimary ? 'pill--accent' : ''}`}>{roleLabel(book)}</span>
                <span className="pill">{statusLabel(book.status)}</span>
                {!book.isActive && <span className="pill">Excluded</span>}
              </div>

              <div className="library-item__body">
                <div className="library-item__copy">
                  <strong>{book.title}</strong>
                  <p>{book.filename || 'Uploaded document'}</p>
                </div>

                <label className="field">
                  <span>Title</span>
                  <input
                    onChange={(event) =>
                      setRenameDrafts((current) => ({
                        ...current,
                        [book.id]: event.target.value,
                      }))
                    }
                    value={renameDrafts[book.id] || ''}
                  />
                </label>
              </div>

              <div className="library-item__meta">
                <div>
                  <span>Updated</span>
                  <strong>{formatTimestamp(book.updatedAt)}</strong>
                </div>
                <div>
                  <span>Indexed</span>
                  <strong>{book.lastIngestedAt ? formatTimestamp(book.lastIngestedAt) : 'Pending'}</strong>
                </div>
              </div>

              {book.ingestError && <div className="notice-card">{book.ingestError}</div>}

              <div className="library-item__actions">
                {!book.isPrimary && (
                  <button
                    className="button button--ghost"
                    disabled={busyId === book.id}
                    onClick={() =>
                      void patchLibrary(
                        { action: 'make-primary', documentId: book.id },
                        'Primary rulebook updated.',
                        book.id,
                      )
                    }
                    type="button"
                  >
                    {busyId === book.id ? <LoaderCircle className="spin" size={18} /> : <Star size={18} />}
                    Make primary
                  </button>
                )}

                <button
                  className="button button--ghost"
                  disabled={busyId === book.id || book.isPrimary}
                  onClick={() =>
                    void patchLibrary(
                      { action: 'toggle-active', documentId: book.id, isActive: !book.isActive },
                      book.isActive ? 'Book excluded from the active game.' : 'Book added to the active game.',
                      book.id,
                    )
                  }
                  type="button"
                >
                  {busyId === book.id ? <LoaderCircle className="spin" size={18} /> : <ShieldPlus size={18} />}
                  {book.isPrimary ? 'Primary stays active' : book.isActive ? 'Exclude' : 'Include'}
                </button>

                <button
                  className="button button--ghost"
                  disabled={busyId === book.id || (renameDrafts[book.id] || '').trim().length < 2 || renameDrafts[book.id] === book.title}
                  onClick={() =>
                    void patchLibrary(
                      { action: 'rename', documentId: book.id, title: renameDrafts[book.id] || book.title },
                      'Book title updated.',
                      book.id,
                    )
                  }
                  type="button"
                >
                  {busyId === book.id ? <LoaderCircle className="spin" size={18} /> : <PencilLine size={18} />}
                  Save name
                </button>

                <button
                  className="button button--ghost"
                  disabled={busyId === book.id}
                  onClick={() => void removeBook(book.id)}
                  type="button"
                >
                  {busyId === book.id ? <LoaderCircle className="spin" size={18} /> : <Trash2 size={18} />}
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="notice-card notice-card--muted">
          Your library is empty. Upload a primary rulebook first, then add supporting books as
          needed.
        </div>
      )}

      <form className="library-form" onSubmit={handleUpload}>
        <div className="library-form__grid">
          <label className="field">
            <span>Book title</span>
            <input
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Core rulebook or supporting guide"
              value={title}
            />
          </label>

          <label className="field">
            <span>Role</span>
            <select
              onChange={(event) =>
                setSelectedRole(event.target.value === 'supporting-book' ? 'supporting-book' : 'primary-rulebook')
              }
              value={selectedRole}
            >
              <option value="primary-rulebook">Primary rulebook</option>
              <option value="supporting-book">Supporting book</option>
            </select>
          </label>

          <label className="field">
            <span>Replace existing book</span>
            <select
              onChange={(event) => setReplaceDocumentId(event.target.value)}
              value={replaceDocumentId}
            >
              <option value="">Add as new book</option>
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span>File</span>
          <input
            accept=".pdf,.txt,.md,text/plain,text/markdown,application/pdf"
            onChange={(event) => {
              const nextFile = event.target.files?.[0] || null
              setSelectedFile(nextFile)
              if (!title.trim() && nextFile) {
                setTitle(nextFile.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '))
              }
            }}
            ref={fileInputRef}
            type="file"
          />
        </label>

        <div className="subtle-note">
          PDF, Markdown, or plain text. One primary rulebook, multiple supporting books, up to 25 MB
          each.
        </div>

        {message && <div className="notice-card">{message}</div>}

        <div className="inline-actions">
          <button className="button button--primary" disabled={isSaving} type="submit">
            {isSaving ? <LoaderCircle className="spin" size={18} /> : <Upload size={18} />}
            {replaceDocumentId ? 'Replace book' : 'Add book'}
          </button>
        </div>
      </form>
    </section>
  )
}
