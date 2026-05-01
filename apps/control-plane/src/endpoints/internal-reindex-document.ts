import type { Endpoint } from 'payload'

import { requireInternalToken } from '@/lib/access'
import { markDocumentIndexing, queueDocumentIngest } from '@/lib/document-ingest'

export const internalReindexDocumentEndpoint: Endpoint = {
  handler: async (req) => {
    const denied = requireInternalToken(req)
    if (denied) {
      return denied
    }

    const documentId = req.routeParams?.documentId ? String(req.routeParams.documentId) : ''
    if (!documentId) {
      return Response.json(
        {
          error: 'document_id_required',
          message: 'A document ID is required.',
        },
        { status: 400 },
      )
    }

    const document = await req.payload.findByID({
      collection: 'documents',
      depth: 0,
      id: documentId,
      overrideAccess: true,
    })

    await markDocumentIndexing(req.payload, document.id)
    queueDocumentIngest(req.payload, document.id, { alreadyMarkedIndexing: true })

    return Response.json(
      {
        documentId: String(document.id),
        ok: true,
        status: 'queued',
      },
      { status: 202 },
    )
  },
  method: 'post',
  path: '/gm/internal/documents/:documentId/reindex',
}
