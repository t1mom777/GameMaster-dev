import crypto from 'node:crypto'
import fs from 'fs/promises'
import path from 'path'
import pdfParse from 'pdf-parse'
import type { Payload, PayloadRequest } from 'payload'

import { normalizeDocumentToMarkdown } from './document-markdown'
import { embedTexts } from './embeddings'
import { ensureKnowledgeCollection, getQdrantClient, getQdrantCollection } from './qdrant'

type DocumentRecord = {
  chunkCount?: number | null
  filename?: string | null
  filesize?: number | null
  id: number | string
  ingestPhase?: string | null
  ingestProgress?: number | null
  isActive?: boolean | null
  isPrimary?: boolean | null
  kind?: string | null
  mimeType?: string | null
  ruleset?: { id?: string | number } | string | number | null
  session?: { id?: string | number } | string | number | null
  sourceFilename?: string | null
  sourceFilesize?: number | null
  sourceMarkdown?: string | null
  sourceMimeType?: string | null
  title?: string | null
  url?: string | null
}

type QueueDocumentIngestOptions = {
  alreadyMarkedIndexing?: boolean
}

const TEXT_MIME_TYPES = new Set(['text/plain', 'text/markdown'])
const QDRANT_UPSERT_BATCH_SIZE = positiveIntegerFromEnv('DOCUMENT_QDRANT_UPSERT_BATCH_SIZE', 64)
const QDRANT_UPSERT_MAX_ATTEMPTS = 4
const inflightDocumentIngests = new Set<string>()

type QdrantClientInstance = ReturnType<typeof getQdrantClient>
type QdrantPoint = {
  id: number | string
  payload: Record<string, unknown>
  vector: number[]
}

type DocumentStatusPatch = {
  chunkCount?: number | null
  filename?: string | null
  filesize?: number | null
  ingestError?: string
  ingestPhase?: string
  ingestProgress?: number | null
  lastIngestedAt?: string
  mimeType?: string | null
  reindexRequested?: boolean
  status?: 'error' | 'indexing' | 'ready' | 'uploaded'
  sourceFilename?: string | null
  sourceFilesize?: number | null
  sourceMarkdown?: string | null
  sourceMimeType?: string | null
  url?: string | null
}

function resolveUploadPath(filename: string): string {
  return path.resolve(process.cwd(), 'media/documents', filename)
}

function positiveIntegerFromEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function progressForBatch(
  batchIndex: number,
  totalBatches: number,
  start: number,
  end: number,
): number {
  if (totalBatches <= 0) {
    return start
  }

  const ratio = Math.min(1, Math.max(0, (batchIndex + 1) / totalBatches))
  return Math.min(end, Math.max(start, Math.round(start + (end - start) * ratio)))
}

function errorCode(error: unknown): string {
  return error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code)
    : ''
}

function isRetriableNetworkError(error: unknown): boolean {
  const code = errorCode(error).toUpperCase()
  if (['EPIPE', 'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'].includes(code)) {
    return true
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return (
    message.includes('fetch failed') ||
    message.includes('bad gateway') ||
    message.includes('socket') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('429') ||
    message.includes('500') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('504')
  )
}

async function upsertPointsWithRetry(
  client: QdrantClientInstance,
  collection: string,
  points: QdrantPoint[],
): Promise<void> {
  let lastError: unknown

  for (let attempt = 1; attempt <= QDRANT_UPSERT_MAX_ATTEMPTS; attempt += 1) {
    try {
      await client.upsert(collection, {
        points,
        wait: true,
      })
      return
    } catch (error) {
      lastError = error
      if (attempt >= QDRANT_UPSERT_MAX_ATTEMPTS || !isRetriableNetworkError(error)) {
        break
      }

      await sleep(500 * attempt)
    }
  }

  throw lastError
}

function chunkText(input: string, maxLength = 1200, overlap = 200): string[] {
  const normalized = input.replace(/\r/g, '').trim()
  if (!normalized) {
    return []
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  const chunks: string[] = []
  let current = ''

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph
    if (candidate.length <= maxLength) {
      current = candidate
      continue
    }

    if (current) {
      chunks.push(current)
    }

    if (paragraph.length <= maxLength) {
      current = paragraph
      continue
    }

    let start = 0
    while (start < paragraph.length) {
      const end = Math.min(start + maxLength, paragraph.length)
      chunks.push(paragraph.slice(start, end))
      start = Math.max(end - overlap, start + 1)
    }
    current = ''
  }

  if (current) {
    chunks.push(current)
  }

  return mergeSmallChunks(chunks)
}

function mergeSmallChunks(chunks: string[], minLength = 700, maxLength = 1400): string[] {
  if (!chunks.length) {
    return []
  }

  const merged: string[] = []
  let current = ''

  for (const chunk of chunks) {
    if (!current) {
      current = chunk
      continue
    }

    const candidate = `${current}\n\n${chunk}`

    if (current.length < minLength && candidate.length <= maxLength) {
      current = candidate
      continue
    }

    if (chunk.length < Math.floor(minLength / 2) && candidate.length <= maxLength) {
      current = candidate
      continue
    }

    merged.push(current)
    current = chunk
  }

  if (current) {
    merged.push(current)
  }

  return merged
}

async function extractMarkdown(document: DocumentRecord): Promise<string> {
  if (document.sourceMarkdown?.trim()) {
    return document.sourceMarkdown
  }

  if (!document.filename) {
    throw new Error('Document is missing a file payload.')
  }

  const filePath = resolveUploadPath(document.filename)
  const buffer = await fs.readFile(filePath)
  const extension = path.extname(document.filename).toLowerCase()

  if (extension === '.pdf') {
    const parsed = await pdfParse(buffer)
    return normalizeDocumentToMarkdown({
      extension: '.pdf',
      text: parsed.text ?? '',
    })
  }

  if (
    TEXT_MIME_TYPES.has(extension === '.md' ? 'text/markdown' : 'text/plain') ||
    extension === '.txt' ||
    extension === '.md'
  ) {
    return normalizeDocumentToMarkdown({
      extension: extension === '.md' ? '.md' : '.txt',
      text: buffer.toString('utf-8'),
    })
  }

  throw new Error(`Unsupported document type: ${extension || 'unknown'}`)
}

function relationId(
  input: { id?: string | number } | string | number | null | undefined,
): string | null {
  if (!input) {
    return null
  }

  if (typeof input === 'string' || typeof input === 'number') {
    return String(input)
  }

  return input.id !== undefined ? String(input.id) : null
}

async function patchIngestProgress(
  payload: Payload,
  documentId: number | string,
  phase: string,
  progress: number,
  req?: PayloadRequest,
): Promise<void> {
  await patchDocumentRecord(
    payload,
    documentId,
    {
      ingestPhase: phase,
      ingestProgress: progress,
      status: progress >= 100 ? 'ready' : 'indexing',
    },
    req,
  )
}

function qdrantPointId(documentId: number | string, chunkIndex: number): number | string {
  const numericId = Number(documentId)

  if (Number.isInteger(numericId) && numericId >= 0) {
    return numericId * 100000 + chunkIndex
  }

  const hex = crypto
    .createHash('sha1')
    .update(`${documentId}:${chunkIndex}`)
    .digest('hex')
    .slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function normalizeDocumentId(input: number | string): number | string {
  if (typeof input === 'number') {
    return input
  }

  return /^\d+$/.test(input) ? Number(input) : input
}

function buildQdrantPayload(
  document: DocumentRecord,
  chunkIndex: number,
  chunk: string,
  rulesetId: string | null,
  sessionId: string | null,
) {
  return {
    chunk_index: chunkIndex,
    content: chunk,
    doc_id: String(document.id),
    doc_kind: document.kind || 'supporting-book',
    is_active: document.isActive ?? true,
    is_primary: document.isPrimary ?? false,
    ...(rulesetId ? { ruleset_id: rulesetId } : {}),
    ...(sessionId ? { session_id: sessionId } : {}),
    title: document.title || 'Untitled document',
  }
}

async function deleteUploadedFile(filename?: string | null): Promise<void> {
  if (!filename) {
    return
  }

  try {
    await fs.unlink(resolveUploadPath(filename))
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code)
        : ''
    if (code !== 'ENOENT') {
      throw error
    }
  }
}

async function patchDocumentRecord(
  payload: Payload,
  documentId: number | string,
  data: DocumentStatusPatch,
  req?: PayloadRequest,
): Promise<void> {
  await payload.db.updateOne({
    collection: 'documents',
    data,
    id: normalizeDocumentId(documentId),
    req,
    returning: false,
  })
}

async function loadDocumentRecord(
  payload: Payload,
  documentId: number | string,
  req?: PayloadRequest,
): Promise<DocumentRecord> {
  const document = await payload.findByID({
    collection: 'documents',
    depth: 0,
    id: normalizeDocumentId(documentId),
    overrideAccess: true,
    req,
  } as never)

  return document as DocumentRecord
}

function describeIngestError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    const candidate = error as Error & {
      cause?: unknown
      data?: unknown
      response?: { data?: unknown; status?: number; statusText?: string }
    }

    const responseData =
      (candidate.response && typeof candidate.response === 'object' && 'data' in candidate.response
        ? candidate.response.data
        : undefined) ??
      ('data' in candidate && candidate.data ? candidate.data : undefined) ??
      candidate.cause

    if (typeof responseData === 'string' && responseData.trim()) {
      return `${error.message}: ${responseData.trim()}`
    }

    if (responseData && typeof responseData === 'object') {
      try {
        return `${error.message}: ${JSON.stringify(responseData)}`
      } catch {
        return error.message
      }
    }

    return error.message
  }

  return 'Unable to index this book right now.'
}

export async function markDocumentIndexing(
  payload: Payload,
  documentId: number | string,
  req?: PayloadRequest,
): Promise<void> {
  await patchDocumentRecord(
    payload,
    documentId,
    {
      ingestError: '',
      ingestPhase: 'queued',
      ingestProgress: 12,
      reindexRequested: false,
      status: 'indexing',
    },
    req,
  )
}

export async function markDocumentIngestError(
  payload: Payload,
  documentId: number | string,
  message: string,
  req?: PayloadRequest,
): Promise<void> {
  await patchDocumentRecord(
    payload,
    documentId,
    {
      ingestError: message,
      ingestPhase: 'failed',
      ingestProgress: 100,
      reindexRequested: false,
      status: 'error',
    },
    req,
  )
}

export async function removeDocumentVectors(docId: string): Promise<void> {
  const client = getQdrantClient()
  await client.delete(getQdrantCollection(), {
    filter: {
      must: [
        {
          key: 'doc_id',
          match: {
            value: docId,
          },
        },
      ],
    },
    wait: true,
  })
}

export async function ingestDocument(
  payload: Payload,
  document: DocumentRecord,
  req?: PayloadRequest,
): Promise<void> {
  await patchIngestProgress(payload, document.id, 'extracting', 22, req)
  const canonicalMarkdown = await extractMarkdown(document)
  await patchIngestProgress(payload, document.id, 'normalizing', 42, req)
  const chunks = chunkText(canonicalMarkdown)

  if (!chunks.length) {
    throw new Error('No extractable text was found in the uploaded document.')
  }

  await patchDocumentRecord(
    payload,
    document.id,
    {
      sourceFilename: document.sourceFilename || document.filename || null,
      sourceFilesize:
        typeof document.sourceFilesize === 'number'
          ? document.sourceFilesize
          : document.filesize || null,
      sourceMarkdown: canonicalMarkdown,
      sourceMimeType:
        document.sourceMimeType ||
        document.mimeType ||
        (document.filename?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'text/plain'),
    },
    req,
  )

  await patchIngestProgress(payload, document.id, 'chunking', 56, req)
  const client = getQdrantClient()
  const collection = getQdrantCollection()
  const rulesetId = relationId(document.ruleset)
  const sessionId = relationId(document.session)
  const totalBatches = Math.ceil(chunks.length / QDRANT_UPSERT_BATCH_SIZE)
  let collectionReady = false
  let indexedChunks = 0

  for (let start = 0; start < chunks.length; start += QDRANT_UPSERT_BATCH_SIZE) {
    const batchIndex = Math.floor(start / QDRANT_UPSERT_BATCH_SIZE)
    const chunkBatch = chunks.slice(start, start + QDRANT_UPSERT_BATCH_SIZE)
    const batchLabel = `${batchIndex + 1}/${totalBatches}`

    await patchIngestProgress(
      payload,
      document.id,
      `embedding ${batchLabel}`,
      progressForBatch(batchIndex, totalBatches, 68, 86),
      req,
    )

    const vectors = await embedTexts(chunkBatch)
    const firstVector = vectors.find((vector) => vector?.length)

    if (!firstVector?.length) {
      throw new Error(`No embeddings were generated for document batch ${batchLabel}.`)
    }

    if (!collectionReady) {
      await ensureKnowledgeCollection(firstVector.length)
      await removeDocumentVectors(String(document.id))
      collectionReady = true
    }

    const points = vectors
      .map((vector, offset) => {
        const chunkIndex = start + offset
        if (!vector?.length) {
          return null
        }

        return {
          id: qdrantPointId(document.id, chunkIndex),
          payload: buildQdrantPayload(
            document,
            chunkIndex,
            chunks[chunkIndex] || '',
            rulesetId,
            sessionId,
          ) as Record<string, unknown>,
          vector,
        } satisfies QdrantPoint
      })
      .filter((point): point is QdrantPoint => Boolean(point))

    if (!points.length) {
      throw new Error(`No Qdrant points were generated for document batch ${batchLabel}.`)
    }

    await patchIngestProgress(
      payload,
      document.id,
      `indexing ${batchLabel}`,
      progressForBatch(batchIndex, totalBatches, 87, 96),
      req,
    )
    await upsertPointsWithRetry(client, collection, points)
    indexedChunks += points.length
  }

  if (!indexedChunks) {
    throw new Error('No embeddings were indexed for this document.')
  }

  await deleteUploadedFile(document.filename)

  await patchDocumentRecord(
    payload,
    document.id,
    {
      chunkCount: chunks.length,
      ingestError: '',
      ingestPhase: 'complete',
      ingestProgress: 100,
      lastIngestedAt: new Date().toISOString(),
      status: 'ready',
      ...(document.filename
        ? {
            filename: null,
            filesize: null,
            mimeType: null,
            url: null,
          }
        : {}),
    },
    req,
  )
}

export function queueDocumentIngest(
  payload: Payload,
  documentId: number | string,
  options?: QueueDocumentIngestOptions,
): void {
  const inflightKey = String(documentId)
  if (inflightDocumentIngests.has(inflightKey)) {
    return
  }

  inflightDocumentIngests.add(inflightKey)

  setImmediate(() => {
    void (async () => {
      try {
        if (!options?.alreadyMarkedIndexing) {
          await markDocumentIndexing(payload, documentId)
        }

        const document = await loadDocumentRecord(payload, documentId)
        await ingestDocument(payload, document)
      } catch (error) {
        await markDocumentIngestError(payload, documentId, describeIngestError(error))
      } finally {
        inflightDocumentIngests.delete(inflightKey)
      }
    })()
  })
}
