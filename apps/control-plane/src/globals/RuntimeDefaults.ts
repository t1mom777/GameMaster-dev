import type { GlobalConfig } from 'payload'

import { hasAdminSession } from '@/lib/access'

export const RuntimeDefaults: GlobalConfig = {
  slug: 'runtime-defaults',
  access: {
    read: ({ req }) => hasAdminSession(req),
    update: ({ req }) => hasAdminSession(req),
  },
  admin: {
    group: 'Platform',
  },
  fields: [
    {
      defaultValue:
        'You are the GameMaster. Run a vivid, fast-moving tabletop RPG session. Respect the current campaign tone, stay grounded in the active rulebooks, and keep responses speakable for voice output.',
      name: 'systemPrompt',
      required: true,
      type: 'textarea',
    },
    {
      defaultValue: 'gemini',
      name: 'llmProvider',
      options: [
        { label: 'Gemini', value: 'gemini' },
        { label: 'OpenAI', value: 'openai' },
      ],
      type: 'select',
    },
    {
      defaultValue: 'gemini-2.5-flash',
      name: 'llmModel',
      type: 'text',
    },
    {
      defaultValue: 'deepgram',
      name: 'sttProvider',
      options: [
        { label: 'Deepgram', value: 'deepgram' },
        { label: 'OpenAI', value: 'openai' },
      ],
      type: 'select',
    },
    {
      defaultValue: 'nova-3',
      name: 'sttModel',
      type: 'text',
    },
    {
      defaultValue: 'deepgram',
      name: 'ttsProvider',
      options: [
        { label: 'Deepgram', value: 'deepgram' },
        { label: 'OpenAI', value: 'openai' },
      ],
      type: 'select',
    },
    {
      defaultValue: 'aura-2',
      name: 'ttsModel',
      type: 'text',
    },
    {
      defaultValue: 'thalia-en',
      name: 'ttsVoice',
      type: 'text',
    },
    {
      defaultValue: 'auto-vad',
      name: 'voiceMode',
      options: [
        { label: 'Auto VAD', value: 'auto-vad' },
        { label: 'Push to talk', value: 'push-to-talk' },
      ],
      type: 'select',
    },
    {
      defaultValue: 5,
      max: 12,
      min: 1,
      name: 'retrievalTopK',
      type: 'number',
    },
    {
      defaultValue: 6,
      max: 12,
      min: 1,
      name: 'maxParticipants',
      type: 'number',
    },
    {
      defaultValue: true,
      name: 'allowTextFallback',
      type: 'checkbox',
    },
    {
      defaultValue:
        'Welcome to the table. Introduce the current scene, confirm the player intent, and start with a strong first prompt.',
      name: 'joinGreeting',
      type: 'textarea',
    },
  ],
}
