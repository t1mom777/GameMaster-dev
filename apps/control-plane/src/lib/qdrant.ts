import { QdrantClient } from '@qdrant/js-client-rest'

export type KnowledgeChunk = {
  chunkIndex: number
  content: string
  docId: string
  docKind: string
  isActive: boolean
  isPrimary: boolean
  rulesetId: string | null
  sessionId: string | null
  title: string
}

export function getQdrantCollection(): string {
  return process.env.QDRANT_COLLECTION || 'gm_rulebook_chunks'
}

export function getQdrantClient(): QdrantClient {
  return new QdrantClient({
    apiKey: process.env.QDRANT_API_KEY || undefined,
    url: process.env.QDRANT_URL || 'http://127.0.0.1:6333',
  })
}

export async function ensureKnowledgeCollection(vectorSize: number): Promise<void> {
  const client = getQdrantClient()
  const collection = getQdrantCollection()
  let needsCreate = false

  try {
    const existing = await client.getCollection(collection)
    const configuredVectors = (existing as { config?: { params?: { vectors?: { size?: number } } } }).config?.params?.vectors

    if (configuredVectors?.size && configuredVectors.size !== vectorSize) {
      await client.deleteCollection(collection)
      needsCreate = true
    }
  } catch {
    needsCreate = true
  }

  if (needsCreate) {
    await client.createCollection(collection, {
      vectors: {
        distance: 'Cosine',
        size: vectorSize,
      },
    })
  }

  const indexedFields = [
    { field_name: 'doc_id', field_schema: 'keyword' as const },
    { field_name: 'ruleset_id', field_schema: 'keyword' as const },
    { field_name: 'session_id', field_schema: 'keyword' as const },
    { field_name: 'doc_kind', field_schema: 'keyword' as const },
    { field_name: 'is_active', field_schema: 'bool' as const },
    { field_name: 'is_primary', field_schema: 'bool' as const },
  ]

  for (const field of indexedFields) {
    try {
      await client.createPayloadIndex(collection, field)
    } catch {
      // Qdrant returns an error if the index already exists.
    }
  }
}
