import type { GlobalConfig } from 'payload'

import { hasAdminSession } from '@/lib/access'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  access: {
    read: () => true,
    update: ({ req }) => hasAdminSession(req),
  },
  admin: {
    group: 'Platform',
  },
  fields: [
    {
      defaultValue: 'GameMaster',
      name: 'siteTitle',
      required: true,
      type: 'text',
    },
    {
      defaultValue: 'A voice-first tabletop app that gets players from sign-in to scene without interface clutter.',
      name: 'tagline',
      type: 'textarea',
    },
    {
      defaultValue: 'Join a room, speak naturally, and keep the story moving through clean voice play and active books.',
      name: 'publicDescription',
      type: 'textarea',
    },
  ],
}
