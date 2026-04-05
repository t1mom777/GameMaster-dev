import fs from 'fs/promises'
import path from 'path'
import pdfParse from 'pdf-parse'
import type { Payload } from 'payload'

import { embedText } from './embeddings'
import { ensureKnowledgeCollection, getQdrantClient, getQdrantCollection } from './qdrant'

type DocumentRecord = {
  chunkCount?: number | null
  filename?: string | null
  id: number | string
  isActive?: boolean | null
  isPrimary?: boolean | null
  kind?: string | null
  ruleset?: { id?: string | number } | string | number | null
  session?: { id?: string | number } | string | number | null
  title?: string | null
}

const TEXT_MIME_TYPES = new Set(['text/plain', 'text/markdown'])

function resolveUploadPath(filename: string): string {
  return path.resolve(process.cwd(), 'media/documents', filename)
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

  return chunks
}

async function extractText(document: DocumentRecord): Promise<string> {
  if (!document.filename) {
    throw new Error('Document is missing a file payload.')
  }

  const filePath = resolveUploadPath(document.filename)
  const buffer = await fs.readFile(filePath)
  const extension = path.extname(document.filename).toLowerCase()

  if (extension === '.pdf') {
    const parsed = await pdfParse(buffer)
    return parsed.text ?? ''
  }

  if (TEXT_MIME_TYPES.has(extension === '.md' ? 'text/markdown' : 'text/plain') || extension === '.txt' || extension === '.md') {
    return buffer.toString('utf-8')
  }

  throw new Error(`Unsupported document type: ${extension || 'unknown'}`)
}

function relationId(input: { id?: string | number } | string | number | null | undefined): string | null {
  if (!input) {
    return null
  }

  if (typeof input === 'string' || typeof input === 'number') {
    return String(input)
  }

  return input.id !== undefined ? String(input.id) : null
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

export async function ingestDocument(payload: Payload, document: DocumentRecord): Promise<void> {
  const rawText = await extractText(document)
  const chunks = chunkText(rawText)

  if (!chunks.length) {
    throw new Error('No extractable text was found in the uploaded document.')
  }

  const firstEmbedding = await embedText(chunks[0]!)
  await ensureKnowledgeCollection(firstEmbedding.length)

  const client = getQdrantClient()
  const collection = getQdrantCollection()

  await removeDocumentVectors(String(document.id))

  const rulesetId = relationId(document.ruleset)
  const sessionId = relationId(document.session)

  const points = [firstEmbedding, ...(await Promise.all(chunks.slice(1).map((chunk) => embedText(chunk))))].map(
    (vector, index) => ({
      id: `${document.id}:${index}`,
      payload: {
        chunk_index: index,
        content: chunks[index],
        doc_id: document.id,
        doc_kind: document.kind || 'supporting-book',
        is_active: document.isActive ?? true,
        is_primary: document.isPrimary ?? false,
        ruleset_id: rulesetId,
        session_id: sessionId,
        title: document.title || 'Untitled document',
      },
      vector,
    }),
  )

  await client.upsert(collection, {
    points,
    wait: true,
  })

  await payload.update({
    collection: 'documents',
    context: {
      skipDocumentSync: true,
    },
    data: {
      chunkCount: chunks.length,
      ingestError: '',
      lastIngestedAt: new Date().toISOString(),
      status: 'ready',
    },
    id: document.id,
  })
}
