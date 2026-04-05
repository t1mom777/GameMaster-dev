import path from 'path'
import type { CollectionConfig } from 'payload'

import { hasAdminSession } from '@/lib/access'
import { ingestDocument, removeDocumentVectors } from '@/lib/document-ingest'
import { toSlug } from '@/lib/slug'

const uploadDirectory = path.resolve(process.cwd(), 'media/documents')

export const Documents: CollectionConfig = {
  slug: 'documents',
  access: {
    create: ({ req }) => hasAdminSession(req),
    delete: ({ req }) => hasAdminSession(req),
    read: ({ req }) => hasAdminSession(req),
    update: ({ req }) => hasAdminSession(req),
  },
  admin: {
    defaultColumns: ['title', 'kind', 'status', 'ruleset', 'updatedAt'],
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      required: true,
      type: 'text',
    },
    {
      hooks: {
        beforeValidate: [
          ({ siblingData, value }) => {
            if (typeof value === 'string' && value.trim()) {
              return toSlug(value)
            }
            return toSlug(String(siblingData?.title || 'document'))
          },
        ],
      },
      index: true,
      name: 'slug',
      required: true,
      type: 'text',
      unique: true,
    },
    {
      defaultValue: 'supporting-book',
      name: 'kind',
      options: [
        { label: 'Primary rulebook', value: 'primary-rulebook' },
        { label: 'Supporting book', value: 'supporting-book' },
        { label: 'Lore pack', value: 'lore-pack' },
      ],
      required: true,
      type: 'select',
    },
    {
      defaultValue: 'uploaded',
      name: 'status',
      options: [
        { label: 'Uploaded', value: 'uploaded' },
        { label: 'Indexing', value: 'indexing' },
        { label: 'Ready', value: 'ready' },
        { label: 'Error', value: 'error' },
      ],
      required: true,
      type: 'select',
    },
    {
      defaultValue: true,
      name: 'isActive',
      type: 'checkbox',
    },
    {
      defaultValue: false,
      name: 'isPrimary',
      type: 'checkbox',
    },
    {
      name: 'ruleset',
      relationTo: 'rulesets',
      type: 'relationship',
    },
    {
      name: 'session',
      relationTo: 'game-sessions',
      type: 'relationship',
    },
    {
      admin: {
        description: 'Check and save when you need a full re-index.',
      },
      defaultValue: false,
      name: 'reindexRequested',
      type: 'checkbox',
    },
    {
      admin: {
        readOnly: true,
      },
      name: 'chunkCount',
      type: 'number',
    },
    {
      admin: {
        readOnly: true,
      },
      name: 'lastIngestedAt',
      type: 'date',
    },
    {
      admin: {
        readOnly: true,
      },
      name: 'ingestError',
      type: 'textarea',
    },
  ],
  hooks: {
    afterChange: [
      async ({ doc, operation, previousDoc, req }) => {
        if (req.context?.skipDocumentSync || !doc.filename) {
          return doc
        }

        const fileChanged = previousDoc?.filename !== doc.filename
        const shouldIngest =
          operation === 'create' || fileChanged || doc.reindexRequested || previousDoc?.status !== 'ready'

        if (!shouldIngest) {
          return doc
        }

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
          id: doc.id,
        })

        try {
          await ingestDocument(req.payload, doc)
        } catch (error) {
          await req.payload.update({
            collection: 'documents',
            context: {
              skipDocumentSync: true,
            },
            data: {
              ingestError: error instanceof Error ? error.message : 'Unknown ingest error',
              reindexRequested: false,
              status: 'error',
            },
            id: doc.id,
          })
        }

        return doc
      },
    ],
    afterDelete: [
      async ({ doc }) => {
        await removeDocumentVectors(String(doc.id))
      },
    ],
    beforeValidate: [
      ({ data, originalDoc }) => {
        const nextData = data || {}
        const incomingTitle = typeof nextData?.title === 'string' && nextData.title.trim() ? nextData.title : ''

        if (!incomingTitle) {
          const filename =
            (typeof nextData?.filename === 'string' && nextData.filename) ||
            (typeof originalDoc?.filename === 'string' && originalDoc.filename) ||
            'Untitled document'
          nextData.title = filename.replace(/\.[^.]+$/, '')
        }

        if (nextData?.kind === 'primary-rulebook') {
          nextData.isPrimary = true
        }

        return nextData
      },
    ],
  },
  upload: {
    mimeTypes: ['application/pdf', 'text/plain', 'text/markdown'],
    staticDir: uploadDirectory,
  },
}
