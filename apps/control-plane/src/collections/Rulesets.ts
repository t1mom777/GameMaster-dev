import type { CollectionConfig } from 'payload'

import { hasAdminSession } from '@/lib/access'
import { toSlug } from '@/lib/slug'

export const Rulesets: CollectionConfig = {
  slug: 'rulesets',
  access: {
    create: ({ req }) => hasAdminSession(req),
    delete: ({ req }) => hasAdminSession(req),
    read: ({ req }) => hasAdminSession(req),
    update: ({ req }) => hasAdminSession(req),
  },
  admin: {
    defaultColumns: ['title', 'slug', 'campaign'],
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
            return toSlug(String(siblingData?.title || 'ruleset'))
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
      name: 'campaign',
      relationTo: 'campaigns',
      type: 'relationship',
    },
    {
      name: 'summary',
      type: 'textarea',
    },
    {
      hasMany: false,
      name: 'primaryRulebook',
      relationTo: 'documents',
      type: 'relationship',
    },
    {
      hasMany: true,
      name: 'supportingBooks',
      relationTo: 'documents',
      type: 'relationship',
    },
  ],
}
