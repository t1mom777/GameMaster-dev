import type { GlobalConfig } from 'payload'

import { hasAdminSession } from '@/lib/access'

const providerOptions = [
  {
    label: 'OpenAI',
    value: 'openai',
  },
  {
    label: 'Deepgram',
    value: 'deepgram',
  },
  {
    label: 'ElevenLabs',
    value: 'elevenlabs',
  },
]

export const VoiceSettings: GlobalConfig = {
  slug: 'voice-settings',
  access: {
    read: ({ req }) => hasAdminSession(req),
    update: ({ req }) => hasAdminSession(req),
  },
  admin: {
    group: 'Platform',
  },
  fields: [
    {
      defaultValue: 'deepgram',
      name: 'provider',
      options: providerOptions,
      required: true,
      type: 'select',
    },
    {
      defaultValue: 'thalia-en',
      name: 'voice',
      required: true,
      type: 'text',
    },
    {
      defaultValue: 1,
      name: 'speed',
      required: true,
      type: 'number',
    },
    {
      name: 'pitch',
      type: 'number',
    },
    {
      name: 'instructions',
      type: 'textarea',
    },
    {
      admin: {
        condition: (_, siblingData) => siblingData?.provider === 'openai',
      },
      fields: [
        {
          name: 'apiKey',
          type: 'text',
        },
        {
          defaultValue: 'gpt-4o-mini-tts',
          name: 'model',
          type: 'text',
        },
      ],
      name: 'openai',
      type: 'group',
    },
    {
      admin: {
        condition: (_, siblingData) => siblingData?.provider === 'deepgram',
      },
      fields: [
        {
          name: 'apiKey',
          type: 'text',
        },
        {
          defaultValue: 'aura-2',
          name: 'model',
          type: 'text',
        },
      ],
      name: 'deepgram',
      type: 'group',
    },
    {
      admin: {
        condition: (_, siblingData) => siblingData?.provider === 'elevenlabs',
      },
      fields: [
        {
          name: 'apiKey',
          type: 'text',
        },
        {
          name: 'voiceId',
          type: 'text',
        },
      ],
      name: 'elevenlabs',
      type: 'group',
    },
  ],
}
