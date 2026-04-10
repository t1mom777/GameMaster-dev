import type { CollectionConfig } from 'payload'

import { hasAdminSession } from '@/lib/access'

export const Players: CollectionConfig = {
  slug: 'players',
  access: {
    create: ({ req }) => hasAdminSession(req),
    delete: ({ req }) => hasAdminSession(req),
    read: ({ req }) => hasAdminSession(req),
    update: ({ req }) => hasAdminSession(req),
  },
  admin: {
    defaultColumns: ['displayName', 'status', 'quotaTier', 'email', 'lastSeenAt'],
    group: 'People',
    useAsTitle: 'displayName',
  },
  fields: [
    {
      name: 'displayName',
      required: true,
      type: 'text',
    },
    {
      defaultValue: 'guest',
      name: 'authProvider',
      options: [
        {
          label: 'Guest',
          value: 'guest',
        },
        {
          label: 'Google',
          value: 'google',
        },
      ],
      required: true,
      type: 'select',
    },
    {
      name: 'email',
      type: 'email',
    },
    {
      admin: {
        readOnly: true,
      },
      index: true,
      name: 'googleSub',
      type: 'text',
      unique: true,
    },
    {
      name: 'avatarUrl',
      type: 'text',
    },
    {
      admin: {
        description: 'Optional personal reference book that follows this player into the rooms they join.',
      },
      name: 'personalRulebook',
      relationTo: 'documents',
      type: 'relationship',
    },
    {
      defaultValue: 'active',
      name: 'status',
      options: [
        {
          label: 'Active',
          value: 'active',
        },
        {
          label: 'Suspended',
          value: 'suspended',
        },
      ],
      required: true,
      type: 'select',
    },
    {
      defaultValue: 'standard',
      name: 'quotaTier',
      options: [
        {
          label: 'Standard',
          value: 'standard',
        },
        {
          label: 'Priority',
          value: 'priority',
        },
        {
          label: 'Internal',
          value: 'internal',
        },
      ],
      required: true,
      type: 'select',
    },
    {
      admin: {
        description: 'Soft quota metadata for operator planning.',
      },
      defaultValue: 12,
      min: 0,
      name: 'monthlySessionQuota',
      type: 'number',
    },
    {
      admin: {
        description: 'Soft quota metadata for voice usage planning.',
      },
      defaultValue: 600,
      min: 0,
      name: 'monthlyVoiceMinutes',
      type: 'number',
    },
    {
      defaultValue: false,
      name: 'canCreateRooms',
      type: 'checkbox',
    },
    {
      name: 'accessNotes',
      type: 'textarea',
    },
    {
      defaultValue: 'auto-vad',
      name: 'preferredVoiceMode',
      options: [
        {
          label: 'Auto VAD',
          value: 'auto-vad',
        },
        {
          label: 'Push to talk',
          value: 'push-to-talk',
        },
        {
          label: 'Text only',
          value: 'text-only',
        },
      ],
      type: 'select',
    },
    {
      name: 'lastSeenAt',
      type: 'date',
    },
    {
      name: 'lastRoomName',
      type: 'text',
    },
  ],
}
