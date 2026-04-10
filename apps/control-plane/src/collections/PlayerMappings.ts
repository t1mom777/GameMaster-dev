import type { CollectionConfig } from 'payload'

import { hasAdminSession } from '@/lib/access'

function toRelationshipId(input: unknown): string {
  if (typeof input === 'number' || typeof input === 'string') {
    return String(input)
  }

  if (input && typeof input === 'object' && 'id' in input) {
    const candidate = input as { id?: number | string | null }
    if (candidate.id !== null && candidate.id !== undefined) {
      return String(candidate.id)
    }
  }

  return ''
}

export const PlayerMappings: CollectionConfig = {
  slug: 'player-mappings',
  access: {
    create: ({ req }) => hasAdminSession(req),
    delete: ({ req }) => hasAdminSession(req),
    read: ({ req }) => hasAdminSession(req),
    update: ({ req }) => hasAdminSession(req),
  },
  admin: {
    defaultColumns: ['mappedName', 'participantLabel', 'session', 'updatedAt'],
    group: 'Play',
    useAsTitle: 'mappedName',
  },
  fields: [
    {
      admin: {
        readOnly: true,
      },
      hooks: {
        beforeValidate: [
          ({ siblingData, value }) => {
            if (typeof value === 'string' && value.trim()) {
              return value
            }

            const sessionId = toRelationshipId(siblingData?.session)
            const identity = typeof siblingData?.livekitIdentity === 'string' ? siblingData.livekitIdentity.trim() : ''
            return sessionId && identity ? `${sessionId}:${identity}` : value
          },
        ],
      },
      index: true,
      name: 'mappingKey',
      required: true,
      type: 'text',
      unique: true,
    },
    {
      name: 'session',
      relationTo: 'game-sessions',
      required: true,
      type: 'relationship',
    },
    {
      index: true,
      name: 'livekitIdentity',
      required: true,
      type: 'text',
    },
    {
      name: 'participantLabel',
      required: true,
      type: 'text',
    },
    {
      name: 'mappedName',
      required: true,
      type: 'text',
    },
    {
      defaultValue: true,
      name: 'isConfirmed',
      type: 'checkbox',
    },
    {
      name: 'confirmedBy',
      relationTo: 'players',
      type: 'relationship',
    },
    {
      name: 'speakingNotes',
      type: 'textarea',
    },
    {
      name: 'lastConfirmedAt',
      type: 'date',
    },
  ],
}
