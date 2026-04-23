import type { CollectionConfig } from 'payload'

import { hasAdminSession } from '@/lib/access'

export const PrelaunchLeads: CollectionConfig = {
  slug: 'prelaunch-leads',
  access: {
    create: () => true,
    delete: ({ req }) => hasAdminSession(req),
    read: ({ req }) => hasAdminSession(req),
    update: ({ req }) => hasAdminSession(req),
  },
  admin: {
    defaultColumns: ['email', 'name', 'source', 'status', 'createdAt'],
    group: 'Growth',
    useAsTitle: 'email',
  },
  fields: [
    {
      name: 'email',
      required: true,
      type: 'email',
      unique: true,
    },
    {
      name: 'name',
      type: 'text',
    },
    {
      defaultValue: 'kickstarter',
      name: 'source',
      options: [
        {
          label: 'Kickstarter',
          value: 'kickstarter',
        },
        {
          label: 'Product Hunt',
          value: 'product-hunt',
        },
        {
          label: 'Manual',
          value: 'manual',
        },
      ],
      required: true,
      type: 'select',
    },
    {
      admin: {
        description: 'Optional note from the lead or operator.',
      },
      name: 'notes',
      type: 'textarea',
    },
    {
      defaultValue: 'new',
      name: 'status',
      options: [
        {
          label: 'New',
          value: 'new',
        },
        {
          label: 'Contacted',
          value: 'contacted',
        },
        {
          label: 'Warm',
          value: 'warm',
        },
        {
          label: 'Backer',
          value: 'backer',
        },
      ],
      required: true,
      type: 'select',
    },
  ],
}
