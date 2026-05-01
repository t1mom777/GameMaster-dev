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
  {
    label: 'Inworld',
    value: 'inworld',
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
      admin: {
        description: 'The live TTS backend for player-owned sessions. Change this here, not in Runtime Defaults.',
      },
      defaultValue: 'deepgram',
      name: 'provider',
      options: providerOptions,
      required: true,
      type: 'select',
    },
    {
      admin: {
        description:
          'Voice id or model slug. For Inworld use a voice name like Sebastian. For Deepgram you can use a short suffix like thalia-en or a full voice id like aura-asteria-en.',
      },
      defaultValue: 'thalia-en',
      name: 'voice',
      required: true,
      type: 'text',
    },
    {
      admin: {
        description: 'Playback rate target. Use values below 1 for slower delivery.',
      },
      defaultValue: 1,
      name: 'speed',
      required: true,
      type: 'number',
    },
    {
      admin: {
        description: 'Optional tonal adjustment. Keep blank unless the selected provider supports it well.',
      },
      name: 'pitch',
      type: 'number',
    },
    {
      admin: {
        description:
          'Delivery instructions that shape sentence length, punctuation, tone, and table presence. This is the main place to tune voice archetype from the admin GUI.',
      },
      name: 'instructions',
      type: 'textarea',
    },
    {
      admin: {
        components: {
          Field: '@/components/admin/VoicePreviewField#VoicePreviewField',
        },
      },
      label: 'Preview',
      name: 'voicePreview',
      type: 'ui',
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
    {
      admin: {
        condition: (_, siblingData) => siblingData?.provider === 'inworld',
      },
      fields: [
        {
          admin: {
            description: 'Base64 Inworld API key. Prefer storing it in Coolify as INWORLD_API_KEY and leaving this editable for overrides.',
          },
          name: 'apiKey',
          type: 'text',
        },
        {
          defaultValue: 'inworld-tts-1.5-max',
          name: 'model',
          type: 'text',
        },
      ],
      name: 'inworld',
      type: 'group',
    },
  ],
}
