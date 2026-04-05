import type { Endpoint } from 'payload'

import { requireAdmin } from '@/lib/access'
import { ingestDocument } from '@/lib/document-ingest'

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

    await req.payload.update({
      collection: 'documents',
      context: {
        skipDocumentSync: true,
      },
      data: {
        ingestError: '',
        reindexRequested: false,
        status: 'indexing',
      },
      id: String(document.id),
    })

    try {
      await ingestDocument(req.payload, document)
      return Response.json({ ok: true })
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
