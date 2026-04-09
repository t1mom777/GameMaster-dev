import type { Endpoint } from 'payload'
import { z } from 'zod'

import { requireInternalToken } from '@/lib/access'
import { embedText } from '@/lib/embeddings'
import { getQdrantClient, getQdrantCollection } from '@/lib/qdrant'
import { loadRuntimeContext } from '@/lib/session-runtime'

const retrieveSchema = z.object({
  query: z.string().trim().min(2),
  roomName: z.string().trim().min(1),
})

export const runtimeRetrieveEndpoint: Endpoint = {
  handler: async (req) => {
    const denied = requireInternalToken(req)
    if (denied) {
      return denied
    }

    const body = req.json ? await req.json() : {}
    const data = retrieveSchema.parse(body)
    const sessions = await req.payload.find({
      collection: 'game-sessions',
      depth: 1,
      limit: 1,
      where: {
        roomName: {
          equals: data.roomName,
        },
      },
    })

    const session = sessions.docs[0]
    if (!session) {
      return Response.json(
        {
          error: 'session_not_found',
          message: 'The requested room is not mapped to a session.',
        },
        { status: 404 },
      )
    }

    const runtime = await loadRuntimeContext(req.payload, session)
    if (!runtime.activeDocumentIds.length) {
      return Response.json({ hits: [] })
    }
    const activeDocumentFilterValues = runtime.activeDocumentIds.map((id) => {
      const numericId = Number(id)
      return Number.isInteger(numericId) ? numericId : id
    })

    const queryVector = await embedText(data.query)
    const client = getQdrantClient()
    const search = await client.search(getQdrantCollection(), {
      filter: {
        must: [
          {
            key: 'doc_id',
            match: {
              any: activeDocumentFilterValues,
            },
          },
        ],
      },
      limit: runtime.runtimeDefaults.retrievalTopK || 5,
      vector: queryVector,
      with_payload: true,
    })

    return Response.json({
      hits: search.map((point) => ({
        score: point.score,
        snippet: point.payload?.content,
        title: point.payload?.title,
      })),
    })
  },
  method: 'post',
  path: '/gm/runtime/retrieve',
}
