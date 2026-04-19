'use client'

import { BookCopy, LoaderCircle, PencilLine, ShieldPlus, Star, Trash2, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { readApiPayload } from './api-response'
import { getBookProgressDetail, getBookProgressPercent, getOverallLibraryProgress } from './library-progress'

type LibraryBook = {
  filename: string
  id: string
  ingestError: string
  ingestPhase: string
  ingestProgress: number | null
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
      return 'Processing'
    case 'error':
      return 'Needs attention'
    default:
      return 'Upload received'
  }
}

function roleLabel(book: LibraryBook): string {
  return book.isPrimary ? 'Main rulebook' : 'Supporting book'
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

function bookStatusDetail(book: LibraryBook): string {
  switch (book.status) {
    case 'ready':
      return 'Indexed and available for the GM during voice.'
    case 'indexing':
      return 'Parsing, converting to Markdown, and indexing now.'
    case 'error':
      return 'This book needs attention before it can ground voice play.'
    default:
      return 'The upload reached the library. Processing will start shortly.'
  }
}

function normalizeLibraryMessage(error: unknown, fallback: string): string {
  if (error instanceof TypeError || (error instanceof Error && /failed to fetch/i.test(error.message))) {
    return 'The browser could not finish the upload. If the book is in a phone or cloud-sync folder, copy it to a local folder first and retry.'
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}

function buildUploadFormData(input: {
  file: File
  role: 'primary-rulebook' | 'supporting-book'
  title: string
  documentId: string
}): FormData {
  const formData = new FormData()
  formData.append('file', input.file)
  formData.append('role', input.role)
  if (input.title.trim()) {
    formData.append('title', input.title.trim())
  }
  if (input.documentId) {
    formData.append('documentId', input.documentId)
  }
  return formData
}

function shouldRetryWithMaterializedFile(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  return /requested file could not be read|failed to fetch|permission problems|reference to a file was acquired/i.test(
    error.message,
  )
}

async function materializeUploadFile(input: File): Promise<File> {
  try {
    const buffer = await input.arrayBuffer()
    return new File([buffer], input.name, {
      lastModified: input.lastModified,
      type: input.type || 'application/octet-stream',
    })
  } catch (error) {
    throw new Error(
      normalizeLibraryMessage(
        error,
        'The selected book could not be read from this device. Copy it to a local folder and try again.',
      ),
    )
  }
}

async function submitUpload(
  formData: FormData,
  onProgress?: (percent: number | null) => void,
): Promise<LibraryResponse> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', '/api/gm/public/player-library')
    request.responseType = 'text'
    request.upload.onprogress = (event) => {
      if (!onProgress) {
        return
      }

      if (!event.lengthComputable || !event.total) {
        onProgress(null)
        return
      }

      onProgress(Math.max(1, Math.min(100, Math.round((event.loaded / event.total) * 100))))
    }

    request.onerror = () => {
      reject(new TypeError('Failed to fetch'))
    }

    request.onload = () => {
      const contentType = request.getResponseHeader('content-type') || ''
      const responseText = typeof request.responseText === 'string' ? request.responseText : ''
      let payload: (LibraryResponse & { message?: string }) | null = null

      if (contentType.includes('application/json') && responseText) {
        try {
          payload = JSON.parse(responseText) as LibraryResponse & { message?: string }
        } catch {
          payload = null
        }
      }

      if (!request.status || request.status >= 400) {
        reject(new Error(payload?.message || 'Unable to update your library.'))
        return
      }

      if (!payload) {
        reject(new Error('Unable to update your library.'))
        return
      }

      resolve(payload)
    }

    request.send(formData)
  })
}

type PlayerLibraryManagerProps = {
  compact?: boolean
}

export function PlayerLibraryManager({ compact = false }: PlayerLibraryManagerProps) {
  const [books, setBooks] = useState<LibraryBook[]>([])
  const [title, setTitle] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedRole, setSelectedRole] = useState<'primary-rulebook' | 'supporting-book'>('primary-rulebook')
  const [replaceDocumentId, setReplaceDocumentId] = useState('')
  const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const activeBooks = useMemo(() => books.filter((book) => book.isActive), [books])
  const readyBooks = useMemo(() => books.filter((book) => book.isActive && book.status === 'ready'), [books])
  const primaryBook = useMemo(() => books.find((book) => book.isPrimary) || null, [books])
  const supportingBooks = useMemo(() => books.filter((book) => !book.isPrimary), [books])
  const hasPendingBooks = useMemo(
    () => books.some((book) => book.status === 'uploaded' || book.status === 'indexing'),
    [books],
  )
  const pendingBooks = useMemo(
    () => books.filter((book) => book.status === 'uploaded' || book.status === 'indexing'),
    [books],
  )
  const featuredPendingBook = pendingBooks.find((book) => book.isPrimary) || pendingBooks[0] || null
  const overallLibraryProgress = getOverallLibraryProgress(pendingBooks, isSaving, uploadProgress)
  const shouldForceExpandedCompact = compact && (!primaryBook || isSaving || hasPendingBooks)

  async function refreshLibrary(options?: { silent?: boolean }) {
    if (!options?.silent) {
      setIsLoading(true)
    }

    try {
      const response = await fetch('/api/gm/public/player-library', {
        cache: 'no-store',
      })

      const payload = await readApiPayload<LibraryResponse>(response, 'Unable to load your game library.')
      if (!response.ok) {
        throw new Error(payload.message || 'Unable to load your game library.')
      }

      setBooks(payload.books || [])
      setRenameDrafts(
        Object.fromEntries((payload.books || []).map((book) => [book.id, book.title])),
      )
    } catch (error) {
      setMessage(normalizeLibraryMessage(error, 'Unable to load your game library.'))
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
    setUploadProgress(0)
    setMessage(null)

    try {
      let payload: LibraryResponse

      try {
        payload = await submitUpload(
          buildUploadFormData({
            documentId: replaceDocumentId,
            file: selectedFile,
            role: selectedRole,
            title,
          }),
          setUploadProgress,
        )
      } catch (error) {
        if (!shouldRetryWithMaterializedFile(error)) {
          throw error
        }

        const uploadFile = await materializeUploadFile(selectedFile)
        payload = await submitUpload(
          buildUploadFormData({
            documentId: replaceDocumentId,
            file: uploadFile,
            role: selectedRole,
            title,
          }),
          setUploadProgress,
        )
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
          ? 'The book was replaced. The library will keep refreshing while processing finishes.'
          : 'The book was added. The library will keep refreshing while processing finishes.',
      )
      setUploadProgress(100)
    } catch (error) {
      setMessage(normalizeLibraryMessage(error, 'Unable to update your library.'))
    } finally {
      setIsSaving(false)
      setUploadProgress(null)
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

      const payload = await readApiPayload<LibraryResponse>(response, 'Unable to update the book.')
      if (!response.ok) {
        throw new Error(payload.message || 'Unable to update the book.')
      }

      setBooks(payload.books || [])
      setRenameDrafts(
        Object.fromEntries((payload.books || []).map((book) => [book.id, book.title])),
      )
      setMessage(successMessage)
    } catch (error) {
      setMessage(normalizeLibraryMessage(error, 'Unable to update the book.'))
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

      const payload = await readApiPayload<LibraryResponse>(response, 'Unable to remove the book.')
      if (!response.ok) {
        throw new Error(payload.message || 'Unable to remove the book.')
      }

      setBooks(payload.books || [])
      setRenameDrafts(
        Object.fromEntries((payload.books || []).map((book) => [book.id, book.title])),
      )
      setMessage('The book was removed from your library and game context.')
    } catch (error) {
      setMessage(normalizeLibraryMessage(error, 'Unable to remove the book.'))
    } finally {
      setBusyId(null)
    }
  }

  const showExpandedLibrary = !compact || showDetails
  const showCompactForm = !compact || showDetails || shouldForceExpandedCompact

  return (
    <section className={`library-card ${compact ? 'library-card--compact' : ''}`}>
      <div className="library-card__header">
        <div>
          <p className="eyebrow">Table books</p>
          <h2>{compact ? 'Main rulebook' : 'Main rulebook and supporting books'}</h2>
        </div>
        {!compact && <BookCopy size={18} />}
      </div>

      <p className="library-card__lede">
        {compact
          ? 'Keep one grounded primary book, then add supporting books when needed.'
          : 'Keep one main rulebook and any number of supporting books. Voice stays locked until the main rulebook is ready, and active books sync into the shared-mic session automatically.'}
      </p>

      {(isSaving || hasPendingBooks) && (
        <div className="library-progress-card">
          <div className="library-progress-card__header">
            <div>
              <strong>{isSaving ? 'Uploading book' : 'Indexing library book'}</strong>
              <p>
                {isSaving
                  ? 'Keep this tab open until the upload finishes. Indexing starts immediately after the file is stored.'
                  : featuredPendingBook
                    ? getBookProgressDetail(featuredPendingBook)
                    : 'Processing is still running in the background.'}
              </p>
            </div>
            <span>{overallLibraryProgress}%</span>
          </div>

          <div aria-hidden="true" className="progress-track progress-track--large">
            <div
              className={`progress-fill ${isSaving ? 'progress-fill--accent' : 'progress-fill--signal'}`}
              style={{ width: `${overallLibraryProgress}%` }}
            />
          </div>

          <div className="subtle-note">
            Uploading shows real browser transfer progress. Indexing is estimated from the live document state and
            refreshes automatically until the book is ready.
          </div>
        </div>
      )}

      <div className="library-metrics">
        <div>
          <span>Supporting</span>
          <strong>{supportingBooks.length}</strong>
        </div>
        <div>
          <span>Ready</span>
          <strong>{readyBooks.length}</strong>
        </div>
      </div>

      {compact && (
        <>
          {primaryBook && (
            <div className="library-card__summary">
              <div>
                <span>{primaryBook.isPrimary ? 'Main rulebook' : roleLabel(primaryBook)}</span>
                <strong>{primaryBook.title}</strong>
                <p>
                  Supporting {supportingBooks.length}
                  {supportingBooks.length ? ` · ${supportingBooks.map((book) => book.title).slice(0, 1).join(', ')}` : ''}
                </p>
              </div>
              <span className={`pill ${primaryBook.status === 'ready' ? 'pill--accent' : ''}`}>
                {statusLabel(primaryBook.status)}
              </span>
            </div>
          )}

          {!primaryBook && !isLoading && (
            <div className="notice-card notice-card--muted">
              No main rulebook yet. Upload one now so indexing can start.
            </div>
          )}
        </>
      )}

      {isLoading ? (
        <div className="status-line">
          <LoaderCircle className="spin" size={16} />
          Loading your library.
        </div>
      ) : books.length && showExpandedLibrary ? (
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
                  <div className="subtle-note">{bookStatusDetail(book)}</div>
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

              {(book.status === 'uploaded' || book.status === 'indexing') && (
                <div className="library-item__progress">
                  <div className="library-item__progress-meta">
                    <span>{getBookProgressDetail(book)}</span>
                    <strong>{getBookProgressPercent(book)}%</strong>
                  </div>
                  <div aria-hidden="true" className="progress-track">
                    <div
                      className={`progress-fill ${book.status === 'uploaded' ? 'progress-fill--accent' : 'progress-fill--signal'}`}
                      style={{ width: `${getBookProgressPercent(book)}%` }}
                    />
                  </div>
                </div>
              )}

              {book.ingestError && <div className="notice-card">{book.ingestError}</div>}

              <div className="library-item__actions">
                {!book.isPrimary && (
                  <button
                    className="button button--ghost"
                    disabled={busyId === book.id}
                    onClick={() =>
                      void patchLibrary(
                        { action: 'make-primary', documentId: book.id },
                        'Main rulebook updated.',
                        book.id,
                      )
                    }
                    type="button"
                  >
                  {busyId === book.id ? <LoaderCircle className="spin" size={18} /> : <Star size={18} />}
                    Make main
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
                  {book.isPrimary ? 'Main stays active' : book.isActive ? 'Exclude' : 'Include'}
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
      ) : !compact ? (
        <div className="notice-card notice-card--muted">
          Your library is empty. Upload a main rulebook first, then add supporting books as
          needed.
        </div>
      ) : null}

      {compact && books.length > 0 && (
        <div className="inline-actions">
          <button
            className="button button--ghost button--small"
            onClick={() => setShowDetails((current) => !current)}
            type="button"
          >
            {showDetails ? 'Hide rulebook tools' : 'Manage rulebooks'}
          </button>
        </div>
      )}

      {showCompactForm && (
      <form className={`library-form ${compact ? 'library-form--compact' : ''}`} onSubmit={handleUpload}>
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
              <option value="primary-rulebook">Main rulebook</option>
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
          PDF, Markdown, or plain text. One main rulebook, multiple supporting books. Larger PDFs are
          accepted, then normalized to Markdown during background processing for cleaner retrieval.
        </div>

        {message && <div className="notice-card">{message}</div>}

        <div className="inline-actions">
          <button className="button button--primary" disabled={isSaving} type="submit">
            {isSaving ? <LoaderCircle className="spin" size={18} /> : <Upload size={18} />}
            {replaceDocumentId ? 'Replace book' : 'Add book'}
          </button>
        </div>
      </form>
      )}
    </section>
  )
}
