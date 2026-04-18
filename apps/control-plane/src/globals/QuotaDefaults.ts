import type { GlobalConfig } from 'payload'

import { hasAdminSession } from '@/lib/access'

export const QuotaDefaults: GlobalConfig = {
  slug: 'quota-defaults',
  access: {
    read: ({ req }) => hasAdminSession(req),
    update: ({ req }) => hasAdminSession(req),
  },
  admin: {
    group: 'People',
  },
  fields: [
    {
      admin: {
        description: 'Default tier assigned to new players.',
      },
      defaultValue: 'standard',
      name: 'quotaTier',
      options: [
        { label: 'Standard', value: 'standard' },
        { label: 'Priority', value: 'priority' },
        { label: 'Internal', value: 'internal' },
      ],
      required: true,
      type: 'select',
    },
    {
      admin: {
        description: 'Default monthly session allowance for new players.',
      },
      defaultValue: 12,
      min: 0,
      name: 'monthlySessionQuota',
      required: true,
      type: 'number',
    },
    {
      admin: {
        description: 'Default monthly voice minutes for new players.',
      },
      defaultValue: 600,
      min: 0,
      name: 'monthlyVoiceMinutes',
      required: true,
      type: 'number',
    },
    {
      admin: {
        description: 'Whether new players can create their own rooms by default.',
      },
      defaultValue: false,
      name: 'canCreateRooms',
      type: 'checkbox',
    },
    {
      admin: {
        description: 'Default voice mode for new players.',
      },
      defaultValue: 'auto-vad',
      name: 'preferredVoiceMode',
      options: [
        { label: 'Auto VAD', value: 'auto-vad' },
        { label: 'Push to talk', value: 'push-to-talk' },
        { label: 'Text only', value: 'text-only' },
      ],
      type: 'select',
    },
  ],
}
