import type { CollectionConfig } from 'payload'

import { hasAdminSession } from '@/lib/access'
import { toSlug } from '@/lib/slug'

export const ProviderConnections: CollectionConfig = {
  slug: 'provider-connections',
  access: {
    create: ({ req }) => hasAdminSession(req),
    delete: ({ req }) => hasAdminSession(req),
    read: ({ req }) => hasAdminSession(req),
    update: ({ req }) => hasAdminSession(req),
  },
  admin: {
    defaultColumns: ['label', 'provider', 'enabled', 'updatedAt'],
    group: 'Runtime',
    useAsTitle: 'label',
  },
  fields: [
    {
      name: 'label',
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
            return toSlug(String(siblingData?.label || 'provider-connection'))
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
      defaultValue: 'gemini',
      name: 'provider',
      options: [
        { label: 'Gemini', value: 'gemini' },
        { label: 'OpenAI', value: 'openai' },
        { label: 'Deepgram', value: 'deepgram' },
        { label: 'LiveKit', value: 'livekit' },
      ],
      required: true,
      type: 'select',
    },
    {
      defaultValue: true,
      name: 'enabled',
      type: 'checkbox',
    },
    {
      name: 'llmModel',
      type: 'text',
    },
    {
      name: 'sttModel',
      type: 'text',
    },
    {
      name: 'ttsModel',
      type: 'text',
    },
    {
      name: 'notes',
      type: 'textarea',
    },
  ],
}
