import fs from 'node:fs/promises'
import path from 'node:path'
import type { Endpoint } from 'payload'

import { requireInternalToken } from '@/lib/access'

type StorageProbeDocument = {
  filename?: string | null
  filesize?: number | null
  id?: number | string | null
  mimeType?: string | null
  sourceFilename?: string | null
  sourceMarkdown?: string | null
  url?: string | null
}

function resolveUploadPath(filename: string): string {
  return path.resolve(process.cwd(), 'media/documents', filename)
}

export const internalDocumentStorageEndpoint: Endpoint = {
  path: '/gm/internal/document-storage',
  method: 'get',
  handler: async (req) => {
    const denied = requireInternalToken(req)
    if (denied) {
      return denied
    }

    const documentId = req.searchParams.get('documentId')?.trim()
    if (!documentId) {
      return Response.json(
        {
          error: 'document_id_required',
          message: 'Pass documentId to inspect persisted document storage.',
        },
        { status: 400 },
      )
    }

    const document = (await req.payload.findByID({
      collection: 'documents',
      depth: 0,
      id: /^\d+$/.test(documentId) ? Number(documentId) : documentId,
      overrideAccess: true,
    } as never)) as StorageProbeDocument

    const sourceFilename = typeof document?.sourceFilename === 'string' ? document.sourceFilename : ''
    let uploadFileExists = false

    if (sourceFilename) {
      try {
        await fs.access(resolveUploadPath(sourceFilename))
        uploadFileExists = true
      } catch {
        uploadFileExists = false
      }
    }

    return Response.json({
      documentId: String(document?.id ?? documentId),
      sourceFilename: sourceFilename || null,
      sourceMarkdownStored: Boolean(document?.sourceMarkdown),
      uploadFileExists,
      uploadFieldsCleared: {
        filename: document?.filename ?? null,
        filesize: document?.filesize ?? null,
        mimeType: document?.mimeType ?? null,
        url: document?.url ?? null,
      },
    })
  },
}
