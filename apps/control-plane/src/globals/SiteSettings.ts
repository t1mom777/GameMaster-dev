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
      defaultValue: 'Voice-first tabletop sessions with admin-grade campaign control.',
      name: 'tagline',
      type: 'textarea',
    },
    {
      defaultValue: 'Join a room, speak naturally, and let the GM keep the world coherent through active rulebooks and scene memory.',
      name: 'publicDescription',
      type: 'textarea',
    },
  ],
}
