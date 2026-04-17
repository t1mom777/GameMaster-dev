type PendingLibraryBook = {
  ingestPhase?: string | null
  ingestProgress?: number | null
  status: string
  title: string
  updatedAt: string | null
}

const UPLOAD_QUEUE_MS = 15_000
const INDEXING_MS = 150_000

function elapsedMs(updatedAt: string | null, now: number): number {
  if (!updatedAt) {
    return 0
  }

  const timestamp = new Date(updatedAt).getTime()
  if (!Number.isFinite(timestamp)) {
    return 0
  }

  return Math.max(0, now - timestamp)
}

function clampPercent(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)))
}

export function getBookProgressPercent(book: PendingLibraryBook, now = Date.now()): number {
  if (typeof book.ingestProgress === 'number' && Number.isFinite(book.ingestProgress)) {
    return clampPercent(book.ingestProgress)
  }

  const elapsed = elapsedMs(book.updatedAt, now)

  switch (book.status) {
    case 'ready':
      return 100
    case 'error':
      return 100
    case 'uploaded':
      return clampPercent(22 + (elapsed / UPLOAD_QUEUE_MS) * 24, 22, 46)
    case 'indexing':
      return clampPercent(56 + (elapsed / INDEXING_MS) * 36, 56, 92)
    default:
      return 16
  }
}

export function getBookProgressDetail(book: PendingLibraryBook, now = Date.now()): string {
  if (book.ingestPhase) {
    switch (book.ingestPhase) {
      case 'uploading':
        return `${book.title} is uploading to the library now.`
      case 'queued':
        return `${book.title} uploaded successfully. The indexing worker is queued to start next.`
      case 'extracting':
        return `${book.title} is being read and text is being extracted from the source file.`
      case 'normalizing':
        return `${book.title} text is being normalized into Markdown for cleaner retrieval.`
      case 'chunking':
        return `${book.title} is being split into retrieval chunks for the vector index.`
      case 'embedding':
        return `${book.title} chunks are being embedded and stored for retrieval.`
      case 'complete':
        return `${book.title} is ready for retrieval and voice play.`
      case 'failed':
        return `${book.title} needs attention before it can ground the session.`
      default:
        break
    }
  }

  const elapsed = elapsedMs(book.updatedAt, now)

  switch (book.status) {
    case 'ready':
      return `${book.title} is ready for retrieval and voice play.`
    case 'error':
      return `${book.title} needs attention before it can ground the session.`
    case 'uploaded':
      if (elapsed > 60_000) {
        return `${book.title} is still moving into the indexing queue. Large PDFs can take a little longer to settle.`
      }
      return `${book.title} uploaded successfully. The parser and indexing worker are starting now.`
    case 'indexing':
      if (elapsed > 180_000) {
        return `${book.title} is still indexing. This is longer than normal, but large rulebooks can take several minutes.`
      }
      return `${book.title} is being parsed, normalized to Markdown, chunked, and embedded for retrieval.`
    default:
      return `${book.title} is waiting for processing to begin.`
  }
}

export function getOverallLibraryProgress(
  pendingBooks: PendingLibraryBook[],
  isSaving: boolean,
  uploadProgress: number | null,
  now = Date.now(),
): number {
  if (isSaving) {
    if (uploadProgress === null) {
      return 10
    }
    return clampPercent(uploadProgress, 4, 98)
  }

  if (!pendingBooks.length) {
    return 100
  }

  return Math.max(...pendingBooks.map((book) => getBookProgressPercent(book, now)))
}
