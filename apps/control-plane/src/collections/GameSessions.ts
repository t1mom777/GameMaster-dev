import type { CollectionConfig } from 'payload'

import { hasAdminSession } from '@/lib/access'
import { toSlug } from '@/lib/slug'

export const GameSessions: CollectionConfig = {
  slug: 'game-sessions',
  access: {
    create: ({ req }) => hasAdminSession(req),
    delete: ({ req }) => hasAdminSession(req),
    read: ({ req }) => hasAdminSession(req),
    update: ({ req }) => hasAdminSession(req),
  },
  admin: {
    defaultColumns: ['title', 'status', 'roomName', 'publicJoinEnabled', 'allowGuests', 'scheduledFor'],
    group: 'Play',
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
            return toSlug(String(siblingData?.title || 'session'))
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
      defaultValue: 'scheduled',
      name: 'status',
      options: [
        { label: 'Scheduled', value: 'scheduled' },
        { label: 'Live', value: 'live' },
        { label: 'Ended', value: 'ended' },
      ],
      required: true,
      type: 'select',
    },
    {
      hooks: {
        beforeValidate: [
          ({ siblingData, value }) => {
            if (typeof value === 'string' && value.trim()) {
              return toSlug(value)
            }
            return toSlug(String(siblingData?.slug || siblingData?.title || 'gm-room'))
          },
        ],
      },
      index: true,
      name: 'roomName',
      required: true,
      type: 'text',
      unique: true,
    },
    {
      admin: {
        description: 'When enabled, the room can appear in the player app and accept sign-ins.',
      },
      defaultValue: true,
      label: 'Open to any signed-in player',
      name: 'allowGuests',
      type: 'checkbox',
    },
    {
      admin: {
        description: 'When disabled, the room is hidden from the player app and public join flow.',
      },
      defaultValue: true,
      label: 'Visible in the player app',
      name: 'publicJoinEnabled',
      type: 'checkbox',
    },
    {
      name: 'scheduledFor',
      type: 'date',
    },
    {
      name: 'campaign',
      relationTo: 'campaigns',
      type: 'relationship',
    },
    {
      name: 'world',
      relationTo: 'worlds',
      type: 'relationship',
    },
    {
      name: 'ruleset',
      relationTo: 'rulesets',
      type: 'relationship',
    },
    {
      admin: {
        condition: (_, siblingData) => siblingData?.allowGuests === false,
        description:
          'Only these signed-in players can see and enter the room when the room is not open to all players.',
      },
      hasMany: true,
      name: 'allowedPlayers',
      relationTo: 'players',
      type: 'relationship',
    },
    {
      hasMany: true,
      name: 'activeDocuments',
      relationTo: 'documents',
      type: 'relationship',
    },
    {
      name: 'publicSummary',
      type: 'textarea',
    },
    {
      name: 'welcomeText',
      type: 'textarea',
    },
  ],
}
