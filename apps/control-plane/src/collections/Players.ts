import type { CollectionConfig } from 'payload'

import { hasAdminSession } from '@/lib/access'

export const Players: CollectionConfig = {
  slug: 'players',
  access: {
    create: () => true,
    delete: ({ req }) => hasAdminSession(req),
    read: ({ req }) => hasAdminSession(req),
    update: ({ req }) => hasAdminSession(req),
  },
  admin: {
    defaultColumns: ['displayName', 'authProvider', 'email', 'lastSeenAt', 'preferredVoiceMode'],
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
