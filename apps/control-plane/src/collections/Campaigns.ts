import type { CollectionConfig } from 'payload'

import { hasAdminSession } from '@/lib/access'
import { toSlug } from '@/lib/slug'

export const Campaigns: CollectionConfig = {
  slug: 'campaigns',
  access: {
    create: ({ req }) => hasAdminSession(req),
    delete: ({ req }) => hasAdminSession(req),
    read: ({ req }) => hasAdminSession(req),
    update: ({ req }) => hasAdminSession(req),
  },
  admin: {
    defaultColumns: ['title', 'slug', 'updatedAt'],
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
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
            return toSlug(String(siblingData?.title || 'campaign'))
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
      name: 'pitch',
      type: 'textarea',
    },
    {
      maxRows: 10,
      name: 'tableExpectations',
      type: 'array',
      fields: [
        {
          name: 'expectation',
          required: true,
          type: 'text',
        },
      ],
    },
    {
      name: 'primaryRuleset',
      relationTo: 'rulesets',
      type: 'relationship',
    },
  ],
}
