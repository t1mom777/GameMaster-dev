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
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        if (operation !== 'create' || !data) {
          return data
        }

        const defaults = (await req.payload
          .findGlobal({
            overrideAccess: true,
            slug: 'quota-defaults',
          } as never)
          .catch(() => null)) as
          | {
              canCreateRooms?: boolean | null
              monthlySessionQuota?: number | null
              monthlyVoiceMinutes?: number | null
              preferredVoiceMode?: string | null
              quotaTier?: string | null
            }
          | null

        if (defaults?.quotaTier && !data.quotaTier) {
          data.quotaTier = defaults.quotaTier
        }

        if (typeof defaults?.monthlySessionQuota === 'number' && data.monthlySessionQuota === undefined) {
          data.monthlySessionQuota = defaults.monthlySessionQuota
        }

        if (typeof defaults?.monthlyVoiceMinutes === 'number' && data.monthlyVoiceMinutes === undefined) {
          data.monthlyVoiceMinutes = defaults.monthlyVoiceMinutes
        }

        if (typeof defaults?.canCreateRooms === 'boolean' && data.canCreateRooms === undefined) {
          data.canCreateRooms = defaults.canCreateRooms
        }

        if (defaults?.preferredVoiceMode && !data.preferredVoiceMode) {
          data.preferredVoiceMode = defaults.preferredVoiceMode
        }

        return data
      },
    ],
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
      name: 'ttsSettings',
      type: 'group',
      admin: {
        description:
          'GM voice override for sessions owned by this player. Turn off Use global settings if this player should hear a different GM voice than the site default.',
      },
      fields: [
        {
          admin: {
            description: 'Keep this on to inherit the global GM voice. Turn it off to define a player-specific override.',
          },
          defaultValue: true,
          name: 'useGlobalSettings',
          type: 'checkbox',
        },
        {
          admin: {
            condition: (_, siblingData) => siblingData?.useGlobalSettings === false,
            description: 'TTS provider for this player-owned GM voice.',
          },
          defaultValue: 'deepgram',
          name: 'provider',
          options: [
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
          ],
          required: true,
          type: 'select',
        },
        {
          admin: {
            condition: (_, siblingData) => siblingData?.useGlobalSettings === false,
            description: 'Voice slug for this player-owned GM voice.',
          },
          name: 'voice',
          type: 'text',
        },
        {
          admin: {
            condition: (_, siblingData) => siblingData?.useGlobalSettings === false,
            description: 'Playback rate. Values below 1 slow the GM down.',
          },
          name: 'speed',
          type: 'number',
        },
        {
          admin: {
            condition: (_, siblingData) => siblingData?.useGlobalSettings === false,
            description: 'Optional tonal adjustment when supported by the selected provider.',
          },
          name: 'pitch',
          type: 'number',
        },
        {
          admin: {
            condition: (_, siblingData) => siblingData?.useGlobalSettings === false,
            description: 'Style instructions for this player-owned GM voice.',
          },
          name: 'instructions',
          type: 'textarea',
        },
        {
          admin: {
            components: {
              Field: '@/components/admin/PlayerVoicePreviewField#PlayerVoicePreviewField',
            },
          },
          label: 'Preview',
          name: 'voicePreview',
          type: 'ui',
        },
      ],
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
