import type { Endpoint } from 'payload'

import { requireAdmin } from '@/lib/access'
import { markDocumentIndexing, queueDocumentIngest } from '@/lib/document-ingest'

export const adminReindexDocumentEndpoint: Endpoint = {
  handler: async (req) => {
    const denied = requireAdmin(req)
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
    })

    try {
      await markDocumentIndexing(req.payload, document.id)
      queueDocumentIngest(req.payload, document.id, { alreadyMarkedIndexing: true })

      return Response.json(
        {
          ok: true,
          status: 'queued',
        },
        { status: 202 },
      )
    } catch (error) {
      await req.payload.update({
        collection: 'documents',
        context: {
          skipDocumentSync: true,
        },
        data: {
          ingestError: error instanceof Error ? error.message : 'Unknown ingest error',
          status: 'error',
        },
        id: String(document.id),
      })

      return Response.json(
        {
          error: 'ingest_failed',
          message: error instanceof Error ? error.message : 'Unknown ingest error',
        },
        { status: 500 },
      )
    }
  },
  method: 'post',
  path: '/gm/admin/documents/:documentId/reindex',
}
